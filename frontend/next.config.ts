import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false, // EditorJS is incompatible with Strict Mode's double-invoke
};

export default nextConfig;
