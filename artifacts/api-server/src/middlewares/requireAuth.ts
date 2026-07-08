import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that requires an authenticated session.
 * Responds with 401 if the request has no valid session cookie.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
}
