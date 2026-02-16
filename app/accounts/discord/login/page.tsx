import DiscordLoginClient from './DiscordLoginClient';

type DiscordLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DiscordLoginPage({ searchParams }: DiscordLoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawCallback = resolvedSearchParams.callbackUrl;
  const callbackUrl = Array.isArray(rawCallback) ? rawCallback[0] : rawCallback;

  return <DiscordLoginClient callbackUrl={typeof callbackUrl === 'string' ? callbackUrl : undefined} />;
}

