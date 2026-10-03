import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Minimal static file server. With `spaFallback`, unknown paths serve `index.html`. */
export function serveDir(
  dir: string,
  port: number,
  spaFallback: boolean,
): Promise<() => Promise<void>> {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      let file = normalize(join(root, pathname));
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      if (!(await isFile(file))) file = join(file, 'index.html');
      if (!(await isFile(file))) {
        if (!spaFallback) {
          res.writeHead(404).end('Not found');
          return;
        }
        file = join(root, 'index.html');
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(500).end('Server error');
    }
  });
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolveListen(
        () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.closeAllConnections();
            server.close((err) => (err ? rejectClose(err) : resolveClose()));
          }),
      );
    });
  });
}
