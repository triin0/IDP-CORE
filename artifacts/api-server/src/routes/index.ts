import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import goldenPathRouter from "./golden-path";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(goldenPathRouter);

export default router;
