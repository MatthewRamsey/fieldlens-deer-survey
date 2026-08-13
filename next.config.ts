import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
