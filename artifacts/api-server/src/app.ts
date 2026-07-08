import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { pool } from "@workspace/db";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// Trust the first proxy hop so secure cookies work behind Replit's / Vercel's HTTPS proxy
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: Request) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res: Response) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// CORS_ORIGIN is a comma-separated allowlist of exact frontend origins
// (e.g. "https://tradeops.vercel.app,https://tradeops-git-main.vercel.app").
// Required in production because cookies cannot be sent cross-origin with a
// wildcard ("*") origin — the browser only attaches credentials when the
// server echoes back the exact requesting origin.
const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production" && corsOrigins.length === 0) {
  throw new Error(
    "CORS_ORIGIN environment variable is required in production but was not provided. " +
      "Set it to the exact frontend origin(s), comma-separated, e.g. https://tradeops.vercel.app",
  );
}

app.use(
  cors({
    origin(origin, callback) {
      // Requests with no Origin header (curl, server-to-server, same-origin
      // navigation) are not subject to CORS and are always allowed through.
      if (!origin) return callback(null, true);

      // In development (Replit preview), allow any origin so the iframe
      // proxy and local tooling keep working without extra configuration.
      if (process.env.NODE_ENV !== "production") return callback(null, true);

      if (corsOrigins.includes(origin)) return callback(null, true);

      callback(new Error(`Origin "${origin}" is not allowed by CORS.`));
    },
    credentials: true, // required so the browser sends/accepts the session cookie
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required but was not provided.");
}

// Persistent session store backed by the existing PostgreSQL database.
//
// IMPORTANT: createTableIfMissing is intentionally NOT set. connect-pg-simple's
// auto-create feature reads a table.sql file from its own package directory at
// runtime, but esbuild bundles this server into a single file and does not carry
// that asset along — so auto-create throws ENOENT in the built server.
//
// The "sessions" table must therefore be provisioned manually (once) in any new
// environment/database before this server can create sessions:
//
//   CREATE TABLE IF NOT EXISTS sessions (
//     sid    VARCHAR NOT NULL COLLATE "default",
//     sess   JSON NOT NULL,
//     expire TIMESTAMP(6) NOT NULL,
//     CONSTRAINT sessions_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
//   );
//   CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);
//
// It already exists in the current database.
const PgStore = connectPgSimple(session);

app.use(
  session({
    store: new PgStore({
      pool,
      tableName: "sessions",
      // createTableIfMissing is intentionally omitted: esbuild cannot bundle
      // the table.sql file that connect-pg-simple reads at runtime.
      // The sessions table was created manually via psql on first deploy.
      pruneSessionInterval: 60 * 60,
    }),
    name: "sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,            // requires HTTPS — Replit and Vercel both proxy over HTTPS
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

app.use("/api", router);

export default app;
