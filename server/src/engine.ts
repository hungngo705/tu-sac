import { Card, GameAction, Meld, ScoreResult, Seat } from '../../shared/types.js';
import {
  analyzeHand,
  countTrash,
  describeMeld,
  isEatableMeld,
  isWinMeld,
  violatesBaiBung,
  WIN_BONUS,
} from '../../shared/melds.js';
import { InternalGame, InternalPlayer, startRound } from './game.js';

export interface ActionResult {
  error?: string;
}

function other(seat: Seat): Seat {
  return (seat === 0 ? 1 : 0) as Seat;
}

export function applyAction(game: InternalGame, seat: Seat, action: GameAction): ActionResult {
  switch (action.type) {
    case 'START':
      if (seat !== 0) return { error: 'Chỉ chủ phòng bắt đầu được' };
      if (game.players.length < 2) return { error: 'Chưa đủ 2 người' };
      startRound(game);
      return {};

    case 'REMATCH':
      if (game.phase !== 'FINISHED') return { error: 'Ván chưa kết thúc' };
      startRound(game);
      return {};

    case 'DRAW':
      return doDraw(game, seat);

    case 'DISCARD':
      return doDiscard(game, seat, action.cardId);

    case 'EAT':
      return doEat(game, seat, action.cardIds);

    case 'PASS':
      return doPass(game, seat);

    case 'DECLARE_WIN':
      return doDeclareWin(game, seat, action.cardIds ?? []);

    default:
      return { error: 'Hành động không hợp lệ' };
  }
}

// ====== Bốc bài từ nọc: lật ngửa, chờ ăn ======
function doDraw(game: InternalGame, seat: Seat): ActionResult {
  if (game.phase !== 'PLAYING') return { error: 'Chưa vào ván' };
  if (game.turn !== seat) return { error: 'Chưa tới lượt bạn' };
  if (game.turnStage !== 'DRAW') return { error: 'Không phải lúc bốc bài' };
  if (game.pending) return { error: 'Có lá đang chờ xử lý' };
  if (game.wall.length <= 7) {
    game.phase = 'FINISHED';
    game.winner = null;
    game.message = 'Nọc chỉ còn 7 lá. Ván hòa theo luật Tứ Sắc.';
    game.lastAction = 'Nọc còn 7 lá — ván hòa.';
    return {};
  }
  const card = game.wall.shift()!;
  game.pending = { card, from: seat, source: 'DRAW' };
  const opponent = other(seat);
  const matchingOpponentCards = game.players[opponent].hand.filter((c) => sameFace(c, card));

  // Tướng vừa bốc có thứ tự riêng: người bốc xét Tới trước, kế đến đối thủ.
  // Nếu không ai Tới, Tướng trả về người bốc để nhận riêng hoặc ghép Sĩ-Tượng.
  if (card.rank === 'TUONG') {
    if (canWinWithPending(game, seat)) {
      game.turn = seat;
      game.turnStage = 'REACT_DRAW_WIN_SELF';
      game.lastAction = `${game.players[seat].name} bốc lật ${cardLabel(card)} — được ưu tiên xét Tới.`;
    } else if (canWinWithPending(game, opponent)) {
      game.turn = opponent;
      game.turnStage = 'REACT_DRAW_WIN_OTHER';
      game.lastAction = `${game.players[seat].name} bốc lật ${cardLabel(card)}. ${game.players[opponent].name} được xét Tới.`;
    } else {
      returnDrawnKingToDrawer(game);
    }
    return {};
  }

  const opponentHasMatchingPair = matchingOpponentCards.length === 2;
  const opponentMaySteal = opponentHasMatchingPair;
  game.turn = opponentMaySteal ? opponent : seat;
  game.turnStage = opponentMaySteal ? 'REACT_DRAW' : 'REACT_DRAW_SELF';
  if (opponentHasMatchingPair) {
    game.lastAction = `${game.players[seat].name} bốc lật ${cardLabel(card)}. ${game.players[opponent].name} có đôi — được quyền giật.`;
  } else {
    game.lastAction = `${game.players[seat].name} bốc lật ${cardLabel(card)}.`;
  }
  return {};
}

