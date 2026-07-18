import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GameStateView } from '@shared/types';
import { sendAction } from '../net';
import { CardView } from './CardView';

interface Props {
  view: GameStateView;
  roomId: string;
  onToast: (msg: string) => void;
  onHome: () => void;
}

export function GameScreen({ view, roomId, onToast, onHome }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const tableAreaRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected([]);
  }, [view.turn, view.turnStage, view.pending?.card.id]);

  const me = view.you;
  const opp = view.players.find((p) => p.seat !== me);
  const myTurn = view.turn === me;
  const latestCard = view.pending ?? view.lastRevealed;
  const scrollEventKey = [
    view.phase,
    view.turn,
    view.turnStage,
    view.pending?.card.id ?? '',
    view.lastAction ?? '',
    view.yourHand.length,
    ...view.players.map(
      (player) =>
        `${player.handCount}:${player.exposedMelds.length}:${player.discardPile.length}`
    ),
  ].join('|');

  useLayoutEffect(() => {
    const scrollToBottom = () => {
      if (tableAreaRef.current) {
        tableAreaRef.current.scrollTop = tableAreaRef.current.scrollHeight;
      }
      if (handRef.current) {
        handRef.current.scrollTop = handRef.current.scrollHeight;
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
    };

    scrollToBottom();
    const frame = window.requestAnimationFrame(scrollToBottom);
    return () => window.cancelAnimationFrame(frame);
  }, [scrollEventKey]);

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
        <TopBar view={view} onToast={onToast} onHome={onHome} />
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
      <TopBar view={view} onToast={onToast} onHome={onHome} />

      <div className="table-area" ref={tableAreaRef}>
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

          <div className={`pending ${latestCard ? '' : 'pending--empty'}`}>
            <span className="label">
              {latestCard
                ? latestCard.source === 'DRAW'
                  ? 'Lá vừa bốc lật'
                  : 'Lá vừa đánh'
                : 'Lá vừa đánh / bốc lật'}
              {view.pending && ' (chờ xử lý)'}
            </span>
            {latestCard ? (
              <CardView card={latestCard.card} disabled />
            ) : (
              <span className="pending-placeholder">Chưa có lá</span>
            )}
          </div>

          <DiscardPiles view={view} />
        </div>
      </div>

      {/* Bài của tôi */}
      <div className={`hand-area ${myTurn ? 'hand-area--active' : ''}`}>
        <div className="player-bar">
          <span className={`dot`} />
          <span className="name">{view.players.find((p) => p.seat === me)?.name} (bạn)</span>
          <span style={{ opacity: 0.7 }}>
            · {view.players.find((p) => p.seat === me)?.handCount ?? 0} lá
          </span>
          {(view.players.find((p) => p.seat === me)?.khapCount ?? 0) > 0 && (
            <span className="turn-tag">{view.players.find((p) => p.seat === me)!.khapCount} Khạp</span>
          )}
          {myTurn && view.phase === 'PLAYING' && <span className="turn-tag turn-tag--mine">Lượt bạn</span>}
        </div>
        {(() => {
          const mine = view.players.find((p) => p.seat === me);
          return mine && mine.exposedMelds.length > 0 ? (
            <MeldRow melds={mine.exposedMelds} />
          ) : null;
        })()}
        <div className="hand" ref={handRef}>
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

function TopBar({
  view,
  onToast,
  onHome,
}: {
  view: GameStateView;
  onToast: (m: string) => void;
  onHome: () => void;
}) {
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
      <div className="topbar-left">
        <button className="home-btn" onClick={onHome} aria-label="Về trang chủ">
          ← <span>Trang chủ</span>
        </button>
        <span className="room-label">
          Phòng <span className="room-code">{view.roomId}</span>
        </span>
      </div>
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
  if (view.phase !== 'PLAYING') return null;
  const stage = view.turnStage;
  const reacting = stage === 'REACT_DISCARD' || stage === 'REACT_DRAW' || stage === 'REACT_DRAW_SELF';
  const checkingWin = stage === 'REACT_DRAW_WIN_SELF' || stage === 'REACT_DRAW_WIN_OTHER';
  const readyToWin = stage === 'READY_TO_WIN';
  const isDrawSelf = stage === 'REACT_DRAW_SELF';
  const isDrawnKingSelf = isDrawSelf && view.pending?.card.rank === 'TUONG';
  const acceptedDrawnKing = stage === 'ACCEPTED_DRAWN_KING';

  let primaryLabel = 'Bỏ qua';
  let primaryAction: Parameters<typeof sendAction>[1] | null = null;
  let primaryEnabled = false;

  if (myTurn && stage === 'DRAW') {
    primaryLabel = 'Bốc bài';
    primaryAction = { type: 'DRAW' };
    primaryEnabled = true;
  } else if (myTurn && reacting) {
    primaryLabel = isDrawnKingSelf ? 'Nhận Tướng' : isDrawSelf ? 'Bỏ lá bốc' : 'Bỏ qua';
    primaryAction = isDrawnKingSelf ? { type: 'EAT', cardIds: [] } : { type: 'PASS' };
    primaryEnabled = true;
  } else if (myTurn && checkingWin) {
    primaryAction = { type: 'PASS' };
    primaryEnabled = true;
  }

  const middleIsDiscard =
    stage === 'DISCARD' || (acceptedDrawnKing && selected.length <= 1);
  const middleLabel = middleIsDiscard ? 'Đánh' : selected.length > 0 ? `Ăn (${selected.length})` : 'Ăn';
  const canEatWinningKingAlone =
    checkingWin && selected.length === 0 && view.pending?.card.rank === 'TUONG';
  const middleEnabled = middleIsDiscard
    ? myTurn && selected.length === 1
    : myTurn &&
      (reacting || checkingWin || acceptedDrawnKing) &&
      (selected.length > 0 || canEatWinningKingAlone);
  const middleAction: Parameters<typeof sendAction>[1] | null = middleIsDiscard
    ? selected.length === 1
      ? { type: 'DISCARD', cardId: selected[0] }
      : null
    : { type: 'EAT', cardIds: selected };
  const winEnabled = myTurn && (readyToWin || (stage === 'DISCARD' && !view.pending));

  return (
    <div className="actions">
      <button
        className="btn btn--ghost"
        disabled={!primaryEnabled}
        onClick={() => primaryAction && onAct(primaryAction)}
      >
        {primaryLabel}
      </button>
      <button
        className="btn btn--eat"
        disabled={!middleEnabled}
        onClick={() => middleAction && onAct(middleAction)}
      >
        {middleLabel}
      </button>
      <button
        className="btn btn--danger"
        disabled={!winEnabled}
        onClick={() => onAct({ type: 'DECLARE_WIN', cardIds: selected })}
      >
        Tới!
      </button>
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
