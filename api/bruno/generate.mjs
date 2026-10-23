import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parse } from "yaml";

const require = createRequire(import.meta.url);
const { bruToJsonV2, collectionBruToJson, bruToEnvJsonV2 } = require("@usebruno/lang");
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const specs = Object.fromEntries(
  await Promise.all(
    ["users", "catalog", "playback"].map(async (key) => [
      key,
      parse(await readFile(resolve(root, `${key}-service/docs/openapi.yaml`), "utf8")),
    ]),
  ),
);
const check = process.argv.includes("--check");
let files = 0;
async function output(file, text) {
  const path = resolve(here, file);
  if (check) {
    if ((await readFile(path, "utf8")) !== text) throw new Error(`Regenerate collection: ${file}`);
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  }
  if (file.endsWith(".bru")) {
    const parser = file.endsWith("collection.bru")
      ? collectionBruToJson
      : file.startsWith("environments/")
        ? bruToEnvJsonV2
        : bruToJsonV2;
    parser(text);
  }
  files++;
}
const indent = (text) =>
  text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
const block = (name, text) => `${name} {\n${indent(text)}\n}\n\n`;
const keywords = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
  "uniqueItems",
  "allOf",
  "oneOf",
  "anyOf",
  "not",
  "minProperties",
  "maxProperties",
  "const",
]);
function schemaFor(service, input) {
  if (Array.isArray(input)) return input.map((value) => schemaFor(service, value));
  if (input === null || typeof input !== "object") return input;
  if (input.$ref) {
    const target = specs[service].components.schemas[input.$ref.split("/").pop()];
    if (!target) throw new Error(`Missing schema: ${service} ${input.$ref}`);
    return schemaFor(service, target);
  }
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (!keywords.has(key)) continue;
    if (key === "properties")
      out.properties = Object.fromEntries(
        Object.entries(value).map(([name, item]) => [name, schemaFor(service, item)]),
      );
    else out[key] = schemaFor(service, value);
  }
  for (const [exclusive, bound] of [
    ["exclusiveMinimum", "minimum"],
    ["exclusiveMaximum", "maximum"],
  ]) {
    if (input[exclusive] === true) {
      out[exclusive] = input[bound];
      delete out[bound];
    } else if (typeof input[exclusive] === "number") out[exclusive] = input[exclusive];
  }
  return input.nullable ? { anyOf: [out, { type: "null" }] } : out;
}
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const cookieCapture = (key) =>
  `const rawCookie = res.getHeader("set-cookie");\nconst cookies = Array.isArray(rawCookie) ? rawCookie : [rawCookie];\nconst cookie = cookies.find(value => typeof value === "string" && value.startsWith("users_refresh="));\nif (!cookie) throw new Error("Missing HttpOnly refresh cookie");\nbru.setVar("${key}", cookie.split(";")[0]);`;
const captureUser = `const body = res.getBody();\nif (res.getStatus() === 200) {\n  bru.setVar("accessToken", body.accessToken);\n  bru.setVar("userId", body.user.userId);\n  ${cookieCapture("refreshCookie")}\n}`;
const initialize = `const runId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);\nbru.setVar("runId", runId);\nbru.setVar("userEmail", "bruno-" + runId + "@example.test");\nbru.setVar("titleName", "Bruno Demo " + runId);\nbru.setVar("importKey", "bruno:" + runId);\nconst initialPassword = bru.getProcessEnv("NEVARO_API_USER_PASSWORD") || bru.getEnvVar("userPassword");\nif (!initialPassword) throw new Error("Run api:setup or use the API demo wrapper first");\nbru.setVar("userPassword", initialPassword);\nbru.setVar("newPassword", initialPassword + "-new");`;
const requests = [];
function add(key, folder, name, service, method, path, status, schema, options = {}) {
  requests.push({ key, folder, name, service, method, path, status, schema, ...options });
}
const U = "users",
  C = "catalog",
  P = "playback";
