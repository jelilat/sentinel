import crypto from "crypto";

/**
 * Generate a new agent token: "agt_" + 24 random bytes as hex (48 hex chars).
 */
export function generateToken(): string {
  return "agt_" + crypto.randomBytes(24).toString("hex");
}

/**
 * Check whether a string matches the expected token format.
 */
export function isValidTokenFormat(token: string): boolean {
  return /^agt_[0-9a-f]{48}$/.test(token);
}
