import archiver from 'archiver';
import { existsSync } from 'fs';
import path from 'path';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../http/errors';
import { requireAuth } from '../../auth/middleware';
import { loadProfile, loadSettings } from '../userData';
import { renderPdf } from '../../pdf';
import { compileLatexDoc } from '../../pdf/latex';

const router = Router();
router.use(requireAuth);

const docFormat = z.enum(['latex', 'markdown']).default('markdown');
const body = z.object({
  jobText: z.string().min(1),
  cv: z.string().min(1),
  coverLetter: z.string().min(1),
  company: z.string().default('Company'),
  cvFormat: docFormat,
  coverFormat: docFormat,
});

function sanitize(s: string): string {
  return s.replace(/[^\w.\- ]+/g, '').trim() || 'Company';
}

// Locate a template asset (e.g. the CV headshot) across likely layouts.
function findAsset(name: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), '..', 'cv', name),
    path.resolve(process.cwd(), 'cv', name),
    path.resolve(__dirname, '../../../../cv', name),
    path.resolve(__dirname, '../../../cv', name),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

interface Rendered {
  pdf: Buffer | null;
  tex: string | null; // tailored .tex source (latex mode), always shipped
  error?: string;
}

async function renderDoc(
  kind: 'cv' | 'cover',
  content: string,
  format: 'latex' | 'markdown',
  title: string,
  markdownTemplate: string | undefined,
): Promise<Rendered> {
  if (format === 'latex') {
    const engine = kind === 'cv' ? 'lualatex' : 'pdflatex';
    const picture = kind === 'cv' ? findAsset('picture.jpeg') : null;
    const assets = picture ? [{ name: 'picture.jpeg', path: picture }] : [];
    try {
      const pdf = await compileLatexDoc(content, engine, assets);
      return { pdf, tex: content };
    } catch (e) {
      // Compile failed (missing asset / TeX toolchain / LaTeX error) — still ship the
      // tailored .tex so the user can compile it locally.
      return { pdf: null, tex: content, error: (e as Error).message.slice(0, 300) };
    }
  }
  const pdf = await renderPdf({ kind, content, title, latexTemplate: markdownTemplate });
  return { pdf, tex: null };
}

// POST /api/package — render CV + cover to PDF (and include tailored .tex sources),
// bundle with the JD into a ZIP, stream it. Nothing is persisted server-side.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { jobText, cv, coverLetter, company, cvFormat, coverFormat } = body.parse(req.body);
    const [profile, settings] = await Promise.all([loadProfile(req.userId!), loadSettings(req.userId!)]);

    const name = (profile.fullName || 'Candidate').trim();
    const companyClean = sanitize(company);

    const [cvOut, coverOut] = await Promise.all([
      renderDoc('cv', cv, cvFormat, `${name} — CV`, cvFormat === 'markdown' ? settings.latexTemplates.cv : undefined),
      renderDoc(
        'cover',
        coverLetter,
        coverFormat,
        `${name} — Cover Letter`,
        coverFormat === 'markdown' ? settings.latexTemplates.cover : undefined,
      ),
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

    const notes: string[] = [];
    const add = (label: 'CV' | 'Cover Letter', out: Rendered) => {
      if (out.pdf) archive.append(out.pdf, { name: `${name} - ${label} - ${companyClean}.pdf` });
      if (out.tex) archive.append(out.tex, { name: `${name} - ${label} - ${companyClean}.tex` });
      if (!out.pdf && out.error) {
        notes.push(
          `${label}: PDF could not be compiled on the server (${out.error}). The tailored .tex is included — compile it locally with your TeX toolchain.`,
        );
      }
    };
    add('CV', cvOut);
    add('Cover Letter', coverOut);
    if (notes.length) archive.append(notes.join('\n\n'), { name: 'READ_ME.txt' });

    await archive.finalize();
  }),
);

export default router;
