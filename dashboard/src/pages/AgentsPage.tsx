import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import TokenDisplay from "../components/TokenDisplay";
import type { Agent } from "../types";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      const data = await apiFetch<Agent[]>("/api/agents");
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete agent "${name}"?`)) return;
    try {
      await apiFetch(`/api/agents/${encodeURIComponent(name)}`, "DELETE");
      setAgents((prev) => prev.filter((a) => a.name !== name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
    }
  }

  if (loading) return <p>Loading agents...</p>;

  return (
    <div>
      <div className="page-header">
        <h2>Agents</h2>
        <Link to="/agents/new" className="btn">Add Agent</Link>
      </div>

      {error && <p className="error">{error}</p>}

      {agents.length === 0 ? (
        <p className="empty">No agents configured. <Link to="/agents/new">Add one</Link>.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Token</th>
                <th>Services</th>
                <th>Rate Limit</th>
                <th>Allowed IPs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.name}>
                  <td>
                    <Link to={`/agents/${encodeURIComponent(agent.name)}`}>
                      {agent.name}
                    </Link>
                  </td>
                  <td><TokenDisplay token={agent.token} /></td>
                  <td>{agent.allowed_services.join(", ")}</td>
                  <td>{agent.rate_limit_per_minute ? `${agent.rate_limit_per_minute}/min` : "\u2014"}</td>
                  <td>{agent.allowed_ips?.join(", ") || "\u2014"}</td>
                  <td>
                    <button
                      className="btn-small btn-danger"
                      onClick={() => handleDelete(agent.name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
