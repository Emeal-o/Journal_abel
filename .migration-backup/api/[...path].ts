/**
 * Vercel catch-all serverless function for /api/* routes.
 * Vercel routes any request to /api/<anything> here and passes the original
 * URL through to Express, which handles routing internally.
 */
import app from "../artifacts/api-server/src/app";

export default app;
