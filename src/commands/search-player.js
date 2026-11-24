import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { MAX_KEYWORD_LENGTH } from '../config/constants.js';
import { runApiCommand } from '../interactions/apiCommand.js';
import { SEARCH_MODES } from '../services/search.js';

export const data = new SlashCommandBuilder()
  .setName('search-player')
  .setDescription('Search currently online players by nickname')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((o) =>
    o
      .setName('nickname')
      .setDescription('Nickname or part of it')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(MAX_KEYWORD_LENGTH),
  )
  .addStringOption((o) =>
    o
      .setName('mode')
      .setDescription('Search mode (default: Prefix)')
      .addChoices(
        { name: 'Prefix (starts with)', value: 'prefix' },
        { name: 'Exact (same nickname)', value: 'exact' },
        { name: 'Partial (contains)', value: 'partial' },
      ),
  );

export async function execute(interaction, ctx) {
  const keyword = interaction.options.getString('nickname', true).trim();
  const mode = interaction.options.getString('mode') ?? 'prefix';

  // Invalid input is rejected before the rate limiter and before any GET.
  if (!keyword || !SEARCH_MODES.includes(mode)) {
    await interaction.reply({ content: 'Please enter a valid nickname.', flags: MessageFlags.Ephemeral });
    return;
  }

  await runApiCommand(interaction, ctx, { kind: 'search', keyword, mode });
}
