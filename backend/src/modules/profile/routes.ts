import { Router } from 'express';
import pdfParse from 'pdf-parse';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../http/errors';
import { requireAuth } from '../../auth/middleware';
import { getDataLayer } from '../../db';
import { emptyProfile } from '../../db/types';
import { aiLimiter } from '../../http/rateLimit';
import { completeWithSettings } from '../../ai/registry';
import { EXTRACT_PROFILE_SYSTEM, extractProfileUser, parseJsonLoose } from '../../prompts';
import { loadProfile, loadSettings } from '../userData';

const router = Router();
router.use(requireAuth);

const experienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  bullets: z.array(z.string()).default([]),
});

const educationSchema = z.object({
  degree: z.string(),
  institution: z.string(),
  location: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  notes: z.string().optional(),
});

const projectSchema = z.object({
  name: z.string(),
  description: z.string(),
  url: z.string().optional(),
});

const profileSchema = z.object({
  fullName: z.string().default(''),
  headline: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  location: z.string().default(''),
  links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  summary: z.string().default(''),
  skills: z.array(z.string()).default([]),
  experience: z.array(experienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  projects: z.array(projectSchema).default([]),
  languages: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await loadProfile(req.userId!));
  }),
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = profileSchema.parse(req.body);
    const db = await getDataLayer();
    const profile = {
      ...emptyProfile(req.userId!),
      ...parsed,
      userId: req.userId!,
      updatedAt: new Date().toISOString(),
    };
    res.json(await db.profiles.upsert(profile));
  }),
);

// Reduce LaTeX source to readable plain text (best-effort). No-ops on plain/PDF text.
function latexToText(raw: string): string {
  const isLatex = /\\documentclass|\\begin\{|\\[a-zA-Z]+\{/.test(raw);
  if (!isLatex) {
    return raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  let s = raw;
  // Keep only the document body.
  const begin = s.indexOf('\\begin{document}');
  if (begin !== -1) s = s.slice(begin + '\\begin{document}'.length);
  const end = s.indexOf('\\end{document}');
  if (end !== -1) s = s.slice(0, end);
  return s
    .replace(/(^|[^\\])%.*$/gm, '$1') // strip comments (keep escaped \%)
    .replace(/\\(?:begin|end)\{[^}]*\}/g, '\n') // environment delimiters
    .replace(/\\item\b/g, '\n• ') // list items → bullets
    .replace(/\\\\(\[[^\]]*\])?/g, '\n') // explicit line breaks (+ optional [2pt] spacing)
    .replace(/\\[a-zA-Z@]+\*?(\[[^\]]*\])?/g, ' ') // strip command tokens (+ optional [args])
    .replace(/\\[;,:!> ]/g, ' ') // spacing macros \; \, \:
    .replace(/[{}]/g, ' ') // leftover grouping braces
    .replace(/\\([&%$#_])/g, '$1') // unescape specials
    .replace(/\([-\d.,\s]*\)/g, ' ') // tikz coordinates like (0,-0.5)
    .replace(/\b\d+(\.\d+)?(pt|cm|mm|em|ex|in)\b/g, ' ') // measurements with units
    .replace(/^[\s|;.\-]+$/gm, '') // lines of only punctuation
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Drop AI-returned placeholder entries that have no real content.
function cleanProfile(p: z.infer<typeof profileSchema>): z.infer<typeof profileSchema> {
  const nz = (s?: string) => !!(s && s.trim());
  return {
    ...p,
    links: p.links.filter((l) => nz(l.label) || nz(l.url)),
    skills: p.skills.filter((s) => nz(s)),
    languages: p.languages.filter((s) => nz(s)),
    certifications: p.certifications.filter((s) => nz(s)),
    experience: p.experience
      .filter((e) => nz(e.title) || nz(e.company))
      .map((e) => ({ ...e, bullets: e.bullets.filter((b) => nz(b)) })),
    education: p.education.filter((e) => nz(e.degree) || nz(e.institution)),
    projects: p.projects.filter((pr) => nz(pr.name) || nz(pr.description)),
  };
}

// POST /profile/autofill — extract a structured profile from a CV via the AI provider.
// Source is the saved .tex template, uploaded .tex text, or an uploaded PDF (base64).
// Returns the parsed profile for review; does NOT save it.
const autofillBody = z.object({
  useSavedCv: z.boolean().optional(),
  cvText: z.string().optional(),
  pdfBase64: z.string().optional(),
});

router.post(
  '/autofill',
  aiLimiter, // paid AI call — throttle to prevent balance drain
  asyncHandler(async (req, res) => {
    const { useSavedCv, cvText, pdfBase64 } = autofillBody.parse(req.body);
    const settings = await loadSettings(req.userId!);

    let text = '';
    if (useSavedCv) {
      text = settings.latexTemplates.cv || '';
      if (!text.trim()) throw new AppError(400, 'No saved CV template found in Settings.', 'NO_SAVED_CV');
    } else if (pdfBase64) {
      const buf = Buffer.from(pdfBase64, 'base64');
      const parsedPdf = await pdfParse(buf);
      text = parsedPdf.text || '';
    } else if (cvText) {
      text = cvText;
    } else {
      throw new AppError(400, 'Provide a CV via useSavedCv, cvText, or pdfBase64.', 'NO_CV_INPUT');
    }

    text = text.trim();
    if (!text) throw new AppError(400, 'Could not read any text from the CV.', 'EMPTY_CV');

    // Reduce LaTeX to plain text (a .tex is mostly preamble/markup that wastes tokens)
    // so the FULL CV content is sent for a complete extraction. Note: a large CV can
    // exceed very tight free-tier token limits (e.g. Groq 8b's 6k TPM) — use a model
    // with a higher limit (e.g. llama-3.3-70b-versatile) or another provider if so.
    const cleaned = latexToText(text).slice(0, 24000);

    const { text: aiText, usedProvider } = await completeWithSettings(settings, {
      system: EXTRACT_PROFILE_SYSTEM,
      user: extractProfileUser(cleaned),
      maxTokens: 4096,
    });

    const profile = cleanProfile(profileSchema.parse(parseJsonLoose(aiText)));
    res.json({ profile, usedProvider });
  }),
);

export default router;
