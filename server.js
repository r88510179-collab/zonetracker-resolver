const fastify = require('fastify')({ logger: true });

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
  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`Resolver listening on ${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