for (const [service, seq] of [
  [U, 1],
  [C, 2],
  [P, 3],
])
  add(
    `health-${service}`,
    "00 Health",
    `${seq} ${service} health`,
    service,
    "GET",
    "/api/health",
    200,
    service === C
      ? specs.catalog.paths["/api/health"].get.responses["200"].content["application/json"].schema
      : "Health",
    {
      extra: `expect(res.getBody().status).to.equal("ok");\nexpect(res.getBody().service).to.equal("${service}-service");`,
    },
  );
add("jwks", "00 Health", "4 Users JWKS", U, "GET", "/.well-known/jwks.json", 200, "JWKS", {
  extra: `expect(res.getBody().keys.length).to.be.greaterThan(0);\nexpect(res.getBody().keys.every(key => key.alg === "RS256" && !key.d && !key.p && !key.q)).to.equal(true);`,
});
add(
  "register",
  "01 Auth",
  "01 Register",
  U,
  "POST",
  "/api/v1/auth/register",
  201,
  "RegisterOutput",
  {
    pre: `if (!bru.hasVar("runId")) {\n${initialize}\n}`,
    body: { email: "{{userEmail}}", password: "{{userPassword}}", displayName: "Bruno QA" },
    post: `if (res.getStatus() === 201) bru.setVar("userId", res.getBody().user.userId);`,
    extra: `expect(res.getBody().user.role).to.equal("USER");`,
  },
);
add("login", "01 Auth", "02 Login USER", U, "POST", "/api/v1/auth/login", 200, "Session", {
  body: { email: "{{userEmail}}", password: "{{userPassword}}" },
  post: captureUser,
  extra: `expect(res.getBody().user.role).to.equal("USER");\nexpect(res.getBody().user.userId).to.equal(bru.getVar("userId"));`,
});
add(
  "admin-login",
  "01 Auth",
  "03 Login ADMIN and new run",
  U,
  "POST",
  "/api/v1/auth/login",
  200,
  "Session",
  {
    pre: `for (const key of ["accessToken", "adminAccessToken", "refreshCookie", "adminRefreshCookie", "tituloId", "assetId", "sessionId", "userId"]) bru.deleteVar(key);\n${initialize}`,
    body: { email: "{{adminEmail}}", password: "{{adminPassword}}" },
    post: `if (res.getStatus() === 200) {\nbru.setVar("adminAccessToken", res.getBody().accessToken);\n${cookieCapture("adminRefreshCookie")}\n}`,
    extra: `expect(res.getBody().user.role).to.equal("ADMIN");`,
  },
);
add("refresh", "01 Auth", "04 Refresh USER", U, "POST", "/api/v1/auth/refresh", 200, "Session", {
  headers: { Cookie: "{{refreshCookie}}", "X-CSRF-Protection": "1" },
  pre: `if (!bru.getVar("refreshCookie")) throw new Error("Login USER first");\nbru.setVar("previousRefreshCookie", bru.getVar("refreshCookie"));`,
  post: captureUser,
  extra: `expect(bru.getVar("previousRefreshCookie") !== bru.getVar("refreshCookie")).to.equal(true);\nexpect(res.getHeader("set-cookie").toString().includes("HttpOnly")).to.equal(true);`,
});
add("logout", "01 Auth", "05 Logout USER", U, "POST", "/api/v1/auth/logout", 204, null, {
  headers: { Cookie: "{{refreshCookie}}", "X-CSRF-Protection": "1" },
  post: `if (res.getStatus() === 204) bru.setVar("accessToken", "");`,
});
add("admin-logout", "01 Auth", "06 Logout ADMIN", U, "POST", "/api/v1/auth/logout", 204, null, {
  headers: { Cookie: "{{adminRefreshCookie}}", "X-CSRF-Protection": "1" },
  post: `if (res.getStatus() === 204) bru.setVar("adminAccessToken", "");`,
});
add(
  "invalid-login",
  "01 Auth",
  "07 Invalid login 401",
  U,
  "POST",
  "/api/v1/auth/login",
  401,
  "Error",
  { body: { email: "{{userEmail}}", password: "{{newPassword}}" }, error: "INVALID_CREDENTIALS" },
);
add(
  "refresh-revoked",
  "01 Auth",
  "08 Revoked refresh 401",
  U,
  "POST",
  "/api/v1/auth/refresh",
  401,
  "Error",
  { headers: { Cookie: "{{refreshCookie}}", "X-CSRF-Protection": "1" }, error: "UNAUTHORIZED" },
);
add(
  "duplicate-email",
  "01 Auth",
  "09 Duplicate email 409",
  U,
  "POST",
  "/api/v1/auth/register",
  409,
  "Error",
  {
    body: { email: "{{userEmail}}", password: "{{userPassword}}", displayName: "Bruno QA" },
    error: "EMAIL_ALREADY_EXISTS",
  },
);
add(
  "refresh-csrf",
  "01 Auth",
  "10 Refresh without CSRF 403",
  U,
  "POST",
  "/api/v1/auth/refresh",
  403,
  "Error",
  { headers: { Cookie: "{{refreshCookie}}" }, error: "FORBIDDEN" },
);
add("me", "02 User", "01 Me", U, "GET", "/api/v1/users/me", 200, "User", {
  auth: "accessToken",
  extra: `expect(res.getBody().userId).to.equal(bru.getVar("userId"));`,
});
add("update-profile", "02 User", "02 Update profile", U, "PATCH", "/api/v1/users/me", 200, "User", {
  auth: "accessToken",
  body: { displayName: "Bruno QA actualizado", avatarUrl: null, preferredLanguage: "es" },
  extra: `expect(res.getBody().profile.displayName).to.equal("Bruno QA actualizado");`,
});
add(
  "change-password",
  "02 User",
  "03 Change password own test account",
  U,
  "POST",
  "/api/v1/users/me/change-password",
  204,
  null,
  {
    auth: "accessToken",
    body: { currentPassword: "{{userPassword}}", newPassword: "{{newPassword}}" },
    post: `if (res.getStatus() === 204) { bru.setVar("userPassword", bru.getVar("newPassword")); bru.setVar("accessToken", ""); }`,
  },
);
add("anonymous-me", "02 User", "04 Anonymous me 401", U, "GET", "/api/v1/users/me", 401, "Error", {
  error: "UNAUTHORIZED",
});
add(
  "protected-profile",
  "02 User",
  "05 Cannot assign ADMIN 400",
  U,
  "PATCH",
  "/api/v1/users/me",
  400,
  "Error",
  { auth: "accessToken", body: { role: "ADMIN" }, error: "VALIDATION_ERROR" },
);
add(
  "watchlist-add",
  "03 Watchlist",
  "01 Add title",
  U,
  "POST",
  "/api/v1/users/me/watchlist/{{tituloId}}",
  201,
  "WatchlistItem",
  {
    auth: "accessToken",
    extra: `expect(res.getBody().tituloId).to.equal(bru.getVar("tituloId"));`,
  },
);
add(
  "watchlist-list",
  "03 Watchlist",
  "02 List",
  U,
  "GET",
  "/api/v1/users/me/watchlist?page=1&limit=100",
  200,
  "Watchlist",
  {
    auth: "accessToken",
    extra: `expect(res.getBody().items.some(item => item.tituloId === bru.getVar("tituloId"))).to.equal(true);`,
  },
);
add(
  "watchlist-duplicate",
  "03 Watchlist",
  "03 Duplicate title 409",
  U,
  "POST",
  "/api/v1/users/me/watchlist/{{tituloId}}",
  409,
  "Error",
  { auth: "accessToken", error: "WATCHLIST_ITEM_ALREADY_EXISTS" },
);
add(
  "watchlist-delete",
  "03 Watchlist",
  "04 Remove title",
  U,
  "DELETE",
  "/api/v1/users/me/watchlist/{{tituloId}}",
  204,
  null,
  { auth: "accessToken" },
);
for (const [key, value, name] of [
  ["like", "LIKE", "01 LIKE"],
  ["dislike", "DISLIKE", "02 DISLIKE"],
  ["like-again", "LIKE", "03 Change back to LIKE"],
])
  add(
    key,
    "04 Preferences",
    name,
    U,
    "PUT",
    "/api/v1/users/me/preferences/{{tituloId}}",
    200,
    "ContentPreference",
    {
      auth: "accessToken",
      body: { value },
      extra: `expect(res.getBody().tituloId).to.equal(bru.getVar("tituloId"));\nexpect(res.getBody().value).to.equal("${value}");`,
    },
  );
