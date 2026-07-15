import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { registerGameSocketHandlers } from '../server/src/socket-server.js';

// Vercel detects the WebSocket server from this entrypoint's direct
// createServer() + default export. Moving creation into another module makes
// it treat this file like a regular request handler instead.
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: '*' },
  path: '/api/socket',
});
registerGameSocketHandlers(io);

export default httpServer;
