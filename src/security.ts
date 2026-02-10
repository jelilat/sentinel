import net from "net";
import type { Request } from "express";
import type { GlobalConfig, ResolvedAgent, ServiceConfig, ProxyRequestBody } from "./types";

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
 * Parse a CIDR string into a base address buffer and prefix length.
 * Returns null if the string is not valid CIDR notation.
 */
function parseCidr(cidr: string): { ip: string; prefixLen: number } | null {
  const parts = cidr.split("/");
  if (parts.length !== 2) return null;
  const ip = parts[0];
  const prefixLen = parseInt(parts[1], 10);
  if (!net.isIP(ip) || isNaN(prefixLen)) return null;
  const maxBits = net.isIPv4(ip) ? 32 : 128;
  if (prefixLen < 0 || prefixLen > maxBits) return null;
  return { ip, prefixLen };
}

/**
 * Convert an IP address string to a buffer of bytes.
 */
function ipToBytes(ip: string): number[] {
  if (net.isIPv4(ip)) {
    return ip.split(".").map(Number);
  }
  // IPv6: expand to 16 bytes
  const buf = Buffer.alloc(16);
  // Use a full expansion via the grouped notation
  const groups = expandIPv6(ip);
  for (let i = 0; i < 8; i++) {
    const val = parseInt(groups[i], 16);
    buf[i * 2] = (val >> 8) & 0xff;
    buf[i * 2 + 1] = val & 0xff;
  }
  return Array.from(buf);
}

function expandIPv6(ip: string): string[] {
  let halves = ip.split("::");
  if (halves.length === 1) {
    return ip.split(":").map((g) => g.padStart(4, "0"));
  }
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  const middle = Array(missing).fill("0000");
  return [...left, ...middle, ...right].map((g) => g.padStart(4, "0"));
}

/**
 * Check whether an IP matches a CIDR range or exact IP.
 */
function ipMatchesEntry(clientIp: string, entry: string): boolean {
  const cidr = parseCidr(entry);
  if (cidr) {
    // Both must be same family
    if ((net.isIPv4(clientIp) ? 4 : 6) !== (net.isIPv4(cidr.ip) ? 4 : 6)) {
      return false;
    }
    const clientBytes = ipToBytes(clientIp);
    const entryBytes = ipToBytes(cidr.ip);
    const fullBytes = Math.floor(cidr.prefixLen / 8);
    const remainBits = cidr.prefixLen % 8;

    for (let i = 0; i < fullBytes; i++) {
      if (clientBytes[i] !== entryBytes[i]) return false;
    }
    if (remainBits > 0) {
      const mask = 0xff << (8 - remainBits);
      if ((clientBytes[fullBytes] & mask) !== (entryBytes[fullBytes] & mask)) {
        return false;
      }
    }
    return true;
  }

  // Exact IP match
  return clientIp === entry;
}

/**
 * Check IP and Origin allowlists for a request.
 * Returns null if allowed, or an error string if blocked.
 */
export function checkAllowlist(
  req: Request,
  service: ServiceConfig,
  globalConfig: GlobalConfig
): string | null {
  // Determine effective IP allowlist (per-service overrides global)
  const effectiveIps = service.allowed_ips ?? globalConfig.allowed_ips;
  if (effectiveIps && effectiveIps.length > 0) {
    const clientIp = req.ip;
    if (!clientIp || !net.isIP(clientIp)) {
      return "Could not determine client IP";
    }
    const allowed = effectiveIps.some((entry) => ipMatchesEntry(clientIp, entry));
    if (!allowed) {
      return `IP ${clientIp} is not in the allowlist`;
    }
  }

  // Determine effective Origin allowlist (per-service overrides global)
  const effectiveOrigins = service.allowed_origins ?? globalConfig.allowed_origins;
  if (effectiveOrigins && effectiveOrigins.length > 0) {
    const origin = req.headers["origin"] ?? req.headers["referer"];
    if (!origin || typeof origin !== "string") {
      return "Missing Origin header and request is not in the origin allowlist";
    }
    // Strip trailing slash from origin/referer for comparison
    const normalized = origin.replace(/\/+$/, "");
    if (!effectiveOrigins.includes(normalized)) {
      return `Origin "${normalized}" is not in the allowlist`;
    }
  }

  return null;
}

/**
 * Check per-agent IP allowlist.
 * Returns null if allowed, or an error string if blocked.
 * Skips check if agent has no allowed_ips configured.
 */
export function checkAgentIpAllowlist(
  req: Request,
  agent: ResolvedAgent
): string | null {
  const allowedIps = agent.config.allowed_ips;
  if (!allowedIps || allowedIps.length === 0) return null;

  const clientIp = req.ip;
  if (!clientIp || !net.isIP(clientIp)) {
    return "Could not determine client IP";
  }

  const allowed = allowedIps.some((entry) => ipMatchesEntry(clientIp, entry));
  if (!allowed) {
    return `IP ${clientIp} is not in agent "${agent.name}" IP allowlist`;
  }

  return null;
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
