#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig } from "./config";
import { generateToken } from "./tokenGen";
import {
  agentsFileExists,
  addAgent,
  updateAgent,
  removeAgent,
  listAgents,
  writeAgentsFile,
} from "./agentFile";
import type { AgentConfig, AgentsFile } from "./types";

const program = new Command();

program
  .name("agent-gateway")
  .description("CLI for managing the Agent Gateway")
  .version("1.0.0");

// ── init ────────────────────────────────────────────────────────────────────

program
  .command("init")
  .description("Create agents.yaml with a default agent and auto-generated token")
  .action(() => {
    if (agentsFileExists()) {
      console.error("Error: agents.yaml already exists. Remove it first or use 'agent add'.");
      process.exit(1);
    }

    // Read services.yaml to auto-populate allowed_services
    let serviceNames: string[];
    try {
      const { services } = loadConfig();
      serviceNames = Object.keys(services);
    } catch {
      console.error("Error: Could not read services.yaml. Create it first.");
      process.exit(1);
    }

    if (serviceNames.length === 0) {
      console.error("Error: No services defined in services.yaml.");
      process.exit(1);
    }

    const token = generateToken();
    const data: AgentsFile = {
      agents: {
        "default-agent": {
          token,
          allowed_services: serviceNames,
        },
      },
    };

    writeAgentsFile(data);

    console.log("Created agents.yaml with default-agent.");
    console.log(`Services: ${serviceNames.join(", ")}`);
    console.log("");
    console.log("Token (shown once — save it now):");
    console.log(`  ${token}`);
  });

// ── agent ───────────────────────────────────────────────────────────────────

const agentCmd = program
  .command("agent")
  .description("Manage agents");

// ── agent add ───────────────────────────────────────────────────────────────

agentCmd
  .command("add <name>")
  .description("Add a new agent with an auto-generated token")
  .requiredOption("--services <services>", "Comma-separated list of service names")
  .option("--token <token>", "Custom token (must start with agt_). Auto-generated if omitted.")
  .option("--rate-limit <n>", "Per-agent rate limit (requests per minute)", parseInt)
  .option("--allowed-ips <ips>", "Comma-separated IP addresses or CIDR ranges")
  .action((name: string, opts: {
    services: string;
    token?: string;
    rateLimit?: number;
    allowedIps?: string;
  }) => {
    // Validate services against services.yaml
    let knownServices: string[];
    try {
      const { services } = loadConfig();
      knownServices = Object.keys(services);
    } catch {
      console.error("Error: Could not read services.yaml. Create it first.");
      process.exit(1);
    }

    const requestedServices = opts.services.split(",").map((s) => s.trim()).filter(Boolean);
    if (requestedServices.length === 0) {
      console.error("Error: --services must not be empty.");
      process.exit(1);
    }

    for (const svc of requestedServices) {
      if (!knownServices.includes(svc)) {
        console.error(
          `Error: Unknown service "${svc}". Available: ${knownServices.join(", ")}`
        );
        process.exit(1);
      }
    }

    // Resolve token
    let token: string;
    if (opts.token) {
      if (!opts.token.startsWith("agt_")) {
        console.error("Error: Custom token must start with 'agt_'.");
        process.exit(1);
      }
      token = opts.token;
    } else {
      token = generateToken();
    }

    const config: AgentConfig = {
      token,
      allowed_services: requestedServices,
    };

    if (opts.rateLimit !== undefined && !isNaN(opts.rateLimit)) {
      config.rate_limit_per_minute = opts.rateLimit;
    }

    if (opts.allowedIps) {
      config.allowed_ips = opts.allowedIps.split(",").map((s) => s.trim()).filter(Boolean);
    }

    try {
      addAgent(name, config);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }

    console.log(`Added agent "${name}".`);
    console.log(`Services: ${requestedServices.join(", ")}`);
    if (config.rate_limit_per_minute) {
      console.log(`Rate limit: ${config.rate_limit_per_minute} req/min`);
    }
    if (config.allowed_ips) {
      console.log(`Allowed IPs: ${config.allowed_ips.join(", ")}`);
    }
    console.log("");
    console.log("Token (shown once — save it now):");
    console.log(`  ${token}`);
  });

// ── agent update ────────────────────────────────────────────────────────────

