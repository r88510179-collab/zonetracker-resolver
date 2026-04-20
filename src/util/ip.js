function parseIPToOuts(ip) {
  if (ip == null || ip === '') return 0;
  const n = typeof ip === 'number' ? ip : Number(ip);
  if (!Number.isFinite(n) || n < 0) return 0;
  const whole = Math.trunc(n);
  const frac = Math.round((n - whole) * 10);
  const thirds = frac === 1 ? 1 : frac === 2 ? 2 : 0;
  return whole * 3 + thirds;
}

function parseIPToDecimal(ip) {
  return parseIPToOuts(ip) / 3;
}

module.exports = { parseIPToOuts, parseIPToDecimal };

// Expected behavior (sanity checks — no test runner):
// parseIPToOuts("5.0") === 15
// parseIPToOuts("5.1") === 16
// parseIPToOuts("5.2") === 17
// parseIPToOuts("6.0") === 18
// parseIPToOuts("")   === 0
// parseIPToOuts(null) === 0
// parseIPToOuts(5.2)  === 17   (numeric input: .2 is two-thirds of an inning)
// parseIPToDecimal("5.2") ~= 5.6666...
