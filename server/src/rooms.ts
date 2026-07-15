import { customAlphabet } from 'nanoid';
import { GameStateView, PublicPlayer, Seat } from '../../shared/types.js';
import { InternalGame, InternalPlayer, newGame } from './game.js';

// Mã phòng 4 ký tự dễ đọc, dễ gõ trên điện thoại.
const genRoomId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);

export interface Room {
  id: string;
  game: InternalGame;
  createdAt: number;
}

const rooms = new Map<string, Room>();

export function createRoom(hostName: string, socketId: string): { room: Room; seat: Seat } {
  let id = genRoomId();
  while (rooms.has(id)) id = genRoomId();
  const host: InternalPlayer = {
    seat: 0,
    name: hostName || 'Người chơi 1',
    socketId,
    connected: true,
    hand: [],
    exposedMelds: [],
    discardPile: [],
  };
  const game = newGame([host]);
  const room: Room = { id, game, createdAt: Date.now() };
  rooms.set(id, room);
  return { room, seat: 0 };
}

export function joinRoom(
  roomId: string,
  name: string,
  socketId: string
): { ok: boolean; seat?: Seat; error?: string } {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return { ok: false, error: 'Không tìm thấy phòng' };
  const g = room.game;
  // Cho phép reconnect: nếu có ghế đang mất kết nối, chiếm lại.
  const disconnected = g.players.find((p) => !p.connected);
  if (g.players.length < 2) {
    const seat: Seat = 1;
    g.players.push({
      seat,
      name: name || 'Người chơi 2',
      socketId,
      connected: true,
      hand: [],
      exposedMelds: [],
      discardPile: [],
    });
    return { ok: true, seat };
  }
  if (disconnected) {
    disconnected.socketId = socketId;
    disconnected.connected = true;
    if (name) disconnected.name = name;
    return { ok: true, seat: disconnected.seat };
  }
  return { ok: false, error: 'Phòng đã đủ người' };
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId.toUpperCase());
}

export function findRoomBySocket(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.game.players.some((p) => p.socketId === socketId)) return room;
  }
  return undefined;
}

export function markDisconnected(socketId: string): Room | undefined {
  const room = findRoomBySocket(socketId);
  if (!room) return undefined;
  const p = room.game.players.find((pl) => pl.socketId === socketId);
  if (p) {
    p.connected = false;
    p.socketId = null;
  }
  return room;
}

// Dọn phòng cũ (rỗng hoặc quá 6 giờ) để không rò rỉ bộ nhớ.
export function cleanupRooms(): void {
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
