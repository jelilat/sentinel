import fs from "fs";
import path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { AgentConfig, AgentsFile } from "./types";

/**
 * Resolve the absolute path to agents.yaml.
 */
export function resolveAgentsPath(configPath?: string): string {
  const resolved = configPath ?? process.env.AGENTS_CONFIG_PATH ?? "agents.yaml";
  return path.isAbsolute(resolved)
    ? resolved
    : path.resolve(process.cwd(), resolved);
}

/**
 * Check whether agents.yaml exists on disk.
 */
export function agentsFileExists(configPath?: string): boolean {
  return fs.existsSync(resolveAgentsPath(configPath));
}

/**
 * Read and parse agents.yaml. Throws if the file doesn't exist or is invalid.
 */
export function readAgentsFile(configPath?: string): AgentsFile {
  const absolute = resolveAgentsPath(configPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Agents file not found: ${absolute}`);
  }
  const raw = fs.readFileSync(absolute, "utf-8");
  const parsed = parseYaml(raw) as AgentsFile;
  if (!parsed?.agents || typeof parsed.agents !== "object") {
    throw new Error("agents.yaml must have a top-level 'agents' map");
  }
  return parsed;
}

/**
 * Write an AgentsFile to disk. Uses lineWidth: 0 to avoid wrapping long tokens.
 */
export function writeAgentsFile(data: AgentsFile, configPath?: string): void {
  const absolute = resolveAgentsPath(configPath);
  const content = stringifyYaml(data, { lineWidth: 0 });
  fs.writeFileSync(absolute, content, "utf-8");
}

/**
 * Add an agent to agents.yaml. Creates the file if it doesn't exist.
 * Throws on duplicate agent name or duplicate token.
 */
export function addAgent(
  name: string,
  config: AgentConfig,
  configPath?: string
): void {
  let data: AgentsFile;

  if (agentsFileExists(configPath)) {
    data = readAgentsFile(configPath);
  } else {
    data = { agents: {} };
  }

  if (data.agents[name]) {
    throw new Error(`Agent "${name}" already exists`);
  }

  // Check for duplicate token across all existing agents
  for (const [existingName, existingAgent] of Object.entries(data.agents)) {
    if (existingAgent.token === config.token) {
      throw new Error(
        `Token collision: agent "${existingName}" already uses this token`
      );
    }
  }

  data.agents[name] = config;
  writeAgentsFile(data, configPath);
}

/**
 * Update an existing agent in agents.yaml. Only provided fields are changed.
 * Throws if the agent doesn't exist or if a new token collides with another agent.
 */
export function updateAgent(
  name: string,
  updates: Partial<Omit<AgentConfig, "token">> & { token?: string },
  configPath?: string
): void {
  const data = readAgentsFile(configPath);

  if (!data.agents[name]) {
    throw new Error(`Agent "${name}" not found`);
  }

  const agent = data.agents[name];

  if (updates.token !== undefined) {
    // Check for duplicate token across other agents
    for (const [existingName, existingAgent] of Object.entries(data.agents)) {
      if (existingName !== name && existingAgent.token === updates.token) {
        throw new Error(
          `Token collision: agent "${existingName}" already uses this token`
        );
      }
    }
    agent.token = updates.token;
  }

  if (updates.allowed_services !== undefined) {
    agent.allowed_services = updates.allowed_services;
  }

  if (updates.rate_limit_per_minute !== undefined) {
    agent.rate_limit_per_minute = updates.rate_limit_per_minute;
  }

  if (updates.allowed_ips !== undefined) {
    agent.allowed_ips = updates.allowed_ips;
  }

  data.agents[name] = agent;
  writeAgentsFile(data, configPath);
}

/**
 * Remove an agent from agents.yaml. Throws if the agent doesn't exist.
 */
export function removeAgent(name: string, configPath?: string): void {
  const data = readAgentsFile(configPath);

  if (!data.agents[name]) {
    throw new Error(`Agent "${name}" not found`);
  }

  delete data.agents[name];
  writeAgentsFile(data, configPath);
}

/**
 * List all agents. Returns an empty object if the file doesn't exist.
 */
export function listAgents(
  configPath?: string
): Record<string, AgentConfig> {
  if (!agentsFileExists(configPath)) {
    return {};
  }
  const data = readAgentsFile(configPath);
  return data.agents;
}
