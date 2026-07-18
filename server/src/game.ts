import { Card, Meld, PendingCard, ScoreResult, Seat, TurnStage } from '../../shared/types.js';
import { createDeck, deal, shuffle } from '../../shared/deck.js';
import { describeMeld } from '../../shared/melds.js';

// Trạng thái nội bộ của 1 ván (server giữ toàn bộ, không lộ cho client).
export interface InternalPlayer {
  seat: Seat;
  name: string;
  clientId?: string;
  socketId: string | null;
  connected: boolean;
  hand: Card[];
  exposedMelds: Meld[]; // các nhóm đã phơi/khui công khai (giữ nguyên nhóm)
  discardPile: Card[]; // bài đã đánh ra + lá bốc bị chết
}

export interface InternalGame {
  phase: 'WAITING' | 'PLAYING' | 'FINISHED';
  players: InternalPlayer[];
  wall: Card[];
  dealer: Seat; // nhà cái hiện tại; người thắng sẽ làm cái ở ván kế tiếp
  turn: Seat;
  turnStage: TurnStage;
  pending: PendingCard | null;
  lastRevealed?: PendingCard | null;
  lastAction: string | null;
  winner: Seat | null;
  message: string | null;
  scoreResult: ScoreResult | null;
  mustDiscard: Seat | null; // sau khi giật đôi: phải đánh nếu bài chưa đủ điều kiện Tới
}

export function newGame(players: InternalPlayer[]): InternalGame {
  return {
    phase: 'WAITING',
    players,
    wall: [],
    dealer: 0,
    turn: 0,
    turnStage: 'DISCARD',
    pending: null,
    lastRevealed: null,
    lastAction: null,
    winner: null,
    message: null,
    scoreResult: null,
    mustDiscard: null,
  };
}

// Bắt đầu/khởi tạo lại ván: ván đầu ghế 0 làm cái; các ván sau người thắng làm cái.
export function startRound(game: InternalGame): void {
  // `?? 0` giúp các phòng cũ được lưu trước khi có trường dealer vẫn nâng cấp an toàn.
  const dealer = game.winner ?? game.dealer ?? 0;
  const otherSeat = (dealer === 0 ? 1 : 0) as Seat;
  game.dealer = dealer;
  const deck = shuffle(createDeck());
  const d = deal(deck);
  game.players[dealer].hand = d.hands[0];
  game.players[otherSeat].hand = d.hands[1];
  game.players.forEach((p) => {
    p.exposedMelds = [];
    p.discardPile = [];
    // Quàn (4 lá giống hệt có ngay lúc chia) phải được lật công khai từ đầu ván.
    const groups = new Map<string, Card[]>();
    for (const card of p.hand) {
      const key = `${card.rank}-${card.color}`;
      groups.set(key, [...(groups.get(key) ?? []), card]);
    }
    for (const cards of groups.values()) {
      if (cards.length !== 4) continue;
      const quàn = describeMeld(cards, false)!;
      quàn.points = 8;
      p.exposedMelds.push(quàn);
      const ids = new Set(cards.map((c) => c.id));
      p.hand = p.hand.filter((c) => !ids.has(c.id));
    }
  });
  game.wall = d.wall;
  game.turn = dealer; // cái có 21 lá => vào thẳng bước đánh
  game.turnStage = 'DISCARD';
  game.pending = null;
  game.lastRevealed = null;
  game.winner = null;
  game.message = null;
  game.scoreResult = null;
  game.mustDiscard = null;
  game.lastAction = `Ván mới bắt đầu. ${game.players[dealer].name} làm cái và đánh trước.`;
  game.phase = 'PLAYING';
}
