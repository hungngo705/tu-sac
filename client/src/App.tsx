import { useEffect, useState } from 'react';
import { GameStateView } from '@shared/types';
import { createRoom, joinRoom, onServerError, onState, requestState } from './net';
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

  // Reconnect: nếu đã có phòng, xin lại state khi socket nối lại.
  useEffect(() => {
    if (roomId) requestState(roomId);
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

  const inGame = roomId && view;

  return (
    <div className="app">
      {inGame ? (
        <GameScreen view={view} roomId={roomId} onToast={showToast} />
      ) : (
        <Lobby onCreate={handleCreate} onJoin={handleJoin} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
