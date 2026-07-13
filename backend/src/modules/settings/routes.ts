import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../http/errors';
import { requireAuth } from '../../auth/middleware';
import {
  getSettingsView,
  setActiveProvider,
  setApiKey,
  setLatexTemplate,
  setModel,
} from './service';

const router = Router();
router.use(requireAuth);

const providerEnum = z.enum(['grok', 'openai', 'claude']);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getSettingsView(req.userId!));
  }),
);

router.put(
  '/api-key',
  asyncHandler(async (req, res) => {
    const { provider, key } = z.object({ provider: providerEnum, key: z.string() }).parse(req.body);
    res.json(await setApiKey(req.userId!, provider, key));
  }),
);

router.put(
  '/model',
  asyncHandler(async (req, res) => {
    const { provider, model } = z
      .object({ provider: providerEnum, model: z.string() })
      .parse(req.body);
    res.json(await setModel(req.userId!, provider, model));
  }),
);

router.put(
  '/active-provider',
  asyncHandler(async (req, res) => {
    const { provider } = z.object({ provider: providerEnum }).parse(req.body);
    res.json(await setActiveProvider(req.userId!, provider));
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

export default router;
