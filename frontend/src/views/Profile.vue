<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api, apiError } from '../api/client';
import { useSettingsStore } from '../stores/settings';

interface Experience {
  title: string;
  company: string;
  location?: string;
  start?: string;
  end?: string;
  bullets: string[];
}
interface Education {
  degree: string;
  institution: string;
  location?: string;
  start?: string;
  end?: string;
  notes?: string;
}
interface Project {
  name: string;
  description: string;
  url?: string;
}
interface Profile {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: { label: string; url: string }[];
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  projects: Project[];
  languages: string[];
  certifications: string[];
}

const p = ref<Profile>(blank());
const saved = ref(false);
const error = ref('');
const loading = ref(false);

// Comma-joined mirrors for the simple string-list fields.
const skillsStr = ref('');
const languagesStr = ref('');
const certsStr = ref('');

// Autofill-from-CV state.
const settingsStore = useSettingsStore();
const hasSavedCv = computed(() => !!settingsStore.settings?.hasLatexCv);
const autofilling = ref(false);
const autofillNote = ref('');

function blank(): Profile {
  return {
    fullName: '', headline: '', email: '', phone: '', location: '',
    links: [], summary: '', skills: [], experience: [], education: [],
    projects: [], languages: [], certifications: [],
  };
}

function applyProfileData(data: Partial<Profile>) {
  p.value = { ...blank(), ...data };
  skillsStr.value = p.value.skills.join(', ');
  languagesStr.value = p.value.languages.join(', ');
  certsStr.value = p.value.certifications.join(', ');
}

onMounted(async () => {
  try {
    const { data } = await api.get<Profile>('/profile');
    applyProfileData(data);
    await settingsStore.load().catch(() => {}); // for the "autofill from saved CV" option
  } catch (e) {
    error.value = apiError(e);
  }
});

const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

// Read a File as a base64 string (no data: prefix).
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function runAutofill(payload: Record<string, unknown>) {
  error.value = '';
  autofillNote.value = '';
  autofilling.value = true;
  try {
    const { data } = await api.post<{ profile: Partial<Profile>; usedProvider: string }>(
      '/profile/autofill',
      payload,
    );
    applyProfileData(data.profile);
    autofillNote.value = `Imported from your CV via ${data.usedProvider}. Review the fields below, then click Save profile.`;
  } catch (e) {
    error.value = apiError(e);
  } finally {
    autofilling.value = false;
  }
}

const autofillFromSaved = () => runAutofill({ useSavedCv: true });

async function autofillFromFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const payload = isPdf ? { pdfBase64: await fileToBase64(file) } : { cvText: await fileToText(file) };
    await runAutofill(payload);
  } catch (err) {
    error.value = apiError(err);
  } finally {
    input.value = ''; // allow re-selecting the same file
  }
}

async function save() {
  error.value = '';
  saved.value = false;
  loading.value = true;
  p.value.skills = splitList(skillsStr.value);
  p.value.languages = splitList(languagesStr.value);
  p.value.certifications = splitList(certsStr.value);
  try {
    await api.put('/profile', p.value);
    saved.value = true;
  } catch (e) {
    error.value = apiError(e);
  } finally {
    loading.value = false;
  }
}

const addExp = () => p.value.experience.push({ title: '', company: '', bullets: [''] });
const addEdu = () => p.value.education.push({ degree: '', institution: '' });
const addProj = () => p.value.projects.push({ name: '', description: '' });
const addLink = () => p.value.links.push({ label: '', url: '' });
</script>

