import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api";
import AgentForm from "../components/AgentForm";
import TokenDisplay from "../components/TokenDisplay";
import type { NewAgent } from "../types";

export default function AddAgentPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [newAgent, setNewAgent] = useState<NewAgent | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(data: {
    name: string;
    allowed_services: string[];
    rate_limit_per_minute?: number;
    allowed_ips?: string[];
  }) {
    setError("");
    setLoading(true);

    try {
      const result = await apiFetch<NewAgent>("/api/agents", "POST", data);
      setNewAgent(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setLoading(false);
    }
  }

  if (newAgent) {
    return (
      <div>
        <h2>Agent Created</h2>
        <p>Agent <strong>{newAgent.name}</strong> has been created.</p>
        <TokenDisplay token={newAgent.token} isNew />
        <div className="form-actions">
          <button className="btn" onClick={() => navigate("/agents")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Agents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Add Agent</h2>
        <Link to="/agents" className="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      <AgentForm onSubmit={handleSubmit} submitLabel="Create Agent" loading={loading} />
    </div>
  );
}
