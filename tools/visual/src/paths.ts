import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const DESIGN_DIR = resolve(ROOT, 'design', 'claude-design');
export const INNER_DIR = resolve(ROOT, 'design', 'screens-inner');
export const COMPARE_DIR = resolve(ROOT, 'design', 'compare');
export const APP_SHOTS_DIR = resolve(COMPARE_DIR, 'app');
export const MOBILE_DIR = resolve(ROOT, 'apps', 'mobile');
