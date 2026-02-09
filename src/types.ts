/** Auth injection via HTTP header. */
export interface HeaderAuth {
  type: "header";
  header_name: string;
  template: string; // e.g. "Bearer ${SECRET}"
}

/** Auth injection via URL query parameter. */
export interface QueryAuth {
  type: "query";
  query_param: string;
  template: string; // e.g. "${SECRET}"
}

export type AuthConfig = HeaderAuth | QueryAuth;

/** A single service definition from services.yaml. */
export interface ServiceConfig {
  base_url: string;
  allowed_hosts: string[];
  auth: AuthConfig;
  secret_env: string;
  allowed_methods?: string[];
  allowed_path_prefixes?: string[];
  timeout_ms?: number;
  rate_limit_per_minute?: number;
}

/** Top-level YAML structure. */
export interface ServicesFile {
  services: Record<string, ServiceConfig>;
}

/** The JSON body agents send to POST /v1/proxy/:service. */
export interface ProxyRequestBody {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}
