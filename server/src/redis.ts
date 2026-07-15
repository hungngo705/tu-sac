import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { Server } from 'socket.io';

// Vercel Marketplace Redis integrations normally expose REDIS_URL. KV_URL is
// kept as a fallback for older Vercel KV integrations.
const redisUrl = process.env.REDIS_URL || process.env.KV_URL;

export const redis = redisUrl ? createClient({ url: redisUrl }) : null;

export async function configureRedis(io: Server): Promise<void> {
  if (!redis) return;

  redis.on('error', (error) => console.error('Redis command client error:', error));
  await redis.connect();

  const publisher = redis.duplicate();
  const subscriber = redis.duplicate();
  publisher.on('error', (error) => console.error('Redis publisher error:', error));
  subscriber.on('error', (error) => console.error('Redis subscriber error:', error));
  await Promise.all([publisher.connect(), subscriber.connect()]);
  io.adapter(createAdapter(publisher, subscriber));
}
