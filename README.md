# Agent Gateway

A proxy server that keeps API keys away from AI agents. Agents send requests here, and the gateway adds the real API key before forwarding to the external service. Agents never touch the actual keys.

## Problem

AI agents need to call external APIs (OpenAI, Stripe, weather services, etc.), but giving agents raw API keys is dangerous:

- Keys can leak through agent logs, outputs, or context windows
- Compromised agents can exfiltrate credentials
- There's no central chokepoint for access control

## Solution

Agent Gateway sits between agents and external services. Agents send requests to the gateway with a gateway token. The gateway:

1. Validates the gateway token
2. Looks up the target service in a YAML config
3. Injects the real API key from server-side environment variables
4. Forwards the request to the upstream service
5. Returns the response transparently

```
Agent ──(gateway token)──> Agent Gateway ──(real API key)──> External API
```

The agent never sees the real API key. It only knows the gateway URL and its agent token.

## Quickstart

### Local (Node.js)

```bash
# Install dependencies
npm install

# Set required env vars
export AGENT_TOKEN="my-secret-agent-token"
export OPENAI_API_KEY="sk-..."  # your real OpenAI key

# Start the gateway
npm run dev
```

The gateway starts on port 8080 by default.

### Docker

```bash
# Build
docker build -t agent-gateway .

# Run
docker run -p 8080:8080 \
  -e AGENT_TOKEN="my-secret-agent-token" \
  -e OPENAI_API_KEY="sk-..." \
  -v $(pwd)/services.yaml:/app/services.yaml \
  agent-gateway
```

### Make a request

Agents call the gateway like this:

```bash
curl -X POST http://localhost:8080/v1/proxy/openai \
  -H "Content-Type: application/json" \
  -H "x-agent-token: my-secret-agent-token" \
  -d '{
    "method": "POST",
    "path": "/v1/chat/completions",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "model": "gpt-4o-mini",
      "messages": [{"role": "user", "content": "Hello!"}],
      "max_tokens": 50
    }
  }'
```

Notice: **no OpenAI API key anywhere in the agent's request**.

### Example agent script

```bash
GATEWAY_URL=http://localhost:8080 AGENT_TOKEN=my-secret-agent-token npx tsx examples/agent-call-openai.ts
```

## Configuration

Services are defined in `services.yaml` (or set `SERVICES_CONFIG_PATH` env var).

### Global fields

These top-level fields apply to all services unless a service provides its own override.

| Field | Required | Description |
|---|---|---|
| `allowed_ips` | No | Global IP allowlist (exact IPs or CIDR ranges) |
| `allowed_origins` | No | Global Origin header allowlist (exact match) |

### Example: services.yaml

```yaml
# Global allowlists (optional)
allowed_ips:
  - 192.168.1.0/24
  - 10.0.0.5
allowed_origins:
  - https://app.example.com

services:
  openai:
    base_url: https://api.openai.com
    allowed_hosts:
      - api.openai.com
    auth:
      type: header
      header_name: Authorization
      template: "Bearer ${SECRET}"
    secret_env: OPENAI_API_KEY
    allowed_methods:
      - GET
      - POST
    allowed_path_prefixes:
      - /v1/
    timeout_ms: 60000
    rate_limit_per_minute: 60

  weather:
    base_url: https://api.weatherapi.com
    allowed_hosts:
      - api.weatherapi.com
    auth:
      type: query
      query_param: key
      template: "${SECRET}"
    secret_env: WEATHER_API_KEY
    allowed_methods:
      - GET
    allowed_path_prefixes:
      - /v1/
    timeout_ms: 10000
    rate_limit_per_minute: 30
```

### Service fields

| Field | Required | Description |
|---|---|---|
| `base_url` | Yes | Upstream base URL (must be https) |
| `allowed_hosts` | Yes | Host allowlist (must include base_url host) |
| `auth.type` | Yes | `"header"` or `"query"` |
| `auth.header_name` | If header | Header name to inject (e.g. `Authorization`) |
| `auth.query_param` | If query | Query parameter name to inject |
| `auth.template` | Yes | Template with `${SECRET}` placeholder |
| `secret_env` | Yes | Environment variable holding the real API key |
| `allowed_methods` | No | Restrict HTTP methods (e.g. `["GET", "POST"]`) |
| `allowed_path_prefixes` | No | Restrict URL paths (e.g. `["/v1/"]`) |
| `timeout_ms` | No | Request timeout (default: 30000) |
| `rate_limit_per_minute` | No | Simple per-service rate limit |
| `allowed_ips` | No | IP allowlist (exact or CIDR, e.g. `192.168.1.0/24`). Overrides global. |
| `allowed_origins` | No | Origin allowlist (exact match). Overrides global. |

### Auth injection types

**Header injection** — injects the secret as an HTTP header:

