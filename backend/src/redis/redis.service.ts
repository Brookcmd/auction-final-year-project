import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface CachedAuctionState {
  auctionId: string;
  currentHighestBid: number;
  highestBidderId: string | null;
  highestBidderAlias: string | null;
  endTime: number; // Unix timestamp ms
  bidIncrement: number;
  totalBidsCount: number;
  status: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  // Resilient in-memory fallback for distributed locks & states if Redis server is unreachable
  private memoryCache = new Map<string, string>();
  private memoryLocks = new Map<string, { token: string; expiresAt: number }>();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');

    try {
      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn('Redis reconnection stopped. Operating in high-performance local memory fallback mode.');
            return null; // Stop retrying, use memory fallback
          }
          return Math.min(times * 200, 1000);
        },
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Redis connected successfully on ${host}:${port}`);
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        // Non-fatal, fallback to memory
      });

      await this.client.connect().catch((err) => {
        this.logger.warn(`Redis server not reachable on ${host}:${port}. Using thread-safe in-memory cache.`);
      });
    } catch (e) {
      this.logger.warn(`Redis init fallback: ${e.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client && this.isConnected) {
      await this.client.quit();
    }
  }

  /**
   * Acquire a distributed lock for an auction to prevent simultaneous bid race conditions.
   * Uses REDIS SETNX with PX (millisecond TTL), or memory mutex fallback.
   */
  async acquireLock(key: string, ttlMs = 1500): Promise<{ acquired: boolean; token: string }> {
    const lockKey = `lock:${key}`;
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);

    if (this.isConnected && this.client) {
      try {
        const result = await this.client.set(lockKey, token, 'PX', ttlMs, 'NX');
        return { acquired: result === 'OK', token };
      } catch (err) {
        this.logger.error(`Redis lock error: ${err.message}`);
      }
    }

    // Memory fallback lock
    const now = Date.now();
    const existing = this.memoryLocks.get(lockKey);
    if (existing && existing.expiresAt > now) {
      return { acquired: false, token: '' };
    }

    this.memoryLocks.set(lockKey, { token, expiresAt: now + ttlMs });
    return { acquired: true, token };
  }

  /**
   * Release lock safely (ensuring the token matches so expired locks aren't wrongly deleted).
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    const lockKey = `lock:${key}`;

    if (this.isConnected && this.client) {
      try {
        // Lua script to atomically compare and delete
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        const res = await this.client.eval(luaScript, 1, lockKey, token);
        return res === 1;
      } catch (err) {
        this.logger.error(`Redis release lock error: ${err.message}`);
      }
    }

    const current = this.memoryLocks.get(lockKey);
    if (current && current.token === token) {
      this.memoryLocks.delete(lockKey);
      return true;
    }
    return false;
  }

  /**
   * Get Cached Auction State
   */
  async getAuctionState(auctionId: string): Promise<CachedAuctionState | null> {
    const key = `auction:state:${auctionId}`;
    if (this.isConnected && this.client) {
      try {
        const raw = await this.client.get(key);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        // Fallback
      }
    }

    const mem = this.memoryCache.get(key);
    return mem ? JSON.parse(mem) : null;
  }

  /**
   * Set Cached Auction State
   */
  async setAuctionState(auctionId: string, state: CachedAuctionState, ttlSeconds = 86400): Promise<void> {
    const key = `auction:state:${auctionId}`;
    const payload = JSON.stringify(state);

    if (this.isConnected && this.client) {
      try {
        await this.client.set(key, payload, 'EX', ttlSeconds);
        return;
      } catch (e) {}
    }

    this.memoryCache.set(key, payload);
  }

  /**
   * Publish event to a Redis channel
   */
  async publish(channel: string, message: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.publish(channel, message);
      } catch (e) {}
    }
  }
}
