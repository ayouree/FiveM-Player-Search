import { REST, Routes } from 'discord.js';
import { commands } from './commands/index.js';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';

// Manual, one-off script. Talks to Discord only; never to the FiveM server.
const body = commands.map((c) => c.data.toJSON());
const rest = new REST({ version: '10' }).setToken(config.discordToken);
const scope = config.discordGuildId ? `guild ${config.discordGuildId}` : 'globally';
const route = config.discordGuildId
  ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
  : Routes.applicationCommands(config.discordClientId);

try {
  const result = await rest.put(route, { body });
  logger.info(`Registered ${result.length} command(s) ${scope}`);
} catch (err) {
  logger.error('Command registration failed', err);
  process.exit(1);
}
