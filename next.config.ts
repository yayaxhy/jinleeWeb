import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: '.next',
  images: {
    localPatterns: [
      {
        pathname: '/farm/**',
      },
      {
        pathname: '/lottery-fusion/**',
      },
      {
        pathname: '/peiwanRecommend/**',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
    ],
  },
};

export default nextConfig;
