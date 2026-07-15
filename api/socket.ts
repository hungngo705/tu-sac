import { createServer } from 'node:http';

// Vercel detects the WebSocket server from this entrypoint's direct
// createServer() + default export. Moving creation into another module makes
// it treat this file like a regular request handler instead.
const httpServer = createServer((request, response) => {
  // Safe diagnostic fallback: if Engine.IO does not claim the request, expose
  // the URL Vercel passed to this server so routing can be verified remotely.
  response.statusCode = 404;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ ok: false, path: request.url }));
});

export default httpServer;
