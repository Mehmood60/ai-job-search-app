import { spawn } from 'child_process';
import { promises as fs, existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { env } from '../config/env';

export interface TexAsset {
  name: string; // filename referenced inside the .tex (e.g. "picture.jpeg")
  path: string; // absolute source path to copy in
}

// Resolve the Tectonic binary: prefer an explicit TECTONIC_PATH, else check the
// default install location (~/tectonic), else fall back to a bare-name PATH lookup.
// This avoids depending on the shell that launched the server having the env set.
function resolveTectonicBin(): string {
  if (env.TECTONIC_PATH && env.TECTONIC_PATH !== 'tectonic' && existsSync(env.TECTONIC_PATH)) {
    return env.TECTONIC_PATH;
  }
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    home && path.join(home, 'tectonic', 'tectonic.exe'),
    home && path.join(home, 'tectonic', 'tectonic'),
  ].filter(Boolean) as string[];
  for (const c of candidates) if (existsSync(c)) return c;
  return env.TECTONIC_PATH || 'tectonic';
}

// Compile a complete standalone LaTeX document to PDF using Tectonic (self-contained,
// headless — no MiKTeX update nags, auto-fetches packages, caches its bundle).
export async function compileTectonic(tex: string, assets: TexAsset[] = []): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aijs-tec-'));
  const texPath = path.join(dir, 'doc.tex');
  const pdfPath = path.join(dir, 'doc.pdf');
  try {
    await fs.writeFile(texPath, tex, 'utf8');
    for (const a of assets) {
      await fs.copyFile(a.path, path.join(dir, a.name)).catch(() => undefined);
    }
    await run(resolveTectonicBin(), ['-X', 'compile', '--outdir', dir, texPath], dir);
    return await fs.readFile(pdfPath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // shell:true so Windows resolves tectonic(.exe) via PATHEXT.
    const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'], shell: true });
    let stderr = '';
    p.stderr?.on('data', (d) => (stderr += d.toString()));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`Tectonic failed (exit ${code}): ${stderr.slice(-600)}`)),
    );
  });
}
