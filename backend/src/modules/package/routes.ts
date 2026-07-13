import archiver from 'archiver';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../http/errors';
import { requireAuth } from '../../auth/middleware';
import { loadProfile, loadSettings } from '../userData';
import { renderPdf } from '../../pdf';

const router = Router();
router.use(requireAuth);

const body = z.object({
  jobText: z.string().min(1),
  cv: z.string().min(1),
  coverLetter: z.string().min(1),
  company: z.string().default('Company'),
});

function sanitize(s: string): string {
  return s.replace(/[^\w.\- ]+/g, '').trim() || 'Company';
}

// POST /api/package — compile CV + cover letter to PDF, bundle with the JD into a
// ZIP, and stream it as a download. Nothing is persisted server-side.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { jobText, cv, coverLetter, company } = body.parse(req.body);
    const [profile, settings] = await Promise.all([loadProfile(req.userId!), loadSettings(req.userId!)]);

    const name = (profile.fullName || 'Candidate').trim();
    const companyClean = sanitize(company);

    const [cvPdf, coverPdf] = await Promise.all([
      renderPdf({
        kind: 'cv',
        content: cv,
        title: `${name} — CV`,
        latexTemplate: settings.latexTemplates.cv,
      }),
      renderPdf({
        kind: 'cover',
        content: coverLetter,
        title: `${name} — Cover Letter`,
        latexTemplate: settings.latexTemplates.cover,
      }),
    ]);

    const zipName = `${name} - ${companyClean} - Application.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName.replace(/"/g, '')}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('ZIP error:', err);
      res.destroy(err);
    });
    archive.pipe(res);

    archive.append(jobText, { name: 'job_description.txt' });
    archive.append(cvPdf, { name: `${name} - CV - ${companyClean}.pdf` });
    archive.append(coverPdf, { name: `${name} - Cover Letter - ${companyClean}.pdf` });
    await archive.finalize();
  }),
);

export default router;
