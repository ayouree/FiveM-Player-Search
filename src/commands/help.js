import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { buildHelpEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show the command guide')
  .setContexts(InteractionContextType.Guild);

// Never touches the FiveM API.
export async function execute(interaction) {
  await interaction.reply({ embeds: [buildHelpEmbed()], flags: MessageFlags.Ephemeral });
}
