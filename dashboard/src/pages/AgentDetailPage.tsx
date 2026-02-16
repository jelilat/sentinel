import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api";
import AgentForm from "../components/AgentForm";
import TokenDisplay from "../components/TokenDisplay";
import type { Agent } from "../types";

export default function AgentDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotatedToken, setRotatedToken] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    loadAgent();
  }, [name]);

  async function loadAgent() {
    try {
      const agents = await apiFetch<Agent[]>("/api/agents");
      const found = agents.find((a) => a.name === name);
      if (!found) {
        setError(`Agent "${name}" not found`);
        return;
      }
      setAgent(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agent");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(data: {
    name: string;
    allowed_services: string[];
    rate_limit_per_minute?: number;
    allowed_ips?: string[];
  }) {
    setError("");
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        allowed_services: data.allowed_services,
      };
      if (data.rate_limit_per_minute) {
        body.rate_limit_per_minute = data.rate_limit_per_minute;
      }
      if (data.allowed_ips) {
        body.allowed_ips = data.allowed_ips;
      }

      await apiFetch(`/api/agents/${encodeURIComponent(name!)}`, "PATCH", body);
      navigate("/agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update agent");
    } finally {
      setSaving(false);
    }
  }

  async function handleRotateToken() {
    if (!confirm("Rotate token? The old token will stop working immediately.")) return;
    setRotating(true);
    setError("");

    try {
      const result = await apiFetch<{ name: string; token: string }>(
        `/api/agents/${encodeURIComponent(name!)}/rotate-token`,
        "POST"
      );
      setRotatedToken(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rotate token");
    } finally {
      setRotating(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (!agent) return <p className="error">{error || "Agent not found"}</p>;

  return (
    <div>
      <div className="page-header">
        <h2>Edit: {agent.name}</h2>
        <Link to="/agents" className="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </Link>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="section">
        <h3>Token</h3>
        {rotatedToken ? (
          <TokenDisplay token={rotatedToken} isNew />
        ) : (
          <div className="token-row">
            <TokenDisplay token={agent.token} />
            <button
              className="btn-small"
              onClick={handleRotateToken}
              disabled={rotating}
            >
              {rotating ? "Rotating..." : "Rotate Token"}
            </button>
          </div>
        )}
      </div>

      <div className="section">
        <h3>Configuration</h3>
        <AgentForm
          initialName={agent.name}
          initialServices={agent.allowed_services}
          initialRateLimit={agent.rate_limit_per_minute}
          initialIps={agent.allowed_ips}
          nameEditable={false}
          onSubmit={handleUpdate}
          submitLabel="Save Changes"
          loading={saving}
        />
      </div>
    </div>
  );
}
