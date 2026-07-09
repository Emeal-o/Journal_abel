import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that requires an authenticated admin session.
 * Independent from `requireAuth` — a browser can be logged in as a regular
 * journal user, as an admin, both, or neither, all on the same session
 * cookie (see types/session.d.ts).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.isAdmin) {
    res.status(401).json({ error: "Admin authentication required." });
    return;
  }
  next();
}
