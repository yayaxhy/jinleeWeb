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
          <h1 className="text-3xl font-semibold tracking-wide">绑定链接已失效</h1>
          <p className="text-sm leading-7 text-white/70">
            请回到微信小程序重新生成绑定链接，再发起一次 Discord 绑定。
          </p>
        </div>
      </main>
    );
  }

  return <BindDiscordClient bindToken={bindToken} />;
}
