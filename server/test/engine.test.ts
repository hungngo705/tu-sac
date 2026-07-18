// Test engine phân rã bài + tính lệnh + luật bài bụng.
// Chạy: npx tsx test/engine.test.ts
import { Card, Color, Rank } from '../../shared/types.js';
import {
  analyzeHand,
  countTrash,
  describeMeld,
  isEatableMeld,
  isWinMeld,
  meldPoints,
  violatesBaiBung,
} from '../../shared/melds.js';
import { applyAction } from '../src/engine.js';
import { InternalGame } from '../src/game.js';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log('  ✓', name);
  } else {
    fail++;
    console.log('  ✗ FAIL:', name);
  }
}

let uid = 0;
function c(rank: Rank, color: Color): Card {
  return { id: `${rank}-${color}-${uid++}`, rank, color };
}
function same(rank: Rank, color: Color, n: number): Card[] {
  return Array.from({ length: n }, () => c(rank, color));
}

console.log('== isEatableMeld / isWinMeld ==');
check('3 giống hệt ăn được', isEatableMeld(same('XE', 'RED', 3)));
check('4 giống hệt ăn được', isEatableMeld(same('MA', 'GREEN', 4)));
check('ăn thành đôi hợp lệ', isEatableMeld(same('TOT', 'RED', 2)));
check('Xe-Pháo-Mã cùng màu ăn được', isEatableMeld([c('XE', 'RED'), c('PHAO', 'RED'), c('MA', 'RED')]));
check('Xe-Pháo-Mã khác màu KHÔNG', !isEatableMeld([c('XE', 'RED'), c('PHAO', 'GREEN'), c('MA', 'RED')]));
check('Tướng-Sĩ-Tượng cùng màu ăn được', isEatableMeld([c('TUONG', 'RED'), c('SI', 'RED'), c('TUONG_ELE', 'RED')]));
check('3 Tốt khác màu ăn được', isEatableMeld([c('TOT', 'RED'), c('TOT', 'GREEN'), c('TOT', 'YELLOW')]));
check('đôi vừa ăn được vừa là nhóm tới', isEatableMeld(same('XE', 'RED', 2)) && isWinMeld(same('XE', 'RED', 2)));
check('Tướng đơn là nhóm tới', isWinMeld([c('TUONG', 'RED')]));

console.log('== meldPoints (ẩn/lộ) ==');
check('bộ lẻ XPM = 1 lệnh', meldPoints('XPM', 3, true) === 1 && meldPoints('XPM', 3, false) === 1);
check('bộ lẻ CMD = 1 lệnh', meldPoints('CMD', 3, false) === 1);
check('đôi = 0 lệnh', meldPoints('DOI', 2, false) === 0);
check('Tướng (đơn/đôi) = 1 lệnh', meldPoints('TUONG_SET', 1, false) === 1 && meldPoints('TUONG_SET', 2, true) === 1);
check('3 giống: ăn/lộ 1 / Khạp ẩn 3', meldPoints('KHAN', 3, true) === 1 && meldPoints('KHAN', 3, false) === 3);
check('4 giống: khui 6 / quản 8', meldPoints('QUAN', 4, true) === 6 && meldPoints('QUAN', 4, false) === 8);
check('3 Tốt = 1, 4 Tốt/Chốt = 4', meldPoints('TOT3', 3, false) === 1 && meldPoints('TOT4', 4, false) === 4);

console.log('== describeMeld ==');
check('đôi Tướng nhận diện TUONG_SET (1 lệnh)', describeMeld(same('TUONG', 'RED', 2), false)?.type === 'TUONG_SET');
check('đôi thường nhận diện DOI (0 lệnh)', describeMeld(same('XE', 'RED', 2), false)?.type === 'DOI');
check('XPM even=false (lẻ)', describeMeld([c('XE', 'RED'), c('PHAO', 'RED'), c('MA', 'RED')], true)?.even === false);
check('Khạp even=true (chẵn)', describeMeld(same('SI', 'GREEN', 3), true)?.even === true);

