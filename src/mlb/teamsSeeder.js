const TEAMS_URL =
  'https://statsapi.mlb.com/api/v1/teams?sportId=1&activeStatus=Y';
const USER_AGENT = 'zonetracker-resolver/0.1';
const FETCH_TIMEOUT_MS = 10_000;

async function fetchTeams() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(TEAMS_URL, {
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

async function seedTeams(db, { force = false } = {}) {
  const startedAt = Date.now();
  let httpStatus = null;
  try {
    const { res, body } = await fetchTeams();
    httpStatus = res.status;
    if (!res.ok) {
      throw new Error(`MLB teams fetch HTTP ${res.status}`);
    }
    const teams = Array.isArray(body?.teams) ? body.teams : [];
    if (teams.length === 0) {
      throw new Error('MLB teams response contained no teams');
    }

    const upsert = db.prepare(`
      INSERT INTO mlb_teams
        (team_id, name, team_code, abbreviation, location_name, team_name,
         short_name, active, raw_json, fetched_at)
      VALUES
        (@team_id, @name, @team_code, @abbreviation, @location_name, @team_name,
         @short_name, 1, @raw_json, @fetched_at)
      ON CONFLICT(team_id) DO UPDATE SET
        name          = excluded.name,
        team_code     = excluded.team_code,
        abbreviation  = excluded.abbreviation,
        location_name = excluded.location_name,
        team_name     = excluded.team_name,
        short_name    = excluded.short_name,
        active        = 1,
        raw_json      = excluded.raw_json,
        fetched_at    = excluded.fetched_at
    `);

    const now = Date.now();
    const applyAll = db.transaction((rows) => {
      for (const t of rows) {
        upsert.run({
          team_id: t.id,
          name: t.name ?? null,
          team_code: t.teamCode ?? null,
          abbreviation: t.abbreviation ?? null,
          location_name: t.locationName ?? null,
          team_name: t.teamName ?? null,
          short_name: t.shortName ?? null,
          raw_json: JSON.stringify(t),
          fetched_at: now,
        });
      }
    });
    applyAll(teams);

    const duration = Date.now() - startedAt;
    logFetch(db, {
      sport: 'mlb',
      fetch_type: 'teams',
      target: 'all',
      status: 'ok',
      items: teams.length,
      duration_ms: duration,
      http_status: httpStatus,
      error: null,
      fetched_at: now,
    });

    return teams.length;
  } catch (err) {
    const duration = Date.now() - startedAt;
    try {
      logFetch(db, {
        sport: 'mlb',
        fetch_type: 'teams',
        target: 'all',
        status: 'error',
        items: 0,
        duration_ms: duration,
        http_status: httpStatus,
        error: String(err?.message || err),
        fetched_at: Date.now(),
      });
    } catch (_) {
      // swallow — the original error is what matters
    }
    throw err;
  }
}

module.exports = { seedTeams };
