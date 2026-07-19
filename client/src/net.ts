import { io, Socket } from 'socket.io-client';
import { GameAction, GameStateView, Seat } from '@shared/types';

const CLIENT_ID_KEY = 'tusac_client_id';
let clientId = localStorage.getItem(CLIENT_ID_KEY);
if (!clientId) {
  clientId = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, clientId);
}

// Cùng origin với server (đã phục vụ frontend). Dev thì Vite proxy lo.
export const socket: Socket = io('/', {
  autoConnect: true,
  // Vercel exposes the WebSocket server at the Function's exact route. Local
  // Node has no Function mount, so it keeps a distinct Engine.IO path.
  path: import.meta.env.DEV ? '/api/socket/socket.io' : '/api/socket',
  // A polling session can be routed to different Vercel Function instances.
  transports: ['websocket'],
  timeout: 12_000,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5_000,
  randomizationFactor: 0.3,
});

let refreshTimer: number | null = null;

// Làm mới WebSocket trước khi Vercel đóng Function hoặc khi watchdog nhận thấy
// listener không còn nhận state. Giữ nguyên Socket instance để toàn bộ handler
// `state`/`error` hiện tại tự tiếp tục hoạt động sau khi kết nối lại.
export function refreshSocketConnection(): void {
  if (refreshTimer != null) return;

  if (!socket.connected) {
    socket.connect();
    return;
  }

  socket.disconnect();
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    socket.connect();
  }, 350);
}

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
  const response = await socket.timeout(10_000).emitWithAck('createRoom', name, clientId) as {
    roomId?: string;
    seat?: Seat;
    error?: string;
  };
  if (response.error || response.roomId == null || response.seat == null) {
    throw new Error(response.error || 'Không tạo được phòng');
  }
  return { roomId: response.roomId, seat: response.seat };
}

export async function joinRoom(
  roomId: string,
  name: string
): Promise<{ ok: boolean; seat?: Seat; error?: string }> {
  await waitForConnection();
  return socket.timeout(10_000).emitWithAck('joinRoom', roomId, name, clientId);
}

export function sendAction(roomId: string, action: GameAction): void {
  socket.emit('action', roomId, action);
}

export function requestState(roomId: string): void {
  // State nền chỉ có giá trị mới nhất. Không xếp hàng hàng chục request cũ khi
  // mạng chập chờn rồi phát dồn sau lúc reconnect.
  if (socket.connected) socket.volatile.emit('requestState', roomId);
}

export function onState(cb: (view: GameStateView) => void): () => void {
  socket.on('state', cb);
  return () => socket.off('state', cb);
}

export function onServerError(cb: (message: string) => void): () => void {
  socket.on('error', cb);
  return () => socket.off('error', cb);
}

export function onConnect(cb: () => void): () => void {
  socket.on('connect', cb);
  return () => socket.off('connect', cb);
}
