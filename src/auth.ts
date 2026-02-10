import type { Request, Response, NextFunction } from "express";
import type { ResolvedAgent } from "./types";

/**
 * Create token auth middleware.
 *
 * - If agentsByToken is provided (agents.yaml mode): look up token in map,
 *   attach res.locals.agent = ResolvedAgent.
 * - If agentsByToken is null (legacy mode): validate against AGENT_TOKEN env var,
 *   set res.locals.agent = undefined.
 */
export function createTokenAuth(agentsByToken: Map<string, ResolvedAgent> | null) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const provided = req.headers["x-agent-token"];
    if (!provided || typeof provided !== "string") {
      res.status(401).json({ error: "Unauthorized: missing x-agent-token" });
      return;
    }

    if (agentsByToken) {
      // Per-agent token mode
      const agent = agentsByToken.get(provided);
      if (!agent) {
        res.status(401).json({ error: "Unauthorized: invalid agent token" });
        return;
      }
      res.locals.agent = agent;
    } else {
      // Legacy mode: single AGENT_TOKEN env var
      const expected = process.env.AGENT_TOKEN;
      if (!expected) {
        res.status(500).json({ error: "Server misconfigured: AGENT_TOKEN not set" });
        return;
      }
      if (provided !== expected) {
        res.status(401).json({ error: "Unauthorized: invalid or missing x-agent-token" });
        return;
      }
      res.locals.agent = undefined;
    }

    next();
  };
}
