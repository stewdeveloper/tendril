import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('.', import.meta.url));

/** Every module specifier in a file: `from '…'`, `import '…'`, `import('…')`, `require('…')`. */
const SPECIFIER_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function specifiersIn(text: string): string[] {
  return SPECIFIER_PATTERNS.flatMap((pattern) => [...text.matchAll(pattern)].map((m) => m[1]!));
}

function isDenoLoadable(specifier: string): boolean {
  return /^\.{1,2}\//.test(specifier) && specifier.endsWith('.ts');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}

describe('core imports', () => {
  it('finds every kind of module specifier', () => {
    const sample = [
      "import { a } from './a.ts';",
      "import type { B } from '../b.ts';",
      "export * from './c.ts';",
      'export {',
      '  d,',
      "} from 'd-pkg';",
      "import 'side-effect';",
      "const e = await import('node:fs');",
      "const f = require('f-pkg');",
    ].join('\n');
    expect(specifiersIn(sample).sort()).toEqual(
      ['./a.ts', '../b.ts', './c.ts', 'd-pkg', 'side-effect', 'node:fs', 'f-pkg'].sort(),
    );
  });

  it('only imports relative .ts files, so Deno can load core and no Node or npm API sneaks in', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const specifier of specifiersIn(readFileSync(file, 'utf8'))) {
        if (!isDenoLoadable(specifier)) offenders.push(`${file}: ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has no runtime dependencies of any kind', () => {
    const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8'));
    expect(pkg.dependencies ?? {}).toEqual({});
    expect(pkg.peerDependencies ?? {}).toEqual({});
    expect(pkg.optionalDependencies ?? {}).toEqual({});
  });
});
