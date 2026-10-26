import { localizeSiteMetadata } from "@/lib/site-copy-metadata";
import { getSiteCopy } from "@/lib/site-copy-server";

import { SiteText } from "@/components/SiteCopyProvider";
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Footer } from '@/components/Footer';

const defaultMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return localizeSiteMetadata(defaultMetadata, await getSiteCopy(), "site.app.recharge.layout");
}


export default function RechargeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f3ef]">
      {children}
      <Footer />
    </div>
  );
}
