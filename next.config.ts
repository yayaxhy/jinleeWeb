import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: '.next-build',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
    ],
  },
};

export default nextConfig;
