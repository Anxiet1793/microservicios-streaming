import { container } from "../../../../bootstrap/container";
import { unauthorized, UsersError } from "../../domain/errors";
import {
  bearer,
  checkOrigin,
  cookie,
  json,
  parse,
  query,
  refreshCookie,
  type Handler,
} from "../../../../shared/http";
import {
  changePasswordSchema,
  emptySchema,
  loginSchema,
  paginationSchema,
  preferenceSchema,
  profileSchema,
  registerSchema,
  titleSchema,
} from "./schemas";
import type { LoginUser } from "../../application/use-cases/login-user";

function noQuery(request: Request) {
  parse(emptySchema, query(request));
}
async function claims(request: Request) {
  return container().access.verify(bearer(request));
}
async function title(context: Parameters<Handler>[1]) {
  return parse(titleSchema, (await context.params).tituloId);
}
function authResponse(result: Awaited<ReturnType<LoginUser["execute"]>>) {
  const { refreshToken, refreshExpiresAt, ...body } = result;
  return Response.json(body, {
    headers: { "set-cookie": cookie(container().config, refreshToken, refreshExpiresAt) },
  });
}
async function authLimit(kind: "login" | "register" | "refresh" | "logout") {
  const c = container();
  await c.limiter.consume(
    `global-${kind}`,
    "all",
    c.config.AUTH_GLOBAL_LIMIT,
    c.config.AUTH_RATE_WINDOW,
  );
}
export const register: Handler = async (request) => {
  const c = container();
  noQuery(request);
  checkOrigin(request, c.config);
  await authLimit("register");
  const input = parse(registerSchema, await json(request, c.config.REQUEST_MAX_BYTES));
  await c.limiter.consume(
    "register",
    input.email,
    c.config.REGISTER_RATE_LIMIT,
    c.config.AUTH_RATE_WINDOW,
  );
  return Response.json(await c.cases.registerUser.execute(input), { status: 201 });
};
export const login: Handler = async (request) => {
  const c = container();
  noQuery(request);
  checkOrigin(request, c.config);
  await authLimit("login");
  const input = parse(loginSchema, await json(request, c.config.REQUEST_MAX_BYTES));
  await c.limiter.consume(
    "login",
    input.email,
    c.config.LOGIN_RATE_LIMIT,
    c.config.AUTH_RATE_WINDOW,
  );
  return authResponse(await c.cases.loginUser.execute(input));
};
export const refresh: Handler = async (request) => {
  const c = container();
  noQuery(request);
  checkOrigin(request, c.config, true);
  await authLimit("refresh");
  const raw = refreshCookie(request);
  if (!raw) unauthorized();
  return authResponse(await c.cases.refreshSession.execute(raw));
};
export const logout: Handler = async (request) => {
  const c = container();
  noQuery(request);
  checkOrigin(request, c.config, true);
  await authLimit("logout");
  await c.cases.logoutUser.execute(refreshCookie(request));
  return new Response(null, { status: 204, headers: { "set-cookie": cookie(c.config) } });
};
export const getMe: Handler = async (request) => {
  noQuery(request);
  return Response.json(await container().cases.getCurrentUser.execute(await claims(request)));
};
export const updateMe: Handler = async (request) => {
  const c = container();
  noQuery(request);
  checkOrigin(request, c.config);
  const identity = await claims(request);
  return Response.json(
    await c.cases.updateProfile.execute(
      identity,
      parse(profileSchema, await json(request, c.config.REQUEST_MAX_BYTES)),
    ),
  );
};
export const changePassword: Handler = async (request) => {
  const c = container();
  noQuery(request);
  checkOrigin(request, c.config);
  const identity = await claims(request);
  await c.limiter.consume(
    "password-change",
    identity.userId,
    c.config.LOGIN_RATE_LIMIT,
    c.config.AUTH_RATE_WINDOW,
  );
  await c.cases.changePassword.execute(
    identity,
    parse(changePasswordSchema, await json(request, c.config.REQUEST_MAX_BYTES)),
  );
  return new Response(null, { status: 204, headers: { "set-cookie": cookie(c.config) } });
};
export const getWatchlist: Handler = async (request) => {
  const page = parse(paginationSchema, query(request));
  return Response.json(
    await container().cases.getWatchlist.execute(await claims(request), page.page, page.limit),
  );
};
export const addWatchlist: Handler = async (request, context) => {
  const c = container();
  noQuery(request);
  checkOrigin(request, c.config);
  return Response.json(
    await c.cases.addToWatchlist.execute(await claims(request), await title(context)),
    { status: 201 },
  );
};
export const removeWatchlist: Handler = async (request, context) => {
  const c = container();
  noQuery(request);
  checkOrigin(request, c.config);
  await c.cases.removeFromWatchlist.execute(await claims(request), await title(context));
  return new Response(null, { status: 204 });
};
export const getPreferences: Handler = async (request) => {
  const page = parse(paginationSchema, query(request));
  return Response.json(
    await container().cases.getContentPreferences.execute(
      await claims(request),
      page.page,
      page.limit,
    ),
  );
};
export const setPreference: Handler = async (request, context) => {
  const c = container();
  noQuery(request);
  checkOrigin(request, c.config);
  const identity = await claims(request);
  const id = await title(context);
  const { value } = parse(preferenceSchema, await json(request, c.config.REQUEST_MAX_BYTES));
  return Response.json(await c.cases.setContentPreference.execute(identity, id, value));
};
export const removePreference: Handler = async (request, context) => {
  const c = container();
  noQuery(request);
  checkOrigin(request, c.config);
  await c.cases.removeContentPreference.execute(await claims(request), await title(context));
  return new Response(null, { status: 204 });
};
export const health: Handler = async () => {
  try {
    const c = container();
    await c.pool.query("select 1");
    await c.access.jwks();
    return Response.json({ status: "ok", service: "users-service" });
  } catch {
    throw new UsersError("SERVICE_UNAVAILABLE", 503, "Servicio temporalmente no disponible.");
  }
};
export const jwks: Handler = async (request) => {
  noQuery(request);
  return Response.json(await container().access.jwks());
};
