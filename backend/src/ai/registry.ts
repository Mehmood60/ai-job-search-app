import { ProviderId, Settings } from '../db/types';
import { decryptSecret } from '../crypto/secrets';
import { AppError } from '../http/errors';
import { AIProvider, CompleteOptions } from './provider';
import { claudeProvider } from './claude';
import { grokProvider } from './grok';
import { openaiProvider } from './openai';

export const PROVIDERS: Record<ProviderId, AIProvider> = {
  grok: grokProvider,
  openai: openaiProvider,
  claude: claudeProvider,
};

export const PROVIDER_LIST: AIProvider[] = [grokProvider, openaiProvider, claudeProvider];

interface ResolvedProvider {
  provider: AIProvider;
  key: string; // decrypted
}

// Decide the primary provider (the user's active choice, if it has a key) and the
// fallback (Grok is the default secondary; otherwise any other keyed provider).
export function resolveProviders(settings: Settings): {
  primary: ResolvedProvider | null;
  fallback: ResolvedProvider | null;
} {
  const keyed = (id: ProviderId): ResolvedProvider | null => {
    const enc = settings.apiKeys[id];
    if (!enc) return null;
    const key = decryptSecret(enc);
    if (!key) return null;
    return { provider: PROVIDERS[id], key };
  };

  const active = keyed(settings.activeProvider);

  // Fallback preference: Grok first (the free default), then any other keyed provider
  // that isn't the primary.
  const order: ProviderId[] = ['grok', 'openai', 'claude'];
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
      'No AI provider configured. Add an API key in Settings (Grok, ChatGPT, or Claude).',
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
