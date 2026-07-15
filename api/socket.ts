import { createServer } from 'node:http';
import { attachGameSocketServer } from '../server/src/socket-server';

// Vercel detects the WebSocket server from this entrypoint's direct
// createServer() + default export. Moving creation into another module makes
// it treat this file like a regular request handler instead.
const httpServer = createServer();
attachGameSocketServer(httpServer, '/socket.io');

export default httpServer;
