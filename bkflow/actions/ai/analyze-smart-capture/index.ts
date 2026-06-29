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
const SMART_CAPTURE_MAX_DRAFTS = 5;
const SOURCE_EXCERPT_MAX_LENGTH = 260;
const SPLIT_REASON_MAX_LENGTH = 180;
const SPLIT_SUMMARY_MAX_LENGTH = 240;
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
const HIGH_PRIORITY_EVIDENCES = [
  "lam gap",
  "khan cap",
  "uu tien cao",
  "urgent",
  "asap",
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

const getAmbiguousMentionWarnings = (
  rawText: string,
  members: AssignableMember[],
  ignoredTokens = new Set<string>(),
) => {
  const normalizedRawText = normalizeAssigneeEvidence(rawText);
  const rawTextTokens = getRawTextEvidenceTokens(rawText);
  const warnings: string[] = [];

  for (const [normalizedToken, rawToken] of rawTextTokens) {
    if (ignoredTokens.has(normalizedToken)) {
      continue;
    }

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

const splitRawTextIntoTaskSections = (value: string) => {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const sections: string[] = [];
  let current: string[] = [];
  let hasStartedSection = false;

  for (const line of lines) {
    const startsNumberedTask = /^\s*\d+[\).]\s+/.test(line);

    if (startsNumberedTask) {
      if (hasStartedSection && current.some((item) => item.trim())) {
        sections.push(current.join("\n").trim());
      }

      current = [line];
      hasStartedSection = true;
      continue;
    }

    if (hasStartedSection) {
      current.push(line);
    }
  }

  if (hasStartedSection && current.some((item) => item.trim())) {
    sections.push(current.join("\n").trim());
  }

  return sections.length > 1 ? sections : [];
};

const getCompareTokens = (value: string) =>
  normalizeAssigneeEvidence(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3);

const scoreSectionForDraft = (section: string, draftText: string) => {
  const normalizedSection = normalizeAssigneeEvidence(section);
  const tokens = new Set(getCompareTokens(draftText));
  let score = 0;

  for (const token of tokens) {
    if (includesEvidencePhrase(normalizedSection, token) || normalizedSection.includes(token)) {
      score += 1;
    }
  }

  return score;
};

const getDraftSourceText = ({
  card,
  rawText,
  isFallbackCard,
}: {
  card: AiSmartCaptureCard;
  rawText: string;
  isFallbackCard: boolean;
}) => {
  if (isFallbackCard) {
    return rawText;
  }

  const sourceExcerpt = trimMultiline(card.sourceExcerpt);
  const draftText = trimMultiline([
    card.title,
    sourceExcerpt,
    card.splitReason,
    card.description,
  ].filter(Boolean).join("\n"));
  const sections = splitRawTextIntoTaskSections(rawText);

  if (sections.length > 0 && draftText) {
    const bestSection = sections
      .map((section) => ({
        section,
        score: scoreSectionForDraft(section, draftText),
      }))
      .sort((left, right) => right.score - left.score)[0];

    if (bestSection && bestSection.score > 0) {
      return bestSection.section;
    }
  }

  if (hasActionableSmartCaptureContent(sourceExcerpt)) {
    return sourceExcerpt;
  }

  return draftText || sourceExcerpt;
};

const isMetadataChecklistLine = (value: string) => {
  const normalized = normalizeVietnameseForCompare(value);

  return (
    normalized.startsWith("nhan:") ||
    normalized.startsWith("label:") ||
    normalized.startsWith("deadline:") ||
    normalized.startsWith("han chot") ||
    normalized.startsWith("han xu ly") ||
    normalized.includes("deadline:") ||
    normalized.includes("nhan:") ||
    normalized.includes("gan nhan") ||
    normalized.includes("phu trach:") ||
    normalized.includes("giao cho:")
  );
};

const extractChecklistItemsFromSource = (value: string) => {
  const items = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.match(/^\s*[-*•]\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/u)?.[1] ?? "")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3 && !isMetadataChecklistLine(line));

  return normalizeChecklistItems(items);
};

