import { FivemError } from './fivem.js';
import { logger } from '../utils/logger.js';

/**
 * Performs exactly one GET (via fivem.fetchPlayers) and wraps the result in a snapshot.
 * For `status`, a failed request is a valid result (server offline); other kinds rethrow.
 */
export async function acquireSnapshot(fivem, kind, trigger) {
  const startedAt = Date.now();
  try {
    const players = await fivem.fetchPlayers();
    logger.info(`FiveM GET ok (${trigger}) players=${players.length}`);
    return {
      ok: true,
      players,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startedAt,
      errorCode: null,
      errorStatus: null,
    };
  } catch (err) {
    if (!(err instanceof FivemError)) throw err;
    logger.warn(`FiveM GET failed (${trigger}) code=${err.code}`);
    if (kind === 'status') {
      return {
        ok: false,
        players: [],
        fetchedAt: new Date(),
        latencyMs: Date.now() - startedAt,
        errorCode: err.code,
        errorStatus: err.status,
      };
    }
    throw err;
  }
}
