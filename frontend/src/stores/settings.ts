import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api/client';

export type ProviderId = 'grok' | 'openai' | 'claude';

export interface ProviderView {
  id: ProviderId;
  label: string;
  defaultModel: string;
  configured: boolean;
  maskedKey: string;
  model: string;
}

export interface SettingsView {
  activeProvider: ProviderId;
  providers: ProviderView[];
  hasLatexCv: boolean;
  hasLatexCover: boolean;
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

  async function setLatexTemplate(kind: 'cv' | 'cover', source: string | null) {
    const { data } = await api.put<SettingsView>('/settings/latex-template', { kind, source });
    settings.value = data;
  }

  return { settings, load, setApiKey, setModel, setActiveProvider, setLatexTemplate };
});
