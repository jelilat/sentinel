import type { Request, Response } from "express";
import type { GlobalConfig, ResolvedAgent, ServiceConfig, ProxyRequestBody } from "./types";
import { checkAllowlist, checkAgentIpAllowlist, sanitizeHeaders, validateRequest } from "./security";
import { checkRateLimit } from "./rateLimit";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Resolve the secret value from the environment and apply the template.
 */
function resolveSecret(service: ServiceConfig): string | null {
  const raw = process.env[service.secret_env];
  if (!raw) return null;
  return service.auth.template.replace("${SECRET}", raw);
}

/**
 * Core proxy handler for POST /v1/proxy/:service.
 */
export function createProxyHandler(
  services: Record<string, ServiceConfig>,
  globalConfig: GlobalConfig
) {
  return async (req: Request, res: Response): Promise<void> => {
    const serviceName = req.params.service;
    const start = Date.now();
    const agent = res.locals.agent as ResolvedAgent | undefined;
    const agentName = agent?.name ?? "legacy";

    // Look up service
    const service = services[serviceName];
    if (!service) {
      res.status(404).json({
        error: `Unknown service: "${serviceName}"`,
        available: Object.keys(services),
      });
      return;
    }

    // Check agent is authorized for this service
    if (agent && !agent.config.allowed_services.includes(serviceName)) {
      res.status(403).json({
        error: `Agent "${agent.name}" is not authorized for service "${serviceName}"`,
      });
      return;
    }

    // Check IP/Origin allowlist (service/global)
    const allowlistError = checkAllowlist(req, service, globalConfig);
    if (allowlistError) {
      res.status(403).json({ error: allowlistError });
      return;
    }

    // Check per-agent IP allowlist
    if (agent) {
      const agentIpError = checkAgentIpAllowlist(req, agent);
      if (agentIpError) {
        res.status(403).json({ error: agentIpError });
        return;
      }
    }

    const body = req.body as ProxyRequestBody;

    // Validate request against service rules
    const validationError = validateRequest(service, body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    // Service rate limit
    if (!checkRateLimit(serviceName, service.rate_limit_per_minute)) {
      res.status(429).json({
        error: `Rate limit exceeded for service "${serviceName}". Limit: ${service.rate_limit_per_minute}/min`,
      });
      return;
    }

    // Per-agent rate limit
    if (agent && agent.config.rate_limit_per_minute) {
      if (!checkRateLimit(`agent:${agent.name}`, agent.config.rate_limit_per_minute)) {
        res.status(429).json({
          error: `Rate limit exceeded for agent "${agent.name}". Limit: ${agent.config.rate_limit_per_minute}/min`,
        });
        return;
      }
    }

    // Resolve secret
    const secretValue = resolveSecret(service);
    if (secretValue === null) {
      res.status(500).json({
        error: `Server misconfigured: env var "${service.secret_env}" is not set`,
      });
      return;
    }

    // Build target URL
    const targetUrl = new URL(body.path, service.base_url);

    // Inject query-param auth if configured
    if (service.auth.type === "query") {
      targetUrl.searchParams.set(service.auth.query_param, secretValue);
    }

    // Build headers
    const headers = sanitizeHeaders(body.headers);

    // Inject header auth if configured
    if (service.auth.type === "header") {
      headers[service.auth.header_name] = secretValue;
    }

    // Prepare fetch options
    const method = body.method.toUpperCase();
    const timeout = service.timeout_ms ?? DEFAULT_TIMEOUT_MS;

    const fetchOptions: RequestInit & { signal: AbortSignal } = {
      method,
      headers,
      signal: AbortSignal.timeout(timeout),
    };

    // Attach body for methods that support it
    if (body.body !== undefined && !["GET", "HEAD"].includes(method)) {
      fetchOptions.body =
        typeof body.body === "string" ? body.body : JSON.stringify(body.body);
    }

    try {
      const upstream = await fetch(targetUrl.toString(), fetchOptions);

      // Log metadata only (never secrets or bodies)
      console.log(
        JSON.stringify({
          agent: agentName,
          service: serviceName,
          method,
          path: body.path,
          status: upstream.status,
          latency_ms: Date.now() - start,
          timestamp: new Date().toISOString(),
        })
      );

      // Forward status and headers
      res.status(upstream.status);

      // Forward select response headers
      const contentType = upstream.headers.get("content-type");
      if (contentType) {
        res.setHeader("content-type", contentType);
      }

      // Stream body back as buffer
      const responseBody = Buffer.from(await upstream.arrayBuffer());
      res.send(responseBody);
    } catch (err: unknown) {
      const latency = Date.now() - start;
      const message =
        err instanceof Error ? err.message : "Unknown proxy error";

      console.log(
        JSON.stringify({
          agent: agentName,
          service: serviceName,
          method,
          path: body.path,
          error: message,
          latency_ms: latency,
          timestamp: new Date().toISOString(),
        })
      );

      if (message.includes("timed out") || message.includes("timeout")) {
        res.status(504).json({ error: `Upstream request timed out (${timeout}ms)` });
      } else {
        res.status(502).json({ error: `Upstream request failed: ${message}` });
      }
    }
  };
}
