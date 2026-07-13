import { ProviderId } from '../db/types';

export interface CompleteOptions {
  system: string;
  user: string;
  maxTokens?: number;
  // optional per-call model override
  model?: string;
}

// Uniform interface every AI provider implements.
export interface AIProvider {
  readonly id: ProviderId;
  readonly label: string;
  // The model used when the user hasn't overridden it.
  readonly defaultModel: string;
  // Perform a single completion and return the assistant's text.
  complete(apiKey: string, opts: CompleteOptions): Promise<string>;
}

// Shared helper for the two OpenAI-compatible providers (Grok + OpenAI/ChatGPT).
export async function openAiCompatibleComplete(
  baseUrl: string,
  apiKey: string,
  model: string,
  opts: CompleteOptions,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Provider request failed (${res.status}): ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Provider returned an empty response');
  return text;
}
