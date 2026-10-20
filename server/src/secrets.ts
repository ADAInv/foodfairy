import { readFileSync } from "node:fs";
// In production, secrets are files in /run/secrets.
// On your laptop, the same value comes from an environment variable:
// "smtp-pass" -> SMTP_PASS, "session-key" -> SESSION_KEY.
function envNameFor(name: string): string {
return name.toUpperCase().replace(/-/g, "_");
}
function readSecret(name: string): string | undefined {
try {
const value = readFileSync(`/run/secrets/${name}`, "utf8").trim();
return value === "" ? undefined : value;
} catch (err) {
// Only "file not there" falls back to the environment; other errors are real problems.
if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
const value = process.env[envNameFor(name)];
return value === undefined || value === "" ? undefined : value;
}
}
/** A secret the app can't run without: stops startup with a clear message if
missing. */
export function requireSecret(name: string): string {
const value = readSecret(name);
if (value === undefined) {
throw new Error(`Missing secret "${name}": expected /run/secrets/${name}
or env ${envNameFor(name)}`);
}
return value;
}
/** A secret that may legitimately be absent, such as payment keys while
Page 19 of 66
First-Time VPS Deployment Guide
checkout is off. */
export function optionalSecret(name: string): string | undefined {
return readSecret(name);
}
