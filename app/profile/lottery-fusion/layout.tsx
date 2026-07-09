import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function LotteryFusionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