console.log('== analyzeHand (giá trị ẩn) ==');
check('1 đôi hợp lệ (0 lệnh)', analyzeHand(same('XE', 'RED', 2)).valid && analyzeHand(same('XE', 'RED', 2)).totalPoints === 0);
check('Tướng lẻ hợp lệ (1 lệnh)', analyzeHand([c('TUONG', 'RED')]).valid && analyzeHand([c('TUONG', 'RED')]).totalPoints === 1);
check('Tốt lẻ KHÔNG hợp lệ', !analyzeHand([c('TOT', 'RED')]).valid);
check('Sĩ lẻ KHÔNG hợp lệ', !analyzeHand([c('SI', 'RED')]).valid);
check('Khạp 3 giống ẩn = 3 lệnh', analyzeHand(same('TOT', 'RED', 3)).totalPoints === 3);
check('quản 4 giống ẩn = 8 lệnh', analyzeHand(same('PHAO', 'YELLOW', 4)).totalPoints === 8);
check('4 Tốt/Chốt đủ màu = 4 lệnh', analyzeHand([c('TOT', 'RED'), c('TOT', 'GREEN'), c('TOT', 'YELLOW'), c('TOT', 'WHITE')]).totalPoints === 4);
check('Tướng-Sĩ-Tượng = 1 lệnh', analyzeHand([c('TUONG', 'RED'), c('SI', 'RED'), c('TUONG_ELE', 'RED')]).totalPoints === 1);

// Đôi Xe đỏ + Xe-Pháo-Mã xanh: đôi 0 + XPM 1 = 1
const a1 = analyzeHand([...same('XE', 'RED', 2), c('XE', 'GREEN'), c('PHAO', 'GREEN'), c('MA', 'GREEN')]);
check('đôi + XPM hợp lệ, tổng 1 lệnh', a1.valid && a1.totalPoints === 1);

console.log('== analyzeHand chọn decomposition điểm cao ==');
// 4 lá Xe đỏ: nên tính như quản (8) chứ không tách 2 đôi (0).
check('4 lá giống chọn quản (8) > 2 đôi (0)', analyzeHand(same('XE', 'RED', 4)).totalPoints === 8);

console.log('== violatesBaiBung ==');
// Tay: 2 Xe đỏ + Pháo đỏ + Mã đỏ; ăn Xe đỏ thứ 3 bằng 2 Xe => phạm.
const handBung = [...same('XE', 'RED', 2), c('PHAO', 'RED'), c('MA', 'RED')];
check('ăn phá bộ lẻ = phạm bài bụng', violatesBaiBung(handBung, handBung.slice(0, 2)));
// Tay có 3 Xe đỏ + Pháo + Mã: ăn bằng 2 lá vẫn còn 1 Xe -> không phạm.
const handOk = [...same('XE', 'RED', 3), c('PHAO', 'RED'), c('MA', 'RED')];
check('còn dư lá cùng loại = không phạm', !violatesBaiBung(handOk, handOk.slice(0, 2)));
// Tốt không thuộc bộ lẻ 3-quân.
const handTot = same('TOT', 'RED', 2);
check('Tốt không dính bài bụng', !violatesBaiBung(handTot, handTot));

console.log('== countTrash / luật giảm rác ==');
const round = [c('XE', 'RED'), c('PHAO', 'RED'), c('MA', 'RED')];
check('bài tròn có 0 rác', countTrash(round) === 0);
check('thêm Sĩ rời thành đúng 1 rác', countTrash([...round, c('SI', 'GREEN')]) === 1);
check('hai chân bộ lẻ là 2 rác', countTrash([c('XE', 'WHITE'), c('PHAO', 'WHITE')]) === 2);

function gameWith(h0: Card[], h1: Card[]): InternalGame {
  return {
    phase: 'PLAYING',
    players: [
      { seat: 0, name: 'A', socketId: null, connected: true, hand: h0, exposedMelds: [], discardPile: [] },
      { seat: 1, name: 'B', socketId: null, connected: true, hand: h1, exposedMelds: [], discardPile: [] },
    ],
    wall: [], dealer: 0, turn: 1, turnStage: 'REACT_DISCARD', pending: null,
    lastAction: null, winner: null, message: null, scoreResult: null, mustDiscard: null,
  };
}

