const USER_AGENT = 'zonetracker-resolver/0.1';
const FETCH_TIMEOUT_MS = 15_000;

function boxscoreUrl(gamePk) {
  return `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`;
}

async function fetchBoxscore(gamePk) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(boxscoreUrl(gamePk), {
      headers: { 'User-Agent': USER_AGENT, accept: 'application/json' },
      signal: ctrl.signal,
    });
    return { res, body: res.ok ? await res.json() : null };
  } finally {
    clearTimeout(timer);
  }
}

function logFetch(db, row) {
  db.prepare(
    `INSERT INTO fetch_log
       (sport, fetch_type, target, status, items, duration_ms, http_status, error, fetched_at)
     VALUES (@sport, @fetch_type, @target, @status, @items, @duration_ms, @http_status, @error, @fetched_at)`
  ).run(row);
}

function splitName(fullName) {
  if (!fullName) return { first: null, last: null };
  const trimmed = String(fullName).trim();
  const idx = trimmed.lastIndexOf(' ');
  if (idx < 0) return { first: null, last: trimmed };
  return { first: trimmed.slice(0, idx), last: trimmed.slice(idx + 1) };
}

function hasStats(p) {
  const b = p?.stats?.batting;
  const pi = p?.stats?.pitching;
  const f = p?.stats?.fielding;
  return (
    (b && Object.keys(b).length > 0) ||
    (pi && Object.keys(pi).length > 0) ||
    (f && Object.keys(f).length > 0)
  );
}

async function pullBoxscore(db, gamePk) {
  const startedAt = Date.now();
  let httpStatus = null;
  let playersInserted = 0;

  try {
    const { res, body } = await fetchBoxscore(gamePk);
    httpStatus = res.status;
    if (!res.ok) {
      throw new Error(`MLB boxscore fetch HTTP ${res.status} for gamePk=${gamePk}`);
    }

    const gameDateRow = db
      .prepare('SELECT game_date FROM mlb_games WHERE game_pk = ?')
      .get(gamePk);
    const gameDate = gameDateRow?.game_date ?? null;

    const playerUpsert = db.prepare(`
      INSERT INTO mlb_players
        (player_id, full_name, first_name, last_name, primary_position,
         current_team_id, last_seen_date, raw_json, fetched_at)
      VALUES
        (@player_id, @full_name, @first_name, @last_name, @primary_position,
         @current_team_id, @last_seen_date, @raw_json, @fetched_at)
      ON CONFLICT(player_id) DO UPDATE SET
        full_name        = excluded.full_name,
        primary_position = excluded.primary_position,
        current_team_id  = excluded.current_team_id,
        last_seen_date   = excluded.last_seen_date,
        fetched_at       = excluded.fetched_at
    `);

    const statsUpsert = db.prepare(`
      INSERT INTO mlb_player_game_stats
        (game_pk, player_id, team_id, game_date, is_starter, position,
         batting_json, pitching_json, fielding_json, raw_json, fetched_at)
      VALUES
        (@game_pk, @player_id, @team_id, @game_date, @is_starter, @position,
         @batting_json, @pitching_json, @fielding_json, @raw_json, @fetched_at)
      ON CONFLICT(game_pk, player_id) DO UPDATE SET
        team_id       = excluded.team_id,
        game_date     = excluded.game_date,
        is_starter    = excluded.is_starter,
        position      = excluded.position,
        batting_json  = excluded.batting_json,
        pitching_json = excluded.pitching_json,
        fielding_json = excluded.fielding_json,
        raw_json      = excluded.raw_json,
        fetched_at    = excluded.fetched_at
    `);

    const markFetched = db.prepare(
      'UPDATE mlb_games SET boxscore_fetched_at = ? WHERE game_pk = ?'
    );

    const now = Date.now();
    const sides = ['home', 'away'];

    const apply = db.transaction(() => {
      for (const side of sides) {
        const teamBlock = body?.teams?.[side];
        if (!teamBlock) continue;
        const teamId = teamBlock.team?.id;
        const players = teamBlock.players || {};
        for (const key of Object.keys(players)) {
          const p = players[key];
          if (!p?.person?.id) continue;
          if (!hasStats(p)) continue;

          const playerId = p.person.id;
          const fullName = p.person.fullName || null;
          const { first, last } = splitName(fullName);
          const position = p.position?.abbreviation ?? null;

          playerUpsert.run({
            player_id: playerId,
            full_name: fullName,
            first_name: first,
            last_name: last,
            primary_position: position,
            current_team_id: teamId ?? null,
            last_seen_date: gameDate,
            raw_json: JSON.stringify(p.person),
            fetched_at: now,
          });

          statsUpsert.run({
            game_pk: gamePk,
            player_id: playerId,
            team_id: teamId ?? null,
            game_date: gameDate,
            is_starter: p.battingOrder ? 1 : 0,
            position,
            batting_json: JSON.stringify(p.stats?.batting || {}),
            pitching_json: JSON.stringify(p.stats?.pitching || {}),
            fielding_json: JSON.stringify(p.stats?.fielding || {}),
            raw_json: JSON.stringify(p),
            fetched_at: now,
          });

          playersInserted += 1;
        }
      }
      markFetched.run(now, gamePk);
    });
    apply();

    const durationMs = Date.now() - startedAt;
    logFetch(db, {
      sport: 'mlb',
      fetch_type: 'boxscore',
      target: String(gamePk),
      status: 'ok',
      items: playersInserted,
      duration_ms: durationMs,
      http_status: httpStatus,
      error: null,
      fetched_at: Date.now(),
    });

    return { gamePk, players: playersInserted, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    try {
      logFetch(db, {
        sport: 'mlb',
        fetch_type: 'boxscore',
        target: String(gamePk),
        status: 'error',
        items: 0,
        duration_ms: durationMs,
        http_status: httpStatus,
        error: String(err?.message || err),
        fetched_at: Date.now(),
      });
    } catch (_) {
      // swallow — surface the original error
    }
    throw err;
  }
}

async function pullPendingBoxscores(db, log, { limit = 5 } = {}) {
  const rows = db
    .prepare(
      `SELECT game_pk FROM mlb_games
        WHERE status_code = 'F' AND boxscore_fetched_at IS NULL
        ORDER BY game_datetime ASC
        LIMIT ?`
    )
    .all(limit);

  const errors = [];
  let succeeded = 0;
  for (const { game_pk: gamePk } of rows) {
    try {
      await pullBoxscore(db, gamePk);
      succeeded += 1;
    } catch (err) {
      errors.push({ gamePk, error: String(err?.message || err) });
      log.error({ err: err.message, gamePk }, '[boxscore] pull failed');
    }
  }

  const result = {
    attempted: rows.length,
    succeeded,
    failed: errors.length,
    errors,
  };
  if (rows.length > 0) {
    log.info(
      { attempted: result.attempted, succeeded: result.succeeded, failed: result.failed },
      '[boxscore] batch complete'
    );
  }
  return result;
}

module.exports = { pullBoxscore, pullPendingBoxscores };
