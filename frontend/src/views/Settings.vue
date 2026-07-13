<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { apiError } from '../api/client';
import { useSettingsStore, type ProviderId } from '../stores/settings';

const store = useSettingsStore();
const error = ref('');
const notice = ref('');

// Local draft inputs per provider (keys are write-only; never pre-filled).
const keyDraft = reactive<Record<string, string>>({});
const modelDraft = reactive<Record<string, string>>({});
const latexCv = ref('');
const latexCover = ref('');

onMounted(async () => {
  try {
    await store.load();
    store.settings?.providers.forEach((p) => (modelDraft[p.id] = p.model));
  } catch (e) {
    error.value = apiError(e);
  }
});

async function act(fn: () => Promise<void>, msg: string) {
  error.value = '';
  notice.value = '';
  try {
    await fn();
    notice.value = msg;
  } catch (e) {
    error.value = apiError(e);
  }
}

const saveKey = (id: ProviderId) =>
  act(async () => {
    await store.setApiKey(id, keyDraft[id] || '');
    keyDraft[id] = '';
  }, 'API key saved');

const saveModel = (id: ProviderId) => act(() => store.setModel(id, modelDraft[id] || ''), 'Model saved');
const activate = (id: ProviderId) => act(() => store.setActiveProvider(id), 'Active provider updated');
const saveLatexCv = () => act(() => store.setLatexTemplate('cv', latexCv.value || null), 'CV template saved');
const saveLatexCover = () => act(() => store.setLatexTemplate('cover', latexCover.value || null), 'Cover template saved');
</script>

<template>
  <h1 class="mb-2 text-2xl font-bold">Settings</h1>
  <p class="mb-6 text-sm text-gray-500">
    Add an API key for any provider to use it. The keyed provider you activate becomes primary; Grok stays the
    fallback. Keys are encrypted at rest and never shown again.
  </p>

  <p v-if="notice" class="mb-4 text-sm text-green-600">{{ notice }}</p>
  <p v-if="error" class="mb-4 text-sm text-brand">{{ error }}</p>

  <div v-if="store.settings" class="space-y-4">
    <div v-for="prov in store.settings.providers" :key="prov.id" class="card">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-semibold">
            {{ prov.label }}
            <span v-if="store.settings.activeProvider === prov.id" class="ml-2 rounded bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">ACTIVE</span>
            <span v-else-if="prov.id === 'grok'" class="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">default fallback</span>
          </h2>
          <p class="text-xs text-gray-400">
            {{ prov.configured ? `Key set (${prov.maskedKey})` : 'No key set' }}
          </p>
        </div>
        <button
          v-if="store.settings.activeProvider !== prov.id"
          class="btn-ghost"
          :disabled="!prov.configured"
          @click="activate(prov.id)"
        >
          Make primary
        </button>
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <label class="label">API key</label>
          <div class="flex gap-2">
            <input v-model="keyDraft[prov.id]" type="password" class="input" :placeholder="prov.configured ? 'Replace key…' : 'Paste API key…'" />
            <button class="btn-primary" @click="saveKey(prov.id)">Save</button>
          </div>
        </div>
        <div>
          <label class="label">Model (default: {{ prov.defaultModel }})</label>
          <div class="flex gap-2">
            <input v-model="modelDraft[prov.id]" class="input" :placeholder="prov.defaultModel" />
            <button class="btn-ghost" @click="saveModel(prov.id)">Save</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="font-semibold">LaTeX templates (optional)</h2>
      <p class="mb-3 text-sm text-gray-500">
        Paste your own LaTeX source with a <code v-pre>{{CONTENT}}</code> placeholder where the generated content
        should go. Used only if a TeX toolchain is available; otherwise the app renders a clean HTML→PDF.
        {{ store.settings.hasLatexCv ? 'CV template set.' : '' }} {{ store.settings.hasLatexCover ? 'Cover template set.' : '' }}
      </p>
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="label">CV template (.tex, compiled with lualatex)</label>
          <textarea v-model="latexCv" rows="8" class="input font-mono text-xs" placeholder="\documentclass...\n{{CONTENT}}\n\end{document}" />
          <button class="btn-ghost mt-2" @click="saveLatexCv">Save CV template</button>
        </div>
        <div>
          <label class="label">Cover template (.tex, compiled with pdflatex)</label>
          <textarea v-model="latexCover" rows="8" class="input font-mono text-xs" placeholder="\documentclass...\n{{CONTENT}}\n\end{document}" />
          <button class="btn-ghost mt-2" @click="saveLatexCover">Save cover template</button>
        </div>
      </div>
    </div>
  </div>
</template>