const extractInlineChecklistItems = (value: string) => {
  const firstSentence = value.replace(/\r\n/g, "\n").split(/[.!?](?:\s|$)/u)[0] ?? "";
  const colonIndex = firstSentence.indexOf(":");
  const gomMatch = /\bgồm\s+(.+)$/iu.exec(firstSentence);
  const hasActionChain = colonIndex >= 0 || Boolean(gomMatch) ||
    (firstSentence.includes(",") && /\s+và\s+/iu.test(firstSentence));

  if (!hasActionChain) {
    return [];
  }

  let chain = colonIndex >= 0
    ? firstSentence.slice(colonIndex + 1)
    : (gomMatch?.[1] ?? firstSentence);

  if (!gomMatch && colonIndex < 0) {
    chain = chain
      .replace(/^\s*(?:\d+[).]\s*)?(?:[\p{Lu}][\p{L}\s]{0,60}?)\s+(?=tổng hợp|kiểm tra|viết|chuẩn bị|gửi|tạo|đặt|xác nhận)/u, "")
      .trim();
  }

  // Chỉ dùng danh sách hành động cùng một câu; các câu về mức ưu tiên/hạn chót
  // không trở thành checklist.
  return normalizeChecklistItems(
    chain
      .split(/,|\s+và\s+/iu)
      .map((item) => item.replace(/^\s*(?:gồm\s+)?/iu, "").trim())
      .filter((item) => item.length >= 3 && !isMetadataChecklistLine(item)),
  );
};

