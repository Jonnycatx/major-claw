import { useEffect, useMemo, useRef, useState } from "react";
import { gatewaySessionToken, type HealthSnapshot, type HealthTelemetryEvent } from "../tauriGateway.js";

type StreamState = {
  connected: boolean;
  events: HealthTelemetryEvent[];
  latestSnapshot: HealthSnapshot | null;
};

export function useTelemetryStream(enabled: boolean, maxEvents = 160): StreamState {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<HealthTelemetryEvent[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<HealthSnapshot | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
      return;
    }
    let disposed = false;

    const start = async () => {
      const token = await gatewaySessionToken();
      if (disposed) {
        return;
      }
      const targetUrl = new URL("http://127.0.0.1:4455/telemetry/stream");
      if (token) {
        targetUrl.searchParams.set("token", token);
      }
      const source = new EventSource(targetUrl.toString());
      sourceRef.current = source;

      source.onopen = () => setConnected(true);
      source.onerror = () => setConnected(false);
      source.addEventListener("telemetry", (raw) => {
        const message = raw as MessageEvent<string>;
        try {
          const next = JSON.parse(message.data) as HealthTelemetryEvent;
          setEvents((current) => {
            if (current.some((item) => item.id === next.id)) {
              return current;
            }
            return [next, ...current].slice(0, maxEvents);
          });
        } catch {
          // Ignore malformed telemetry payloads.
        }
      });
      source.addEventListener("snapshot", (raw) => {
        const message = raw as MessageEvent<string>;
        try {
          const snapshot = JSON.parse(message.data) as HealthSnapshot;
          setLatestSnapshot(snapshot);
        } catch {
          // Ignore malformed snapshot payloads.
        }
      });
    };

    void start();

    return () => {
      disposed = true;
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
    };
  }, [enabled, maxEvents]);

  return useMemo(
    () => ({
      connected,
      events,
      latestSnapshot
    }),
    [connected, events, latestSnapshot]
  );
}

