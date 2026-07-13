import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../http/errors';
import { requireAuth } from '../../auth/middleware';
import { completeWithSettings } from '../../ai/registry';
import { loadProfile, loadSettings } from '../userData';
import {
  ATS_SYSTEM,
  CV_SYSTEM,
  COVER_SYSTEM,
  EVALUATE_SYSTEM,
  atsUser,
  coverUser,
  cvUser,
  evaluateUser,
  parseJsonLoose,
  profileToText,
} from '../../prompts';

const router = Router();
router.use(requireAuth);

const jobBody = z.object({ jobText: z.string().min(20, 'Paste the full job posting') });
const atsBody = z.object({
  jobText: z.string().min(20),
  cv: z.string().min(1),
  coverLetter: z.string().min(1),
});

// POST /api/evaluate — fit score + rationale. Nothing stored.
router.post(
  '/evaluate',
  asyncHandler(async (req, res) => {
    const { jobText } = jobBody.parse(req.body);
    const [profile, settings] = await Promise.all([loadProfile(req.userId!), loadSettings(req.userId!)]);
    const { text, usedProvider } = await completeWithSettings(settings, {
      system: EVALUATE_SYSTEM,
      user: evaluateUser(profileToText(profile), jobText),
      maxTokens: 2048,
    });
    res.json({ result: parseJsonLoose(text), usedProvider });
  }),
);

// POST /api/generate/cv — tailored CV as Markdown. Nothing stored.
router.post(
  '/generate/cv',
  asyncHandler(async (req, res) => {
    const { jobText } = jobBody.parse(req.body);
    const [profile, settings] = await Promise.all([loadProfile(req.userId!), loadSettings(req.userId!)]);
    const { text, usedProvider } = await completeWithSettings(settings, {
      system: CV_SYSTEM,
      user: cvUser(profileToText(profile), jobText),
      maxTokens: 4096,
    });
    res.json({ cv: text, usedProvider });
  }),
);

// POST /api/generate/cover-letter — tailored cover letter. Nothing stored.
router.post(
  '/generate/cover-letter',
  asyncHandler(async (req, res) => {
    const { jobText } = jobBody.parse(req.body);
    const [profile, settings] = await Promise.all([loadProfile(req.userId!), loadSettings(req.userId!)]);
    const { text, usedProvider } = await completeWithSettings(settings, {
      system: COVER_SYSTEM,
      user: coverUser(profileToText(profile), jobText),
      maxTokens: 2048,
    });
    res.json({ coverLetter: text, usedProvider });
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
      user: atsUser(jobText, cv, coverLetter),
      maxTokens: 2048,
    });
    res.json({ result: parseJsonLoose(text), usedProvider });
  }),
);

export default router;
