import { Router, type IRouter, type Request, type Response } from "express";
import { getBalance, getCreditHistory, grantCredits, CREDIT_COSTS } from "../lib/credits";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: Function): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

router.get("/credits/balance", requireAuth, async (req: Request, res: Response) => {
  try {
    const balance = await getBalance(req.user!.id);
    res.json({
      ...balance,
      costs: CREDIT_COSTS,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get balance";
    console.error("Failed to get credit balance:", message);
    res.status(500).json({ error: message });
  }
});

router.get("/credits/history", requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 100);
    const history = await getCreditHistory(req.user!.id, limit);
    res.json({ history });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get history";
    console.error("Failed to get credit history:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
