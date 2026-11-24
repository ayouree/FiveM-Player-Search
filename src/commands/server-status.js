import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { runApiCommand } from '../interactions/apiCommand.js';

export const data = new SlashCommandBuilder()
  .setName('server-status')
  .setDescription('Check whether the server is reachable')
  .setContexts(InteractionContextType.Guild);

export const execute = (interaction, ctx) => runApiCommand(interaction, ctx, { kind: 'status' });
