import http from 'node:http';

export const SAMPLE_PLAYERS = [
  { endpoint: null, id: 1, identifiers: ['steam:1100001abcdef', 'license:deadbeef', 'discord:123'], name: 'Alpha', ping: 30 },
  { endpoint: null, id: 2, identifiers: ['steam:1100002abcdef'], name: '^1Alpine', ping: 45 },
  { endpoint: null, id: 3, identifiers: ['license:cafebabe'], name: 'beta alpha', ping: 60 },
  { endpoint: null, id: 10, identifiers: ['steam:1100010abcdef'], name: 'ALPHA', ping: 12 },
  { endpoint: null, id: 11, identifiers: [], name: 'Zed', ping: 99 },
];

export function manyPlayers(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    identifiers: [`steam:${i}`],
    name: `Player${String(i + 1).padStart(2, '0')}`,
    ping: 20 + i,
  }));
}

/** Local FiveM stand-in that counts every GET /players.json. */
export async function startMockServer() {
  const state = { count: 0, mode: 'ok', players: SAMPLE_PLAYERS };
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/players.json') {
      res.writeHead(404);
      return res.end();
    }
    state.count += 1;
    if (state.mode === 'hang') return; // never answer
    if (state.mode === 'error') {
      res.writeHead(500);
      return res.end('boom');
    }
    if (state.mode === 'garbage') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end('<html>not json</html>');
    }
    if (state.mode === 'object') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end('{"a":1}');
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(state.players));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    state,
    url: `http://127.0.0.1:${port}`,
    port,
    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
