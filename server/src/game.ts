import { Card, Meld, PendingCard, ScoreResult, Seat, TurnStage } from '../../shared/types.js';
import { createDeck, deal, shuffle } from '../../shared/deck.js';
import { describeMeld } from '../../shared/melds.js';

// Trạng thái nội bộ của 1 ván (server giữ toàn bộ, không lộ cho client).
export interface InternalPlayer {
  seat: Seat;
  name: string;
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
  turn: Seat;
  turnStage: TurnStage;
  pending: PendingCard | null;
  lastAction: string | null;
  winner: Seat | null;
  message: string | null;
  scoreResult: ScoreResult | null;
  mustDiscard: Seat | null; // bắt buộc đánh 1 lá sau khi giật đôi
}

export function newGame(players: InternalPlayer[]): InternalGame {
  return {
    phase: 'WAITING',
    players,
    wall: [],
    turn: 0,
    turnStage: 'DISCARD',
    pending: null,
    lastAction: null,
    winner: null,
    message: null,
    scoreResult: null,
    mustDiscard: null,
  };
}

// Bắt đầu/khởi tạo lại ván: xáo bài, chia, người ghế 0 làm cái đi trước.
export function startRound(game: InternalGame): void {
  const deck = shuffle(createDeck());
  const d = deal(deck);
  game.players[0].hand = d.hands[0];
  game.players[1].hand = d.hands[1];
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
  game.turn = 0; // cái có 21 lá => vào thẳng bước đánh
  game.turnStage = 'DISCARD';
  game.pending = null;
  game.winner = null;
  game.message = null;
  game.scoreResult = null;
  game.mustDiscard = null;
  game.lastAction = 'Ván mới bắt đầu. Nhà cái đánh trước.';
  game.phase = 'PLAYING';
}
