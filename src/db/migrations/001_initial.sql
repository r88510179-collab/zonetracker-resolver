CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mlb_games (
  game_pk          INTEGER PRIMARY KEY,
  game_date        TEXT    NOT NULL,
  game_datetime    TEXT    NOT NULL,
  status_code      TEXT    NOT NULL,
  status_detailed  TEXT,
  home_team_id     INTEGER NOT NULL,
  away_team_id     INTEGER NOT NULL,
  home_score       INTEGER,
  away_score       INTEGER,
  venue            TEXT,
  double_header    TEXT,
  game_number      INTEGER DEFAULT 1,
  season           INTEGER NOT NULL,
  game_type        TEXT,
  raw_json         TEXT,
  boxscore_fetched_at INTEGER,
  fetched_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mlb_games_date   ON mlb_games(game_date);
CREATE INDEX IF NOT EXISTS idx_mlb_games_status ON mlb_games(status_code);
CREATE INDEX IF NOT EXISTS idx_mlb_games_need_box
  ON mlb_games(status_code, boxscore_fetched_at)
  WHERE status_code = 'F' AND boxscore_fetched_at IS NULL;

CREATE TABLE IF NOT EXISTS mlb_teams (
  team_id        INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  team_code      TEXT,
  abbreviation   TEXT,
  location_name  TEXT,
  team_name      TEXT,
  short_name     TEXT,
  aliases_json   TEXT,
  active         INTEGER DEFAULT 1,
  raw_json       TEXT,
  fetched_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mlb_teams_abbr ON mlb_teams(abbreviation);

CREATE TABLE IF NOT EXISTS mlb_players (
  player_id        INTEGER PRIMARY KEY,
  full_name        TEXT NOT NULL,
  first_name       TEXT,
  last_name        TEXT,
  primary_number   TEXT,
  primary_position TEXT,
  bat_side         TEXT,
  pitch_hand       TEXT,
  current_team_id  INTEGER,
  aliases_json     TEXT,
  last_seen_date   TEXT,
  raw_json         TEXT,
  fetched_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mlb_players_last ON mlb_players(last_name);
CREATE INDEX IF NOT EXISTS idx_mlb_players_full ON mlb_players(full_name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS mlb_player_game_stats (
  game_pk        INTEGER NOT NULL,
  player_id      INTEGER NOT NULL,
  team_id        INTEGER NOT NULL,
  game_date      TEXT    NOT NULL,
  is_starter     INTEGER DEFAULT 0,
  position       TEXT,
  batting_json   TEXT,
  pitching_json  TEXT,
  fielding_json  TEXT,
  raw_json       TEXT,
  fetched_at     INTEGER NOT NULL,
  PRIMARY KEY (game_pk, player_id)
);
CREATE INDEX IF NOT EXISTS idx_pgs_player_date ON mlb_player_game_stats(player_id, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_pgs_date        ON mlb_player_game_stats(game_date);

CREATE TABLE IF NOT EXISTS fetch_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sport        TEXT    NOT NULL,
  fetch_type   TEXT    NOT NULL,
  target       TEXT    NOT NULL,
  status       TEXT    NOT NULL,
  items        INTEGER,
  duration_ms  INTEGER,
  http_status  INTEGER,
  error        TEXT,
  fetched_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fetch_log_recent ON fetch_log(sport, fetch_type, fetched_at DESC);
