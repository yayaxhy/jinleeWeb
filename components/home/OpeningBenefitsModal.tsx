"use client";
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSessionContext } from "@/components/SessionProvider";
import { getBerlinDateKey } from "@/lib/opening-benefit-rules";

const couponImage = "/brand/dlm-v1/prizes/13-special-9-zhe-voucher.png";
const characterArt = "/brand/dlm-v1/operations/18-thankBoss.gif";
const DAILY_POPUP_STORAGE_PREFIX = "dlm-opening-benefits-popup-shown";

export function OpeningBenefitsModal() {
  const siteCopy = useSiteCopy();
  const pathname = usePathname();
  const { session } = useSessionContext();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastCheckedRef = useRef<{ key: string; shouldShow: boolean } | null>(
    null,
  );
  const viewerKey = session?.dlmId ?? session?.discordId ?? "guest";

  useEffect(() => {
    const dayKey = getBerlinDateKey();
    const storageKey = `${DAILY_POPUP_STORAGE_PREFIX}:${viewerKey}`;
    const checkKey = `${storageKey}:${dayKey}`;
    const effectKey = `${checkKey}:${pathname}`;
    let shouldShow = false;

    if (pathname === "/farm/lab") {
      // The isolated game lab must not be covered by unrelated promotions.
      return;
    } else if (pathname === "/opening-benefits") {
      try {
        window.localStorage.setItem(storageKey, dayKey);
      } catch {
        // Storage can be unavailable in privacy-restricted browsers. The
        // popup remains usable for the current page load in that case.
      }
    } else if (lastCheckedRef.current?.key === effectKey) {
      // React Strict Mode runs effects twice during local development. Reuse
      // the first decision so the second run cannot suppress that first show.
      shouldShow = lastCheckedRef.current.shouldShow;
    } else {
      try {
        shouldShow = window.localStorage.getItem(storageKey) !== dayKey;
        if (shouldShow) window.localStorage.setItem(storageKey, dayKey);
      } catch {
        // Fall back to one display for this page load when browser storage is
        // disabled; normal browsers retain the once-per-day setting.
        shouldShow = true;
      }
    }

    lastCheckedRef.current = { key: effectKey, shouldShow };
    const timeoutId = window.setTimeout(() => setOpen(shouldShow), 0);
    return () => window.clearTimeout(timeoutId);
  }, [pathname, viewerKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!mounted || !open || pathname === "/opening-benefits" || pathname === "/farm/lab") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid h-[100dvh] w-screen place-items-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-benefits-title"
    >
      <button
        type="button"
        aria-label={siteCopy("site.components.home.openingbenefitsmodal.79b7844cfe1c")}
        className="absolute inset-0 z-0 bg-[#301722]/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <section className="relative z-10 w-full max-w-md overflow-hidden rounded-[2.25rem] border-4 border-white bg-[#fff7f3] px-6 pb-7 pt-8 text-center text-[#5a3447] shadow-[0_30px_80px_rgba(45,15,28,0.46)] sm:px-9">
        <div className="absolute inset-0 -z-10 opacity-55 [background-image:radial-gradient(#f5a1ba_1px,transparent_1px)] [background-size:14px_14px]" />
        <div className="absolute -left-12 -top-12 -z-10 h-40 w-40 rounded-full bg-[#ffd6e1]" />
        <div className="absolute -bottom-20 -right-12 -z-10 h-48 w-48 rounded-full bg-[#ffe19e]" />
        <button
          type="button"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-sm text-[#9d6379] transition hover:bg-white"
          aria-label={siteCopy("site.components.home.openingbenefitsmodal.79b7844cfe1c")}
          onClick={() => setOpen(false)}
        >
          ×
        </button>
        <div className="pointer-events-none absolute -left-4 top-10 h-20 w-20 -rotate-6 overflow-hidden rounded-2xl bg-white shadow-[0_8px_12px_rgba(72,61,151,0.16)]">
          <Image
            src={characterArt}
            alt={siteCopy("site.components.home.openingbenefitsmodal.a731b36ba6d9")}
            fill
            sizes="80px"
            unoptimized
            className="object-contain"
          />
        </div>
        <p className="relative text-xs font-black tracking-[0.26em] text-[#d64f79]"><SiteText copyKey="site.components.home.openingbenefitsmodal.1af215a34764" /></p>
        <h2
          id="opening-benefits-title"
          className="relative mt-3 text-3xl font-black tracking-[-0.055em]"
        ><SiteText copyKey="site.components.home.openingbenefitsmodal.4a6305c65867" /><br /><SiteText copyKey="site.components.home.openingbenefitsmodal.51502e5b67a1" /></h2>
        <p className="relative mt-3 text-sm leading-6 text-[#8d6274]"><SiteText copyKey="site.components.home.openingbenefitsmodal.a361f75fb10a" /></p>
        <Image
          src={couponImage}
          alt={siteCopy("site.components.home.openingbenefitsmodal.8fd8b9c4ee21")}
          width={650}
          height={433}
          className="relative mx-auto -mb-2 mt-2 w-[88%] rotate-[-3deg] drop-shadow-[0_15px_12px_rgba(168,64,96,0.24)]"
          priority
        />
        <Link
          href="/opening-benefits"
          onClick={() => setOpen(false)}
          className="relative mt-1 inline-flex w-full items-center justify-center rounded-full bg-[#e85c86] px-5 py-3 text-sm font-black text-white shadow-[0_8px_0_#bd4166] transition hover:-translate-y-0.5 hover:bg-[#f26d95] active:translate-y-1 active:shadow-[0_4px_0_#bd4166]"
        ><SiteText copyKey="site.components.home.openingbenefitsmodal.e1712901b6c6" /></Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="relative mt-5 text-xs font-medium text-[#a97789] underline-offset-4 hover:underline"
        ><SiteText copyKey="site.components.home.openingbenefitsmodal.304560764fdc" /></button>
      </section>
    </div>,
    document.body,
  );
}
