import { openai } from "@workspace/integrations-openai-ai-server";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface ChatMessage {
  role: string;
  content: string | unknown;
}

interface ChatCompletionParams {
  model: string;
  max_completion_tokens?: number;
  messages: ChatMessage[];
  response_format?: { type: string };
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

type AIProvider = "openai" | "gemini";

function getProvider(): AIProvider {
  if (process.env["GEMINI_API_KEY"]) {
    return "gemini";
  }
  return "openai";
}

function getGeminiClient(): GoogleGenerativeAI {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) {
    throw new Error("GEMINI_API_KEY not set");
  }
  return new GoogleGenerativeAI(key);
}

async function callGemini(
  params: ChatCompletionParams,
): Promise<{ content: string; finishReason: string }> {
  const gemini = getGeminiClient();

  const model = gemini.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: {
      maxOutputTokens: params.max_completion_tokens ?? 8192,
      responseMimeType: "application/json",
    },
  });

  const systemPrompt =
    params.messages.find((m) => m.role === "system")?.content ?? "";
  const userPrompt =
    params.messages.find((m) => m.role === "user")?.content ?? "";

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${String(systemPrompt)}\n\n${String(userPrompt)}`,
          },
        ],
      },
    ],
  });

  const response = result.response;
  const text = response.text();
  const finishReason = response.candidates?.[0]?.finishReason ?? "unknown";

  return { content: text, finishReason };
}

async function callOpenAI(
  params: ChatCompletionParams,
): Promise<{ content: string; finishReason: string }> {
  const response = await openai.chat.completions.create({
    model: params.model,
    max_completion_tokens: params.max_completion_tokens,
    messages: params.messages as Array<{ role: "system" | "user" | "assistant"; content: string }>,
    response_format: params.response_format as { type: "json_object" } | undefined,
  });
  const choice = response.choices[0];
  if (!choice) {
    throw new Error("AI returned no choices");
  }
  return {
    content: choice.message?.content ?? "",
    finishReason: choice.finish_reason ?? "unknown",
  };
}

export async function callWithRetry(
  params: ChatCompletionParams,
  label: string,
): Promise<string> {
  const provider = getProvider();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `[${label}] Attempt ${attempt}/${MAX_RETRIES} (${provider})...`,
      );

      const { content, finishReason } =
        provider === "gemini"
          ? await callGemini(params)
          : await callOpenAI(params);

      console.log(
        `[${label}] Attempt ${attempt} finish_reason=${finishReason}, content_length=${content?.length ?? 0}`,
      );

      if (!content || content.length === 0) {
        throw new Error(
          `AI returned empty content (finish_reason=${finishReason})`,
        );
      }

      if (finishReason === "length" || finishReason === "MAX_TOKENS") {
        console.warn(
          `[${label}] Response may be truncated (finish_reason=${finishReason}). Attempting to use partial content.`,
        );
      }

      return content;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[${label}] Attempt ${attempt} failed:`,
        lastError.message,
      );

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[${label}] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("All retry attempts failed");
}
