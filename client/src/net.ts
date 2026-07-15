import { io, Socket } from 'socket.io-client';
import { GameAction, GameStateView, Seat } from '@shared/types';

// Cùng origin với server (đã phục vụ frontend). Dev thì Vite proxy lo.
export const socket: Socket = io('/', { autoConnect: true, path: '/api/socket' });

export function createRoom(name: string): Promise<{ roomId: string; seat: Seat }> {
  return new Promise((resolve) => socket.emit('createRoom', name, resolve));
}

export function joinRoom(
  roomId: string,
  name: string
): Promise<{ ok: boolean; seat?: Seat; error?: string }> {
  return new Promise((resolve) => socket.emit('joinRoom', roomId, name, resolve));
}

export function sendAction(roomId: string, action: GameAction): void {
  socket.emit('action', roomId, action);
}

export function requestState(roomId: string): void {
  socket.emit('requestState', roomId);
}

export function onState(cb: (view: GameStateView) => void): () => void {
  socket.on('state', cb);
  return () => socket.off('state', cb);
}

export function onServerError(cb: (message: string) => void): () => void {
  socket.on('error', cb);
  return () => socket.off('error', cb);
}
