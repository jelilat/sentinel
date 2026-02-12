import fs from "fs";
import path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { ServiceConfig, ServicesFile } from "./types";
import { validateService } from "./config";

/**
 * Resolve the absolute path to services.yaml.
 */
export function resolveServicesPath(configPath?: string): string {
  const resolved = configPath ?? process.env.SERVICES_CONFIG_PATH ?? "services.yaml";
  return path.isAbsolute(resolved)
    ? resolved
    : path.resolve(process.cwd(), resolved);
}

/**
 * Check whether services.yaml exists on disk.
 */
export function servicesFileExists(configPath?: string): boolean {
  return fs.existsSync(resolveServicesPath(configPath));
}

/**
 * Read and parse services.yaml. Throws if the file doesn't exist or is invalid.
 */
export function readServicesFile(configPath?: string): ServicesFile {
  const absolute = resolveServicesPath(configPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Services file not found: ${absolute}`);
  }
  const raw = fs.readFileSync(absolute, "utf-8");
  const parsed = parseYaml(raw) as ServicesFile;
  if (!parsed?.services || typeof parsed.services !== "object") {
    throw new Error("services.yaml must have a top-level 'services' map");
  }
  return parsed;
}

/**
 * Write a ServicesFile to disk. Uses lineWidth: 0 to avoid wrapping long values.
 */
export function writeServicesFile(data: ServicesFile, configPath?: string): void {
  const absolute = resolveServicesPath(configPath);
  const content = stringifyYaml(data, { lineWidth: 0 });
  fs.writeFileSync(absolute, content, "utf-8");
}

/**
 * Add a service to services.yaml. Throws on duplicate name.
 */
export function addService(
  name: string,
  config: ServiceConfig,
  configPath?: string
): void {
  let data: ServicesFile;

  if (servicesFileExists(configPath)) {
    data = readServicesFile(configPath);
  } else {
    data = { services: {} };
  }

  if (data.services[name]) {
    throw new Error(`Service "${name}" already exists`);
  }

  validateService(name, config);
  data.services[name] = config;
  writeServicesFile(data, configPath);
}

/**
 * Update an existing service in services.yaml. Only provided fields are changed.
 * Re-validates the merged config before writing.
 * Throws if the service doesn't exist.
 */
export function updateService(
  name: string,
  updates: Partial<ServiceConfig>,
  configPath?: string
): void {
  const data = readServicesFile(configPath);

  if (!data.services[name]) {
    throw new Error(`Service "${name}" not found`);
  }

  const merged = { ...data.services[name], ...updates };
  validateService(name, merged);
  data.services[name] = merged;
  writeServicesFile(data, configPath);
}

/**
 * Remove a service from services.yaml. Throws if the service doesn't exist.
 */
export function removeService(name: string, configPath?: string): void {
  const data = readServicesFile(configPath);

  if (!data.services[name]) {
    throw new Error(`Service "${name}" not found`);
  }

  delete data.services[name];
  writeServicesFile(data, configPath);
}

/**
 * List all services. Returns an empty object if the file doesn't exist.
 */
export function listServices(
  configPath?: string
): Record<string, ServiceConfig> {
  if (!servicesFileExists(configPath)) {
    return {};
  }
  const data = readServicesFile(configPath);
  return data.services;
}
