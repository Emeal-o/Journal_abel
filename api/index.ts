/**
 * Vercel serverless function entry point.
 * Re-exports the Express app so Vercel's Node runtime wraps it automatically.
 * All /api/* routes are rewritten here via vercel.json.
 */
import app from "../artifacts/api-server/src/app";

export default app;
