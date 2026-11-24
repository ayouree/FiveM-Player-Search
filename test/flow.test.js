import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { createInteractionHandler } from '../src/interactions/handler.js';
import { createSessionStore } from '../src/interactions/sessions.js';
import { createFivemClient } from '../src/services/fivem.js';
import { createRateLimiter } from '../src/utils/rateLimiter.js';
import { manyPlayers, SAMPLE_PLAYERS, startMockServer } from './helpers/mockServer.js';

const EPHEMERAL = 64;

function slash(commandName, options = {}, userId = 'user-1') {
  const log = { replies: [], edits: [] };
  return {
    log,
    commandName,
    user: { id: userId },
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    isButton: () => false,
    options: {
      getString(name, required) {
        const v = options[name] ?? null;
        if (required && v === null) throw new Error(`missing ${name}`);
        return v;
      },
    },
    async reply(p) { this.replied = true; log.replies.push(p); },
    async deferReply() { this.deferred = true; },
    async editReply(p) { log.edits.push(p); },
    async followUp(p) { log.replies.push(p); },
    get last() { return log.edits.at(-1); },
  };
}

function button(customId, userId = 'user-1') {
  const log = { replies: [], edits: [], updates: [] };
  return {
    log,
    customId,
    user: { id: userId },
    deferred: false,
    replied: false,
    isChatInputCommand: () => false,
    isButton: () => true,
    async reply(p) { this.replied = true; log.replies.push(p); },
    async update(p) { log.updates.push(p); },
    async deferUpdate() { this.deferred = true; },
    async editReply(p) { log.edits.push(p); },
    async followUp(p) { log.replies.push(p); },
    get last() { return log.edits.at(-1) ?? log.updates.at(-1); },
  };
}

const embedOf = (payload) => payload.embeds[0].data;
const field = (payload, name) => embedOf(payload).fields.find((f) => f.name === name)?.value;
const buttons = (payload) => payload.components[0].components.map((b) => b.data);
const idFor = (payload, action) => buttons(payload).find((b) => b.custom_id.includes(`:${action}:`)).custom_id;

