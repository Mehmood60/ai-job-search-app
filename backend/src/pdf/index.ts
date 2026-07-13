import { markdownToPdf } from './html';
import { compileLatex, latexAvailable } from './latex';

export type DocKind = 'cv' | 'cover';

export interface RenderInput {
  kind: DocKind;
  content: string;
  title: string;
  // Optional user LaTeX template source with a {{CONTENT}} placeholder.
  latexTemplate?: string;
}

/**
 * Render a document to PDF. If the user supplied a LaTeX template AND a TeX
 * toolchain is available, use it (CV → lualatex, cover → pdflatex, matching the
 * workspace rules). Otherwise fall back to the HTML/CSS → PDF pipeline, which
 * works for everyone.
 */
export async function renderPdf(input: RenderInput): Promise<Buffer> {
  if (input.latexTemplate && (await latexAvailable())) {
    const engine = input.kind === 'cv' ? 'lualatex' : 'pdflatex';
    return compileLatex(input.latexTemplate, input.content, engine);
  }
  return markdownToPdf(input.content, input.title);
}
