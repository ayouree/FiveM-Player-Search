import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { runApiCommand } from '../interactions/apiCommand.js';

export const data = new SlashCommandBuilder()
  .setName('player-count')
  .setDescription('Show how many players are online')
  .setContexts(InteractionContextType.Guild);

export const execute = (interaction, ctx) => runApiCommand(interaction, ctx, { kind: 'count' });
