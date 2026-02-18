#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SENTINEL_URL = process.env.SENTINEL_URL ?? "http://localhost:8080";
const SENTINEL_AGENT_TOKEN = process.env.SENTINEL_AGENT_TOKEN ?? "";

async function sentinelFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = new URL(path, SENTINEL_URL);
  return fetch(url.toString(), options);
}

async function proxyRequest(
  service: string,
  method: string,
  path: string,
  headers?: Record<string, string>,
  body?: unknown
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const payload: Record<string, unknown> = { method, path };
  if (headers) payload.headers = headers;
  if (body !== undefined) payload.body = body;

  const response = await sentinelFetch(`/v1/proxy/${service}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-token": SENTINEL_AGENT_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  const responseBody = await response.text();

  return {
    status: response.status,
    headers: responseHeaders,
    body: responseBody,
  };
}

const server = new McpServer({
  name: "sentinel",
  version: "1.0.0",
});

server.tool(
  "sentinel_proxy",
  "Send a proxied request through Sentinel to a configured upstream service. " +
    "Sentinel injects the real API credentials server-side so you never see them.",
  {
    service: z.string().describe("Name of the service to proxy to (e.g. 'openai', 'anthropic')"),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).describe("HTTP method"),
    path: z.string().describe("Path on the upstream API (e.g. '/v1/chat/completions')"),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .describe("Optional HTTP headers to forward (auth headers are stripped)"),
    body: z
      .any()
      .optional()
      .describe("Optional request body (object or string). Ignored for GET/HEAD."),
  },
  async ({ service, method, path, headers, body }) => {
    if (!SENTINEL_AGENT_TOKEN) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: SENTINEL_AGENT_TOKEN environment variable is not set. "
              + "Configure it with your agt_... token.",
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await proxyRequest(service, method, path, headers, body);

      let formattedBody = result.body;
      try {
        const parsed = JSON.parse(result.body);
        formattedBody = JSON.stringify(parsed, null, 2);
      } catch {
        // Response isn't JSON, keep as-is
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `HTTP ${result.status}\n\n${formattedBody}`,
          },
        ],
        isError: result.status >= 400,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to reach Sentinel at ${SENTINEL_URL}: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "sentinel_list_services",
  "List the services available on this Sentinel instance.",
  {},
  async () => {
    try {
      const response = await sentinelFetch("/health");
      const data = (await response.json()) as { status: string; services: string[] };

      return {
        content: [
          {
            type: "text" as const,
            text: `Sentinel is ${data.status}. Available services:\n\n`
              + data.services.map((s: string) => `  - ${s}`).join("\n"),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to reach Sentinel at ${SENTINEL_URL}: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "sentinel_health",
  "Check if the Sentinel gateway is reachable and healthy.",
  {},
  async () => {
    try {
      const start = Date.now();
      const response = await sentinelFetch("/health");
      const latency = Date.now() - start;
      const data = (await response.json()) as { status: string; services: string[] };

      return {
        content: [
          {
            type: "text" as const,
            text: `Status: ${data.status}\n`
              + `Latency: ${latency}ms\n`
              + `Services: ${data.services.length}\n`
              + `URL: ${SENTINEL_URL}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text" as const,
            text: `Sentinel is unreachable at ${SENTINEL_URL}: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Sentinel MCP server failed to start:", err);
  process.exit(1);
});
