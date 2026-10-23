import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { serviceUrls } from "./lib/stack-http.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const collection = join(root, "api/bruno");
const runtimeRoot = join(collection, ".runtime");
const mode = process.argv[2] || "demo";
export function redact(text, secrets = []) {
  for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length))
    text = text.split(secret).join("[REDACTED]");
  return text
    .replace(/https?:[^\s"<>]*X-Amz-Signature[^\s"<>]*/gi, "[SIGNED_URL_REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[JWT_REDACTED]")
    .replace(/\b[A-Fa-f0-9]{64}\b/g, "[HASH_OR_TOKEN_REDACTED]")
    .replace(/\b[A-Za-z0-9_-]{43}\b/g, "[OPAQUE_TOKEN_REDACTED]");
}
export function validateRunSummary(report, expectedRequests) {
  if (!Array.isArray(report) || report.length !== 1)
    throw new Error("Expected exactly one Bruno iteration");
  const { summary, results } = report[0];
  if (
    !summary ||
    !Array.isArray(results) ||
    results.length !== expectedRequests ||
    summary.totalRequests !== expectedRequests ||
    summary.passedRequests !== expectedRequests ||
    !Number.isInteger(summary.totalTests) ||
    summary.totalTests < expectedRequests * 3 ||
    summary.passedTests !== summary.totalTests ||
    [
      "failedRequests",
      "errorRequests",
      "skippedRequests",
      "skippedByBail",
      "failedTests",
      "failedAssertions",
      "failedPreRequestTests",
      "failedPostResponseTests",
    ].some((key) => summary[key] !== 0)
  ) {
    throw new Error("Incomplete or failed Bruno report");
  }
  return summary;
}
async function localConfig(needPassword) {
  let config = {};
  try {
    config = parseEnv(await readFile(join(root, ".env"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error("Invalid root ENV");
  }
  const urls = serviceUrls({
    ...config,
    USERS_BASE_URL: process.env.NEVARO_API_USERS_URL,
    CATALOG_BASE_URL: process.env.NEVARO_API_CATALOG_URL,
    PLAYBACK_BASE_URL: process.env.NEVARO_API_PLAYBACK_URL,
  });
  const adminPassword = process.env.NEVARO_API_ADMIN_PASSWORD || config.SEED_PASSWORD;
  if (needPassword && (!adminPassword || /REEMPLAZAR|replace|placeholder/i.test(adminPassword)))
    throw new Error(
      "Configure the local stack first: npm run stack:up (SEED_PASSWORD in root ENV)",
    );
  return { urls, adminPassword, userPassword: `API-${randomBytes(24).toString("hex")}` };
}
async function run() {
  if (!["demo", "demo-cleanup", "health", "setup"].includes(mode))
    throw new Error("API collection command: demo, demo-cleanup, health or setup");
  const config = await localConfig(mode !== "health");
  if (mode === "setup") {
    const text = `vars {\n  usersBaseUrl: ${config.urls.users}\n  catalogBaseUrl: ${config.urls.catalog}\n  playbackBaseUrl: ${config.urls.playback}\n  adminEmail: admin@streaming.local\n  adminPassword: ${config.adminPassword}\n  userPassword: ${config.userPassword}\n  accessToken:\n  adminAccessToken:\n  tituloId:\n  assetId:\n  sessionId:\n}\n`;
    try {
      await writeFile(join(collection, "environments/Local.bru"), text, {
        flag: "wx",
        mode: 0o600,
      });
      console.log("Created ignored api/bruno/environments/Local.bru for the Bruno app.");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      console.log("Local.bru already exists; credentials preserved.");
    }
    return;
  }
  const cli = join(collection, "node_modules/@usebruno/cli/bin/bru.js");
  try {
    await readFile(cli);
  } catch {
    throw new Error("Install the pinned CLI first: npm run api:install");
  }
  const plan = JSON.parse(await readFile(join(collection, "demo-plan.json"), "utf8"));
  const paths = mode === "health" ? ["00 Health"] : [...plan.requests];
  if (mode === "demo-cleanup") paths.splice(paths.length - 1, 0, ...plan.cleanup);
  const environment = join(collection, "environments/Root Stack.bru");
  const before = await readFile(environment);
  await mkdir(runtimeRoot, { recursive: true, mode: 0o700 });
  await mkdir(join(collection, "reports"), { recursive: true });
  const temporary = await mkdtemp(join(runtimeRoot, "run-"));
  const rawJson = join(temporary, "raw.json"),
    rawJunit = join(temporary, "raw.xml");
  // No credentials in arguments, persisted Bruno variables or reporter bodies/headers.
  const safeEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      [
        "PATH",
        "Path",
        "SystemRoot",
        "SYSTEMROOT",
        "WINDIR",
        "HOME",
        "USERPROFILE",
        "APPDATA",
        "LOCALAPPDATA",
        "TEMP",
        "TMP",
        "TMPDIR",
        "CI",
      ].includes(key),
    ),
  );
  Object.assign(safeEnv, {
    NEVARO_API_USERS_URL: config.urls.users,
    NEVARO_API_CATALOG_URL: config.urls.catalog,
    NEVARO_API_PLAYBACK_URL: config.urls.playback,
    NEVARO_API_ADMIN_PASSWORD: config.adminPassword || "",
    NEVARO_API_USER_PASSWORD: config.userPassword,
    NO_COLOR: "1",
  });
  const secrets = [config.adminPassword, config.userPassword, `${config.userPassword}-new`];
  try {
    const args = [
      cli,
      "run",
      ...paths,
      "--env",
      "Root Stack",
      "--sandbox",
      "safe",
      "--disable-cookies",
      "--noproxy",
      "--bail",
      "--reporter-json",
      rawJson,
      "--reporter-junit",
      rawJunit,
      "--reporter-skip-body",
      "--reporter-skip-all-headers",
    ];
    const result = await new Promise((done, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: collection,
        env: safeEnv,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      const append = (chunk) => {
        output += chunk.toString();
      };
      child.stdout.on("data", append);
      child.stderr.on("data", append);
      child.once("error", reject);
      child.once("exit", (code) => done({ code: code ?? 1, output: redact(output, secrets) }));
    });
    await writeFile(join(collection, `reports/${mode}-output.log`), result.output, { mode: 0o600 });
    // Print only already-sanitized diagnostics; raw transient reports are removed below.
    console.log(result.output);
    for (const [source, target] of [
      [rawJson, `${mode}-results.json`],
      [rawJunit, `${mode}-junit.xml`],
    ]) {
      try {
        await writeFile(
          join(collection, "reports", target),
          redact(await readFile(source, "utf8"), secrets),
          { mode: 0o600 },
        );
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    if (!(await readFile(environment)).equals(before))
      throw new Error("Bruno modified a versioned environment; inspect before committing");
    if (result.code !== 0) {
      process.exitCode = result.code;
      return;
    }
    const summary = validateRunSummary(
      JSON.parse(await readFile(rawJson, "utf8")),
      mode === "health" ? 4 : paths.length,
    );
    await writeFile(
      join(collection, `reports/${mode}-summary.json`),
      JSON.stringify({ executedAt: new Date().toISOString(), mode, ...summary }, null, 2) + "\n",
    );
    console.log(`Bruno ${mode} passed. Sanitized reports: api/bruno/reports/`);
  } finally {
    const target = resolve(temporary);
    if (dirname(target) !== resolve(runtimeRoot) || !basename(target).startsWith("run-"))
      throw new Error("Unsafe temporary path");
    await rm(target, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(() => {
    console.error(
      "API collection failed. Check the local stack, pinned CLI and sanitized reports; no credentials were logged.",
    );
    process.exitCode = 1;
  });
}
