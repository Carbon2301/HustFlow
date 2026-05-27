"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { generateAiText } from "@/lib/ai/client";
import { parseAiJson } from "@/lib/ai/json";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";

import { AnalyzeSmartCapture } from "./schema";
import { InputType, ReturnType } from "./types";

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 3_000;
const CHECKLIST_MAX_ITEMS = 20;
const CHECKLIST_ITEM_MAX_LENGTH = 120;

const trimWhitespace = (value: string | null | undefined) =>
  (value ?? "").replace(/\s+/g, " ").trim();

const trimMultiline = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

const normalizeVietnameseForCompare = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const hasRequiredMarkdownHeadings = (value: string) => {
  const normalized = normalizeVietnameseForCompare(value);

  return (
    normalized.includes("## muc tieu") &&
    normalized.includes("## pham vi") &&
    (
      normalized.includes("## tieu chi nghiem thu") ||
      normalized.includes("## dieu kien hoan thanh")
    )
  );
};

const normalizeDescriptionHeadings = (value: string) =>
  value
    .replace(/^##\s*Acceptance criteria\s*:?\s*$/gim, "## Tiêu chí nghiệm thu")
    .replace(/^##\s*Điều kiện hoàn thành\s*:?\s*$/gim, "## Tiêu chí nghiệm thu");

const fallbackDescription = (rawText: string) => {
  const summary = trimWhitespace(rawText).slice(0, 600);

  return [
    "## Mục tiêu",
    `- Chuyển nội dung trao đổi thành một thẻ công việc rõ ràng.`,
    "",
    "## Phạm vi",
    `- Nội dung gốc: ${summary}`,
    "",
    "## Tiêu chí nghiệm thu",
    "- [ ] Xác nhận lại mục tiêu và phạm vi công việc.",
    "- [ ] Hoàn thành các đầu việc chính được nêu trong nội dung.",
    "- [ ] Cập nhật kết quả trên thẻ HustFlow.",
  ].join("\n");
};

const normalizeDescription = (value: string | null | undefined, rawText: string) => {
  const description = normalizeDescriptionHeadings(trimMultiline(value));

  if (
    !description ||
    description.length > DESCRIPTION_MAX_LENGTH ||
    description.includes("```") ||
    !hasRequiredMarkdownHeadings(description)
  ) {
    return fallbackDescription(rawText).slice(0, DESCRIPTION_MAX_LENGTH);
  }

  return description;
};

const normalizeChecklistItems = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const title = trimWhitespace(item).slice(0, CHECKLIST_ITEM_MAX_LENGTH);
    const key = title.toLowerCase();

    if (title.length < 3 || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(title);

    if (result.length >= CHECKLIST_MAX_ITEMS) {
      break;
    }
  }

  return result;
};

const hasTimezoneSuffix = (value: string) =>
  /(?:z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

const parseDueDate = (
  value: string | null | undefined,
  timezoneLabel?: string,
) => {
  if (!value) {
    return null;
  }

  const timezoneOffset = timezoneLabel?.match(/^UTC([+-]\d{2}:\d{2})$/)?.[1];
  const normalizedValue = timezoneOffset && !hasTimezoneSuffix(value)
    ? `${value}${timezoneOffset}`
    : value;
  const date = new Date(normalizedValue);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const AiSmartCaptureResponse = z.object({
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  checklistItems: z.array(z.string()).optional().default([]),
  dueDateIso: z.string().optional().nullable(),
  assigneeBoardMemberId: z.string().optional().nullable(),
  labelIds: z.array(z.string()).optional().default([]),
  listId: z.string().optional().nullable(),
});

const systemPrompt = [
  "Bạn là trợ lý quản lý dự án cho HustFlow.",
  "Chỉ trả JSON hợp lệ, không markdown wrapper, không giải thích ngoài JSON.",
  'Định dạng bắt buộc: {"title":"...","description":"...","checklistItems":["..."],"dueDateIso":null,"assigneeBoardMemberId":null,"labelIds":[],"listId":null}.',
  "Chỉ dùng id có trong boardContext. Không tự tạo list, label hoặc member mới.",
  "Nếu không chắc assignee, label hoặc list, trả null hoặc mảng rỗng.",
  "description phải là Markdown tiếng Việt, đúng 3 heading cấp 2 theo thứ tự: ## Mục tiêu, ## Phạm vi, ## Tiêu chí nghiệm thu.",
  "Dưới Tiêu chí nghiệm thu dùng checklist Markdown dạng '- [ ] ...'.",
  "checklistItems là các đầu việc con ngắn, không lặp với tiêu chí nghiệm thu nếu có thể.",
  "dueDateIso phải là ISO 8601 có timezone nếu nội dung có deadline rõ. Nếu mơ hồ thì null.",
  "Với nội dung tiếng Việt, ngày dạng 13/6, 13-6, 13.6 phải hiểu là ngày 13 tháng 6, không dùng định dạng tháng/ngày của Mỹ.",
  "Ưu tiên timezoneLabel trong payload khi xuất dueDateIso. Ví dụ timezoneLabel là UTC+07:00 và deadline là 5h30 13/6 thì dueDateIso phải có dạng YYYY-06-13T05:30:00+07:00.",
  "Khi gặp mốc tương đối như hôm nay, ngày mai, thứ Sáu, cuối tuần, dùng localNowIso/timezoneLabel trước; nowIso/timezoneOffsetMinutes chỉ là thông tin phụ.",
  "Không bịa dữ liệu ngoài rawText và boardContext.",
].join("\n");

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, rawText, timezoneOffsetMinutes, nowIso, timezoneLabel, localNowIso } = data;

  try {
    const permission = await requireBoardEditor({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const [lists, members, labels] = await Promise.all([
      db.list.findMany({
        where: {
          boardId,
          archivedAt: null,
          board: {
            orgId,
          },
        },
        select: {
          id: true,
          title: true,
        },
        orderBy: {
          order: "asc",
        },
      }),
      db.boardMember.findMany({
        where: {
          boardId,
          board: {
            orgId,
          },
        },
        select: {
          id: true,
          userName: true,
          userEmail: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      db.label.findMany({
        where: {
          boardId,
          board: {
            orgId,
          },
        },
        select: {
          id: true,
          title: true,
          color: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

    if (lists.length === 0) {
      return { error: "Bảng chưa có cột để tạo thẻ." };
    }

    const payload = {
      nowIso,
      timezoneOffsetMinutes,
      timezoneLabel,
      localNowIso,
      rawText,
      boardContext: {
        lists,
        members,
        labels,
      },
    };

    const raw = await generateAiText({
      system: systemPrompt,
      user: JSON.stringify(payload),
      temperature: 0.2,
      maxTokens: 1_400,
    });
    const parsed = parseAiJson(
      raw,
      AiSmartCaptureResponse,
      "AI chưa tạo được bản nháp thẻ hợp lệ. Hãy thử lại.",
    );

    const validListIds = new Set(lists.map((list) => list.id));
    const validMemberIds = new Set(members.map((member) => member.id));
    const validLabelIds = new Set(labels.map((label) => label.id));
    const title = trimWhitespace(parsed.title || rawText).slice(0, TITLE_MAX_LENGTH);
    const labelIds = Array.from(new Set(parsed.labelIds.filter((id) => validLabelIds.has(id))));

    return {
      data: {
        title: title || "Thẻ mới từ Smart Capture",
        description: normalizeDescription(parsed.description, rawText),
        checklistItems: normalizeChecklistItems(parsed.checklistItems),
        dueDateIso: parseDueDate(parsed.dueDateIso, timezoneLabel),
        assigneeBoardMemberId:
          parsed.assigneeBoardMemberId && validMemberIds.has(parsed.assigneeBoardMemberId)
            ? parsed.assigneeBoardMemberId
            : null,
        labelIds,
        listId: parsed.listId && validListIds.has(parsed.listId)
          ? parsed.listId
          : lists[0].id,
        suggestedLabelIds: labelIds,
      },
    };
  } catch (error) {
    console.error("[ANALYZE_SMART_CAPTURE_ERROR]", error);

    return {
      error: error instanceof Error
        ? error.message
        : "AI chưa phân tích được nội dung này. Hãy thử lại.",
    };
  }
};

export const analyzeSmartCapture = createSafeAction(AnalyzeSmartCapture, handler);
