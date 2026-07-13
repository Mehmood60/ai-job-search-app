<script setup lang="ts">
import { ref } from 'vue';
import { api, apiError } from '../api/client';

interface AtsResult {
  atsScore: number;
  verdict: string;
  keywordCoverage: { matched: string[]; missing: string[] };
  recommendations: string[];
  redFlags: string[];
}

const jobText = ref('');
const company = ref('');
const cv = ref('');
const coverLetter = ref('');
const ats = ref<AtsResult | null>(null);
const usedProvider = ref('');

const step = ref<'input' | 'review'>('input');
const loading = ref('');
const error = ref('');

function reset() {
  // Discard everything — nothing is stored anywhere.
  jobText.value = '';
  company.value = '';
  cv.value = '';
  coverLetter.value = '';
  ats.value = null;
  usedProvider.value = '';
  step.value = 'input';
  error.value = '';
}

async function generate() {
  error.value = '';
  loading.value = 'Generating CV and cover letter…';
  try {
    const [cvRes, coverRes] = await Promise.all([
      api.post('/generate/cv', { jobText: jobText.value }),
      api.post('/generate/cover-letter', { jobText: jobText.value }),
    ]);
    cv.value = cvRes.data.cv;
    coverLetter.value = coverRes.data.coverLetter;
    usedProvider.value = cvRes.data.usedProvider;

    loading.value = 'Running ATS review…';
    const atsRes = await api.post('/ats-review', {
      jobText: jobText.value,
      cv: cv.value,
      coverLetter: coverLetter.value,
    });
    ats.value = atsRes.data.result;
    step.value = 'review';
  } catch (e) {
    error.value = apiError(e);
  } finally {
    loading.value = '';
  }
}

async function reReviewAfterEdit() {
  error.value = '';
  loading.value = 'Re-running ATS review…';
  try {
    const atsRes = await api.post('/ats-review', {
      jobText: jobText.value,
      cv: cv.value,
      coverLetter: coverLetter.value,
    });
    ats.value = atsRes.data.result;
  } catch (e) {
    error.value = apiError(e);
  } finally {
    loading.value = '';
  }
}

async function download() {
  error.value = '';
  loading.value = 'Building your ZIP…';
  try {
    const res = await api.post(
      '/package',
      { jobText: jobText.value, cv: cv.value, coverLetter: coverLetter.value, company: company.value },
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    const name = (company.value || 'Company').replace(/[^\w.\- ]+/g, '').trim() || 'Company';
    a.download = `${name} - Application.zip`;
    a.click();
    URL.revokeObjectURL(url);
    reset();
  } catch (e) {
    error.value = apiError(e);
  } finally {
    loading.value = '';
  }
}

const verdictColor = (v: string) =>
  ({ excellent: 'text-green-600', good: 'text-green-600', 'needs-work': 'text-amber-600', poor: 'text-brand' }[v] ||
  'text-gray-600');
</script>

<template>
  <h1 class="mb-6 text-2xl font-bold">Generate an application</h1>

  <!-- Step 1: input -->
  <div v-if="step === 'input'" class="card space-y-4">
    <div>
      <label class="label">Company name</label>
      <input v-model="company" class="input" placeholder="e.g. Acme GmbH" />
    </div>
    <div>
      <label class="label">Job posting</label>
      <textarea v-model="jobText" rows="14" class="input font-mono text-xs" placeholder="Paste the full job description…" />
    </div>
    <button class="btn-primary" :disabled="!!loading || jobText.length < 20" @click="generate">
      {{ loading || 'Generate CV + Cover letter' }}
    </button>
    <p v-if="error" class="text-sm text-brand">{{ error }}</p>
  </div>

  <!-- Step 2: review + ATS gate -->
  <div v-else class="space-y-6">
    <!-- ATS review panel -->
    <div v-if="ats" class="card border-brand/30">
      <div class="flex items-baseline justify-between">
        <h2 class="text-lg font-semibold">ATS review</h2>
        <div>
          <span class="text-3xl font-bold text-brand">{{ ats.atsScore }}</span>
          <span class="text-sm text-gray-400">/100</span>
          <span class="ml-2 text-sm font-semibold uppercase" :class="verdictColor(ats.verdict)">{{ ats.verdict }}</span>
        </div>
      </div>
      <p class="mt-1 text-xs text-gray-400">via {{ usedProvider }}</p>

      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 class="text-sm font-semibold text-gray-700">Recommendations</h3>
          <ul class="mt-1 list-disc pl-5 text-sm text-gray-700">
            <li v-for="r in ats.recommendations" :key="r">{{ r }}</li>
          </ul>
          <template v-if="ats.redFlags?.length">
            <h3 class="mt-3 text-sm font-semibold text-brand">Red flags</h3>
            <ul class="mt-1 list-disc pl-5 text-sm text-gray-700">
              <li v-for="f in ats.redFlags" :key="f">{{ f }}</li>
            </ul>
          </template>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-gray-700">Keyword coverage</h3>
          <div class="mt-1 flex flex-wrap gap-1">
            <span v-for="k in ats.keywordCoverage.matched" :key="k" class="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">{{ k }}</span>
            <span v-for="k in ats.keywordCoverage.missing" :key="k" class="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">{{ k }}</span>
          </div>
        </div>
      </div>

      <!-- The download gate -->
      <div class="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <p class="mr-auto text-sm text-gray-500">
          Happy with this? Download the ZIP (JD + CV + cover letter). Nothing is stored on the server.
        </p>
        <button class="btn-ghost" :disabled="!!loading" @click="reset">No, discard</button>
        <button class="btn-primary" :disabled="!!loading" @click="download">
          {{ loading || 'Download ZIP' }}
        </button>
      </div>
      <p v-if="error" class="mt-3 text-sm text-brand">{{ error }}</p>
    </div>

    <!-- Editable previews -->
    <div class="grid gap-6 md:grid-cols-2">
      <div class="card">
        <label class="label">CV (editable — Markdown)</label>
        <textarea v-model="cv" rows="20" class="input font-mono text-xs" />
      </div>
      <div class="card">
        <label class="label">Cover letter (editable)</label>
        <textarea v-model="coverLetter" rows="20" class="input font-mono text-xs" />
      </div>
    </div>
    <div class="flex justify-end">
      <button class="btn-ghost" :disabled="!!loading" @click="reReviewAfterEdit">Re-run ATS review after edits</button>
    </div>
  </div>
</template>
