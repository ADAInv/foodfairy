import { readFileSync } from "node:fs";
// In production, secrets are files in /run/secrets.
// On your laptop, the same value comes from an environment variable:
// "smtp-pass" -> SMTP_PASS, "session-key" -> SESSION_KEY.
export function getSecret(name: string): string {
try {
return readFileSync(`/run/secrets/${name}`, "utf8").trim();
} catch {
const envName = name.toUpperCase().replace(/-/g, "_");
const value = process.env[envName];
if (value) return value;
throw new Error(`Missing secret: ${name}`);
}
}
