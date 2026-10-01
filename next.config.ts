import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["libraw-wasm", "heic-convert"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.uplandwildlifemanagement.com",
        pathname: "/lovable-uploads/**",
      },
    ],
  },
};

export default nextConfig;
