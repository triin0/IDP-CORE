import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

let cachedLlmReachable: boolean | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

function getActiveProvider(): "gemini" | "openai" | "none" {
  if (process.env["GEMINI_API_KEY"]) return "gemini";
  if (
    process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] &&
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"]
  )
    return "openai";
  return "none";
}

router.get("/healthz", async (_req, res) => {
  const provider = getActiveProvider();
  const llmConfigured = provider !== "none";

  let llmReachable = false;

  if (llmConfigured) {
    const now = Date.now();
    if (cachedLlmReachable !== null && now - cacheTimestamp < CACHE_TTL_MS) {
      llmReachable = cachedLlmReachable;
    } else {
      try {
        if (provider === "gemini") {
          const { GoogleGenerativeAI } = await import(
            "@google/generative-ai"
          );
          const gemini = new GoogleGenerativeAI(
            process.env["GEMINI_API_KEY"]!,
          );
          const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
          const result = await Promise.race([
            model.generateContent("hi"),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error("LLM probe timeout")), 15000),
            ),
          ]);
          llmReachable = result !== null;
        } else {
          const { openai } = await import(
            "@workspace/integrations-openai-ai-server"
          );
          const response = await Promise.race([
            openai.chat.completions.create({
              model: "gpt-5-nano",
              max_completion_tokens: 4,
              messages: [{ role: "user", content: "hi" }],
            }),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error("LLM probe timeout")), 15000),
            ),
          ]);
          llmReachable = response !== null && response.choices.length > 0;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("LLM health probe failed:", msg);
        llmReachable = false;
      }

      cachedLlmReachable = llmReachable;
      cacheTimestamp = now;
    }
  }

  const overallStatus =
    llmConfigured && llmReachable
      ? "ok"
      : llmConfigured
        ? "degraded"
        : "unhealthy";

  const data = HealthCheckResponse.parse({ status: overallStatus });

  res.json({
    ...data,
    llm: {
      configured: llmConfigured,
      reachable: llmReachable,
      provider,
    },
  });
});

export default router;
