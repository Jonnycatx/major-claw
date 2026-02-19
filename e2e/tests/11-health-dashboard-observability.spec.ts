import { test, expect } from "../fixtures/criticalTest";

type StreamMatch = {
  id: string | null;
  event: string;
  data: unknown;
};

async function waitForSseMatch(input: {
  url: string;
  token: string;
  predicate: (match: StreamMatch) => boolean;
  timeoutMs?: number;
  lastEventId?: string;
}): Promise<StreamMatch> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 8000);
  const headers: Record<string, string> = {
    "x-session-token": input.token,
    accept: "text/event-stream"
  };
  if (input.lastEventId) {
    headers["last-event-id"] = input.lastEventId;
  }
  const response = await fetch(input.url, {
    headers,
    signal: controller.signal
  });
  expect(response.ok).toBeTruthy();
  const reader = response.body?.getReader();
  if (!reader) {
    clearTimeout(timer);
    throw new Error("SSE stream body unavailable");
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let matched: StreamMatch | null = null;
  try {
    while (!matched) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const block of parts) {
        const lines = block.split("\n");
        let id: string | null = null;
        let event = "message";
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith("id:")) {
            id = line.slice(3).trim();
          } else if (line.startsWith("event:")) {
            event = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }
        const rawData = dataLines.join("\n");
        let data: unknown = rawData;
        try {
          data = JSON.parse(rawData);
        } catch {
          // Keep raw string when not JSON.
        }
        const next: StreamMatch = { id, event, data };
        if (input.predicate(next)) {
          matched = next;
          break;
        }
      }
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
    await reader.cancel().catch(() => undefined);
  }
  if (!matched) {
    throw new Error("did not receive matching SSE event before timeout");
  }
  return matched;
}

test("health telemetry endpoints + export + filters @critical", async ({ gateway }) => {
  const snapshot = await gateway.request<{ snapshot: { gatewayStatus: string; alerts: string[] } }>("/telemetry/snapshot");
  expect(snapshot.status).toBe(200);
  expect(["ok", "degraded"]).toContain(snapshot.body.snapshot.gatewayStatus);
  expect(Array.isArray(snapshot.body.snapshot.alerts)).toBeTruthy();

  await gateway.request("/vault/deposit", {
    method: "POST",
    body: JSON.stringify({
      type: "kb",
      title: "E2E Health Seed",
      markdown_summary: "Seed event for vault filter",
      importance_score: 8,
      tags: ["e2e", "health"],
      agent_id: "agent_cso",
      encrypted: false
    })
  });

  const filtered = await gateway.request<{ events: Array<{ category: string }> }>("/telemetry/events?limit=30&category=vault");
  expect(filtered.status).toBe(200);
  expect(filtered.body.events.length).toBeGreaterThan(0);
  expect(filtered.body.events.every((item) => item.category === "vault")).toBeTruthy();

  const jsonExport = await gateway.request<{ format: string; payload: string }>("/telemetry/export?format=json&limit=20");
  expect(jsonExport.status).toBe(200);
  expect(jsonExport.body.format).toBe("json");
  const parsed = JSON.parse(jsonExport.body.payload) as unknown[];
  expect(Array.isArray(parsed)).toBeTruthy();

  const csvExport = await gateway.request<{ format: string; payload: string }>("/telemetry/export?format=csv&limit=20");
  expect(csvExport.status).toBe(200);
  expect(csvExport.body.format).toBe("csv");
  expect(csvExport.body.payload.includes("createdAt,category,severity,source,message,metadata")).toBeTruthy();
});

test("health stream publishes red phone event in realtime @critical", async ({ gateway }) => {
  const streamPromise = waitForSseMatch({
    url: `${gateway.baseUrl}/telemetry/stream`,
    token: gateway.token,
    predicate: (match) => {
      if (match.event !== "telemetry" || !match.data || typeof match.data !== "object") {
        return false;
      }
      const payload = match.data as { message?: string; category?: string; severity?: string };
      return payload.message === "Red Phone activated";
    }
  });

  const redPhone = await gateway.request("/system/red-phone", {
    method: "POST",
    body: JSON.stringify({ reason: "E2E stream realtime check", actor: "qa" })
  });
  expect(redPhone.status).toBe(200);

  const match = await streamPromise;
  const payload = match.data as { category: string; severity: string; message: string };
  expect(payload.category).toBe("lifecycle");
  expect(payload.severity).toBe("critical");
});

test("health SSE supports reconnect replay via Last-Event-ID @critical", async ({ gateway }) => {
  const firstStream = waitForSseMatch({
    url: `${gateway.baseUrl}/telemetry/stream`,
    token: gateway.token,
    predicate: (match) => {
      if (match.event !== "telemetry" || !match.data || typeof match.data !== "object") {
        return false;
      }
      const payload = match.data as { message?: string };
      return payload.message === "Agent created";
    }
  });

  const created = await gateway.request("/agents/create", {
    method: "POST",
    body: JSON.stringify({
      name: "E2E Health Replay Agent",
      role: "research",
      parent_id: "agent_cso",
      model_provider: "anthropic",
      model_name: "claude-3-5-sonnet",
      temperature: 0.4,
      max_tokens: 2048
    })
  });
  expect(created.status).toBe(200);
  const firstMatch = await firstStream;
  expect(firstMatch.id).toBeTruthy();

  await gateway.request("/vault/prune", {
    method: "POST",
    body: JSON.stringify({ max_importance: 9 })
  });

  const replay = await waitForSseMatch({
    url: `${gateway.baseUrl}/telemetry/stream`,
    token: gateway.token,
    lastEventId: firstMatch.id ?? undefined,
    predicate: (match) => {
      if (match.event !== "telemetry" || !match.data || typeof match.data !== "object") {
        return false;
      }
      const payload = match.data as { message?: string };
      return payload.message === "Vault prune completed";
    }
  });
  const replayPayload = replay.data as { category: string };
  expect(replayPayload.category).toBe("vault");
});

