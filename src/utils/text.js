const COLOR_CODE = /\^[0-9]/g;
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;

/** Strip FiveM color codes (^1), control and invisible characters, collapse whitespace. */
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(COLOR_CODE, '').replace(/\s+/g, ' ').replace(INVISIBLE, '').trim();
}

export function normalizeForSearch(value) {
  return String(value).normalize('NFKC').toLowerCase();
}

export function truncate(value, max) {
  const chars = [...value];
  return chars.length <= max ? value : `${chars.slice(0, max - 1).join('')}…`;
}
