import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import type { AgentConfig, AgentsFile, GlobalConfig, ResolvedAgent, ServiceConfig, ServicesFile } from "./types";

const REQUIRED_FIELDS: (keyof ServiceConfig)[] = [
  "base_url",
  "allowed_hosts",
  "auth",
  "secret_env",
];

export function validateService(name: string, svc: ServiceConfig): void {
  for (const field of REQUIRED_FIELDS) {
    if (svc[field] === undefined || svc[field] === null) {
      throw new Error(`Service "${name}" is missing required field "${field}"`);
    }
  }

  if (!svc.base_url.startsWith("https://")) {
    throw new Error(
      `Service "${name}": base_url must use https (got "${svc.base_url}")`
    );
  }

  if (!Array.isArray(svc.allowed_hosts) || svc.allowed_hosts.length === 0) {
    throw new Error(
      `Service "${name}": allowed_hosts must be a non-empty array`
    );
  }

  // Validate that base_url host is in allowed_hosts
  const baseHost = new URL(svc.base_url).hostname;
  if (!svc.allowed_hosts.includes(baseHost)) {
    throw new Error(
      `Service "${name}": base_url host "${baseHost}" must be in allowed_hosts`
    );
  }

  const { auth } = svc;
  if (auth.type === "header") {
    if (!auth.header_name || !auth.template) {
      throw new Error(
        `Service "${name}": header auth requires header_name and template`
      );
    }
  } else if (auth.type === "query") {
    if (!auth.query_param || !auth.template) {
      throw new Error(
        `Service "${name}": query auth requires query_param and template`
      );
    }
  } else {
    throw new Error(
      `Service "${name}": auth.type must be "header" or "query"`
    );
  }

  if (!auth.template.includes("${SECRET}")) {
    throw new Error(
      `Service "${name}": auth.template must contain \${SECRET} placeholder`
    );
  }

  if (svc.allowed_methods) {
    for (const m of svc.allowed_methods) {
      if (typeof m !== "string") {
        throw new Error(
          `Service "${name}": allowed_methods must be an array of strings`
        );
      }
    }
  }

  if (svc.allowed_path_prefixes) {
    for (const p of svc.allowed_path_prefixes) {
      if (typeof p !== "string" || !p.startsWith("/")) {
        throw new Error(
          `Service "${name}": allowed_path_prefixes entries must start with "/"`
        );
      }
    }
  }
}

function validateAllowlist(label: string, list: unknown): void {
  if (list === undefined || list === null) return;
  if (!Array.isArray(list)) {
    throw new Error(`${label} must be an array`);
  }
  for (const entry of list) {
    if (typeof entry !== "string") {
      throw new Error(`${label} entries must be strings`);
    }
  }
}

export function loadConfig(
  configPath?: string
): { services: Record<string, ServiceConfig>; global: GlobalConfig } {
  const resolved = configPath
    ?? process.env.SERVICES_CONFIG_PATH
    ?? "services.yaml";

  const absolute = path.isAbsolute(resolved)
    ? resolved
    : path.resolve(process.cwd(), resolved);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Config file not found: ${absolute}`);
  }

  const raw = fs.readFileSync(absolute, "utf-8");
  const parsed = parseYaml(raw) as ServicesFile;

  if (!parsed?.services || typeof parsed.services !== "object") {
    throw new Error("Config must have a top-level 'services' map");
  }

  // Validate global allowlists
  validateAllowlist("Global allowed_ips", parsed.allowed_ips);
  validateAllowlist("Global allowed_origins", parsed.allowed_origins);

  for (const [name, svc] of Object.entries(parsed.services)) {
    validateService(name, svc);
    validateAllowlist(`Service "${name}" allowed_ips`, svc.allowed_ips);
    validateAllowlist(`Service "${name}" allowed_origins`, svc.allowed_origins);
  }

  const globalConfig: GlobalConfig = {
    allowed_ips: parsed.allowed_ips,
    allowed_origins: parsed.allowed_origins,
  };

  return { services: parsed.services, global: globalConfig };
}

/**
 * Load and validate agents.yaml.
 * Returns null if the file doesn't exist (triggers legacy mode).
 * Throws on validation errors.
 */
export function loadAgents(
  configPath?: string
): Record<string, AgentConfig> | null {
  const resolved = configPath
    ?? process.env.AGENTS_CONFIG_PATH
    ?? "agents.yaml";

  const absolute = path.isAbsolute(resolved)
    ? resolved
    : path.resolve(process.cwd(), resolved);

  if (!fs.existsSync(absolute)) {
    return null;
  }

  const raw = fs.readFileSync(absolute, "utf-8");
  const parsed = parseYaml(raw) as AgentsFile;

  if (!parsed?.agents || typeof parsed.agents !== "object") {
    throw new Error("agents.yaml must have a top-level 'agents' map");
  }

  for (const [name, agent] of Object.entries(parsed.agents)) {
    if (!agent.token || typeof agent.token !== "string") {
      throw new Error(`Agent "${name}": missing or invalid token`);
    }
    if (!agent.token.startsWith("agt_")) {
      throw new Error(`Agent "${name}": token must start with "agt_"`);
    }
    if (!Array.isArray(agent.allowed_services) || agent.allowed_services.length === 0) {
      throw new Error(`Agent "${name}": allowed_services must be a non-empty array`);
    }
    for (const svc of agent.allowed_services) {
      if (typeof svc !== "string") {
        throw new Error(`Agent "${name}": allowed_services entries must be strings`);
      }
    }
    if (agent.rate_limit_per_minute !== undefined) {
      if (typeof agent.rate_limit_per_minute !== "number" || agent.rate_limit_per_minute <= 0) {
        throw new Error(`Agent "${name}": rate_limit_per_minute must be a positive number`);
      }
    }
    validateAllowlist(`Agent "${name}" allowed_ips`, agent.allowed_ips);
  }

  return parsed.agents;
}

/**
 * Build a lookup map from token → ResolvedAgent.
 * Throws if duplicate tokens are found.
 */
export function buildAgentTokenMap(
  agents: Record<string, AgentConfig>
): Map<string, ResolvedAgent> {
  const map = new Map<string, ResolvedAgent>();

  for (const [name, config] of Object.entries(agents)) {
    if (map.has(config.token)) {
      const existing = map.get(config.token)!;
      throw new Error(
        `Duplicate agent token: agents "${existing.name}" and "${name}" share the same token`
      );
    }
    map.set(config.token, { name, config });
  }

  return map;
}
