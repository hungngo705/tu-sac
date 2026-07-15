import { createServer } from 'node:http';

// Vercel detects the WebSocket server from this entrypoint's direct
// createServer() + default export. Moving creation into another module makes
// it treat this file like a regular request handler instead.
const httpServer = createServer(async (request, response) => {
  // Safe diagnostic fallback: if Engine.IO does not claim the request, expose
  // the URL Vercel passed to this server so routing can be verified remotely.
  let diagnostic: Record<string, unknown>;
  try {
    const module = await import('../server/src/socket-server');
    diagnostic = { importOk: typeof module.attachGameSocketServer === 'function' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const secret = process.env.REDIS_URL || process.env.KV_URL;
    diagnostic = {
      importOk: false,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: secret ? message.replaceAll(secret, '[REDACTED]') : message,
    };
  }
  response.statusCode = 200;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ ok: true, path: request.url, diagnostic }));
});

export default httpServer;
