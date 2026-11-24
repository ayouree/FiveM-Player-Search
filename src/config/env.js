import 'dotenv/config';

function fail(message) {
  console.error(`[config] ${message}`);
  process.exit(1);
}

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) fail(`Missing required environment variable: ${name}`);
  return value.trim();
}

function optional(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function integer(name, fallback, min) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) fail(`${name} must be an integer >= ${min}`);
  return value;
}

function serverUrl() {
  const raw = required('FIVEM_SERVER_URL');
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail('FIVEM_SERVER_URL is not a valid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) fail('FIVEM_SERVER_URL must start with http:// or https://');
  return raw.replace(/\/+$/, '');
}

export const config = Object.freeze({
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordGuildId: optional('DISCORD_GUILD_ID'),
  fivemServerUrl: serverUrl(),
  fivemTimeoutMs: integer('FIVEM_TIMEOUT_MS', 5000, 1),
  rateLimitUserCooldownMs: integer('RATE_LIMIT_USER_COOLDOWN_MS', 5000, 0),
  rateLimitGlobalPerMinute: integer('RATE_LIMIT_GLOBAL_PER_MINUTE', 30, 1),
});
