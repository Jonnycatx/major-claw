import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import type { GatewayRuntime } from "./index.js";

const DEFAULT_PID_FILE = resolve(homedir(), ".major-claw", "run", "gateway.pid");

type PidRecord = {
  pid: number;
  startedAt: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export class GatewayLifecycle {
  private inFlightRequests = 0;
  private shuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  constructor(
    private readonly server: Server,
    private readonly runtime: GatewayRuntime,
    private readonly pidFilePath = process.env.MAJORCLAW_GATEWAY_PID_FILE ?? DEFAULT_PID_FILE
  ) {}

  acquirePidLock(): void {
    mkdirSync(dirname(this.pidFilePath), { recursive: true });
    try {
      const existingRaw = readFileSync(this.pidFilePath, "utf8");
      const existing = JSON.parse(existingRaw) as PidRecord;
      if (Number.isFinite(existing.pid) && isProcessAlive(existing.pid)) {
        throw new Error(`gateway already running with pid ${existing.pid}`);
      }
      rmSync(this.pidFilePath, { force: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("gateway already running")) {
        throw error;
      }
      // No existing lock or stale lock. Continue.
    }

    const payload: PidRecord = {
      pid: process.pid,
      startedAt: new Date().toISOString()
    };
    writeFileSync(this.pidFilePath, JSON.stringify(payload, null, 2), "utf8");
  }

  releasePidLock(): void {
    rmSync(this.pidFilePath, { force: true });
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  trackRequestStart(_req: IncomingMessage): void {
    this.inFlightRequests += 1;
  }

  trackRequestFinish(_res: ServerResponse): void {
    this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
  }

  async requestShutdown(reason: string, actor = "system"): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }
    this.shuttingDown = true;
    this.shutdownPromise = this.performShutdown(reason, actor);
    return this.shutdownPromise;
  }

  private async performShutdown(reason: string, actor: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({ level: "info", event: "gateway_shutdown_begin", reason, actor }));
    const waitDeadline = Date.now() + 10_000;
    while (this.inFlightRequests > 0 && Date.now() < waitDeadline) {
      await sleep(100);
    }
    try {
      this.runtime.repository.flush();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          level: "error",
          event: "gateway_shutdown_flush_failed",
          message: error instanceof Error ? error.message : "unknown"
        })
      );
    }
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
    this.releasePidLock();
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({ level: "info", event: "gateway_shutdown_complete", reason, actor }));
  }
}

