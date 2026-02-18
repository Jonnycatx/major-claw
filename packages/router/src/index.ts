import type { UsageReport } from "@majorclaw/shared-types";
import type { ModelRequest, ModelResponse, ProviderAdapter } from "./providers.js";
export { StubProviderAdapter, type ModelRequest, type ModelResponse, type ProviderAdapter } from "./providers.js";

export interface ModelBinding {
  agentId: string;
  primary: string;
  fallbackChain: string[];
  provider: "local" | "anthropic" | "google" | "xai" | "openai";
}

export interface RouteResult {
  model: string;
  provider: ModelBinding["provider"];
}

export class ModelRouter {
  private readonly bindings = new Map<string, ModelBinding>();
  private readonly unavailableModels = new Set<string>();
  private readonly adapters = new Map<ModelBinding["provider"], ProviderAdapter>();

  setBinding(binding: ModelBinding): void {
    this.bindings.set(binding.agentId, binding);
  }

  markUnavailable(model: string): void {
    this.unavailableModels.add(model);
  }

  clearUnavailable(model: string): void {
    this.unavailableModels.delete(model);
  }

  registerAdapter(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  route(agentId: string): RouteResult {
    const binding = this.bindings.get(agentId);
    if (!binding) {
      throw new Error(`No model binding found for agent ${agentId}`);
    }

    const candidates = [binding.primary, ...binding.fallbackChain];
    const selected = candidates.find((model) => !this.unavailableModels.has(model));
    if (!selected) {
      throw new Error(`No available model for agent ${agentId}`);
    }

    return { model: selected, provider: binding.provider };
  }

  async invokeWithFallback(agentId: string, request: ModelRequest): Promise<ModelResponse> {
    const binding = this.bindings.get(agentId);
    if (!binding) {
      throw new Error(`No model binding found for agent ${agentId}`);
    }
    const adapter = this.adapters.get(binding.provider);
    if (!adapter) {
      throw new Error(`No adapter registered for provider ${binding.provider}`);
    }

    const candidates = [binding.primary, ...binding.fallbackChain];
    let lastError: unknown;
    for (const model of candidates) {
      if (this.unavailableModels.has(model)) {
        continue;
      }
      try {
        return await adapter.invoke(model, request);
      } catch (error) {
        lastError = error;
        this.markUnavailable(model);
      }
    }

    throw new Error(`All candidates failed for ${agentId}: ${String(lastError)}`);
  }
}

export class CostTracker {
  private reports: UsageReport[] = [];

  append(report: UsageReport): void {
    this.reports.push(report);
  }

  totalsByAgent(): Record<string, number> {
    return this.reports.reduce<Record<string, number>>((acc, report) => {
      acc[report.agentId] = (acc[report.agentId] ?? 0) + report.costUsd;
      return acc;
    }, {});
  }

  totalsByModel(): Record<string, number> {
    return this.reports.reduce<Record<string, number>>((acc, report) => {
      acc[report.model] = (acc[report.model] ?? 0) + report.costUsd;
      return acc;
    }, {});
  }
}
