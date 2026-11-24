import { MessageFlags } from 'discord.js';
import { FivemError } from '../services/fivem.js';
import { acquireSnapshot } from '../services/snapshot.js';
import { buildErrorEmbed } from '../utils/embeds.js';
import { rateLimitMessage } from '../utils/rateLimiter.js';
import { render } from './render.js';

/**
 * Shared flow for every API-triggering slash command.
 * Order: rate limit -> defer -> exactly one GET -> store snapshot -> render.
 * A rate-limited call returns before any GET.
 */
export async function runApiCommand(interaction, ctx, params) {
  const limit = ctx.rateLimiter.check(interaction.user.id);
  if (!limit.allowed) {
    await interaction.reply({ content: rateLimitMessage(limit), flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  try {
    const snapshot = await acquireSnapshot(ctx.fivem, params.kind, `command:${interaction.commandName}`);
    const session = ctx.sessions.create({ userId: interaction.user.id, page: 1, snapshot, ...params });
    await interaction.editReply(render(session));
  } catch (err) {
    if (err instanceof FivemError) {
      await interaction.editReply({ embeds: [buildErrorEmbed(err)], components: [] });
      return;
    }
    throw err;
  }
}
