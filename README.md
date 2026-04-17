# ZoneTracker Resolver

Deterministic sports data resolver for the ZoneTracker Discord bot.

Caches game schedules, scores, and player box scores from free public APIs (MLB StatsAPI, Ball Don't Lie, NHL API, ESPN). Exposes a simple HTTP interface the bot queries to grade bets without AI calls.

## Architecture

- **Fly app name:** `zonetracker-resolver`
- **Internal DNS:** `zonetracker-resolver.internal:8080`
- **Storage:** SQLite on persistent volume at `/data/resolver.db`
- **Reached by:** `bettracker-discord-bot` via Fly internal network

## Endpoints (planned)

- `GET /health` — liveness check (implemented)
- `GET /mlb/game?teams=X,Y&date=Z` — MLB game result
- `GET /mlb/player-prop?player=P&stat=S&threshold=N&direction=over|under&date=D` — MLB player prop grading
- `GET /mlb/schedule?date=D` — MLB games on a given date

## Roadmap

### Weekend 1 (in progress)
- [x] Fly app scaffolding
- [ ] MLB StatsAPI schedule puller
- [ ] MLB StatsAPI box score puller
- [ ] Player prop resolution endpoint
- [ ] Bot wiring via `services/resolver.js`

### Future
- NBA (Ball Don't Lie)
- NHL (official API)
- NCAAB, NCAAF, NFL, soccer leagues (via ESPN)
- Team/player alias learning
- Observability dashboard

## Deploy

```bash
fly deploy
```

## Local dev

```bash
npm install
npm run dev
# Resolver on http://localhost:8080
```
