import { promises as fs } from 'fs';
import path from 'path';
import { Profile, Settings, User } from '../types';

export interface DbShape {
  users: User[];
  profiles: Profile[];
  settings: Settings[];
}

const EMPTY: DbShape = { users: [], profiles: [], settings: [] };

// Minimal file-backed JSON store with serialized writes (no external deps).
// Holds the whole DB in memory; every mutation is persisted atomically.
export class JsonStore {
  private data: DbShape = structuredClone(EMPTY);
  private writeChain: Promise<void> = Promise.resolve();
  private loaded = false;

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DbShape>;
      this.data = { ...structuredClone(EMPTY), ...parsed };
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.persist();
      } else {
        throw err;
      }
    }
    this.loaded = true;
  }

  // Read a snapshot. Callers must not mutate the returned reference directly;
  // use `mutate` for changes.
  read(): DbShape {
    return this.data;
  }

  // Serialize mutations so concurrent requests never clobber the file.
  async mutate<T>(fn: (db: DbShape) => T): Promise<T> {
    const run = this.writeChain.then(async () => {
      const result = fn(this.data);
      await this.persist();
      return result;
    });
    // keep the chain going but swallow the value type
    this.writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async persist(): Promise<void> {
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    await fs.rename(tmp, this.filePath);
  }
}
