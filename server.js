const Fastify = require('fastify');
const replyFrom = require('@fastify/reply-from');

const fastify = Fastify({ logger: true });

// Register the proxy forwarding plugin
fastify.register(replyFrom, {
  errorHandler: false // Standard error handling
});

// Gateway route to accept target requests via query parameter (e.g., /proxy?url=https://...)
fastify.get('/proxy', async (request, reply) => {
  const targetUrl = request.query.url;

  if (!targetUrl) {
    return reply.status(400).send({ error: 'Missing "url" query parameter.' });
  }

  try {
    // Validate that the provided URL is well-formed
    const parsedUrl = new URL(targetUrl);
    
    // Forward the request to the target URL destination
    return reply.from(parsedUrl.href);
  } catch (err) {
    return reply.status(400).send({ error: 'Invalid URL provided.' });
  }
});

// Base landing check
fastify.get('/', async (request, reply) => {
  return { status: 'Proxy server is running. Use /proxy?url=TARGET_URL' };
});

// Start the server on host 0.0.0.0 for Render compatibility
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port: port, host: '0.0.0.0' });
    console.log(`Proxy server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
