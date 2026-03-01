import "server-only";

import { AI_MODEL, AI_REQUEST_TIMEOUT_MS } from "./config";

type GenerateAiTextInput = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
};

type ChatCompletionResponse = {
  choices?: {
    message?: {
      content?: string | null;
    };
  }[];
  error?: {
    message?: string;
  };
};

const getOpenAiApiKey = () => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Chưa cấu hình AI. Vui lòng thêm OPENAI_API_KEY.");
  }

  return apiKey;
};

export const generateAiText = async ({
  system,
  user,
  temperature = 0.3,
  maxTokens = 700,
}: GenerateAiTextInput) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAiApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "developer",
            content: system,
          },
          {
            role: "user",
            content: user,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as ChatCompletionResponse | null;

    if (!response.ok) {
      console.error("[OPENAI_CHAT_COMPLETION_ERROR]", payload);
      throw new Error("AI chưa phản hồi thành công. Vui lòng thử lại.");
    }

    const content = payload?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("AI chưa tạo được nội dung hợp lệ. Vui lòng thử lại.");
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI phản hồi quá lâu. Vui lòng thử lại.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Có lỗi xảy ra khi gọi AI. Vui lòng thử lại.");
  } finally {
    clearTimeout(timeout);
  }
};
