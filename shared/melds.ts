// ====== Luật nhóm (meld) bài Tứ Sắc + phân rã bài + tính lệnh ======
// Bảng lệnh theo luật người dùng cung cấp (đối chiếu nhiều nguồn VN):
//
//   Đôi (2 lá giống)                         0 lệnh
//   Bộ lẻ Xe-Pháo-Mã / Tướng-Sĩ-Tượng        1 lệnh
//   Tướng (1 lá hoặc đôi Tướng)              1 lệnh
//   3 lá giống - ăn/lộ (khui-3)              1 lệnh
//   3 lá giống - sẵn trên tay/úp (khạp)      3 lệnh
//   4 lá giống - ăn (khui-4)                 6 lệnh
//   4 lá giống - sẵn trên tay (quằn/quản)    8 lệnh
//   3 Tốt khác màu                           1 lệnh
//   4 Tốt/Chốt khác màu                      4 lệnh
//   Tới                                       không cộng lệnh
//   Người tới có Quàn hoặc Khui              nhân đôi tiền/lệnh thắng
//
// Điều kiện tới: toàn bộ bài (trên tay + đã phơi) chia hết thành nhóm hợp lệ,
// không còn lá rác. (Không dùng ràng buộc chẵn/lẻ tổng lệnh.)

import { Card, Color, COLORS, Meld, MeldType, Rank } from './types.js';

export const WIN_BONUS = 0; // Tới không cộng thêm lệnh

// Điểm 1 nhóm theo kiểu + số lá + đã phơi (lộ) hay còn úp (ẩn).
export function meldPoints(type: MeldType, size: number, exposed: boolean): number {
  switch (type) {
    case 'DOI':
      return 0; // đôi thường
    case 'XPM':
    case 'CMD':
      return 1; // các nhóm hợp lệ khác đều 1 lệnh
    case 'TUONG_SET':
      return 1; // Tướng đứng riêng hoặc đôi Tướng
    case 'TOT3':
      return 1; // 3 Tốt khác màu
    case 'TOT4':
      return 4; // 4 Tốt/Chốt khác màu
    case 'KHAN': // 3 lá giống hệt
      return exposed ? 1 : 3; // bộ ba do ăn 1, Khạp có sẵn trên tay 3
    case 'QUAN': // 4 lá giống hệt
      return exposed ? 6 : 8; // khui 6, quản 8
    default:
      return 0;
  }
}

// Nhóm là "chẵn" hay "lẻ" (lẻ = XPM/CMD), dùng cho mô tả và luật ăn.
export function isEvenMeld(type: MeldType): boolean {
  return type !== 'XPM' && type !== 'CMD';
}

type Matrix = number[][]; // [rankIndex][colorIndex] = số lá
type LockedKhapMatrix = boolean[][];

const RANK_IDX: Record<Rank, number> = {
  TUONG: 0,
  SI: 1,
  TUONG_ELE: 2,
  XE: 3,
  PHAO: 4,
  MA: 5,
  TOT: 6,
};
const RANK_LIST: Rank[] = ['TUONG', 'SI', 'TUONG_ELE', 'XE', 'PHAO', 'MA', 'TOT'];

function toMatrix(cards: Card[]): Matrix {
  const m: Matrix = RANK_LIST.map(() => [0, 0, 0, 0]);
  for (const c of cards) m[RANK_IDX[c.rank]][COLORS.indexOf(c.color)]++;
  return m;
}

function lockedKhapMatrix(m: Matrix): LockedKhapMatrix {
  return m.map((row) => row.map((count) => count === 3));
}

// Một nhóm trong lời giải phân rã: kiểu + các ô (rank,color) nó dùng.
interface GroupDesc {
  type: MeldType;
  cells: { r: number; c: number }[];
}

function firstNonEmpty(m: Matrix): { r: number; c: number } | null {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 4; c++) {
      if (m[r][c] > 0) return { r, c };
    }
  }
  return null;
}

