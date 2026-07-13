import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../http/errors';
import { login, register } from './service';

const router = Router();

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    const result = await register(email, password);
    res.status(201).json(result);
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    const result = await login(email, password);
    res.json(result);
  }),
);

export default router;
