import rateLimit from 'express-rate-limit';

// Brute-force protection for authentication (login + register). Keyed by client IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // generous for legit retries, blocks password brute-forcing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many attempts. Please wait a few minutes and try again.',
    code: 'RATE_LIMITED',
  },
});

// Protects the paid AI endpoints (evaluate / generate / ats-review / autofill) from
// rapid consumption that would drain an API balance. Keyed by client IP.
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI request limit reached. Please wait a few minutes before generating more.',
    code: 'RATE_LIMITED',
  },
});
