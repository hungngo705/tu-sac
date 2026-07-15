# Tứ Sắc Online 🎴

Game bài **Tứ Sắc** chơi online cho **2 người**, tối ưu cho điện thoại.
Backend real-time bằng Socket.IO, chạy trên máy bạn, 2 điện thoại (kể cả **khác mạng**) đều vào chơi được qua 1 đường link.

- Frontend: Vite + React + TypeScript (mobile-first)
- Backend: Node + Express + Socket.IO (server-authoritative, chống gian lận)
- Game engine đầy đủ luật: bộ 112 lá, chia bài, nhóm chẵn/lẻ, ăn/bốc, điều kiện tới, tính lệnh

---

## 1. Cài đặt

Cần Node.js >= 18. Trong thư mục dự án:

```bash
npm run install:all
```

## 2. Chạy để phát triển (2 máy cùng WiFi)

```bash
npm run dev
```

- Server: http://localhost:3001
- Client (Vite dev): http://localhost:5173

Mở `http://localhost:5173` trên máy tính. Nếu điện thoại **cùng WiFi**, mở
`http://<IP-máy-tính>:5173` (ví dụ `http://192.168.1.10:5173`).

## 3. Chạy bản build (1 cổng duy nhất — dùng để chơi thật)

```bash
npm run build      # build frontend vào server/public
npm run start      # chạy server phục vụ cả web lẫn game tại cổng 3001
```

Giờ chỉ cần **1 URL**: `http://localhost:3001`.

---

## 4. Cho 2 điện thoại KHÁC MẠNG cùng chơi (tunnel)

Điện thoại khác mạng không vào được IP nội bộ (192.168.x.x). Dùng **tunnel** để
tạo 1 URL public trỏ về máy bạn — không cần cấu hình router.

### Cách A — Cloudflare Tunnel (miễn phí, khuyên dùng)

1. Cài `cloudflared`:
   - Windows: tải tại https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   - Hoặc: `winget install --id Cloudflare.cloudflared`
2. Chạy server: `npm run build && npm run start`
3. Mở cửa sổ terminal khác:
   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```
4. Nó in ra 1 URL kiểu `https://abcd-xyz.trycloudflare.com`.
   **Gửi URL đó cho cả 2 điện thoại** là chơi được, dù ở đâu.

### Cách B — ngrok

1. Đăng ký free tại https://ngrok.com, cài và `ngrok config add-authtoken <token>`
2. `npm run build && npm run start`
3. `ngrok http 3001` → dùng URL `https://xxxx.ngrok-free.app` nó in ra.

> Lưu ý: URL tunnel đổi mỗi lần chạy lại (bản free). Cứ gửi URL mới cho 2 máy.

---

## 5. Cách chơi

1. Người 1 mở URL → **Tạo phòng mới** → nhận **mã phòng 4 ký tự**.
2. Bấm **Mời bạn** để copy link (có sẵn `?room=MÃ`), gửi cho người 2.
3. Người 2 mở link (hoặc **Vào phòng có mã** rồi gõ mã).
4. Chủ phòng bấm **Bắt đầu ván**.
5. **Nhà cái đánh trước** 1 lá không phải Tướng. Nhà kế có thể dùng 1–3 lá trên tay để ăn lá
   tỳ thành bất kỳ nhóm hợp lệ nào (kể cả đôi hoặc bộ lẻ), hoặc bỏ qua để bốc nọc.
6. Lá bốc được **lật ngửa** và chỉ người vừa bốc có quyền **ăn hoặc bỏ** lá đó;
   nếu đối thủ có đúng đôi cùng quân/cùng màu, họ được quyền giật lá bốc để tạo
   bộ ba rồi bắt buộc phải đánh tiếp một lá trước khi được Tới. Nếu đối thủ
   nhường, quyền trở lại người bốc.
   Nếu người bốc bỏ, lá đó trở thành lá tỳ cho đối thủ: đối thủ có thể ăn bằng
   một bộ hợp lệ, hoặc bỏ qua để bốc lá mới.
   Riêng khi bốc **Tướng**, người bốc không được bỏ: phải ghép với Sĩ–Tượng cùng
   màu hoặc hạ Tướng đơn rồi đánh một lá rác. Không được ghép thành đôi Tướng.
   Nếu đối thủ có Khạp Tướng cùng màu, họ được quyền giật lá Tướng vừa bốc.
