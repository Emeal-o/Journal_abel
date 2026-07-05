import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import weeksRouter from "./weeks.js";
import tradesRouter from "./trades.js";
import statsRouter from "./stats.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(weeksRouter);
router.use(tradesRouter);
router.use(statsRouter);

export default router;
