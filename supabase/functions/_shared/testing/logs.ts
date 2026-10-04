/** Captures the structured log lines (see `log.ts`) written while `fn` runs. */
export async function captureLogs<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; logs: Record<string, unknown>[] }> {
  const logs: Record<string, unknown>[] = [];
  const { log, warn, error } = console;
  const keep = (...a: unknown[]) => {
    try {
      logs.push(JSON.parse(String(a[0])));
    } catch {
      logs.push({ raw: a.join(' ') });
    }
  };
  console.log = console.warn = console.error = keep;
  try {
    return { result: await fn(), logs };
  } finally {
    Object.assign(console, { log, warn, error });
  }
}
