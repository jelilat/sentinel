import { useState, type FormEvent } from "react";
import type { Service } from "../types";

export interface ServiceFormData {
  name: string;
  base_url: string;
  allowed_hosts: string[];
  auth: {
    type: "header" | "query";
    header_name?: string;
    query_param?: string;
    template: string;
  };
  secret_env: string;
  allowed_methods?: string[];
  allowed_path_prefixes?: string[];
  timeout_ms?: number;
  rate_limit_per_minute?: number;
}

interface Props {
  initialData?: Service;
  nameEditable?: boolean;
  onSubmit: (data: ServiceFormData) => void;
  submitLabel: string;
  loading?: boolean;
}

export default function ServiceForm({
  initialData,
  nameEditable = true,
  onSubmit,
  submitLabel,
  loading,
}: Props) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(initialData?.base_url ?? "https://");
  const [allowedHosts, setAllowedHosts] = useState(
    initialData?.allowed_hosts?.join("\n") ?? ""
  );
  const [authType, setAuthType] = useState<"header" | "query">(
    initialData?.auth?.type ?? "header"
  );
  const [headerName, setHeaderName] = useState(
    initialData?.auth?.header_name ?? "Authorization"
  );
  const [queryParam, setQueryParam] = useState(
    initialData?.auth?.query_param ?? ""
  );
  const [template, setTemplate] = useState(
    initialData?.auth?.template ?? "Bearer ${SECRET}"
  );
  const [secretEnv, setSecretEnv] = useState(initialData?.secret_env ?? "");
  const [allowedMethods, setAllowedMethods] = useState(
    initialData?.allowed_methods?.join(", ") ?? ""
  );
  const [allowedPathPrefixes, setAllowedPathPrefixes] = useState(
    initialData?.allowed_path_prefixes?.join("\n") ?? ""
  );
  const [timeoutMs, setTimeoutMs] = useState(
    initialData?.timeout_ms?.toString() ?? ""
  );
  const [rateLimit, setRateLimit] = useState(
    initialData?.rate_limit_per_minute?.toString() ?? ""
  );

  function handleBaseUrlBlur() {
    if (!allowedHosts && baseUrl.startsWith("https://")) {
      try {
        const host = new URL(baseUrl).hostname;
        if (host) setAllowedHosts(host);
      } catch {
        // ignore invalid URL
      }
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const hosts = allowedHosts
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const data: ServiceFormData = {
      name,
      base_url: baseUrl,
      allowed_hosts: hosts,
      auth:
        authType === "header"
          ? { type: "header", header_name: headerName, template }
          : { type: "query", query_param: queryParam, template },
      secret_env: secretEnv,
    };

    const methods = allowedMethods
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (methods.length > 0) data.allowed_methods = methods;

    const prefixes = allowedPathPrefixes
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (prefixes.length > 0) data.allowed_path_prefixes = prefixes;

    if (timeoutMs) data.timeout_ms = parseInt(timeoutMs, 10);
    if (rateLimit) data.rate_limit_per_minute = parseInt(rateLimit, 10);

    onSubmit(data);
  }

  return (
    <form className="agent-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="svc-name">Name</label>
        <input
          id="svc-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!nameEditable}
          required
          placeholder="openai"
        />
      </div>

      <div className="form-group">
        <label htmlFor="svc-base-url">Base URL</label>
        <input
          id="svc-base-url"
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          onBlur={handleBaseUrlBlur}
          required
          placeholder="https://api.openai.com"
        />
      </div>

      <div className="form-group">
        <label htmlFor="svc-hosts">Allowed Hosts (one per line)</label>
        <textarea
          id="svc-hosts"
          value={allowedHosts}
          onChange={(e) => setAllowedHosts(e.target.value)}
          rows={2}
          required
          placeholder="api.openai.com"
        />
      </div>

      <div className="form-group">
        <label htmlFor="svc-secret-env">Secret Env Variable</label>
        <input
          id="svc-secret-env"
          type="text"
          value={secretEnv}
          onChange={(e) => setSecretEnv(e.target.value)}
          required
          placeholder="OPENAI_API_KEY"
        />
      </div>

      <div className="form-group">
        <label>Auth Type</label>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="radio"
              name="auth-type"
              value="header"
              checked={authType === "header"}
              onChange={() => setAuthType("header")}
            />
            Header
          </label>
          <label className="checkbox-label">
            <input
              type="radio"
              name="auth-type"
              value="query"
              checked={authType === "query"}
              onChange={() => setAuthType("query")}
            />
            Query Parameter
          </label>
        </div>
      </div>

      {authType === "header" ? (
        <div className="form-group">
          <label htmlFor="svc-header-name">Header Name</label>
          <input
            id="svc-header-name"
            type="text"
            value={headerName}
            onChange={(e) => setHeaderName(e.target.value)}
            required
            placeholder="Authorization"
          />
        </div>
      ) : (
        <div className="form-group">
          <label htmlFor="svc-query-param">Query Parameter</label>
          <input
            id="svc-query-param"
            type="text"
            value={queryParam}
            onChange={(e) => setQueryParam(e.target.value)}
            required
            placeholder="api_key"
          />
        </div>
      )}

      <div className="form-group">
        <label htmlFor="svc-template">Auth Template</label>
        <input
          id="svc-template"
          type="text"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          required
          placeholder="Bearer ${SECRET}"
        />
        <p className="hint">Must contain {"${SECRET}"} placeholder</p>
      </div>

      <div className="form-group">
        <label htmlFor="svc-methods">Allowed Methods (comma-separated)</label>
        <input
          id="svc-methods"
          type="text"
          value={allowedMethods}
          onChange={(e) => setAllowedMethods(e.target.value)}
          placeholder="GET, POST (optional)"
        />
      </div>

      <div className="form-group">
        <label htmlFor="svc-prefixes">Allowed Path Prefixes (one per line)</label>
        <textarea
          id="svc-prefixes"
          value={allowedPathPrefixes}
          onChange={(e) => setAllowedPathPrefixes(e.target.value)}
          rows={2}
          placeholder="/v1/&#10;/v2/ (optional)"
        />
      </div>

      <div className="form-group">
        <label htmlFor="svc-timeout">Timeout (ms)</label>
        <input
          id="svc-timeout"
          type="number"
          min="1"
          value={timeoutMs}
          onChange={(e) => setTimeoutMs(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="form-group">
        <label htmlFor="svc-rate-limit">Rate Limit (requests/min)</label>
        <input
          id="svc-rate-limit"
          type="number"
          min="1"
          value={rateLimit}
          onChange={(e) => setRateLimit(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
