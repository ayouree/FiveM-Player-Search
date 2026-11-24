import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from './config/env.js';
import { MAX_SESSIONS, SESSION_TTL_MS } from './config/constants.js';
import { createInteractionHandler } from './interactions/handler.js';
import { createSessionStore } from './interactions/sessions.js';
import { createFivemClient } from './services/fivem.js';
import { logger } from './utils/logger.js';
import { createRateLimiter } from './utils/rateLimiter.js';

const fivem = createFivemClient({ baseUrl: config.fivemServerUrl, timeoutMs: config.fivemTimeoutMs });
const ctx = {
  fivem,
  sessions: createSessionStore({ ttlMs: SESSION_TTL_MS, maxSessions: MAX_SESSIONS }),
  rateLimiter: createRateLimiter({
    cooldownMs: config.rateLimitUserCooldownMs,
    globalMax: config.rateLimitGlobalPerMinute,
  }),
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  allowedMentions: { parse: [] },
});

// Startup only logs in. No FiveM request happens here or in any background task.
client.once(Events.ClientReady, (readyClient) => {
  logger.info(`Logged in as ${readyClient.user.tag}`);
  logger.info(`Serving ${readyClient.guilds.cache.size} guild(s)`);
  logger.info(`Startup complete. FiveM API requests at startup: ${fivem.requestCount}`);
});

client.on(Events.InteractionCreate, createInteractionHandler(ctx));
client.on(Events.Error, (err) => logger.error('Discord client error', err));
client.on(Events.Warn, (msg) => logger.warn(msg));

process.on('unhandledRejection', (err) => logger.error('Unhandled rejection', err));
process.on('uncaughtException', (err) => logger.error('Uncaught exception', err));

const shutdown = async (signal) => {
  logger.info(`${signal} received, shutting down`);
  await client.destroy();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  await client.login(config.discordToken);
} catch (err) {
  logger.error('Discord login failed', err);
  process.exit(1);
}
