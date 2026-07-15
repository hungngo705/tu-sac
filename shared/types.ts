// ====== Định nghĩa quân bài Tứ Sắc ======
// 7 loại quân, 4 màu, mỗi tổ hợp có 4 lá => 7 * 4 * 4 = 112 lá.

export type Rank =
  | 'TUONG' // Tướng (General)
  | 'SI' // Sĩ (Advisor)
  | 'TUONG_ELE' // Tượng (Elephant)
  | 'XE' // Xe (Chariot)
  | 'PHAO' // Pháo (Cannon)
  | 'MA' // Mã (Horse)
  | 'TOT'; // Tốt (Soldier)

export type Color = 'RED' | 'YELLOW' | 'GREEN' | 'WHITE';

export const RANKS: Rank[] = ['TUONG', 'SI', 'TUONG_ELE', 'XE', 'PHAO', 'MA', 'TOT'];
export const COLORS: Color[] = ['RED', 'YELLOW', 'GREEN', 'WHITE'];

export const RANK_LABEL: Record<Rank, string> = {
  TUONG: 'Tướng',
  SI: 'Sĩ',
  TUONG_ELE: 'Tượng',
  XE: 'Xe',
  PHAO: 'Pháo',
  MA: 'Mã',
  TOT: 'Tốt',
};

// Ký tự chữ Hán truyền thống trên quân cờ, hiển thị theo màu.
export const RANK_GLYPH: Record<Rank, string> = {
  TUONG: '將',
  SI: '士',
  TUONG_ELE: '象',
  XE: '車',
  PHAO: '砲',
  MA: '馬',
  TOT: '卒',
};

export const COLOR_LABEL: Record<Color, string> = {
  RED: 'Đỏ',
  YELLOW: 'Vàng',
  GREEN: 'Xanh',
  WHITE: 'Trắng',
};

export const COLOR_HEX: Record<Color, string> = {
  RED: '#ef6a61',
  YELLOW: '#e9c94f',
  GREEN: '#68bd7b',
  WHITE: '#f4f1e8',
};

// Một lá bài cụ thể trong ván (có id duy nhất để track).
export interface Card {
  id: string; // ví dụ "XE-RED-2"
  rank: Rank;
  color: Color;
}

export function cardKey(rank: Rank, color: Color): string {
  return `${rank}-${color}`;
}

// ====== Meld (nhóm hợp lệ) ======
export type MeldType =
  | 'DOI' // đôi: 2 lá giống hệt (chẵn)
  | 'KHAN' // 3 lá giống hệt (chẵn) — điểm khác nhau khi ẩn/lộ
  | 'QUAN' // 4 lá giống hệt (chẵn) — khui (lộ) 6 / quản (ẩn) 8
  | 'TUONG_SET' // Tướng đứng riêng hoặc đôi Tướng (chẵn, 1 lệnh)
  | 'XPM' // Xe-Pháo-Mã cùng màu (LẺ, 0 lệnh)
  | 'CMD' // Tướng-Sĩ-Tượng cùng màu (LẺ, 0 lệnh)
  | 'TOT3' // 3 Tốt khác màu (chẵn)
  | 'TOT4'; // 4 Tốt khác màu (chẵn)

export interface Meld {
  type: MeldType;
  cardIds: string[];
  even: boolean; // true = chẵn, false = lẻ (XPM/CMD)
  points: number; // số lệnh nhóm này đóng góp
}

// ====== Trạng thái ván chơi (server-authoritative) ======
export type Phase = 'WAITING' | 'PLAYING' | 'FINISHED';
export type Seat = 0 | 1;

