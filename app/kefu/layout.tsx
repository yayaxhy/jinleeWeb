import type { Metadata } from "next";
import { localizeSiteMetadata } from "@/lib/site-copy-metadata";
import { getSiteCopy } from "@/lib/site-copy-server";

import { SiteText } from "@/components/SiteCopyProvider";
﻿import type { ReactNode } from 'react';
import '../admin/admin.css';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { canViewKefuWorkspace } from '@/lib/admin';

const defaultMetadata = {
  title: '客服后台',
  robots: {
    index: false,
    follow: false,
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return localizeSiteMetadata(defaultMetadata, await getSiteCopy(), "site.app.kefu.layout");
}


export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function KefuLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewKefuWorkspace(session.discordId)) {
    redirect('/');
  }

  return (
    <section className="min-h-screen bg-[#020204] text-white">
      <div className="admin-shell mx-auto flex max-w-[1400px] flex-col gap-10 px-6 py-12">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.6em] text-white/60"><SiteText copyKey="site.app.kefu.layout.0e5b114f4724" /></p>
          <h1 className="text-3xl font-semibold"><SiteText copyKey="site.app.kefu.layout.445f20c71469" /></h1>
          <p className="text-sm text-white/60"><SiteText copyKey="site.app.kefu.layout.c707430e6423" /></p>
        </header>
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          {children}
        </div>
      </div>
    </section>
  );
}
