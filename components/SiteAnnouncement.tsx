'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { usePathname } from 'next/navigation';

const NEW_GUILD_URL = 'https://discord.gg/dlmclub';

export function SiteAnnouncement() {
  const siteCopy = useSiteCopy();
  const pathname = usePathname();
  if (pathname === '/farm/lab') return null;
  const message = siteCopy("site.components.siteannouncement.45c06d7b84b7");

  return (
    <aside className="site-announcement" aria-label={siteCopy("site.components.siteannouncement.9e344921f79a")}>
      <a
        className="site-announcement-link"
        href={NEW_GUILD_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={siteCopy("site.components.siteannouncement.45916090d7d4", {value1: String(message)})}
      >
        <span className="site-announcement-track" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => (
            <span className="site-announcement-message" key={index}>
              <SiteText namespace="site.components.siteannouncement" value={message} />
            </span>
          ))}
        </span>
      </a>
    </aside>
  );
}
