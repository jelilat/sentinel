import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api";
import ServiceForm, { type ServiceFormData } from "../components/ServiceForm";

export default function AddServicePage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(data: ServiceFormData) {
    setError("");
    setLoading(true);

    try {
      await apiFetch("/api/services", "POST", data);
      navigate("/services");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create service");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Add Service</h2>
        <Link to="/services" className="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      <ServiceForm
        onSubmit={handleSubmit}
        submitLabel="Create Service"
        loading={loading}
      />
    </div>
  );
}
