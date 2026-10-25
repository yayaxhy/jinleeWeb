import type { Metadata } from "next";
import { localizeSiteMetadata } from "@/lib/site-copy-metadata";
import { getSiteCopy } from "@/lib/site-copy-server";

import { SiteText } from "@/components/SiteCopyProvider";
﻿import Link from 'next/link';

const defaultMetadata = {
  title: '客服后台 - 功能入口',
};

export async function generateMetadata(): Promise<Metadata> {
  return localizeSiteMetadata(defaultMetadata, await getSiteCopy(), "site.app.kefu.page");
}


export default function KefuPage() {
  return (
    <div className="space-y-6 text-white">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold"><SiteText copyKey="site.app.kefu.page.5f68882231b9" /></h2>
        <p className="text-sm text-white/70"><SiteText copyKey="site.app.kefu.page.fc218d3ae03b" /></p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70"><SiteText copyKey="site.app.kefu.page.0367b7bf4727" /></p>
              <p className="text-xs text-white/50"><SiteText copyKey="site.app.kefu.page.67e56a36d86b" /></p>
            </div>
            <Link
              href="/admin/transactions"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            ><SiteText copyKey="site.app.kefu.page.9c980d117086" /></Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70"><SiteText copyKey="site.app.kefu.page.af08b8b5018f" /></p>
              <p className="text-xs text-white/50"><SiteText copyKey="site.app.kefu.page.ba06ca1d715e" /></p>
            </div>
            <Link
              href="/admin/order-requests"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            ><SiteText copyKey="site.app.kefu.page.9c980d117086" /></Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70"><SiteText copyKey="site.app.kefu.page.05ddf99e6af3" /></p>
              <p className="text-xs text-white/50"><SiteText copyKey="site.app.kefu.page.a8121dbcfcfe" /></p>
            </div>
            <Link
              href="/admin/running-orders"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            ><SiteText copyKey="site.app.kefu.page.9c980d117086" /></Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70"><SiteText copyKey="site.app.kefu.page.6615d2040ede" /></p>
              <p className="text-xs text-white/50"><SiteText copyKey="site.app.kefu.page.66a1e0edb425" /></p>
            </div>
            <Link
              href="/admin/refundable-gifts"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            ><SiteText copyKey="site.app.kefu.page.9c980d117086" /></Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70"><SiteText copyKey="site.app.kefu.page.87a34e826586" /></p>
              <p className="text-xs text-white/50"><SiteText copyKey="site.app.kefu.page.f20e1c598d19" /></p>
            </div>
            <Link
              href="/admin/refundable-orders"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            ><SiteText copyKey="site.app.kefu.page.9c980d117086" /></Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70"><SiteText copyKey="site.app.kefu.page.beec6bdf63a0" /></p>
              <p className="text-xs text-white/50"><SiteText copyKey="site.app.kefu.page.c62d2259f3cc" /></p>
            </div>
            <Link
              href="/admin/referrals"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            ><SiteText copyKey="site.app.kefu.page.9c980d117086" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
