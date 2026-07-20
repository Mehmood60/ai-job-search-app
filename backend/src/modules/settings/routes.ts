import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../http/errors';
import { requireAuth } from '../../auth/middleware';
import { aiLimiter } from '../../http/rateLimit';
import { completeWithSettings } from '../../ai/registry';
import { EDIT_TEMPLATE_SYSTEM, editTemplateUser } from '../../prompts';
import { compileTectonic } from '../../pdf/tectonic';
import { findAsset } from '../../pdf/assets';
import { loadSettings } from '../userData';
import {
  addCustomProvider,
  getSettingsView,
  removeCustomProvider,
  setActiveProvider,
  setApiKey,
  setLatexTemplate,
  setModel,
} from './service';

const router = Router();
router.use(requireAuth);

// Strip an accidental ```lang ... ``` fence around model output.
function stripFence(s: string): string {
  const m = s.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n```\s*$/);
  return (m ? m[1] : s).trim();
}

const providerId = z.string().min(1);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getSettingsView(req.userId!));
  }),
);

router.put(
  '/api-key',
  asyncHandler(async (req, res) => {
    const { provider, key } = z.object({ provider: providerId, key: z.string() }).parse(req.body);
    res.json(await setApiKey(req.userId!, provider, key));
  }),
);

router.put(
  '/model',
  asyncHandler(async (req, res) => {
    const { provider, model } = z
      .object({ provider: providerId, model: z.string() })
      .parse(req.body);
    res.json(await setModel(req.userId!, provider, model));
  }),
);

router.put(
  '/active-provider',
  asyncHandler(async (req, res) => {
    const { provider } = z.object({ provider: providerId }).parse(req.body);
    res.json(await setActiveProvider(req.userId!, provider));
  }),
);

router.post(
  '/custom-provider',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        label: z.string().min(1).max(60),
        baseUrl: z.string().url(),
        defaultModel: z.string().min(1).max(120),
        apiKey: z.string().optional(),
      })
      .parse(req.body);
    res.json(await addCustomProvider(req.userId!, body));
  }),
);

router.delete(
  '/custom-provider/:id',
  asyncHandler(async (req, res) => {
    res.json(await removeCustomProvider(req.userId!, req.params.id));
  }),
);

router.put(
  '/latex-template',
  asyncHandler(async (req, res) => {
    const { kind, source } = z
      .object({ kind: z.enum(['cv', 'cover']), source: z.string().nullable() })
      .parse(req.body);
    res.json(await setLatexTemplate(req.userId!, kind, source));
  }),
);

// POST /settings/template-edit — edit the saved master CV/cover template via a
// natural-language instruction. Returns the edited LaTeX for review; does NOT save
// (the client shows it, then saves via /latex-template).
router.post(
  '/template-edit',
  aiLimiter,
  asyncHandler(async (req, res) => {
    const { kind, instruction } = z
      .object({ kind: z.enum(['cv', 'cover']), instruction: z.string().min(3).max(2000) })
      .parse(req.body);
    const settings = await loadSettings(req.userId!);
    const current = settings.latexTemplates[kind];
    if (!current || !current.trim()) {
      throw new AppError(400, `Save a ${kind} template first, then edit it with a command.`, 'NO_TEMPLATE');
    }
    const { text, usedProvider } = await completeWithSettings(settings, {
      system: EDIT_TEMPLATE_SYSTEM,
      user: editTemplateUser(instruction, current),
      maxTokens: 9000, // fit the whole document + a thinking model's overhead
      temperature: 0.2,
    });
    res.json({ template: stripFence(text), usedProvider });
  }),
);

// POST /settings/template-preview — render the saved master CV/cover template to PDF
// (LaTeX via Tectonic) and stream it, so the client can open it in a new tab.
router.post(
  '/template-preview',
  asyncHandler(async (req, res) => {
    const { kind } = z.object({ kind: z.enum(['cv', 'cover']) }).parse(req.body);
    const settings = await loadSettings(req.userId!);
    const tpl = settings.latexTemplates[kind];
    if (!tpl || !tpl.trim()) throw new AppError(400, `No ${kind} template saved yet.`, 'NO_TEMPLATE');
    const picture = kind === 'cv' ? findAsset('picture.jpeg') : null;
    const pdf = await compileTectonic(tpl, picture ? [{ name: 'picture.jpeg', path: picture }] : []);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${kind}-preview.pdf"`);
    res.send(pdf);
  }),
);

export default router;
