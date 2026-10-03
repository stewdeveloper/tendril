import { chromium, type Browser } from 'playwright';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** This WSL box lacks libnss3/libnspr4/libasound without sudo; they live in ~/.cache/tendril-chromium-libs. */
export async function launch(): Promise<Browser> {
  const libs = join(homedir(), '.cache', 'tendril-chromium-libs');
  const env = { ...process.env } as Record<string, string>;
  if (existsSync(libs)) env.LD_LIBRARY_PATH = [libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  return chromium.launch({ env });
}
