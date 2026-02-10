import type { Service } from "../types";

export default function ServiceCard({ service }: { service: Service }) {
  return (
    <div className="service-card">
      <h3>{service.name}</h3>
      <dl>
        <dt>Base URL</dt>
        <dd>{service.base_url}</dd>

        <dt>Allowed Hosts</dt>
        <dd>{service.allowed_hosts.join(", ")}</dd>

        <dt>Auth Type</dt>
        <dd>{service.auth_type}</dd>

        {service.allowed_methods && (
          <>
            <dt>Methods</dt>
            <dd>{service.allowed_methods.join(", ")}</dd>
          </>
        )}

        {service.allowed_path_prefixes && (
          <>
            <dt>Path Prefixes</dt>
            <dd>{service.allowed_path_prefixes.join(", ")}</dd>
          </>
        )}

        {service.timeout_ms && (
          <>
            <dt>Timeout</dt>
            <dd>{service.timeout_ms}ms</dd>
          </>
        )}

        {service.rate_limit_per_minute && (
          <>
            <dt>Rate Limit</dt>
            <dd>{service.rate_limit_per_minute}/min</dd>
          </>
        )}
      </dl>
    </div>
  );
}