// ====== Đánh ra 1 lá ======
function doDiscard(game: InternalGame, seat: Seat, cardId: string): ActionResult {
  if (game.phase !== 'PLAYING') return { error: 'Chưa vào ván' };
  if (game.turn !== seat) return { error: 'Chưa tới lượt bạn' };
  if (game.turnStage !== 'DISCARD') return { error: 'Chưa thể đánh lúc này' };
  const p = game.players[seat];
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return { error: 'Không có lá này trên tay' };
  // Biến thể của bàn này cho phép phá đôi/bộ lẻ/Khạp để đánh tùy ý.
  // Ngoại lệ duy nhất: Tướng không bao giờ được đánh ra.
  if (p.hand[idx].rank === 'TUONG') {
    return { error: 'Không được đánh quân Tướng' };
  }
  const [card] = p.hand.splice(idx, 1);
  p.discardPile.push(card);
  game.mustDiscard = null;
  game.pending = { card, from: seat, source: 'DISCARD' };
  game.turn = other(seat);
  game.turnStage = 'REACT_DISCARD';
  game.lastAction = `${p.name} đánh ${cardLabel(card)}.`;
  return {};
}

// ====== Ăn lá đang chờ ======
function doEat(game: InternalGame, seat: Seat, cardIds: string[]): ActionResult {
  if (game.phase !== 'PLAYING') return { error: 'Chưa vào ván' };
  if (!game.pending) return { error: 'Không có lá để ăn' };
  if (game.turn !== seat) return { error: 'Chưa tới lượt bạn' };
  if (game.turnStage === 'REACT_DRAW_WIN_SELF' || game.turnStage === 'REACT_DRAW_WIN_OTHER') {
    return { error: 'Đang xét Tới; hãy chọn Tới hoặc Không tới' };
  }

  const pending = game.pending;
  const eaterIsDrawer = pending.source === 'DRAW' && pending.from === seat;

  const p = game.players[seat];
  const handCards = cardIds
    .map((id) => p.hand.find((c) => c.id === id))
    .filter(Boolean) as Card[];
  if (handCards.length !== cardIds.length) return { error: 'Chọn lá không hợp lệ' };

  const meldCards = [...handCards, pending.card];
  const loweringDrawnKing =
    eaterIsDrawer && pending.card.rank === 'TUONG' && handCards.length === 0;
  if (!loweringDrawnKing && !isEatableMeld(meldCards)) {
    return { error: 'Các lá này không tạo thành nhóm hợp lệ để ăn' };
  }

  const md = describeMeld(meldCards, true)!;
  if (
    eaterIsDrawer &&
    pending.card.rank === 'TUONG' &&
    handCards.length === 1 &&
    sameFace(handCards[0], pending.card)
  ) {
    return { error: 'Tướng vừa bốc không được ghép với một Tướng cùng màu thành đôi' };
  }
  const takingAnotherPlayersDraw = pending.source === 'DRAW' && !eaterIsDrawer;
  if (takingAnotherPlayersDraw && !isPriorityTake(pending.card, handCards, md)) {
    return { error: 'Ngoài lượt chỉ được giật lá bốc bằng đúng đôi cùng quân hoặc Khạp Tướng' };
  }
  const takingWithPair =
    pending.card.rank !== 'TUONG' &&
    handCards.length === 2 &&
    handCards.every((c) => sameFace(c, pending.card));
  const stealingWithPair = takingAnotherPlayersDraw && takingWithPair;

  const locked = handCards.filter((c) => isLockedKhapCard(p.hand, c));
  const opensThatKhap =
    locked.length === 3 &&
    handCards.length === 3 &&
    md.type === 'QUAN' &&
    sameFace(handCards[0], pending.card);
  if (locked.length > 0 && !opensThatKhap) {
    return { error: 'Khạp không được phá; chỉ được dùng cả Khạp để Khui' };
  }

  // Đúng đôi cùng quân đang chờ luôn được quyền ăn chẵn. Quyền ăn đôi ưu tiên
  // hơn kiểm tra bài bụng/giảm rác, dù lá đó do đối thủ đánh hay chính mình bốc.
  if (!takingWithPair && violatesBaiBung(p.hand, handCards)) {
    return { error: 'Phạm luật bài bụng: ăn chẵn này sẽ phá bộ lẻ trên tay' };
  }

  const remaining = p.hand.filter((c) => !handCards.some((h) => h.id === c.id));
  if (!takingWithPair && countTrash(remaining) > countTrash(p.hand)) {
    return { error: 'Không được ăn nếu làm tăng số lá rác trên tay' };
  }

  // Bỏ các lá đã dùng khỏi tay, đưa cả nhóm vào khu phơi.
  for (const c of handCards) {
    p.hand.splice(p.hand.findIndex((x) => x.id === c.id), 1);
  }
  p.exposedMelds.push(md);
  game.pending = null;
  // Ăn xong phải đánh ra 1 lá.
  game.turn = seat;
  game.turnStage = 'DISCARD';
  game.mustDiscard = stealingWithPair ? seat : null;
  game.lastAction = `${p.name} ăn ${cardLabel(pending.card)} tạo nhóm.`;
  return {};
}

