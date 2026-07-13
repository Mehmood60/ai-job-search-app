import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../http/errors';
import { requireAuth } from '../../auth/middleware';
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

export default router;
