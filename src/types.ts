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
  allowed_ips?: string[];
  allowed_origins?: string[];
}

/** Top-level YAML structure. */
export interface ServicesFile {
  services: Record<string, ServiceConfig>;
  allowed_ips?: string[];
  allowed_origins?: string[];
}

/** Global config fields extracted from the top-level YAML. */
export interface GlobalConfig {
  allowed_ips?: string[];
  allowed_origins?: string[];
}

/** The JSON body agents send to POST /v1/proxy/:service. */
export interface ProxyRequestBody {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/** A single agent definition from agents.yaml. */
export interface AgentConfig {
  token: string;                  // must start with "agt_"
  allowed_services: string[];     // non-empty, must reference real services
  rate_limit_per_minute?: number;
  allowed_ips?: string[];
}

/** Top-level agents.yaml structure. */
export interface AgentsFile {
  agents: Record<string, AgentConfig>;
}

/** Resolved agent identity attached to a request. */
export interface ResolvedAgent {
  name: string;
  config: AgentConfig;
}
