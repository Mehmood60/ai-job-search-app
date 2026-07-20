<script setup lang="ts">
import { nextTick, ref } from 'vue';
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
const jobInput = ref(''); // pasted JD text OR a URL
const jobText = ref(''); // server-resolved JD text (reused across steps)
const userNotes = ref(''); // candidate notes to address gaps (treated as true facts)
const showNotes = ref(false);

const evalResult = ref<EvalResult | null>(null);
const evalProvider = ref('');

const cv = ref('');
const coverLetter = ref('');
const cvFormat = ref('markdown'); // 'latex' when tailored from a saved template
const coverFormat = ref('markdown');
const ats = ref<AtsResult | null>(null);
const usedProvider = ref('');

const stage = ref<'input' | 'evaluated' | 'review'>('input');
const loading = ref('');
const error = ref('');
const cvError = ref('');
const coverError = ref('');

// Rendered PDF previews (blob URLs) + whether the editor is shown.
const cvPdfUrl = ref('');
const coverPdfUrl = ref('');
const showEditor = ref(false);

// Live activity log (terminal-style) so the user sees what's happening.
const logs = ref<string[]>([]);
const logEl = ref<HTMLElement | null>(null);
function log(msg: string) {
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  logs.value.push(`${t}  ${msg}`);
  nextTick(() => {
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight;
  });
}

function revokePreviews() {
  if (cvPdfUrl.value) URL.revokeObjectURL(cvPdfUrl.value);
  if (coverPdfUrl.value) URL.revokeObjectURL(coverPdfUrl.value);
  cvPdfUrl.value = '';
  coverPdfUrl.value = '';
}

