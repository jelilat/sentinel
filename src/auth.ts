import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that validates the x-agent-token header against AGENT_TOKEN env var.
 */
export function tokenAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.AGENT_TOKEN;
  if (!expected) {
    res.status(500).json({ error: "Server misconfigured: AGENT_TOKEN not set" });
    return;
  }

  const provided = req.headers["x-agent-token"];
  if (!provided || provided !== expected) {
    res.status(401).json({ error: "Unauthorized: invalid or missing x-agent-token" });
    return;
  }

  next();
}
