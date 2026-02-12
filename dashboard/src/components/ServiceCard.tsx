import { Link } from "react-router-dom";
import type { Service } from "../types";

interface Props {
  service: Service;
  onDelete: () => void;
}

export default function ServiceCard({ service, onDelete }: Props) {
  return (
    <div className="service-card">
      <h3>{service.name}</h3>
      <dl>
        <dt>Base URL</dt>
        <dd>{service.base_url}</dd>

        <dt>Allowed Hosts</dt>
        <dd>{service.allowed_hosts.join(", ")}</dd>

        <dt>Auth Type</dt>
        <dd>{service.auth.type}</dd>

        {service.auth.type === "header" && service.auth.header_name && (
          <>
            <dt>Header</dt>
            <dd>{service.auth.header_name}</dd>
          </>
        )}

        {service.auth.type === "query" && service.auth.query_param && (
          <>
            <dt>Query Param</dt>
            <dd>{service.auth.query_param}</dd>
          </>
        )}

        <dt>Template</dt>
        <dd>{service.auth.template}</dd>

        <dt>Secret Env</dt>
        <dd>{service.secret_env}</dd>

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
      <div className="card-actions">
        <Link to={`/services/${encodeURIComponent(service.name)}`} className="btn-small">
          Edit
        </Link>
        <button className="btn-small btn-danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