// Sinh mọi nhóm hợp lệ CHỨA ô (r,c) làm phần tử "sớm nhất" (để không trùng lặp).
function candidateGroups(
  m: Matrix,
  r: number,
  c: number,
  lockedKhap: LockedKhapMatrix
): GroupDesc[] {
  const out: GroupDesc[] = [];
  const rank = RANK_LIST[r];
  const cnt = m[r][c];

  // Nhóm giống hệt (đôi/Khạp/Quàn) tại đúng ô (r,c).
  if (cnt >= 4) out.push({ type: 'QUAN', cells: cell(r, c, 4) });
  if (cnt >= 3) out.push({ type: 'KHAN', cells: cell(r, c, 3) });
  if (cnt >= 2) out.push({ type: 'DOI', cells: cell(r, c, 2) });

  // Tướng lẻ đứng một mình (chẵn, 1 lệnh).
  if (rank === 'TUONG') {
    out.push({ type: 'TUONG_SET', cells: [{ r, c }] });
  }

  // Command Tướng-Sĩ-Tượng cùng màu (lẻ). Ô sớm nhất là Tướng (r=0).
  if (rank === 'TUONG' && m[1][c] > 0 && m[2][c] > 0) {
    out.push({ type: 'CMD', cells: [{ r: 0, c }, { r: 1, c }, { r: 2, c }] });
  }

  // Field Xe-Pháo-Mã cùng màu (lẻ). Ô sớm nhất là Xe (r=3).
  if (rank === 'XE' && m[4][c] > 0 && m[5][c] > 0) {
    out.push({ type: 'XPM', cells: [{ r: 3, c }, { r: 4, c }, { r: 5, c }] });
  }

  // Tốt: 3 khác màu / 4 đủ màu. Ô sớm nhất là màu c của hàng Tốt (r=6).
  if (rank === 'TOT') {
    const otherColors: number[] = [];
    for (let cc = c + 1; cc < 4; cc++) if (m[6][cc] > 0) otherColors.push(cc);
    if (c === 0 && otherColors.length >= 3) {
      out.push({ type: 'TOT4', cells: [0, 1, 2, 3].map((cc) => ({ r: 6, c: cc })) });
    }
    for (let i = 0; i < otherColors.length; i++) {
      for (let j = i + 1; j < otherColors.length; j++) {
        out.push({
          type: 'TOT3',
          cells: [{ r: 6, c }, { r: 6, c: otherColors[i] }, { r: 6, c: otherColors[j] }],
        });
      }
    }
  }

  return out.filter((group) => {
    const touchesLockedKhap = group.cells.some((x) => lockedKhap[x.r][x.c]);
    if (!touchesLockedKhap) return true;

    // Khạp có sẵn trên tay là một khối khóa: không lấy dù chỉ một lá của Khạp
    // để ghép bộ lẻ, đôi, Tướng đơn hoặc nhóm Chốt khác màu.
    return (
      group.type === 'KHAN' &&
      group.cells.length === 3 &&
      group.cells.every((x) => x.r === r && x.c === c && lockedKhap[x.r][x.c])
    );
  });
}

function cell(r: number, c: number, n: number) {
  return Array.from({ length: n }, () => ({ r, c }));
}

// Tìm cách phân rã cho ĐIỂM CAO NHẤT (hidden values) và tính hợp lệ.
// Trả về { groups, points } tốt nhất, hoặc null nếu không chia hết.
function bestDecompose(
  m: Matrix,
  lockedKhap: LockedKhapMatrix
): { groups: GroupDesc[]; points: number } | null {
  const pivot = firstNonEmpty(m);
  if (!pivot) return { groups: [], points: 0 };
  const cands = candidateGroups(m, pivot.r, pivot.c, lockedKhap);
  let best: { groups: GroupDesc[]; points: number } | null = null;
  for (const g of cands) {
    for (const cell of g.cells) m[cell.r][cell.c]--;
    const rest = bestDecompose(m, lockedKhap);
    for (const cell of g.cells) m[cell.r][cell.c]++; // hoàn tác
    if (rest) {
      const pts = meldPoints(g.type, g.cells.length, false) + rest.points;
      if (!best || pts > best.points) best = { groups: [g, ...rest.groups], points: pts };
    }
  }
  return best;
}

