import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function NewHomeEditableLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
