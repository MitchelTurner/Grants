export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  maxRetriesPerRequest: null;
  tls?: Record<string, never>;
}

/** BullMQ connection options parsed from REDIS_URL. */
export function redisConnectionOptions(redisUrl: string): RedisConnectionOptions {
  const url = new URL(redisUrl);
  const port = url.port.length > 0 ? Number(url.port) : 6379;
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("REDIS_URL port is invalid");
  }
  return {
    host: url.hostname,
    port,
    ...(url.username.length > 0 ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password.length > 0 ? { password: decodeURIComponent(url.password) } : {}),
    maxRetriesPerRequest: null,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
