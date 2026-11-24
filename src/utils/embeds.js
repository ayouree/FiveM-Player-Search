import { EmbedBuilder, escapeMarkdown } from 'discord.js';
import { MAX_NAME_DISPLAY } from '../config/constants.js';
import { truncate } from './text.js';

const COLORS = { ok: 0x2ecc71, info: 0x3498db, error: 0xe74c3c, neutral: 0x95a5a6 };
const MODE_LABEL = { prefix: 'Prefix', exact: 'Exact', partial: 'Partial' };
const unix = (date) => Math.floor(date.getTime() / 1000);
const fetchedField = (snapshot) => ({ name: 'Fetched', value: `<t:${unix(snapshot.fetchedAt)}:T>`, inline: true });
const SNAPSHOT_FOOTER = { text: 'Snapshot of online players • Press Refresh to update' };

function playerLine(player, number) {
  const name = player.name ? escapeMarkdown(truncate(player.name, MAX_NAME_DISPLAY)) : '*(no name)*';
  const ping = player.ping === null ? 'N/A' : `${player.ping} ms`;
  return `**${number}.** ${name} • ID \`${player.id}\` • Ping \`${ping}\``;
}

const lines = (view) => view.items.map((p, i) => playerLine(p, view.start + i + 1));

export function buildSearchEmbed(session, view) {
  const rows = lines(view);
  const keyword = session.keyword.replace(/`/g, "'");
  return new EmbedBuilder()
    .setColor(view.totalItems ? COLORS.ok : COLORS.neutral)
    .setTitle('🔎 Player Search')
    .setDescription(rows.length ? rows.join('\n') : 'No online players matched your search.')
    .addFields(
      { name: 'Status', value: view.totalItems ? '🟢 Online' : '—', inline: true },
      { name: 'Matches', value: String(view.totalItems), inline: true },
      { name: 'Page', value: `${view.page}/${view.totalPages}`, inline: true },
      { name: 'Keyword', value: `\`${keyword}\``, inline: true },
      { name: 'Mode', value: MODE_LABEL[session.mode], inline: true },
      fetchedField(session.snapshot),
    )
    .setFooter(SNAPSHOT_FOOTER);
}

export function buildListEmbed(session, view) {
  const rows = lines(view);
  return new EmbedBuilder()
    .setColor(view.totalItems ? COLORS.ok : COLORS.neutral)
    .setTitle('📋 Online Players')
    .setDescription(rows.length ? rows.join('\n') : 'No players are online right now.')
    .addFields(
      { name: 'Total Online', value: String(view.totalItems), inline: true },
      { name: 'Page', value: `${view.page}/${view.totalPages}`, inline: true },
      fetchedField(session.snapshot),
    )
    .setFooter(SNAPSHOT_FOOTER);
}

export function buildCountEmbed(session) {
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('👥 Player Count')
    .setDescription(`**${session.snapshot.players.length}** player(s) online`)
    .addFields(fetchedField(session.snapshot))
    .setFooter(SNAPSHOT_FOOTER);
}

export function errorReason(code, status) {
  switch (code) {
    case 'TIMEOUT':
      return 'The server did not respond in time.';
    case 'HTTP_ERROR':
      return `The server returned an error${status ? ` (HTTP ${status})` : ''}.`;
    case 'NETWORK':
      return 'Could not connect to the server.';
    case 'INVALID_RESPONSE':
    case 'TOO_LARGE':
      return 'The server returned an unexpected response.';
    default:
      return 'An unknown error occurred.';
  }
}

export function buildStatusEmbed(session) {
  const s = session.snapshot;
  const embed = new EmbedBuilder().setTitle('🖥️ Server Status').setFooter({ text: 'Checked on demand • Press Refresh to check again' });
  if (s.ok) {
    return embed
      .setColor(COLORS.ok)
      .setDescription('🟢 **Server reachable**')
      .addFields(
        { name: 'Players Online', value: String(s.players.length), inline: true },
        { name: 'Response Time', value: `${s.latencyMs} ms`, inline: true },
        fetchedField(s),
      );
  }
  return embed
    .setColor(COLORS.error)
    .setDescription(`🔴 **Server unreachable**\n${errorReason(s.errorCode, s.errorStatus)}`)
    .addFields(fetchedField(s));
}

export function buildErrorEmbed(error) {
  return new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle('⚠️ Could not fetch players')
    .setDescription(`${errorReason(error.code, error.status)}\nPlease try again in a moment.`);
}

export function buildHelpEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('📖 Memories Player Search — Help')
    .setDescription('Look up players currently online on the server. Data is fetched only when you run a command or press **Refresh**.')
    .addFields(
      { name: '/search-player `nickname` `mode`', value: 'Search online players by nickname.' },
      {
        name: 'Search modes',
        value: '**Prefix** (default) – nickname starts with the keyword\n**Exact** – nickname equals the keyword\n**Partial** – nickname contains the keyword\nSearch is case-insensitive.',
      },
      { name: '/player-count', value: 'Show how many players are online.' },
      { name: '/player-list', value: 'List online players, 10 per page.' },
      { name: '/server-status', value: 'Check whether the server is reachable.' },
      { name: '/help', value: 'Show this guide (does not contact the server).' },
      {
        name: 'Good to know',
        value: 'Page buttons use the data already fetched. **Refresh** fetches fresh data once. Only the person who ran a command can use its buttons.',
      },
    );
}
