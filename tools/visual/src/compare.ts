import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export function compareImages(a: PNG, b: PNG): { diffPercent: number; diff: PNG } {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const crop = (src: PNG) => {
    const out = new PNG({ width, height });
    PNG.bitblt(src, out, 0, 0, width, height, 0, 0);
    return out;
  };
  const diff = new PNG({ width, height });
  const changed = pixelmatch(crop(a).data, crop(b).data, diff.data, width, height, {
    threshold: 0.15,
  });
  return { diffPercent: (changed / (width * height)) * 100, diff };
}

const GAP = 16;
const BACKGROUND: [number, number, number] = [0xec, 0xea, 0xe3];

/** Lays the panels out left to right on the design-board background, with a gap around each. */
export function sideBySide(panels: PNG[]): PNG {
  const width = panels.reduce((sum, p) => sum + p.width, 0) + GAP * (panels.length + 1);
  const height = Math.max(...panels.map((p) => p.height)) + GAP * 2;
  const out = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) out.data.set([...BACKGROUND, 255], i * 4);
  let x = GAP;
  for (const panel of panels) {
    PNG.bitblt(panel, out, 0, 0, panel.width, panel.height, x, GAP);
    x += panel.width + GAP;
  }
  return out;
}

function readPng(path: string): PNG {
  return PNG.sync.read(readFileSync(path));
}

/** Frame ids that have a PNG in `dir`. */
function ids(dir: string): string[] {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.png'))
        .map((f) => f.slice(0, -'.png'.length))
    : [];
}

export function main(argv: string[]): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const designDir = join(root, 'design', 'screens-inner');
  const appDir = join(root, 'design', 'compare', 'app');
  const outDir = join(root, 'design', 'compare');
  mkdirSync(outDir, { recursive: true });

  const wanted = argv.length > 0 ? argv : ids(appDir);
  const rows: { id: string; diffPercent: number }[] = [];
  for (const id of wanted) {
    const designPath = join(designDir, `${id}.png`);
    const appPath = join(appDir, `${id}.png`);
    if (!existsSync(designPath) || !existsSync(appPath)) {
      console.warn(`skip ${id}: needs both ${designPath} and ${appPath}`);
      continue;
    }
    const design = readPng(designPath);
    const app = readPng(appPath);
    const { diffPercent, diff } = compareImages(design, app);
    writeFileSync(join(outDir, `${id}.png`), PNG.sync.write(sideBySide([design, app, diff])));
    rows.push({ id, diffPercent });
  }
  rows.sort((x, y) => y.diffPercent - x.diffPercent);
  for (const { id, diffPercent } of rows) console.log(`${id}\t${diffPercent.toFixed(2)}%`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
