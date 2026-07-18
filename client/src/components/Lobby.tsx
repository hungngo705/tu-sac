import { useState } from 'react';

interface Props {
  onCreate: (name: string) => Promise<void>;
  onJoin: (code: string, name: string) => Promise<void>;
}

export function Lobby({ onCreate, onJoin }: Props) {
  const roomFromUrl = new URLSearchParams(location.search).get('room')?.toUpperCase() || '';
  const [name, setName] = useState(localStorage.getItem('tusac_name') || '');
  const [code, setCode] = useState(roomFromUrl);
  const [mode, setMode] = useState<'home' | 'join'>(roomFromUrl ? 'join' : 'home');
  const [loading, setLoading] = useState<'create' | 'join' | null>(null);

  const trimmedName = name.trim() || 'Người chơi';

  async function create() {
    if (loading) return;
    setLoading('create');
    try {
      await onCreate(trimmedName);
    } finally {
      setLoading(null);
    }
  }

  async function join() {
    if (loading || code.length !== 2) return;
    setLoading('join');
    try {
      await onJoin(code, trimmedName);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="lobby">
      <h1>TỨ SẮC</h1>
      <p className="sub">Chơi bài tứ sắc online · 2 người</p>

      <input
        className="name"
        placeholder="Tên của bạn"
        value={name}
        maxLength={16}
        disabled={loading !== null}
        onChange={(e) => setName(e.target.value)}
      />

      {mode === 'home' ? (
        <>
          <button
            className={`btn ${loading === 'create' ? 'is-loading' : ''}`}
            disabled={loading !== null}
            aria-busy={loading === 'create'}
            onClick={create}
          >
            {loading === 'create' ? 'Đang tạo phòng...' : 'Tạo phòng mới'}
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
            maxLength={2}
            inputMode="numeric"
            pattern="[0-9]*"
            disabled={loading !== null}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 2))}
          />
          <button
            className={`btn ${loading === 'join' ? 'is-loading' : ''}`}
            disabled={code.length !== 2 || loading !== null}
            aria-busy={loading === 'join'}
            onClick={join}
          >
            {loading === 'join' ? 'Đang vào phòng...' : 'Vào phòng'}
          </button>
          <button className="btn btn--ghost" onClick={() => setMode('home')}>
            Quay lại
          </button>
        </>
      )}
    </div>
  );
}
