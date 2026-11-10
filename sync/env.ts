// Loads .env.local for local runs. In GitHub Actions the secrets come from the workflow;
// the public project address and key come from the committed .env.production.
import { existsSync } from "node:fs";

export function loadLocalEnv(): void {
  // GitHub Actions passes unset secrets as empty strings; treat them as not set.
  for (const [name, value] of Object.entries(process.env)) {
    if (value === "") delete process.env[name];
  }
  for (const file of [".env.local", ".env", ".env.production"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

export const consoleLogger = {
  info: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
};
