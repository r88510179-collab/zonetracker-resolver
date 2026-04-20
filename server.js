const path = require('path');
const fastify = require('fastify')({ logger: true });
const { openDb, runMigrations } = require('./src/db/migrate');
const { seedTeams } = require('./src/mlb/teamsSeeder');
const adminRoutes = require('./src/routes/admin');

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '::';
const STARTED_AT = new Date().toISOString();

fastify.get('/health', async () => {
  return {
    status: 'ok',
    started_at: STARTED_AT,
    uptime_sec: Math.floor(process.uptime()),
    version: process.env.FLY_MACHINE_VERSION || 'dev',
  };
});

fastify.get('/', async () => {
  return { service: 'zonetracker-resolver', health: '/health' };
});

async function main() {
  let db;
  try {
    db = openDb();
    runMigrations(db, path.join(__dirname, 'src/db/migrations'));
    console.log('[boot] migrations complete');
  } catch (err) {
    console.error('[boot] migration failure:', err);
    process.exit(1);
  }

  fastify.decorate('db', db);
  await fastify.register(adminRoutes, { prefix: '/admin' });

  const teamCount = db.prepare('SELECT COUNT(*) as c FROM mlb_teams').get().c;
  if (teamCount === 0) {
    try {
      const n = await seedTeams(db);
      fastify.log.info(`[boot] seeded ${n} MLB teams`);
    } catch (err) {
      fastify.log.error(
        { err: err.message },
        '[boot] team seed failed — server will start anyway, seed can be retried via admin endpoint'
      );
    }
  }

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`Resolver listening on ${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
