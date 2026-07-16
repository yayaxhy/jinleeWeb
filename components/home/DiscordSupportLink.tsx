'use client';

import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

const DEFAULT_DISCORD_USER_ID = '1421651539247894549';
const DISCORD_INVITE_FALLBACK = 'https://discord.gg/UJ95zhfJYR';

export function DiscordSupportLink({
  children,
  className,
  style,
  discordUserId = DEFAULT_DISCORD_USER_ID,
}: {
  children: ReactNode;
  className: string;
  style: CSSProperties;
  discordUserId?: string;
}) {
  const fallbackTimer = useRef<number | null>(null);

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
        window.location.assign(DISCORD_INVITE_FALLBACK);
      }
    }, 1000);
  };

  return (
    <a
      href={DISCORD_INVITE_FALLBACK}
      onClick={handleClick}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}
