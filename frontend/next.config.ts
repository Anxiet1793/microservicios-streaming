import type { NextConfig } from "next";
const mediaUrl = new URL(process.env.MEDIA_ORIGIN || "http://localhost:9000");
if (
  !["http:", "https:"].includes(mediaUrl.protocol) ||
  mediaUrl.username ||
  mediaUrl.password ||
  mediaUrl.search ||
  mediaUrl.hash ||
  mediaUrl.pathname !== "/"
) {
  throw new Error(
    "MEDIA_ORIGIN must be an HTTP(S) origin without credentials, path, query or fragment.",
  );
}
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["ioredis"],
  turbopack: { root: process.cwd() },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: http: data:; font-src 'self'; connect-src 'self'; media-src 'self' " +
              mediaUrl.origin +
              "; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};
export default config;
