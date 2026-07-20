import { existsSync } from 'fs';
import path from 'path';

// Locate a template asset (e.g. the CV headshot) across likely repo layouts.
export function findAsset(name: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), '..', 'cv', name),
    path.resolve(process.cwd(), 'cv', name),
    path.resolve(__dirname, '../../../../cv', name),
    path.resolve(__dirname, '../../../cv', name),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}
