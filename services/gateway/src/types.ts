import type { GatewayEnvelope } from "@majorclaw/shared-types";

export interface GatewayEvent<TPayload = unknown> extends GatewayEnvelope<TPayload> {}

export interface GatewayCommand<TPayload = unknown> {
  type: string;
  requestId: string;
  payload: TPayload;
}

export interface InstanceHealth {
  connected: boolean;
  lastHeartbeatAt: string | null;
  latencyMs: number | null;
  errorRatePct: number;
}
