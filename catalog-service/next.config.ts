import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["mongodb"],
  turbopack: { root: process.cwd() },
};

export default config;
