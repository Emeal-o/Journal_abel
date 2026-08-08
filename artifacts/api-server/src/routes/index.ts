import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import adminRouter from "./admin.js";
import weeksRouter from "./weeks.js";
import tradesRouter from "./trades.js";
import statsRouter from "./stats.js";
import setupTypesRouter from "./setup-types.js";
import appSettingsRouter from "./app-settings.js";
import profileRouter from "./profile.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(weeksRouter);
router.use(tradesRouter);
router.use(statsRouter);
router.use(setupTypesRouter);
router.use(appSettingsRouter);
router.use(profileRouter);

export default router;
