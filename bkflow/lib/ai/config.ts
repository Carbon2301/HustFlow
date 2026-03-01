export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

export const AI_REQUEST_TIMEOUT_MS = 25_000;

export const AI_CHECKLIST_LIMITS = {
  minItems: 3,
  maxItems: 8,
  titleMaxLength: 200,
  descriptionMaxLength: 2_000,
  nameMaxLength: 100,
  itemMaxLength: 120,
};
