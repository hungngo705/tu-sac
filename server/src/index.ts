import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupRooms } from './rooms.js';
import { attachGameSocketServer } from './socket-server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

export const app = express();
export const httpServer = createServer(app);
export const io = attachGameSocketServer(httpServer, '/api/socket/socket.io');

// Phục vụ frontend đã build (client build ra ../public).
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// SPA fallback: mọi route không phải api/socket => trả index.html.
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) res.status(200).send('Frontend chưa được build. Chạy: npm run build');
  });
});

setInterval(cleanupRooms, 5 * 60 * 1000);

// Chạy trực tiếp ở local/Render. Vercel dùng entrypoint riêng tại api/socket.ts.
const isDirectRun =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  httpServer.listen(PORT, () => {
    console.log(`\n  Tứ Sắc server chạy tại http://localhost:${PORT}`);
    console.log(`  (build frontend rồi mở URL này, hoặc dev bằng: npm run dev)\n`);
  });
}

export default httpServer;
