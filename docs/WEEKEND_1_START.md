# Weekend 1 MLB StatsAPI Resolver

## State at start Apr 18 Saturday

Scaffolding deployed Fri Apr 17. Verified working:
- https://zonetracker-resolver.fly.dev/health public
- http://zonetracker-resolver.internal:8080/health private from bot
- Fly volume resolver_data mounted at /data
- Fastify on port 8080 bound to :: for IPv6
- Node 20-alpine better-sqlite3 installed

## Today scope

1. MLB teams seed table 30 teams from StatsAPI
2. Schedule puller fetches today and yesterday every 15 min
3. Box score puller pulls box scores for Final games nightly + on-demand
4. GET /mlb/schedule?date=YYYY-MM-DD
5. GET /mlb/game?teams=X,Y&date=YYYY-MM-DD
6. GET /mlb/player-prop?player=X&stat=Y&threshold=N&direction=over|under&date=D
7. Bot integration in ~/Documents/discord/services/resolver.js
8. Wire into grading flow BEFORE ESPN pre-check resolver -> ESPN -> AI

## APIs to know

MLB StatsAPI free no key:
- Schedule https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=YYYY-MM-DD
- Teams https://statsapi.mlb.com/api/v1/teams?sportId=1
- Boxscore https://statsapi.mlb.com/api/v1/game/{gamePk}/boxscore

## Stats supported weekend 1

Batting: hits, runs, rbis, home_runs, total_bases, walks, strikeouts_batter, stolen_bases
Pitching: innings_pitched, strikeouts_pitcher, hits_allowed, runs_allowed, earned_runs
Compound: hits+runs+rbis, outs_recorded 3 times IP

## NOT in scope

- NBA NHL NFL future weekends
- Parlays with mixed sports stay on AI
- Team alias learning hardcoded for now
- Odds verification

## Fresh session opener paste into new Claude chat Saturday morning

Weekend 1 start. Resolver scaffold deployed yesterday at zonetracker-resolver.fly.dev. Ready to ship MLB StatsAPI integration per ~/Documents/zonetracker-resolver/docs/WEEKEND_1_START.md. Let us draft the data model + schedule puller first.
