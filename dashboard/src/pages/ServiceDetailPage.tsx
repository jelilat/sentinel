import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
      <h2>Edit: {service.name}</h2>
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
