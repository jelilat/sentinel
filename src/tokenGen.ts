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

/**
 * Mask a token for display: show first 8 chars + "..." + last 4 chars.
 */
export function maskToken(token: string): string {
  if (token.length <= 14) return token.slice(0, 6) + "...";
  return token.slice(0, 8) + "..." + token.slice(-4);
}
