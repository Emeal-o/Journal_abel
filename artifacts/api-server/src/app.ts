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

app.use(cors({
  origin: true,      // reflect the request origin (same-origin in practice)
  credentials: true, // allow cookies on cross-origin dev requests
}));

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
