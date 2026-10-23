import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setupStack } from "./setup-stack.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
async function run(command, args) {
  const code = await new Promise((done, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => done(code ?? 1));
  });
  if (code !== 0) throw new Error(`El comando ${command} falló (${code}).`);
}
try {
  const action = process.argv[2];
  if (action === "up") {
    if (await setupStack()) console.log(".env raíz creado con secretos aleatorios.");
    await run("docker", ["compose", "config", "--quiet"]);
    await run("docker", [
      "compose",
      "up",
      "--build",
      "--detach",
      "--wait",
      "--wait-timeout",
      "300",
    ]);
    await run(process.execPath, ["--env-file=.env", "scripts/smoke-test.mjs"]);
    console.log("Stack listo. Las credenciales demo están en SEED_PASSWORD de .env raíz.");
  } else if (action === "down") {
    await run("docker", ["compose", "down"]);
  } else if (action === "logs") {
    await run("docker", ["compose", "logs", "--follow", "--tail", "100"]);
  } else if (action === "seed") {
    await run("docker", ["compose", "run", "--rm", "--no-deps", "users-seed"]);
    await run("docker", ["compose", "run", "--rm", "--no-deps", "stack-seed"]);
  } else throw new Error("Acción admitida: up, down, logs o seed.");
} catch (error) {
  console.error(
    error.code === "ENOENT"
      ? "Docker no está disponible en PATH. Instala/inicia Docker Desktop."
      : error.message,
  );
  process.exitCode = 1;
}
