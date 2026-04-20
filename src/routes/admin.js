const { seedTeams } = require('../mlb/teamsSeeder');

async function adminRoutes(fastify, _opts) {
  fastify.addHook('onRequest', async (req, reply) => {
    const expected = process.env.ADMIN_KEY;
    const got = req.headers['x-admin-key'];
    if (!expected || !got || got !== expected) {
      reply.code(401).send({ error: 'unauthorized' });
      return reply;
    }
  });

  fastify.post('/seed-teams', async (_req, _reply) => {
    const startedAt = Date.now();
    const seeded = await seedTeams(fastify.db, { force: true });
    return { seeded, duration_ms: Date.now() - startedAt };
  });
}

module.exports = adminRoutes;
