import { z } from "zod";

const stripCodeFence = (value: string) => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fenced ? fenced[1].trim() : trimmed;
};

const extractJsonObject = (value: string) => {
  const unfenced = stripCodeFence(value);
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return unfenced;
  }

  return unfenced.slice(start, end + 1);
};

export const parseAiJson = <T>(raw: string, schema: z.ZodType<T>) => {
  try {
    const parsed = JSON.parse(extractJsonObject(raw));
    return schema.parse(parsed);
  } catch (error) {
    console.error("[AI_JSON_PARSE_ERROR]", error, raw);
    throw new Error("AI chưa tạo được checklist hợp lệ. Hãy thử lại.");
  }
};
