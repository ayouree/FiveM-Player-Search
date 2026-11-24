import { randomBytes } from 'node:crypto';

/**
 * In-memory snapshot store. Sliding TTL, lazy pruning (no timers).
 * Pagination reads from here; only Refresh replaces a snapshot.
 */
export function createSessionStore({ ttlMs, maxSessions = 500, now = Date.now }) {
  const sessions = new Map();

  function prune() {
    const t = now();
    for (const [id, s] of sessions) {
      if (t - s.touchedAt > ttlMs) sessions.delete(id);
    }
    while (sessions.size >= maxSessions) {
      sessions.delete(sessions.keys().next().value); // oldest first
    }
  }

  return {
    create(data) {
      prune();
      const id = randomBytes(6).toString('hex');
      const session = { ...data, id, busy: false, createdAt: now(), touchedAt: now() };
      sessions.set(id, session);
      return session;
    },
    get(id) {
      const session = sessions.get(id);
      if (!session) return null;
      if (now() - session.touchedAt > ttlMs) {
        sessions.delete(id);
        return null;
      }
      session.touchedAt = now();
      return session;
    },
    get size() {
      return sessions.size;
    },
  };
}
