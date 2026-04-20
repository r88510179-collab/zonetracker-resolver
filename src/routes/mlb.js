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

  fastify.get('/schedule', async (req, reply) => {
    const { date } = req.query || {};
    if (!date || !DATE_RE.test(date)) {
      return reply.code(400).send({ error: 'invalid or missing date (YYYY-MM-DD)' });
    }
    const games = listForDate.all(date);
    return { date, count: games.length, games };
  });
}

module.exports = mlbRoutes;
