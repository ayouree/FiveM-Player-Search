/**
 * Rate limiter for API-triggering actions only (commands + Refresh).
 * Pagination, /help and rejected requests never reach this.
 * No timers: state is pruned lazily.
 */
export function createRateLimiter({ cooldownMs, globalMax, windowMs = 60_000, now = Date.now }) {
  const lastByUser = new Map();
  let hits = [];

  return {
    check(userId) {
      const t = now();

      const last = lastByUser.get(userId);
      if (last !== undefined && t - last < cooldownMs) {
        return { allowed: false, reason: 'user', retryAfterMs: cooldownMs - (t - last) };
      }

      hits = hits.filter((h) => t - h < windowMs);
      if (hits.length >= globalMax) {
        return { allowed: false, reason: 'global', retryAfterMs: windowMs - (t - hits[0]) };
      }

      hits.push(t);
      lastByUser.set(userId, t);

      if (lastByUser.size > 1000) {
        for (const [key, value] of lastByUser) {
          if (t - value >= cooldownMs) lastByUser.delete(key);
        }
      }
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}

export function rateLimitMessage(result) {
  const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return result.reason === 'global'
    ? `The bot is handling many requests right now. Please try again in ${seconds}s.`
    : `Please wait ${seconds}s before using another player lookup.`;
}