// ====== Bỏ qua / không ăn ======
function doPass(game: InternalGame, seat: Seat): ActionResult {
  if (game.phase !== 'PLAYING') return { error: 'Chưa vào ván' };
  if (!game.pending) return { error: 'Không có gì để bỏ qua' };
  if (game.turn !== seat) return { error: 'Chưa tới lượt bạn' };
  const pending = game.pending;

  if (game.turnStage === 'REACT_DRAW_WIN_SELF') {
    const opponent = other(pending.from);
    if (canWinWithPending(game, opponent)) {
      game.turn = opponent;
      game.turnStage = 'REACT_DRAW_WIN_OTHER';
      game.lastAction = `${game.players[pending.from].name} không Tới. ${game.players[opponent].name} được xét Tới.`;
    } else {
      returnDrawnKingToDrawer(game);
    }
    return {};
  }

  if (game.turnStage === 'REACT_DRAW_WIN_OTHER') {
    returnDrawnKingToDrawer(game);
    return {};
  }

  if (pending.source === 'DISCARD') {
    // Đối thủ không ăn lá vừa đánh => tự bốc 1 lá.
    game.pending = null;
    game.turn = seat;
    game.turnStage = 'DRAW';
    game.lastAction = `${game.players[seat].name} không ăn.`;
    return {};
  }

  // source === 'DRAW'
  if (seat !== pending.from) {
    // Đối thủ bỏ qua lá bốc lật => tới lượt người bốc tự xử lý.
    game.turn = pending.from;
    game.turnStage = 'REACT_DRAW_SELF';
    game.lastAction = `${game.players[seat].name} không ăn lá bốc.`;
    return {};
  }

  if (pending.card.rank === 'TUONG') {
    return { error: 'Tướng vừa bốc không được bỏ; hãy ghép Sĩ–Tượng hoặc hạ Tướng rồi đánh rác' };
  }

  // Người bốc bỏ lá vừa bốc: lá này trở thành lá tỳ cho đối thủ. Đối thủ có
  // thể ăn bằng một nhóm hợp lệ; nếu không ăn thì mới bốc lá tiếp theo.
  game.players[pending.from].discardPile.push(pending.card);
  const next = other(pending.from);
  game.pending = { card: pending.card, from: pending.from, source: 'DISCARD' };
  game.turn = next;
  game.turnStage = 'REACT_DISCARD';
  game.lastAction = `${game.players[pending.from].name} bỏ lá bốc ${cardLabel(pending.card)}.`;
  return {};
}

