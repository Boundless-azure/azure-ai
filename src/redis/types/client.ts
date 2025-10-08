export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode?: string,
    durationSeconds?: number,
  ): Promise<'OK' | null>;
  del(...keys: string[]): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  scan(
    cursor: number,
    matchArg?: string,
    pattern?: string,
    countArg?: string,
    count?: number,
  ): Promise<[string, string[]]>;
}

export interface RedisKeySpaceQuery {
  pattern: string; // e.g. "user:*" or "session:*"
  count?: number; // per scan page size
}

export interface RedisJSONOptions {
  ttlSeconds?: number;
}
