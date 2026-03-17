import app from "./app";
import { recoverOrphanedProjects } from "./lib/recovery";
import { cleanupStaleSandboxes } from "./lib/sandbox";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const SANDBOX_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  recoverOrphanedProjects().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Recovery failed:", message);
  });

  setInterval(() => {
    cleanupStaleSandboxes(72).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Sandbox cleanup failed:", message);
    });
  }, SANDBOX_CLEANUP_INTERVAL_MS);
});