// ====== API công khai ======

export interface HandAnalysis {
  valid: boolean; // bài có chia hết thành nhóm hợp lệ không (đủ điều kiện tới)
  totalPoints: number; // tổng lệnh phần bài này (hidden values, decomposition tối ưu)
  melds: Meld[]; // các nhóm (đã map về card id thật)
}

// Map GroupDesc (theo ô rank/color) về các Card id thật trong danh sách.
function groupToMeld(g: GroupDesc, pool: Card[], used: Set<string>, exposed: boolean): Meld {
  const cardIds: string[] = [];
  for (const cell of g.cells) {
    const rank = RANK_LIST[cell.r];
    const color = COLORS[cell.c];
    const found = pool.find((c) => c.rank === rank && c.color === color && !used.has(c.id));
    if (found) {
      used.add(found.id);
      cardIds.push(found.id);
    }
  }
  return {
    type: g.type,
    cardIds,
    even: isEvenMeld(g.type),
    points: meldPoints(g.type, g.cells.length, exposed),
  };
}

// Phân tích bài ẩn (còn úp trên tay). Điểm dùng giá trị "ẩn".
export function analyzeHand(cards: Card[]): HandAnalysis {
  const m = toMatrix(cards);
  const best = bestDecompose(m, lockedKhapMatrix(m));
  if (!best) return { valid: false, totalPoints: 0, melds: [] };
  const used = new Set<string>();
  const melds = best.groups.map((g) => groupToMeld(g, cards, used, false));
  return { valid: true, totalPoints: best.points, melds };
}

// Nhận diện MỘT nhóm cụ thể từ tập lá (để phơi khi ăn / khi tới).
// exposed=true => tính điểm theo giá trị "lộ" (ăn). Trả null nếu không hợp lệ.
export function describeMeld(cards: Card[], exposed: boolean): Meld | null {
  const ids = cards.map((c) => c.id);
  const n = cards.length;
  const allSame = cards.every((c) => c.rank === cards[0].rank && c.color === cards[0].color);
  const ranks = new Set(cards.map((c) => c.rank));
  const colors = new Set(cards.map((c) => c.color));

  // Nhóm giống hệt.
  if (allSame) {
    if (cards[0].rank === 'TUONG' && (n === 1 || n === 2))
      return meld('TUONG_SET', ids, exposed, n);
    if (n === 2) return meld('DOI', ids, exposed, n);
    if (n === 3) return meld('KHAN', ids, exposed, n);
    if (n === 4) return meld('QUAN', ids, exposed, n);
  }
  // Tướng đơn.
  if (n === 1 && cards[0].rank === 'TUONG') return meld('TUONG_SET', ids, exposed, n);

  // Tướng-Sĩ-Tượng cùng màu.
  if (n === 3 && colors.size === 1 && ranks.has('TUONG') && ranks.has('SI') && ranks.has('TUONG_ELE'))
    return meld('CMD', ids, exposed, n);

  // Xe-Pháo-Mã cùng màu.
  if (n === 3 && colors.size === 1 && ranks.has('XE') && ranks.has('PHAO') && ranks.has('MA'))
    return meld('XPM', ids, exposed, n);

  // Tốt khác màu.
  if (cards.every((c) => c.rank === 'TOT')) {
    if (n === 3 && colors.size === 3) return meld('TOT3', ids, exposed, n);
    if (n === 4 && colors.size === 4) return meld('TOT4', ids, exposed, n);
  }
  return null;
}

function meld(type: MeldType, cardIds: string[], exposed: boolean, size: number): Meld {
  return { type, cardIds, even: isEvenMeld(type), points: meldPoints(type, size, exposed) };
}

