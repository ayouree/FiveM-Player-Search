import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchPlayers } from '../src/services/search.js';
import { normalizePlayers } from '../src/services/fivem.js';
import { paginate } from '../src/utils/pagination.js';
import { sanitizeName } from '../src/utils/text.js';
import { createRateLimiter } from '../src/utils/rateLimiter.js';
import { createSessionStore } from '../src/interactions/sessions.js';
import { SAMPLE_PLAYERS } from './helpers/mockServer.js';

const players = normalizePlayers(SAMPLE_PLAYERS);
const ids = (list) => list.map((p) => p.id);

test('prefix mode is default-style: starts with keyword, case-insensitive', () => {
  assert.deepEqual(ids(searchPlayers(players, 'alp', 'prefix')), [1, 2, 10]);
  assert.deepEqual(ids(searchPlayers(players, 'ALP')), [1, 2, 10]);
});

test('exact mode matches whole nickname only', () => {
  assert.deepEqual(ids(searchPlayers(players, 'alpha', 'exact')), [1, 10]);
  assert.deepEqual(ids(searchPlayers(players, 'alph', 'exact')), []);
});

test('partial mode matches anywhere', () => {
  assert.deepEqual(ids(searchPlayers(players, 'alpha', 'partial')), [1, 3, 10]);
  assert.deepEqual(ids(searchPlayers(players, 'ED', 'partial')), [11]);
});

test('blank keyword and unknown mode', () => {
  assert.deepEqual(searchPlayers(players, '   ', 'partial'), []);
  assert.throws(() => searchPlayers(players, 'a', 'fuzzy'), RangeError);
});

test('normalizePlayers keeps only id, name, ping and strips color codes', () => {
  assert.deepEqual(Object.keys(players[0]).sort(), ['id', 'name', 'ping']);
  assert.equal(players[1].name, 'Alpine');
  const blob = JSON.stringify(players);
  assert.ok(!/steam|license|discord|identifiers|endpoint/i.test(blob));
});

test('sanitizeName strips control and invisible characters', () => {
  assert.equal(sanitizeName('  A\u200bB\tC^3  '), 'AB C');
  assert.equal(sanitizeName(null), '');
});

test('paginate: 10 per page, clamps out-of-range pages', () => {
  const items = Array.from({ length: 26 }, (_, i) => i);
  const p1 = paginate(items, 1, 10);
  assert.equal(p1.items.length, 10);
  assert.equal(p1.totalPages, 3);
  assert.equal(paginate(items, 3, 10).items.length, 6);
  assert.equal(paginate(items, 99, 10).page, 3);
  assert.equal(paginate(items, -5, 10).page, 1);
  assert.equal(paginate([], 1, 10).totalPages, 1);
});

test('rate limiter: per-user cooldown and global cap', () => {
  let t = 1000;
  const rl = createRateLimiter({ cooldownMs: 5000, globalMax: 3, now: () => t });
  assert.equal(rl.check('a').allowed, true);
  const blocked = rl.check('a');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'user');
  assert.equal(rl.check('b').allowed, true);
  assert.equal(rl.check('c').allowed, true);
  const global = rl.check('d');
  assert.equal(global.allowed, false);
  assert.equal(global.reason, 'global');
  t += 60_001;
  assert.equal(rl.check('a').allowed, true);
});

test('session store: sliding TTL and capacity eviction', () => {
  let t = 0;
  const store = createSessionStore({ ttlMs: 1000, maxSessions: 2, now: () => t });
  const a = store.create({ userId: 'u' });
  t = 900;
  assert.ok(store.get(a.id)); // touch extends life
  t = 1800;
  assert.ok(store.get(a.id));
  t = 3000;
  assert.equal(store.get(a.id), null);
  const x = store.create({});
  const y = store.create({});
  const z = store.create({});
  assert.equal(store.get(x.id), null); // evicted
  assert.ok(store.get(y.id) && store.get(z.id));
});
