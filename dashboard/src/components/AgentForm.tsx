import { useState, useEffect, type FormEvent } from "react";
import { apiFetch } from "../api";
import type { Service } from "../types";

interface Props {
  initialName?: string;
  initialServices?: string[];
  initialRateLimit?: number;
  initialIps?: string[];
  nameEditable?: boolean;
  onSubmit: (data: {
    name: string;
    allowed_services: string[];
    rate_limit_per_minute?: number;
    allowed_ips?: string[];
  }) => void;
  submitLabel: string;
  loading?: boolean;
}

export default function AgentForm({
  initialName = "",
  initialServices = [],
  initialRateLimit,
  initialIps = [],
  nameEditable = true,
  onSubmit,
  submitLabel,
  loading,
}: Props) {
  const [name, setName] = useState(initialName);
  const [selectedServices, setSelectedServices] = useState<string[]>(initialServices);
  const [rateLimit, setRateLimit] = useState(initialRateLimit?.toString() ?? "");
  const [ips, setIps] = useState(initialIps.join("\n"));
  const [availableServices, setAvailableServices] = useState<Service[]>([]);

  useEffect(() => {
    apiFetch<Service[]>("/api/services").then(setAvailableServices).catch(() => {});
  }, []);

  function toggleService(svc: string) {
    setSelectedServices((prev) =>
      prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const data: {
      name: string;
      allowed_services: string[];
      rate_limit_per_minute?: number;
      allowed_ips?: string[];
    } = {
      name,
      allowed_services: selectedServices,
    };

    if (rateLimit) {
      data.rate_limit_per_minute = parseInt(rateLimit, 10);
    }

    const ipList = ips
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ipList.length > 0) {
      data.allowed_ips = ipList;
    }

    onSubmit(data);
  }

  return (
    <form className="agent-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="agent-name">Name</label>
        <input
          id="agent-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!nameEditable}
          required
          placeholder="my-agent"
        />
      </div>

      <div className="form-group">
        <label>Services</label>
        <div className="checkbox-group">
          {availableServices.map((svc) => (
            <label key={svc.name} className="checkbox-label">
              <input
                type="checkbox"
                checked={selectedServices.includes(svc.name)}
                onChange={() => toggleService(svc.name)}
              />
              {svc.name}
            </label>
          ))}
        </div>
        {availableServices.length === 0 && (
          <p className="hint">Loading services...</p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="rate-limit">Rate limit (requests/min)</label>
        <input
          id="rate-limit"
          type="number"
          min="1"
          value={rateLimit}
          onChange={(e) => setRateLimit(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="form-group">
        <label htmlFor="allowed-ips">Allowed IPs (one per line)</label>
        <textarea
          id="allowed-ips"
          value={ips}
          onChange={(e) => setIps(e.target.value)}
          rows={3}
          placeholder="e.g. 10.0.0.1&#10;192.168.1.0/24"
        />
      </div>

      <button type="submit" disabled={loading || selectedServices.length === 0}>
        {loading ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
