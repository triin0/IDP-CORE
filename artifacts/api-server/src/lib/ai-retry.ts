import { openai } from "@workspace/integrations-openai-ai-server";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

export async function callWithRetry(
  params: ChatCompletionCreateParamsNonStreaming,
  label: string,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[${label}] Attempt ${attempt}/${MAX_RETRIES}...`);

      const response = await openai.chat.completions.create(params);

      const choice = response.choices[0];
      if (!choice) {
        throw new Error("AI returned no choices");
      }

      const finishReason = choice.finish_reason;
      const content = choice.message?.content;

      console.log(`[${label}] Attempt ${attempt} finish_reason=${finishReason}, content_length=${content?.length ?? 0}`);

      if (!content || content.length === 0) {
        throw new Error(`AI returned empty content (finish_reason=${finishReason})`);
      }

      if (finishReason === "length") {
        console.warn(`[${label}] Response may be truncated (finish_reason=length). Attempting to use partial content.`);
      }

      return content;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[${label}] Attempt ${attempt} failed:`, lastError.message);

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[${label}] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("All retry attempts failed");
}
