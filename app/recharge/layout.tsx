import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function RechargeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f3ef]">
      {children}
      <Footer />
    </div>
  );
}
