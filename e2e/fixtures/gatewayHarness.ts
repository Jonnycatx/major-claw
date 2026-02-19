import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitReady(baseUrl: string, attempts = 80): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/ready`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until ready.
    }
    await sleep(150);
  }
  throw new Error(`gateway did not become ready (${baseUrl})`);
}

export class GatewayHarness {
  readonly port = 5100 + Math.floor(Math.random() * 700);
  readonly token = `e2e-token-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  readonly baseUrl = `http://127.0.0.1:${this.port}`;
  readonly tempDir = mkdtempSync(join(tmpdir(), "majorclaw-e2e-"));
  readonly dbPath = join(this.tempDir, "app.db");
  readonly pidPath = join(this.tempDir, "gateway.pid");

  private child: ChildProcessWithoutNullStreams | null = null;
  private stderr = "";

  async start(): Promise<void> {
    const gatewayCwd = join(process.cwd(), "services", "gateway");
    this.child = spawn("node", ["--import", "tsx", "src/server.ts"], {
      cwd: gatewayCwd,
      env: {
        ...process.env,
        MAJORCLAW_GATEWAY_PORT: String(this.port),
        MAJORCLAW_GATEWAY_SESSION_TOKEN: this.token,
        MAJORCLAW_DB_PATH: this.dbPath,
        MAJORCLAW_GATEWAY_PID_FILE: this.pidPath
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.child.stderr.on("data", (chunk) => {
      this.stderr += chunk.toString();
    });
    try {
      await waitReady(this.baseUrl);
    } catch (error) {
      const stderr = this.stderr.trim();
      if (stderr.includes("EPERM: operation not permitted")) {
        throw new Error("E2E_GATEWAY_BIND_EPERM");
      }
      throw new Error(
        `gateway did not become ready (${this.baseUrl})${stderr ? `\n--- stderr ---\n${stderr}` : ""}${
          error instanceof Error ? `\n--- error ---\n${error.message}` : ""
        }`
      );
    }
  }

  async stop(): Promise<void> {
    if (this.child) {
      this.child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        this.child?.once("exit", () => resolve());
        setTimeout(() => resolve(), 4000);
      });
      this.child = null;
    }
    rmSync(this.tempDir, { recursive: true, force: true });
  }

  async request<T = unknown>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
    const headers = new Headers(init?.headers);
    headers.set("x-session-token", this.token);
    if (!headers.has("content-type") && init?.body) {
      headers.set("content-type", "application/json");
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers
    });
    const body = (await response.json()) as T;
    return { status: response.status, body };
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getStderr(): string {
    return this.stderr;
  }
}

