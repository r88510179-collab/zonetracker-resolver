const { pullSchedule } = require('./schedulePuller');
const { pullPendingBoxscores } = require('./boxscorePuller');

const SCHEDULE_INTERVAL_MS = 15 * 60 * 1000;
const BOXSCORE_INTERVAL_MS = 2 * 60 * 1000;
const BOXSCORE_INITIAL_DELAY_MS = 30 * 1000;
const BOXSCORE_BATCH_LIMIT = 5;

async function scheduleTick(db, log) {
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
  scheduleTick(db, log);
  const intervalId = setInterval(() => scheduleTick(db, log), SCHEDULE_INTERVAL_MS);
  if (typeof intervalId.unref === 'function') intervalId.unref();
  return intervalId;
}

async function boxscoreTick(db, log) {
  try {
    await pullPendingBoxscores(db, log, { limit: BOXSCORE_BATCH_LIMIT });
  } catch (err) {
    log.error({ err: err.message }, '[boxscore] tick failed');
  }
}

function startBoxscoreScheduler(db, log) {
  let intervalId = null;
  const delayId = setTimeout(() => {
    boxscoreTick(db, log);
    intervalId = setInterval(() => boxscoreTick(db, log), BOXSCORE_INTERVAL_MS);
    if (typeof intervalId.unref === 'function') intervalId.unref();
  }, BOXSCORE_INITIAL_DELAY_MS);
  if (typeof delayId.unref === 'function') delayId.unref();
  return { stop: () => { clearTimeout(delayId); if (intervalId) clearInterval(intervalId); } };
}

module.exports = {
  startScheduler,
  startBoxscoreScheduler,
  SCHEDULE_INTERVAL_MS,
  BOXSCORE_INTERVAL_MS,
  BOXSCORE_INITIAL_DELAY_MS,
};
