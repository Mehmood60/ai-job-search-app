import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../http/errors';
import { requireAuth } from '../../auth/middleware';
import { aiLimiter } from '../../http/rateLimit';
import { completeWithSettings } from '../../ai/registry';
import { Settings } from '../../db/types';
import { CompleteOptions } from '../../ai/provider';
import { loadProfile, loadSettings } from '../userData';
import { resolveJobText } from '../jobText';
import {
  ATS_SYSTEM,
  CV_SYSTEM,
  COVER_SYSTEM,
  EVALUATE_SYSTEM,
  TAILOR_CV_SYSTEM,
  TAILOR_COVER_SYSTEM,
  atsUser,
  coverUser,
  cvUser,
  evaluateUser,
  parseJsonLoose,
  profileToText,
  tailorUser,
} from '../../prompts';

const router = Router();
router.use(requireAuth);
router.use(aiLimiter); // throttle paid AI calls (cost-abuse protection)

// jobText may be a pasted description OR a URL (resolved server-side).
const jobBody = z.object({ jobText: z.string().min(1, 'Paste a job posting or a link') });
const atsBody = z.object({
  jobText: z.string().min(1),
  cv: z.string().min(1),
  coverLetter: z.string().min(1),
});

// Strip an accidental ```lang ... ``` fence the model may wrap around output.
function stripFence(s: string): string {
  const m = s.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n```\s*$/);
  return (m ? m[1] : s).trim();
}

// Run a JSON-returning completion, retrying once if the model returns something
// unparseable (transient with flaky providers), then failing with a clean message.
async function completeJson<T>(
  settings: Settings,
  opts: CompleteOptions,
): Promise<{ result: T; usedProvider: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, usedProvider } = await completeWithSettings(settings, opts);
    try {
      return { result: parseJsonLoose<T>(text), usedProvider };
    } catch {
      /* retry once */
    }
  }
  throw new AppError(
    502,
    'The AI returned an unparseable response. Please try again in a moment.',
    'BAD_JSON',
  );
}

type DocKind = 'cv' | 'cover';

// Produce a tailored document. If the user saved a template for this kind, we tailor
// a COPY of it (keyword match, nothing shortened) — the stored original is never
// mutated. Otherwise we generate from the structured profile as Markdown.
async function generateDoc(
  userId: string,
  kind: DocKind,
  rawJobText: string,
): Promise<{ content: string; format: 'latex' | 'markdown'; usedProvider: string; jobText: string }> {
  const jobText = await resolveJobText(rawJobText);
  const [profile, settings] = await Promise.all([loadProfile(userId), loadSettings(userId)]);
  const profileText = profileToText(profile);
  // Fetched postings (esp. LinkedIn) carry a lot of boilerplate; cap to keep the
  // request within provider token limits. The essential JD text fits easily.
  const jd = jobText.slice(0, 6000);
  const template = kind === 'cv' ? settings.latexTemplates.cv : settings.latexTemplates.cover;

  if (template && template.trim()) {
    // Tailor a COPY of the user's own LaTeX template — same design/style, only wording
    // and keywords updated to the JD, nothing shortened. Rendered with Tectonic.
    // Generous maxTokens: the whole tailored doc + a reasoning model's "thinking".
    const maxTokens = kind === 'cv' ? 8000 : 6000;
    const { text, usedProvider } = await completeWithSettings(settings, {
      system: kind === 'cv' ? TAILOR_CV_SYSTEM : TAILOR_COVER_SYSTEM,
      user: tailorUser(template, jd),
      maxTokens,
      temperature: 0.2, // faithful to the original — minimise fabrication
    });
    return { content: stripFence(text), format: 'latex', usedProvider, jobText };
  }

  // No saved template → generate tailored Markdown (rendered via Chromium HTML→PDF).
  const { text, usedProvider } = await completeWithSettings(settings, {
    system: kind === 'cv' ? CV_SYSTEM : COVER_SYSTEM,
    user: kind === 'cv' ? cvUser(profileText, jd) : coverUser(profileText, jd),
    maxTokens: 4096,
    temperature: 0.3,
  });
  return { content: stripFence(text), format: 'markdown', usedProvider, jobText };
}

// POST /api/evaluate — fit score + rationale. Resolves a URL to JD text and returns
// the resolved text so the client can reuse it for generation. Nothing stored.
router.post(
  '/evaluate',
  asyncHandler(async (req, res) => {
    const { jobText: raw } = jobBody.parse(req.body);
    const jobText = await resolveJobText(raw);
    const [profile, settings] = await Promise.all([loadProfile(req.userId!), loadSettings(req.userId!)]);
    const { result, usedProvider } = await completeJson(settings, {
      system: EVALUATE_SYSTEM,
      user: evaluateUser(profileToText(profile), jobText.slice(0, 6000)),
      maxTokens: 4096, // headroom for "thinking" models (e.g. Gemini) so JSON isn't starved
      json: true,
    });
    res.json({ result, usedProvider, jobText });
  }),
);

// POST /api/generate/cv — tailored CV. Nothing stored.
router.post(
  '/generate/cv',
  asyncHandler(async (req, res) => {
    const { jobText } = jobBody.parse(req.body);
    const doc = await generateDoc(req.userId!, 'cv', jobText);
    res.json({ cv: doc.content, format: doc.format, usedProvider: doc.usedProvider, jobText: doc.jobText });
  }),
);

// POST /api/generate/cover-letter — tailored cover letter. Nothing stored.
router.post(
  '/generate/cover-letter',
  asyncHandler(async (req, res) => {
    const { jobText } = jobBody.parse(req.body);
    const doc = await generateDoc(req.userId!, 'cover', jobText);
    res.json({
      coverLetter: doc.content,
      format: doc.format,
      usedProvider: doc.usedProvider,
      jobText: doc.jobText,
    });
  }),
);

// POST /api/ats-review — ATS score + recommendations. Runs BEFORE download.
router.post(
  '/ats-review',
  asyncHandler(async (req, res) => {
    const { jobText, cv, coverLetter } = atsBody.parse(req.body);
    const settings = await loadSettings(req.userId!);
    const { result, usedProvider } = await completeJson(settings, {
      system: ATS_SYSTEM,
      user: atsUser(jobText.slice(0, 6000), cv, coverLetter),
      maxTokens: 4096, // headroom for "thinking" models so JSON isn't starved
      json: true,
    });
    res.json({ result, usedProvider });
  }),
);

export default router;
