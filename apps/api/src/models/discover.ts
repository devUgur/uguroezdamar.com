import Anthropic from "@anthropic-ai/sdk";

/** Model ids that are certainly not chat models; the picker would only fill up with them. */
const NOT_CHAT = /(embed|embedding|whisper|tts|transcribe|audio|realtime|dall-e|image|moderation|rerank|vision-preview|search-preview|sora|veo|imagen|lyria|aqa)/i;
const MAX_MODELS = 400;

export interface DiscoveryTarget {
  kind: "openai-compatible" | "anthropic";
  baseUrl: string;
  apiKey: string;
}

/**
 * Asks a provider which models this key may use. Doubles as the key test: a wrong key fails here, before an agent
 * runs into it. OpenAI-compatible providers answer GET {baseUrl}/models; Anthropic is asked through its SDK.
 */
export async function discoverModels(target: DiscoveryTarget): Promise<string[]> {
  const ids: string[] = [];
  if (target.kind === "anthropic") {
    const client = new Anthropic({ apiKey: target.apiKey, maxRetries: 0, timeout: 20_000 });
    for await (const model of client.models.list({ limit: 100 })) {
      ids.push(model.id);
      if (ids.length >= MAX_MODELS) break;
    }
  } else {
    const response = await fetch(`${target.baseUrl.replace(/\/+$/, "")}/models`, {
      headers: { authorization: `Bearer ${target.apiKey}`, accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 300)}`);
    const body = (await response.json()) as { data?: { id?: string }[]; models?: { id?: string; name?: string }[] };
    for (const entry of body.data ?? body.models ?? []) {
      const id = (entry as { id?: string }).id ?? (entry as { name?: string }).name;
      // Gemini lists "models/gemini-…"; the chat endpoint wants the bare id.
      if (id) ids.push(id.replace(/^models\//, ""));
    }
  }
  return [...new Set(ids)].filter((id) => !NOT_CHAT.test(id)).sort().slice(0, MAX_MODELS);
}
