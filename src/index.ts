import express from "express";
import { loadConfig, loadAgents, buildAgentTokenMap } from "./config";
import { createTokenAuth } from "./auth";
import { createProxyHandler } from "./proxy";
import type { ResolvedAgent } from "./types";

export function main(): void {
  // Load service config
  let services;
  let globalConfig;
  try {
    const config = loadConfig();
    services = config.services;
    globalConfig = config.global;
  } catch (err) {
    console.error(
      "FATAL: Failed to load config:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }

  const serviceNames = Object.keys(services);
  console.log(`Loaded ${serviceNames.length} service(s): ${serviceNames.join(", ")}`);

  // Load agents config (null = legacy mode)
  let agentsByToken: Map<string, ResolvedAgent> | null = null;
  try {
    const agents = loadAgents();
    if (agents) {
      // Cross-validate: every allowed_service must exist in services config
      for (const [name, agent] of Object.entries(agents)) {
        for (const svc of agent.allowed_services) {
          if (!services[svc]) {
            throw new Error(
              `Agent "${name}" references unknown service "${svc}". Available: ${serviceNames.join(", ")}`
            );
          }
        }
      }

      agentsByToken = buildAgentTokenMap(agents);
      console.log(`Auth mode: per-agent tokens (${agentsByToken.size} agent(s))`);
    } else {
      // Legacy mode: require AGENT_TOKEN
      if (!process.env.AGENT_TOKEN) {
        console.error("FATAL: AGENT_TOKEN environment variable is required (no agents.yaml found)");
        process.exit(1);
      }
      console.log("Auth mode: legacy (single AGENT_TOKEN)");
    }
  } catch (err) {
    console.error(
      "FATAL: Failed to load agents config:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }

  const app = express();

  // Trust proxy so req.ip reflects X-Forwarded-For when behind a reverse proxy
  app.set("trust proxy", true);

  // Parse JSON bodies with 1MB limit
  app.use(express.json({ limit: "1mb" }));

  // Health check (no auth required)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", services: serviceNames });
  });

  // Proxy endpoint — auth required
  const authMiddleware = createTokenAuth(agentsByToken);
  app.post("/v1/proxy/:service", authMiddleware, createProxyHandler(services, globalConfig));

  const port = parseInt(process.env.PORT ?? "8080", 10);
  app.listen(port, () => {
    console.log(`Sentinel listening on port ${port}`);
  });
}

// Auto-run when executed directly (node dist/index.js), but not when imported by CLI
if (require.main === module) {
  main();
}
