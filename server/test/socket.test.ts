// Test tích hợp: 2 client socket vào phòng, chia bài, đánh/ăn/bốc.
// Chạy: npx tsx test/socket.test.ts
import { io as ioc, Socket } from 'socket.io-client';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GameStateView } from '../../shared/types.js';

const PORT = 3099;
const URL = `http://localhost:${PORT}`;

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'));
  const srv = spawn(process.execPath, [tsxCli, 'src/index.ts'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  await wait(2500);

  let ok = 0;
  let bad = 0;
  const check = (n: string, c: boolean) => {
    if (c) {
      ok++;
      console.log('  ✓', n);
    } else {
      bad++;
      console.log('  ✗ FAIL', n);
    }
  };

  const a: Socket = ioc(URL, { path: '/api/socket/socket.io' });
  const b: Socket = ioc(URL, { path: '/api/socket/socket.io' });
  let stateA: GameStateView | null = null;
  let stateB: GameStateView | null = null;
  a.on('state', (v) => (stateA = v));
  b.on('state', (v) => (stateB = v));

  await new Promise<void>((res) => a.on('connect', () => res()));
  await new Promise<void>((res) => b.on('connect', () => res()));

  const { roomId } = await new Promise<{ roomId: string }>((res) =>
    a.emit('createRoom', 'An', (r: { roomId: string }) => res(r))
  );
  check('tạo phòng có mã 4 ký tự', roomId.length === 4);

  const joinRes = await new Promise<{ ok: boolean }>((res) =>
    b.emit('joinRoom', roomId, 'Bình', (r: { ok: boolean }) => res(r))
  );
  check('người 2 vào phòng được', joinRes.ok);

  a.emit('action', roomId, { type: 'START' });
  await wait(300);

  check('sau START: phase PLAYING', stateA?.phase === 'PLAYING');
  const totalA = (stateA?.yourHand.length ?? 0) +
    (stateA?.players[0].exposedMelds.reduce((n, m) => n + m.cardIds.length, 0) ?? 0);
  const totalB = (stateB?.yourHand.length ?? 0) +
    (stateB?.players[1].exposedMelds.reduce((n, m) => n + m.cardIds.length, 0) ?? 0);
  check('cái có tổng 21 lá (kể cả Quàn đã lật)', totalA === 21);
  check('ghế 1 có tổng 20 lá (kể cả Quàn đã lật)', totalB === 20);
  check('số bài công khai hiển thị đúng 21/20', stateA?.players[0].handCount === 21 && stateA?.players[1].handCount === 20);
  check('không gửi số Khạp của đối phương', stateA?.players[1].khapCount === 0 && stateB?.players[0].khapCount === 0);
  check('lượt đầu của cái, stage DISCARD', stateA?.turn === 0 && stateA?.turnStage === 'DISCARD');

  // Cái đánh 1 lá
  const firstCard = stateA!.yourHand.find((card) => card.rank !== 'TUONG');
  check('nhà cái có lá không phải Tướng để đánh', Boolean(firstCard));
  if (!firstCard) throw new Error('Không có lá nào ngoài Tướng để kiểm thử');
  a.emit('action', roomId, { type: 'DISCARD', cardId: firstCard.id });
  await wait(300);
  check('sau khi cái đánh: có pending (DISCARD)', stateB?.pending?.source === 'DISCARD');
  check('lượt sang ghế 1, stage REACT_DISCARD', stateB?.turn === 1 && stateB?.turnStage === 'REACT_DISCARD');

  // Ghế 1 bỏ qua -> phải bốc bài
  b.emit('action', roomId, { type: 'PASS' });
  await wait(300);
  check('sau PASS: hết pending, ghế 1 stage DRAW', stateB?.turnStage === 'DRAW' && !stateB?.pending);

  // Ghế 1 bốc: lá lật ngửa nhưng chỉ chính người bốc được xử lý.
  b.emit('action', roomId, { type: 'DRAW' });
  await wait(300);
  check('bốc = lật ngửa lá chờ (DRAW)', stateB?.pending?.source === 'DRAW');
  const drawn = stateB!.pending!.card;
  const opponentHasKingKhap =
    drawn.rank === 'TUONG' &&
    stateA!.yourHand.filter((card) => card.rank === drawn.rank && card.color === drawn.color).length === 3;
  const opponentHasPair =
    drawn.rank !== 'TUONG' &&
    stateA!.yourHand.filter((card) => card.rank === drawn.rank && card.color === drawn.color).length === 2;
  check(
    'người bốc tự xử lý, trừ khi đối diện có đôi hoặc Khạp Tướng',
    opponentHasKingKhap || opponentHasPair
      ? stateB?.turn === 0 && stateB?.turnStage === 'REACT_DRAW'
      : stateB?.turn === 1 && stateB?.turnStage === 'REACT_DRAW_SELF'
  );
  if (opponentHasPair) {
    check(
      'cả hai người đều nhận thông báo có đôi giật',
      Boolean(stateA?.lastAction?.includes('có đôi')) && stateA?.lastAction === stateB?.lastAction
    );
  }

  a.close();
  b.close();
  srv.kill();
  console.log(`\nKẾT QUẢ: ${ok} pass, ${bad} fail`);
  process.exit(bad > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