// ====== Xin tới ======
function doDeclareWin(game: InternalGame, seat: Seat, cardIds: string[]): ActionResult {
  if (game.phase !== 'PLAYING') return { error: 'Chưa vào ván' };
  if (game.turn !== seat) return { error: 'Chỉ được xin tới trong lượt của bạn' };
  const p = game.players[seat];
  const pending = game.pending;

  // Trường hợp có lá đang chờ (ăn/bốc để tới): ghép nốt lá chờ thành 1 nhóm.
  if (pending && game.turnStage !== 'DISCARD') {
    const canClaim =
      (pending.source === 'DISCARD' && pending.from !== seat) ||
      (pending.source === 'DRAW');
    if (!canClaim) return { error: 'Không thể tới bằng lá này' };

    const handCards = cardIds
      .map((id) => p.hand.find((c) => c.id === id))
      .filter(Boolean) as Card[];
    if (handCards.length !== cardIds.length) return { error: 'Chọn lá không hợp lệ' };

    const finalMeld = [...handCards, pending.card];
    if (!isWinMeld(finalMeld)) {
      return { error: 'Lá chọn không ghép nốt được thành nhóm để tới' };
    }
    const md = describeMeld(finalMeld, true)!;
    // Tới được ưu tiên cao nhất, nên bất kỳ nhà nào cũng được giành lá tỳ nếu lá đó làm tròn bài.

    const locked = handCards.filter((c) => isLockedKhapCard(p.hand, c));
    const opensThatKhap =
      locked.length === 3 && handCards.length === 3 && md.type === 'QUAN' && sameFace(handCards[0], pending.card);
    if (locked.length > 0 && !opensThatKhap) {
      return { error: 'Không được phá Khạp để tới' };
    }

    // Phần còn lại trên tay phải chia hết thành nhóm hợp lệ.
    const rest = p.hand.filter((c) => !handCards.some((h) => h.id === c.id));
    const restAnalysis = analyzeHand(rest);
    if (!restAnalysis.valid) {
      return { error: 'Bài chưa tròn: phần còn lại vẫn có lá rác' };
    }

    // Chốt thắng: ghép finalMeld vào khu phơi.
    for (const c of handCards) {
      p.hand.splice(p.hand.findIndex((x) => x.id === c.id), 1);
    }
    p.exposedMelds.push(md);
    game.pending = null;
    return finishWin(game, seat);
  }

  // Trường hợp DISCARD (tới trên tay / sau khi ăn): toàn bộ bài phải tròn.
  const handAnalysis = analyzeHand(p.hand);
  if (!handAnalysis.valid) {
    return { error: 'Bài chưa tới được (còn lá rác chưa vào nhóm)' };
  }
  return finishWin(game, seat);
}

function finishWin(game: InternalGame, seat: Seat): ActionResult {
  game.phase = 'FINISHED';
  game.winner = seat;
  const result = buildScore(game, seat);
  game.scoreResult = result;
  game.message = result.summary;
  game.lastAction = `${game.players[seat].name} TỚI!`;
  return {};
}

// ====== Tính lệnh ======
// Điểm = (lệnh nhóm phơi theo giá trị lộ) + (lệnh nhóm trên tay theo giá trị ẩn).
// Tới không cộng lệnh. Quàn/Khui làm mức ăn tiền gấp đôi, không nhân đôi số lệnh.
function scorePlayer(p: InternalPlayer): { melds: Meld[]; base: number } {
  const exposed = p.exposedMelds;
  const handAnalysis = analyzeHand(p.hand); // giá trị ẩn cho bài trên tay
  const melds = [...exposed, ...handAnalysis.melds];
  const base = exposed.reduce((s, m) => s + m.points, 0) + handAnalysis.totalPoints;
  return { melds, base };
}

