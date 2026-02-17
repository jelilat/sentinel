# Sentinel

**Stop giving AI agents your API and wallet private keys.**

Sentinel is a proxy that sits between your agents and external services. Your agents get a scoped gateway token. Sentinel holds the real credentials — API keys, private keys, secrets — injects them server-side, and forwards requests. If an agent is compromised, you revoke one token. The real keys never moved.

```
Agent ──(gateway token)──> Sentinel ──(real credentials)──> OpenAI / Stripe / Blockchain RPC / etc.
```

## Why

AI agents need to call external APIs and sign transactions, but giving them raw keys is dangerous:

- Keys leak through agent logs, outputs, and context windows
- Prompt injection can trick agents into exposing credentials
- A compromised agent means a compromised key — and you have to rotate it everywhere
- A leaked private key can drain a wallet instantly with no way to undo it

Sentinel gives you a single chokepoint: **one place to grant access, set limits, and revoke tokens — without touching the underlying API keys.**

## What you get

- **Key isolation** — Agents never see real API keys. Keys stay in server-side environment variables.
- **Per-agent tokens** — Each agent gets its own token, scoped to specific services. Revoke one without affecting others.
- **Rate limiting** — Per-agent and per-service rate limits.
- **IP allowlists** — Restrict which IPs can use each agent token.
- **Path & method restrictions** — Lock agents to specific endpoints (e.g. only `POST /v1/chat/completions`).
- **Header sanitization** — Auth headers from agents are stripped automatically. Agents can't override injected credentials.
- **Dashboard** — Web UI to manage agents, services, and tokens.
- **CLI** — Manage everything from the terminal.

## Quickstart

### 1. Install and build

```bash
git clone https://github.com/jelilat/sentinel.git
cd sentinel
npm install
npm run build
```

### 2. Set up your services

Edit `services.yaml` to define which APIs Sentinel can reach:

```yaml
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
      - POST
    allowed_path_prefixes:
      - /v1/
    rate_limit_per_minute: 60
```

### 3. Create an agent and start

```bash
export OPENAI_API_KEY="sk-..."         # Your real key (stays on the server)
export ADMIN_TOKEN="pick-a-password"   # Enables the web dashboard

node dist/cli.js init                  # Creates an agent + prints its token
node dist/cli.js start                 # Starts Sentinel on port 8080
```

Save the token it prints — that's what you give your agent.

### 4. Make a request

Your agent calls Sentinel like this — **no API key needed**:

```bash
curl -X POST http://localhost:8080/v1/proxy/openai \
  -H "Content-Type: application/json" \
  -H "x-agent-token: <agent-token-from-step-3>" \
  -d '{
    "method": "POST",
    "path": "/v1/chat/completions",
    "headers": { "Content-Type": "application/json" },
    "body": {
      "model": "gpt-4o-mini",
      "messages": [{"role": "user", "content": "Hello!"}],
      "max_tokens": 50
    }
  }'
```

### Docker

```bash
cp .env.example .env           # Add your API keys
docker compose up -d           # Start Sentinel
```

The dashboard is available at `http://localhost:8080`.

## CLI

Manage agents and tokens from the terminal.

```bash
sentinel init                                          # Create agents.yaml with a default agent
sentinel agent add my-agent --services openai,weather  # Add agent with scoped access
sentinel agent add locked --services openai --rate-limit 30 --allowed-ips 10.0.0.0/24
sentinel agent list                                    # List all agents (tokens masked)
sentinel agent update my-agent --rotate-token          # Rotate a compromised token
sentinel agent remove my-agent                         # Remove an agent
sentinel start                                         # Start the server
```

During development, run without building:

```bash
npx tsx src/cli.ts init
npx tsx src/cli.ts agent add test --services openai
```

## Self-Hosting

Deploy Sentinel on your own infrastructure with Docker, Railway, Render, or Fly.io.

See the **[Self-Hosting Guide](SELF-HOSTING.md)** for step-by-step instructions and a production security checklist.

> **Important:** Always run Sentinel on a separate server from your agents. If they share a machine, the agent can read your `.env` file and the security model breaks.

## Configuration

### services.yaml

Defines which external APIs Sentinel can reach. Each service specifies how to authenticate with the upstream API.

