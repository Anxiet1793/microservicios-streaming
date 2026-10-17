import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone", poweredByHeader: false,
  serverExternalPackages: ["pg", "argon2"], turbopack: { root: process.cwd() },
};
export default config;
