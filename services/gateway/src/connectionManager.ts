import type { OpenClawInstanceConfig } from "@majorclaw/shared-types";
import { EventBus } from "./eventBus.js";
import type { GatewayCommand, GatewayEvent, InstanceHealth } from "./types.js";

interface InstanceState {
  retries: number;
  health: InstanceHealth;
  nextReconnectMs: number;
}

export class OpenClawConnectionManager {
  private readonly states = new Map<string, InstanceState>();

  constructor(
    private readonly eventBus: EventBus<GatewayEvent>,
    private readonly configRegistry: OpenClawInstanceConfig[]
  ) {}

  discoverInstances(): OpenClawInstanceConfig[] {
    return this.configRegistry;
  }

  connectAll(): void {
    for (const config of this.configRegistry) {
      this.states.set(config.id, {
        retries: 0,
        nextReconnectMs: 1000,
        health: { connected: true, latencyMs: null, lastHeartbeatAt: null, errorRatePct: 0 }
      });
      this.eventBus.emit({
        type: "instance.ready",
        timestamp: new Date().toISOString(),
        instanceId: config.id,
        payload: { version: "mvp", capabilities: ["delegation", "streaming"] }
      });
    }
  }

  publishHeartbeat(instanceId: string, latencyMs: number): void {
    const state = this.states.get(instanceId);
    if (!state) {
      return;
    }
    state.health.lastHeartbeatAt = new Date().toISOString();
    state.health.latencyMs = latencyMs;
    state.health.connected = true;
    state.retries = 0;
    state.nextReconnectMs = 1000;
    this.eventBus.emit({
      type: "instance.heartbeat",
      timestamp: new Date().toISOString(),
      instanceId,
      payload: state.health
    });
  }

  sendCommand(command: GatewayCommand): void {
    this.eventBus.emit({
      type: "gateway.command.sent",
      requestId: command.requestId,
      timestamp: new Date().toISOString(),
      payload: command
    });
  }

  markDisconnected(instanceId: string, reason: string): number {
    const state = this.states.get(instanceId);
    if (!state) {
      return 0;
    }
    state.health.connected = false;
    state.retries += 1;
    state.health.errorRatePct = Math.min(state.health.errorRatePct + 5, 100);
    state.nextReconnectMs = this.computeBackoffMs(state.retries);
    this.eventBus.emit({
      type: "instance.disconnected",
      timestamp: new Date().toISOString(),
      instanceId,
      payload: { reason, reconnectInMs: state.nextReconnectMs }
    });
    return state.nextReconnectMs;
  }

  detectHeartbeatTimeout(now = Date.now()): string[] {
    const offline: string[] = [];
    for (const [instanceId, state] of this.states.entries()) {
      if (!state.health.lastHeartbeatAt) {
        continue;
      }
      const ageMs = now - new Date(state.health.lastHeartbeatAt).getTime();
      if (ageMs > 30000 && state.health.connected) {
        this.markDisconnected(instanceId, "heartbeat_timeout");
        offline.push(instanceId);
      }
    }
    return offline;
  }

  getHealth(instanceId: string): InstanceHealth | undefined {
    return this.states.get(instanceId)?.health;
  }

  private computeBackoffMs(retries: number): number {
    const base = Math.min(1000 * 2 ** retries, 30000);
    const jitter = Math.floor(Math.random() * 250);
    return base + jitter;
  }

  normalizeInbound(raw: GatewayEvent): GatewayEvent {
    // Stable normalization point that guards UI and orchestration layers from upstream drift.
    const normalized: GatewayEvent = {
      type: raw.type,
      timestamp: raw.timestamp ?? new Date().toISOString(),
      payload: raw.payload
    };
    if (raw.requestId) {
      normalized.requestId = raw.requestId;
    }
    if (raw.instanceId) {
      normalized.instanceId = raw.instanceId;
    }
    return normalized;
  }
}
