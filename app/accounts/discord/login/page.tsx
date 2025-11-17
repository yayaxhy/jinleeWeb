import DiscordLoginClient from './DiscordLoginClient';

type DiscordLoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function DiscordLoginPage({ searchParams = {} }: DiscordLoginPageProps) {
  const rawCallback = searchParams.callbackUrl;
  const callbackUrl = Array.isArray(rawCallback) ? rawCallback[0] : rawCallback;

  return <DiscordLoginClient callbackUrl={typeof callbackUrl === 'string' ? callbackUrl : undefined} />;
}

