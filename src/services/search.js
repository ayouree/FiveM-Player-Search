import { normalizeForSearch } from '../utils/text.js';

export const SEARCH_MODES = ['prefix', 'exact', 'partial'];

const matchers = {
  prefix: (name, needle) => name.startsWith(needle),
  exact: (name, needle) => name === needle,
  partial: (name, needle) => name.includes(needle),
};

/** Pure, case-insensitive, in-memory search over a snapshot. */
export function searchPlayers(players, keyword, mode = 'prefix') {
  const match = matchers[mode];
  if (!match) throw new RangeError(`Unknown search mode: ${mode}`);
  const needle = normalizeForSearch(String(keyword).trim());
  if (!needle) return [];
  return players.filter((p) => p.name && match(normalizeForSearch(p.name), needle));
}
