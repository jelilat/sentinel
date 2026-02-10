import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Create admin auth middleware.
 * Validates Authorization: Bearer <token> against ADMIN_TOKEN env var
 * using constant-time comparison.
 */
export function createAdminAuth() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      res.status(500).json({ error: "Server misconfigured: ADMIN_TOKEN not set" });
      return;
    }

    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: missing or invalid Authorization header" });
      return;
    }

    const provided = header.slice(7);

    // Constant-time comparison to prevent timing attacks
    const expected = Buffer.from(adminToken, "utf-8");
    const given = Buffer.from(provided, "utf-8");

    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
      res.status(401).json({ error: "Unauthorized: invalid admin token" });
      return;
    }

    next();
  };
}
