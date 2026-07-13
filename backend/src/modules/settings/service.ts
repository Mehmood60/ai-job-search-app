import { randomUUID } from 'crypto';
import { getDataLayer } from '../../db';
import { CustomProvider, ProviderId, Settings } from '../../db/types';
import { decryptSecret, encryptSecret, maskSecret } from '../../crypto/secrets';
import { getProvider, listProviders, PROVIDERS } from '../../ai/registry';
import { AppError } from '../../http/errors';
import { loadSettings } from '../userData';

// A safe, client-facing view of settings — never exposes raw API keys.
export interface SettingsView {
  activeProvider: ProviderId;
  providers: {
    id: ProviderId;
    label: string;
    defaultModel: string;
    configured: boolean;
    maskedKey: string;
    model: string;
    custom: boolean;
    baseUrl?: string;
  }[];
  hasLatexCv: boolean;
  hasLatexCover: boolean;
}

export function toView(settings: Settings): SettingsView {
  const customIds = new Set(settings.customProviders.map((c) => c.id));
  const baseUrlById = new Map(settings.customProviders.map((c) => [c.id, c.baseUrl]));
  return {
    activeProvider: settings.activeProvider,
    providers: listProviders(settings).map((p) => {
      const enc = settings.apiKeys[p.id];
      const key = enc ? decryptSecret(enc) : '';
      return {
        id: p.id,
        label: p.label,
        defaultModel: p.defaultModel,
        configured: !!key,
        maskedKey: maskSecret(key),
        model: settings.models[p.id] || p.defaultModel,
        custom: customIds.has(p.id),
        baseUrl: baseUrlById.get(p.id),
      };
    }),
    hasLatexCv: !!settings.latexTemplates.cv,
    hasLatexCover: !!settings.latexTemplates.cover,
  };
}

export async function getSettingsView(userId: string): Promise<SettingsView> {
  return toView(await loadSettings(userId));
}

async function save(settings: Settings): Promise<Settings> {
  settings.updatedAt = new Date().toISOString();
  const db = await getDataLayer();
  return db.settings.upsert(settings);
}

// Throw if the id is neither a built-in nor one of this user's custom providers.
function assertKnownProvider(settings: Settings, provider: ProviderId): void {
  if (!getProvider(settings, provider)) {
    throw new AppError(400, `Unknown provider: ${provider}`, 'UNKNOWN_PROVIDER');
  }
}

export async function setApiKey(userId: string, provider: ProviderId, key: string): Promise<SettingsView> {
  const settings = await loadSettings(userId);
  assertKnownProvider(settings, provider);
  if (key.trim()) settings.apiKeys[provider] = encryptSecret(key.trim());
  else delete settings.apiKeys[provider];
  return toView(await save(settings));
}

export async function setModel(userId: string, provider: ProviderId, model: string): Promise<SettingsView> {
  const settings = await loadSettings(userId);
  assertKnownProvider(settings, provider);
  if (model.trim()) settings.models[provider] = model.trim();
  else delete settings.models[provider];
  return toView(await save(settings));
}

export async function setActiveProvider(userId: string, provider: ProviderId): Promise<SettingsView> {
  const settings = await loadSettings(userId);
  assertKnownProvider(settings, provider);
  settings.activeProvider = provider;
  return toView(await save(settings));
}

export interface CustomProviderInput {
  label: string;
  baseUrl: string;
  defaultModel: string;
  apiKey?: string;
}

export async function addCustomProvider(
  userId: string,
  input: CustomProviderInput,
): Promise<SettingsView> {
  const settings = await loadSettings(userId);
  const cp: CustomProvider = {
    id: `custom-${randomUUID()}`,
    label: input.label.trim(),
    baseUrl: input.baseUrl.trim().replace(/\/+$/, ''), // strip trailing slash
    defaultModel: input.defaultModel.trim(),
  };
  settings.customProviders.push(cp);
  if (input.apiKey && input.apiKey.trim()) {
    settings.apiKeys[cp.id] = encryptSecret(input.apiKey.trim());
  }
  return toView(await save(settings));
}

export async function removeCustomProvider(userId: string, id: ProviderId): Promise<SettingsView> {
  const settings = await loadSettings(userId);
  if (PROVIDERS[id]) {
    throw new AppError(400, 'Built-in providers cannot be removed.', 'BUILTIN_PROVIDER');
  }
  settings.customProviders = settings.customProviders.filter((c) => c.id !== id);
  delete settings.apiKeys[id];
  delete settings.models[id];
  // If the removed provider was active, fall back to the default built-in.
  if (settings.activeProvider === id) settings.activeProvider = 'grok';
  return toView(await save(settings));
}

export async function setLatexTemplate(
  userId: string,
  kind: 'cv' | 'cover',
  source: string | null,
): Promise<SettingsView> {
  const settings = await loadSettings(userId);
  if (source && source.trim()) settings.latexTemplates[kind] = source;
  else delete settings.latexTemplates[kind];
  return toView(await save(settings));
}
