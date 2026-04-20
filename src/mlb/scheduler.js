const { pullSchedule } = require('./schedulePuller');

const INTERVAL_MS = 15 * 60 * 1000;

async function tick(db, log) {
  try {
    const { total, newlyFinal, durationMs, inserted, updated } =
      await pullSchedule(db);
    log.info(
      { total, inserted, updated, newlyFinal: newlyFinal.length, durationMs },
      '[schedule] pulled'
    );
  } catch (err) {
    log.error({ err: err.message }, '[schedule] pull failed');
  }
}

function startScheduler(db, log) {
  tick(db, log);
  const intervalId = setInterval(() => tick(db, log), INTERVAL_MS);
  if (typeof intervalId.unref === 'function') intervalId.unref();
  return intervalId;
}

module.exports = { startScheduler, INTERVAL_MS };
