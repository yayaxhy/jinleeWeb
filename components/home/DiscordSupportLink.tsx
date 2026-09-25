'use client';

import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { SUPPORT_DISCORD_USER_ID } from '@/lib/site';

export function DiscordSupportLink({
  children,
  className,
  style,
  discordUserId = SUPPORT_DISCORD_USER_ID,
}: {
  children: ReactNode;
  className: string;
  style: CSSProperties;
  discordUserId?: string;
}) {
  const fallbackTimer = useRef<number | null>(null);
  const supportProfileUrl = `https://discord.com/users/${discordUserId}`;

  useEffect(() => () => {
    if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current);
  }, []);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current);

    const cancelFallbackWhenDiscordOpens = () => {
      if (document.visibilityState === 'hidden' && fallbackTimer.current !== null) {
        window.clearTimeout(fallbackTimer.current);
        fallbackTimer.current = null;
      }
    };

    document.addEventListener('visibilitychange', cancelFallbackWhenDiscordOpens, { once: true });
    window.location.href = `discord://-/users/${discordUserId}`;
    fallbackTimer.current = window.setTimeout(() => {
      fallbackTimer.current = null;
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        window.location.assign(supportProfileUrl);
      }
    }, 1000);
  };

  return (
    <a
      href={supportProfileUrl}
      onClick={handleClick}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}
