import type { ExtensionAPI, ProviderModelConfig } from "@earendil-works/pi-coding-agent";

const BASE_URL = "https://api.llmgateway.io/v1";

type InputModality = "text" | "image";
type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

interface Pricing {
  prompt?: string;
  completion?: string;
  input_cache_read?: string;
  input_cache_write?: string;
}

interface GatewayRoute {
  providerId?: string;
  pricing?: Pricing;
  reasoning?: boolean;
  reasoning_efforts?: string[];
  vision?: boolean;
  max_output?: number;
}

interface GatewayModel {
  id?: string;
  name?: string;
  family?: string;
  context_length?: number;
  max_output?: number;
  pricing?: Pricing;
  architecture?: {
    input_modalities?: string[];
  };
  providers?: GatewayRoute[];
}

interface GatewayResponse {
  data?: GatewayModel[];
}

function perMillion(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed * 1_000_000 : 0;
}

function cost(pricing: Pricing | undefined) {
  return {
    input: perMillion(pricing?.prompt),
    output: perMillion(pricing?.completion),
    cacheRead: perMillion(pricing?.input_cache_read),
    cacheWrite: perMillion(pricing?.input_cache_write),
  };
}

function inputTypes(model: GatewayModel, route?: GatewayRoute): InputModality[] {
  const modalities = model.architecture?.input_modalities ?? [];
  return route?.vision || modalities.includes("image") ? ["text", "image"] : ["text"];
}

function thinkingLevelMap(efforts: string[] | undefined): Partial<Record<ThinkingLevel, string | null>> | undefined {
  if (!efforts?.length) return undefined;

  const supported = new Set(efforts);
  const result: Partial<Record<ThinkingLevel, string | null>> = {};
  const levels: ThinkingLevel[] = ["minimal", "low", "medium", "high", "xhigh", "max"];

  result.off = supported.has("none") ? "none" : null;
  for (const level of levels) {
    result[level] = supported.has(level) ? level : null;
  }
  return result;
}

export default async function (pi: ExtensionAPI): Promise<void> {
  const response = await fetch(`${BASE_URL}/models`);
  if (!response.ok) {
    throw new Error(`LLMGateway model discovery failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as GatewayResponse;
  const discovered = new Map<string, ProviderModelConfig>();

  for (const model of payload.data ?? []) {
    if (!model.id || model.id === "auto" || model.id === "custom") continue;

    const routes = model.providers?.filter((route) => route.providerId) ?? [];
    if (routes.length === 0) {
      const family = model.family;
      const id = family ? `${family}/${model.id}` : model.id;
      discovered.set(id, {
        id,
        name: model.name ?? model.id,
        reasoning: false,
        input: inputTypes(model),
        contextWindow: model.context_length ?? 128_000,
        maxTokens: model.max_output ?? 16_384,
        cost: cost(model.pricing),
      });
      continue;
    }

    for (const route of routes) {
      const id = `${route.providerId}/${model.id}`;
      const routeName = route.providerId ?? "unknown";
      const reasoning = route.reasoning ?? false;
      discovered.set(id, {
        id,
        name: `${model.name ?? model.id} (${routeName} via LLMGateway)`,
        reasoning,
        ...(reasoning ? { thinkingLevelMap: thinkingLevelMap(route.reasoning_efforts) } : {}),
        input: inputTypes(model, route),
        contextWindow: model.context_length ?? 128_000,
        maxTokens: route.max_output ?? model.max_output ?? 16_384,
        cost: cost(route.pricing ?? model.pricing),
      });
    }
  }

  pi.registerProvider("llmgateway", {
    name: "LLMGateway",
    baseUrl: BASE_URL,
    apiKey: "!cat ~/.omp/agent/llmgateway.key",
    api: "openai-completions",
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: true,
      supportsUsageInStreaming: true,
      maxTokensField: "max_tokens",
    },
    models: [...discovered.values()],
  });
}
