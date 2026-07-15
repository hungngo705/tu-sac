import { createServer } from 'node:http';
import { Server } from 'socket.io';

// Vercel detects the WebSocket server from this entrypoint's direct
// createServer() + default export. Moving creation into another module makes
// it treat this file like a regular request handler instead.
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: '*' },
  path: '/api/socket',
});
io.use(async (_socket, next) => {
  try {
    const { ensureGameSocketReady } = await import('../server/src/socket-server.js');
    const error = await ensureGameSocketReady(io);
    if (error) {
      console.error('Game socket initialization failed:', error);
      next(new Error('Không kết nối được kho dữ liệu phòng'));
      return;
    }
    next();
  } catch (error) {
    console.error('Game socket module failed to load:', error);
    next(new Error('Không khởi tạo được máy chủ trò chơi'));
  }
});

io.on('connection', (socket) => {
  import('../server/src/socket-server.js')
    .then(({ registerGameSocket }) => registerGameSocket(io, socket))
    .catch((error) => {
      console.error('Game socket handlers failed to load:', error);
      socket.disconnect(true);
    });
});

export default httpServer;
