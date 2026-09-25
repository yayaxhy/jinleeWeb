const NEW_GUILD_URL = 'https://discord.gg/DMT7qjP66T';

export function SiteAnnouncement() {
  const message = '新公会链接：discord.gg/DMT7qjP66T · 点击加入新的 Discord 公会';

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
              {message}
            </span>
          ))}
        </span>
      </a>
    </aside>
  );
}
