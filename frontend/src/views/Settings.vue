<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { api, apiError } from '../api/client';
import { useSettingsStore, type ProviderId } from '../stores/settings';

const store = useSettingsStore();
const error = ref('');
const notice = ref('');

// Local draft inputs per provider (keys are write-only; never pre-filled).
const keyDraft = reactive<Record<string, string>>({});
const modelDraft = reactive<Record<string, string>>({});

// Which provider cards have their key/model fields expanded (collapsed by default).
const expanded = reactive<Record<string, boolean>>({});
const toggleExpand = (id: ProviderId) => (expanded[id] = !expanded[id]);

// Active provider always shown first; the rest keep their original order.
const sortedProviders = computed(() => {
  const list = store.settings?.providers ?? [];
  const active = store.settings?.activeProvider;
  return [...list].sort((a, b) => Number(b.id === active) - Number(a.id === active));
});

// "Add new model" form state.
const showAddForm = ref(false);
const newProvider = reactive({ label: '', baseUrl: '', defaultModel: '', apiKey: '' });

// LaTeX templates: per-template input mode ('paste' | 'upload') + draft source.
const latexCv = ref('');
const latexCover = ref('');
const cvFileName = ref('');
const coverFileName = ref('');
// null = nothing chosen yet (only the two buttons show).
const cvMode = ref<'paste' | 'upload' | null>(null);
const coverMode = ref<'paste' | 'upload' | null>(null);

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
    expanded[id] = false;
  }, 'API key saved');

const saveModel = (id: ProviderId) => act(() => store.setModel(id, modelDraft[id] || ''), 'Model saved');
const activate = (id: ProviderId) => act(() => store.setActiveProvider(id), 'Active provider updated');

const removeProvider = (id: ProviderId, label: string) => {
  if (!confirm(`Remove custom model "${label}"? Its saved API key will be deleted.`)) return;
  return act(() => store.removeCustomProvider(id), 'Model removed');
};

const addProvider = () =>
  act(async () => {
    await store.addCustomProvider({
      label: newProvider.label,
      baseUrl: newProvider.baseUrl,
      defaultModel: newProvider.defaultModel,
      apiKey: newProvider.apiKey || undefined,
    });
    store.settings?.providers.forEach((p) => {
      if (modelDraft[p.id] === undefined) modelDraft[p.id] = p.model;
    });
    Object.assign(newProvider, { label: '', baseUrl: '', defaultModel: '', apiKey: '' });
    showAddForm.value = false;
  }, 'Model added');

const saveLatexCv = () => act(() => store.setLatexTemplate('cv', latexCv.value || null), 'CV template saved');
const saveLatexCover = () =>
  act(() => store.setLatexTemplate('cover', latexCover.value || null), 'Cover template saved');

// Per-template UI state: which panel is open, and in-flight actions.
const editOpen = reactive<{ cv: boolean; cover: boolean }>({ cv: false, cover: false });
const replaceOpen = reactive<{ cv: boolean; cover: boolean }>({ cv: false, cover: false });
const cvEditCmd = ref('');
const coverEditCmd = ref('');
const editing = ref('');
const previewing = ref('');

// Render the saved master template to PDF and open it in a new browser tab.
async function previewTemplate(kind: 'cv' | 'cover') {
  error.value = '';
  notice.value = '';
  previewing.value = kind;
  // open the tab synchronously (within the click) so the browser doesn't block it
  const tab = window.open('', '_blank');
  try {
    const res = await api.post('/settings/template-preview', { kind }, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    if (tab) tab.location.href = url;
    else window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    if (tab) tab.close();
    error.value = apiError(e);
  } finally {
    previewing.value = '';
  }
}

// Edit the saved master template via a natural-language command, save it, then open a
// fresh preview so the user can immediately see the result.
async function applyTemplateEdit(kind: 'cv' | 'cover') {
  const instruction = (kind === 'cv' ? cvEditCmd.value : coverEditCmd.value).trim();
  if (!instruction) return;
  error.value = '';
  notice.value = '';
  editing.value = kind;
  try {
    const edited = await store.editTemplate(kind, instruction);
    await store.setLatexTemplate(kind, edited);
    if (kind === 'cv') cvEditCmd.value = '';
    else coverEditCmd.value = '';
    editOpen[kind] = false;
    notice.value = 'Master template updated. Opening a preview…';
    await previewTemplate(kind);
  } catch (e) {
    error.value = apiError(e);
  } finally {
    editing.value = '';
  }
}

// Read an uploaded .tex file into the matching draft.
function onFile(e: Event, target: 'cv' | 'cover') {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    if (target === 'cv') {
      latexCv.value = text;
      cvFileName.value = file.name;
    } else {
      latexCover.value = text;
      coverFileName.value = file.name;
    }
  };
  reader.readAsText(file);
}
</script>

