import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../http/errors';
import { requireAuth } from '../../auth/middleware';
import { aiLimiter } from '../../http/rateLimit';
import { completeWithSettings } from '../../ai/registry';
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
  const template = kind === 'cv' ? settings.latexTemplates.cv : settings.latexTemplates.cover;
  const profileText = profileToText(profile);
  // Fetched postings (esp. LinkedIn) carry a lot of boilerplate; cap to keep the
  // request within provider token limits. The essential JD text fits easily.
  const jd = jobText.slice(0, 6000);

  if (template && template.trim()) {
    // Tailor a copy of the user's own document. `template` is read-only here.
    // Output is sized to the source (+ margin); the whole thing must fit the
    // provider's per-request token budget alongside the input.
    const maxTokens = kind === 'cv' ? 5200 : 3000;
    const { text, usedProvider } = await completeWithSettings(settings, {
      system: kind === 'cv' ? TAILOR_CV_SYSTEM : TAILOR_COVER_SYSTEM,
      user: tailorUser(template, jd),
      maxTokens,
    });
    return { content: stripFence(text), format: 'latex', usedProvider, jobText };
  }

  const { text, usedProvider } = await completeWithSettings(settings, {
    system: kind === 'cv' ? CV_SYSTEM : COVER_SYSTEM,
    user: kind === 'cv' ? cvUser(profileText, jd) : coverUser(profileText, jd),
    maxTokens: 4096,
  });
  return { content: text, format: 'markdown', usedProvider, jobText };
}

// POST /api/evaluate — fit score + rationale. Resolves a URL to JD text and returns
// the resolved text so the client can reuse it for generation. Nothing stored.
router.post(
  '/evaluate',
  asyncHandler(async (req, res) => {
    const { jobText: raw } = jobBody.parse(req.body);
    const jobText = await resolveJobText(raw);
    const [profile, settings] = await Promise.all([loadProfile(req.userId!), loadSettings(req.userId!)]);
    const { text, usedProvider } = await completeWithSettings(settings, {
      system: EVALUATE_SYSTEM,
      user: evaluateUser(profileToText(profile), jobText.slice(0, 6000)),
      maxTokens: 2048,
    });
    res.json({ result: parseJsonLoose(text), usedProvider, jobText });
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
    const { text, usedProvider } = await completeWithSettings(settings, {
      system: ATS_SYSTEM,
      user: atsUser(jobText.slice(0, 6000), cv, coverLetter),
      maxTokens: 2048,
    });
    res.json({ result: parseJsonLoose(text), usedProvider });
  }),
);

export default router;
