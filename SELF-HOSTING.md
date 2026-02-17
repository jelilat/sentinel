# Self-Hosting Sentinel

This guide walks you through deploying Sentinel on your own infrastructure. Total setup time: ~10 minutes.

## The Golden Rule

> **Run Sentinel on a separate server from your agents.**

If Sentinel runs on the same machine as your agent, the agent can read your `.env` file and grab the API keys directly — defeating the entire purpose. The network boundary between your agent and Sentinel is what makes this secure.

```
Your agent (Machine A)  ──HTTPS──>  Sentinel (Machine B)  ──>  OpenAI / Stripe / etc.
```

## Quick Start (Docker)

### 1. Clone and configure

```bash
git clone https://github.com/jelilat/sentinel.git
cd sentinel
cp .env.example .env
```

Edit `.env` with your keys:

```env
ADMIN_TOKEN=pick-a-strong-password
OPENAI_API_KEY=sk-...
```

### 2. Configure services

Edit `services.yaml` to define which APIs Sentinel can reach. A basic setup:

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

### 3. Start

```bash
docker compose up -d
```

Sentinel is now running on port 8080. The dashboard is at `http://your-server:8080`.

### 4. Create an agent

Open the dashboard and add an agent, or use the CLI inside the container:

```bash
docker compose exec sentinel node dist/cli.js init
```

Save the token it prints — give this to your agent, not your API keys.

## Deploy to a Cloud Platform

### Railway

1. Fork this repo
2. Create a new project on [Railway](https://railway.app)
3. Connect your fork
4. Add environment variables in the **Variables** tab:
   - `ADMIN_TOKEN` — your dashboard password
   - `OPENAI_API_KEY` — (and any other service keys)
5. Deploy — Railway detects the Dockerfile automatically

### Render

1. Fork this repo
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect your fork, select **Docker** as the environment
4. Add environment variables in the **Environment** tab
5. Deploy

### Fly.io

```bash
fly launch --no-deploy
fly secrets set ADMIN_TOKEN=your-password OPENAI_API_KEY=sk-...
fly deploy
```

## Security Checklist

Follow every item before going to production.

### Must do

- [ ] **Separate machines** — Sentinel runs on a different server than your agents
- [ ] **HTTPS only** — Put Sentinel behind a reverse proxy (nginx, Caddy, or your platform's built-in TLS). Never expose port 8080 as plain HTTP over the internet
- [ ] **Strong ADMIN_TOKEN** — Use a long random string, not a dictionary word
- [ ] **Restrict services** — Only define the APIs your agents actually need in `services.yaml`
- [ ] **Per-agent tokens** — Give each agent its own token with scoped `allowed_services`. Never share tokens across agents
- [ ] **Rate limits** — Set `rate_limit_per_minute` on every service and every agent

### Should do

- [ ] **IP allowlists** — If your agents run from known IPs, set `allowed_ips` per agent
- [ ] **Path prefixes** — Restrict `allowed_path_prefixes` to only the endpoints your agent uses (e.g. `/v1/chat/completions` not just `/v1/`)
- [ ] **Method restrictions** — Set `allowed_methods` to only `POST` if your agent doesn't need `GET`, `PUT`, etc.
- [ ] **Rotate tokens regularly** — Use the dashboard or CLI to rotate agent tokens on a schedule
- [ ] **Monitor the health endpoint** — Set up uptime monitoring on `/health`

### Don't do

- [ ] **Don't run Sentinel on the same machine as your agents**
- [ ] **Don't commit `.env` to git** — It's in `.gitignore` for a reason
- [ ] **Don't expose the dashboard to the public internet without HTTPS**
- [ ] **Don't give agents more service access than they need**
- [ ] **Don't reuse agent tokens across different agents**

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Your Infrastructure                                     │
│                                                          │
│  ┌──────────┐     HTTPS      ┌──────────────────────┐   │
│  │  Agent 1  │ ──────────>   │  Sentinel             │   │
│  └──────────┘    (agent      │                        │   │
│                   token)     │  ┌──────────────────┐  │   │
│  ┌──────────┐                │  │  services.yaml   │  │   │
│  │  Agent 2  │ ──────────>   │  │  (routing rules) │  │   │
│  └──────────┘                │  └──────────────────┘  │   │
│                              │                        │   │
│                              │  ┌──────────────────┐  │   │
│                              │  │  Environment     │  │   │
│                              │  │  Variables       │  │   │
│                              │  │  (real API keys) │  │   │
│                              │  └──────────────────┘  │   │
│                              └────────┬───────────────┘   │
│                                       │                    │
└───────────────────────────────────────┼────────────────────┘
                                        │ (real API key injected)
                                        ▼
                              ┌──────────────────┐
                              │  External APIs    │
                              │  (OpenAI, etc.)   │
                              └──────────────────┘
```

## Updating

```bash
git pull
docker compose build
docker compose up -d
```

Your `.env`, `services.yaml`, and `agents.yaml` are mounted as volumes — they survive rebuilds.

## Troubleshooting

**"Server misconfigured: ADMIN_TOKEN not set"**
You didn't set `ADMIN_TOKEN` in your `.env` file. The dashboard is only enabled when this is set.

**"FATAL: Failed to load config"**
Your `services.yaml` is missing or has a syntax error. Validate it with `python -c "import yaml; yaml.safe_load(open('services.yaml'))"` or any YAML linter.

**"Unauthorized: invalid agent token"**
The agent is using the wrong token. Check `agents.yaml` or create a new agent via the dashboard.

**Agent can read the .env file**
You're running Sentinel on the same machine as the agent. Move Sentinel to a separate server. This is the single most important security requirement.
