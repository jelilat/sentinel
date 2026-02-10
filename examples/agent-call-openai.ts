/**
 * Example: An AI agent calling OpenAI through Sentinel.
 *
 * The agent only knows the gateway URL and its agent token.
 * It never sees the OpenAI API key.
 *
 * Usage:
 *   GATEWAY_URL=http://localhost:8080 AGENT_TOKEN=my-secret-token npx tsx examples/agent-call-openai.ts
 */

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";
const AGENT_TOKEN = process.env.AGENT_TOKEN;

if (!AGENT_TOKEN) {
  console.error("Set AGENT_TOKEN environment variable");
  process.exit(1);
}

async function main() {
  console.log("Agent: Calling OpenAI via Sentinel (no API key needed)...\n");

  const response = await fetch(`${GATEWAY_URL}/v1/proxy/openai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-token": AGENT_TOKEN,
    },
    body: JSON.stringify({
      method: "POST",
      path: "/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: "Say hello in one sentence." },
        ],
        max_tokens: 50,
      },
    }),
  });

  console.log(`Status: ${response.status}`);
  const data = await response.text();

  try {
    const json = JSON.parse(data);
    console.log("\nResponse:", JSON.stringify(json, null, 2));
  } catch {
    console.log("\nResponse:", data);
  }
}

main().catch(console.error);
