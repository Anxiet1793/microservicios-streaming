/** Ephemeral test-only signer. Never uses a developer key or Users database. */
import { createServer } from "node:http";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { exportJWK, importSPKI, SignJWT } from "jose";

export async function testAuth() {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicKey = await importSPKI(
    pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    "RS256",
    { extractable: true },
  );
  const keys = [{ ...(await exportJWK(publicKey)), kid: "verification", alg: "RS256", use: "sig" }];
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ keys }));
  });
  await new Promise<void>((resolve) => server.listen(0, "0.0.0.0", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("JWKS server not ready");
  return {
    port: address.port,
    sign: (role: "USER" | "ADMIN") => {
      const id = `usr_${randomUUID()}`;
      return new SignJWT({ userId: id, role })
        .setSubject(id)
        .setIssuer("users-service")
        .setAudience("streaming-services")
        .setIssuedAt()
        .setExpirationTime("15m")
        .setJti(randomUUID())
        .setProtectedHeader({ alg: "RS256", kid: "verification", typ: "JWT" })
        .sign(pair.privateKey);
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
