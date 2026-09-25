import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: '.next',
  images: {
    localPatterns: [
      { pathname: '/DLMLOGO.png' },
      { pathname: '/brand/**' },
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
