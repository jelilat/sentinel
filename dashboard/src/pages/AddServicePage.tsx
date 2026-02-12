import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
      <h2>Add Service</h2>
      {error && <p className="error">{error}</p>}
      <ServiceForm
        onSubmit={handleSubmit}
        submitLabel="Create Service"
        loading={loading}
      />
    </div>
  );
}
