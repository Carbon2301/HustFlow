"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { generateAiText } from "@/lib/ai/client";
import { AI_CHECKLIST_LIMITS } from "@/lib/ai/config";
import { parseAiJson } from "@/lib/ai/json";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";

import { GenerateAiChecklist } from "./schema";
import { InputType, ReturnType } from "./types";

const trimToLength = (value: string | null | undefined, maxLength: number) =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);

const normalizeForDedupe = (value: string) => value.trim().toLowerCase();

const dedupeItems = (items: string[], existingItems: string[] = []) => {
  const seen = new Set(existingItems.map(normalizeForDedupe));
  const result: string[] = [];

  for (const item of items) {
    const title = item.replace(/\s+/g, " ").trim();
    const key = normalizeForDedupe(title);

    if (
      title.length < 3 ||
      title.length > AI_CHECKLIST_LIMITS.itemMaxLength ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    result.push(title);

    if (result.length >= AI_CHECKLIST_LIMITS.maxItems) {
      break;
    }
  }

  return result;
};

const AiChecklistResponse = z.object({
  items: z.array(
    z.string()
      .transform((value) => value.replace(/\s+/g, " ").trim())
      .pipe(z.string().min(3).max(AI_CHECKLIST_LIMITS.itemMaxLength)),
  ).min(1).max(AI_CHECKLIST_LIMITS.maxItems),
});

const systemPrompt = [
  "Bạn là trợ lý quản lý dự án cho HustFlow.",
  "Chỉ trả JSON hợp lệ, không markdown, không giải thích.",
  'Định dạng bắt buộc: {"items":["..."]}.',
  "Viết bằng tiếng Việt.",
  "Mỗi item là một hành động cụ thể, ngắn gọn, phù hợp với task.",
  "Không thêm ngày hạn, assignee, label hoặc metadata.",
  "Không lặp lại checklist item đã có.",
  "Không bịa dữ liệu ngoài context được cung cấp.",
].join("\n");

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId } = data;

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
              },
            },
          },
        },
        labels: {
          select: {
            label: {
              select: {
                title: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        checklists: {
          select: {
            items: {
              select: {
                title: true,
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!card || !card.title.trim()) {
      return { error: "Không tìm thấy thẻ hợp lệ để tạo checklist." };
    }

    const existingChecklistItems = card.checklists.flatMap((checklist) =>
      checklist.items.map((item) => item.title),
    );
    const payload = {
      boardTitle: trimToLength(card.list.board.title, AI_CHECKLIST_LIMITS.nameMaxLength),
      listTitle: trimToLength(card.list.title, AI_CHECKLIST_LIMITS.nameMaxLength),
      cardTitle: trimToLength(card.title, AI_CHECKLIST_LIMITS.titleMaxLength),
      cardDescription: trimToLength(card.description, AI_CHECKLIST_LIMITS.descriptionMaxLength),
      labels: card.labels
        .map(({ label }) => trimToLength(label.title, AI_CHECKLIST_LIMITS.nameMaxLength))
        .filter(Boolean),
      existingChecklistItems: existingChecklistItems
        .map((item) => trimToLength(item, AI_CHECKLIST_LIMITS.itemMaxLength))
        .filter(Boolean),
      requestedItems: {
        min: AI_CHECKLIST_LIMITS.minItems,
        max: AI_CHECKLIST_LIMITS.maxItems,
      },
    };

    const raw = await generateAiText({
      system: systemPrompt,
      user: JSON.stringify(payload),
      temperature: 0.25,
      maxTokens: 600,
    });
    const parsed = parseAiJson(raw, AiChecklistResponse);
    const items = dedupeItems(parsed.items, existingChecklistItems);

    if (items.length === 0) {
      return { error: "AI chưa tạo được checklist hợp lệ. Hãy thử lại." };
    }

    return {
      data: {
        items,
      },
    };
  } catch (error) {
    console.error("[GENERATE_AI_CHECKLIST_ERROR]", error);

    return {
      error: error instanceof Error
        ? error.message
        : "AI chưa tạo được checklist hợp lệ. Hãy thử lại.",
    };
  }
};

export const generateAiChecklist = createSafeAction(GenerateAiChecklist, handler);