// Lá tỳ có thể được ghép với 1-3 lá trên tay để tạo bất kỳ nhóm hợp lệ nào.
// Vì vậy ăn thành đôi là hợp lệ; chỉ Tướng đứng một mình không phải một lần ăn.
export function isEatableMeld(cards: Card[]): boolean {
  if (cards.length < 2) return false;
  const md = describeMeld(cards, true);
  return md !== null;
}

// Tập lá có tạo thành MỘT nhóm hợp lệ để "TỚI" không (cho phép đôi, Tướng đơn).
export function isWinMeld(cards: Card[]): boolean {
  return describeMeld(cards, true) !== null;
}

// Số lá rác nhỏ nhất: bỏ ít lá nhất để phần còn lại phân rã hết thành nhóm hợp lệ.
// Dùng cho luật "không thêm rác" khi ăn và kiểm tra điều kiện tới.
export function countTrash(cards: Card[]): number {
  const m = toMatrix(cards);
  const lockedKhap = lockedKhapMatrix(m);
  const memo = new Map<string, number>();

  function visit(): number {
    const key = m.flat().join('');
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const pivot = firstNonEmpty(m);
    if (!pivot) return 0;

    let best = Number.POSITIVE_INFINITY;
    for (const g of candidateGroups(m, pivot.r, pivot.c, lockedKhap)) {
      for (const x of g.cells) m[x.r][x.c]--;
      best = Math.min(best, visit());
      for (const x of g.cells) m[x.r][x.c]++;
    }

    // Không được tách lá khỏi Khạp để tính thành rác hay ghép vào nhóm khác.
    if (!lockedKhap[pivot.r][pivot.c]) {
      m[pivot.r][pivot.c]--;
      best = Math.min(best, 1 + visit());
      m[pivot.r][pivot.c]++;
    }
    memo.set(key, best);
    return best;
  }

  return visit();
}

// ====== Luật bài bụng ======
// Cấm dùng ĐÔI (2 lá) trên tay để ăn chẵn thành 3 lá giống hệt nếu việc đó
// phá vỡ một bộ lẻ (Xe-Pháo-Mã / Tướng-Sĩ-Tượng) cùng màu đang chờ.
// Ví dụ: tay có 2 Xe đỏ + Pháo đỏ + Mã đỏ; ăn Xe đỏ thứ 3 sẽ để lại Pháo+Mã
// đỏ thành rác => phạm luật.
const LE_FAMILIES: Rank[][] = [
  ['XE', 'PHAO', 'MA'],
  ['TUONG', 'SI', 'TUONG_ELE'],
];

export function violatesBaiBung(handCards: Card[], eatCards: Card[]): boolean {
  // Chỉ xét khi ăn thành nhóm giống hệt bằng đúng 2 lá cùng loại trên tay.
  if (eatCards.length !== 2) return false;
  const [a, b] = eatCards;
  if (a.rank !== b.rank || a.color !== b.color) return false;
  const fam = LE_FAMILIES.find((f) => f.includes(a.rank));
  if (!fam) return false; // Tốt/Sĩ... không thuộc bộ lẻ 3-quân

  const remaining = handCards.filter((c) => !(eatCards.some((e) => e.id === c.id)));
  const stillHasSameRank = remaining.some(
    (card) => card.rank === a.rank && card.color === a.color
  );
  if (stillHasSameRank) return false;

  const partnerCounts = fam
    .filter((rank) => rank !== a.rank)
    .map(
      (rank) =>
        remaining.filter((card) => card.rank === rank && card.color === a.color).length
    );

  // Chỉ cấm khi đôi đang giữ đúng hai chân lẻ đơn độc. Nếu một chân còn hai lá
  // (2 Xe + 2 Pháo + 1 Mã chẳng hạn), chân đó vẫn tạo đôi nên được quyền giật.
  return partnerCounts.length === 2 && partnerCounts.every((count) => count === 1);
}
