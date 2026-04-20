const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function mlbRoutes(fastify, _opts) {
  const listForDate = fastify.db.prepare(`
    SELECT game_pk, game_date, game_datetime, status_code, status_detailed,
           home_team_id, away_team_id, home_score, away_score,
           double_header, game_number, venue
      FROM mlb_games
     WHERE game_date = ?
     ORDER BY game_datetime
  `);

  const teamByAbbrev = fastify.db.prepare(
    'SELECT team_id, abbreviation FROM mlb_teams WHERE UPPER(abbreviation) = ?'
  );

  const findGames = fastify.db.prepare(`
    SELECT game_pk, game_date, game_datetime, status_code, status_detailed,
           home_team_id, away_team_id, home_score, away_score,
           double_header, game_number, venue, boxscore_fetched_at
      FROM mlb_games
     WHERE game_date = ?
       AND ((home_team_id = ? AND away_team_id = ?)
         OR (home_team_id = ? AND away_team_id = ?))
     ORDER BY game_number
  `);

  fastify.get('/schedule', async (req, reply) => {
    const { date } = req.query || {};
    if (!date || !DATE_RE.test(date)) {
      return reply.code(400).send({ error: 'invalid or missing date (YYYY-MM-DD)' });
    }
    const games = listForDate.all(date);
    return { date, count: games.length, games };
  });

  fastify.get('/game', async (req, reply) => {
    const { teams, date } = req.query || {};
    if (!date || !DATE_RE.test(date)) {
      return reply.code(400).send({ error: 'invalid or missing date (YYYY-MM-DD)' });
    }
    if (!teams || typeof teams !== 'string') {
      return reply.code(400).send({ error: 'teams required: XXX,YYY' });
    }
    const parts = teams
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (parts.length !== 2) {
      return reply.code(400).send({ error: 'teams must be two comma-separated abbreviations' });
    }
    const resolved = parts.map((a) => ({ abbrev: a, row: teamByAbbrev.get(a) }));
    const unknown = resolved.filter((r) => !r.row).map((r) => r.abbrev);
    if (unknown.length > 0) {
      return reply.code(400).send({ error: 'unknown team', teams: unknown });
    }
    const [a, b] = resolved.map((r) => r.row.team_id);
    const games = findGames.all(date, a, b, b, a);
    if (games.length === 0) {
      return reply.code(404).send({ error: 'not found', teams: parts, date });
    }
    return { teams: parts, date, count: games.length, games };
  });
}

module.exports = mlbRoutes;
