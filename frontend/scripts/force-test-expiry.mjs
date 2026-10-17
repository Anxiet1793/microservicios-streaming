// Test-only helper, piped into the frontend container; never copied into runner.
import { Redis } from "ioredis";
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
let input = "";
for await (const part of process.stdin) input += part;
const id = input.trim();
if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid test session");
const client = new Redis(process.env.REDIS_URL),
  key = "nevaro:session:" + createHash("sha256").update(id).digest("hex");
try {
  const raw = await client.get(key);
  if (!raw) throw new Error("Missing test session");
  const b = Buffer.from(raw, "base64"),
    dec = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(process.env.SESSION_SECRET, "hex"),
      b.subarray(0, 12),
    );
  dec.setAuthTag(b.subarray(-16));
  const session = JSON.parse(
    Buffer.concat([dec.update(b.subarray(12, -16)), dec.final()]),
  );
  session.accessExpires = 0;
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(process.env.SESSION_SECRET, "hex"),
      iv,
    );
  const sealed = Buffer.concat([
    iv,
    cipher.update(JSON.stringify(session)),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
  await client.set(key, sealed, "KEEPTTL");
  console.log("Test session expiry updated");
} finally {
  await client.quit();
}
