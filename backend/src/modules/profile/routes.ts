import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../http/errors';
import { requireAuth } from '../../auth/middleware';
import { getDataLayer } from '../../db';
import { emptyProfile } from '../../db/types';
import { loadProfile } from '../userData';

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

export default router;
