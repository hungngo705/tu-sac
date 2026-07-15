import { Card, Color, COLORS, Rank, RANKS } from './types.js';

// Tạo bộ bài Tứ Sắc chuẩn: 7 quân * 4 màu * 4 lá = 112 lá.
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const color of COLORS) {
      for (let copy = 0; copy < 4; copy++) {
        deck.push({ id: `${rank}-${color}-${copy}`, rank, color });
      }
    }
  }
  return deck;
}

// Fisher-Yates shuffle. Nhận rng để có thể test tất định nếu cần.
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Chia bài cho 2 người chơi.
// Luật gốc 4 người: mỗi người 20 lá, nhà cái 21 lá. Với 2 người ta giữ
// nguyên tinh thần: mỗi người 20 lá, người đi trước (cái) thêm 1 lá = 21,
// phần còn lại làm nọc.
export interface Deal {
  hands: [Card[], Card[]];
  wall: Card[];
}

export function deal(deck: Card[], dealerExtra = true): Deal {
  const hands: [Card[], Card[]] = [[], []];
  let idx = 0;
  const perPlayer = 20;
  for (let i = 0; i < perPlayer; i++) {
    hands[0].push(deck[idx++]);
    hands[1].push(deck[idx++]);
  }
  // Nhà cái (ghế 0) được thêm 1 lá và đi trước.
  if (dealerExtra) hands[0].push(deck[idx++]);
  const wall = deck.slice(idx);
  return { hands, wall };
}