console.log('== engine luật lượt / ăn bài ==');
{
  const own = c('XE', 'RED');
  const active = c('XE', 'RED');
  const g = gameWith([], [own]);
  g.players[0].discardPile.push(active);
  g.pending = { card: active, from: 0, source: 'DISCARD' };
  check('nhà kế được ăn lá tỳ thành đôi', !applyAction(g, 1, { type: 'EAT', cardIds: [own.id] }).error && g.players[1].exposedMelds[0]?.type === 'DOI');
  check('lá đã được ăn bị xóa khỏi bài bỏ của người đánh', g.players[0].discardPile.length === 0);
}
{
  const xe = c('XE', 'GREEN');
  const phao = c('PHAO', 'GREEN');
  const ma = c('MA', 'GREEN');
  const active = c('XE', 'GREEN');
  const g = gameWith([], [xe, phao, ma]);
  g.pending = { card: active, from: 0, source: 'DISCARD' };
  g.turn = 1;
  g.turnStage = 'REACT_DISCARD';
  const eat = applyAction(g, 1, { type: 'EAT', cardIds: [xe.id] });
  check('Xe xanh được ăn Xe xanh thành đôi dù đang nằm trong bộ Xe-Pháo-Mã', !eat.error && g.players[1].exposedMelds[0]?.type === 'DOI');
}
{
  const pair = same('SI', 'WHITE', 2);
  const hand = [...pair, c('TUONG', 'WHITE'), c('TUONG_ELE', 'WHITE')];
  const active = c('SI', 'WHITE');
  const g = gameWith([], hand);
  g.pending = { card: active, from: 0, source: 'DISCARD' };
  g.turn = 1;
  g.turnStage = 'REACT_DISCARD';
  const eat = applyAction(g, 1, { type: 'EAT', cardIds: pair.map((card) => card.id) });
  check('đôi Sĩ trắng được ăn lá đối thủ đánh dù đang dính bộ Tướng-Sĩ-Tượng', !eat.error && g.players[1].exposedMelds[0]?.type === 'KHAN');
}
{
  const pair = same('SI', 'WHITE', 2);
  const hand = [...pair, c('TUONG', 'WHITE'), c('TUONG_ELE', 'WHITE')];
  const active = c('SI', 'WHITE');
  const g = gameWith([], hand);
  g.pending = { card: active, from: 1, source: 'DRAW' };
  g.turn = 1;
  g.turnStage = 'REACT_DRAW_SELF';
  const eat = applyAction(g, 1, { type: 'EAT', cardIds: pair.map((card) => card.id) });
  check('đôi Sĩ trắng được ăn lá mình bốc dù đang dính bộ Tướng-Sĩ-Tượng', !eat.error && g.players[1].exposedMelds[0]?.type === 'KHAN');
}
{
  const khap = same('TUONG_ELE', 'RED', 3);
  const hand = [...khap, c('TUONG', 'RED'), c('SI', 'RED')];
  const active = c('TUONG_ELE', 'RED');
  const g = gameWith([], hand);
  g.pending = { card: active, from: 0, source: 'DISCARD' };
  g.turn = 1;
  g.turnStage = 'REACT_DISCARD';
  const eat = applyAction(g, 1, { type: 'EAT', cardIds: khap.map((card) => card.id) });
  check('Khạp Tượng đỏ được ăn lá đối thủ đánh để Khui dù làm tăng rác bộ Tướng-Sĩ-Tượng', !eat.error && g.players[1].exposedMelds[0]?.type === 'QUAN');
}
{
  const khap = same('TUONG_ELE', 'RED', 3);
  const hand = [...khap, c('TUONG', 'RED'), c('SI', 'RED')];
  const active = c('TUONG_ELE', 'RED');
  const g = gameWith([], hand);
  g.pending = { card: active, from: 1, source: 'DRAW' };
  g.turn = 1;
  g.turnStage = 'REACT_DRAW_SELF';
  const eat = applyAction(g, 1, { type: 'EAT', cardIds: khap.map((card) => card.id) });
  check('Khạp Tượng đỏ được ăn lá tự bốc để Khui dù làm tăng rác bộ Tướng-Sĩ-Tượng', !eat.error && g.players[1].exposedMelds[0]?.type === 'QUAN');
}
{
  const xe = c('XE', 'GREEN');
  const phao = c('PHAO', 'GREEN');
  const active = c('MA', 'GREEN');
  const g = gameWith([], [xe, phao]);
  g.pending = { card: active, from: 0, source: 'DISCARD' };
  check('nhà kế được ăn bộ lẻ', !applyAction(g, 1, { type: 'EAT', cardIds: [xe.id, phao.id] }).error && g.players[1].exposedMelds[0]?.type === 'XPM');
}
{
  const xe = c('XE', 'YELLOW');
  const phao = c('PHAO', 'YELLOW');
  const active = c('MA', 'YELLOW');
  const g = gameWith([xe, phao], []);
  g.turn = 0;
  g.turnStage = 'REACT_DRAW';
  g.pending = { card: active, from: 1, source: 'DRAW' };
  check('ngoài lượt không được giành lá bốc bằng bộ lẻ thường', Boolean(applyAction(g, 0, { type: 'EAT', cardIds: [xe.id, phao.id] }).error));
}
{
  const own = c('XE', 'WHITE');
  const active = c('XE', 'WHITE');
  const g = gameWith([own], []);
  g.turn = 1;
  g.turnStage = 'DRAW';
  g.wall = [active, ...same('TOT', 'RED', 8)];
  applyAction(g, 1, { type: 'DRAW' });
  check('một Xe trắng rác được giật Xe trắng đối thủ bốc để xét Tới', g.turn === 0 && g.turnStage === 'REACT_DRAW_WIN_OTHER');
  const win = applyAction(g, 0, { type: 'DECLARE_WIN', cardIds: [own.id] });
  check('giật Xe trắng thành đôi thì Tới', !win.error && g.phase === 'FINISHED' && g.winner === 0);
}
{
  const phao = c('PHAO', 'WHITE');
  const ma = c('MA', 'WHITE');
  const active = c('XE', 'WHITE');
  const g = gameWith([phao, ma], []);
  g.turn = 1;
  g.turnStage = 'DRAW';
  g.wall = [active, ...same('TOT', 'RED', 8)];
  applyAction(g, 1, { type: 'DRAW' });
  check('Pháo–Mã trắng được giật Xe trắng đối thủ bốc để xét Tới', g.turn === 0 && g.turnStage === 'REACT_DRAW_WIN_OTHER');
  const win = applyAction(g, 0, { type: 'DECLARE_WIN', cardIds: [phao.id, ma.id] });
  check('giật đủ Xe–Pháo–Mã thì Tới', !win.error && g.winner === 0);
}
{
  const tuong = c('TUONG', 'GREEN');
  const elephant = c('TUONG_ELE', 'GREEN');
  const active = c('SI', 'GREEN');
  const g = gameWith([tuong, elephant], []);
  g.turn = 1;
  g.turnStage = 'DRAW';
  g.wall = [active, ...same('TOT', 'RED', 8)];
  applyAction(g, 1, { type: 'DRAW' });
  check('Tướng–Tượng được giật Sĩ đối thủ bốc để xét Tới', g.turn === 0 && g.turnStage === 'REACT_DRAW_WIN_OTHER');
  const win = applyAction(g, 0, { type: 'DECLARE_WIN', cardIds: [tuong.id, elephant.id] });
  check('giật đủ Tướng–Sĩ–Tượng thì Tới', !win.error && g.winner === 0);
}
{
  const red = c('TOT', 'RED');
  const green = c('TOT', 'GREEN');
  const active = c('TOT', 'YELLOW');
  const g = gameWith([red, green], []);
  g.turn = 1;
  g.turnStage = 'DRAW';
  g.wall = [active, ...same('PHAO', 'WHITE', 8)];
  applyAction(g, 1, { type: 'DRAW' });
  check('hai Chốt khác màu được giật Chốt thứ ba để xét Tới', g.turn === 0 && g.turnStage === 'REACT_DRAW_WIN_OTHER');
  const win = applyAction(g, 0, { type: 'DECLARE_WIN', cardIds: [red.id, green.id] });
  check('giật đủ nhóm Chốt hợp lệ thì Tới', !win.error && g.winner === 0);
}
{
  const pair = same('XE', 'RED', 2);
  const twoTrash = [c('TOT', 'GREEN'), c('TOT', 'WHITE')];
  const active = c('XE', 'RED');
  const g = gameWith([...pair, ...twoTrash], []);
  g.turn = 0;
  g.turnStage = 'REACT_DRAW';
  g.pending = { card: active, from: 1, source: 'DRAW' };
  check('đôi vẫn được giật dù tay chỉ còn hai rác bụng', !applyAction(g, 0, { type: 'EAT', cardIds: pair.map((x) => x.id) }).error);
}
{
  const pair = same('XE', 'RED', 2);
  const phao = c('PHAO', 'RED');
  const ma = c('MA', 'RED');
  const active = c('XE', 'RED');
  const g = gameWith([...pair, phao, ma], []);
  g.turn = 1;
  g.turnStage = 'DRAW';
  g.wall = [active, ...same('TOT', 'WHITE', 8)];
  applyAction(g, 1, { type: 'DRAW' });
  check('đôi Xe không được giật để hạ đôi nhưng Pháo–Mã được ưu tiên giật để Tới', g.turn === 0 && g.turnStage === 'REACT_DRAW_WIN_OTHER');
  check('đang xét Tới thì không được hạ đôi Xe', Boolean(applyAction(g, 0, { type: 'EAT', cardIds: pair.map((card) => card.id) }).error));
  const win = applyAction(g, 0, { type: 'DECLARE_WIN', cardIds: [phao.id, ma.id] });
  check('giật Xe ghép Pháo–Mã và giữ đôi Xe thì bài tròn để Tới', !win.error && g.winner === 0);
}
{
  const khap = same('PHAO', 'GREEN', 3);
  const trash = c('SI', 'WHITE');
  const active = c('PHAO', 'GREEN');
  const g = gameWith([...khap, trash], []);
  g.turn = 1;
  g.turnStage = 'DRAW';
  g.wall = [active, ...same('TOT', 'WHITE', 8)];
  applyAction(g, 1, { type: 'DRAW' });
  check('đối thủ có Khạp được giật lá bốc để Khui', g.turn === 0 && g.turnStage === 'REACT_DRAW');
  const khui = applyAction(g, 0, { type: 'EAT', cardIds: khap.map((card) => card.id) });
  check('giật đủ ba lá Khạp tạo thành Khui bốn lá', !khui.error && g.players[0].exposedMelds[0]?.type === 'QUAN');
}
{
  const khap = same('PHAO', 'YELLOW', 3);
  const active = c('PHAO', 'YELLOW');
  const g = gameWith(khap, []);
  g.turn = 0;
  g.turnStage = 'REACT_DRAW';
  g.pending = { card: active, from: 1, source: 'DRAW' };
  check('Khạp thường không bị bắt buộc giật lá bốc', !applyAction(g, 0, { type: 'PASS' }).error);
}
{
  const khap = same('SI', 'WHITE', 3);
  const g = gameWith(khap, []);
  g.turn = 0;
  g.turnStage = 'DISCARD';
  check('được phá Khạp không phải Tướng để đánh', !applyAction(g, 0, { type: 'DISCARD', cardId: khap[0].id }).error);
}
{
  const trash = c('SI', 'GREEN');
  const g = gameWith([c('XE', 'RED'), c('PHAO', 'RED'), c('MA', 'RED'), trash], []);
  g.turn = 0;
  g.turnStage = 'DISCARD';
  check('đánh đúng lá rác được chấp nhận', !applyAction(g, 0, { type: 'DISCARD', cardId: trash.id }).error);
}
{
  const pair = same('XE', 'RED', 2);
  const phao = c('PHAO', 'RED');
  const ma = c('MA', 'RED');
  for (const chosen of [...pair, phao, ma]) {
    const hand = [...pair, phao, ma].map((card) => ({ ...card }));
    const g = gameWith(hand, []);
    g.turn = 0;
    g.turnStage = 'DISCARD';
    check(`được tùy ý đánh ${chosen.rank} trong đôi/bộ lẻ`, !applyAction(g, 0, { type: 'DISCARD', cardId: chosen.id }).error);
  }
}
{
  const tuong = c('TUONG', 'RED');
  const g = gameWith([tuong], []);
  g.turn = 0;
  g.turnStage = 'DISCARD';
  check('không được đánh quân Tướng', Boolean(applyAction(g, 0, { type: 'DISCARD', cardId: tuong.id }).error));
}
{
  const g = gameWith([], []);
  g.turn = 0;
  g.turnStage = 'DRAW';
  g.wall = same('TOT', 'RED', 7);
  applyAction(g, 0, { type: 'DRAW' });
  check('nọc còn 7 lá thì ván hòa', g.phase === 'FINISHED' && g.winner === null);
}
{
  const active = c('TUONG', 'RED');
  const trash = c('SI', 'GREEN');
  const otherTrash = c('PHAO', 'WHITE');
  const g = gameWith([trash], [otherTrash]);
  g.turn = 0;
  g.turnStage = 'DRAW';
  g.wall = [active, ...same('TOT', 'WHITE', 8)];
  applyAction(g, 0, { type: 'DRAW' });
  check('bốc Tướng khi chưa ai liền bài: người bốc tự xử lý', g.turn === 0 && g.turnStage === 'REACT_DRAW_SELF');
  check('Tướng vừa bốc không được bỏ', Boolean(applyAction(g, 0, { type: 'PASS' }).error));
}
{
  const active = c('TUONG', 'YELLOW');
  const round = [c('XE', 'WHITE'), c('PHAO', 'WHITE'), c('MA', 'WHITE')];
  const g = gameWith(round, [c('SI', 'GREEN')]);
  g.turn = 0;
  g.turnStage = 'DRAW';
  g.wall = [active, ...same('TOT', 'WHITE', 8)];
  applyAction(g, 0, { type: 'DRAW' });
  check('người bốc Tướng liền bài được ưu tiên Tới trước', g.turn === 0 && g.turnStage === 'REACT_DRAW_WIN_SELF');
  const win = applyAction(g, 0, { type: 'DECLARE_WIN' });
  check('người bốc được Tới bằng Tướng đơn', !win.error && g.phase === 'FINISHED' && g.winner === 0);
}
{
  const active = c('TUONG', 'WHITE');
  const round = [c('XE', 'GREEN'), c('PHAO', 'GREEN'), c('MA', 'GREEN')];
  const g = gameWith([c('SI', 'RED')], round);
  g.turn = 0;
  g.turnStage = 'DRAW';
  g.wall = [active, ...same('TOT', 'YELLOW', 8)];
  applyAction(g, 0, { type: 'DRAW' });
  check('A chưa liền bài thì B được quyền xét Tới', g.turn === 1 && g.turnStage === 'REACT_DRAW_WIN_OTHER');
  const win = applyAction(g, 1, { type: 'DECLARE_WIN' });
  check('B được Tới bằng Tướng A vừa bốc', !win.error && g.phase === 'FINISHED' && g.winner === 1);
}
{
  const active = c('TUONG', 'GREEN');
  const roundA = [c('XE', 'RED'), c('PHAO', 'RED'), c('MA', 'RED')];
  const roundB = [c('XE', 'YELLOW'), c('PHAO', 'YELLOW'), c('MA', 'YELLOW')];
  const g = gameWith(roundA, roundB);
  g.pending = { card: active, from: 0, source: 'DRAW' };
  g.turn = 0;
  g.turnStage = 'REACT_DRAW_WIN_SELF';
  const aPass = applyAction(g, 0, { type: 'PASS' });
  check('A không chọn Tới thì chuyển quyền xét Tới cho B', !aPass.error && g.turn === 1 && g.turnStage === 'REACT_DRAW_WIN_OTHER');
  const bPass = applyAction(g, 1, { type: 'PASS' });
  check('cả hai không Tới thì quyền nhận Tướng trả lại A', !bPass.error && g.turn === 0 && g.turnStage === 'REACT_DRAW_SELF');
}
{
  const active = c('XE', 'YELLOW');
  const pair = same('XE', 'YELLOW', 2);
  const trash = c('SI', 'WHITE');
  const g = gameWith([], [...pair, trash]);
  g.turn = 0;
  g.turnStage = 'DRAW';
  g.wall = [active, ...same('TOT', 'WHITE', 8)];
  applyAction(g, 0, { type: 'DRAW' });
  check('đối diện có đôi được chuyển lượt và cả bàn nhận thông báo', g.turn === 1 && g.turnStage === 'REACT_DRAW' && Boolean(g.lastAction?.includes('có đôi')));
  const steal = applyAction(g, 1, { type: 'EAT', cardIds: pair.map((x) => x.id) });
  check('đánh đôi xuống tạo bộ ba rồi bắt buộc chuyển sang đánh', !steal.error && g.players[1].exposedMelds[0]?.type === 'KHAN' && g.turnStage === 'DISCARD' && g.mustDiscard === 1);
  check('sau giật đôi, bài còn rác thì chưa được Tới', Boolean(applyAction(g, 1, { type: 'DECLARE_WIN' }).error));
  const discard = applyAction(g, 1, { type: 'DISCARD', cardId: trash.id });
  check('sau khi giật đôi phải đánh tiếp một lá', !discard.error && g.pending?.source === 'DISCARD' && g.mustDiscard === null);
}
{
  const active = c('XE', 'GREEN');
  const pair = same('XE', 'GREEN', 2);
  const round = [c('XE', 'WHITE'), c('PHAO', 'WHITE'), c('MA', 'WHITE')];
  const g = gameWith([], [...pair, ...round]);
  g.pending = { card: active, from: 0, source: 'DRAW' };
  g.turn = 1;
  g.turnStage = 'REACT_DRAW';
  const steal = applyAction(g, 1, { type: 'EAT', cardIds: pair.map((card) => card.id) });
  const win = applyAction(g, 1, { type: 'DECLARE_WIN' });
  check('giật đôi xong bài liền được Tới ngay, không phải đánh rác', !steal.error && !win.error && g.phase === 'FINISHED' && g.winner === 1);
}
{
  const active = c('MA', 'GREEN');
  const pair = same('MA', 'GREEN', 2);
  const g = gameWith([], pair);
  g.pending = { card: active, from: 0, source: 'DRAW' };
  g.turn = 1;
  g.turnStage = 'REACT_DRAW';
  const pass = applyAction(g, 1, { type: 'PASS' });
  check('người có đôi có thể nhường, quyền trả về người bốc', !pass.error && g.turn === 0 && g.turnStage === 'REACT_DRAW_SELF');
}
{
  const active = c('MA', 'RED');
  const xe = c('XE', 'RED');
  const phao = c('PHAO', 'RED');
  const g = gameWith([], [xe, phao]);
  g.pending = { card: active, from: 0, source: 'DRAW' };
  g.turn = 0;
  g.turnStage = 'REACT_DRAW_SELF';
  const drop = applyAction(g, 0, { type: 'PASS' });
  check('người bốc bỏ thì lá bốc trở thành lá tỳ cho đối thủ', !drop.error && g.turn === 1 && g.turnStage === 'REACT_DISCARD' && g.pending?.source === 'DISCARD');
  const eat = applyAction(g, 1, { type: 'EAT', cardIds: [xe.id, phao.id] });
  check('đối thủ được ăn lá bốc đã bị bỏ bằng bộ hợp lệ', !eat.error && g.players[1].exposedMelds[0]?.type === 'XPM' && g.turnStage === 'DISCARD');
}
{
  const active = c('SI', 'YELLOW');
  const g = gameWith([], []);
  g.pending = { card: active, from: 0, source: 'DRAW' };
  g.turn = 0;
  g.turnStage = 'REACT_DRAW_SELF';
  applyAction(g, 0, { type: 'PASS' });
  const pass = applyAction(g, 1, { type: 'PASS' });
  check('đối thủ không ăn thì được chuyển sang bốc lá mới', !pass.error && g.turn === 1 && g.turnStage === 'DRAW' && !g.pending);
}
{
  const active = c('TUONG', 'YELLOW');
  const sameKing = c('TUONG', 'YELLOW');
  const g = gameWith([sameKing], []);
  g.pending = { card: active, from: 0, source: 'DRAW' };
  g.turn = 0;
  g.turnStage = 'REACT_DRAW_SELF';
  check('không được ghép Tướng vừa bốc thành đôi Tướng', Boolean(applyAction(g, 0, { type: 'EAT', cardIds: [sameKing.id] }).error));
}
{
  const active = c('TUONG', 'GREEN');
  const trash = c('PHAO', 'WHITE');
  const g = gameWith([trash], []);
  g.pending = { card: active, from: 0, source: 'DRAW' };
  g.turn = 0;
  g.turnStage = 'REACT_DRAW_SELF';
  const result = applyAction(g, 0, { type: 'EAT', cardIds: [] });
  check('nhận Tướng vẫn giữ bước xử lý để có thể ghép Sĩ–Tượng', !result.error && g.turnStage === 'ACCEPTED_DRAWN_KING' && g.pending?.card.id === active.id);
  const discard = applyAction(g, 0, { type: 'DISCARD', cardId: trash.id });
  check('nếu đánh rác sau khi nhận thì Tướng được chốt thành nhóm đứng riêng', !discard.error && g.pending?.source === 'DISCARD' && g.players[0].exposedMelds[0]?.cardIds.includes(active.id));
}
{
  const active = c('TUONG', 'WHITE');
  const si = c('SI', 'WHITE');
  const tuong = c('TUONG_ELE', 'WHITE');
  const g = gameWith([si, tuong], []);
  g.pending = { card: active, from: 0, source: 'DRAW' };
  g.turn = 0;
  g.turnStage = 'REACT_DRAW_SELF';
  const accept = applyAction(g, 0, { type: 'EAT', cardIds: [] });
  const combine = applyAction(g, 0, { type: 'EAT', cardIds: [si.id, tuong.id] });
  check('sau khi nhận Tướng vẫn được bấm Ăn để ghép Sĩ–Tượng', !accept.error && !combine.error && g.players[0].exposedMelds[0]?.type === 'CMD');
}
{
  const active = c('TUONG', 'WHITE');
  const si = c('SI', 'WHITE');
  const tuong = c('TUONG_ELE', 'WHITE');
  const g = gameWith([si, tuong], []);
  g.pending = { card: active, from: 0, source: 'DRAW' };
  g.turn = 0;
  g.turnStage = 'REACT_DRAW_SELF';
  const result = applyAction(g, 0, { type: 'EAT', cardIds: [si.id, tuong.id] });
  check('được ghép Tướng bốc với Sĩ–Tượng cùng màu', !result.error && g.players[0].exposedMelds[0]?.type === 'CMD');
}
{
  const active = c('TUONG', 'RED');
  const khap = same('TUONG', 'RED', 3);
  const g = gameWith([c('SI', 'GREEN')], khap);
  g.turn = 0;
  g.turnStage = 'DRAW';
  g.wall = [active, ...same('TOT', 'GREEN', 8)];
  applyAction(g, 0, { type: 'DRAW' });
  check('Khạp Tướng đối diện chỉ được xét Tới, không giật trước người bốc', g.turn === 1 && g.turnStage === 'REACT_DRAW_WIN_OTHER');
  const result = applyAction(g, 1, { type: 'DECLARE_WIN', cardIds: khap.map((x) => x.id) });
  check('đối diện có thể Tới bằng Khạp Tướng và lá vừa bốc', !result.error && g.phase === 'FINISHED' && g.winner === 1);
}
{
  const active = c('TUONG', 'GREEN');
  const khap = same('TUONG', 'GREEN', 3);
  const g = gameWith([c('SI', 'WHITE')], khap);
  g.pending = { card: active, from: 0, source: 'DRAW' };
  g.turn = 1;
  g.turnStage = 'REACT_DRAW_WIN_OTHER';
  const result = applyAction(g, 1, { type: 'PASS' });
  check('B không Tới thì Tướng trả về A để nhận hoặc ghép Sĩ–Tượng', !result.error && g.turn === 0 && g.turnStage === 'REACT_DRAW_SELF');
}
{
  const hidden = [c('XE', 'WHITE'), c('PHAO', 'WHITE'), c('MA', 'WHITE')];
  const g = gameWith(hidden, []);
  g.turn = 0;
  g.turnStage = 'DISCARD';
  applyAction(g, 0, { type: 'DECLARE_WIN' });
  const score = g.scoreResult!.perPlayer[0];
  check('tới thường không cộng thưởng: bộ lẻ = 1 lệnh', score.totalPoints === 1 && score.bonus === 0 && !score.doubled);
}
{
  const khuiCards = same('XE', 'GREEN', 4);
  const hidden = [c('TUONG', 'WHITE')];
  const g = gameWith(hidden, []);
  g.players[0].exposedMelds.push({ type: 'QUAN', cardIds: khuiCards.map((x) => x.id), even: true, points: 6 });
  g.turn = 0;
  g.turnStage = 'DISCARD';
  applyAction(g, 0, { type: 'DECLARE_WIN' });
  const score = g.scoreResult!.perPlayer[0];
  check('Khui bật mức thắng ×2 nhưng không cộng/nhân lệnh', score.totalPoints === 7 && score.bonus === 0 && score.doubled);
}
{
  const g = gameWith([], []);
  g.phase = 'FINISHED';
  g.winner = 1;
  const rematch = applyAction(g, 0, { type: 'REMATCH' });
  const owned = (seat: 0 | 1) =>
    g.players[seat].hand.length +
    g.players[seat].exposedMelds.reduce((total, meld) => total + meld.cardIds.length, 0);
  check(
    'người thắng làm cái ván sau: nhận 21 lá và đánh trước',
    !rematch.error && g.dealer === 1 && g.turn === 1 && owned(1) === 21 && owned(0) === 20
  );
}

console.log(`\nKẾT QUẢ: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
