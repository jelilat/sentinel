import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
            Back to Agents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Add Agent</h2>
      {error && <p className="error">{error}</p>}
      <AgentForm onSubmit={handleSubmit} submitLabel="Create Agent" loading={loading} />
    </div>
  );
}
