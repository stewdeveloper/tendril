import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElementHandle } from 'playwright';
import { launch } from './chromium.ts';
import { DESIGN_DIR, INNER_DIR } from './paths.ts';
import { serveDir } from './serve.ts';

const PORT = Number(process.env.VISUAL_DESIGN_PORT ?? 8765);
const FILES = [
  'Tendril 2 Hero Screens',
  'Tendril 3 Onboarding',
  'Tendril 4 All Screens',
  'Tendril 6 Dark Mode',
];
const EXPECTED = 88;

async function main(): Promise<void> {
  mkdirSync(INNER_DIR, { recursive: true });
  const close = await serveDir(DESIGN_DIR, PORT, false);
  const browser = await launch();
  const seen = new Set<string>();
  try {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 1,
    });
    for (const file of FILES) {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/${encodeURIComponent(`${file}.dc.html`)}`, {
        waitUntil: 'networkidle',
      });
      await page.waitForTimeout(2500);
      await page.evaluate(() => document.fonts.ready);
      const ids = await page.$$eval('.dv-opt[id]', (cards) => cards.map((c) => c.id));
      for (const id of ids) {
        const card = await page.$(`.dv-opt[id="${id}"]`);
        const phone = (await card?.evaluateHandle((el) =>
          [...el.querySelectorAll('div')].find((d) => {
            const s = getComputedStyle(d);
            return s.width === '393px' && s.height === '852px';
          }),
        )) as ElementHandle<Element> | undefined;
        const element = phone?.asElement();
        if (!element) {
          console.warn(`${file}: no 393x852 phone inside #${id}`);
          continue;
        }
        if (seen.has(id)) console.warn(`${file}: duplicate frame id ${id}`);
        // Drop the bezel ring and rounded corners: the catalog frame is a plain 393x852 box.
        await element.evaluate((el) => {
          (el as HTMLElement).style.boxShadow = 'none';
          (el as HTMLElement).style.borderRadius = '0';
        });
        writeFileSync(join(INNER_DIR, `${id}.png`), await element.screenshot({ type: 'png' }));
        seen.add(id);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    await close();
  }
  console.log(`rendered ${seen.size} frames to ${INNER_DIR}`);
  if (seen.size !== EXPECTED) {
    console.warn(`expected ${EXPECTED} frames`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
