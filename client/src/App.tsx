import { useEffect, useState } from 'react';
import { GameStateView } from '@shared/types';
import { createRoom, joinRoom, onConnect, onServerError, onState, requestState } from './net';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';

export default function App() {
  const [view, setView] = useState<GameStateView | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const off = onState((v) => setView(v));
    return off;
  }, []);

  // Hiển thị lý do khi server từ chối một nước đi thay vì để nút có vẻ bị hỏng.
  useEffect(() => onServerError(showToast), []);

  // Vercel đóng WebSocket khi Function hết maxDuration. Socket mới phải nhận
  // lại đúng ghế trước khi xin state; chỉ requestState thì server không nhận ra.
  useEffect(() => {
    if (!roomId) return;
    requestState(roomId);
    // Redis pub/sub giữa hai Vercel Function instance có thể bị gián đoạn khi
    // một instance reconnect/scale. Poll nhẹ làm đường dự phòng; state vẫn do
    // server-authoritative Redis cung cấp, không tính toán ở client.
    const syncTimer = window.setInterval(() => requestState(roomId), 1_000);
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') requestState(roomId);
    };
    document.addEventListener('visibilitychange', syncWhenVisible);
    let cancelled = false;
    const restoreSeat = async () => {
      const name = localStorage.getItem('tusac_name') || 'Người chơi';
      for (const delay of [0, 500, 1500]) {
        if (cancelled) return;
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        try {
          const result = await joinRoom(roomId, name);
          if (result.ok) {
            requestState(roomId);
            return;
          }
        } catch {
          // Socket/Redis có thể cần một nhịp để hoàn tất disconnect cũ.
        }
      }
      if (!cancelled) showToast('Mất kết nối phòng, hãy tải lại trang');
    };
    const off = onConnect(restoreSeat);
    return () => {
      cancelled = true;
      window.clearInterval(syncTimer);
      document.removeEventListener('visibilitychange', syncWhenVisible);
      off();
    };
  }, [roomId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  async function handleCreate(name: string) {
    try {
      const res = await createRoom(name);
      setRoomId(res.roomId);
      localStorage.setItem('tusac_name', name);
    } catch {
      showToast('Không kết nối được máy chủ trò chơi');
    }
  }

  async function handleJoin(code: string, name: string) {
    try {
      const res = await joinRoom(code, name);
      if (!res.ok) {
        showToast(res.error || 'Không vào được phòng');
        return;
      }
      setRoomId(code.toUpperCase());
      localStorage.setItem('tusac_name', name);
    } catch {
      showToast('Không kết nối được máy chủ trò chơi');
    }
  }

  function handleHome() {
    setRoomId(null);
    setView(null);
  }

  const inGame = roomId && view;

  return (
    <div className="app">
      {inGame ? (
        <GameScreen view={view} roomId={roomId} onToast={showToast} onHome={handleHome} />
      ) : (
        <Lobby onCreate={handleCreate} onJoin={handleJoin} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