// Giai đoạn trong lượt:
//  DISCARD       - người tới lượt phải đánh ra 1 lá (hoặc xin tới)
//  REACT_DISCARD - đối thủ phản ứng với lá vừa đánh (ăn / tới / bỏ qua)
//  DRAW          - người tới lượt bốc 1 lá từ nọc
//  REACT_DRAW    - trạng thái dự phòng cho biến thể cho phép nhà khác tranh lá bốc
//  REACT_DRAW_SELF - người bốc tự xử lý lá mình bốc (ăn / tới / bỏ = chết)
//  REACT_DRAW_WIN_SELF  - người bốc Tướng được ưu tiên xét Tới
//  REACT_DRAW_WIN_OTHER - đối thủ được xét Tới bằng quân Tướng vừa bốc
export type TurnStage =
  | 'DISCARD'
  | 'REACT_DISCARD'
  | 'DRAW'
  | 'REACT_DRAW'
  | 'REACT_DRAW_SELF'
  | 'REACT_DRAW_WIN_SELF'
  | 'REACT_DRAW_WIN_OTHER';

// Nguồn của lá đang chờ: 'DISCARD' = do người khác đánh; 'DRAW' = vừa bốc lật.
export interface PendingCard {
  card: Card;
  from: Seat; // ai tạo ra lá này (người đánh / người bốc)
  source: 'DISCARD' | 'DRAW';
}

// Trạng thái công khai gửi cho từng client (đã ẩn bài đối thủ).
export interface PublicPlayer {
  seat: Seat;
  name: string;
  connected: boolean;
  handCount: number; // tổng số bài sở hữu, gồm cả Quàn/nhóm đã phơi
  khapCount: number; // chỉ hiện Khạp của chính người nhận view; đối thủ luôn là 0
  exposedMelds: Meld[]; // các nhóm đã phơi/khui, giữ nguyên nhóm để hiển thị
  discardPile: Card[]; // bài đã đánh ra / lá bốc bị chết của người này
}

export interface GameStateView {
  roomId: string;
  phase: Phase;
  you: Seat | null; // ghế của người nhận view (null nếu là khán giả)
  players: PublicPlayer[];
  yourHand: Card[]; // chỉ bài của chính người nhận
  wallCount: number; // số lá còn trong nọc
  turn: Seat; // đến lượt ai hành động
  pending: PendingCard | null; // lá đang chờ xử lý (đánh ra / bốc lật)
  turnStage: TurnStage; // giai đoạn trong lượt
  lastAction: string | null;
  winner: Seat | null;
  scoreResult: ScoreResult | null;
  message: string | null;
  mustDiscard: boolean; // sau khi giật đôi: phải đánh nếu bài chưa đủ điều kiện Tới
}

export interface ScoreResult {
  winner: Seat;
  perPlayer: {
    seat: Seat;
    melds: Meld[]; // toàn bộ nhóm (phơi + trên tay) để hiển thị
    base: number; // tổng lệnh các nhóm (chưa cộng thưởng/nhân đôi)
    bonus: number; // hiện luôn bằng 0: Tới không cộng lệnh
    doubled: boolean; // người tới có Quàn hoặc Khui nên mức thắng được nhân đôi (lệnh không nhân)
    totalPoints: number; // tổng lệnh cuối cùng
    valid: boolean; // bài có hợp lệ để tới không
  }[];
  summary: string;
}

// ====== Giao thức Socket.IO ======
export interface ClientToServer {
  createRoom: (name: string, cb: (res: { roomId: string; seat: Seat }) => void) => void;
  joinRoom: (
    roomId: string,
    name: string,
    cb: (res: { ok: boolean; seat?: Seat; error?: string }) => void
  ) => void;
  action: (roomId: string, action: GameAction) => void;
  requestState: (roomId: string) => void;
}

export interface ServerToClient {
  state: (view: GameStateView) => void;
  error: (msg: string) => void;
  toast: (msg: string) => void;
}

export type GameAction =
  | { type: 'DRAW' } // bốc 1 lá từ nọc
  | { type: 'DISCARD'; cardId: string } // đánh ra 1 lá
  | { type: 'EAT'; cardIds: string[] } // ăn lá đang chờ, dùng các lá trên tay
  | { type: 'PASS' } // bỏ qua không ăn (lá đánh -> bốc; lá tự bốc -> chết)
  | { type: 'DECLARE_WIN'; cardIds?: string[] } // xin tới (cardIds: lá ghép nốt với lá chờ)
  | { type: 'START' } // chủ phòng bắt đầu ván
  | { type: 'REMATCH' }; // chơi lại
