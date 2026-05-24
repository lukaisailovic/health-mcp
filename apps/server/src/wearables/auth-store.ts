import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { Mutex } from './mutex.js';
import type { AuthRecord, WearableProviderId } from './types.js';

type AuthFile = {
  version: 1;
  providers: Record<string, AuthRecord>;
};

export class AuthStore {
  private path: string;
  private allowInsecure: boolean;
  private mutexes = new Map<string, Mutex>();

  constructor(opts: { authDir: string; allowInsecure: boolean }) {
    this.path = join(opts.authDir, 'auth.json');
    this.allowInsecure = opts.allowInsecure;
    if (!existsSync(opts.authDir)) {
      mkdirSync(opts.authDir, { recursive: true, mode: 0o700 });
    }
  }

  private mutexFor(provider: string): Mutex {
    let m = this.mutexes.get(provider);
    if (!m) {
      m = new Mutex();
      this.mutexes.set(provider, m);
    }
    return m;
  }

  private readUnsafe(): AuthFile {
    if (!existsSync(this.path)) return { version: 1, providers: {} };
    if (!this.allowInsecure) {
      const st = statSync(this.path);
      const mode = st.mode & 0o777;
      if (mode & 0o077) {
        throw new Error(
          `auth file ${this.path} has permissions ${mode.toString(8)} - refuse to open. Pass --allow-insecure-auth to override.`,
        );
      }
    }
    const raw = readFileSync(this.path, 'utf8');
    if (!raw.trim()) return { version: 1, providers: {} };
    return JSON.parse(raw) as AuthFile;
  }

  private writeUnsafe(file: AuthFile): void {
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(file, null, 2), { mode: 0o600 });
    const fd = openSync(tmp, 'r+');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, this.path);
    try {
      chmodSync(this.path, 0o600);
    } catch {
      // best-effort
    }
  }

  list(): Record<string, AuthRecord> {
    return this.readUnsafe().providers;
  }

  get(provider: WearableProviderId): AuthRecord | null {
    return this.readUnsafe().providers[provider] ?? null;
  }

  async update<T>(
    provider: WearableProviderId,
    fn: (
      current: AuthRecord | null,
    ) => Promise<{ next: AuthRecord | null; ret?: T }> | { next: AuthRecord | null; ret?: T },
  ): Promise<T | undefined> {
    return this.mutexFor(provider).run(async () => {
      const file = this.readUnsafe();
      const current = file.providers[provider] ?? null;
      const result = await fn(current);
      if (result.next === null) {
        delete file.providers[provider];
      } else {
        file.providers[provider] = result.next;
      }
      this.writeUnsafe(file);
      return result.ret;
    });
  }

  async set(provider: WearableProviderId, record: AuthRecord | null): Promise<void> {
    await this.update(provider, () => ({ next: record }));
  }
}
