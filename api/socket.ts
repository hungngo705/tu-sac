import { createServer } from 'node:http';

// Vercel detects the WebSocket server from this entrypoint's direct
// createServer() + default export. Moving creation into another module makes
// it treat this file like a regular request handler instead.
const httpServer = createServer(async (request, response) => {
  let diagnostic: Record<string, unknown>;
  try {
    const module = await import('../server/src/socket-server.js');
    diagnostic = { importOk: typeof module.attachGameSocketServer === 'function' };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const secret = process.env.REDIS_URL || process.env.KV_URL;
    diagnostic = {
      importOk: false,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: secret ? rawMessage.replaceAll(secret, '[REDACTED]') : rawMessage,
    };
  }
  response.statusCode = 200;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ ok: true, path: request.url, diagnostic }));
});

export default httpServer;
