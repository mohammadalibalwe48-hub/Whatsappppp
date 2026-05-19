import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Thin Redis wrapper with an in-memory fallback so the API still boots locally
 * even without Redis. The in-memory fallback is only intended for development —
 * production deployments MUST provide a real Redis instance.
 */
export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSeconds?: number): Promise<number>;
  ttl(key: string): Promise<number>;
  ready: boolean;
}

class InMemoryStore implements KvStore {
  ready = true;
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  private evict(key: string): boolean {
    const item = this.store.get(key);
    if (!item) return false;
    if (item.expiresAt !== null && item.expiresAt <= Date.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async get(key: string): Promise<string | null> {
    if (!this.evict(key)) return null;
    return this.store.get(key)!.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const existing = this.evict(key) ? this.store.get(key) : undefined;
    const next = existing ? Number(existing.value) + 1 : 1;
    const expiresAt = existing?.expiresAt ?? (ttlSeconds ? Date.now() + ttlSeconds * 1000 : null);
    this.store.set(key, { value: String(next), expiresAt });
    return next;
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item) return -2;
    if (item.expiresAt === null) return -1;
    return Math.max(0, Math.floor((item.expiresAt - Date.now()) / 1000));
  }
}

class RedisStore implements KvStore {
  ready = false;
  constructor(private client: Redis) {
    client.on("ready", () => {
      this.ready = true;
      logger.info("Redis connection ready");
    });
    client.on("error", (err) => {
      logger.warn({ err }, "Redis error");
    });
    client.on("end", () => {
      this.ready = false;
      logger.warn("Redis connection closed");
    });
  }

  async get(key: string) {
    return this.client.get(key);
  }
  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) await this.client.set(key, value, "EX", ttlSeconds);
    else await this.client.set(key, value);
  }
  async del(key: string) {
    await this.client.del(key);
  }
  async incr(key: string, ttlSeconds?: number) {
    const next = await this.client.incr(key);
    if (ttlSeconds && next === 1) await this.client.expire(key, ttlSeconds);
    return next;
  }
  async ttl(key: string) {
    return this.client.ttl(key);
  }
}

let _kv: KvStore | null = null;

export function getKv(): KvStore {
  if (_kv) return _kv;

  if (!env.REDIS_URL || env.REDIS_URL.startsWith("memory")) {
    logger.warn("Using in-memory KV store (no REDIS_URL set). Do not use in production.");
    _kv = new InMemoryStore();
    return _kv;
  }

  try {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      enableOfflineQueue: true,
      reconnectOnError: () => true
    });
    _kv = new RedisStore(client);
    return _kv;
  } catch (err) {
    logger.error({ err }, "Failed to initialize Redis — falling back to in-memory KV");
    _kv = new InMemoryStore();
    return _kv;
  }
}
