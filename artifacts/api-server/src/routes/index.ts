import { Router, type IRouter } from "express";
import healthRouter from "./health";
import weeksRouter from "./weeks";
import tradesRouter from "./trades";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(weeksRouter);
router.use(tradesRouter);
router.use(statsRouter);

export default router;
