import Link from 'next/link';
import { normalizeRedirectTarget } from '@/lib/session';

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getFirstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const errorMessage: Record<string, string> = {
  wechat_not_configured: '微信网页登录尚未配置，请联系管理员完成开放平台设置。',
  wechat_unionid_missing: '微信开放平台没有返回统一账号标识。为避免创建一个与余额分离的新账号，本次没有登录。请联系管理员将网站应用和小程序绑定到同一开放平台主体。',
  wechat_account_mismatch: '该微信网站身份与已绑定的账号不一致。为保护账户安全，本次没有登录。',
  wechat_denied: '你取消了微信授权，可以重新扫码登录。',
  invalid_state: '登录已过期或校验失败，请重新发起登录。',
  wechat_oauth: '微信登录暂时未完成，请稍后重试。',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const callbackUrl = normalizeRedirectTarget(getFirstValue(params.callbackUrl), '/profile');
  const error = getFirstValue(params.error);
  const discordHref = `/api/discord/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const wechatHref = `/api/auth/wechat/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f3ef] px-6 py-12 text-[#171717]">
      <section className="w-full max-w-md rounded-[28px] border border-black/10 bg-white p-8 shadow-sm">
        <p className="text-center text-xs font-medium tracking-[0.3em] text-[#2563eb]">点了么娱乐公会</p>
        <h1 className="mt-3 text-center text-3xl font-semibold tracking-wide">登录账户</h1>
        <p className="mt-3 text-center text-sm leading-6 text-neutral-600">
          使用微信查看余额、下单和使用公会工作台；已有 Discord 账户也可以继续使用 Discord 登录。
        </p>

        {error && errorMessage[error] ? (
          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            {errorMessage[error]}
          </p>
        ) : null}

        <div className="mt-7 space-y-3">
          <Link
            href={wechatHref}
            className="flex w-full items-center justify-center rounded-full bg-[#07c160] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#06ad56]"
          >
            微信扫码登录
          </Link>
          <Link
            href={discordHref}
            className="flex w-full items-center justify-center rounded-full bg-[#5865f2] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
          >
            使用 Discord 登录
          </Link>
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-neutral-500">
          微信登录会通过微信官方授权页完成；网站不会获取你的微信密码。
        </p>
      </section>
    </main>
  );
}