add(
  "preferences-list",
  "04 Preferences",
  "04 List",
  U,
  "GET",
  "/api/v1/users/me/preferences?page=1&limit=100",
  200,
  "Preferences",
  {
    auth: "accessToken",
    extra: `expect(res.getBody().items.some(item => item.tituloId === bru.getVar("tituloId") && item.value === "LIKE")).to.equal(true);`,
  },
);
add(
  "preferences-delete",
  "04 Preferences",
  "05 Remove preference",
  U,
  "DELETE",
  "/api/v1/users/me/preferences/{{tituloId}}",
  204,
  null,
  { auth: "accessToken" },
);
add(
  "preferences-invalid",
  "04 Preferences",
  "06 Invalid preference 400",
  U,
  "PUT",
  "/api/v1/users/me/preferences/{{tituloId}}",
  400,
  "Error",
  { auth: "accessToken", body: { value: "LOVE" }, error: "VALIDATION_ERROR" },
);
add(
  "catalog-list",
  "05 Catalog",
  "01 List published movies",
  C,
  "GET",
  "/api/v1/catalog?status=2&type=1&limit=100&page=1",
  200,
  "CatalogPage",
);
add(
  "catalog-search",
  "05 Catalog",
  "02 Search and filters",
  C,
  "GET",
  "/api/v1/catalog?status=2&type=1&genre=10&year=2026&q=Bruno&limit=100",
  200,
  "CatalogPage",
);
add(
  "detail",
  "05 Catalog",
  "03 Detail",
  C,
  "GET",
  "/api/v1/catalog/{{tituloId}}",
  200,
  "CatalogTitle",
  {
    extra: `expect(res.getBody().tituloId).to.equal(bru.getVar("tituloId"));\nexpect(res.getBody().publicationStatusId).to.equal(2);\nexpect(res.getBody().playbackReference.assetId).to.equal(bru.getVar("assetId"));`,
  },
);
add(
  "missing-title",
  "05 Catalog",
  "04 Missing title 404",
  C,
  "GET",
  "/api/v1/catalog/ttl_00000000-0000-4000-8000-000000000000",
  404,
  "ErrorResponse",
  { error: "CATALOG_TITLE_NOT_FOUND" },
);
add(
  "nosql-rejected",
  "05 Catalog",
  "05 NoSQL operator rejected 400",
  C,
  "GET",
  "/api/v1/catalog?genre%5B%24ne%5D=1",
  400,
  "ErrorResponse",
  { error: "VALIDATION_ERROR" },
);
const createBody = {
  items: [
    {
      importKey: "{{importKey}}",
      typeId: 1,
      ficha: {
        title: "{{titleName}}",
        synopsis: "MP4 sintético de doce segundos creado para la colección Bruno.",
        releaseYear: 2026,
        durationMinutes: 1,
        genres: [10],
        languages: [1],
      },
      playbackReference: {
        providerId: 1,
        assetId: "{{assetId}}",
        manifestKey: "asset:{{assetId}}",
      },
    },
  ],
};
add(
  "import",
  "06 Admin Catalog",
  "01 Bulk create own title",
  C,
  "POST",
  "/api/v1/catalog/bulk",
  201,
  "BulkOutput",
  {
    auth: "adminAccessToken",
    body: createBody,
    post: `if (res.getStatus() === 201) { const id = res.getBody().results[0].tituloId; if (id) bru.setVar("tituloId", id); }`,
    extra: `expect(res.getBody().summary.inserted).to.equal(1);\nexpect(res.getBody().results[0].tituloId).to.match(/^ttl_[0-9a-f-]{36}$/);`,
  },
);
add(
  "import-retry",
  "06 Admin Catalog",
  "02 Retry import idempotently",
  C,
  "POST",
  "/api/v1/catalog/bulk",
  200,
  "BulkOutput",
  {
    auth: "adminAccessToken",
    body: createBody,
    extra: `expect(res.getBody().summary.duplicates).to.equal(1);\nexpect(res.getBody().results[0].tituloId).to.equal(bru.getVar("tituloId"));`,
  },
);
add(
  "edit-title",
  "06 Admin Catalog",
  "03 Update editorial data",
  C,
  "PATCH",
  "/api/v1/catalog/{{tituloId}}",
  200,
  "CatalogTitle",
  {
    auth: "adminAccessToken",
    body: { ficha: { title: "{{titleName}}", director: "Bruno QA" } },
    extra: `expect(res.getBody().ficha.director).to.equal("Bruno QA");`,
  },
);
add(
  "publish",
  "06 Admin Catalog",
  "04 Publish",
  C,
  "PATCH",
  "/api/v1/catalog/{{tituloId}}/publication-status",
  200,
  "CatalogTitle",
  {
    auth: "adminAccessToken",
    body: { publicationStatusId: 2 },
    extra: `expect(res.getBody().publicationStatusId).to.equal(2);`,
  },
);
add(
  "withdraw",
  "06 Admin Catalog",
  "05 Withdraw own title",
  C,
  "PATCH",
  "/api/v1/catalog/{{tituloId}}/publication-status",
  200,
  "CatalogTitle",
  {
    auth: "adminAccessToken",
    body: { publicationStatusId: 3 },
    extra: `expect(res.getBody().publicationStatusId).to.equal(3);`,
  },
);
add(
  "catalog-user-denied",
  "06 Admin Catalog",
  "06 USER cannot edit 403",
  C,
  "PATCH",
  "/api/v1/catalog/{{tituloId}}",
  403,
  "ErrorResponse",
  { auth: "accessToken", body: { ficha: { title: "Forbidden" } }, error: "FORBIDDEN" },
);
add(
  "catalog-anonymous-denied",
  "06 Admin Catalog",
  "07 Anonymous cannot import 401",
  C,
  "POST",
  "/api/v1/catalog/bulk",
  401,
  "ErrorResponse",
  { body: { items: [] }, error: "UNAUTHORIZED" },
);
add(
  "upload",
  "07 Media Assets",
  "01 Upload MP4",
  P,
  "POST",
  "/api/v1/media/assets",
  201,
  {
    type: "object",
    required: ["asset"],
    additionalProperties: false,
    properties: { asset: ref("Asset") },
  },
  {
    auth: "adminAccessToken",
    file: "fixtures/demo.mp4",
    post: `if (res.getStatus() === 201) bru.setVar("assetId", res.getBody().asset.assetId);`,
    extra: `expect(res.getBody().asset.status).to.equal("READY");\nexpect(res.getBody().asset.sizeBytes).to.be.lessThan(1048576);\nexpect(res.getBody().asset.durationSeconds).to.be.greaterThan(10);`,
  },
);
add(
  "asset",
  "07 Media Assets",
  "02 Asset metadata",
  P,
  "GET",
  "/api/v1/media/assets/{{assetId}}",
  200,
  { type: "object", required: ["asset"], properties: { asset: ref("Asset") } },
  {
    auth: "adminAccessToken",
    extra: `expect(res.getBody().asset.assetId).to.equal(bru.getVar("assetId"));`,
  },
);
add(
  "asset-delete",
  "07 Media Assets",
  "03 Delete completed own asset",
  P,
  "DELETE",
  "/api/v1/media/assets/{{assetId}}",
  204,
  null,
  {
    auth: "adminAccessToken",
    docs: "Destructivo para el asset actual. Completar sesiones y retirar título primero. No forma parte del demo predeterminado.",
  },
);
add(
  "asset-in-use",
  "07 Media Assets",
  "04 Cannot delete active asset 409",
  P,
  "DELETE",
  "/api/v1/media/assets/{{assetId}}",
  409,
  "Error",
  { auth: "adminAccessToken", error: "MEDIA_ASSET_IN_USE" },
);
add(
  "mime-spoof",
  "07 Media Assets",
  "05 MIME spoofing rejected 415",
  P,
  "POST",
  "/api/v1/media/assets",
  415,
  "Error",
  { auth: "adminAccessToken", file: "fixtures/not-video.mp4", error: "UNSUPPORTED_MEDIA_TYPE" },
);
add(
  "asset-user-denied",
  "07 Media Assets",
  "06 USER cannot read asset metadata 403",
  P,
  "GET",
  "/api/v1/media/assets/{{assetId}}",
  403,
  "Error",
  { auth: "accessToken", error: "FORBIDDEN" },
);
add(
  "start",
  "08 Playback",
  "01 Start playback",
  P,
  "POST",
  "/api/v1/playback/sessions",
  201,
  "PlaybackResponse",
  {
    auth: "accessToken",
    body: { tituloId: "{{tituloId}}" },
    post: `if (res.getStatus() === 201) bru.setVar("sessionId", res.getBody().session.sessionId);`,
    extra: `expect(res.getBody().session.tituloId).to.equal(bru.getVar("tituloId"));\nexpect(res.getBody().session.assetId).to.equal(bru.getVar("assetId"));\nexpect(res.getBody().session.status).to.equal("ACTIVE");`,
  },
);
add(
  "progress",
  "08 Playback",
  "02 Progress",
  P,
  "PATCH",
  "/api/v1/playback/sessions/{{sessionId}}/progress",
  200,
  "SessionResponse",
  {
    auth: "accessToken",
    body: { positionSeconds: 3 },
    extra: `expect(res.getBody().session.progress.positionSeconds).to.equal(3);\nexpect(res.getBody().session.progress.percentage).to.be.greaterThan(0);`,
  },
);
add(
  "pause",
  "08 Playback",
  "03 Pause",
  P,
  "POST",
  "/api/v1/playback/sessions/{{sessionId}}/pause",
  200,
  "SessionResponse",
  {
    auth: "accessToken",
    body: { positionSeconds: 3 },
    extra: `expect(res.getBody().session.status).to.equal("PAUSED");`,
  },
);
add(
  "resume",
  "08 Playback",
  "04 Resume",
  P,
  "POST",
  "/api/v1/playback/sessions/{{sessionId}}/resume",
  200,
  "PlaybackResponse",
  {
    auth: "accessToken",
    body: {},
    extra: `expect(res.getBody().session.status).to.equal("ACTIVE");\nexpect(res.getBody().session.progress.positionSeconds).to.equal(3);`,
  },
);
add(
  "renew-url",
  "08 Playback",
  "05 Refresh URL",
  P,
  "POST",
  "/api/v1/playback/sessions/{{sessionId}}/refresh-url",
  200,
  {
    type: "object",
    required: ["playback"],
    additionalProperties: false,
    properties: { playback: ref("PlaybackUrl") },
  },
  { auth: "accessToken", body: {} },
);
add(
  "complete",
  "08 Playback",
  "06 Complete",
  P,
  "POST",
  "/api/v1/playback/sessions/{{sessionId}}/complete",
  200,
  "SessionResponse",
  {
    auth: "accessToken",
    body: {},
    extra: `expect(res.getBody().session.status).to.equal("COMPLETED");\nexpect(res.getBody().session.progress.percentage).to.equal(100);\nexpect(res.getBody().session.completedAt).to.be.a("string");`,
  },
);
add(
  "bad-progress",
  "08 Playback",
  "07 Negative progress 400",
  P,
  "PATCH",
  "/api/v1/playback/sessions/{{sessionId}}/progress",
  400,
  "Error",
  { auth: "accessToken", body: { positionSeconds: -1 }, error: "VALIDATION_ERROR" },
);
add(
  "playback-anonymous",
  "08 Playback",
  "08 Anonymous history 401",
  P,
  "GET",
  "/api/v1/playback/me/history",
  401,
  "Error",
  { error: "UNAUTHORIZED" },
);
add(
  "continue",
  "09 Continue Watching",
  "01 Continue watching",
  P,
  "GET",
  "/api/v1/playback/me/continue-watching?page=1&limit=100",
  200,
  "ContinuePage",
  {
    auth: "accessToken",
    extra: `const item = res.getBody().data.find(item => item.tituloId === bru.getVar("tituloId"));\nexpect(Boolean(item)).to.equal(true);\nexpect(item.progress.positionSeconds).to.equal(3);`,
  },
);
add(
  "continue-completed",
  "09 Continue Watching",
  "02 Completed title is excluded",
  P,
  "GET",
  "/api/v1/playback/me/continue-watching?page=1&limit=100",
  200,
  "ContinuePage",
  {
    auth: "accessToken",
    extra: `expect(res.getBody().data.some(item => item.tituloId === bru.getVar("tituloId"))).to.equal(false);`,
  },
);
add(
  "history",
  "10 History",
  "01 History completed",
  P,
  "GET",
  "/api/v1/playback/me/history?page=1&limit=100",
  200,
  "HistoryPage",
  {
    auth: "accessToken",
    extra: `expect(res.getBody().data.some(item => item.tituloId === bru.getVar("tituloId") && item.completed === true)).to.equal(true);`,
  },
);

