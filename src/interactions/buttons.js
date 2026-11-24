import { MessageFlags } from 'discord.js';
import { FivemError } from '../services/fivem.js';
import { acquireSnapshot } from '../services/snapshot.js';
import { buildErrorEmbed } from '../utils/embeds.js';
import { rateLimitMessage } from '../utils/rateLimiter.js';
import { render } from './render.js';

const EPHEMERAL = MessageFlags.Ephemeral;
const ACTIONS = new Set(['prev', 'next', 'refresh']);

/**
 * Button flow. Prev/Next never call the API (snapshot only).
 * Refresh performs exactly one GET after ownership, busy and rate-limit checks.
 */
export async function handleButton(interaction, ctx) {
  const [namespace, action, sessionId] = interaction.customId.split(':');
  if (namespace !== 'pg' || !ACTIONS.has(action) || !sessionId) return;

  const session = ctx.sessions.get(sessionId);
  if (!session) {
    await interaction.update({ components: [] });
    await interaction.followUp({
      content: 'This result has expired. Please run the command again.',
      flags: EPHEMERAL,
    });
    return;
  }

  if (interaction.user.id !== session.userId) {
    await interaction.reply({
      content: 'Only the person who ran this command can use these buttons.',
      flags: EPHEMERAL,
    });
    return;
  }

  if (action === 'prev' || action === 'next') {
    session.page += action === 'next' ? 1 : -1;
    await interaction.update(render(session));
    return;
  }

  // Refresh
  if (session.busy) {
    await interaction.reply({ content: 'A refresh is already in progress.', flags: EPHEMERAL });
    return;
  }
  const limit = ctx.rateLimiter.check(interaction.user.id);
  if (!limit.allowed) {
    await interaction.reply({ content: rateLimitMessage(limit), flags: EPHEMERAL });
    return;
  }

  session.busy = true;
  try {
    await interaction.deferUpdate();
    const snapshot = await acquireSnapshot(ctx.fivem, session.kind, 'button:refresh');
    session.snapshot = snapshot; // replace the snapshot
    await interaction.editReply(render(session));
  } catch (err) {
    if (err instanceof FivemError) {
      // Keep the previous snapshot and message; report the failure privately. No retry.
      await interaction.followUp({ embeds: [buildErrorEmbed(err)], flags: EPHEMERAL });
      return;
    }
    throw err;
  } finally {
    session.busy = false;
  }
}
