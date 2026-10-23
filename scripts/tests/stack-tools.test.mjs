import { test } from "node:test";
import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { setupStack } from "../setup-stack.mjs";
import { call, serviceUrls } from "../lib/stack-http.mjs";
import { createServer } from "node:http";

test("setup generates a matching RSA pair and independent secrets without overwriting ENV", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nevaro-setup-test-"));
  try {
    await writeFile(
      join(dir, ".env.example"),
      await readFile(new URL("../../.env.example", import.meta.url)),
    );
    assert.equal(await setupStack(dir), true);
    const env = await readFile(join(dir, ".env"), "utf8");
    const values = Object.fromEntries(
      env
        .split("\n")
        .filter((line) => /^[A-Z_]+=/.test(line))
        .map((line) => {
          const equal = line.indexOf("=");
          return [line.slice(0, equal), line.slice(equal + 1)];
        }),
    );
    assert.ok(/^[a-f0-9]{64}$/.test(values.SESSION_SECRET), "SESSION_SECRET must be 64 hex");
    assert.ok(values.MINIO_SECRET_KEY !== values.SESSION_SECRET, "Secrets must be independent");
    assert.ok(values.SEED_PASSWORD.length >= 12);
    const privateKey = createPrivateKey(JSON.parse(values.JWT_PRIVATE_KEY));
    assert.equal(
      createPublicKey(privateKey).export({ type: "spki", format: "pem" }),
      JSON.parse(values.JWT_PUBLIC_KEY),
    );
    assert.equal(await setupStack(dir), false);
    assert.ok(
      (await readFile(join(dir, ".env"), "utf8")) === env,
      "Existing ENV must remain unchanged",
    );
  } finally {
    const target = resolve(dir);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("nevaro-setup-test-"));
    await rm(target, { recursive: true, force: true });
  }
});
test("service URLs distinguish container DNS from published host ports", () => {
  assert.equal(serviceUrls({ USERS_PORT: "18081" }).users, "http://localhost:18081");
  assert.equal(
    serviceUrls({ USERS_BASE_URL: "http://users-service:3001" }).users,
    "http://users-service:3001",
  );
});
test("account-creating stack tools refuse remote or credentialed destinations", () => {
  for (const base of [
    "https://production.invalid",
    "http://user:password@localhost:8081",
    "file:///tmp/db",
    "http://localhost:8081?secret=x",
  ]) {
    assert.throws(() => serviceUrls({ USERS_BASE_URL: base }));
  }
});
test("HTTP failures do not leak response bodies, request passwords or bearer tokens", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(500);
    res.end("sensitive-upstream-body");
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    await assert.rejects(
      call(base, "/test", {
        token: "sensitive-token",
        method: "POST",
        body: { password: "sensitive-input" },
      }),
      (error) => error.message === "POST /test: HTTP 500",
    );
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});
test("smoke exits nonzero when a required service is unavailable", async () => {
  await assert.rejects(
    promisify(execFile)(process.execPath, ["scripts/smoke-test.mjs"], {
      env: { ...process.env, USERS_BASE_URL: "http://127.0.0.1:1" },
      timeout: 10000,
      windowsHide: true,
    }),
    (error) => error.code === 1 && error.stderr.includes("SMOKE FAILED"),
  );
});
