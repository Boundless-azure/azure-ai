// Minimal ambient module declaration for ioredis to satisfy TypeScript in projects
// where the dependency may not be installed. This avoids TS2307 during dynamic import.
declare module 'ioredis' {
  interface IORedisOptions {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    tls?: Record<string, unknown> | undefined;
  }

  class Redis {
    constructor(url: string);
    constructor(options: IORedisOptions);
  }

  export default Redis;
}
