const CODE = /^[A-Z0-9-]{4,32}$/i;

/**
 * The label code in what a QR scan or a typed entry gave: `https://<webHost>/l/<code>`,
 * `tendril://l/<code>`, or a bare code. Returns the code upper-cased, or null when the text is
 * none of those (a link to another host, another path, or a code of the wrong shape).
 */
export function parseLabelCode(text: string, webHost: string): string | null {
  const trimmed = text.trim();
  const web = /^https:\/\/([^/?#]+)\/l\/([^/?#]*)\/?(?:[?#].*)?$/i.exec(trimmed);
  const app = /^tendril:\/\/l\/([^/?#]*)\/?(?:[?#].*)?$/i.exec(trimmed);
  let candidate: string;
  if (web) {
    if (web[1]!.toLowerCase() !== webHost.toLowerCase()) return null;
    candidate = web[2]!;
  } else if (app) {
    candidate = app[1]!;
  } else {
    candidate = trimmed;
  }
  return CODE.test(candidate) ? candidate.toUpperCase() : null;
}
