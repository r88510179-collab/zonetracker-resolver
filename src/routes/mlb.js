const { isKnownStat, resolveStat, listSupportedStats } = require('../mlb/statRegistry');
const { resolvePlayer } = require('../mlb/nameResolver');
const { gradeProp } = require('../mlb/propGrader');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE = 'mlb.statsapi';

function parseJson(s, fallback = {}) {
  if (!s) return fallback;
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? v : fallback;
  } catch (_) {
    return fallback;
  }
}

async function mlbRoutes(fastify, _opts) {
  const db = fastify.db;

  const listForDate = db.prepare(`
    SELECT game_pk, game_date, game_datetime, status_code, status_detailed,
           home_team_id, away_team_id, home_score, away_score,
           double_header, game_number, venue
      FROM mlb_games
     WHERE game_date = ?
     ORDER BY game_datetime
  `);

  const teamByAbbrev = db.prepare(
    'SELECT team_id, abbreviation FROM mlb_teams WHERE UPPER(abbreviation) = ?'
  );

  const findGames = db.prepare(`
    SELECT game_pk, game_date, game_datetime, status_code, status_detailed,
           home_team_id, away_team_id, home_score, away_score,
           double_header, game_number, venue, boxscore_fetched_at
      FROM mlb_games
     WHERE game_date = ?
       AND ((home_team_id = ? AND away_team_id = ?)
         OR (home_team_id = ? AND away_team_id = ?))
     ORDER BY game_number
  `);

  const statLineForPlayerOnDate = db.prepare(`
    SELECT pgs.game_pk, pgs.player_id, pgs.team_id, pgs.game_date,
           pgs.is_starter, pgs.position, pgs.batting_json, pgs.pitching_json,
           g.status_code, g.status_detailed
      FROM mlb_player_game_stats pgs
      JOIN mlb_games g ON g.game_pk = pgs.game_pk
     WHERE pgs.player_id = ? AND pgs.game_date = ?
     LIMIT 1
  `);

  const gameForTeamOnDate = db.prepare(`
    SELECT game_pk, status_code, status_detailed, home_team_id, away_team_id
      FROM mlb_games
     WHERE game_date = ?
       AND (home_team_id = ? OR away_team_id = ?)
     ORDER BY game_datetime
     LIMIT 1
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

  fastify.get('/stats', async () => {
    return { supported: listSupportedStats() };
  });

  fastify.get('/player-prop', async (req, reply) => {
    const q = req.query || {};
    const player = typeof q.player === 'string' ? q.player.trim() : '';
    const stat = typeof q.stat === 'string' ? q.stat.trim() : '';
    const direction = typeof q.direction === 'string' ? q.direction.trim().toLowerCase() : '';
    const date = typeof q.date === 'string' ? q.date.trim() : '';
    const thresholdRaw = q.threshold;

    if (!player || player.length > 80) {
      return reply.code(400).send({ error: 'player required (1-80 chars)' });
    }
    if (!stat) {
      return reply.code(400).send({ error: 'stat required' });
    }
    if (!isKnownStat(stat)) {
      return reply.code(400).send({
        error: 'unsupported stat',
        stat,
        supported: listSupportedStats(),
      });
    }
    if (thresholdRaw == null || thresholdRaw === '') {
      return reply.code(400).send({ error: 'threshold required (number)' });
    }
    const threshold = Number(thresholdRaw);
    if (!Number.isFinite(threshold)) {
      return reply.code(400).send({ error: 'threshold must be a finite number' });
    }
    if (direction !== 'over' && direction !== 'under') {
      return reply.code(400).send({ error: 'direction must be over or under' });
    }
    if (!date || !DATE_RE.test(date)) {
      return reply.code(400).send({ error: 'invalid or missing date (YYYY-MM-DD)' });
    }

    const base = { stat, threshold, direction, date, source: SOURCE };

    const resolved = resolvePlayer(db, { name: player, date });
    if (!resolved) {
      return {
        result: 'unknown',
        reason: 'player_not_found',
        player_query: player,
        ...base,
      };
    }
    const playerBlock = {
      id: resolved.player_id,
      full_name: resolved.full_name,
      matched_via: resolved.matched_via,
    };

    const line = statLineForPlayerOnDate.get(resolved.player_id, date);

    if (!line) {
      const game = gameForTeamOnDate.get(
        date,
        resolved.current_team_id ?? -1,
        resolved.current_team_id ?? -1
      );
      if (!game) {
        return {
          result: 'unknown',
          reason: 'no_game_for_team_on_date',
          player: playerBlock,
          ...base,
        };
      }
      if (game.status_code !== 'F') {
        return {
          result: 'pending',
          player: playerBlock,
          game: {
            game_pk: game.game_pk,
            status: game.status_code,
            status_detailed: game.status_detailed,
            date,
          },
          ...base,
        };
      }
      return {
        result: 'unknown',
        reason: 'no_stat_line',
        player: playerBlock,
        game: {
          game_pk: game.game_pk,
          status: game.status_code,
          status_detailed: game.status_detailed,
          date,
        },
        ...base,
      };
    }

    const gameBlock = {
      game_pk: line.game_pk,
      status: line.status_code,
      status_detailed: line.status_detailed,
      date,
    };

    if (line.status_code !== 'F') {
      return { result: 'pending', player: playerBlock, game: gameBlock, ...base };
    }

    const batting = parseJson(line.batting_json);
    const pitching = parseJson(line.pitching_json);
    const resolvedStat = resolveStat(stat, batting, pitching);
    if (!resolvedStat) {
      // Should not happen — isKnownStat gated this above.
      return reply.code(500).send({ error: 'stat resolution failed', stat });
    }

    const grade = gradeProp({ value: resolvedStat.value, threshold, direction });
    return {
      result: grade,
      actual: resolvedStat.value,
      threshold,
      direction,
      stat,
      player: playerBlock,
      game: gameBlock,
      source: SOURCE,
    };
  });
}

module.exports = mlbRoutes;
