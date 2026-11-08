const USER_AGENT = 'fh-hub-sync/0.1 (+https://github.com/danielversiani/fh-hub)';
/** At most one request per second per host (ARCHITECTURE §3.1). */
const MIN_INTERVAL_MS = 1000;
const TIMEOUT_MS = 30_000;
const lastRequestAt = new Map<string, number>();

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function respectRateLimit(url: string): Promise<void> {
  const host = new URL(url).host;
  const wait = (lastRequestAt.get(host) ?? 0) + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

/** GET with an identifiable User-Agent, per-host rate limit and retries on transient errors. */
export async function fetchBytes(url: string, retries = 2): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    await respectRateLimit(url);
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new HttpError(response.status, url);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      const transient =
        !(error instanceof HttpError) || error.status >= 500 || error.status === 429;
      if (!transient || attempt >= retries) throw error;
      await sleep(2000 * (attempt + 1));
    }
  }
}

export const fetchText = async (url: string): Promise<string> =>
  (await fetchBytes(url)).toString('utf8');
