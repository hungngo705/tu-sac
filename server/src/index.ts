import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameAction, Seat } from '../../shared/types.js';
import {
  buildView,
  cleanupRooms,
  createRoom,
  getRoom,
  joinRoom,
  markDisconnected,
  Room,
} from './rooms.js';
import { applyAction } from './engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

export const app = express();
export const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: { origin: '*' }, // tunnel/cross-network: cho phép mọi origin
  path: '/api/socket',
});

// Phục vụ frontend đã build (client build ra ../public).
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Gửi state mới nhất cho tất cả người trong phòng (mỗi người 1 view riêng).
function broadcast(room: Room) {
  for (const p of room.game.players) {
    if (p.socketId) {
      io.to(p.socketId).emit('state', buildView(room, p.seat));
    }
  }
}

io.on('connection', (socket) => {
  socket.on('createRoom', (name: string, cb) => {
    const { room, seat } = createRoom(name, socket.id);
    socket.join(room.id);
    cb({ roomId: room.id, seat });
    broadcast(room);
  });

  socket.on('joinRoom', (roomId: string, name: string, cb) => {
    const res = joinRoom(roomId, name, socket.id);
    if (res.ok) {
      const room = getRoom(roomId)!;
      socket.join(room.id);
      cb(res);
      broadcast(room);
    } else {
      cb(res);
    }
  });

  socket.on('action', (roomId: string, action: GameAction) => {
    const room = getRoom(roomId);
    if (!room) return;
    const actor = room.game.players.find((p) => p.socketId === socket.id);
    if (!actor) return;
    const result = applyAction(room.game, actor.seat, action);
    if (result.error) {
      socket.emit('error', result.error);
    }
    broadcast(room);
  });

  socket.on('requestState', (roomId: string) => {
    const room = getRoom(roomId);
    if (!room) return;
    const p = room.game.players.find((pl) => pl.socketId === socket.id);
    socket.emit('state', buildView(room, p ? p.seat : null));
  });

  socket.on('disconnect', () => {
    const room = markDisconnected(socket.id);
    if (room) broadcast(room);
  });
});

// SPA fallback: mọi route không phải api/socket => trả index.html.
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) res.status(200).send('Frontend chưa được build. Chạy: npm run build');
  });
});

setInterval(cleanupRooms, 5 * 60 * 1000);

// Chạy trực tiếp ở local/Render; khi được import bởi Vercel Function thì không
// tự mở cổng mà export httpServer cho runtime quản lý.
const isDirectRun =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  httpServer.listen(PORT, () => {
    console.log(`\n  Tứ Sắc server chạy tại http://localhost:${PORT}`);
    console.log(`  (build frontend rồi mở URL này, hoặc dev bằng: npm run dev)\n`);
  });
}

export default httpServer;
