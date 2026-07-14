import { ProviderId } from '../db/types';
import { AppError } from '../http/errors';

export interface CompleteOptions {
  system: string;
  user: string;
  maxTokens?: number;
  // optional per-call model override
  model?: string;
  // request strict JSON output (OpenAI-compatible response_format json_object)
  json?: boolean;
  // sampling temperature (lower = more faithful/deterministic)
  temperature?: number;
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Shared helper for OpenAI-compatible providers (Groq, OpenAI/ChatGPT, custom models).
export async function openAiCompatibleComplete(
  baseUrl: string,
  apiKey: string,
  model: string,
  opts: CompleteOptions,
): Promise<string> {
  const body = JSON.stringify({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
  });

  let res: Response;
  // Retry transient upstream errors (502/503/504 — gateway/timeout blips) once.
  for (let attempt = 0; ; attempt++) {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body,
    });
    if (res.ok || res.status < 500 || attempt >= 1) break;
    await sleep(2000);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // Surface the provider's own message (e.g. rate-limit / too-large) to the client.
    let message = `Provider request failed (${res.status})`;
    let code = 'PROVIDER_ERROR';
    try {
      const j = JSON.parse(detail) as { error?: { message?: string; code?: string } };
      if (j.error?.message) message = j.error.message;
      if (j.error?.code) code = j.error.code;
    } catch {
      if (detail) message += `: ${detail.slice(0, 300)}`;
    }
    // Map upstream status: rate-limit / too-large → 429, other 4xx → 400, else 502.
    const status =
      res.status === 429 || res.status === 413 ? 429 : res.status >= 400 && res.status < 500 ? 400 : 502;
    throw new AppError(status, message, code);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Provider returned an empty response');
  return text;
}
