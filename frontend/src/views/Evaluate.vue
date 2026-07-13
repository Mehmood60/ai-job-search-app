<script setup lang="ts">
import { ref } from 'vue';
import { api, apiError } from '../api/client';

interface EvalResult {
  score: number;
  verdict: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  keywords_matched: string[];
  keywords_missing: string[];
}

const jobText = ref('');
const result = ref<EvalResult | null>(null);
const usedProvider = ref('');
const loading = ref(false);
const error = ref('');

async function run() {
  error.value = '';
  result.value = null;
  loading.value = true;
  try {
    const { data } = await api.post('/evaluate', { jobText: jobText.value });
    result.value = data.result;
    usedProvider.value = data.usedProvider;
  } catch (e) {
    error.value = apiError(e);
  } finally {
    loading.value = false;
  }
}

const verdictColor = (v: string) =>
  ({ strong: 'text-green-600', good: 'text-green-600', moderate: 'text-amber-600', weak: 'text-brand' }[v] ||
  'text-gray-600');
</script>

<template>
  <h1 class="mb-6 text-2xl font-bold">Job fit evaluation</h1>
  <div class="grid gap-6 md:grid-cols-2">
    <div class="card">
      <label class="label">Paste the job posting</label>
      <textarea v-model="jobText" rows="16" class="input font-mono text-xs" placeholder="Paste the full job description…" />
      <button class="btn-primary mt-4" :disabled="loading || jobText.length < 20" @click="run">
        {{ loading ? 'Evaluating…' : 'Evaluate fit' }}
      </button>
      <p v-if="error" class="mt-3 text-sm text-brand">{{ error }}</p>
    </div>

    <div v-if="result" class="card">
      <div class="flex items-baseline justify-between">
        <div class="text-4xl font-bold text-brand">{{ result.score }}<span class="text-lg text-gray-400">/100</span></div>
        <span class="text-sm font-semibold uppercase" :class="verdictColor(result.verdict)">{{ result.verdict }}</span>
      </div>
      <p class="mt-2 text-sm text-gray-600">{{ result.summary }}</p>
      <p class="mt-1 text-xs text-gray-400">via {{ usedProvider }}</p>

      <div class="mt-4">
        <h3 class="text-sm font-semibold text-green-700">Strengths</h3>
        <ul class="mt-1 list-disc pl-5 text-sm text-gray-700">
          <li v-for="s in result.strengths" :key="s">{{ s }}</li>
        </ul>
      </div>
      <div class="mt-3">
        <h3 class="text-sm font-semibold text-brand">Gaps</h3>
        <ul class="mt-1 list-disc pl-5 text-sm text-gray-700">
          <li v-for="g in result.gaps" :key="g">{{ g }}</li>
        </ul>
      </div>
      <div class="mt-3 flex flex-wrap gap-1">
        <span v-for="k in result.keywords_matched" :key="k" class="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">{{ k }}</span>
        <span v-for="k in result.keywords_missing" :key="k" class="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">{{ k }}</span>
      </div>
    </div>
  </div>
</template>
