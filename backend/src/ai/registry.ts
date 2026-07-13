import { CustomProvider, ProviderId, Settings } from '../db/types';
import { decryptSecret } from '../crypto/secrets';
import { AppError } from '../http/errors';
import { AIProvider, CompleteOptions, openAiCompatibleComplete } from './provider';
import { claudeProvider } from './claude';
import { grokProvider } from './grok';
import { groqProvider } from './groq';
import { openaiProvider } from './openai';

// Built-in providers, in fallback-preference order (free ones first).
export const BUILTIN_PROVIDERS: AIProvider[] = [
  grokProvider,
  groqProvider,
  openaiProvider,
  claudeProvider,
];

export const PROVIDERS: Record<string, AIProvider> = Object.fromEntries(
  BUILTIN_PROVIDERS.map((p) => [p.id, p]),
);

// Build an AIProvider from a user-defined custom (OpenAI-compatible) config.
export function makeCustomProvider(cp: CustomProvider): AIProvider {
  return {
    id: cp.id,
    label: cp.label,
    defaultModel: cp.defaultModel,
    async complete(apiKey: string, opts: CompleteOptions) {
      return openAiCompatibleComplete(cp.baseUrl, apiKey, opts.model || cp.defaultModel, opts);
    },
  };
}

// Resolve a provider id (built-in or custom) to its AIProvider, or null if unknown.
export function getProvider(settings: Settings, id: ProviderId): AIProvider | null {
  if (PROVIDERS[id]) return PROVIDERS[id];
  const cp = settings.customProviders.find((c) => c.id === id);
  return cp ? makeCustomProvider(cp) : null;
}

// All providers available to a user: built-ins followed by their custom ones.
export function listProviders(settings: Settings): AIProvider[] {
  return [...BUILTIN_PROVIDERS, ...settings.customProviders.map(makeCustomProvider)];
}

interface ResolvedProvider {
  provider: AIProvider;
  key: string; // decrypted
}

// Decide the primary provider (the user's active choice, if it has a key) and the
// fallback (prefer the free built-ins first, then any other keyed provider).
export function resolveProviders(settings: Settings): {
  primary: ResolvedProvider | null;
  fallback: ResolvedProvider | null;
} {
  const keyed = (id: ProviderId): ResolvedProvider | null => {
    const enc = settings.apiKeys[id];
    if (!enc) return null;
    const provider = getProvider(settings, id);
    if (!provider) return null;
    const key = decryptSecret(enc);
    if (!key) return null;
    return { provider, key };
  };

  const active = keyed(settings.activeProvider);

  // Fallback preference: built-ins (free ones first) then custom providers, skipping
  // whichever is already the primary.
  const order: ProviderId[] = [
    ...BUILTIN_PROVIDERS.map((p) => p.id),
    ...settings.customProviders.map((c) => c.id),
  ];
  let fallback: ResolvedProvider | null = null;
  for (const id of order) {
    if (active && id === settings.activeProvider) continue;
    const r = keyed(id);
    if (r) {
      fallback = r;
      break;
    }
  }

  // If the active provider has no key, promote the first keyed provider to primary.
  const primary = active ?? fallback;
  if (primary && fallback && primary.provider.id === fallback.provider.id) {
    fallback = null;
  }

  return { primary, fallback };
}

// Run a completion using the primary provider, falling back to the secondary on error.
export async function completeWithSettings(
  settings: Settings,
  opts: CompleteOptions,
): Promise<{ text: string; usedProvider: ProviderId }> {
  const { primary, fallback } = resolveProviders(settings);
  if (!primary) {
    throw new AppError(
      400,
      'No AI provider configured. Add an API key in Settings (Grok, Groq, ChatGPT, Claude, or a custom model).',
      'NO_PROVIDER',
    );
  }

  const model = settings.models[primary.provider.id];
  try {
    const text = await primary.provider.complete(primary.key, { ...opts, model });
    return { text, usedProvider: primary.provider.id };
  } catch (err) {
    if (!fallback) throw err;
    // eslint-disable-next-line no-console
    console.warn(
      `Primary provider ${primary.provider.id} failed, falling back to ${fallback.provider.id}:`,
      (err as Error).message,
    );
    const fbModel = settings.models[fallback.provider.id];
    const text = await fallback.provider.complete(fallback.key, { ...opts, model: fbModel });
    return { text, usedProvider: fallback.provider.id };
  }
}