agentCmd
  .command("update <name>")
  .description("Update an existing agent's configuration")
  .option("--services <services>", "Comma-separated list of service names")
  .option("--rotate-token", "Generate a new token for this agent")
  .option("--token <token>", "Set a specific token (must start with agt_)")
  .option("--rate-limit <n>", "Per-agent rate limit (requests per minute)", parseInt)
  .option("--allowed-ips <ips>", "Comma-separated IP addresses or CIDR ranges")
  .action((name: string, opts: {
    services?: string;
    rotateToken?: boolean;
    token?: string;
    rateLimit?: number;
    allowedIps?: string;
  }) => {
    if (opts.rotateToken && opts.token) {
      console.error("Error: Cannot use both --rotate-token and --token.");
      process.exit(1);
    }

    const updates: Partial<AgentConfig> = {};
    let newToken: string | undefined;

    // Validate and set services
    if (opts.services) {
      let knownServices: string[];
      try {
        const { services } = loadConfig();
        knownServices = Object.keys(services);
      } catch {
        console.error("Error: Could not read services.yaml. Create it first.");
        process.exit(1);
      }

      const requestedServices = opts.services.split(",").map((s) => s.trim()).filter(Boolean);
      if (requestedServices.length === 0) {
        console.error("Error: --services must not be empty.");
        process.exit(1);
      }

      for (const svc of requestedServices) {
        if (!knownServices.includes(svc)) {
          console.error(
            `Error: Unknown service "${svc}". Available: ${knownServices.join(", ")}`
          );
          process.exit(1);
        }
      }
      updates.allowed_services = requestedServices;
    }

    // Handle token rotation
    if (opts.rotateToken) {
      newToken = generateToken();
      updates.token = newToken;
    } else if (opts.token) {
      if (!opts.token.startsWith("agt_")) {
        console.error("Error: Custom token must start with 'agt_'.");
        process.exit(1);
      }
      newToken = opts.token;
      updates.token = newToken;
    }

    if (opts.rateLimit !== undefined && !isNaN(opts.rateLimit)) {
      updates.rate_limit_per_minute = opts.rateLimit;
    }

    if (opts.allowedIps) {
      updates.allowed_ips = opts.allowedIps.split(",").map((s) => s.trim()).filter(Boolean);
    }

    if (Object.keys(updates).length === 0) {
      console.error("Error: No updates specified. Use --services, --rotate-token, --token, --rate-limit, or --allowed-ips.");
      process.exit(1);
    }

    try {
      updateAgent(name, updates);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }

    console.log(`Updated agent "${name}".`);
    if (updates.allowed_services) {
      console.log(`Services: ${updates.allowed_services.join(", ")}`);
    }
    if (updates.rate_limit_per_minute) {
      console.log(`Rate limit: ${updates.rate_limit_per_minute} req/min`);
    }
    if (updates.allowed_ips) {
      console.log(`Allowed IPs: ${updates.allowed_ips.join(", ")}`);
    }
    if (newToken) {
      console.log("");
      console.log("New token (shown once — save it now):");
      console.log(`  ${newToken}`);
    }
  });

// ── agent list ──────────────────────────────────────────────────────────────

agentCmd
  .command("list")
  .description("List all agents with masked tokens")
  .action(() => {
    const agents = listAgents();
    const entries = Object.entries(agents);

    if (entries.length === 0) {
      console.log("No agents configured.");
      return;
    }

    // Mask token: show first 6 chars + "..." + last 4 chars
    function maskToken(token: string): string {
      if (token.length <= 14) return token.slice(0, 6) + "...";
      return token.slice(0, 8) + "..." + token.slice(-4);
    }

    // Build table rows
    const rows = entries.map(([name, agent]) => ({
      Name: name,
      Token: maskToken(agent.token),
      Services: agent.allowed_services.join(", "),
      "Rate Limit": agent.rate_limit_per_minute
        ? `${agent.rate_limit_per_minute}/min`
        : "—",
      "Allowed IPs": agent.allowed_ips
        ? agent.allowed_ips.join(", ")
        : "—",
    }));

    console.table(rows);
  });

// ── agent remove ────────────────────────────────────────────────────────────

agentCmd
  .command("remove <name>")
  .description("Remove an agent from agents.yaml")
  .action((name: string) => {
    try {
      removeAgent(name);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
    console.log(`Removed agent "${name}".`);
  });

// ── start ───────────────────────────────────────────────────────────────────

program
  .command("start")
  .description("Start the Agent Gateway server")
  .action(() => {
    // Dynamic require so agent-management commands don't load Express
    const { main } = require("./index");
    main();
  });

program.parse();
