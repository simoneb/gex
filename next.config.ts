import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/gex",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
