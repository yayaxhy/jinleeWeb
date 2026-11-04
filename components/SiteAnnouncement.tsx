
import { SiteText } from "@/components/SiteCopyProvider";
import { postInternalBot } from "@/lib/internal-bot";
const NEW_GUILD_URL = 'https://discord.gg/dlmclub';

export async function SiteAnnouncement({ discordId }: { discordId?: string | null }) {
  if (discordId) {
    try {
      const membership = await postInternalBot<{ ok: boolean; isMember: boolean }>(
        '/internal/discord/membership',
        { discordId },
        { timeoutMs: 2000 },
      );
      if (membership.ok === true && membership.isMember === true) return null;
    } catch {
      // Preserve the announcement when current membership cannot be confirmed.
    }
  }

  const message = '点了么娱乐公会链接：discord.gg/dlmclub · 点击加入公会';

  return (
    <aside className="site-announcement" aria-label="新公会公告">
      <a
        className="site-announcement-link"
        href={NEW_GUILD_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={`${message}（在新标签页打开）`}
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
