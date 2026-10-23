import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Redis } from "ioredis";
import { cookies } from "next/headers";
import { config } from "./config";
import { ServiceError, upstream, type Service } from "./http";
import type { User } from "../models";
export const cookieName = "nevaro_session";
export interface Session {
  access: string;
  refresh: string;
  accessExpires: number;
  expires: number;
  uncertain?: boolean;
}
let connection: Redis | undefined;
export function redis() {
  if (!connection) {
    connection = new Redis(config().REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    connection.on("error", () => {});
  }
  return connection;
}
async function client() {
  const r = redis();
  if (r.status === "wait") await r.connect();
  if (r.status !== "ready") {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        r.off("ready", ready);
        reject(new ServiceError(503, "SESSION_STORE_UNAVAILABLE"));
      }, 3000);
      function ready() {
        clearTimeout(timer);
        resolve();
      }
      r.once("ready", ready);
    });
  }
  return r;
}
const key = (id: string) => `nevaro:session:${createHash("sha256").update(id).digest("hex")}`;
function seal(s: Session) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(config().SESSION_SECRET, "hex"), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(s)), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64");
}
function unseal(value: string): Session {
  const b = Buffer.from(value, "base64"),
    decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(config().SESSION_SECRET, "hex"),
      b.subarray(0, 12),
    );
  decipher.setAuthTag(b.subarray(-16));
  return JSON.parse(
    Buffer.concat([decipher.update(b.subarray(12, -16)), decipher.final()]).toString(),
  ) as Session;
}
export async function sessionId() {
  const id = (await cookies()).get(cookieName)?.value;
  return id && /^[a-f0-9]{64}$/.test(id) ? id : null;
}
async function read(id: string) {
  const value = await (await client()).get(key(id));
  if (!value) throw new ServiceError(401, "UNAUTHORIZED");
  return unseal(value);
}
async function store(id: string, session: Session) {
  await (
    await client()
  ).set(key(id), seal(session), "PX", Math.max(1, session.expires - Date.now()));
}
export function extractRefresh(response: Response) {
  const header = response.headers.getSetCookie().find((c) => c.startsWith("users_refresh="));
  const token = header?.match(/^users_refresh=([A-Za-z0-9_-]{43});/)?.[1];
  const age = Number(header?.match(/Max-Age=(\d+)/i)?.[1]);
  if (!token || !age) throw new ServiceError(502, "INVALID_AUTH_RESPONSE");
  return { token, age };
}
async function lock<T>(
  id: string,
  action: (session: Session, save: (s: Session) => Promise<void>) => Promise<T>,
): Promise<T> {
  const r = await client(),
    lockKey = `${key(id)}:lock`,
    owner = randomBytes(16).toString("hex");
  const deadline = Date.now() + 12000;
  while (!(await r.set(lockKey, owner, "PX", 30000, "NX"))) {
    if (Date.now() > deadline) throw new ServiceError(503, "SESSION_BUSY");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  try {
    const s = await read(id);
    return await action(s, async (next) => {
      const saved = await r.eval(
        "if redis.call('get',KEYS[2]) == ARGV[1] and redis.call('exists',KEYS[1]) == 1 then redis.call('psetex',KEYS[1],ARGV[3],ARGV[2]); return 1 else return 0 end",
        2,
        key(id),
        lockKey,
        owner,
        seal(next),
        Math.max(1, next.expires - Date.now()),
      );
      if (!saved) throw new ServiceError(401, "UNAUTHORIZED");
    });
  } finally {
    await r.eval(
      "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
      1,
      lockKey,
      owner,
    );
  }
}
export async function login(body: unknown) {
  const response = await upstream("USERS", "/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json(),
    refresh = extractRefresh(response),
    id = randomBytes(32).toString("hex");
  await store(id, {
    access: data.accessToken,
    refresh: refresh.token,
    accessExpires: Date.now() + data.expiresIn * 1000 - 30000,
    expires: Date.now() + refresh.age * 1000,
  });
  (await cookies()).set(cookieName, id, {
    httpOnly: true,
    sameSite: "strict",
    secure: config().APP_ORIGIN.startsWith("https:"),
    path: "/",
    maxAge: refresh.age,
  });
  return {
    user: {
      userId: data.user.userId,
      displayName: data.user.displayName,
      role: data.user.role,
    },
  };
}
export async function access(id: string, staleAccess?: string) {
  const current = await read(id);
  if (current.uncertain) throw new ServiceError(503, "SESSION_UNCERTAIN");
  if (current.accessExpires > Date.now() && (!staleAccess || current.access !== staleAccess))
    return current.access;
  return lock(id, async (s, save) => {
    if (s.uncertain) throw new ServiceError(503, "SESSION_UNCERTAIN");
    if (s.accessExpires > Date.now() && (!staleAccess || s.access !== staleAccess)) return s.access;
    try {
      const response = await upstream("USERS", "/api/v1/auth/refresh", {
        method: "POST",
        headers: {
          Cookie: `users_refresh=${s.refresh}`,
          "X-CSRF-Protection": "1",
        },
      });
      const data = await response.json(),
        refresh = extractRefresh(response);
      s.access = data.accessToken;
      s.refresh = refresh.token;
      s.accessExpires = Date.now() + data.expiresIn * 1000 - 30000;
      s.expires = Math.min(s.expires, Date.now() + refresh.age * 1000);
      await save(s);
      return s.access;
    } catch (error) {
      if (error instanceof ServiceError && error.status === 401)
        await (await client()).del(key(id));
      else {
        s.uncertain = true;
        await save(s);
      }
      throw error;
    }
  });
}
export async function authorized(
  service: Service,
  path: string,
  init: RequestInit = {},
  suppliedId?: string,
) {
  const id = suppliedId ?? (await sessionId());
  if (!id) throw new ServiceError(401, "UNAUTHORIZED");
  let token = await access(id);
  const send = () =>
    upstream(service, path, {
      ...init,
      headers: {
        ...Object.fromEntries(new Headers(init.headers)),
        Authorization: `Bearer ${token}`,
      },
    });
  try {
    return await send();
  } catch (e) {
    if (e instanceof ServiceError && e.status === 401 && (!init.method || init.method === "GET")) {
      token = await access(id, token);
      return send();
    }
    throw e;
  }
}
export async function currentUser(): Promise<User> {
  const id = await sessionId();
  if (id) {
    const counter = `${key(id)}:requests:${Math.floor(Date.now() / 60000)}`;
    const count = await (
      await client()
    ).eval(
      "local n=redis.call('incr',KEYS[1]); if n==1 then redis.call('expire',KEYS[1],120) end; return n",
      1,
      counter,
    );
    if (Number(count) > 240) throw new ServiceError(429, "RATE_LIMITED", "60");
  }
  return (await authorized("USERS", "/api/v1/users/me")).json();
}
export async function logout() {
  const id = await sessionId();
  let revoked = true;
  if (id) {
    try {
      await lock(id, async (s) => {
        await upstream("USERS", "/api/v1/auth/logout", {
          method: "POST",
          headers: {
            Cookie: `users_refresh=${s.refresh}`,
            "X-CSRF-Protection": "1",
          },
        });
      });
    } catch {
      revoked = false;
    } finally {
      try {
        await (await client()).del(key(id));
      } catch {
        revoked = false;
      }
    }
  }
  (await cookies()).delete(cookieName);
  return { revoked };
}
