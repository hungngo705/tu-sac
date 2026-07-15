import { useEffect, useState } from 'react';
import { GameStateView } from '@shared/types';
import { sendAction } from '../net';
import { CardView } from './CardView';

interface Props {
  view: GameStateView;
  roomId: string;
  onToast: (msg: string) => void;
}

export function GameScreen({ view, roomId, onToast }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setSelected([]);
  }, [view.turn, view.turnStage, view.pending?.card.id]);

  const me = view.you;
  const opp = view.players.find((p) => p.seat !== me);
  const myTurn = view.turn === me;

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function act(a: Parameters<typeof sendAction>[1]) {
    sendAction(roomId, a);
    setSelected([]);
  }

  // ==== Phòng chờ đủ người ====
  if (view.phase === 'WAITING') {
    return (
      <div className="game">
        <TopBar view={view} onToast={onToast} />
        <div className="center">
          <p style={{ fontSize: 18 }}>Mã phòng</p>
          <p style={{ fontSize: 44, letterSpacing: 6, color: 'var(--gold)', margin: 0 }}>
            {view.roomId}
          </p>
          <p style={{ opacity: 0.8 }}>
            {view.players.length < 2
              ? 'Đang chờ người thứ hai vào...'
              : 'Đã đủ người. Sẵn sàng bắt đầu!'}
          </p>
          {me === 0 && view.players.length === 2 && (
            <button className="btn" style={{ maxWidth: 240 }} onClick={() => act({ type: 'START' })}>
              Bắt đầu ván
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="game">
      <TopBar view={view} onToast={onToast} />

      {/* Đối thủ */}
      <div className="opponent">
        <div className="player-bar">
          <span className={`dot ${opp?.connected ? '' : 'off'}`} />
          <span className="name">{opp?.name || 'Đối thủ'}</span>
          <span style={{ opacity: 0.7 }}>· {opp?.handCount ?? 0} lá</span>
          {view.turn !== me && view.phase === 'PLAYING' && <span className="turn-tag">Lượt</span>}
        </div>
        {opp && opp.exposedMelds.length > 0 && (
          <MeldRow melds={opp.exposedMelds} />
        )}
      </div>

      {/* Giữa bàn: nọc, lá vừa đánh, bài đã bỏ */}
      <div className="center">
        <div className="wall-info">
          <span>Nọc: {view.wallCount}</span>
          {view.lastAction && <span style={{ opacity: 0.7 }}>{view.lastAction}</span>}
        </div>

        {view.pending && (
          <div className="pending">
            <span className="label">
              {view.pending.source === 'DRAW' ? 'Lá vừa bốc lật' : 'Lá vừa đánh'} (chờ xử lý)
            </span>
            <CardView card={view.pending.card} disabled />
          </div>
        )}

        <DiscardPiles view={view} />
      </div>

      {/* Bài của tôi */}
      <div className="hand-area">
        <div className="player-bar">
          <span className={`dot`} />
          <span className="name">{view.players.find((p) => p.seat === me)?.name} (bạn)</span>
          <span style={{ opacity: 0.7 }}>
            · {view.players.find((p) => p.seat === me)?.handCount ?? 0} lá
          </span>
          {(view.players.find((p) => p.seat === me)?.khapCount ?? 0) > 0 && (
            <span className="turn-tag">{view.players.find((p) => p.seat === me)!.khapCount} Khạp</span>
          )}
          {myTurn && view.phase === 'PLAYING' && <span className="turn-tag">Lượt bạn</span>}
        </div>
        {(() => {
          const mine = view.players.find((p) => p.seat === me);
          return mine && mine.exposedMelds.length > 0 ? (
            <MeldRow melds={mine.exposedMelds} />
          ) : null;
        })()}
        <div className="hand">
          {sortHand(view.yourHand).map((c) => (
            <CardView
              key={c.id}
              card={c}
              selected={selected.includes(c.id)}
              onClick={() => toggle(c.id)}
            />
          ))}
        </div>

        <ActionBar
          view={view}
          selected={selected}
          myTurn={myTurn}
          onAct={act}
          onToast={onToast}
        />
      </div>

      {view.phase === 'FINISHED' && view.scoreResult && (
        <ResultOverlay view={view} onRematch={() => act({ type: 'REMATCH' })} />
      )}
    </div>
  );
}

function TopBar({ view, onToast }: { view: GameStateView; onToast: (m: string) => void }) {
  async function copyLink() {
    const url = `${location.origin}?room=${view.roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      onToast('Đã copy link mời');
    } catch {
      onToast(`Mã phòng: ${view.roomId}`);
    }
  }
  return (
    <div className="topbar">
      <span>
        Phòng <span className="room-code">{view.roomId}</span>
      </span>
      <button className="btn btn--ghost invite-btn" onClick={copyLink}>
        Phương đẹp gái
      </button>
    </div>
  );
}

function DiscardPiles({ view }: { view: GameStateView }) {
  return (
    <div className="discard-piles">
      {view.players.map((p) => (
        <div className="discard-pile" key={p.seat}>
          <div className="discard-label">Bài bỏ · {p.name}</div>
          <div className="discard-row">
            {p.discardPile.slice(-8).map((c) => (
              <CardView key={c.id} card={c} small disabled />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionBar({
  view,
  selected,
  myTurn,
  onAct,
  onToast,
}: {
  view: GameStateView;
  selected: string[];
  myTurn: boolean;
  onAct: (a: Parameters<typeof sendAction>[1]) => void;
  onToast: (m: string) => void;
}) {
  if (view.phase !== 'PLAYING' || !myTurn) return null;
  const stage = view.turnStage;
  const reacting = stage === 'REACT_DISCARD' || stage === 'REACT_DRAW' || stage === 'REACT_DRAW_SELF';
  const checkingWin = stage === 'REACT_DRAW_WIN_SELF' || stage === 'REACT_DRAW_WIN_OTHER';
  const isDrawSelf = stage === 'REACT_DRAW_SELF';
  const isDrawnKingSelf = isDrawSelf && view.pending?.card.rank === 'TUONG';

  return (
    <div className="actions">
      {checkingWin && (
        <>
          <button
            className="btn btn--danger"
            onClick={() => onAct({ type: 'DECLARE_WIN', cardIds: selected })}
          >
            Tới!
          </button>
          <button className="btn btn--ghost" onClick={() => onAct({ type: 'PASS' })}>
            Không tới
          </button>
        </>
      )}

      {/* Phản ứng với lá đang chờ: ăn / bỏ qua (hoặc bỏ = chết nếu tự bốc) */}
      {reacting && (
        <>
          {!isDrawnKingSelf && (
            <button className="btn btn--ghost" onClick={() => onAct({ type: 'PASS' })}>
              {isDrawSelf ? 'Bỏ lá bốc' : 'Bỏ qua'}
            </button>
          )}
          <button
            className="btn btn--eat"
            disabled={selected.length === 0}
            onClick={() => onAct({ type: 'EAT', cardIds: selected })}
          >
            Ăn ({selected.length})
          </button>
          {isDrawnKingSelf && (
            <button className="btn" onClick={() => onAct({ type: 'EAT', cardIds: [] })}>
              Nhận Tướng
            </button>
          )}
          <button
            className="btn btn--danger"
            onClick={() => onAct({ type: 'DECLARE_WIN', cardIds: selected })}
          >
            Tới!
          </button>
        </>
      )}

      {/* Lượt của mình: bốc từ nọc */}
      {stage === 'DRAW' && (
        <button className="btn" onClick={() => onAct({ type: 'DRAW' })}>
          Bốc bài
        </button>
      )}

      {/* Lượt của mình: đánh 1 lá + xin tới trên tay */}
      {stage === 'DISCARD' && (
        <>
          <button
            className="btn"
            disabled={selected.length !== 1}
            onClick={() => onAct({ type: 'DISCARD', cardId: selected[0] })}
          >
            Đánh lá này
          </button>
          <button className="btn btn--danger" onClick={() => onAct({ type: 'DECLARE_WIN' })}>
            Tới!
          </button>
        </>
      )}
    </div>
  );
}

// Hiển thị các nhóm đã phơi, mỗi nhóm 1 cụm, kèm số lệnh.
function MeldRow({ melds }: { melds: GameStateView['players'][number]['exposedMelds'] }) {
  return (
    <div className="meld-row">
      {melds.map((m, i) => (
        <div key={i} className={`meld ${m.even ? '' : 'meld--odd'}`}>
          {m.cardIds.map((id) => (
            <CardView key={id} card={cardFromId(id)} small disabled />
          ))}
          {m.points > 0 && <span className="meld-pts">{m.points}</span>}
        </div>
      ))}
    </div>
  );
}

// Nhóm phơi chỉ có cardIds; dựng lại Card từ id "RANK-COLOR-copy".
function cardFromId(id: string) {
  const [rank, color] = id.split('-');
  return { id, rank: rank as never, color: color as never };
}

function ResultOverlay({ view, onRematch }: { view: GameStateView; onRematch: () => void }) {
  const r = view.scoreResult!;
  const iWon = r.winner === view.you;
  return (
    <div className="overlay">
      <div className="result-card">
        <h2>{iWon ? 'Bạn thắng! 🎉' : 'Bạn thua'}</h2>
        <p>{r.summary}</p>
        {r.perPlayer.map((pp) => {
          const name = view.players.find((p) => p.seat === pp.seat)?.name;
          const detail = [
            `${pp.base} lệnh nhóm`,
            pp.doubled ? 'Quàn/Khui · mức thắng ×2' : null,
            pp.bonus ? `+${pp.bonus} tới` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <div className="score-line" key={pp.seat}>
              <span>
                {name}
                {pp.seat === r.winner ? ' 👑' : ''}
                <span style={{ opacity: 0.6, fontSize: 12, marginLeft: 6 }}>{detail}</span>
              </span>
              <span style={{ fontWeight: 700 }}>{pp.totalPoints} lệnh</span>
            </div>
          );
        })}
        <button className="btn" style={{ marginTop: 16 }} onClick={onRematch}>
          Chơi lại
        </button>
      </div>
    </div>
  );
}

// Sắp xếp theo từng màu để các bộ Tướng–Sĩ–Tượng và Xe–Pháo–Mã tiềm năng
// nằm cạnh nhau. Tốt/Chốt luôn được dồn xuống cuối bài.
function sortHand(hand: GameStateView['yourHand']) {
  const rankOrder = ['TUONG', 'SI', 'TUONG_ELE', 'XE', 'PHAO', 'MA', 'TOT'];
  const colorOrder = ['RED', 'YELLOW', 'GREEN', 'WHITE'];
  return [...hand].sort((a, b) => {
    const aIsTot = a.rank === 'TOT';
    const bIsTot = b.rank === 'TOT';
    if (aIsTot !== bIsTot) return aIsTot ? 1 : -1;

    // Trong phần bài thường: gom theo màu, rồi xếp Tướng-Sĩ-Tượng-Xe-Pháo-Mã.
    // Trong phần Tốt: cũng gom theo màu, các bản sao giống nhau tự nằm sát nhau.
    const color = colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color);
    if (color !== 0) return color;
    return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
  });
}
