import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PAGE_SIZE } from '../config/constants.js';
import { searchPlayers } from '../services/search.js';
import { paginate } from '../utils/pagination.js';
import {
  buildCountEmbed,
  buildListEmbed,
  buildSearchEmbed,
  buildStatusEmbed,
} from '../utils/embeds.js';

const builders = {
  search: buildSearchEmbed,
  list: buildListEmbed,
  count: buildCountEmbed,
  status: buildStatusEmbed,
};

/** Derive the page view from the in-memory snapshot. No network access. */
export function getView(session) {
  const pool =
    session.kind === 'search'
      ? searchPlayers(session.snapshot.players, session.keyword, session.mode)
      : session.snapshot.players;
  return paginate(pool, session.page, PAGE_SIZE);
}

function buildComponents(session, view) {
  const refresh = new ButtonBuilder()
    .setCustomId(`pg:refresh:${session.id}`)
    .setLabel('Refresh')
    .setEmoji('🔄')
    .setStyle(ButtonStyle.Secondary);

  if (session.kind === 'count' || session.kind === 'status') {
    return [new ActionRowBuilder().addComponents(refresh)];
  }

  const prev = new ButtonBuilder()
    .setCustomId(`pg:prev:${session.id}`)
    .setLabel('Prev')
    .setEmoji('◀️')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(view.page <= 1);
  const indicator = new ButtonBuilder()
    .setCustomId(`pg:noop:${session.id}`)
    .setLabel(`${view.page}/${view.totalPages}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);
  const next = new ButtonBuilder()
    .setCustomId(`pg:next:${session.id}`)
    .setLabel('Next')
    .setEmoji('▶️')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(view.page >= view.totalPages);

  return [new ActionRowBuilder().addComponents(prev, indicator, next, refresh)];
}

export function render(session) {
  const view = getView(session);
  session.page = view.page; // clamp
  return {
    embeds: [builders[session.kind](session, view)],
    components: buildComponents(session, view),
  };
}
