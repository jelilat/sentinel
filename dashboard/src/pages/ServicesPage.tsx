import { useState, useEffect } from "react";
import { apiFetch } from "../api";
import ServiceCard from "../components/ServiceCard";
import type { Service } from "../types";

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Service[]>("/api/services")
      .then(setServices)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load services"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading services...</p>;

  return (
    <div>
      <h2>Services</h2>
      {error && <p className="error">{error}</p>}
      {services.length === 0 ? (
        <p className="empty">No services configured.</p>
      ) : (
        <div className="service-grid">
          {services.map((svc) => (
            <ServiceCard key={svc.name} service={svc} />
          ))}
        </div>
      )}
    </div>
  );
}