const getPriorityLabelIdsFromSource = (
  rawText: string,
  labels: { id: string; title: string }[],
) => {
  const normalizedSource = normalizeAssigneeEvidence(rawText);
  const hasHighPriorityIntent = HIGH_PRIORITY_EVIDENCES.some((evidence) =>
    includesEvidencePhrase(normalizedSource, evidence),
  );

  if (!hasHighPriorityIntent) {
    return [];
  }

  return labels
    .filter((label) => {
      const normalizedTitle = normalizeAssigneeEvidence(label.title);

      return ["high", "cao", "uu tien cao", "urgent"].includes(normalizedTitle);
    })
    .map((label) => label.id);
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

const extractFallbackDueDate = (
  value: string,
  localNowIso: string | undefined,
  timezoneLabel: string | undefined,
) => {
  const dateMatch = value.match(/(?:^|[^\d])(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?(?=$|[^\d])/u);

  if (!dateMatch) {
    return null;
  }

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const baseYear = localNowIso ? new Date(localNowIso).getFullYear() : new Date().getFullYear();
  const rawYear = dateMatch[3] ? Number(dateMatch[3]) : baseYear;
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  const timezoneOffset = timezoneLabel?.match(/^UTC([+-]\d{2}:\d{2})$/)?.[1] ?? "Z";
  const isoLikeValue = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}T23:59:00${timezoneOffset}`;

  return parseDueDate(isoLikeValue, timezoneLabel);
};

const getDateParts = (value: string | undefined) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})T/);

  if (!match) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }

  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

const getRelativeVietnameseDueDate = (
  value: string,
  localNowIso: string | undefined,
  timezoneLabel: string | undefined,
) => {
  const normalized = normalizeVietnameseForCompare(value);
  const dayNames: Record<string, number> = {
    "thu hai": 1,
    "thu ba": 2,
    "thu tu": 3,
    "thu nam": 4,
    "thu sau": 5,
    "thu bay": 6,
    "chu nhat": 0,
  };
  const weekday = Object.entries(dayNames).find(([name]) =>
    new RegExp(`(?:^|\\s)${name}(?:\\s|$)`, "u").test(normalized),
  )?.[1];
  const isTomorrow = /(?:^|\s)ngay mai(?:\s|$)/u.test(normalized);

  if (weekday === undefined && !isTomorrow) {
    return null;
  }

  const base = getDateParts(localNowIso);
  const baseUtc = Date.UTC(base.year, base.month - 1, base.day);
  const baseWeekday = new Date(baseUtc).getUTCDay();
  let offsetDays: number;

  if (isTomorrow) {
    offsetDays = 1;
  } else {
    const targetWeekday = Number(weekday);
    const isNextWeek = /\btuan sau\b/u.test(normalized);
    const mondayBasedDay = baseWeekday === 0 ? 7 : baseWeekday;
    const currentWeekMonday = baseUtc - (mondayBasedDay - 1) * 86_400_000;
    const targetInCurrentWeek = targetWeekday === 0 ? 6 : targetWeekday - 1;
    const targetUtc = currentWeekMonday + (isNextWeek ? 7 : 0) * 86_400_000 + targetInCurrentWeek * 86_400_000;
    offsetDays = Math.round((targetUtc - baseUtc) / 86_400_000);

    if (!isNextWeek && offsetDays < 0) {
      offsetDays += 7;
    }
  }

  const dueDate = new Date(baseUtc + offsetDays * 86_400_000);
  const timeMatch = normalized.match(/(\d{1,2})\s*(?:gio|h)(?:\s*(\d{1,2})\s*(?:phut|p))?\s*(sang|chieu|toi|dem)?/u);
  let hours = timeMatch ? Number(timeMatch[1]) : 23;
  const minutes = timeMatch?.[2] ? Number(timeMatch[2]) : (timeMatch ? 0 : 59);
  const period = timeMatch?.[3];

  if ((period === "chieu" || period === "toi") && hours < 12) {
    hours += 12;
  }

  if (period === "dem" && hours === 12) {
    hours = 0;
  }

  if (hours > 23 || minutes > 59) {
    return null;
  }

  const timezoneOffset = timezoneLabel?.match(/^UTC([+-]\d{2}:\d{2})$/)?.[1] ?? "Z";
  const isoLikeValue = `${dueDate.getUTCFullYear()}-${String(dueDate.getUTCMonth() + 1).padStart(2, "0")}-${String(dueDate.getUTCDate()).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00${timezoneOffset}`;

  return parseDueDate(isoLikeValue, timezoneLabel);
};

type AssignableMember = {
  id: string;
  userName: string;
  userEmail: string | null;
  role: BoardMemberRole;
};

type AssigneeCandidate = {
  boardMemberId: string;
  evidence?: string | null;
};

const cleanAssigneeMention = (value: string) =>
  trimWhitespace(value)
    .replace(/\bphụ\s+trách\b/giu, "")
    .replace(/\bgiao\s+chung\s+cho\b/giu, "")
    .replace(/\bgiao\s+cho\b/giu, "")
    .replace(/^[\s:：\-–—()]+|[\s:：\-–—()]+$/g, "")
    .replace(/^(anh|chị|ban|bạn)\s+/iu, "")
    .trim();

const extractExplicitAssigneeMentions = (value: string) => {
  const mentions: string[] = [];
  const addMention = (rawValue: string) => {
    const cleaned = cleanAssigneeMention(rawValue);

    if (cleaned && !hasGroupAssignmentIntent(cleaned)) {
      mentions.push(cleaned);
    }
  };

  for (const match of value.matchAll(/\(([^)]{1,100})\)/gu)) {
    const content = match[1];
    const normalized = normalizeAssigneeEvidence(content);

    if (normalized.includes("phu trach")) {
      addMention(content);
    }
  }

  for (const line of value.replace(/\r\n/g, "\n").split("\n")) {
    const normalized = normalizeAssigneeEvidence(line);

    if (!normalized.includes("phu trach")) {
      continue;
    }

    const beforePhrase = line.split(/phụ\s+trách/iu)[0] ?? "";
    const likelyName = beforePhrase
      .replace(/^\s*\d+[\).]\s*/, "")
      .replace(/^[-*•]\s*/, "")
      .split(/[(:：]/)
      .pop() ?? beforePhrase;

    addMention(likelyName);
  }

  for (const line of value.replace(/\r\n/g, "\n").split("\n")) {
    const match = line.match(
      /^\s*(?:\d+[).]\s*)?([^,:.\n]{1,80}?)\s+(?=tổng hợp|kiểm tra|viết|chuẩn bị|gửi|tạo|đặt|xác nhận)\b/iu,
    );

    if (match?.[1]) {
      addMention(match[1]);
    }
  }

  return Array.from(new Set(mentions.map(trimWhitespace).filter(Boolean)));
};

const getExactMentionMatches = (mention: string, members: AssignableMember[]) => {
  const evidence = normalizeAssigneeEvidence(mention);

  return members.filter((member) => {
    const normalizedName = normalizeAssigneeEvidence(member.userName);
    const normalizedEmail = normalizeAssigneeEvidence(member.userEmail);
    const normalizedEmailLocalPart = normalizeAssigneeEvidence(member.userEmail?.split("@")[0]);

    return (
      normalizedName === evidence ||
      normalizedEmail === evidence ||
      normalizedEmailLocalPart === evidence
    );
  });
};

const includesAllMentionTokens = (source: string, tokens: string[]) => {
  if (tokens.length === 0) {
    return false;
  }

  const sourceTokens = new Set(source.split(/\s+/).filter(Boolean));

  return tokens.every((token) => sourceTokens.has(token));
};

const getPartialMentionMatches = (mention: string, members: AssignableMember[]) => {
  const evidence = normalizeAssigneeEvidence(mention);
  const evidenceTokens = evidence.split(/\s+/).filter(Boolean);
  const canUsePhraseMatch = evidenceTokens.length >= 2;

  if (!evidence) {
    return [];
  }

  return members.filter((member) => {
    const normalizedName = normalizeAssigneeEvidence(member.userName);
    const normalizedEmail = normalizeAssigneeEvidence(member.userEmail);
    const normalizedEmailLocalPart = normalizeAssigneeEvidence(member.userEmail?.split("@")[0]);
    const nameParts = normalizedName.split(/\s+/).filter(Boolean);

    return (
      (canUsePhraseMatch && normalizedName.includes(evidence)) ||
      (canUsePhraseMatch && Boolean(normalizedEmail && normalizedEmail.includes(evidence))) ||
      (canUsePhraseMatch && Boolean(normalizedEmailLocalPart && normalizedEmailLocalPart.includes(evidence))) ||
      (canUsePhraseMatch && includesAllMentionTokens(normalizedName, evidenceTokens)) ||
      (canUsePhraseMatch && includesAllMentionTokens(normalizedEmailLocalPart, evidenceTokens)) ||
      normalizedEmailLocalPart === evidence ||
      nameParts.some((part) => part === evidence)
    );
  });
};

const resolveExplicitAssigneeMentions = (
  draftSourceText: string,
  members: AssignableMember[],
) => {
  const candidates: AssigneeCandidate[] = [];
  const assigneeBoardMemberIds: string[] = [];
  const warnings: string[] = [];
  const resolvedMentionTokens = new Set<string>();
  const seen = new Set<string>();

  if (hasGroupAssignmentIntent(draftSourceText)) {
    return {
      candidates,
      assigneeBoardMemberIds: members.map((member) => member.id),
      warnings,
      resolvedMentionTokens,
    };
  }

  for (const mention of extractExplicitAssigneeMentions(draftSourceText)) {
    const exactMatches = getExactMentionMatches(mention, members);
    const matches = exactMatches.length > 0
      ? exactMatches
      : getPartialMentionMatches(mention, members);

    if (matches.length === 1) {
      const member = matches[0];

      for (const token of getCompareTokens(mention)) {
        resolvedMentionTokens.add(token);
      }

      if (!seen.has(member.id)) {
        seen.add(member.id);
        assigneeBoardMemberIds.push(member.id);
        candidates.push({
          boardMemberId: member.id,
          evidence: mention,
        });
      }

      continue;
    }

    if (matches.length > 1) {
      warnings.push(
        `"${mention}" khớp nhiều thành viên: ${matches
          .map((member) => member.userName)
          .join(", ")}. Vui lòng chọn thủ công.`,
      );
      continue;
    }

    warnings.push(`Không tìm thấy thành viên "${mention}" trong bảng.`);
  }

  return {
    candidates,
    assigneeBoardMemberIds,
    warnings: Array.from(new Set(warnings)),
    resolvedMentionTokens,
  };
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
    const canUseTokenSetNameMatch = evidenceTokens.length >= 2;
    const tokenSetNameMatches =
      canUseTokenSetNameMatch && includesAllMentionTokens(normalizedName, evidenceTokens);
    const fullNameMatches =
      normalizedName === evidence ||
      (normalizedName.length >= 3 && evidence.includes(normalizedName)) ||
      tokenSetNameMatches;
    const emailMatches = Boolean(
      normalizedEmail &&
      (normalizedEmail === evidence || (canUsePartialNameMatch && normalizedEmail.includes(evidence))),
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
      const itemTokenSetNameMatches =
        canUseTokenSetNameMatch && includesAllMentionTokens(itemName, evidenceTokens);

      return (
        itemName === evidence ||
        (canUsePartialNameMatch && itemName.includes(evidence)) ||
        itemTokenSetNameMatches ||
        Boolean(itemEmail && (itemEmail === evidence || (canUsePartialNameMatch && itemEmail.includes(evidence)))) ||
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

const AiSmartCaptureCard = z.object({
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  checklistItems: z.preprocess(
    (value) => value ?? [],
    z.array(z.string()).default([]),
  ),
  dueDateIso: z.string().optional().nullable(),
  assigneeBoardMemberId: z.string().optional().nullable(),
  assigneeBoardMemberIds: z.preprocess(
    (value) => value ?? [],
    z.array(z.string()).default([]),
  ),
  assignees: z.preprocess(
    (value) => value ?? [],
    z.array(
      z.object({
        boardMemberId: z.string(),
        evidence: z.string().optional().nullable(),
      }),
    ).default([]),
  ),
  labelIds: z.preprocess(
    (value) => value ?? [],
    z.array(z.string()).default([]),
  ),
  listId: z.string().optional().nullable(),
  sourceExcerpt: z.string().optional().nullable(),
  splitReason: z.string().optional().nullable(),
});

type AiSmartCaptureCard = z.infer<typeof AiSmartCaptureCard>;

const AiSmartCaptureResponse = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const payload = value as Record<string, unknown>;

  if (Array.isArray(payload.cards)) {
    return payload;
  }

  if (
    "title" in payload ||
    "description" in payload ||
    "checklistItems" in payload
  ) {
    return {
      ...payload,
      splitSummary: payload.reason ?? null,
      cards: [payload],
    };
  }

  return payload;
}, z.object({
  isActionable: z.boolean().optional().default(true),
  reason: z.string().optional().nullable(),
  splitSummary: z.string().optional().nullable(),
  cards: z.array(AiSmartCaptureCard).optional().default([]),
}));

type AiSmartCaptureResponse = z.infer<typeof AiSmartCaptureResponse>;

const getFallbackCardTitle = (source: string, index: number) => {
  const firstLine = source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(trimWhitespace)
    .find(Boolean);

  const title = trimWhitespace(firstLine)
    .replace(/^\d+[\).]\s*/, "")
    .replace(/\s*\([^)]{1,120}\)\s*:?\s*$/u, "")
    .replace(/:\s*$/, "")
    .slice(0, TITLE_MAX_LENGTH);

  return title || `Thẻ ${index + 1} từ Smart Capture`;
};

const createFallbackSmartCaptureResponse = (rawText: string): AiSmartCaptureResponse => {
  const sections = splitRawTextIntoTaskSections(rawText);
  const sourceSections = (sections.length > 0 ? sections : [rawText])
    .slice(0, SMART_CAPTURE_MAX_DRAFTS);

  return {
    isActionable: true,
    reason: "Fallback từ nội dung nguồn vì AI không trả JSON hợp lệ.",
    splitSummary: sections.length > 1
      ? `Hệ thống tự tách ${sourceSections.length} mục đánh số từ nội dung nguồn.`
      : "Hệ thống giữ nội dung trong một thẻ từ nội dung nguồn.",
    cards: sourceSections.map((section, index) => ({
      title: getFallbackCardTitle(section, index),
      description: null,
      checklistItems: extractChecklistItemsFromSource(section),
      dueDateIso: null,
      assigneeBoardMemberId: null,
      assigneeBoardMemberIds: [],
      assignees: [],
      labelIds: [],
      listId: null,
      sourceExcerpt: section,
      splitReason: sections.length > 1
        ? "Mục đánh số riêng trong nội dung nguồn."
        : "Nội dung nguồn được giữ thành một thẻ.",
    })),
  };
};

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

const multiCardSystemPrompt = [
  "Bạn là trợ lý quản lý dự án cho HustFlow.",
  "Chỉ trả JSON hợp lệ, không markdown wrapper, không giải thích ngoài JSON.",
  'Định dạng bắt buộc: {"isActionable":true,"reason":null,"splitSummary":"...","cards":[{"title":"...","description":"...","checklistItems":["..."],"dueDateIso":null,"assignees":[{"boardMemberId":"...","evidence":"..."}],"labelIds":[],"listId":null,"sourceExcerpt":"...","splitReason":"..."}]}.',
  "Nếu rawText không mô tả công việc cụ thể, không có mục tiêu/hành động có thể tạo thẻ, hoặc chỉ là lời chào/test/noise, trả isActionable=false, reason ngắn, splitSummary rỗng, cards=[].",
  `Trả tối đa ${SMART_CAPTURE_MAX_DRAFTS} cards. Nếu có hơn ${SMART_CAPTURE_MAX_DRAFTS} công việc độc lập, chọn ${SMART_CAPTURE_MAX_DRAFTS} công việc rõ/quan trọng nhất và ghi phần còn lại trong splitSummary.`,
  "Quyết định tách thẻ là phần quan trọng nhất: chỉ tách thành nhiều card khi các việc có deliverable/mục tiêu độc lập, owner riêng, deadline riêng, trạng thái/list riêng, hoặc là action item độc lập trong biên bản họp.",
  "Không tách nhiều card khi các ý chỉ là bước thực hiện, tiêu chí nghiệm thu, checklist con, hoặc chuỗi việc phụ thuộc chặt vào cùng một kết quả. Khi đó trả một card và đưa các ý con vào checklistItems.",
  "splitSummary phải nói ngắn gọn vì sao giữ một thẻ hoặc tách thành nhiều thẻ.",
  "Mỗi card phải có sourceExcerpt là đoạn nguồn ngắn liên quan và splitReason là lý do tạo riêng card đó hoặc lý do giữ các ý trong cùng card.",
  "Chỉ dùng id có trong boardContext. Không tự tạo list, label hoặc member mới.",
  "Chỉ chọn assignee từ boardContext.assignableMembers. Không chọn viewer/guest hoặc member không có trong assignableMembers.",
  "Nếu nội dung nhắc nhiều người phụ trách trong cùng một card, trả tất cả người phù hợp trong assignees.",
  "Chỉ trả nhiều assignee cho cả nhóm khi rawText có cụm rõ như mọi người, cả nhóm, toàn team, all members hoặc all team.",
  "Mỗi assignee phải có evidence là đoạn text gốc khiến bạn match người đó, ví dụ full name, email, username hoặc tên được nhắc.",
  "Nếu không chắc assignee, label hoặc list, trả mảng rỗng hoặc null cho field không áp dụng.",
  "Chỉ chọn label hoặc list khi rawText có tín hiệu rõ tương ứng với tên label/list hoặc ngữ cảnh rất trực tiếp.",
  "description phải là Markdown tiếng Việt, đúng 3 heading cấp 2 theo thứ tự: ## Mục tiêu, ## Phạm vi, ## Tiêu chí nghiệm thu.",
  "Dưới Tiêu chí nghiệm thu dùng checklist Markdown dạng '- [ ] ...'.",
  "checklistItems là các đầu việc con ngắn, không lặp với tiêu chí nghiệm thu nếu có thể.",
  "Với mỗi card, các dòng gạch đầu dòng hành động trong đoạn nguồn của card phải được đưa vào checklistItems nếu không chỉ là nhãn, deadline hoặc người phụ trách.",
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
      system: `${systemPrompt}\n\nCác dòng trên là guardrail kế thừa. Định dạng phản hồi bắt buộc cho lần gọi này là contract nhiều thẻ dưới đây:\n${multiCardSystemPrompt}`,
      user: JSON.stringify(payload),
      temperature: 0.2,
      maxTokens: 4_000,
    });
    let parsed: AiSmartCaptureResponse;

    try {
      parsed = parseAiJson(
        raw,
        AiSmartCaptureResponse,
        "AI chưa tạo được bản nháp thẻ hợp lệ. Hãy thử lại.",
      );
    } catch (error) {
      logger.warn("[ANALYZE_SMART_CAPTURE_PARSE_FALLBACK]", {
        action: "analyze-smart-capture",
        aiFeature: "smart-capture",
        orgId,
        userId,
        boardId,
        rawLength: raw.length,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      parsed = createFallbackSmartCaptureResponse(rawText);
    }

    if (!parsed.isActionable) {
      return { error: INSUFFICIENT_SMART_CAPTURE_CONTENT_ERROR };
    }

    const validListIds = new Set(lists.map((list) => list.id));
    const validMemberIds = new Set(assignableMembers.map((member) => member.id));
    const validLabelIds = new Set(labels.map((label) => label.id));
    const listsById = new Map(lists.map((list) => [list.id, list]));
    const labelsById = new Map(labels.map((label) => [label.id, label]));
    const fallbackCard: AiSmartCaptureCard = {
      title: rawText,
      description: null,
      checklistItems: [],
      dueDateIso: null,
      assigneeBoardMemberId: null,
      assigneeBoardMemberIds: [],
      assignees: [],
      labelIds: [],
      listId: null,
      sourceExcerpt: rawText,
      splitReason: parsed.reason ?? null,
    };
    const sourceCards = (parsed.cards.length > 0 ? parsed.cards : [fallbackCard])
      .slice(0, SMART_CAPTURE_MAX_DRAFTS);

    const drafts = sourceCards.map((card, index) => {
      const isFallbackCard = parsed.cards.length === 0 && sourceCards.length === 1;
      const draftSourceText = getDraftSourceText({
        card,
        rawText,
        isFallbackCard,
      });
      const explicitAssignees = resolveExplicitAssigneeMentions(
        draftSourceText,
        assignableMembers,
      );
      const title = trimWhitespace(card.title || rawText).slice(0, TITLE_MAX_LENGTH);
      const assigneeCandidates = [
        ...card.assignees,
        ...explicitAssignees.candidates,
      ].filter((candidate) => validMemberIds.has(candidate.boardMemberId));
      const {
        assigneeBoardMemberIds: resolvedAssigneeBoardMemberIds,
        assigneeWarnings: resolvedAssigneeWarnings,
      } = resolveAssignees({
        candidates: assigneeCandidates,
        members: assignableMembers,
        rawText: draftSourceText,
      });
      const assigneeBoardMemberIds = Array.from(new Set([
        ...explicitAssignees.assigneeBoardMemberIds,
        ...resolvedAssigneeBoardMemberIds,
      ]));
      const assigneeWarnings = Array.from(new Set([
        ...explicitAssignees.warnings,
        ...resolvedAssigneeWarnings,
        ...getAmbiguousMentionWarnings(
          draftSourceText,
          assignableMembers,
          explicitAssignees.resolvedMentionTokens,
        ),
      ]));
      const labelIdsFromAi = card.labelIds.filter((id) => {
        const label = labelsById.get(id);

        return validLabelIds.has(id) && hasBoardEntityTitleEvidence(draftSourceText, label?.title);
      });
      const labelIdsFromSource = labels
        .filter((label) => hasBoardEntityTitleEvidence(draftSourceText, label.title))
        .map((label) => label.id);
      const labelIds = Array.from(new Set([
        ...labelIdsFromAi,
        ...labelIdsFromSource,
        ...getPriorityLabelIdsFromSource(draftSourceText, labels),
      ]));
      const suggestedListId =
        card.listId &&
        validListIds.has(card.listId) &&
        hasBoardEntityTitleEvidence(draftSourceText, listsById.get(card.listId)?.title)
          ? card.listId
          : null;
      const sourceExcerpt = trimWhitespace(card.sourceExcerpt || draftSourceText)
        .slice(0, SOURCE_EXCERPT_MAX_LENGTH);
      const splitReason = trimWhitespace(
        card.splitReason ||
        (sourceCards.length === 1
          ? "AI giữ nội dung trong một thẻ vì các ý liên quan cùng một công việc."
          : `Đề xuất thẻ ${index + 1} từ một phần nội dung nguồn.`),
      ).slice(0, SPLIT_REASON_MAX_LENGTH);
      const checklistItems = normalizeChecklistItems([
        ...card.checklistItems,
        ...extractChecklistItemsFromSource(draftSourceText),
        ...extractInlineChecklistItems(draftSourceText),
      ]);
      const deterministicDueDate =
        getRelativeVietnameseDueDate(draftSourceText, localNowIso, timezoneLabel) ??
        extractFallbackDueDate(draftSourceText, localNowIso, timezoneLabel);

      return {
        title: title || "Thẻ mới từ Smart Capture",
        description: normalizeDescription(card.description, draftSourceText),
        checklistItems,
        dueDateIso:
          deterministicDueDate ?? parseDueDate(card.dueDateIso, timezoneLabel),
        assigneeBoardMemberIds,
        labelIds,
        listId: suggestedListId ?? lists[0].id,
        suggestedAssigneeBoardMemberIds: assigneeBoardMemberIds,
        assigneeWarnings,
        suggestedLabelIds: labelIds,
        sourceExcerpt,
        splitReason,
      };
    });

    if (drafts.length === 0) {
      return { error: INSUFFICIENT_SMART_CAPTURE_CONTENT_ERROR };
    }

    const splitSummary = trimWhitespace(
      parsed.splitSummary ||
      parsed.reason ||
      (drafts.length === 1
        ? "AI giữ nội dung trong một thẻ vì các ý phù hợp làm checklist của cùng một công việc."
        : `AI tách nội dung thành ${drafts.length} thẻ độc lập.`),
    ).slice(0, SPLIT_SUMMARY_MAX_LENGTH);

    return {
      data: {
        drafts,
        splitSummary,
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