7. Khi bài đã tròn (mọi lá vào nhóm), chọn lá ghép nốt với lá đang chờ rồi bấm
   **Tới!** (hoặc **Tới!** ngay ở bước đánh nếu bài trên tay đã tròn).

---

## 6. Luật đã cài đặt (tóm tắt)

**Bộ bài:** 112 lá = 7 quân (Tướng, Sĩ, Tượng, Xe, Pháo, Mã, Tốt) × 4 màu
(đỏ/vàng/xanh/trắng) × 4 lá.

**Chia bài (2 người):** mỗi người 20 lá, nhà cái (đi trước) 21 lá, còn lại làm nọc.

**Các nhóm hợp lệ và lệnh** (lệnh phụ thuộc nhóm **ẩn** trên tay hay **lộ** do ăn):

| Nhóm | Số lá | Loại | Lệnh |
|---|---|---|---|
| Đôi (2 giống hệt) | 2 | chẵn | 0 |
| Tướng–Sĩ–Tượng cùng màu | 3 | lẻ | 1 |
| Xe–Pháo–Mã cùng màu | 3 | lẻ | 1 |
| Tướng (1 lá hoặc đôi Tướng) | 1–2 | chẵn | 1 |
| 3 giống hệt — bộ ba do ăn / **Khạp** ẩn | 3 | chẵn | 1 / 3 |
| 4 giống hệt — **khui** (ăn) / **quản** (sẵn) | 4 | chẵn | 6 / 8 |
| 3 Tốt khác màu | 3 | chẵn | 1 |
| 4 Tốt/Chốt khác màu | 4 | chẵn | 4 |
| **Tới** | — | — | không cộng lệnh |
| Người tới có **Quàn hoặc Khui** | — | — | mức thắng ×2 (không nhân số lệnh) |

**Điều kiện tới:** toàn bộ bài (trên tay + đã phơi) chia hết thành các nhóm hợp
lệ, không còn lá rác. Quàn phải lật lúc chia; Khạp được giữ kín với đối phương.
Ván hòa ngay khi nọc còn 7 lá.

**Luật đánh:** người chơi được đánh bất kỳ quân nào, kể cả phá đôi, bộ lẻ hoặc
Khạp. Ngoại lệ duy nhất là **không được đánh Tướng**. Số rác vẫn được engine
dùng để kiểm tra điều kiện tới và tính hợp lệ khi ăn bài.

**Luật bài bụng:** không được dùng **đôi** trên tay để ăn chẵn thành 3 lá nếu
việc đó phá vỡ một **bộ lẻ** cùng màu đang chờ (engine tự chặn).

> Nguồn chuẩn hóa: [hướng dẫn Tứ Sắc của Vinagames](https://www.vinagames.com/vi/tusac.php)
> (có bản tiếng Anh để đối chiếu thuật ngữ), danh mục trò chơi Việt Nam của
> [Pagat](https://www.pagat.com/national/vietnam.html), và mô tả cách chia/lượt/hòa
> trong [Bản án 368/2023/HS-PT](https://static3.luatvietnam.vn/uploaded/LawJudgs/docs/2024/05/29/368_2023_hs-pt_-dong-nai-220640.pdf). Một số địa phương dùng cách quy tiền hoặc luật đền
> khác; ứng dụng hiện cài phần luật chơi chung và chỉ hiển thị lệnh, không cá cược.

---

## 7. Kiểm thử

```bash
npm --prefix server test   # test engine phân rã bài + test tích hợp socket
```

## 8. Cấu trúc

```
shared/     types + engine dùng chung (deck, melds)
server/     Express + Socket.IO + quản lý phòng
client/     Vite React app (mobile UI)
```
