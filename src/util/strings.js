function normalizeName(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,'’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const SUFFIX_TOKENS = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

// Return the "effective" last-name token — skips trailing suffixes (Jr, Sr, III).
// For "Ronald Acuna Jr" returns "acuna"; for "Aaron Judge" returns "judge";
// for single-token input returns that token.
function effectiveLastToken(normalized) {
  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length === 0) return '';
  const last = parts[parts.length - 1];
  if (SUFFIX_TOKENS.has(last) && parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return last;
}

// Bounded Levenshtein distance. Caps input length; returns exact distance.
function levenshtein(a, b, maxLen = 50) {
  const s = (a || '').slice(0, maxLen);
  const t = (b || '').slice(0, maxLen);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = new Array(t.length + 1);
  const curr = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= t.length; j++) prev[j] = curr[j];
  }
  return prev[t.length];
}

module.exports = { normalizeName, effectiveLastToken, levenshtein, SUFFIX_TOKENS };
