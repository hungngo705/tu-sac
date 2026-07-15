import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { GameAction } from '../../shared/types.js';
import { applyAction } from './engine.js';
import { configureRedis } from './redis.js';
import {
  buildView,
  createRoom,
  getRoom,
  joinRoom,
  markDisconnected,
  type Room,
  saveRoom,
} from './rooms.js';

export function attachGameSocketServer(httpServer: HttpServer, path: string): Server {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    path,
  });

  registerGameSocketHandlers(io);
  return io;
}

const redisReadyByServer = new WeakMap<Server, Promise<unknown | null>>();

export function ensureGameSocketReady(io: Server): Promise<unknown | null> {
  let redisReady = redisReadyByServer.get(io);
  if (!redisReady) {
    redisReady = configureRedis(io).then(
      () => null,
      (error: unknown) => error
    );
    redisReadyByServer.set(io, redisReady);
  }
  return redisReady;
}

export function registerGameSocketHandlers(io: Server): void {
  io.use(async (_socket, next) => {
    const error = await ensureGameSocketReady(io);
    if (error) {
      console.error('Redis initialization failed:', error);
      next(new Error('Không kết nối được kho dữ liệu phòng'));
      return;
    }
    next();
  });

  io.on('connection', (socket) => registerGameSocket(io, socket));
}

export function registerGameSocket(io: Server, socket: Socket): void {
  function broadcast(room: Room) {
    for (const player of room.game.players) {
      if (player.socketId) {
        io.to(player.socketId).emit('state', buildView(room, player.seat));
      }
    }
  }

  socket.on('createRoom', async (name: string, clientId: string, cb) => {
    try {
      const { room, seat } = await createRoom(name, socket.id, clientId);
      await socket.join(room.id);
      cb({ roomId: room.id, seat });
      broadcast(room);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không tạo được phòng';
      cb({ error: message });
      socket.emit('error', message);
    }
  });

  socket.on('joinRoom', async (roomId: string, name: string, clientId: string, cb) => {
    const result = await joinRoom(roomId, name, socket.id, clientId);
    if (!result.ok) {
      cb(result);
      return;
    }
    const room = (await getRoom(roomId))!;
    await socket.join(room.id);
    cb(result);
    broadcast(room);
  });

  socket.on('action', async (roomId: string, action: GameAction) => {
    const room = await getRoom(roomId);
    if (!room) return;
    const actor = room.game.players.find((player) => player.socketId === socket.id);
    if (!actor) return;
    const result = applyAction(room.game, actor.seat, action);
    if (result.error) socket.emit('error', result.error);
    await saveRoom(room);
    broadcast(room);
  });

  socket.on('requestState', async (roomId: string) => {
    const room = await getRoom(roomId);
    if (!room) return;
    const player = room.game.players.find((candidate) => candidate.socketId === socket.id);
    socket.emit('state', buildView(room, player ? player.seat : null));
  });

  socket.on('disconnect', async () => {
    const room = await markDisconnected(socket.id);
    if (room) broadcast(room);
  });
}
