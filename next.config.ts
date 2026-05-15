import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  experimental: {
    // Tree-shake lucide-react to only include icons actually imported
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