function buildScore(game: InternalGame, winner: Seat): ScoreResult {
  const perPlayer = game.players.map((p) => {
    const s = scorePlayer(p);
    const isWinner = p.seat === winner;
    const valid =
      p.hand.length === 0 ? true : analyzeHand(p.hand).valid; // phơi luôn hợp lệ
    const doubled =
      isWinner && s.melds.some((m) => m.type === 'QUAN' && (m.points === 6 || m.points === 8));
    const bonus = isWinner ? WIN_BONUS : 0;
    const totalPoints = s.base + bonus;
    return {
      seat: p.seat,
      melds: s.melds,
      base: s.base,
      bonus,
      doubled,
      totalPoints,
      valid,
    };
  });
  const w = perPlayer.find((x) => x.seat === winner)!;
  const doubleNote = w.doubled ? ' (có Quàn/Khui: mức thắng ×2)' : '';
  return {
    winner,
    perPlayer,
    summary: `${game.players[winner].name} tới với ${w.totalPoints} lệnh${doubleNote}.`,
  };
}

function sameFace(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.color === b.color;
}

function returnDrawnKingToDrawer(game: InternalGame): void {
  const pending = game.pending!;
  game.turn = pending.from;
  game.turnStage = 'REACT_DRAW_SELF';
  game.lastAction = `Không ai Tới. ${game.players[pending.from].name} xử lý ${cardLabel(pending.card)}.`;
}

// Kiểm tra có ít nhất một cách dùng lá đang chờ làm nhóm cuối cùng để Tới.
// Nhóm cuối tối đa 4 lá, nên chỉ cần duyệt 0..3 lá trên tay.
function canWinWithPending(game: InternalGame, seat: Seat): boolean {
  const pending = game.pending;
  if (!pending) return false;
  const hand = game.players[seat].hand;

  const visit = (start: number, chosen: Card[]): boolean => {
    const finalMeld = [...chosen, pending.card];
    if (isWinMeld(finalMeld)) {
      // Người bốc chỉ được nhận Tướng riêng hoặc ghép Sĩ-Tượng,
      // không ghép Tướng vừa bốc thành đôi Tướng cùng màu.
      const invalidDrawnKingPair =
        pending.card.rank === 'TUONG' &&
        pending.from === seat &&
        chosen.length === 1 &&
        sameFace(chosen[0], pending.card);
      if (!invalidDrawnKingPair) {
        const md = describeMeld(finalMeld, true)!;
        const locked = chosen.filter((c) => isLockedKhapCard(hand, c));
        const opensThatKhap =
          locked.length === 3 &&
          chosen.length === 3 &&
          md.type === 'QUAN' &&
          sameFace(chosen[0], pending.card);
        const rest = hand.filter((c) => !chosen.some((picked) => picked.id === c.id));
        if ((locked.length === 0 || opensThatKhap) && analyzeHand(rest).valid) return true;
      }
    }

    if (chosen.length === 3) return false;
    for (let i = start; i < hand.length; i++) {
      chosen.push(hand[i]);
      if (visit(i + 1, chosen)) return true;
      chosen.pop();
    }
    return false;
  };

  return visit(0, []);
}

function isLockedKhapCard(hand: Card[], card: Card): boolean {
  return hand.filter((c) => sameFace(c, card)).length === 3;
}

function isPriorityTake(active: Card, selected: Card[], meld: Meld): boolean {
  if (!selected.every((c) => sameFace(c, active))) return false;
  if (selected.length === 3) return meld.type === 'QUAN';
  if (selected.length === 2) {
    return active.rank !== 'TUONG' && meld.type === 'KHAN';
  }
  return false;
}

function cardLabel(c: Card): string {
  const rankVi: Record<string, string> = {
    TUONG: 'Tướng',
    SI: 'Sĩ',
    TUONG_ELE: 'Tượng',
    XE: 'Xe',
    PHAO: 'Pháo',
    MA: 'Mã',
    TOT: 'Tốt',
  };
  const colorVi: Record<string, string> = {
    RED: 'đỏ',
    YELLOW: 'vàng',
    GREEN: 'xanh',
    WHITE: 'trắng',
  };
  return `${rankVi[c.rank]} ${colorVi[c.color]}`;
}
