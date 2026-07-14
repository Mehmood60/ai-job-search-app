import archiver from 'archiver';
import { existsSync } from 'fs';
import path from 'path';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../http/errors';
import { requireAuth } from '../../auth/middleware';
import { loadProfile } from '../userData';
import { markdownToPdf } from '../../pdf/html';
import { compileTectonic } from '../../pdf/tectonic';

const router = Router();
router.use(requireAuth);

const docFormat = z.enum(['latex', 'markdown']).default('markdown');
const previewBody = z.object({
  cv: z.string().min(1),
  coverLetter: z.string().min(1),
  cvFormat: docFormat,
  coverFormat: docFormat,
});
const zipBody = previewBody.extend({
  jobText: z.string().min(1),
  company: z.string().default('Company'),
});

function sanitize(s: string): string {
  return s.replace(/[^\w.\- ]+/g, '').trim() || 'Company';
}

// Locate a template asset (e.g. the CV headshot) across likely repo layouts.
function findAsset(name: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), '..', 'cv', name),
    path.resolve(process.cwd(), 'cv', name),
    path.resolve(__dirname, '../../../../cv', name),
    path.resolve(__dirname, '../../../cv', name),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

// Render one document to a PDF Buffer. LaTeX → Tectonic (CV gets its headshot);
// Markdown → Chromium HTML→PDF.
async function renderDoc(
  kind: 'cv' | 'cover',
  content: string,
  format: 'latex' | 'markdown',
  title: string,
): Promise<Buffer> {
  if (format === 'latex') {
    const picture = kind === 'cv' ? findAsset('picture.jpeg') : null;
    const assets = picture ? [{ name: 'picture.jpeg', path: picture }] : [];
    return compileTectonic(content, assets);
  }
  return markdownToPdf(content, title);
}

// POST /api/package/preview — render both documents to PDF, return base64 for in-app
// preview. Nothing is stored.
router.post(
  '/preview',
  asyncHandler(async (req, res) => {
    const { cv, coverLetter, cvFormat, coverFormat } = previewBody.parse(req.body);
    const profile = await loadProfile(req.userId!);
    const name = (profile.fullName || 'Candidate').trim();
    const [cvPdf, coverPdf] = await Promise.all([
      renderDoc('cv', cv, cvFormat, `${name} — CV`),
      renderDoc('cover', coverLetter, coverFormat, `${name} — Cover Letter`),
    ]);
    res.json({ cvPdf: cvPdf.toString('base64'), coverPdf: coverPdf.toString('base64') });
  }),
);

// POST /api/package — render CV + cover to PDF, bundle with the JD into a ZIP, stream
// it. Nothing is persisted server-side.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { jobText, cv, coverLetter, company, cvFormat, coverFormat } = zipBody.parse(req.body);
    const profile = await loadProfile(req.userId!);
    const name = (profile.fullName || 'Candidate').trim();
    const companyClean = sanitize(company);

    const [cvPdf, coverPdf] = await Promise.all([
      renderDoc('cv', cv, cvFormat, `${name} — CV`),
      renderDoc('cover', coverLetter, coverFormat, `${name} — Cover Letter`),
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
