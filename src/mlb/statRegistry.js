const { parseIPToOuts, parseIPToDecimal } = require('../util/ip');

const n = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

const STAT_REGISTRY = {
  hits:               { category: 'batting',  unit: 'count',
    extract: (b) => n(b.hits) },
  runs:               { category: 'batting',  unit: 'count',
    extract: (b) => n(b.runs) },
  rbis:               { category: 'batting',  unit: 'count',
    extract: (b) => n(b.rbi) },
  home_runs:          { category: 'batting',  unit: 'count',
    extract: (b) => n(b.homeRuns) },
  total_bases:        { category: 'batting',  unit: 'count',
    extract: (b) => n(b.totalBases) },
  walks:              { category: 'batting',  unit: 'count',
    extract: (b) => n(b.baseOnBalls) },
  strikeouts_batter:  { category: 'batting',  unit: 'count',
    extract: (b) => n(b.strikeOuts) },
  stolen_bases:       { category: 'batting',  unit: 'count',
    extract: (b) => n(b.stolenBases) },

  strikeouts_pitcher: { category: 'pitching', unit: 'count',
    extract: (_b, p) => n(p.strikeOuts) },
  hits_allowed:       { category: 'pitching', unit: 'count',
    extract: (_b, p) => n(p.hits) },
  runs_allowed:       { category: 'pitching', unit: 'count',
    extract: (_b, p) => n(p.runs) },
  earned_runs:        { category: 'pitching', unit: 'count',
    extract: (_b, p) => n(p.earnedRuns) },
  innings_pitched:    { category: 'pitching', unit: 'ip_decimal',
    extract: (_b, p) => parseIPToDecimal(p.inningsPitched) },
  outs_recorded:      { category: 'pitching', unit: 'count',
    extract: (_b, p) => parseIPToOuts(p.inningsPitched) },

  'hits+runs+rbis':   { category: 'compound', unit: 'count',
    extract: (b) => n(b.hits) + n(b.runs) + n(b.rbi) },
};

function isKnownStat(name) {
  return Object.prototype.hasOwnProperty.call(STAT_REGISTRY, name);
}

function resolveStat(name, batting, pitching) {
  const entry = STAT_REGISTRY[name];
  if (!entry) return null;
  const value = entry.extract(batting || {}, pitching || {});
  return { value, unit: entry.unit };
}

function listSupportedStats() {
  return Object.keys(STAT_REGISTRY).sort();
}

module.exports = { STAT_REGISTRY, isKnownStat, resolveStat, listSupportedStats };
