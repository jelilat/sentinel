import type { ServiceConfig, ProxyRequestBody } from "./types";

/** Headers that agents are never allowed to set. */
const STRIPPED_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "host",
]);

/**
 * Remove dangerous headers from agent-provided headers.
 * Returns a new clean object.
 */
export function sanitizeHeaders(
  agentHeaders: Record<string, string> | undefined
): Record<string, string> {
  if (!agentHeaders || typeof agentHeaders !== "object") return {};

  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(agentHeaders)) {
    if (typeof key !== "string" || typeof value !== "string") continue;
    if (STRIPPED_HEADERS.has(key.toLowerCase())) continue;
    clean[key] = value;
  }
  return clean;
}

/**
 * Validate the agent request against the service configuration.
 * Returns null if valid, or an error string if invalid.
 */
export function validateRequest(
  service: ServiceConfig,
  body: ProxyRequestBody
): string | null {
  // Method must be a string
  if (!body.method || typeof body.method !== "string") {
    return "Missing or invalid 'method'";
  }

  const method = body.method.toUpperCase();

  // Check allowed methods
  if (service.allowed_methods) {
    const allowed = service.allowed_methods.map((m) => m.toUpperCase());
    if (!allowed.includes(method)) {
      return `Method "${method}" not allowed. Allowed: ${allowed.join(", ")}`;
    }
  }

  // Path must be a string starting with /
  if (!body.path || typeof body.path !== "string") {
    return "Missing or invalid 'path'";
  }

  if (!body.path.startsWith("/")) {
    return "Path must start with '/'";
  }

  // Prevent full URL in path (no protocol)
  if (/^https?:\/\//i.test(body.path)) {
    return "Path must be a relative path, not a full URL";
  }

  // Check allowed path prefixes
  if (service.allowed_path_prefixes) {
    const pathOnly = body.path.split("?")[0];
    const ok = service.allowed_path_prefixes.some((prefix) =>
      pathOnly.startsWith(prefix)
    );
    if (!ok) {
      return `Path "${pathOnly}" not allowed. Allowed prefixes: ${service.allowed_path_prefixes.join(", ")}`;
    }
  }

  return null;
}