function b64ToBlobUrl(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

async function loadPreview() {
  if (!cv.value || !coverLetter.value) return;
  const { data } = await api.post('/package/preview', {
    cv: cv.value,
    coverLetter: coverLetter.value,
    cvFormat: cvFormat.value,
    coverFormat: coverFormat.value,
  });
  revokePreviews();
  cvPdfUrl.value = b64ToBlobUrl(data.cvPdf);
  coverPdfUrl.value = b64ToBlobUrl(data.coverPdf);
}

function reset() {
  jobInput.value = '';
  jobText.value = '';
  userNotes.value = '';
  showNotes.value = false;
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
  revokePreviews();
  showEditor.value = false;
  logs.value = [];
}

async function evaluate() {
  error.value = '';
  logs.value = [];
  const isUrl = /^https?:\/\//i.test(jobInput.value.trim());
  log(isUrl ? '→ Fetching job posting from link…' : '→ Reading job posting…');
  loading.value = 'Reading the posting and evaluating fit…';
  try {
    log('→ Evaluating fit against your profile…');
    await withRetry('Evaluate', async () => {
      const { data } = await api.post('/evaluate', {
        jobText: jobInput.value,
        userNotes: userNotes.value || undefined,
      });
      evalResult.value = data.result;
      evalProvider.value = data.usedProvider;
      jobText.value = data.jobText; // resolved (URL fetched server-side, if any)
    });
    log(`✓ Fit evaluated — score ${evalResult.value?.score}/100 (via ${evalProvider.value})`);
    stage.value = 'evaluated';
  } catch (e) {
    error.value = apiError(e);
    log(`✗ ${apiError(e)}`);
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

async function withRetry(label: string, fn: () => Promise<void>, maxRetries = 1): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await fn();
      return;
    } catch (e) {
      const wait = retryAfterSeconds(apiError(e));
      if (wait != null && attempt < maxRetries) {
        log(`⏳ ${label}: provider rate limit — waiting ${wait}s then retrying…`);
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
    const { data } = await api.post('/generate/cv', {
      jobText: jobText.value,
      userNotes: userNotes.value || undefined,
    });
    cv.value = data.cv;
    cvFormat.value = data.format;
    usedProvider.value = data.usedProvider;
  });
}

async function genCover() {
  coverError.value = '';
  await withRetry('Cover letter', async () => {
    const { data } = await api.post('/generate/cover-letter', {
      jobText: jobText.value,
      userNotes: userNotes.value || undefined,
    });
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
  log('→ Tailoring your CV to this posting…');
  try {
    await genCv();
    log(`✓ CV tailored (via ${usedProvider.value})`);
  } catch (e) {
    cvError.value = apiError(e);
    log(`✗ CV: ${apiError(e)}`);
  }
  loading.value = 'Tailoring your cover letter…';
  log('→ Tailoring your cover letter…');
  try {
    await genCover();
    log('✓ Cover letter tailored');
  } catch (e) {
    coverError.value = apiError(e);
    log(`✗ Cover letter: ${apiError(e)}`);
  }
  stage.value = 'review';
  if (cv.value && coverLetter.value) {
    loading.value = 'Rendering PDF preview…';
    log('→ Rendering PDFs…');
    try {
      await loadPreview();
      log('✓ PDFs rendered');
    } catch (e) {
      error.value = apiError(e);
      log(`✗ Render: ${apiError(e)}`);
    }
    loading.value = 'Running ATS review…';
    log('→ Running ATS review…');
    try {
      await runAts();
      log('✓ ATS review complete');
    } catch {
      log('• ATS review skipped');
    }
  }
  log('✓ Done — review your documents below');
  loading.value = '';
}

// Re-render the PDF preview (and ATS) after the user edits the Markdown.
async function refreshAfterEdit() {
  error.value = '';
  loading.value = 'Re-rendering preview…';
  try {
    await loadPreview();
    await runAts().catch(() => undefined);
  } catch (e) {
    error.value = apiError(e);
  } finally {
    loading.value = '';
  }
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
        cvFormat: cvFormat.value,
        coverFormat: coverFormat.value,
      },
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Application.zip';
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

// Detect provider free-tier/quota/rate errors so we can show helpful guidance.
const isLimitError = (msg: string) =>
  /resourceexhausted|resource exhausted|limit reached|rate limit|quota|429|exhausted|too many/i.test(msg || '');
</script>

<template>
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-bold">Apply</h1>
    <button v-if="stage !== 'input'" class="btn-ghost" :disabled="!!loading" @click="reset">Start over</button>
  </div>

  <!-- Progress indicator — always visible while something is running -->
  <div
    v-if="loading"
    class="mb-4 flex items-center gap-3 rounded-md border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-brand"
  >
    <span class="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent"></span>
    <span>{{ loading }}</span>
  </div>

  <div v-if="error" class="mb-4 rounded-md border border-brand/30 bg-brand/5 px-4 py-3 text-sm">
    <p class="text-brand">{{ error }}</p>
    <p v-if="isLimitError(error)" class="mt-1 text-xs text-gray-500">
      This provider hit its free-tier limit. Wait a few minutes, switch/add a provider in Settings, or use a paid key
      for no limits.
    </p>
  </div>

  <div class="space-y-6">
    <!-- Step 1: job input + evaluate (with live activity log beside it) -->
    <div class="card">
      <div class="grid gap-5 lg:grid-cols-5">
        <!-- Job posting input (full width until activity starts) -->
        <div :class="logs.length ? 'lg:col-span-3' : 'lg:col-span-5'">
          <label class="label">Job posting — paste the full description or a link</label>
          <textarea
            v-model="jobInput"
            rows="16"
            class="input resize-y font-mono text-xs"
            placeholder="Paste the full job description, or a URL to it (e.g. https://…)"
            :disabled="stage !== 'input'"
          />
          <button
            v-if="stage === 'input'"
            class="btn-primary mt-4"
            :disabled="!!loading || jobInput.trim().length < 5"
            @click="evaluate"
          >
            {{ loading || 'Evaluate fit' }}
          </button>
        </div>

        <!-- Activity log — only appears once processing starts -->
        <div v-if="logs.length" class="lg:col-span-2">
          <label class="label">Activity</label>
          <div
            ref="logEl"
            class="h-[calc(16rem+2.5rem)] overflow-y-auto rounded-md border border-gray-800 bg-gray-900 p-3 font-mono text-xs leading-relaxed text-green-300"
          >
            <p v-for="(line, i) in logs" :key="i" class="whitespace-pre-wrap break-words">{{ line }}</p>
            <p v-if="loading" class="text-brand">
              <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-brand"></span> {{ loading }}
            </p>
          </div>
        </div>
      </div>
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

      <div v-if="stage === 'evaluated'" class="mt-6 space-y-4 border-t border-gray-100 pt-4">
        <!-- User notes to address gaps -->
        <div>
          <button class="btn-ghost" @click="showNotes = !showNotes">
            {{ showNotes ? 'Hide notes' : '+ Add your notes' }}
          </button>
          <div v-if="showNotes" class="mt-3">
            <label class="label">Your notes (optional) — correct or add anything the evaluation missed</label>
            <textarea
              v-model="userNotes"
              rows="4"
              class="input resize-y"
              placeholder="e.g. 'I do have IoT/embedded exposure — built multi-user VR (Unity/Photon) and a HoloLens mixed-reality app.' · 'I'm willing to relocate to Munich.' These are treated as true and woven into your CV & cover letter to address the gaps above."
            />
            <button
              class="btn-ghost mt-2"
              :disabled="!!loading || !userNotes.trim()"
              @click="evaluate"
            >
              Re-evaluate with notes
            </button>
          </div>
        </div>

        <div>
          <button class="btn-primary" :disabled="!!loading" @click="generate">
            {{ loading || 'Generate CV & Cover letter for this job' }}
          </button>
          <p class="mt-2 text-xs text-gray-400">
            Generates a tailored CV & cover letter from your profile (and your notes above) for this posting — nothing
            is shortened — then renders both to PDF to preview before downloading.
          </p>
        </div>
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
            Happy with the preview below? Download the ZIP (JD + both PDFs). Nothing is stored on the server.
          </p>
          <button class="btn-ghost" :disabled="!!loading" @click="reset">Reject</button>
          <button class="btn-primary" :disabled="!!loading || !cv || !coverLetter" @click="download">
            {{ loading || 'Download ZIP' }}
          </button>
        </div>
      </div>

      <!-- Retry banners if a document failed to generate -->
      <div v-if="cvError || coverError" class="flex flex-wrap gap-3">
        <div v-if="cvError" class="card flex-1 border-brand/30">
          <p class="text-sm text-brand">CV: {{ cvError }}</p>
          <p v-if="isLimitError(cvError)" class="mt-1 text-xs text-gray-500">Free-tier limit hit — wait a few minutes or switch provider in Settings.</p>
          <button class="btn-ghost mt-2" :disabled="!!loading" @click="regenerate('cv')">Retry CV</button>
        </div>
        <div v-if="coverError" class="card flex-1 border-brand/30">
          <p class="text-sm text-brand">Cover letter: {{ coverError }}</p>
          <p v-if="isLimitError(coverError)" class="mt-1 text-xs text-gray-500">Free-tier limit hit — wait a few minutes or switch provider in Settings.</p>
          <button class="btn-ghost mt-2" :disabled="!!loading" @click="regenerate('cover')">Retry cover letter</button>
        </div>
      </div>

      <!-- PDF previews -->
      <div class="grid gap-6 md:grid-cols-2">
        <div class="card">
          <h3 class="mb-2 font-semibold">CV preview</h3>
          <iframe v-if="cvPdfUrl" :src="cvPdfUrl" class="h-[75vh] w-full rounded border border-gray-200" title="CV preview" />
          <p v-else class="text-sm text-gray-400">No preview yet — generate or retry the CV.</p>
        </div>
        <div class="card">
          <h3 class="mb-2 font-semibold">Cover letter preview</h3>
          <iframe v-if="coverPdfUrl" :src="coverPdfUrl" class="h-[75vh] w-full rounded border border-gray-200" title="Cover letter preview" />
          <p v-else class="text-sm text-gray-400">No preview yet — generate or retry the cover letter.</p>
        </div>
      </div>

      <!-- Optional inline editing of the underlying content -->
      <div class="card">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Edit content (optional)</h3>
          <button class="btn-ghost" @click="showEditor = !showEditor">{{ showEditor ? 'Hide editor' : 'Edit text' }}</button>
        </div>
        <div v-if="showEditor" class="mt-4 space-y-4">
          <div>
            <label class="label">CV (Markdown)</label>
            <textarea v-model="cv" rows="16" class="input resize-y font-mono text-xs" />
          </div>
          <div>
            <label class="label">Cover letter (Markdown)</label>
            <textarea v-model="coverLetter" rows="14" class="input resize-y font-mono text-xs" />
          </div>
          <button class="btn-primary" :disabled="!!loading" @click="refreshAfterEdit">Update preview & ATS</button>
        </div>
      </div>
    </template>
  </div>
</template>
