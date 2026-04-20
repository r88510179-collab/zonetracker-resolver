const { normalizeName, effectiveLastToken, levenshtein } = require('../util/strings');

const FUZZY_MAX = 2;
const FUZZY_GAP = 1;

function hit(row, matched_via) {
  return {
    player_id: row.player_id,
    full_name: row.full_name,
    current_team_id: row.current_team_id ?? null,
    matched_via,
  };
}

function resolvePlayer(db, { name, date }) {
  const raw = (name || '').trim();
  if (!raw) return null;

  const lcRaw = raw.toLowerCase();
  const nameLookupByFull = db.prepare(
    'SELECT player_id, full_name, current_team_id FROM mlb_players WHERE lower(full_name) = ?'
  );

  // Strategy 1a — exact case-insensitive full_name match on the raw input.
  const exactRaw = nameLookupByFull.get(lcRaw);
  if (exactRaw) return hit(exactRaw, 'exact');

  const normalizedQuery = normalizeName(raw);
  if (!normalizedQuery) return null;

  // Strategy 1b — normalize on both sides. Stored last_name can be a suffix
  // (e.g. "Jr.") because splitName() takes the final whitespace-separated
  // token, so look up candidates by effective last-name AND by the raw last
  // token, then compare normalized full names in JS.
  const tokens = normalizedQuery.split(' ');
  const rawLast = tokens[tokens.length - 1] || '';
  const effLast = effectiveLastToken(normalizedQuery);

  const lastNameHits = db
    .prepare(
      `SELECT player_id, full_name, current_team_id
         FROM mlb_players
        WHERE lower(replace(last_name, '.', '')) IN (?, ?)`
    )
    .all(effLast, rawLast);

  for (const row of lastNameHits) {
    if (normalizeName(row.full_name) === normalizedQuery) {
      return hit(row, 'exact');
    }
  }

  // Strategies 2 & 3 need date-scoped candidates.
  if (!date) return null;
  const playedToday = db
    .prepare(
      `SELECT DISTINCT p.player_id, p.full_name, p.current_team_id, p.last_name
         FROM mlb_player_game_stats pgs
         JOIN mlb_players p ON p.player_id = pgs.player_id
        WHERE pgs.game_date = ?`
    )
    .all(date);
  if (playedToday.length === 0) return null;

  // Precompute normalized forms of candidates.
  const candidates = playedToday.map((r) => ({
    row: r,
    normFull: normalizeName(r.full_name),
    normLast: normalizeName(r.last_name || ''),
  }));

  // Strategy 2 — last-name match among same-date participants.
  const lastNameMatches = candidates.filter(
    (c) => c.normLast === effLast || c.normLast === rawLast
  );
  if (lastNameMatches.length === 1) {
    return hit(lastNameMatches[0].row, 'last_name_date');
  }
  if (lastNameMatches.length > 1) {
    // Tiebreak by full-name similarity.
    const scored = lastNameMatches
      .map((c) => ({ row: c.row, dist: levenshtein(c.normFull, normalizedQuery) }))
      .sort((a, b) => a.dist - b.dist);
    const best = scored[0];
    const next = scored[1];
    if (!next || next.dist - best.dist >= FUZZY_GAP) {
      return hit(best.row, 'last_name_date');
    }
  }

  // Strategy 3 — fuzzy match across same-date participants.
  const scored = candidates
    .map((c) => ({ row: c.row, dist: levenshtein(c.normFull, normalizedQuery) }))
    .sort((a, b) => a.dist - b.dist);
  const best = scored[0];
  const next = scored[1];
  if (best && best.dist <= FUZZY_MAX && (!next || next.dist - best.dist >= FUZZY_GAP + 1)) {
    return hit(best.row, 'fuzzy');
  }

  return null;
}

module.exports = { resolvePlayer };
