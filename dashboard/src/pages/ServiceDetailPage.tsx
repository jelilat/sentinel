import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api";
import ServiceForm, { type ServiceFormData } from "../components/ServiceForm";
import type { Service } from "../types";

export default function ServiceDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Service[]>("/api/services")
      .then((services) => {
        const found = services.find((s) => s.name === name);
        if (!found) {
          setError(`Service "${name}" not found`);
          return;
        }
        setService(found);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load service")
      )
      .finally(() => setLoading(false));
  }, [name]);

  async function handleUpdate(data: ServiceFormData) {
    setError("");
    setSaving(true);

    try {
      const { name: _, ...updates } = data;
      await apiFetch(
        `/api/services/${encodeURIComponent(name!)}`,
        "PATCH",
        updates
      );
      navigate("/services");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update service");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (!service) return <p className="error">{error || "Service not found"}</p>;

  return (
    <div>
      <div className="page-header">
        <h2>Edit: {service.name}</h2>
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
        initialData={service}
        nameEditable={false}
        onSubmit={handleUpdate}
        submitLabel="Save Changes"
        loading={saving}
      />
    </div>
  );
}
