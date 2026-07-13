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
interface AtsResult {
  atsScore: number;
  verdict: string;
  keywordCoverage: { matched: string[]; missing: string[] };
  recommendations: string[];
  redFlags: string[];
}
type Fmt = 'latex' | 'markdown';

const company = ref('');
const jobInput = ref(''); // pasted JD text OR a URL
const jobText = ref(''); // server-resolved JD text (reused across steps)

const evalResult = ref<EvalResult | null>(null);
const evalProvider = ref('');

const cv = ref('');
const cvFormat = ref<Fmt>('markdown');
const coverLetter = ref('');
const coverFormat = ref<Fmt>('markdown');
const ats = ref<AtsResult | null>(null);
const usedProvider = ref('');

const stage = ref<'input' | 'evaluated' | 'review'>('input');
const loading = ref('');
const error = ref('');
const cvError = ref('');
const coverError = ref('');

function reset() {
  company.value = '';
  jobInput.value = '';
  jobText.value = '';
  evalResult.value = null;
  cv.value = '';
  coverLetter.value = '';
  cvFormat.value = 'markdown';
  coverFormat.value = 'markdown';
  ats.value = null;
  usedProvider.value = '';
  stage.value = 'input';
  error.value = '';
  cvError.value = '';
  coverError.value = '';
}

async function evaluate() {
  error.value = '';
  loading.value = 'Reading the posting and evaluating fit…';
  try {
    await withRetry('Evaluate', async () => {
      const { data } = await api.post('/evaluate', { jobText: jobInput.value });
      evalResult.value = data.result;
      evalProvider.value = data.usedProvider;
      jobText.value = data.jobText; // resolved (URL fetched server-side, if any)
    });
    stage.value = 'evaluated';
  } catch (e) {
    error.value = apiError(e);
  } finally {
    loading.value = '';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Providers with a per-minute token cap (e.g. Groq free tier) return "try again in Ns".
// Honor it: wait the stated time (with a countdown) and retry, so generation completes
// hands-free instead of erroring out.
function retryAfterSeconds(msg: string): number | null {
  // Handles "37.795s" and "2m11.328s" (minutes + seconds) from provider rate-limit messages.
  const m = msg.match(/try again in (?:(\d+)m)?\s*(?:([\d.]+)s)?/i);
  if (!m) return null;
  const mins = m[1] ? parseInt(m[1], 10) : 0;
  const secs = m[2] ? parseFloat(m[2]) : 0;
  const total = mins * 60 + secs;
  return total > 0 ? Math.ceil(total) + 1 : null;
}

async function withRetry(label: string, fn: () => Promise<void>, maxRetries = 2): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await fn();
      return;
    } catch (e) {
      const wait = retryAfterSeconds(apiError(e));
      if (wait != null && attempt < maxRetries) {
        for (let s = wait; s > 0; s--) {
          loading.value = `${label}: provider rate limit — retrying in ${s}s…`;
          await sleep(1000);
        }
        continue;
      }
      throw e;
    }
  }
}

async function genCv() {
  cvError.value = '';
  await withRetry('CV', async () => {
    const { data } = await api.post('/generate/cv', { jobText: jobText.value });
    cv.value = data.cv;
    cvFormat.value = data.format;
    usedProvider.value = data.usedProvider;
  });
}

async function genCover() {
  coverError.value = '';
  await withRetry('Cover letter', async () => {
    const { data } = await api.post('/generate/cover-letter', { jobText: jobText.value });
    coverLetter.value = data.coverLetter;
    coverFormat.value = data.format;
  });
}

async function runAts() {
  if (!cv.value || !coverLetter.value) return;
  await withRetry('ATS review', async () => {
    const { data } = await api.post('/ats-review', {
      jobText: jobText.value,
      cv: cv.value,
      coverLetter: coverLetter.value,
    });
    ats.value = data.result;
  });
}

