export class StackHttpError extends Error {
  constructor(method, path, status) {
    super(`${method} ${path}: HTTP ${status}`);
    this.status = status;
  }
}
export async function call(
  base,
  path,
  { method = "GET", body, token, headers = {}, expected } = {},
) {
  const multipart = body instanceof FormData;
  let response;
  try {
    response = await fetch(new URL(path, base), {
      method,
      headers: {
        ...(body !== undefined && !multipart ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(`${method} ${path}: servicio no disponible o timeout`);
  }
  if (expected === undefined ? !response.ok : response.status !== expected)
    throw new StackHttpError(method, path, response.status);
  return response;
}
export async function json(base, path, options) {
  const response = await call(base, path, options);
  try {
    return await response.json();
  } catch {
    throw new Error(`${path}: respuesta JSON inválida`);
  }
}
export function serviceUrls(env = process.env) {
  const urls = {
    users: env.USERS_BASE_URL || `http://localhost:${env.USERS_PORT || 8081}`,
    catalog: env.CATALOG_BASE_URL || `http://localhost:${env.CATALOG_PORT || 8082}`,
    playback: env.PLAYBACK_BASE_URL || `http://localhost:${env.PLAYBACK_PORT || 8083}`,
    frontend: env.FRONTEND_BASE_URL || `http://localhost:${env.FRONTEND_PORT || 8080}`,
  };
  // This script creates accounts: do not accidentally smoke a production URL
  // inherited from a developer shell instead of this local Compose stack.
  const localHosts = new Set([
    "localhost",
    "127.0.0.1",
    "[::1]",
    "users-service",
    "catalog-service",
    "playback-service",
    "frontend",
  ]);
  for (const base of Object.values(urls)) {
    let url;
    try {
      url = new URL(base);
    } catch {
      throw new Error("Invalid local stack URL");
    }
    if (
      !localHosts.has(url.hostname) ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "Stack tools only permit loopback or known Compose service URLs without credentials",
      );
    }
  }
  return urls;
}
