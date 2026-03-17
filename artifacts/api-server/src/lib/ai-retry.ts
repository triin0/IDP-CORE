import { openai } from "@workspace/integrations-openai-ai-server";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";

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
const MAX_CONTINUATIONS = 4;

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
      maxOutputTokens: params.max_completion_tokens ?? 65536,
      temperature: 0.2,
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

async function callGeminiMultiturn(
  history: Content[],
  maxOutputTokens: number,
): Promise<{ content: string; finishReason: string }> {
  const gemini = getGeminiClient();

  const model = gemini.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: {
      maxOutputTokens,
      temperature: 0.2,
      responseMimeType: "text/plain",
    },
  });

  const chat = model.startChat({ history: history.slice(0, -1) });
  const lastMsg = history[history.length - 1];
  const lastText = lastMsg?.parts?.[0] && "text" in lastMsg.parts[0] ? lastMsg.parts[0].text ?? "" : "";

  const result = await chat.sendMessage(lastText || "Continue.");
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

async function callOpenAIMultiturn(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  model: string,
  maxTokens?: number,
): Promise<{ content: string; finishReason: string }> {
  const response = await openai.chat.completions.create({
    model,
    max_completion_tokens: maxTokens,
    messages,
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

const CONTINUE_INSTRUCTION =
  "Your previous response was cut off due to output length limits. " +
  "Continue generating from the EXACT character where you stopped. " +
  "Do NOT repeat any content already generated. Do NOT add markdown fences, introductory text, or explanations. " +
  "Output ONLY the raw continuation of the JSON string.";

async function continueGemini(
  params: ChatCompletionParams,
  partialOutput: string,
  label: string,
): Promise<string> {
  const maxTokens = params.max_completion_tokens ?? 65536;
  let fullResponse = partialOutput;

  const systemPrompt = String(params.messages.find((m) => m.role === "system")?.content ?? "");
  const userPrompt = String(params.messages.find((m) => m.role === "user")?.content ?? "");

  const history: Content[] = [
    {
      role: "user",
      parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
    },
    {
      role: "model",
      parts: [{ text: partialOutput }],
    },
    {
      role: "user",
      parts: [{ text: CONTINUE_INSTRUCTION }],
    },
  ];

  for (let cont = 1; cont <= MAX_CONTINUATIONS; cont++) {
    console.log(
      `[${label}] Continuation ${cont}/${MAX_CONTINUATIONS}, accumulated_length=${fullResponse.length}`,
    );

    const { content, finishReason } = await callGeminiMultiturn(history, maxTokens);

    if (!content || content.length === 0) {
      console.warn(`[${label}] Continuation ${cont} returned empty content`);
      break;
    }

    fullResponse += content;

    if (finishReason !== "MAX_TOKENS" && finishReason !== "length") {
      console.log(`[${label}] Continuation complete (finish_reason=${finishReason}), total_length=${fullResponse.length}`);
      return fullResponse;
    }

    history.splice(1, history.length - 1);
    history.push({ role: "model", parts: [{ text: fullResponse }] });
    history.push({ role: "user", parts: [{ text: CONTINUE_INSTRUCTION }] });
  }

  return fullResponse;
}

async function continueOpenAI(
  params: ChatCompletionParams,
  partialOutput: string,
  label: string,
): Promise<string> {
  let fullResponse = partialOutput;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = params.messages.map(m => ({
    role: m.role as "system" | "user" | "assistant",
    content: String(m.content),
  }));

  messages.push({ role: "assistant", content: partialOutput });
  messages.push({ role: "user", content: CONTINUE_INSTRUCTION });

  for (let cont = 1; cont <= MAX_CONTINUATIONS; cont++) {
    console.log(
      `[${label}] Continuation ${cont}/${MAX_CONTINUATIONS}, accumulated_length=${fullResponse.length}`,
    );

    const { content, finishReason } = await callOpenAIMultiturn(
      messages,
      params.model,
      params.max_completion_tokens,
    );

    if (!content || content.length === 0) {
      console.warn(`[${label}] Continuation ${cont} returned empty content`);
      break;
    }

    fullResponse += content;

    if (finishReason !== "length") {
      console.log(`[${label}] Continuation complete (finish_reason=${finishReason}), total_length=${fullResponse.length}`);
      return fullResponse;
    }

    const baseLen = params.messages.length;
    messages.splice(baseLen, messages.length - baseLen);
    messages.push({ role: "assistant", content: fullResponse });
    messages.push({ role: "user", content: CONTINUE_INSTRUCTION });
  }

  return fullResponse;
}

function isLikelyTruncated(finishReason: string): boolean {
  return finishReason === "length" || finishReason === "MAX_TOKENS";
}

export async function callWithRetry(
  params: ChatCompletionParams,
  label: string,
): Promise<string> {
  const provider = getProvider();
  let lastError: Error | null = null;
  const currentParams = { ...params };

  if (!currentParams.max_completion_tokens) {
    currentParams.max_completion_tokens = provider === "gemini" ? 65536 : 16384;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `[${label}] Attempt ${attempt}/${MAX_RETRIES} (${provider}), max_tokens=${currentParams.max_completion_tokens}...`,
      );

      const { content, finishReason } =
        provider === "gemini"
          ? await callGemini(currentParams)
          : await callOpenAI(currentParams);

      console.log(
        `[${label}] Attempt ${attempt} finish_reason=${finishReason}, content_length=${content?.length ?? 0}`,
      );

      if (!content || content.length === 0) {
        throw new Error(
          `AI returned empty content (finish_reason=${finishReason})`,
        );
      }

      if (isLikelyTruncated(finishReason)) {
        console.warn(
          `[${label}] Token limit hit (finish_reason=${finishReason}). Starting continuation loop...`,
        );

        const fullContent =
          provider === "gemini"
            ? await continueGemini(currentParams, content, label)
            : await continueOpenAI(currentParams, content, label);

        const expectsJson = currentParams.response_format?.type === "json_object";

        if (expectsJson) {
          try {
            JSON.parse(fullContent);
            console.log(`[${label}] Continuation produced valid JSON, total_length=${fullContent.length}`);
            return fullContent;
          } catch {
            const truncatedPreview = fullContent.slice(-200);
            console.error(
              `[${label}] Continuation produced invalid JSON after ${MAX_CONTINUATIONS} continuations. ` +
              `Total length=${fullContent.length}. Tail: ...${truncatedPreview}`,
            );
            throw new Error(
              `TOKEN_EXHAUSTION: AI response was truncated and ${MAX_CONTINUATIONS} continuation attempts ` +
              `could not produce valid JSON (total_length=${fullContent.length}). ` +
              `Try simplifying the project requirements.`,
            );
          }
        }

        console.log(`[${label}] Continuation complete (non-JSON mode), total_length=${fullContent.length}`);
        return fullContent;
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
