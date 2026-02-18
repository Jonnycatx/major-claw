import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { OpenClawInstanceConfig } from "@majorclaw/shared-types";

export function loadInstanceRegistry(configPath = ".majorclaw.instances.json"): OpenClawInstanceConfig[] {
  const absolute = resolve(process.cwd(), configPath);
  if (!existsSync(absolute)) {
    return [];
  }
  const raw = readFileSync(absolute, "utf8");
  const parsed = JSON.parse(raw) as OpenClawInstanceConfig[];
  return parsed;
}
