import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import goldenPathRouter from "./golden-path";
import authRouter from "./auth";
import creditsRouter from "./credits";
import exportRouter from "./export";
import marketplaceRouter from "./marketplace";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(goldenPathRouter);
router.use(creditsRouter);
router.use(exportRouter);
router.use(marketplaceRouter);

export default router;
