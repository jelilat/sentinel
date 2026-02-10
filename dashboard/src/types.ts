export interface Agent {
  name: string;
  token: string;
  allowed_services: string[];
  rate_limit_per_minute?: number;
  allowed_ips?: string[];
}

export interface NewAgent extends Agent {
  // token is the full token (shown once after creation/rotation)
}

export interface Service {
  name: string;
  base_url: string;
  allowed_hosts: string[];
  auth_type: string;
  allowed_methods?: string[];
  allowed_path_prefixes?: string[];
  timeout_ms?: number;
  rate_limit_per_minute?: number;
}

export interface HealthInfo {
  status: string;
  services: string[];
  agent_count: number;
  uptime_seconds: number;
}
