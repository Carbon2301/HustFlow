"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { generateAiText } from "@/lib/ai/client";
import { AI_CARD_QUALITY_LIMITS } from "@/lib/ai/config";
import { parseAiJson } from "@/lib/ai/json";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

import { GenerateAiCardQuality } from "./schema";
import { InputType, ReturnType } from "./types";

const trimToLength = (value: string | null | undefined, maxLength: number) =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);

const normalizeDescriptionForCompare = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?'"“”‘’`-]/g, "")
    .trim();

const DescriptionResponse = z.object({
  description: z.string()
    .transform((value) => value.trim())
    .pipe(
      z.string()
        .min(AI_CARD_QUALITY_LIMITS.descriptionOutputMinLength)
        .max(AI_CARD_QUALITY_LIMITS.descriptionOutputMaxLength),
    ),
});

const LabelResponse = z.object({
  labelIds: z.array(z.string().transform((value) => value.trim()))
    .max(AI_CARD_QUALITY_LIMITS.maxSuggestedLabels),
  reason: z.string().max(300).optional(),
});

const descriptionSystemPrompt = [
  "Bạn là trợ lý quản lý dự án cho HustFlow.",
  "Chỉ trả JSON hợp lệ, không markdown bao ngoài, không giải thích.",
  'Định dạng bắt buộc: {"description":"..."}',
  "Viết tiếng Việt rõ ràng.",
  "Description phải có 3 phần: Mục tiêu:, Phạm vi:, Acceptance criteria:.",
  "Không bịa dữ liệu ngoài context. Nếu thiếu context, chỉ suy luận tối thiểu từ title.",
].join("\n");

const rewriteSystemPrompt = [
  descriptionSystemPrompt,
  "Giữ ý chính của description cũ, chỉ làm rõ cấu trúc và tiêu chí nghiệm thu.",
  "Bắt buộc viết lại bằng cách diễn đạt khác, rõ hơn và có tổ chức hơn; không được trả lại nguyên văn.",
  "Nếu description cũ đã đúng format, hãy cải thiện độ cụ thể của Phạm vi và Acceptance criteria.",
  "Không biến card thành một task khác.",
].join("\n");

const labelSystemPrompt = [
  "Bạn là trợ lý quản lý dự án cho HustFlow.",
  "Chỉ trả JSON hợp lệ, không markdown, không giải thích.",
  'Định dạng bắt buộc: {"labelIds":["..."],"reason":"..."}',
  "Chỉ chọn labelId từ boardLabels được cung cấp.",
  "Không tạo label mới, không trả label đang active.",
  `Trả tối đa ${AI_CARD_QUALITY_LIMITS.maxSuggestedLabels} label phù hợp nhất.`,
].join("\n");

