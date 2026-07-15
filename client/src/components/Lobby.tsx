import { useState } from 'react';

interface Props {
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
}

export function Lobby({ onCreate, onJoin }: Props) {
  const roomFromUrl = new URLSearchParams(location.search).get('room')?.toUpperCase() || '';
  const [name, setName] = useState(localStorage.getItem('tusac_name') || '');
  const [code, setCode] = useState(roomFromUrl);
  const [mode, setMode] = useState<'home' | 'join'>(roomFromUrl ? 'join' : 'home');

  const trimmedName = name.trim() || 'Người chơi';

  return (
    <div className="lobby">
      <h1>TỨ SẮC</h1>
      <p className="sub">Chơi bài tứ sắc online · 2 người</p>

      <input
        className="name"
        placeholder="Tên của bạn"
        value={name}
        maxLength={16}
        onChange={(e) => setName(e.target.value)}
      />

      {mode === 'home' ? (
        <>
          <button className="btn" onClick={() => onCreate(trimmedName)}>
            Tạo phòng mới
          </button>
          <div className="divider">hoặc</div>
          <button className="btn btn--ghost" onClick={() => setMode('join')}>
            Vào phòng có mã
          </button>
        </>
      ) : (
        <>
          <input
            placeholder="Nhập mã phòng"
            value={code}
            maxLength={4}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            className="btn"
            disabled={code.length < 4}
            onClick={() => onJoin(code, trimmedName)}
          >
            Vào phòng
          </button>
          <button className="btn btn--ghost" onClick={() => setMode('home')}>
            Quay lại
          </button>
        </>
      )}
    </div>
  );
}
