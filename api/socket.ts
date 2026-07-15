import { createServer } from 'node:http';
import { attachGameSocketServer } from '../server/src/socket-server.js';

// Vercel detects the WebSocket server from this entrypoint's direct
// createServer() + default export. Moving creation into another module makes
// it treat this file like a regular request handler instead.
const httpServer = createServer((request, response) => {
  response.statusCode = 404;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ ok: false, path: request.url }));
});
attachGameSocketServer(httpServer, '/api/socket');

export default httpServer;