```yaml
auth:
  type: header
  header_name: Authorization
  template: "Bearer ${SECRET}"
```

**Query injection** — injects the secret as a URL query parameter:

```yaml
auth:
  type: query
  query_param: key
  template: "${SECRET}"
```

## API

### `POST /v1/proxy/:service`

**Headers:**
- `x-agent-token` (required): Gateway authentication token
- `Content-Type: application/json`

**Body:**

```json
{
  "method": "POST",
  "path": "/v1/chat/completions",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": { ... }
}
```

| Field | Required | Description |
|---|---|---|
| `method` | Yes | HTTP method (`GET`, `POST`, `PUT`, `DELETE`, etc.) |
| `path` | Yes | Relative path (must start with `/`) |
| `headers` | No | Additional headers (auth headers are stripped) |
| `body` | No | Request body (ignored for GET/HEAD) |

**Response:** The upstream response is returned transparently — same status code and body.

### `GET /health`

Returns `{"status": "ok", "services": ["openai", ...]}`. No auth required.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AGENT_TOKEN` | Yes | — | Token agents use to authenticate |
| `PORT` | No | `8080` | Server port |
| `SERVICES_CONFIG_PATH` | No | `services.yaml` | Path to config file |
| `OPENAI_API_KEY` | Per config | — | Example: real OpenAI key |

## Security

### Threat model

Agent Gateway prevents **key leakage through agents**. Specifically:

- Agents never receive API keys — keys exist only in the gateway's environment
- Agents cannot choose which hosts to contact — only services defined in `services.yaml` are reachable
- Auth headers from agents are stripped — agents cannot override injected credentials
- Request metadata logging only — secrets, headers, and bodies are never logged

### What it prevents

- API key appearing in agent logs, outputs, or context windows
- Agent using the gateway as an open proxy to arbitrary hosts
- Agent injecting its own auth headers to impersonate or exfiltrate

### What it does NOT prevent

- **Stolen gateway tokens**: If an attacker obtains the `AGENT_TOKEN`, they can make requests through the gateway. Rate limits and IP/Origin allowlists mitigate abuse.
- **Upstream abuse**: An agent can still make valid but costly API calls. Use `rate_limit_per_minute` and `allowed_path_prefixes` to limit scope.
- **Response exfiltration**: The agent sees upstream responses. This is by design — the agent needs the data to function.

### IP & Origin allowlists

You can restrict which IPs and origins are allowed to use the gateway. This provides a network-level security layer — even if the agent token is stolen, requests are rejected unless they come from an approved source.

- **Global allowlists** apply to all services unless a service defines its own
- **Per-service allowlists** fully replace (not merge with) the global lists
- If no allowlists are configured, all IPs and origins are allowed (backwards compatible)
- IP allowlists support exact IPs and CIDR notation (e.g. `192.168.1.0/24`)
- Origin is read from the `Origin` header, falling back to `Referer`
- The gateway sets `trust proxy` so `req.ip` reflects `X-Forwarded-For` when behind a reverse proxy

```yaml
# Global: allow this subnet and one specific IP
allowed_ips:
  - 192.168.1.0/24
  - 10.0.0.5
allowed_origins:
  - https://app.example.com

services:
  openai:
    # This service overrides the global lists entirely
    allowed_ips:
      - 10.0.0.10
    allowed_origins:
      - https://agent.internal.com
    ...
```

### Hardening recommendations

- Use a strong, random `AGENT_TOKEN`
- Restrict `allowed_methods` and `allowed_path_prefixes` to the minimum needed
- Set appropriate `rate_limit_per_minute` values
- Configure `allowed_ips` and `allowed_origins` to restrict access to known sources
- Run the gateway in a private network, not on the public internet
- Rotate `AGENT_TOKEN` regularly
- Use separate gateway instances for different trust levels

### Header sanitization

These headers are always stripped from agent requests:

- `Authorization`
- `Cookie` / `Set-Cookie`
- `Proxy-Authorization`
- `X-Api-Key`
- `Host`

## Project structure

```
├── src/
│   ├── index.ts        # Server bootstrap
│   ├── types.ts        # TypeScript types
│   ├── config.ts       # YAML config loader + validation
│   ├── auth.ts         # Token auth middleware
│   ├── security.ts     # Header sanitization, method/path checks
│   ├── rateLimit.ts    # In-memory rate limiter
│   └── proxy.ts        # Core proxy handler
├── examples/
│   └── agent-call-openai.ts  # Example agent script
├── services.yaml       # Service definitions
├── Dockerfile
├── package.json
└── tsconfig.json
```

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes — keep them focused and minimal
4. Ensure `npm run build` passes
5. Submit a pull request

Please keep the project simple and focused. The goal is a minimal, safe-by-default credential proxy — not a full API management platform.

## License

MIT
