import { redirect } from 'next/navigation';
import { normalizeRedirectTarget } from '@/lib/session';

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getFirstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const callbackUrl = normalizeRedirectTarget(getFirstValue(params.callbackUrl), '/profile');
  redirect(`/api/discord/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}
