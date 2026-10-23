// Piped only into a disposable E2E frontend; never installed as an HTTP endpoint.
import { Redis } from "ioredis";
import { createHash, createCipheriv, createDecipheriv, randomBytes, sign } from "node:crypto";
if (!/^nevaro-e2e-[a-f0-9]{10}$/.test(process.env.E2E_STACK_ID || ""))
  throw new Error("Not an owned E2E container");
let input = "";
for await (const part of process.stdin) input += part;
const { id, action, privateKey } = JSON.parse(input);
if (!/^[a-f0-9]{64}$/.test(id) || !["expire", "delete"].includes(action))
  throw new Error("Invalid test instruction");
const client = new Redis(process.env.REDIS_URL),
  key = "nevaro:session:" + createHash("sha256").update(id).digest("hex");
try {
  if (action === "delete") {
    await client.del(key);
  } else {
    const raw = await client.get(key);
    if (!raw) throw new Error("Missing test session");
    const b = Buffer.from(raw, "base64"),
      dec = createDecipheriv(
        "aes-256-gcm",
        Buffer.from(process.env.SESSION_SECRET, "hex"),
        b.subarray(0, 12),
      );
    dec.setAuthTag(b.subarray(-16));
    const session = JSON.parse(Buffer.concat([dec.update(b.subarray(12, -16)), dec.final()]));
    // A genuinely expired RS256 JWT, signed with this stack's own key.
    const [header, body] = session.access.split("."),
      payload = JSON.parse(Buffer.from(body, "base64url"));
    payload.iat = Math.floor(Date.now() / 1000) - 120;
    payload.exp = Math.floor(Date.now() / 1000) - 60;
    const unsigned = header + "." + Buffer.from(JSON.stringify(payload)).toString("base64url");
    session.access =
      unsigned + "." + sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url");
    session.accessExpires = 0;
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", Buffer.from(process.env.SESSION_SECRET, "hex"), iv);
    const sealed = Buffer.concat([
      iv,
      cipher.update(JSON.stringify(session)),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString("base64");
    await client.set(key, sealed, "KEEPTTL");
  }
  console.log("Owned test session prepared");
} finally {
  await client.quit();
}
