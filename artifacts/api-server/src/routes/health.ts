import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const llmConfigured = Boolean(
    process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] &&
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"]
  );

  let llmReachable = false;

  if (llmConfigured) {
    try {
      const { openai } = await import("@workspace/integrations-openai-ai-server");

      const response = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-5-nano",
          max_completion_tokens: 4,
          messages: [{ role: "user", content: "hi" }],
        }),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("LLM probe timeout")), 15000)
        ),
      ]);

      llmReachable = response !== null && response.choices.length > 0;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("LLM health probe failed:", msg);
      llmReachable = false;
    }
  }

  const overallStatus = llmConfigured && llmReachable ? "ok" : llmConfigured ? "degraded" : "unhealthy";

  const data = HealthCheckResponse.parse({ status: overallStatus });

  res.json({
    ...data,
    llm: {
      configured: llmConfigured,
      reachable: llmReachable,
    },
  });
});

export default router;
