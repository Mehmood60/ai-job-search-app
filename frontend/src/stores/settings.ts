import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api/client';

// Provider ids are dynamic: built-ins ('grok' | 'groq' | 'openai' | 'claude') plus
// user-defined custom provider ids.
export type ProviderId = string;

export interface ProviderView {
  id: ProviderId;
  label: string;
  defaultModel: string;
  configured: boolean;
  maskedKey: string;
  model: string;
  custom: boolean;
  baseUrl?: string;
}

export interface SettingsView {
  activeProvider: ProviderId;
  providers: ProviderView[];
  hasLatexCv: boolean;
  hasLatexCover: boolean;
}

export interface CustomProviderInput {
  label: string;
  baseUrl: string;
  defaultModel: string;
  apiKey?: string;
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<SettingsView | null>(null);

  async function load() {
    const { data } = await api.get<SettingsView>('/settings');
    settings.value = data;
  }

  async function setApiKey(provider: ProviderId, key: string) {
    const { data } = await api.put<SettingsView>('/settings/api-key', { provider, key });
    settings.value = data;
  }

  async function setModel(provider: ProviderId, model: string) {
    const { data } = await api.put<SettingsView>('/settings/model', { provider, model });
    settings.value = data;
  }

  async function setActiveProvider(provider: ProviderId) {
    const { data } = await api.put<SettingsView>('/settings/active-provider', { provider });
    settings.value = data;
  }

  async function addCustomProvider(input: CustomProviderInput) {
    const { data } = await api.post<SettingsView>('/settings/custom-provider', input);
    settings.value = data;
  }

  async function removeCustomProvider(id: ProviderId) {
    const { data } = await api.delete<SettingsView>(`/settings/custom-provider/${encodeURIComponent(id)}`);
    settings.value = data;
  }

  async function setLatexTemplate(kind: 'cv' | 'cover', source: string | null) {
    const { data } = await api.put<SettingsView>('/settings/latex-template', { kind, source });
    settings.value = data;
  }

  return {
    settings,
    load,
    setApiKey,
    setModel,
    setActiveProvider,
    addCustomProvider,
    removeCustomProvider,
    setLatexTemplate,
  };
});
