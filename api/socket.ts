// Vercel Function entrypoint. Vercel WebSocket Public Beta accepts a Node HTTP
// server export; Socket.IO is attached in server/src/index.ts.
export { httpServer as default } from '../server/src/index.js';
