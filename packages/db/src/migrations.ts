import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export interface MigrationBundle {
  schemaSql: string;
  seedSql: string;
}

export function loadMigrationBundle(): MigrationBundle {
  return {
    schemaSql: readFileSync(join(here, "schema.sql"), "utf8"),
    seedSql: readFileSync(join(here, "seed.sql"), "utf8")
  };
}
