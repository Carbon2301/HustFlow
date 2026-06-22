"use server";

import { auth } from "@clerk/nextjs/server";
import { BoardMemberRole } from "@prisma/client";
import { z } from "zod";

import { generateAiText } from "@/lib/ai/client";
import { parseAiJson } from "@/lib/ai/json";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { isAssignableBoardMember } from "@/lib/boards/board-member-role";
import { logger } from "@/lib/logger";
import { requireBoardEditor } from "@/lib/permissions";

import { AnalyzeSmartCapture } from "./schema";
import { InputType, ReturnType } from "./types";

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 3_000;
const CHECKLIST_MAX_ITEMS = 20;
const CHECKLIST_ITEM_MAX_LENGTH = 120;
const MIN_ACTIONABLE_TEXT_LENGTH = 12;
const MIN_ACTIONABLE_TOKEN_COUNT = 3;
const INSUFFICIENT_SMART_CAPTURE_CONTENT_ERROR =
  "Nội dung chưa đủ thông tin để tạo thẻ. Hãy mô tả công việc, người phụ trách hoặc hạn chót rõ hơn.";
const GROUP_ASSIGNMENT_EVIDENCES = [
  "moi nguoi",
  "ca nhom",
  "toan team",
  "ca team",
  "all members",
  "all team",
  "everyone",
  "tat ca thanh vien",
];

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