const getSystemPrompt = (task: InputType["task"]) => {
  if (task === "rewrite_description") {
    return rewriteSystemPrompt;
  }

  if (task === "suggest_labels") {
    return labelSystemPrompt;
  }

  return descriptionSystemPrompt;
};

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, task } = data;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const card = await db.card.findFirst({
      where: {
        id: cardId,
        archivedAt: null,
        list: {
          archivedAt: null,
          board: {
            id: boardId,
            orgId,
          },
        },
      },
      select: {
        title: true,
        description: true,
        list: {
          select: {
            title: true,
            board: {
              select: {
                title: true,
                labels: {
                  select: {
                    id: true,
                    title: true,
                    color: true,
                  },
                  orderBy: {
                    createdAt: "asc",
                  },
                },
              },
            },
          },
        },
        labels: {
          select: {
            label: {
              select: {
                id: true,
                title: true,
                color: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!card || !card.title.trim()) {
      return { error: "Không tìm thấy thẻ hợp lệ để AI hỗ trợ." };
    }

    if (task === "rewrite_description" && !card.description?.trim()) {
      return { error: "Thẻ chưa có mô tả để viết lại." };
    }

    const activeLabelIds = new Set(card.labels.map(({ label }) => label.id));
    const availableLabels = card.list.board.labels.filter((label) => !activeLabelIds.has(label.id));

    if (task === "suggest_labels" && availableLabels.length === 0) {
      return {
        data: {
          task,
          labelIds: [],
          reason: "Không còn nhãn nào có thể gợi ý cho thẻ này.",
        },
      };
    }

    const payload = {
      task,
      boardTitle: trimToLength(card.list.board.title, AI_CARD_QUALITY_LIMITS.nameMaxLength),
      listTitle: trimToLength(card.list.title, AI_CARD_QUALITY_LIMITS.nameMaxLength),
      cardTitle: trimToLength(card.title, AI_CARD_QUALITY_LIMITS.titleMaxLength),
      cardDescription: trimToLength(
        card.description,
        AI_CARD_QUALITY_LIMITS.descriptionInputMaxLength,
      ),
      activeLabels: card.labels.map(({ label }) => ({
        id: label.id,
        title: trimToLength(label.title, AI_CARD_QUALITY_LIMITS.nameMaxLength),
        color: label.color,
      })),
      boardLabels: availableLabels.map((label) => ({
        id: label.id,
        title: trimToLength(label.title, AI_CARD_QUALITY_LIMITS.nameMaxLength),
        color: label.color,
      })),
    };

    const generate = (extraPrompt?: string) => generateAiText({
      system: getSystemPrompt(task),
      user: JSON.stringify(extraPrompt ? { ...payload, rewriteInstruction: extraPrompt } : payload),
      temperature: task === "rewrite_description" ? 0.5 : task === "suggest_labels" ? 0.15 : 0.35,
      maxTokens: task === "suggest_labels" ? 350 : 900,
    });

    const raw = await generate();

    if (task === "suggest_labels") {
      const parsed = parseAiJson(
        raw,
        LabelResponse,
        "AI chưa gợi ý được nhãn hợp lệ. Hãy thử lại.",
      );
      const availableLabelIds = new Set(availableLabels.map((label) => label.id));
      const seen = new Set<string>();
      const labelIds = parsed.labelIds.filter((labelId) => {
        if (!availableLabelIds.has(labelId) || seen.has(labelId)) {
          return false;
        }

        seen.add(labelId);
        return true;
      }).slice(0, AI_CARD_QUALITY_LIMITS.maxSuggestedLabels);

      return {
        data: {
          task,
          labelIds,
          reason: parsed.reason,
        },
      };
    }

    let parsed = parseAiJson(
      raw,
      DescriptionResponse,
      "AI chưa tạo được mô tả hợp lệ. Hãy thử lại.",
    );

    if (
      task === "rewrite_description" &&
      normalizeDescriptionForCompare(parsed.description) === normalizeDescriptionForCompare(card.description)
    ) {
      const retryRaw = await generate(
        "Output trước đó quá giống description cũ. Hãy viết lại rõ ràng hơn, thay đổi câu chữ và bổ sung tiêu chí nghiệm thu cụ thể hơn nhưng không bịa thêm dữ liệu.",
      );

      parsed = parseAiJson(
        retryRaw,
        DescriptionResponse,
        "AI chưa tạo được mô tả viết lại hợp lệ. Hãy thử lại.",
      );

      if (
        normalizeDescriptionForCompare(parsed.description) === normalizeDescriptionForCompare(card.description)
      ) {
        return {
          error: "AI trả về mô tả quá giống bản cũ. Hãy chỉnh mô tả hiện tại hoặc thử lại.",
        };
      }
    }

    return {
      data: {
        task,
        description: parsed.description,
      },
    };
  } catch (error) {
    console.error("[GENERATE_AI_CARD_QUALITY_ERROR]", error);

    return {
      error: error instanceof Error
        ? error.message
        : "AI chưa hỗ trợ được thẻ này. Hãy thử lại.",
    };
  }
};

export const generateAiCardQuality = createSafeAction(GenerateAiCardQuality, handler);
