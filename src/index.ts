import express from "express";
import { loadConfig } from "./config";
import { tokenAuth } from "./auth";
import { createProxyHandler } from "./proxy";

function main(): void {
  // Validate AGENT_TOKEN is set
  if (!process.env.AGENT_TOKEN) {
    console.error("FATAL: AGENT_TOKEN environment variable is required");
    process.exit(1);
  }

  // Load service config
  let services;
  try {
    services = loadConfig();
  } catch (err) {
    console.error(
      "FATAL: Failed to load config:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }

  const serviceNames = Object.keys(services);
  console.log(`Loaded ${serviceNames.length} service(s): ${serviceNames.join(", ")}`);

  const app = express();

  // Parse JSON bodies with 1MB limit
  app.use(express.json({ limit: "1mb" }));

  // Health check (no auth required)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", services: serviceNames });
  });

  // Proxy endpoint — auth required
  app.post("/v1/proxy/:service", tokenAuth, createProxyHandler(services));

  const port = parseInt(process.env.PORT ?? "8080", 10);
  app.listen(port, () => {
    console.log(`Agent Gateway listening on port ${port}`);
  });
}

main();
