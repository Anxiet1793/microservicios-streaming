import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { redact, validateRunSummary } from "../api-collection.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const collection = resolve(root, "api/bruno");

test("report sanitizer removes passwords, JWT, refresh tokens and signed URLs in complete output", () => {
  const password = "synthetic-test-password-only";
  const jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJl";
  const opaque = "a".repeat(43);
  const hash = "b".repeat(64);
  const output = redact(
    [
      password,
      `${password}-new`,
      jwt,
      opaque,
      hash,
      "http://localhost:9000/bucket/demo?X-Amz-Signature=abc&X-Amz-Credential=private",
    ].join("\n"),
    [password, `${password}-new`],
  );
  for (const value of [password, jwt, opaque, hash, "X-Amz-", "private"])
    assert.ok(!output.includes(value));
  assert.equal(
    redact("401 UNAUTHORIZED usr_00000000-0000-4000-8000-000000000000"),
    "401 UNAUTHORIZED usr_00000000-0000-4000-8000-000000000000",
  );
});

function passingReport() {
  return [
    {
      results: [{}, {}],
      summary: {
        totalRequests: 2,
        passedRequests: 2,
        failedRequests: 0,
        errorRequests: 0,
        skippedRequests: 0,
        skippedByBail: 0,
        totalTests: 6,
        passedTests: 6,
        failedTests: 0,
        failedAssertions: 0,
        failedPreRequestTests: 0,
        failedPostResponseTests: 0,
      },
    },
  ];
}
test("successful process is insufficient when report has failures, skips or missing assertions", () => {
  assert.equal(validateRunSummary(passingReport(), 2).passedTests, 6);
  for (const key of [
    "failedRequests",
    "errorRequests",
    "skippedRequests",
    "skippedByBail",
    "failedTests",
    "failedAssertions",
    "failedPreRequestTests",
    "failedPostResponseTests",
  ]) {
    const report = passingReport();
    report[0].summary[key] = 1;
    assert.throws(() => validateRunSummary(report, 2));
  }
  const incomplete = passingReport();
  incomplete[0].results.pop();
  assert.throws(() => validateRunSummary(incomplete, 2));
  const noTests = passingReport();
  noTests[0].summary.totalTests = 0;
  noTests[0].summary.passedTests = 0;
  assert.throws(() => validateRunSummary(noTests, 2));
  assert.throws(() => validateRunSummary([], 2));
});

test("demo dependencies run in order and every request file exists", async () => {
  const plan = JSON.parse(await readFile(resolve(collection, "demo-plan.json"), "utf8"));
  const steps = plan.core.map((path) => path.split("/").pop());
  let previous = -1;
  for (const step of [
    "00 ADMIN",
    "01 Upload",
    "01 Bulk",
    "04 Publish",
    "02 Login USER",
    "03 Detail",
    "01 Add",
    "01 LIKE",
    "01 Start",
    "02 Progress",
    "03 Pause",
    "01 Continue",
    "04 Resume",
    "06 Complete",
    "01 History",
  ]) {
    const index = steps.findIndex((name) => name.startsWith(step));
    assert.ok(index > previous, `Out of order or missing: ${step}`);
    previous = index;
  }
  for (const path of new Set([...plan.requests, ...plan.cleanup]))
    await readFile(resolve(collection, path));
  assert.ok(!plan.requests.some((path) => plan.cleanup.includes(path)), "Cleanup is opt-in");
});

test("versioned environments contain empty credentials and scripts never persist captured values", async () => {
  for (const name of ["Root Stack.bru", "Individual Services.bru"]) {
    const env = await readFile(resolve(collection, "environments", name), "utf8");
    for (const key of [
      "adminPassword",
      "userPassword",
      "accessToken",
      "adminAccessToken",
      "tituloId",
      "assetId",
      "sessionId",
    ])
      assert.match(env, new RegExp(`^  ${key}:\\s*$`, "m"));
  }
  for (const folder of await readdir(collection, { withFileTypes: true })) {
    if (!folder.isDirectory() || !/^\d{2} /.test(folder.name)) continue;
    for (const file of await readdir(resolve(collection, folder.name))) {
      const text = await readFile(resolve(collection, folder.name, file), "utf8");
      assert.doesNotMatch(text, /bru\.(?:setEnvVar|setGlobalEnvVar)\s*\(/);
      if (text.includes("body:multipart-form")) assert.match(text, /body: multipartForm/);
    }
  }
});
