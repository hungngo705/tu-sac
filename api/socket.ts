// Direct default export matches Vercel's WebSocket Function contract. The
// extensionless import also lets the Vercel TypeScript bundler trace the file.
import { httpServer } from '../server/src/index';

export default httpServer;
