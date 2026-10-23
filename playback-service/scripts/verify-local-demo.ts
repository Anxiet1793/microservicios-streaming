import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
// Explicitly development-only: uses seeded accounts and the demo created by prepare-demo.
const env = parseEnv(await readFile("../users-service/.env", "utf8"));
if (env.APP_ENV !== "development" || !env.SEED_PASSWORD)
  throw new Error("Requires local development seed.");
const { tituloId } = JSON.parse(await readFile("docs/demo-local.json", "utf8")) as {
  tituloId: string;
};
const login = await fetch("http://127.0.0.1:3001/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "demo@streaming.local", password: env.SEED_PASSWORD }),
});
assert.equal(login.status, 200);
const auth = await login.json();
assert.equal(auth.user.role, "USER");
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`http://127.0.0.1:3002/api/v1/playback/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert(response.ok, `Local integration HTTP ${response.status}`);
  return response.json();
}
const first = await request("sessions", "POST", { tituloId });
const range = await fetch(first.playback.url, { headers: { Range: "bytes=0-31" } });
assert.equal(range.status, 206);
await range.arrayBuffer();
await request(`sessions/${first.session.sessionId}/progress`, "PATCH", { positionSeconds: 30 });
await request(`sessions/${first.session.sessionId}/pause`, "POST", { positionSeconds: 30 });
const resumed = await request("sessions", "POST", { tituloId });
assert.equal(resumed.session.progress.positionSeconds, 30);
await request(`sessions/${resumed.session.sessionId}/complete`, "POST");
const history = await request("me/history");
assert(
  history.data.some(
    (item: { tituloId: string; completed: boolean }) =>
      item.tituloId === tituloId && item.completed,
  ),
);
// Leave a paused session at 30 s so the user can demonstrate continue-watching.
const demo = await request("sessions", "POST", { tituloId });
await request(`sessions/${demo.session.sessionId}/pause`, "POST", { positionSeconds: 30 });
const continued = await request("me/continue-watching");
assert(
  continued.data.some(
    (item: { tituloId: string; progress: { positionSeconds: number } }) =>
      item.tituloId === tituloId && item.progress.positionSeconds === 30,
  ),
);
console.log(
  JSON.stringify({
    result: "passed",
    checks: [
      "real Users JWT/JWKS",
      "real Catalog HTTP",
      "MP4 Range 206",
      "persisted resume",
      "completion/history",
      "continue watching at 30 seconds",
    ],
    tituloId,
  }),
);