<template>
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-bold">Your profile</h1>
    <div class="flex items-center gap-3">
      <span v-if="saved" class="text-sm text-green-600">Saved ✓</span>
      <button class="btn-primary" :disabled="loading" @click="save">{{ loading ? 'Saving…' : 'Save profile' }}</button>
    </div>
  </div>
  <p v-if="error" class="mb-4 text-sm text-brand">{{ error }}</p>

  <!-- Autofill from CV -->
  <div class="card mb-6 border-brand/30 bg-brand/5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="font-semibold">Autofill from your CV</h2>
        <p class="text-xs text-gray-500">
          Let the AI read your CV and fill in the fields below. You review and save — nothing is stored until you click
          Save profile.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="hasSavedCv"
          class="btn-primary"
          :disabled="autofilling"
          @click="autofillFromSaved"
        >
          {{ autofilling ? 'Extracting…' : 'Autofill from saved CV' }}
        </button>
        <label class="btn-ghost cursor-pointer">
          {{ autofilling ? 'Extracting…' : 'Upload PDF / .tex' }}
          <input
            type="file"
            accept=".pdf,.tex,application/pdf,text/plain"
            class="hidden"
            :disabled="autofilling"
            @change="autofillFromFile"
          />
        </label>
      </div>
    </div>
    <p v-if="!hasSavedCv" class="mt-2 text-xs text-gray-400">
      Tip: save a LaTeX CV in Settings to enable one-click autofill from it.
    </p>
    <p v-if="autofillNote" class="mt-3 text-sm text-green-600">{{ autofillNote }}</p>
  </div>

  <div class="space-y-6">
    <div class="card grid gap-4 md:grid-cols-2">
      <div><label class="label">Full name</label><input v-model="p.fullName" class="input" /></div>
      <div><label class="label">Headline</label><input v-model="p.headline" class="input" /></div>
      <div><label class="label">Email</label><input v-model="p.email" class="input" /></div>
      <div><label class="label">Phone</label><input v-model="p.phone" class="input" /></div>
      <div><label class="label">Location</label><input v-model="p.location" class="input" /></div>
      <div class="md:col-span-2"><label class="label">Summary</label><textarea v-model="p.summary" rows="5" class="input resize-y leading-relaxed" /></div>
      <div class="md:col-span-2"><label class="label">Skills (comma-separated)</label><input v-model="skillsStr" class="input" /></div>
      <div><label class="label">Languages (comma-separated)</label><input v-model="languagesStr" class="input" /></div>
      <div><label class="label">Certifications (comma-separated)</label><input v-model="certsStr" class="input" /></div>
    </div>

    <div class="card">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-semibold">Links</h2><button class="btn-ghost" @click="addLink">+ Add</button>
      </div>
      <div v-for="(l, i) in p.links" :key="i" class="mb-2 flex gap-2">
        <input v-model="l.label" class="input" placeholder="Label (e.g. GitHub)" />
        <input v-model="l.url" class="input" placeholder="URL" />
        <button class="btn-ghost" @click="p.links.splice(i, 1)">✕</button>
      </div>
    </div>

    <div class="card">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-semibold">Experience</h2><button class="btn-ghost" @click="addExp">+ Add role</button>
      </div>
      <div v-for="(e, i) in p.experience" :key="i" class="mb-4 rounded-lg border border-gray-100 p-3">
        <div class="grid gap-2 md:grid-cols-2">
          <input v-model="e.title" class="input" placeholder="Title" />
          <input v-model="e.company" class="input" placeholder="Company" />
          <input v-model="e.location" class="input" placeholder="Location" />
          <div class="flex gap-2">
            <input v-model="e.start" class="input" placeholder="Start" />
            <input v-model="e.end" class="input" placeholder="End" />
          </div>
        </div>
        <label class="label mt-2">Bullets (one per line)</label>
        <textarea
          :value="e.bullets.join('\n')"
          rows="6"
          class="input resize-y text-sm leading-relaxed"
          @input="e.bullets = ($event.target as HTMLTextAreaElement).value.split('\n')"
        />
        <button class="btn-ghost mt-2" @click="p.experience.splice(i, 1)">Remove role</button>
      </div>
    </div>

    <div class="card">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-semibold">Education</h2><button class="btn-ghost" @click="addEdu">+ Add</button>
      </div>
      <div v-for="(e, i) in p.education" :key="i" class="mb-3 grid gap-2 md:grid-cols-2">
        <input v-model="e.degree" class="input" placeholder="Degree" />
        <input v-model="e.institution" class="input" placeholder="Institution" />
        <input v-model="e.start" class="input" placeholder="Start" />
        <input v-model="e.end" class="input" placeholder="End" />
        <input v-model="e.notes" class="input md:col-span-2" placeholder="Notes (optional)" />
        <button class="btn-ghost" @click="p.education.splice(i, 1)">Remove</button>
      </div>
    </div>

    <div class="card">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-semibold">Projects</h2><button class="btn-ghost" @click="addProj">+ Add</button>
      </div>
      <div v-for="(pr, i) in p.projects" :key="i" class="mb-3 grid gap-2">
        <input v-model="pr.name" class="input" placeholder="Project name" />
        <input v-model="pr.url" class="input" placeholder="URL (optional)" />
        <textarea v-model="pr.description" rows="3" class="input resize-y leading-relaxed" placeholder="Description" />
        <button class="btn-ghost" @click="p.projects.splice(i, 1)">Remove</button>
      </div>
    </div>
  </div>
</template>
