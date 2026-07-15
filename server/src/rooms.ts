import { customAlphabet } from 'nanoid';
import { GameStateView, PublicPlayer, Seat } from '../../shared/types.js';
import { InternalGame, InternalPlayer, newGame } from './game.js';
import { redis } from './redis.js';

// Mã phòng 4 ký tự dễ đọc, dễ gõ trên điện thoại.
const genRoomId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);

export interface Room {
  id: string;
  game: InternalGame;
  createdAt: number;
}

const rooms = new Map<string, Room>();
const ROOM_TTL_SECONDS = 6 * 60 * 60;
const roomKey = (id: string) => `tusac:room:${id.toUpperCase()}`;
const socketKey = (id: string) => `tusac:socket:${id}`;

async function persistRoom(room: Room): Promise<void> {
  if (redis) {
    await redis.set(roomKey(room.id), JSON.stringify(room), { EX: ROOM_TTL_SECONDS });
    return;
  }
  rooms.set(room.id, room);
}

async function rememberSocket(socketId: string, roomId: string): Promise<void> {
  if (redis) {
    await redis.set(socketKey(socketId), roomId, { EX: ROOM_TTL_SECONDS });
  }
}

export async function createRoom(
  hostName: string,
  socketId: string,
  clientId: string
): Promise<{ room: Room; seat: Seat }> {
  let id = genRoomId();
  while (await getRoom(id)) id = genRoomId();
  const host: InternalPlayer = {
    seat: 0,
    name: hostName || 'Người chơi 1',
    clientId,
    socketId,
    connected: true,
    hand: [],
    exposedMelds: [],
    discardPile: [],
  };
  const game = newGame([host]);
  const room: Room = { id, game, createdAt: Date.now() };
  await persistRoom(room);
  await rememberSocket(socketId, id);
  return { room, seat: 0 };
}

export async function joinRoom(
  roomId: string,
  name: string,
  socketId: string,
  clientId: string
): Promise<{ ok: boolean; seat?: Seat; error?: string }> {
  const room = await getRoom(roomId);
  if (!room) return { ok: false, error: 'Không tìm thấy phòng' };
  const g = room.game;
  // Reconnect bằng định danh ổn định, không phụ thuộc socket.id vốn thay đổi
  // mỗi khi Vercel đóng WebSocket ở giới hạn maxDuration.
  const returning = g.players.find((player) => player.clientId === clientId);
  if (returning) {
    returning.socketId = socketId;
    returning.connected = true;
    if (name) returning.name = name;
    await persistRoom(room);
    await rememberSocket(socketId, room.id);
    return { ok: true, seat: returning.seat };
  }
  // Cho phép reconnect: nếu có ghế đang mất kết nối, chiếm lại.
  const disconnected = g.players.find((p) => !p.connected);
  if (g.players.length < 2) {
    const seat: Seat = 1;
    g.players.push({
      seat,
      name: name || 'Người chơi 2',
      clientId,
      socketId,
      connected: true,
      hand: [],
      exposedMelds: [],
      discardPile: [],
    });
    await persistRoom(room);
    await rememberSocket(socketId, room.id);
    return { ok: true, seat };
  }
  if (disconnected) {
    disconnected.socketId = socketId;
    disconnected.connected = true;
    disconnected.clientId = clientId;
    if (name) disconnected.name = name;
    await persistRoom(room);
    await rememberSocket(socketId, room.id);
    return { ok: true, seat: disconnected.seat };
  }
  return { ok: false, error: 'Phòng đã đủ người' };
}

export async function getRoom(roomId: string): Promise<Room | undefined> {
  const id = roomId.toUpperCase();
  if (!redis) return rooms.get(id);
  const value = await redis.get(roomKey(id));
  // node-redis can expose RESP3 replies as `string | {}` in the TypeScript
  // version used by Vercel. These keys are always written as strings here.
  return typeof value === 'string' ? (JSON.parse(value) as Room) : undefined;
}

export async function findRoomBySocket(socketId: string): Promise<Room | undefined> {
  if (redis) {
    const roomId = await redis.get(socketKey(socketId));
    return typeof roomId === 'string' ? getRoom(roomId) : undefined;
  }
  for (const room of rooms.values()) {
    if (room.game.players.some((p) => p.socketId === socketId)) return room;
  }
  return undefined;
}

export async function markDisconnected(socketId: string): Promise<Room | undefined> {
  const room = await findRoomBySocket(socketId);
  if (!room) return undefined;
  const p = room.game.players.find((pl) => pl.socketId === socketId);
  if (p) {
    p.connected = false;
    p.socketId = null;
  }
  await persistRoom(room);
  if (redis) await redis.del(socketKey(socketId));
  return room;
}

export async function saveRoom(room: Room): Promise<void> {
  await persistRoom(room);
}

// Dọn phòng cũ (rỗng hoặc quá 6 giờ) để không rò rỉ bộ nhớ.
export function cleanupRooms(): void {
  // Redis rooms expire automatically. This cleanup only applies to local RAM.
  if (redis) return;
  const now = Date.now();
  for (const [id, room] of rooms) {
    const allGone = room.game.players.every((p) => !p.connected);
    const tooOld = now - room.createdAt > 6 * 60 * 60 * 1000;
    if ((allGone && now - room.createdAt > 5 * 60 * 1000) || tooOld) {
      rooms.delete(id);
    }
  }
}

// Tạo view riêng cho từng ghế (ẩn bài đối thủ + nọc).
export function buildView(room: Room, forSeat: Seat | null): GameStateView {
  const g = room.game;
  const publicPlayers: PublicPlayer[] = g.players.map((p) => ({
    seat: p.seat,
    name: p.name,
    connected: p.connected,
    // Quàn đã lật vẫn thuộc tổng số bài được chia của người chơi.
    handCount: p.hand.length + p.exposedMelds.reduce((n, m) => n + m.cardIds.length, 0),
    // Khạp là thông tin kín: chỉ gửi số Khạp cho chính chủ, không rò sang đối thủ.
    khapCount: p.seat === forSeat ? countKhap(p.hand) : 0,
    exposedMelds: p.exposedMelds,
    discardPile: p.discardPile,
  }));
  const me = forSeat != null ? g.players.find((p) => p.seat === forSeat) : undefined;
  return {
    roomId: room.id,
    phase: g.phase,
    you: forSeat,
    players: publicPlayers,
    yourHand: me ? me.hand : [],
    wallCount: g.wall.length,
    turn: g.turn,
    pending: g.pending,
    turnStage: g.turnStage,
    lastAction: g.lastAction,
    winner: g.winner,
    scoreResult: g.scoreResult,
    message: g.message,
    mustDiscard: forSeat != null && g.mustDiscard === forSeat,
  };
}

function countKhap(hand: InternalPlayer['hand']): number {
  const counts = new Map<string, number>();
  for (const card of hand) {
    const key = `${card.rank}-${card.color}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].filter((n) => n === 3).length;
}