// Generate CV and cover independently so a rate-limited cover doesn't lose the CV.
async function generate() {
  error.value = '';
  loading.value = 'Tailoring your CV…';
  try {
    await genCv();
  } catch (e) {
    cvError.value = apiError(e);
  }
  loading.value = 'Tailoring your cover letter…';
  try {
    await genCover();
  } catch (e) {
    coverError.value = apiError(e);
  }
  stage.value = 'review';
  if (cv.value && coverLetter.value) {
    loading.value = 'Running ATS review…';
    try {
      await runAts();
    } catch {
      /* ATS is optional; ignore */
    }
  }
  loading.value = '';
}

async function regenerate(kind: 'cv' | 'cover') {
  error.value = '';
  loading.value = kind === 'cv' ? 'Tailoring your CV…' : 'Tailoring your cover letter…';
  try {
    if (kind === 'cv') await genCv();
    else await genCover();
    await runAts().catch(() => undefined);
  } catch (e) {
    if (kind === 'cv') cvError.value = apiError(e);
    else coverError.value = apiError(e);
  } finally {
    loading.value = '';
  }
}

async function reReview() {
  error.value = '';
  loading.value = 'Running ATS review…';
  try {
    await runAts(); // withRetry: counts down + retries on rate limit
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
      {
        jobText: jobText.value,
        cv: cv.value,
        coverLetter: coverLetter.value,
        company: company.value,
        cvFormat: cvFormat.value,
        coverFormat: coverFormat.value,
      },
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

const fitColor = (v: string) =>
  ({ strong: 'text-green-600', good: 'text-green-600', moderate: 'text-amber-600', weak: 'text-brand' }[v] ||
  'text-gray-600');
const atsColor = (v: string) =>
  ({ excellent: 'text-green-600', good: 'text-green-600', 'needs-work': 'text-amber-600', poor: 'text-brand' }[v] ||
  'text-gray-600');
</script>

<template>
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-bold">Apply</h1>
    <button v-if="stage !== 'input'" class="btn-ghost" :disabled="!!loading" @click="reset">Start over</button>
  </div>

  <p v-if="error" class="mb-4 text-sm text-brand">{{ error }}</p>

  <div class="space-y-6">
    <!-- Step 1: job input + evaluate -->
    <div class="card space-y-4">
      <div>
        <label class="label">Company name</label>
        <input v-model="company" class="input" placeholder="e.g. Acme GmbH" :disabled="stage !== 'input'" />
      </div>
      <div>
        <label class="label">Job posting — paste the full description or a link</label>
        <textarea
          v-model="jobInput"
          rows="10"
          class="input font-mono text-xs"
          placeholder="Paste the full job description, or a URL to it (e.g. https://…)"
          :disabled="stage !== 'input'"
        />
      </div>
      <button
        v-if="stage === 'input'"
        class="btn-primary"
        :disabled="!!loading || jobInput.trim().length < 5"
        @click="evaluate"
      >
        {{ loading || 'Evaluate fit' }}
      </button>
    </div>

    <!-- Step 2: evaluation result + generate button -->
    <div v-if="evalResult" class="card">
      <div class="flex items-baseline justify-between">
        <div class="text-4xl font-bold text-brand">
          {{ evalResult.score }}<span class="text-lg text-gray-400">/100</span>
        </div>
        <span class="text-sm font-semibold uppercase" :class="fitColor(evalResult.verdict)">{{ evalResult.verdict }}</span>
      </div>
      <p class="mt-2 text-sm text-gray-600">{{ evalResult.summary }}</p>
      <p class="mt-1 text-xs text-gray-400">via {{ evalProvider }}</p>

      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 class="text-sm font-semibold text-green-700">Strengths</h3>
          <ul class="mt-1 list-disc pl-5 text-sm text-gray-700"><li v-for="s in evalResult.strengths" :key="s">{{ s }}</li></ul>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-brand">Gaps</h3>
          <ul class="mt-1 list-disc pl-5 text-sm text-gray-700"><li v-for="g in evalResult.gaps" :key="g">{{ g }}</li></ul>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-1">
        <span v-for="k in evalResult.keywords_matched" :key="k" class="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">{{ k }}</span>
        <span v-for="k in evalResult.keywords_missing" :key="k" class="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">{{ k }}</span>
      </div>

      <div v-if="stage === 'evaluated'" class="mt-6 border-t border-gray-100 pt-4">
        <button class="btn-primary" :disabled="!!loading" @click="generate">
          {{ loading || 'Generate CV & Cover letter for this job' }}
        </button>
        <p class="mt-2 text-xs text-gray-400">
          Tailors a copy of your saved CV/cover templates to this posting — nothing is shortened, and your original
          templates are never changed.
        </p>
      </div>
    </div>

    <!-- Step 3: ATS review + editable previews + download gate -->
    <template v-if="stage === 'review'">
      <div v-if="ats" class="card border-brand/30">
        <div class="flex items-baseline justify-between">
          <h2 class="text-lg font-semibold">ATS review</h2>
          <div>
            <span class="text-3xl font-bold text-brand">{{ ats.atsScore }}</span>
            <span class="text-sm text-gray-400">/100</span>
            <span class="ml-2 text-sm font-semibold uppercase" :class="atsColor(ats.verdict)">{{ ats.verdict }}</span>
          </div>
        </div>
        <p class="mt-1 text-xs text-gray-400">via {{ usedProvider }}</p>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 class="text-sm font-semibold text-gray-700">Recommendations</h3>
            <ul class="mt-1 list-disc pl-5 text-sm text-gray-700"><li v-for="r in ats.recommendations" :key="r">{{ r }}</li></ul>
            <template v-if="ats.redFlags?.length">
              <h3 class="mt-3 text-sm font-semibold text-brand">Red flags</h3>
              <ul class="mt-1 list-disc pl-5 text-sm text-gray-700"><li v-for="f in ats.redFlags" :key="f">{{ f }}</li></ul>
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

        <div class="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
          <p class="mr-auto text-sm text-gray-500">
            Happy with this? Download the ZIP (JD + CV + cover letter, PDF and tailored .tex). Nothing is stored on the
            server.
          </p>
          <button class="btn-ghost" :disabled="!!loading" @click="reset">Discard</button>
          <button class="btn-primary" :disabled="!!loading || !cv || !coverLetter" @click="download">
            {{ loading || 'Download ZIP' }}
          </button>
        </div>
        <p v-if="(!cv || !coverLetter) && !loading" class="mt-2 text-xs text-amber-600">
          Download needs both documents — retry the missing one below.
        </p>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <div class="card">
          <div class="mb-1 flex items-center justify-between">
            <label class="label mb-0">CV — editable ({{ cvFormat === 'latex' ? 'tailored LaTeX' : 'Markdown' }})</label>
            <button v-if="cvError || !cv" class="btn-ghost text-xs" :disabled="!!loading" @click="regenerate('cv')">Retry CV</button>
          </div>
          <p v-if="cvError" class="mb-2 text-xs text-brand">{{ cvError }}</p>
          <textarea v-model="cv" rows="20" class="input resize-y font-mono text-xs" />
        </div>
        <div class="card">
          <div class="mb-1 flex items-center justify-between">
            <label class="label mb-0">Cover letter — editable ({{ coverFormat === 'latex' ? 'tailored LaTeX' : 'Markdown' }})</label>
            <button v-if="coverError || !coverLetter" class="btn-ghost text-xs" :disabled="!!loading" @click="regenerate('cover')">Retry cover letter</button>
          </div>
          <p v-if="coverError" class="mb-2 text-xs text-brand">{{ coverError }}</p>
          <textarea v-model="coverLetter" rows="20" class="input resize-y font-mono text-xs" />
        </div>
      </div>
      <div class="flex justify-end">
        <button class="btn-ghost" :disabled="!!loading" @click="reReview">Re-run ATS review after edits</button>
      </div>
    </template>
  </div>
</template>