const normalizeAssigneeEvidence = (value: string | null | undefined) =>
  normalizeVietnameseForCompare(value ?? "")
    .replace(/[^\p{L}\p{N}@._+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const includesEvidencePhrase = (source: string, evidence: string) => {
  if (!source || !evidence) {
    return false;
  }

  return new RegExp(`(?:^|\\s)${escapeRegExp(evidence)}(?:\\s|$)`).test(source);
};

const getSignalTokens = (value: string) =>
  normalizeVietnameseForCompare(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => /[\p{L}]/u.test(token));

const isRepeatedCharacterInput = (value: string) => {
  const compactValue = normalizeVietnameseForCompare(value)
    .replace(/[^\p{L}\p{N}]+/gu, "");

  return compactValue.length > 0 && /^(.)(?:\1)+$/u.test(compactValue);
};

const hasActionableSmartCaptureContent = (value: string) => {
  const normalizedValue = normalizeVietnameseForCompare(trimWhitespace(value))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = getSignalTokens(value);

  return (
    normalizedValue.length >= MIN_ACTIONABLE_TEXT_LENGTH &&
    tokens.length >= MIN_ACTIONABLE_TOKEN_COUNT &&
    !isRepeatedCharacterInput(value)
  );
};

const hasGroupAssignmentIntent = (value: string) => {
  const normalizedValue = normalizeAssigneeEvidence(value);

  return GROUP_ASSIGNMENT_EVIDENCES.some((evidence) =>
    includesEvidencePhrase(normalizedValue, evidence),
  );
};

const isGroupAssignmentEvidence = (value: string) =>
  GROUP_ASSIGNMENT_EVIDENCES.some((evidence) =>
    value === evidence || includesEvidencePhrase(value, evidence),
  );

const hasBoardEntityTitleEvidence = (rawText: string, title: string | null | undefined) => {
  const evidence = normalizeAssigneeEvidence(title);

  return (
    evidence.length >= 2 &&
    includesEvidencePhrase(normalizeAssigneeEvidence(rawText), evidence)
  );
};

const getRawTextEvidenceTokens = (value: string) => {
  const tokens = new Map<string, string>();
  const matches = value.matchAll(/[\p{L}\p{N}@._+-]+/gu);

  for (const match of matches) {
    const rawToken = match[0];
    const normalizedToken = normalizeAssigneeEvidence(rawToken);

    if (normalizedToken.length >= 3 && /[\p{L}]/u.test(normalizedToken)) {
      tokens.set(normalizedToken, rawToken);
    }
  }

  return tokens;
};

const getMemberNameSignals = (member: AssignableMember) => {
  const normalizedName = normalizeAssigneeEvidence(member.userName);
  const normalizedEmailLocalPart = normalizeAssigneeEvidence(member.userEmail?.split("@")[0]);
  const signals = new Set(
    normalizedName
      .split(/\s+/)
      .filter((part) => part.length >= 3),
  );

  if (normalizedEmailLocalPart.length >= 3) {
    signals.add(normalizedEmailLocalPart);
  }

  return signals;
};

const getAmbiguousMentionWarnings = (rawText: string, members: AssignableMember[]) => {
  const normalizedRawText = normalizeAssigneeEvidence(rawText);
  const rawTextTokens = getRawTextEvidenceTokens(rawText);
  const warnings: string[] = [];

  for (const [normalizedToken, rawToken] of rawTextTokens) {
    const matchingMembers = members.filter((member) =>
      getMemberNameSignals(member).has(normalizedToken),
    );

    if (matchingMembers.length <= 1) {
      continue;
    }

    const hasSpecificFullName = matchingMembers.some((member) =>
      includesEvidencePhrase(normalizedRawText, normalizeAssigneeEvidence(member.userName)),
    );

    if (hasSpecificFullName) {
      continue;
    }

    warnings.push(
      `"${rawToken}" khớp nhiều thành viên: ${matchingMembers
        .map((member) => member.userName)
        .join(", ")}. Vui lòng chọn thủ công.`,
    );
  }

  return warnings;
};

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
    "- Xác nhận lại mục tiêu công việc từ nội dung nguồn.",
    "",
    "## Phạm vi",
    `- Nội dung gốc: ${summary}`,
    "",
    "## Tiêu chí nghiệm thu",
    "- [ ] Làm rõ yêu cầu và người phụ trách nếu còn thiếu.",
    "- [ ] Xác nhận kết quả mong đợi trước khi hoàn thành thẻ.",
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

type AssignableMember = {
  id: string;
  userName: string;
  userEmail: string | null;
  role: BoardMemberRole;
};

const resolveAssignees = ({
  candidates,
  members,
  rawText,
}: {
  candidates: { boardMemberId: string; evidence?: string | null }[];
  members: AssignableMember[];
  rawText: string;
}) => {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const normalizedRawText = normalizeAssigneeEvidence(rawText);
  const hasGroupIntent = hasGroupAssignmentIntent(rawText);
  const warnings: string[] = [];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const member = memberById.get(candidate.boardMemberId);
    const evidence = normalizeAssigneeEvidence(candidate.evidence);

    if (!member || !evidence || !includesEvidencePhrase(normalizedRawText, evidence)) {
      continue;
    }

    if (hasGroupIntent && isGroupAssignmentEvidence(evidence)) {
      if (!seen.has(member.id)) {
        seen.add(member.id);
        result.push(member.id);
      }

      continue;
    }

    const normalizedName = normalizeAssigneeEvidence(member.userName);
    const normalizedEmail = normalizeAssigneeEvidence(member.userEmail);
    const normalizedEmailLocalPart = normalizeAssigneeEvidence(member.userEmail?.split("@")[0]);
    const evidenceTokens = evidence.split(/\s+/).filter(Boolean);
    const canUsePartialNameMatch = evidence.length >= 3 || evidenceTokens.length >= 2;
    const fullNameMatches =
      normalizedName === evidence ||
      evidence.includes(normalizedName) ||
      (canUsePartialNameMatch && normalizedName.includes(evidence));
    const emailMatches = Boolean(
      normalizedEmail &&
      (normalizedEmail === evidence || normalizedEmail.includes(evidence)),
    );
    const emailLocalPartMatches = Boolean(
      normalizedEmailLocalPart &&
      normalizedEmailLocalPart.length >= 3 &&
      normalizedEmailLocalPart === evidence,
    );
    const matchingMembers = members.filter((item) => {
      const itemName = normalizeAssigneeEvidence(item.userName);
      const itemEmail = normalizeAssigneeEvidence(item.userEmail);
      const itemEmailLocalPart = normalizeAssigneeEvidence(item.userEmail?.split("@")[0]);
      const itemNameParts = itemName.split(/\s+/).filter(Boolean);

      return (
        itemName === evidence ||
        (canUsePartialNameMatch && itemName.includes(evidence)) ||
        Boolean(itemEmail && (itemEmail === evidence || itemEmail.includes(evidence))) ||
        Boolean(itemEmailLocalPart && itemEmailLocalPart === evidence) ||
        itemNameParts.some((part) => part === evidence)
      );
    });

    if (
      matchingMembers.length > 1 &&
      !fullNameMatches &&
      !emailMatches &&
      !emailLocalPartMatches
    ) {
      warnings.push(
        `"${candidate.evidence}" khớp nhiều thành viên: ${matchingMembers
          .map((item) => item.userName)
          .join(", ")}. Vui lòng chọn thủ công.`,
      );
      continue;
    }

    if (
      !fullNameMatches &&
      !emailMatches &&
      !emailLocalPartMatches &&
      matchingMembers.length !== 1
    ) {
      continue;
    }

    if (
      !fullNameMatches &&
      !emailMatches &&
      !emailLocalPartMatches &&
      matchingMembers[0]?.id !== member.id
    ) {
      continue;
    }

    if (!seen.has(member.id)) {
      seen.add(member.id);
      result.push(member.id);
    }
  }

  return {
    assigneeBoardMemberIds: result,
    assigneeWarnings: Array.from(new Set(warnings)),
  };
};

const AiSmartCaptureResponse = z.object({
  isActionable: z.boolean().optional().default(true),
  reason: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  checklistItems: z.array(z.string()).optional().default([]),
  dueDateIso: z.string().optional().nullable(),
  assigneeBoardMemberId: z.string().optional().nullable(),
  assigneeBoardMemberIds: z.array(z.string()).optional().default([]),
  assignees: z.array(
    z.object({
      boardMemberId: z.string(),
      evidence: z.string().optional().nullable(),
    }),
  ).optional().default([]),
  labelIds: z.array(z.string()).optional().default([]),
  listId: z.string().optional().nullable(),
});

const systemPrompt = [
  "Bạn là trợ lý quản lý dự án cho HustFlow.",
  "Chỉ trả JSON hợp lệ, không markdown wrapper, không giải thích ngoài JSON.",
  'Định dạng bắt buộc: {"isActionable":true,"reason":null,"title":"...","description":"...","checklistItems":["..."],"dueDateIso":null,"assignees":[{"boardMemberId":"...","evidence":"..."}],"labelIds":[],"listId":null}.',
  "Nếu rawText không mô tả một công việc cụ thể, không có mục tiêu/hành động có thể tạo thẻ, hoặc chỉ là lời chào/test/noise, trả isActionable=false, reason ngắn, title rỗng, description rỗng, checklistItems=[], assignees=[], labelIds=[], listId=null.",
  "Chỉ dùng id có trong boardContext. Không tự tạo list, label hoặc member mới.",
  "Chỉ chọn assignee từ boardContext.assignableMembers. Không chọn viewer/guest hoặc member không có trong assignableMembers.",
  "Nếu nội dung nhắc nhiều người phụ trách, trả tất cả người phù hợp trong assignees.",
  "Chỉ trả nhiều assignee cho cả nhóm khi rawText có cụm rõ như mọi người, cả nhóm, toàn team, all members hoặc all team.",
  "Mỗi assignee phải có evidence là đoạn text gốc khiến bạn match người đó, ví dụ full name, email, username hoặc tên được nhắc.",
  "Nếu không chắc assignee, label hoặc list, trả mảng rỗng hoặc null cho field không áp dụng.",
  "Chỉ chọn label hoặc list khi rawText có tín hiệu rõ tương ứng với tên label/list hoặc ngữ cảnh rất trực tiếp.",
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

    if (!hasActionableSmartCaptureContent(rawText)) {
      return { error: INSUFFICIENT_SMART_CAPTURE_CONTENT_ERROR };
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
          role: true,
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

    const assignableMembers = members.filter(isAssignableBoardMember);

    const payload = {
      nowIso,
      timezoneOffsetMinutes,
      timezoneLabel,
      localNowIso,
      rawText,
      boardContext: {
        lists,
        assignableMembers,
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

    if (!parsed.isActionable) {
      return { error: INSUFFICIENT_SMART_CAPTURE_CONTENT_ERROR };
    }

    const validListIds = new Set(lists.map((list) => list.id));
    const validMemberIds = new Set(assignableMembers.map((member) => member.id));
    const validLabelIds = new Set(labels.map((label) => label.id));
    const listsById = new Map(lists.map((list) => [list.id, list]));
    const labelsById = new Map(labels.map((label) => [label.id, label]));
    const title = trimWhitespace(parsed.title || rawText).slice(0, TITLE_MAX_LENGTH);
    const assigneeCandidates = parsed.assignees.filter((candidate) =>
      validMemberIds.has(candidate.boardMemberId),
    );
    const {
      assigneeBoardMemberIds,
      assigneeWarnings: resolvedAssigneeWarnings,
    } = resolveAssignees({
      candidates: assigneeCandidates,
      members: assignableMembers,
      rawText,
    });
    const assigneeWarnings = Array.from(new Set([
      ...resolvedAssigneeWarnings,
      ...getAmbiguousMentionWarnings(rawText, assignableMembers),
    ]));
    const labelIds = Array.from(new Set(parsed.labelIds.filter((id) => {
      const label = labelsById.get(id);

      return validLabelIds.has(id) && hasBoardEntityTitleEvidence(rawText, label?.title);
    })));
    const suggestedListId =
      parsed.listId &&
      validListIds.has(parsed.listId) &&
      hasBoardEntityTitleEvidence(rawText, listsById.get(parsed.listId)?.title)
        ? parsed.listId
        : null;

    return {
      data: {
        title: title || "Thẻ mới từ Smart Capture",
        description: normalizeDescription(parsed.description, rawText),
        checklistItems: normalizeChecklistItems(parsed.checklistItems),
        dueDateIso: parseDueDate(parsed.dueDateIso, timezoneLabel),
        assigneeBoardMemberIds,
        labelIds,
        listId: suggestedListId ?? lists[0].id,
        suggestedAssigneeBoardMemberIds: assigneeBoardMemberIds,
        assigneeWarnings,
        suggestedLabelIds: labelIds,
      },
    };
  } catch (error) {
    logger.error("[ANALYZE_SMART_CAPTURE_ERROR]", error, {
      action: "analyze-smart-capture",
      aiFeature: "smart-capture",
      orgId,
      userId,
      boardId,
    });

    return {
      error: error instanceof Error
        ? error.message
        : "AI chưa phân tích được nội dung này. Hãy thử lại.",
    };
  }
};

export const analyzeSmartCapture = createSafeAction(AnalyzeSmartCapture, handler);