```yaml
services:
  openai:
    base_url: https://api.openai.com
    allowed_hosts:
      - api.openai.com
    auth:
      type: header               # "header" or "query"
      header_name: Authorization
      template: "Bearer ${SECRET}"
    secret_env: OPENAI_API_KEY   # Environment variable holding the real key
    allowed_methods:             # Optional: restrict HTTP methods
      - POST
    allowed_path_prefixes:       # Optional: restrict URL paths
      - /v1/
    timeout_ms: 60000            # Optional: request timeout (default 30s)
    rate_limit_per_minute: 60    # Optional: per-service rate limit
```

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
| `rate_limit_per_minute` | No | Per-service rate limit |
| `allowed_ips` | No | IP allowlist (overrides global) |
| `allowed_origins` | No | Origin allowlist (overrides global) |

### agents.yaml

Each agent gets a unique token and scoped permissions. Created via the CLI or dashboard.

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
```

If `agents.yaml` doesn't exist, Sentinel falls back to the `AGENT_TOKEN` env var (legacy single-token mode).

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_TOKEN` | No | — | Enables the dashboard and admin API |
| `AGENT_TOKEN` | If no `agents.yaml` | — | Legacy single token for all agents |
| `PORT` | No | `8080` | Server port |
| `SERVICES_CONFIG_PATH` | No | `services.yaml` | Path to services config |
| `AGENTS_CONFIG_PATH` | No | `agents.yaml` | Path to agents config |

Plus any keys referenced by `secret_env` in your services (e.g. `OPENAI_API_KEY`).

## API

### `POST /v1/proxy/:service`

Proxy a request through Sentinel to an upstream service.

**Headers:**
- `x-agent-token` (required) — Agent's gateway token
- `Content-Type: application/json`

**Body:**

```json
{
  "method": "POST",
  "path": "/v1/chat/completions",
  "headers": { "Content-Type": "application/json" },
  "body": { "model": "gpt-4o-mini", "messages": [...] }
}
```

| Field | Required | Description |
|---|---|---|
| `method` | Yes | HTTP method |
| `path` | Yes | Relative path (must start with `/`) |
| `headers` | No | Additional headers (auth headers are stripped) |
| `body` | No | Request body (ignored for GET/HEAD) |

The upstream response is returned transparently — same status code and body.

### `GET /health`

Returns `{"status": "ok", "services": ["openai", ...]}`. No auth required.

## Security

### What Sentinel prevents

- API keys appearing in agent logs, outputs, or context windows
- Agents using the gateway as an open proxy to arbitrary hosts
- Agents injecting their own auth headers to impersonate or exfiltrate

### What Sentinel does NOT prevent

- **Stolen gateway tokens** — If a token is stolen, the attacker can make requests through the gateway (scoped to that agent's permissions). Mitigate with rate limits, IP allowlists, and token rotation.
- **Upstream abuse** — Agents can still make valid but costly API calls. Use `rate_limit_per_minute` and `allowed_path_prefixes` to limit scope.
- **Response exfiltration** — Agents see upstream responses. This is by design — they need the data to function.

### Hardening checklist

- Use per-agent tokens instead of a single shared `AGENT_TOKEN`
- Scope each agent to only the services it needs
- Set `rate_limit_per_minute` on every agent and service
- Configure `allowed_ips` for agents running from known addresses
- Restrict `allowed_methods` and `allowed_path_prefixes` to the minimum needed
- Run Sentinel on a **separate server** from your agents
- Put Sentinel behind HTTPS (TLS termination via nginx, Caddy, or your platform)
- Rotate agent tokens regularly

### Headers stripped from agent requests

`Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization`, `X-Api-Key`, `Host`

## Project structure

```
src/
  cli.ts          CLI entry point
  index.ts        Server bootstrap
  config.ts       YAML config loader + validation
  agentFile.ts    agents.yaml read/write
  tokenGen.ts     Token generation
  auth.ts         Token auth middleware
  adminApi.ts     Dashboard admin API
  adminAuth.ts    Admin auth middleware
  security.ts     Header sanitization, IP checks
  rateLimit.ts    In-memory rate limiter
  proxy.ts        Core proxy handler
  types.ts        TypeScript types
dashboard/        React web dashboard (Vite)
```

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Ensure `npm run build` passes
5. Submit a pull request

## License

MIT
