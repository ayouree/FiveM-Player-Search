import { sanitizeName } from '../utils/text.js';

export class FivemError extends Error {
  constructor(code, message, { status = null } = {}) {
    super(message);
    this.name = 'FivemError';
    this.code = code; // TIMEOUT | NETWORK | HTTP_ERROR | INVALID_RESPONSE | TOO_LARGE
    this.status = status;
  }
}

const MAX_BYTES = 5 * 1024 * 1024;
const isTimeout = (err) => err?.name === 'TimeoutError' || err?.name === 'AbortError';

/**
 * The ONLY place in the project that performs a request to the FiveM server.
 * fetchPlayers() = exactly one GET. No retry, no cache, no timers.
 */
export function createFivemClient({ baseUrl, timeoutMs = 5000 }) {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/players.json`;
  let requestCount = 0;

  async function fetchPlayers() {
    requestCount += 1;

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (isTimeout(err)) throw new FivemError('TIMEOUT', 'Request timed out');
      throw new FivemError('NETWORK', 'Network error');
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new FivemError('HTTP_ERROR', `HTTP ${response.status}`, { status: response.status });
    }

    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      await response.body?.cancel().catch(() => {});
      throw new FivemError('TOO_LARGE', 'Response too large');
    }

    let text;
    try {
      text = await response.text();
    } catch (err) {
      if (isTimeout(err)) throw new FivemError('TIMEOUT', 'Request timed out');
      throw new FivemError('NETWORK', 'Network error');
    }
    if (text.length > MAX_BYTES) throw new FivemError('TOO_LARGE', 'Response too large');

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new FivemError('INVALID_RESPONSE', 'Response is not valid JSON');
    }
    if (!Array.isArray(data)) throw new FivemError('INVALID_RESPONSE', 'Response is not an array');

    return normalizePlayers(data);
  }

  return {
    fetchPlayers,
    get requestCount() {
      return requestCount;
    },
  };
}

/** Keep ONLY id, name, ping. Identifiers, licenses, Steam hex, endpoints are dropped here. */
export function normalizePlayers(data) {
  const players = [];
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue;
    const id = Number(entry.id);
    if (!Number.isFinite(id)) continue;
    const ping = Number(entry.ping);
    players.push({
      id,
      name: sanitizeName(entry.name),
      ping: Number.isFinite(ping) ? ping : null,
    });
  }
  return players.sort((a, b) => a.id - b.id);
}
