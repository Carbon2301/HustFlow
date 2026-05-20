"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { generateAiText } from "@/lib/ai/client";
import { AI_CARD_QUALITY_LIMITS } from "@/lib/ai/config";
import { parseAiJson } from "@/lib/ai/json";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";

import { GenerateAiCardQuality } from "./schema";
import { InputType, ReturnType } from "./types";

const trimToLength = (value: string | null | undefined, maxLength: number) =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);

const normalizeVietnameseForCompare = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const hasRequiredMarkdownHeadings = (value: string) => {
  const normalizedValue = normalizeVietnameseForCompare(value);

  return (
    normalizedValue.includes("## muc tieu") &&
    normalizedValue.includes("## pham vi") &&
    normalizedValue.includes("## dieu kien hoan thanh")
  );
};

const normalizeDescriptionHeadings = (value: string) =>
  value
    .replace(/^##\s*Acceptance criteria\s*:?\s*$/gim, "## Điều kiện hoàn thành")
    .replace(/^##\s*Tiêu chí nghiệm thu\s*:?\s*$/gim, "## Điều kiện hoàn thành");

const normalizeDescriptionForCompare = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?'"“”‘’`-]/g, "")
    .trim();

const DescriptionResponse = z.object({
  description: z.string()
    .transform((value) => value.trim())
    .transform(normalizeDescriptionHeadings)
    .pipe(
      z.string()
        .min(AI_CARD_QUALITY_LIMITS.descriptionOutputMinLength)
        .max(AI_CARD_QUALITY_LIMITS.descriptionOutputMaxLength)
        .refine((value) => !value.includes("```"), {
          message: "Mô tả không được chứa markdown code fence.",
        })
        .refine(hasRequiredMarkdownHeadings, {
          message: "Mô tả phải có đầy đủ các tiêu đề bắt buộc (Mục tiêu, Phạm vi, Điều kiện hoàn thành).",
        }),
    ),
});

const descriptionSystemPrompt = [
  "Bạn là trợ lý quản lý dự án cho HustFlow.",
  "Chỉ trả JSON hợp lệ, không giải thích ngoài JSON, không bọc bằng markdown code fence.",
  'Định dạng bắt buộc: {"description":"..."}',
  "Giá trị description phải là Markdown thuần, tiếng Việt rõ ràng, gọn và dễ scan trong Card Modal.",
  "Bắt buộc dùng đúng 3 heading cấp 2 theo thứ tự:",
  "## Mục tiêu",
  "## Phạm vi",
  "## Điều kiện hoàn thành",
  "Dưới ## Mục tiêu: viết 1-2 bullet ngắn, bắt đầu bằng '- '.",
  "Dưới ## Phạm vi: viết 2-4 bullet cụ thể, bắt đầu bằng '- '.",
  "Dưới ## Điều kiện hoàn thành: viết 3-6 checklist item dạng '- [ ] ...'.",
  "Không trả về một đoạn văn dài. Không dùng heading khác thay cho 3 heading bắt buộc.",
  "Không bịa dữ liệu ngoài context. Nếu thiếu context, chỉ suy luận tối thiểu từ title/list/board/label.",
].join("\n");

const rewriteSystemPrompt = [
  descriptionSystemPrompt,
  "Giữ ý chính, dữ kiện và ràng buộc của description cũ.",
  "Chuẩn hóa lại thành Markdown theo đúng format 3 heading bắt buộc.",
  "Nếu description cũ đã có Markdown, giữ thông tin hữu ích nhưng cải thiện cấu trúc, độ rõ và checklist nghiệm thu.",
  "Bắt buộc diễn đạt lại rõ hơn; không được trả lại nguyên văn.",
  "Không biến card thành một task khác.",
].join("\n");

const getSystemPrompt = (task: InputType["task"]) => {
  if (task === "rewrite_description") {
    return rewriteSystemPrompt;
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
    const permission = await requireBoardEditor({ boardId, orgId, userId });

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
      temperature: task === "rewrite_description" ? 0.5 : 0.35,
      maxTokens: 1200,
    });

    const raw = await generate();

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
