import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createFivemClient, FivemError } from '../src/services/fivem.js';
import { startMockServer } from './helpers/mockServer.js';

let server;
before(async () => {
  server = await startMockServer();
});
after(() => server.close());
beforeEach(() => {
  server.state.mode = 'ok';
  server.state.count = 0;
});

const client = (timeoutMs = 1000) => createFivemClient({ baseUrl: server.url, timeoutMs });

test('creating the client makes zero requests', () => {
  client();
  assert.equal(server.state.count, 0);
});

test('fetchPlayers performs exactly one GET and returns sanitized players', async () => {
  const c = client();
  const players = await c.fetchPlayers();
  assert.equal(server.state.count, 1);
  assert.equal(c.requestCount, 1);
  assert.equal(players.length, 5);
  assert.deepEqual(Object.keys(players[0]).sort(), ['id', 'name', 'ping']);
});

test('HTTP error: one GET, no retry', async () => {
  server.state.mode = 'error';
  await assert.rejects(client().fetchPlayers(), (e) => e instanceof FivemError && e.code === 'HTTP_ERROR' && e.status === 500);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(server.state.count, 1);
});

test('timeout: one GET, no retry, aborts near the configured limit', async () => {
  server.state.mode = 'hang';
  const started = Date.now();
  await assert.rejects(client(200).fetchPlayers(), (e) => e.code === 'TIMEOUT');
  assert.ok(Date.now() - started < 1500);
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(server.state.count, 1);
});

test('invalid JSON and non-array bodies', async () => {
  server.state.mode = 'garbage';
  await assert.rejects(client().fetchPlayers(), (e) => e.code === 'INVALID_RESPONSE');
  server.state.mode = 'object';
  await assert.rejects(client().fetchPlayers(), (e) => e.code === 'INVALID_RESPONSE');
  assert.equal(server.state.count, 2);
});

test('connection refused maps to NETWORK', async () => {
  const dead = createFivemClient({ baseUrl: 'http://127.0.0.1:9', timeoutMs: 1000 });
  await assert.rejects(dead.fetchPlayers(), (e) => e.code === 'NETWORK');
});
