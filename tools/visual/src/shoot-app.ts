import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './chromium.ts';
import { APP_SHOTS_DIR, INNER_DIR, MOBILE_DIR, ROOT } from './paths.ts';
import { serveDir } from './serve.ts';

const PORT = Number(process.env.VISUAL_APP_PORT ?? 8766);
const DIST = join(MOBILE_DIR, 'dist');

function exportWeb(): void {
  const result = spawnSync('pnpm', ['--filter', '@tendril/mobile', 'export:web', '--clear'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_CATALOG: '1' },
  });
  if (result.status !== 0) throw new Error('web export failed');
}

function designIds(): string[] {
  return readdirSync(INNER_DIR)
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.slice(0, -'.png'.length))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const build = !args.includes('--no-build');
  const requested = args.filter((a) => !a.startsWith('--'));
  const ids = requested.length > 0 ? requested : designIds();

  if (build) exportWeb();
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error(`${DIST} has no index.html: run without --no-build first`);
  }
  mkdirSync(APP_SHOTS_DIR, { recursive: true });

  const close = await serveDir(DIST, PORT, true);
  const browser = await launch();
  const missing: string[] = [];
  let shot = 0;
  try {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    for (const id of ids) {
      await page.goto(`http://127.0.0.1:${PORT}/catalog/${encodeURIComponent(id)}`, {
        waitUntil: 'load',
      });
      const frame = page.locator('[data-testid="catalog-frame"]');
      try {
        await frame.waitFor({ state: 'visible', timeout: requested.length > 0 ? 15_000 : 4_000 });
      } catch {
        missing.push(id);
        continue;
      }
      await page.evaluate(() => document.fonts.ready);
      await frame.screenshot({ path: join(APP_SHOTS_DIR, `${id}.png`), type: 'png' });
      shot++;
    }
  } finally {
    await browser.close();
    await close();
  }
  console.log(`screenshotted ${shot} frame(s) to ${APP_SHOTS_DIR}`);
  if (missing.length > 0) {
    const summary = missing.length > 12 ? `${missing.length} ids` : missing.join(', ');
    console.warn(`not registered in the catalog (skipped): ${summary}`);
    if (requested.length > 0) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
