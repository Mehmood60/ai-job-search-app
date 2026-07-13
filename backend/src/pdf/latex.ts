import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

// Escape a plain string for LaTeX.
function escapeLatex(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

// Convert a subset of Markdown to LaTeX body content. Best-effort — good enough to
// drop generated CV/cover content into a user's template placeholder.
export function markdownToLatex(md: string): string {
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push('\\end{itemize}');
      inList = false;
    }
  };

  const inline = (t: string): string => {
    let s = escapeLatex(t);
    s = s.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}');
    s = s.replace(/\*(.+?)\*/g, '\\textit{$1}');
    return s;
  };

  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      out.push('');
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      const cmd = level <= 1 ? '\\section*' : level === 2 ? '\\subsection*' : '\\subsubsection*';
      out.push(`${cmd}{${inline(h[2])}}`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push('\\begin{itemize}');
        inList = true;
      }
      out.push(`  \\item ${inline(bullet[1])}`);
      continue;
    }
    closeList();
    out.push(`${inline(line)}\\\\`);
  }
  closeList();
  return out.join('\n');
}

const CONTENT_TOKEN = /\{\{\s*CONTENT\s*\}\}|%%\s*CONTENT\s*%%/;

// Detect whether a LaTeX toolchain is available.
export async function latexAvailable(): Promise<boolean> {
  return runOk('latexmk', ['--version']).catch(() => runOk('pdflatex', ['--version']).catch(() => false));
}

function runOk(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: 'ignore' });
    p.on('error', () => resolve(false));
    p.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Compile a user's LaTeX template with the generated content injected at the
 * {{CONTENT}} placeholder. `engine` picks lualatex (CV) or pdflatex (cover) —
 * matching the workspace's rules. Requires a TeX toolchain in the environment.
 */
export async function compileLatex(
  template: string,
  content: string,
  engine: 'lualatex' | 'pdflatex',
): Promise<Buffer> {
  if (!CONTENT_TOKEN.test(template)) {
    throw new Error('LaTeX template must contain a {{CONTENT}} (or %% CONTENT %%) placeholder');
  }
  const tex = template.replace(CONTENT_TOKEN, markdownToLatex(content));

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aijs-latex-'));
  const texPath = path.join(dir, 'doc.tex');
  const pdfPath = path.join(dir, 'doc.pdf');
  try {
    await fs.writeFile(texPath, tex, 'utf8');
    await run(
      'latexmk',
      [`-${engine}`, '-interaction=nonstopmode', '-halt-on-error', '-outdir=' + dir, texPath],
      dir,
    );
    return await fs.readFile(pdfPath);
  } catch (err) {
    // Fallback: try the engine directly if latexmk isn't present.
    try {
      await run(engine, ['-interaction=nonstopmode', '-halt-on-error', '-output-directory=' + dir, texPath], dir);
      return await fs.readFile(pdfPath);
    } catch {
      throw new Error(
        `LaTeX compilation failed. Ensure a TeX distribution (latexmk/${engine}) is installed. ${(err as Error).message}`,
      );
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    p.stderr?.on('data', (d) => (stderr += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.slice(0, 400) || `exit ${code}`))));
  });
}