<template>
  <h1 class="mb-2 text-2xl font-bold">Settings</h1>
  <p class="mb-6 text-sm text-gray-500">
    Add an API key for any provider to use it. The keyed provider you activate becomes primary; Groq stays the
    fallback. Use <strong>Add new model</strong> to connect any OpenAI-compatible API (Gemini, DeepSeek, OpenRouter,
    local LLMs, …). Keys are encrypted at rest and never shown again.
  </p>

  <p v-if="notice" class="mb-4 text-sm text-green-600">{{ notice }}</p>
  <p v-if="error" class="mb-4 text-sm text-brand">{{ error }}</p>

  <div v-if="store.settings" class="space-y-4">
    <div
      v-for="prov in sortedProviders"
      :key="prov.id"
      class="card"
      :class="store.settings.activeProvider === prov.id ? 'ring-1 ring-brand/40' : ''"
    >
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-semibold">
            {{ prov.label }}
            <span v-if="store.settings.activeProvider === prov.id" class="ml-2 rounded bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">ACTIVE</span>
            <span v-else-if="prov.id === store.settings.fallbackId" class="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">fallback</span>
            <span v-if="prov.custom" class="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-600">custom</span>
          </h2>
          <p class="text-xs text-gray-400">
            {{ prov.configured ? `Key set (${prov.maskedKey}) · model: ${prov.model}` : 'No key set' }}
            <span v-if="prov.custom && prov.baseUrl"> · {{ prov.baseUrl }}</span>
          </p>
        </div>
        <div class="flex gap-2">
          <button
            v-if="store.settings.activeProvider !== prov.id"
            class="btn-ghost"
            :disabled="!prov.configured"
            @click="activate(prov.id)"
          >
            Make primary
          </button>
          <button class="btn-ghost" @click="toggleExpand(prov.id)">
            {{ expanded[prov.id] ? 'Close' : prov.configured ? 'Change API key' : 'Add API key' }}
          </button>
          <button
            v-if="prov.custom"
            class="btn-ghost text-brand"
            @click="removeProvider(prov.id, prov.label)"
          >
            Remove
          </button>
        </div>
      </div>

      <div v-if="expanded[prov.id]" class="mt-4 grid gap-3 md:grid-cols-2">
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

    <!-- Add new model -->
    <div class="card">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">Add new model</h2>
        <button class="btn-ghost" @click="showAddForm = !showAddForm">
          {{ showAddForm ? 'Cancel' : '+ Add new model' }}
        </button>
      </div>
      <div v-if="showAddForm" class="mt-4 space-y-3">
        <p class="text-xs text-gray-500">
          Connect any OpenAI-compatible chat-completions API. Example — Groq: base URL
          <code v-pre>https://api.groq.com/openai/v1</code>, model <code v-pre>llama-3.1-8b-instant</code>.
        </p>
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="label">Display name</label>
            <input v-model="newProvider.label" class="input" placeholder="e.g. Groq" />
          </div>
          <div>
            <label class="label">Base URL (OpenAI-compatible)</label>
            <input v-model="newProvider.baseUrl" class="input" placeholder="https://api.groq.com/openai/v1" />
          </div>
          <div>
            <label class="label">Default model</label>
            <input v-model="newProvider.defaultModel" class="input" placeholder="llama-3.1-8b-instant" />
          </div>
          <div>
            <label class="label">API key (optional — can add later)</label>
            <input v-model="newProvider.apiKey" type="password" class="input" placeholder="Paste API key…" />
          </div>
        </div>
        <button class="btn-primary" @click="addProvider">Add model</button>
      </div>
    </div>

    <!-- LaTeX templates -->
    <div class="card">
      <h2 class="font-semibold">Master CV & cover templates</h2>
      <p class="mb-3 text-sm text-gray-500">
        Your full LaTeX CV/cover documents. Each application tailors a <em>copy</em> to the job (your master is never
        changed). <strong>Preview</strong> renders the master to PDF in a new tab; <strong>Add / remove using
        command</strong> edits the master with a plain-English instruction (review by previewing after).
      </p>
      <div class="grid gap-6 md:grid-cols-2">
        <!-- CV template -->
        <div>
          <div class="mb-3 flex items-center gap-2">
            <label class="label mb-0">CV template (.tex, lualatex)</label>
            <span v-if="store.settings.hasLatexCv" class="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">saved ✓</span>
            <span v-else class="text-xs text-gray-400">not set</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="btn-ghost" :disabled="!store.settings.hasLatexCv || previewing === 'cv'" @click="previewTemplate('cv')">
              {{ previewing === 'cv' ? 'Rendering…' : 'Preview' }}
            </button>
            <button class="btn-ghost" :disabled="!store.settings.hasLatexCv" @click="editOpen.cv = !editOpen.cv">
              Add / remove using command
            </button>
            <button class="btn-ghost text-gray-500" @click="replaceOpen.cv = !replaceOpen.cv">
              {{ store.settings.hasLatexCv ? 'Replace' : 'Set template' }}
            </button>
          </div>

          <!-- Command editor -->
          <div v-if="editOpen.cv" class="mt-3">
            <label class="label">Describe the change to your master CV</label>
            <textarea
              v-model="cvEditCmd"
              rows="4"
              class="input resize-y text-sm"
              placeholder="e.g. Add a new entry to Selected Projects: 'AI Job Search app' — Node/Vue/TypeScript, multi-provider AI, PDF rendering; V1 live, V2 planned (Oracle + PostgreSQL). Keep everything else and stay within 4 pages."
            />
            <button class="btn-primary mt-2" :disabled="editing === 'cv' || !cvEditCmd.trim()" @click="applyTemplateEdit('cv')">
              {{ editing === 'cv' ? 'Applying…' : 'Apply command' }}
            </button>
          </div>

          <!-- Replace (paste / upload) -->
          <div v-if="replaceOpen.cv" class="mt-3">
            <div class="mb-2 flex gap-2 text-xs">
              <button :class="cvMode === 'paste' ? 'btn-primary' : 'btn-ghost'" @click="cvMode = 'paste'">Paste code</button>
              <button :class="cvMode === 'upload' ? 'btn-primary' : 'btn-ghost'" @click="cvMode = 'upload'">Upload .tex file</button>
            </div>
            <template v-if="cvMode === 'paste'">
              <textarea v-model="latexCv" rows="8" class="input font-mono text-xs" placeholder="\documentclass...&#10;...&#10;\end{document}" />
              <button class="btn-primary mt-2" @click="saveLatexCv">Save CV template</button>
            </template>
            <template v-else-if="cvMode === 'upload'">
              <label class="btn-ghost inline-block cursor-pointer">
                {{ cvFileName ? 'Choose a different file' : 'Choose .tex file' }}
                <input type="file" accept=".tex,text/plain" class="hidden" @change="onFile($event, 'cv')" />
              </label>
              <p v-if="cvFileName" class="mt-2 text-xs text-gray-500">
                <span class="font-medium text-gray-700">{{ cvFileName }}</span> · {{ latexCv.length.toLocaleString() }} characters loaded
              </p>
              <div><button class="btn-primary mt-2" :disabled="!latexCv" @click="saveLatexCv">Save CV template</button></div>
            </template>
          </div>
        </div>

        <!-- Cover template -->
        <div>
          <div class="mb-3 flex items-center gap-2">
            <label class="label mb-0">Cover template (.tex, pdflatex)</label>
            <span v-if="store.settings.hasLatexCover" class="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">saved ✓</span>
            <span v-else class="text-xs text-gray-400">not set</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="btn-ghost" :disabled="!store.settings.hasLatexCover || previewing === 'cover'" @click="previewTemplate('cover')">
              {{ previewing === 'cover' ? 'Rendering…' : 'Preview' }}
            </button>
            <button class="btn-ghost" :disabled="!store.settings.hasLatexCover" @click="editOpen.cover = !editOpen.cover">
              Add / remove using command
            </button>
            <button class="btn-ghost text-gray-500" @click="replaceOpen.cover = !replaceOpen.cover">
              {{ store.settings.hasLatexCover ? 'Replace' : 'Set template' }}
            </button>
          </div>

          <!-- Command editor -->
          <div v-if="editOpen.cover" class="mt-3">
            <label class="label">Describe the change to your master cover letter</label>
            <textarea
              v-model="coverEditCmd"
              rows="4"
              class="input resize-y text-sm"
              placeholder="e.g. Update the closing paragraph to be more concise; or change my phone number to +49 …"
            />
            <button class="btn-primary mt-2" :disabled="editing === 'cover' || !coverEditCmd.trim()" @click="applyTemplateEdit('cover')">
              {{ editing === 'cover' ? 'Applying…' : 'Apply command' }}
            </button>
          </div>

          <!-- Replace (paste / upload) -->
          <div v-if="replaceOpen.cover" class="mt-3">
            <div class="mb-2 flex gap-2 text-xs">
              <button :class="coverMode === 'paste' ? 'btn-primary' : 'btn-ghost'" @click="coverMode = 'paste'">Paste code</button>
              <button :class="coverMode === 'upload' ? 'btn-primary' : 'btn-ghost'" @click="coverMode = 'upload'">Upload .tex file</button>
            </div>
            <template v-if="coverMode === 'paste'">
              <textarea v-model="latexCover" rows="8" class="input font-mono text-xs" placeholder="\documentclass...&#10;...&#10;\end{document}" />
              <button class="btn-primary mt-2" @click="saveLatexCover">Save cover template</button>
            </template>
            <template v-else-if="coverMode === 'upload'">
              <label class="btn-ghost inline-block cursor-pointer">
                {{ coverFileName ? 'Choose a different file' : 'Choose .tex file' }}
                <input type="file" accept=".tex,text/plain" class="hidden" @change="onFile($event, 'cover')" />
              </label>
              <p v-if="coverFileName" class="mt-2 text-xs text-gray-500">
                <span class="font-medium text-gray-700">{{ coverFileName }}</span> · {{ latexCover.length.toLocaleString() }} characters loaded
              </p>
              <div><button class="btn-primary mt-2" :disabled="!latexCover" @click="saveLatexCover">Save cover template</button></div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
