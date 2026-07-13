import { getDataLayer } from '../../db';
import { ProviderId, Settings } from '../../db/types';
import { decryptSecret, encryptSecret, maskSecret } from '../../crypto/secrets';
import { PROVIDER_LIST } from '../../ai/registry';
import { loadSettings } from '../userData';

const PROVIDER_IDS: ProviderId[] = ['grok', 'openai', 'claude'];

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
  }[];
  hasLatexCv: boolean;
  hasLatexCover: boolean;
}

export function toView(settings: Settings): SettingsView {
  return {
    activeProvider: settings.activeProvider,
    providers: PROVIDER_LIST.map((p) => {
      const enc = settings.apiKeys[p.id];
      const key = enc ? decryptSecret(enc) : '';
      return {
        id: p.id,
        label: p.label,
        defaultModel: p.defaultModel,
        configured: !!key,
        maskedKey: maskSecret(key),
        model: settings.models[p.id] || p.defaultModel,
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

export async function setApiKey(userId: string, provider: ProviderId, key: string): Promise<SettingsView> {
  const settings = await loadSettings(userId);
  settings.apiKeys[provider] = key.trim() ? encryptSecret(key.trim()) : '';
  return toView(await save(settings));
}

export async function setModel(userId: string, provider: ProviderId, model: string): Promise<SettingsView> {
  const settings = await loadSettings(userId);
  if (model.trim()) settings.models[provider] = model.trim();
  else delete settings.models[provider];
  return toView(await save(settings));
}

export async function setActiveProvider(userId: string, provider: ProviderId): Promise<SettingsView> {
  const settings = await loadSettings(userId);
  settings.activeProvider = provider;
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

export { PROVIDER_IDS };