describe('interaction flow', () => {
  let server;
  let now;
  let ctx;
  let handle;

  before(async () => { server = await startMockServer(); });
  after(() => server.close());

  beforeEach(() => {
    server.state.mode = 'ok';
    server.state.count = 0;
    server.state.players = SAMPLE_PLAYERS;
    now = 1_000_000;
    ctx = {
      fivem: createFivemClient({ baseUrl: server.url, timeoutMs: 300 }),
      sessions: createSessionStore({ ttlMs: 60_000, now: () => now }),
      rateLimiter: createRateLimiter({ cooldownMs: 0, globalMax: 1000, now: () => now }),
    };
    handle = createInteractionHandler(ctx);
  });

  test('startup/wiring makes zero requests', () => {
    assert.equal(server.state.count, 0);
    assert.equal(ctx.fivem.requestCount, 0);
  });

  test('/help performs zero GET requests', async () => {
    const i = slash('help');
    await handle(i);
    assert.equal(server.state.count, 0);
    assert.equal(i.log.replies[0].flags, EPHEMERAL);
  });

  test('/search-player: exactly one GET, shows nickname, ID, ping, no identifiers', async () => {
    const i = slash('search-player', { nickname: 'alp' });
    await handle(i);
    assert.equal(server.state.count, 1);
    const e = embedOf(i.last);
    assert.match(e.description, /Alpha.*ID `1`.*Ping `30 ms`/);
    assert.match(e.description, /Alpine/);
    assert.equal(field(i.last, 'Matches'), '3');
    assert.equal(field(i.last, 'Mode'), 'Prefix');
    assert.equal(field(i.last, 'Keyword'), '`alp`');
    assert.equal(field(i.last, 'Page'), '1/1');
    assert.ok(field(i.last, 'Fetched'));
    assert.ok(!/steam|license|discord:|identifiers/i.test(JSON.stringify(i.last.embeds.map((x) => x.data))));
  });

  test('/search-player modes: exact and partial', async () => {
    const exact = slash('search-player', { nickname: 'ALPHA', mode: 'exact' });
    await handle(exact);
    assert.equal(field(exact.last, 'Matches'), '2');
    const partial = slash('search-player', { nickname: 'alpha', mode: 'partial' }, 'user-2');
    await handle(partial);
    assert.equal(field(partial.last, 'Matches'), '3');
    assert.equal(server.state.count, 2);
  });

  test('/search-player with no matches', async () => {
    const i = slash('search-player', { nickname: 'nobody' });
    await handle(i);
    assert.match(embedOf(i.last).description, /No online players matched/);
    assert.equal(server.state.count, 1);
  });

  test('blank nickname is rejected with zero GET', async () => {
    const i = slash('search-player', { nickname: '   ' });
    await handle(i);
    assert.equal(server.state.count, 0);
    assert.equal(i.log.replies[0].flags, EPHEMERAL);
  });

  test('/player-count and /server-status: one GET each', async () => {
    const c = slash('player-count', {}, 'u-a');
    await handle(c);
    assert.match(embedOf(c.last).description, /\*\*5\*\*/);
    const s = slash('server-status', {}, 'u-b');
    await handle(s);
    assert.match(embedOf(s.last).description, /Server reachable/);
    assert.equal(server.state.count, 2);
  });

  test('pagination: 10 per page and zero additional GET', async () => {
    server.state.players = manyPlayers(26);
    const i = slash('player-list');
    await handle(i);
    assert.equal(server.state.count, 1);
    assert.equal(embedOf(i.last).description.split('\n').length, 10);
    assert.equal(field(i.last, 'Total Online'), '26');
    assert.equal(buttons(i.last).find((b) => b.custom_id.includes(':prev:')).disabled, true);

    let payload = i.last;
    for (const [action, expectedPage, expectedLines] of [['next', '2/3', 10], ['next', '3/3', 6], ['next', '3/3', 6], ['prev', '2/3', 10]]) {
      const b = button(idFor(payload, action));
      await handle(b);
      payload = b.log.updates[0];
      assert.equal(field(payload, 'Page'), expectedPage);
      assert.equal(embedOf(payload).description.split('\n').length, expectedLines);
    }
    assert.equal(server.state.count, 1, 'pagination must not call the API');
  });

  test('refresh: exactly one GET and replaces the snapshot; paging afterwards is free', async () => {
    server.state.players = manyPlayers(26);
    const i = slash('player-list');
    await handle(i);
    server.state.players = manyPlayers(12);
    const r = button(idFor(i.last, 'refresh'));
    await handle(r);
    assert.equal(server.state.count, 2);
    assert.equal(field(r.last, 'Total Online'), '12');
    const n = button(idFor(r.last, 'next'));
    await handle(n);
    assert.equal(field(n.log.updates[0], 'Page'), '2/2');
    assert.equal(server.state.count, 2);
  });

  test('refresh on /search-player re-runs the search on the new snapshot', async () => {
    const i = slash('search-player', { nickname: 'zed' });
    await handle(i);
    assert.equal(field(i.last, 'Matches'), '1');
    server.state.players = [{ id: 5, name: 'Zedd', ping: 7 }, { id: 6, name: 'Zed2', ping: 8 }];
    const r = button(idFor(i.last, 'refresh'));
    await handle(r);
    assert.equal(field(r.last, 'Matches'), '2');
    assert.equal(server.state.count, 2);
  });

  test('other users cannot use the buttons (zero GET)', async () => {
    const i = slash('player-list', {}, 'owner');
    await handle(i);
    for (const action of ['refresh', 'next']) {
      const b = button(idFor(i.last, action), 'intruder');
      await handle(b);
      assert.equal(b.log.replies[0].flags, EPHEMERAL);
      assert.equal(b.log.updates.length + b.log.edits.length, 0);
    }
    assert.equal(server.state.count, 1);
  });

  test('rate limit blocks repeated commands and refresh without any GET', async () => {
    ctx.rateLimiter = createRateLimiter({ cooldownMs: 5000, globalMax: 1000, now: () => now });
    const first = slash('player-count');
    await handle(first);
    const second = slash('player-list');
    await handle(second);
    assert.equal(server.state.count, 1);
    assert.match(second.log.replies[0].content, /Please wait/);
    assert.equal(second.log.replies[0].flags, EPHEMERAL);

    const r = button(idFor(first.last, 'refresh'));
    await handle(r);
    assert.equal(server.state.count, 1);
    assert.match(r.log.replies[0].content, /Please wait/);

    now += 5001;
    const r2 = button(idFor(first.last, 'refresh'));
    await handle(r2);
    assert.equal(server.state.count, 2);
  });

  test('server error: error embed, exactly one GET, no automatic retry', async () => {
    server.state.mode = 'error';
    const i = slash('search-player', { nickname: 'alp' });
    await handle(i);
    assert.match(embedOf(i.last).title, /Could not fetch/);
    assert.deepEqual(i.last.components, []);
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(server.state.count, 1);
  });

  test('timeout: handled gracefully, one GET', async () => {
    server.state.mode = 'hang';
    const i = slash('player-list');
    await handle(i);
    assert.match(embedOf(i.last).description, /did not respond in time/);
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(server.state.count, 1);
  });

  test('/server-status shows offline instead of failing', async () => {
    server.state.mode = 'error';
    const i = slash('server-status');
    await handle(i);
    assert.match(embedOf(i.last).description, /Server unreachable/);
    assert.equal(server.state.count, 1);
  });

  test('failed refresh keeps the old snapshot, reports privately, no retry', async () => {
    const i = slash('player-list');
    await handle(i);
    server.state.mode = 'error';
    const r = button(idFor(i.last, 'refresh'));
    await handle(r);
    assert.equal(server.state.count, 2);
    assert.equal(r.log.edits.length, 0);
    assert.equal(r.log.replies[0].flags, EPHEMERAL);
    server.state.mode = 'ok';
    const n = button(idFor(i.last, 'refresh'));
    await handle(n);
    assert.equal(server.state.count, 3); // only because the user pressed it again
    assert.equal(field(n.last, 'Total Online'), '5');
  });

  test('expired session: buttons are removed and no GET happens', async () => {
    const i = slash('player-list');
    await handle(i);
    const refreshId = idFor(i.last, 'refresh');
    now += 61_000;
    const b = button(refreshId);
    await handle(b);
    assert.deepEqual(b.log.updates[0], { components: [] });
    assert.match(b.log.replies[0].content, /expired/);
    assert.equal(server.state.count, 1);
  });

  test('unexpected errors are reported without crashing the handler', async () => {
    const i = slash('player-list');
    i.editReply = async () => { throw new Error('discord down'); };
    await assert.doesNotReject(handle(i));
  });
});
