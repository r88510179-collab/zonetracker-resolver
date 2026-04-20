# Weekend 2 — Post-Resolver Priorities

## State at start (Apr 21+)

Weekend 1 shipped Apr 20. MLB StatsAPI resolver live at:
- https://zonetracker-resolver.fly.dev (public)
- http://zonetracker-resolver.internal:8080 (bot-internal)

Bot (v291) pre-checks resolver before ESPN for MLB player props. Non-MLB untouched.

## Known limitations carried in

- **Data depth**: resolver has ~1 day of boxscores (only what it pulled since Apr 20 deploy). Pending MLB bets from before 4/20 fall through to AI. Fix: one-shot backfill script.
- **Non-MLB**: NBA/NHL/NFL still ESPN → AI. Next sport to integrate likely NBA via Ball Don't Lie (free, already scoped in main backlog).
- **No observability of resolver impact in daily recap** — only visible via /admin resolver-health live counters.

## P1 candidates (pick one — NOT all)

### P1a — MLB backfill script
One-shot `scripts/backfill.js --days=30` on the resolver. Pulls /schedule for each day in range, boxscore-drains all Finals. Unblocks resolver on older pending bets.

### P1b — Resolver telemetry in bot snapshot
Add `[resolver] hits=N pending=N unknown=N fell_through=N` line to `/admin snapshot` and EOD recap. Daily visibility without slash command polling.

### P1c — Back to original P1 roadmap
Return to pipeline_events verification, DatDude silent-drop debug, BetService + reaper + explicit drop enums. Resolver was a detour from the Day 6 audit backlog — worth returning to.

## Fresh session opener (paste into new Claude chat)

Weekend 2 start. Resolver shipped Apr 20, v291 bot + v10 resolver app both live. Pick ONE P1: (a) MLB backfill script, (b) resolver telemetry in bot snapshot, (c) return to original P1 roadmap (pipeline_events / DatDude / BetService). See ~/Documents/zonetracker-resolver/docs/WEEKEND_2_START.md for context.
