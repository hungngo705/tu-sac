import { createServer } from 'node:http';
import { attachGameSocketServer } from '../server/src/socket-server';

// Vercel detects the WebSocket server from this entrypoint's direct
// createServer() + default export. Moving creation into another module makes
// it treat this file like a regular request handler instead.
const httpServer = createServer();
// The Function itself is mounted at /api/socket. Using the Engine.IO root path
// avoids relying on Vercel forwarding a nested /socket.io route (which returns
// NOT_FOUND with a static outputDirectory project).
attachGameSocketServer(httpServer, '/');

export default httpServer;
