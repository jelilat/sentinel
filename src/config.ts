import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import type { GlobalConfig, ServiceConfig, ServicesFile } from "./types";

const REQUIRED_FIELDS: (keyof ServiceConfig)[] = [
  "base_url",
  "allowed_hosts",
  "auth",
  "secret_env",
];

function validateService(name: string, svc: ServiceConfig): void {
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
