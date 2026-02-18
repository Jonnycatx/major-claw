export interface ModelRequest {
  prompt: string;
  system?: string;
  temperature?: number;
}

export interface ModelResponse {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

export interface ProviderAdapter {
  provider: "local" | "anthropic" | "google" | "xai" | "openai";
  invoke(model: string, request: ModelRequest): Promise<ModelResponse>;
}

export class StubProviderAdapter implements ProviderAdapter {
  constructor(public readonly provider: ProviderAdapter["provider"]) {}

  async invoke(model: string, request: ModelRequest): Promise<ModelResponse> {
    const tokenEstimate = Math.max(1, Math.ceil(request.prompt.length / 4));
    return {
      text: `[${this.provider}:${model}] ${request.prompt.slice(0, 120)}`,
      promptTokens: tokenEstimate,
      completionTokens: Math.ceil(tokenEstimate / 2)
    };
  }
}
