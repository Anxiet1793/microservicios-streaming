import type { NextConfig } from "next";
const config: NextConfig = { output: "standalone", poweredByHeader: false, serverExternalPackages: ["mongodb", "minio", "busboy"], turbopack: { root: process.cwd() } };
export default config;
