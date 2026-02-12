import crypto from "crypto";
import { Router } from "express";
import { createAdminAuth } from "./adminAuth";
import { listAgents, addAgent, updateAgent, removeAgent } from "./agentFile";
import { addService, updateService, removeService, listServices } from "./serviceFile";
import { validateService, loadConfig } from "./config";
import { generateToken, maskToken } from "./tokenGen";
import type { ServiceConfig } from "./types";

const startTime = Date.now();

export function createAdminRouter(): Router {
  const router = Router();
  const adminAuth = createAdminAuth();

  // POST /api/login — validate admin token (no auth middleware)
  router.post("/login", (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "Missing token in request body" });
      return;
    }

    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      res.status(500).json({ error: "Server misconfigured: ADMIN_TOKEN not set" });
      return;
    }

    const expected = Buffer.from(adminToken, "utf-8");
    const given = Buffer.from(token, "utf-8");

    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
      res.status(401).json({ error: "Invalid admin token" });
      return;
    }

    res.json({ ok: true });
  });

  // All routes below require admin auth
  router.use(adminAuth);

  // GET /api/agents — list agents with masked tokens
  router.get("/agents", (_req, res) => {
    try {
      const agents = listAgents();
      const result = Object.entries(agents).map(([name, agent]) => ({
        name,
        token: maskToken(agent.token),
        allowed_services: agent.allowed_services,
        rate_limit_per_minute: agent.rate_limit_per_minute,
        allowed_ips: agent.allowed_ips,
      }));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list agents" });
    }
  });

  // POST /api/agents — create agent
  router.post("/agents", (req, res) => {
    const { name, allowed_services, rate_limit_per_minute, allowed_ips } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Missing or invalid 'name'" });
      return;
    }

    if (!Array.isArray(allowed_services) || allowed_services.length === 0) {
      res.status(400).json({ error: "'allowed_services' must be a non-empty array" });
      return;
    }

    // Validate services against services.yaml
    let knownServices: string[];
    try {
      const { services } = loadConfig();
      knownServices = Object.keys(services);
    } catch {
      res.status(500).json({ error: "Could not load services configuration" });
      return;
    }

    for (const svc of allowed_services) {
      if (!knownServices.includes(svc)) {
        res.status(400).json({
          error: `Unknown service "${svc}". Available: ${knownServices.join(", ")}`,
        });
        return;
      }
    }

    const token = generateToken();
    const config: { token: string; allowed_services: string[]; rate_limit_per_minute?: number; allowed_ips?: string[] } = {
      token,
      allowed_services,
    };

    if (rate_limit_per_minute !== undefined) {
      const parsed = Number(rate_limit_per_minute);
      if (isNaN(parsed) || parsed <= 0) {
        res.status(400).json({ error: "'rate_limit_per_minute' must be a positive number" });
        return;
      }
      config.rate_limit_per_minute = parsed;
    }

    if (allowed_ips !== undefined) {
      if (!Array.isArray(allowed_ips)) {
        res.status(400).json({ error: "'allowed_ips' must be an array" });
        return;
      }
      config.allowed_ips = allowed_ips;
    }

    try {
      addAgent(name, config);
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : "Failed to add agent" });
      return;
    }

    res.status(201).json({
      name,
      token,
      allowed_services: config.allowed_services,
      rate_limit_per_minute: config.rate_limit_per_minute,
      allowed_ips: config.allowed_ips,
    });
  });

  // PATCH /api/agents/:name — update agent fields
  router.patch("/agents/:name", (req, res) => {
    const { name } = req.params;
    const { allowed_services, rate_limit_per_minute, allowed_ips } = req.body;

    const updates: Record<string, unknown> = {};

    if (allowed_services !== undefined) {
      if (!Array.isArray(allowed_services) || allowed_services.length === 0) {
        res.status(400).json({ error: "'allowed_services' must be a non-empty array" });
        return;
      }

      // Validate services
      let knownServices: string[];
      try {
        const { services } = loadConfig();
        knownServices = Object.keys(services);
      } catch {
        res.status(500).json({ error: "Could not load services configuration" });
        return;
      }

      for (const svc of allowed_services) {
        if (!knownServices.includes(svc)) {
          res.status(400).json({
            error: `Unknown service "${svc}". Available: ${knownServices.join(", ")}`,
          });
          return;
        }
      }
      updates.allowed_services = allowed_services;
    }

    if (rate_limit_per_minute !== undefined) {
      const parsed = Number(rate_limit_per_minute);
      if (isNaN(parsed) || parsed <= 0) {
        res.status(400).json({ error: "'rate_limit_per_minute' must be a positive number" });
        return;
      }
      updates.rate_limit_per_minute = parsed;
    }

    if (allowed_ips !== undefined) {
      if (!Array.isArray(allowed_ips)) {
        res.status(400).json({ error: "'allowed_ips' must be an array" });
        return;
      }
      updates.allowed_ips = allowed_ips;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No updates provided" });
      return;
    }

    try {
      updateAgent(name, updates as any);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : "Failed to update agent" });
      return;
    }

    res.json({ ok: true, name });
  });

  // DELETE /api/agents/:name — remove agent
  router.delete("/agents/:name", (req, res) => {
    const { name } = req.params;

    try {
      removeAgent(name);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : "Failed to remove agent" });
      return;
    }

    res.json({ ok: true, name });
  });

  // POST /api/agents/:name/rotate-token — generate new token
  router.post("/agents/:name/rotate-token", (req, res) => {
    const { name } = req.params;
    const newToken = generateToken();

    try {
      updateAgent(name, { token: newToken });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : "Failed to rotate token" });
      return;
    }

    res.json({ name, token: newToken });
  });

  // GET /api/services — list services (full config)
  router.get("/services", (_req, res) => {
    try {
      const services = listServices();
      const result = Object.entries(services).map(([name, svc]) => ({
        name,
        ...svc,
      }));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load services" });
    }
  });

  // POST /api/services — create service
  router.post("/services", (req, res) => {
    const { name, ...config } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Missing or invalid 'name'" });
      return;
    }

    try {
      validateService(name, config as ServiceConfig);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid service config" });
      return;
    }

    try {
      addService(name, config as ServiceConfig);
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : "Failed to add service" });
      return;
    }

    res.status(201).json({ name, ...config });
  });

  // PATCH /api/services/:name — update service fields
  router.patch("/services/:name", (req, res) => {
    const { name } = req.params;
    const updates = req.body as Partial<ServiceConfig>;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No updates provided" });
      return;
    }

    try {
      updateService(name, updates);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update service";
      const status = message.includes("not found") ? 404 : 400;
      res.status(status).json({ error: message });
      return;
    }

    res.json({ ok: true, name });
  });

  // DELETE /api/services/:name — remove service (blocked if agents reference it)
  router.delete("/services/:name", (req, res) => {
    const { name } = req.params;

    // Check if any agents reference this service
    const agents = listAgents();
    const dependentAgents = Object.entries(agents)
      .filter(([, agent]) => agent.allowed_services.includes(name))
      .map(([agentName]) => agentName);

    if (dependentAgents.length > 0) {
      res.status(409).json({
        error: `Cannot delete service "${name}": referenced by agents: ${dependentAgents.join(", ")}`,
        dependent_agents: dependentAgents,
      });
      return;
    }

    try {
      removeService(name);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : "Failed to remove service" });
      return;
    }

    res.json({ ok: true, name });
  });

  // GET /api/health — status info
  router.get("/health", (_req, res) => {
    try {
      const { services } = loadConfig();
      const agents = listAgents();
      res.json({
        status: "ok",
        services: Object.keys(services),
        agent_count: Object.keys(agents).length,
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to get health" });
    }
  });

  return router;
}
