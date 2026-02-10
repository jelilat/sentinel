# Sentinel

A safety layer for autonomous agents. It lets agents interact with real systems without unbounded authority, so you can scale agents without scaling risk.

## Problem

AI agents need to make transactions or interact with external systems, but giving agents raw API and wallet private keys is dangerous:

- Keys can leak through agent logs, outputs, or context windows
- Compromised agents can exfiltrate credentials
- There's no central chokepoint for access control

## Solution

Sentinel sits between agents and external services. Agents send requests to the gateway with a gateway token. The gateway:

1. Validates the gateway token
2. Looks up the target service in a YAML config
3. Injects the real API key from server-side environment variables
4. Forwards the request to the upstream service
5. Returns the response transparently

```
Agent ──(gateway token)──> Sentinel ──(real API key)──> External API
```

The agent never sees the real API key. It only knows the gateway URL and its agent token.

## CLI

The CLI manages agents and tokens so you don't have to edit YAML by hand.

### Install

```bash
npm install
npm run build
npm link        # makes 'sentinel' available globally (optional)
```

### Commands

```bash
# Initialize agents.yaml with a default agent (auto-generates token)
sentinel init

# Add an agent with auto-generated token
sentinel agent add my-agent --services openai,weather

# Add an agent with a custom token and rate limit
sentinel agent add restricted-agent --services openai --token agt_custom... --rate-limit 30

# Add an agent with IP restrictions
sentinel agent add internal-agent --services openai --allowed-ips 10.0.0.0/24,192.168.1.5

# List all agents (tokens are masked)
sentinel agent list

# Remove an agent
sentinel agent remove my-agent

# Start the gateway server
sentinel start
```

### How it works

- **`init`** creates `agents.yaml` with a `default-agent` that has access to all services in `services.yaml`. The token is printed once — save it.
- **`agent add`** validates `--services` against `services.yaml` and auto-generates a token (or use `--token` to supply your own). The token is printed once.
- **`agent list`** shows all agents in a table with masked tokens (`agt_a1b2...e5f6`).
- **`agent remove`** removes an agent from the file.
- **`start`** starts the gateway server (same as `npm start`).

### Development

```bash
# Run CLI commands without building
npx tsx src/cli.ts init
npx tsx src/cli.ts agent add test --services openai
```

## Quickstart

### Local (Node.js)

```bash
# Install dependencies
npm install

# Option 1: Use the CLI (recommended)
npm run build
node dist/cli.js init
export OPENAI_API_KEY="sk-..."
node dist/cli.js start

# Option 2: Legacy mode with shared token
export AGENT_TOKEN="my-secret-agent-token"
export OPENAI_API_KEY="sk-..."
npm run dev
```

The gateway starts on port 8080 by default.

### Docker

```bash
# Build
docker build -t sentinel .

# Run
docker run -p 8080:8080 \
  -e AGENT_TOKEN="my-secret-agent-token" \
  -e OPENAI_API_KEY="sk-..." \
  -v $(pwd)/services.yaml:/app/services.yaml \
  sentinel
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

## Per-Agent Tokens

By default, all agents share a single `AGENT_TOKEN`. For better security, you can give each agent its own token with scoped permissions via `agents.yaml`.

### Setup

```bash
# Generate a token
node -e "console.log('agt_' + require('crypto').randomBytes(24).toString('hex'))"

# Create agents.yaml (see agents.yaml.example)
cp agents.yaml.example agents.yaml
```

### agents.yaml

```yaml
agents:
  frontend-agent:
    token: agt_a1b2c3d4e5f6...
    allowed_services:
      - openai
    rate_limit_per_minute: 30
    allowed_ips:
      - 10.0.0.0/24

  data-pipeline:
    token: agt_x9y8w7v6u5t4...
    allowed_services:
      - openai
      - anthropic
      - weather
```

### How scoping works

- **Services**: Each agent can only access services listed in its `allowed_services`. Other services return 403.
- **Rate limits**: Per-agent `rate_limit_per_minute` is checked *in addition to* per-service limits. Both must pass.
- **IP allowlists**: Per-agent `allowed_ips` is checked *in addition to* service/global IP allowlists. All must pass.

### Legacy mode

If `agents.yaml` doesn't exist, the gateway falls back to `AGENT_TOKEN` env var. No configuration changes are needed — existing setups work as before.

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
| `AGENT_TOKEN` | If no `agents.yaml` | — | Legacy single token for all agents |
| `PORT` | No | `8080` | Server port |
| `SERVICES_CONFIG_PATH` | No | `services.yaml` | Path to services config file |
| `AGENTS_CONFIG_PATH` | No | `agents.yaml` | Path to agents config file |
| `OPENAI_API_KEY` | Per config | — | Example: real OpenAI key |

## Security

### Threat model

Sentinel prevents **key leakage through agents**. Specifically:

- Agents never receive API keys — keys exist only in the gateway's environment
- Agents cannot choose which hosts to contact — only services defined in `services.yaml` are reachable
- Auth headers from agents are stripped — agents cannot override injected credentials
- Request metadata logging only — secrets, headers, and bodies are never logged

### What it prevents

- API key appearing in agent logs, outputs, or context windows
- Agent using the gateway as an open proxy to arbitrary hosts
- Agent injecting its own auth headers to impersonate or exfiltrate

### What it does NOT prevent

- **Stolen gateway tokens**: If an attacker obtains a token, they can make requests through the gateway. Per-agent tokens limit blast radius — revoke one agent without affecting others. Rate limits and IP/Origin allowlists further mitigate abuse.
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

- Use per-agent tokens (`agents.yaml`) instead of a single shared `AGENT_TOKEN`
- Scope each agent to only the services it needs via `allowed_services`
- Set per-agent `rate_limit_per_minute` and `allowed_ips` for defense in depth
- Restrict `allowed_methods` and `allowed_path_prefixes` to the minimum needed
- Set appropriate per-service `rate_limit_per_minute` values
- Configure `allowed_ips` and `allowed_origins` to restrict access to known sources
- Run the gateway in a private network, not on the public internet
- Rotate agent tokens regularly — each can be rotated independently

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
│   ├── cli.ts          # CLI entry point (sentinel command)

│   ├── index.ts        # Server bootstrap
│   ├── types.ts        # TypeScript types
│   ├── config.ts       # YAML config loader + validation
│   ├── agentFile.ts    # YAML read/write for agents.yaml
│   ├── tokenGen.ts     # Token generation utility
│   ├── auth.ts         # Token auth middleware (factory pattern)
│   ├── security.ts     # Header sanitization, IP checks, method/path checks
│   ├── rateLimit.ts    # In-memory rate limiter
│   └── proxy.ts        # Core proxy handler
├── examples/
│   └── agent-call-openai.ts  # Example agent script
├── services.yaml       # Service definitions
├── agents.yaml.example # Per-agent token config example
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
