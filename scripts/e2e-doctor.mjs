import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

function log(line) {
  // eslint-disable-next-line no-console
  console.log(line);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkSocketBind() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", (error) => reject(error));
    server.listen(0, "127.0.0.1", () => {
      server.close(() => resolve());
    });
  });
}

async function waitReady(baseUrl, attempts = 70) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/ready`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep retrying.
    }
    await sleep(150);
  }
  throw new Error(`gateway not ready at ${baseUrl}`);
}

async function checkGatewayBoot() {
  const tmp = mkdtempSync(join(tmpdir(), "majorclaw-e2e-doctor-"));
  const port = 5800 + Math.floor(Math.random() * 500);
  const token = `doctor-${Date.now()}`;
  const dbPath = join(tmp, "doctor.db");
  const pidPath = join(tmp, "doctor.pid");
  const child = spawn("node", ["--import", "tsx", "src/server.ts"], {
    cwd: join(process.cwd(), "services", "gateway"),
    env: {
      ...process.env,
      MAJORCLAW_GATEWAY_PORT: String(port),
      MAJORCLAW_GATEWAY_SESSION_TOKEN: token,
      MAJORCLAW_DB_PATH: dbPath,
      MAJORCLAW_GATEWAY_PID_FILE: pidPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitReady(`http://127.0.0.1:${port}`);
  } catch (error) {
    const detail = stderr.trim();
    if (detail) {
      throw new Error(`${error instanceof Error ? error.message : "gateway boot failed"}\n${detail}`);
    }
    throw error;
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      child.once("exit", () => resolve());
      setTimeout(() => resolve(), 2500);
    });
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function run() {
  const checks = [];

  const pushResult = (name, ok, hint = "") => {
    checks.push({ name, ok, hint });
    log(`${ok ? "[OK] " : "[FAIL]"}${name}`);
    if (!ok && hint) {
      log(`       ${hint}`);
    }
  };

  log("Major Claw E2E Doctor");
  log("----------------------");
  log(`Node: ${process.version}`);

  try {
    // eslint-disable-next-line import/no-unresolved, global-require
    await import("@playwright/test");
    pushResult("Playwright dependency installed", true);
  } catch {
    pushResult(
      "Playwright dependency installed",
      false,
      "Run: pnpm add -Dw @playwright/test"
    );
  }

  try {
    await checkSocketBind();
    pushResult("Local socket bind allowed (127.0.0.1)", true);
  } catch (error) {
    pushResult(
      "Local socket bind allowed (127.0.0.1)",
      false,
      `Environment blocked local sockets: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }

  try {
    await checkGatewayBoot();
    pushResult("Gateway can boot with real SQLite", true);
  } catch (error) {
    pushResult(
      "Gateway can boot with real SQLite",
      false,
      `Fix gateway startup before strict E2E: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }

  const failed = checks.filter((item) => !item.ok);
  log("");
  if (failed.length === 0) {
    log("Doctor result: PASS");
    log("You can run strict critical suite:");
    log("  E2E_REQUIRE_RUNTIME=true pnpm e2e:critical");
    process.exit(0);
  }

  log(`Doctor result: FAIL (${failed.length} check${failed.length === 1 ? "" : "s"})`);
  log("Resolve failures, then re-run:");
  log("  pnpm e2e:doctor");
  process.exit(1);
}

void run();

