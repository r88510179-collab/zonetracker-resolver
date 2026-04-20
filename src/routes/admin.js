const { seedTeams } = require('../mlb/teamsSeeder');
const { pullSchedule } = require('../mlb/schedulePuller');
const { pullBoxscore, pullPendingBoxscores } = require('../mlb/boxscorePuller');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function adminRoutes(fastify, _opts) {
  fastify.addHook('onRequest', async (req, reply) => {
    const expected = process.env.ADMIN_KEY;
    const got = req.headers['x-admin-key'];
    if (!expected || !got || got !== expected) {
      reply.code(401).send({ error: 'unauthorized' });
      return reply;
    }
  });

  fastify.post('/seed-teams', async () => {
    const startedAt = Date.now();
    const seeded = await seedTeams(fastify.db, { force: true });
    return { seeded, duration_ms: Date.now() - startedAt };
  });

  fastify.post('/pull-schedule', async (req, reply) => {
    const body = req.body || {};
    const { start, end } = body;
    if (start != null && !DATE_RE.test(start)) {
      return reply.code(400).send({ error: 'invalid start (YYYY-MM-DD)' });
    }
    if (end != null && !DATE_RE.test(end)) {
      return reply.code(400).send({ error: 'invalid end (YYYY-MM-DD)' });
    }
    try {
      return await pullSchedule(fastify.db, { start, end });
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.post('/pull-boxscore', async (req, reply) => {
    const body = req.body || {};
    const gamePk = Number(body.gamePk);
    if (!Number.isInteger(gamePk) || gamePk <= 0) {
      return reply.code(400).send({ error: 'gamePk required (integer)' });
    }
    const statusRow = fastify.db
      .prepare('SELECT status_code FROM mlb_games WHERE game_pk = ?')
      .get(gamePk);
    if (statusRow && statusRow.status_code !== 'F') {
      req.log.warn(
        { gamePk, status_code: statusRow.status_code },
        '[admin] pull-boxscore on non-final game'
      );
    }
    try {
      return await pullBoxscore(fastify.db, gamePk);
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.post('/pull-pending-boxscores', async (req, reply) => {
    const body = req.body || {};
    let limit = body.limit == null ? 5 : Number(body.limit);
    if (!Number.isInteger(limit) || limit < 1) limit = 5;
    if (limit > 20) limit = 20;
    try {
      return await pullPendingBoxscores(fastify.db, req.log, { limit });
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });
}

module.exports = adminRoutes;
