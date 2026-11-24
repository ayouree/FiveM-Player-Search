import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { runApiCommand } from '../interactions/apiCommand.js';

export const data = new SlashCommandBuilder()
  .setName('player-list')
  .setDescription('List online players')
  .setContexts(InteractionContextType.Guild);

export const execute = (interaction, ctx) => runApiCommand(interaction, ctx, { kind: 'list' });