const adminStart = requests.find((item) => item.key === "admin-login");
adminStart.key = "admin-start";
adminStart.name = "00 ADMIN begin new demo run";
add(
  "admin-login",
  "01 Auth",
  "03 Login ADMIN keep captured IDs",
  U,
  "POST",
  "/api/v1/auth/login",
  200,
  "Session",
  {
    pre: `if (!bru.hasVar("runId")) {\n${initialize}\n}`,
    body: adminStart.body,
    post: adminStart.post,
    extra: adminStart.extra,
  },
);

const paths = {};
const baseVars = { users: "usersBaseUrl", catalog: "catalogBaseUrl", playback: "playbackBaseUrl" };
const folderSeq = [...new Set(requests.map((item) => item.folder))];
for (const [index, folder] of folderSeq.entries())
  await output(`${folder}/folder.bru`, block("meta", `name: ${folder}\nseq: ${index + 1}`));
for (const item of requests) {
  const filename = `${item.folder}/${item.name}.bru`;
  paths[item.key] = filename;
  const tests = [
    `test("HTTP ${item.status}", function () { expect(res.getStatus()).to.equal(${item.status}); });`,
  ];
  if (item.schema) {
    const schema = schemaFor(
      item.service,
      typeof item.schema === "string" ? ref(item.schema) : item.schema,
    );
    tests.push(
      `test("Response JSON Schema from OpenAPI", function () {\n  const schema = ${JSON.stringify(schema, null, 2)};\n  expect(res.getBody()).to.have.jsonSchema(schema);\n});`,
    );
  } else
    tests.push(`test("Empty response", function () { expect(!res.getBody()).to.equal(true); });`);
  tests.push(
    `test("No database or password fields", function () {\n  const visit = value => value && typeof value === "object" && Object.entries(value).some(([key, child]) => ["password", "passwordHash", "password_hash", "tokenHash", "_id"].includes(key) || visit(child));\n  expect(Boolean(visit(res.getBody()))).to.equal(false);\n});`,
  );
  if (item.error)
    tests.push(
      `test("Error code ${item.error}", function () { expect(res.getBody().error.code).to.equal("${item.error}"); });`,
    );
  if (item.extra)
    tests.push(
      block('test("Required fields and behavior", function ()', item.extra).replace(
        /\n}\n\n$/,
        "\n});",
      ),
    );
  let text = block(
    "meta",
    `name: ${item.name}\ntype: http\nseq: ${requests.filter((r) => r.folder === item.folder).indexOf(item) + 1}`,
  );
  text += block(
    item.method.toLowerCase(),
    `url: {{${baseVars[item.service]}}}${item.path}\nbody: ${item.file ? "multipartForm" : item.body ? "json" : "none"}\nauth: none`,
  );
  const headers = {
    ...(item.auth ? { Authorization: `Bearer {{${item.auth}}}` } : {}),
    ...(item.body ? { "Content-Type": "application/json" } : {}),
    ...item.headers,
  };
  if (Object.keys(headers).length)
    text += block(
      "headers",
      Object.entries(headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n"),
    );
  if (item.body) text += block("body:json", JSON.stringify(item.body, null, 2));
  if (item.file)
    text += block("body:multipart-form", `file: @file(${item.file}) @contentType(video/mp4)`);
  const pre = [
    item.auth
      ? `if (!(bru.getVar("${item.auth}") || bru.getEnvVar("${item.auth}"))) throw new Error("Login ${item.auth === "adminAccessToken" ? "ADMIN" : "USER"} first");`
      : "",
    item.pre || "",
  ]
    .filter(Boolean)
    .join("\n");
  if (pre) text += block("script:pre-request", pre);
  if (item.post) text += block("script:post-response", item.post);
  text += block("tests", tests.join("\n\n"));
  text += block(
    "docs",
    item.docs ||
      `Servicio: ${item.service}. Variables e IDs capturados en memoria. Ejecutar el plan demo para preparar las dependencias de esta petición.`,
  );
  await output(filename, text);
}
for (const folder of folderSeq) {
  const expectedFiles = new Set([
    "folder.bru",
    ...requests.filter((item) => item.folder === folder).map((item) => `${item.name}.bru`),
  ]);
  const unexpected = (await readdir(resolve(here, folder))).filter(
    (file) => file.endsWith(".bru") && !expectedFiles.has(file),
  );
  if (unexpected.length)
    throw new Error(`Unexpected request files in ${folder}: ${unexpected.join(", ")}`);
}
const core = [
  "admin-start",
  "upload",
  "asset",
  "import",
  "import-retry",
  "edit-title",
  "publish",
  "register",
  "login",
  "detail",
  "watchlist-add",
  "watchlist-list",
  "like",
  "preferences-list",
  "start",
  "progress",
  "pause",
  "continue",
  "resume",
  "renew-url",
  "complete",
  "continue-completed",
  "history",
];
const demo = ["health-users", "health-catalog", "health-playback", "jwks", ...core];
// Regression checks run only against the account and content created by this run.
demo.splice(demo.indexOf("like"), 0, "watchlist-duplicate");
demo.splice(demo.indexOf("preferences-list"), 0, "dislike", "like-again", "preferences-invalid");
demo.splice(demo.indexOf("resume"), 0, "asset-in-use", "bad-progress");
demo.push(
  "catalog-list",
  "catalog-search",
  "me",
  "update-profile",
  "protected-profile",
  "anonymous-me",
  "duplicate-email",
  "invalid-login",
  "refresh-csrf",
  "catalog-user-denied",
  "catalog-anonymous-denied",
  "asset-user-denied",
  "mime-spoof",
  "missing-title",
  "nosql-rejected",
  "playback-anonymous",
  "refresh",
  "change-password",
  "login",
  "watchlist-delete",
  "preferences-delete",
  "logout",
  "refresh-revoked",
  "admin-logout",
);
await output(
  "demo-plan.json",
  JSON.stringify(
    {
      description: "Ordered Bruno requests; no duplicate .bru files or parallel requests",
      core: core.map((key) => paths[key]),
      requests: demo.map((key) => paths[key]),
      cleanup: [paths.withdraw, paths["asset-delete"]],
    },
    null,
    2,
  ) + "\n",
);
const expected = Object.entries(specs).flatMap(([service, spec]) =>
  Object.entries(spec.paths).flatMap(([path, verbs]) =>
    Object.keys(verbs)
      .filter((method) => ["get", "post", "put", "patch", "delete"].includes(method))
      .map((method) => `${service} ${method.toUpperCase()} ${path}`),
  ),
);
const actual = new Set(
  requests.map(
    (item) =>
      `${item.service} ${item.method} ${item.path.split("?")[0].replace(/\{\{(\w+)\}\}/g, "{$1}")}`,
  ),
);
const missing = expected.filter((endpoint) => !actual.has(endpoint));
if (missing.length) throw new Error(`Missing endpoints: ${missing.join(", ")}`);
await output(
  "endpoint-coverage.json",
  JSON.stringify(
    {
      endpoints: expected.sort(),
      covered: expected.length,
      requests: requests.length,
      demoRequests: demo.length,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${check ? "Checked" : "Generated"} ${files} files; ${expected.length} endpoints; ${demo.length} demo requests`,
);
