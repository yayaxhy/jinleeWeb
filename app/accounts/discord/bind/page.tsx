
import { SiteText } from "@/components/SiteCopyProvider";
import BindDiscordClient from './BindDiscordClient';
import { verifyDiscordBindToken } from '@/lib/discord-bind-token';

type DiscordBindPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DiscordBindPage({ searchParams }: DiscordBindPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawBindToken = resolvedSearchParams.bindToken;
  const bindToken = Array.isArray(rawBindToken) ? rawBindToken[0] : rawBindToken;

  if (!bindToken || !verifyDiscordBindToken(bindToken)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#111827] text-white px-6 text-center">
        <div className="max-w-lg space-y-4">
          <h1 className="text-3xl font-semibold tracking-wide"><SiteText copyKey="site.app.accounts.discord.bind.page.56ccddf003fb" /></h1>
          <p className="text-sm leading-7 text-white/70"><SiteText copyKey="site.app.accounts.discord.bind.page.cb7d96815d23" /></p>
        </div>
      </main>
    );
  }

  return <BindDiscordClient bindToken={bindToken} />;
}
