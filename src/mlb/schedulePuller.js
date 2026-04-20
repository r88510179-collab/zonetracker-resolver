const { todayInET, shiftDate } = require('../util/dates');

const USER_AGENT = 'zonetracker-resolver/0.1';
const FETCH_TIMEOUT_MS = 15_000;

function scheduleUrl(start, end) {
  const qs = new URLSearchParams({
    sportId: '1',
    startDate: start,
    endDate: end,
    hydrate: 'team,venue,linescore',
  });
  return `https://statsapi.mlb.com/api/v1/schedule?${qs.toString()}`;
}

async function fetchSchedule(start, end) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(scheduleUrl(start, end), {
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

async function pullSchedule(db, { start, end } = {}) {
  const today = todayInET();
  const s = start || shiftDate(today, -1);
  const e = end || shiftDate(today, 1);
  const target = `${s}..${e}`;
  const startedAt = Date.now();
  let httpStatus = null;

  try {
    const { res, body } = await fetchSchedule(s, e);
    httpStatus = res.status;
    if (!res.ok) {
      throw new Error(`MLB schedule fetch HTTP ${res.status}`);
    }
    const dates = Array.isArray(body?.dates) ? body.dates : [];
    const games = dates.flatMap((d) => (Array.isArray(d.games) ? d.games : []));

    const priorStatus = db.prepare(
      'SELECT status_code FROM mlb_games WHERE game_pk = ?'
    );
    const insert = db.prepare(`
      INSERT INTO mlb_games
        (game_pk, game_date, game_datetime, status_code, status_detailed,
         home_team_id, away_team_id, home_score, away_score, venue,
         double_header, game_number, season, game_type, raw_json,
         fetched_at, updated_at)
      VALUES
        (@game_pk, @game_date, @game_datetime, @status_code, @status_detailed,
         @home_team_id, @away_team_id, @home_score, @away_score, @venue,
         @double_header, @game_number, @season, @game_type, @raw_json,
         @now, @now)
      ON CONFLICT(game_pk) DO UPDATE SET
        status_code     = excluded.status_code,
        status_detailed = excluded.status_detailed,
        home_score      = excluded.home_score,
        away_score      = excluded.away_score,
        raw_json        = excluded.raw_json,
        updated_at      = excluded.updated_at
    `);

    let inserted = 0;
    let updated = 0;
    const newlyFinal = [];
    const now = Date.now();

    const apply = db.transaction(() => {
      for (const g of games) {
        const prior = priorStatus.get(g.gamePk);
        const newStatus = g.status?.statusCode ?? null;
        if (prior && prior.status_code !== 'F' && newStatus === 'F') {
          newlyFinal.push(g.gamePk);
        }

        const row = {
          game_pk: g.gamePk,
          game_date:
            g.officialDate ||
            (typeof g.gameDate === 'string' ? g.gameDate.slice(0, 10) : null),
          game_datetime: g.gameDate,
          status_code: newStatus,
          status_detailed: g.status?.detailedState ?? null,
          home_team_id: g.teams?.home?.team?.id,
          away_team_id: g.teams?.away?.team?.id,
          home_score: g.teams?.home?.score ?? null,
          away_score: g.teams?.away?.score ?? null,
          venue: g.venue?.name ?? null,
          double_header: g.doubleHeader ?? 'N',
          game_number: g.gameNumber ?? 1,
          season: Number(g.season),
          game_type: g.gameType ?? null,
          raw_json: JSON.stringify(g),
          now,
        };

        const info = insert.run(row);
        if (prior) updated += 1;
        else if (info.changes > 0) inserted += 1;
      }
    });
    apply();

    const durationMs = Date.now() - startedAt;
    logFetch(db, {
      sport: 'mlb',
      fetch_type: 'schedule',
      target,
      status: 'ok',
      items: games.length,
      duration_ms: durationMs,
      http_status: httpStatus,
      error: null,
      fetched_at: Date.now(),
    });

    return {
      total: games.length,
      inserted,
      updated,
      newlyFinal,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    try {
      logFetch(db, {
        sport: 'mlb',
        fetch_type: 'schedule',
        target,
        status: 'error',
        items: 0,
        duration_ms: durationMs,
        http_status: httpStatus,
        error: String(err?.message || err),
        fetched_at: Date.now(),
      });
    } catch (_) {
      // swallow — the original error is what the caller needs
    }
    throw err;
  }
}

module.exports = { pullSchedule };
