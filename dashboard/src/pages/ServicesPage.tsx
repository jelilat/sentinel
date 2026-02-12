import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import ServiceCard from "../components/ServiceCard";
import type { Service } from "../types";

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
  }, []);

  function loadServices() {
    setLoading(true);
    apiFetch<Service[]>("/api/services")
      .then(setServices)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load services"))
      .finally(() => setLoading(false));
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete service "${name}"?`)) return;

    try {
      await apiFetch(`/api/services/${encodeURIComponent(name)}`, "DELETE");
      setServices((prev) => prev.filter((s) => s.name !== name));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete service";
      alert(message);
    }
  }

  if (loading) return <p>Loading services...</p>;

  return (
    <div>
      <div className="page-header">
        <h2>Services</h2>
        <Link to="/services/new" className="btn">
          Add Service
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      {services.length === 0 ? (
        <p className="empty">No services configured.</p>
      ) : (
        <div className="service-grid">
          {services.map((svc) => (
            <ServiceCard
              key={svc.name}
              service={svc}
              onDelete={() => handleDelete(svc.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
