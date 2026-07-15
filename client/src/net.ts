import { io, Socket } from 'socket.io-client';
import { GameAction, GameStateView, Seat } from '@shared/types';

// Cùng origin với server (đã phục vụ frontend). Dev thì Vite proxy lo.
export const socket: Socket = io('/', {
  autoConnect: true,
  // Vercel exposes the WebSocket server at the Function's exact route. Local
  // Node has no Function mount, so it keeps a distinct Engine.IO path.
  path: import.meta.env.DEV ? '/api/socket/socket.io' : '/api/socket',
  // A polling session can be routed to different Vercel Function instances.
  transports: ['websocket'],
  timeout: 12_000,
});

function waitForConnection(): Promise<void> {
  if (socket.connected) return Promise.resolve();
  socket.connect();
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      error ? reject(error) : resolve();
    };
    const onConnect = () => finish();
    const onError = () => finish(new Error('Không kết nối được máy chủ trò chơi'));
    const timer = window.setTimeout(() => finish(new Error('Máy chủ không phản hồi')), 12_000);
    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
  });
}

export async function createRoom(name: string): Promise<{ roomId: string; seat: Seat }> {
  await waitForConnection();
  return socket.timeout(10_000).emitWithAck('createRoom', name);
}

export async function joinRoom(
  roomId: string,
  name: string
): Promise<{ ok: boolean; seat?: Seat; error?: string }> {
  await waitForConnection();
  return socket.timeout(10_000).emitWithAck('joinRoom', roomId, name);
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
