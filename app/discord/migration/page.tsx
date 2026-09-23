import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDiscordMigrationConfig } from '@/lib/discord-migration';
import { InternalBotError, postInternalBot } from '@/lib/internal-bot';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type MigrationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type MigrationStatusResponse = {
  ok: true;
  alreadyMember: boolean;
};

const statusMessages: Record<string, { title: string; body: string; tone: 'success' | 'warning' | 'error' }> = {
  joined: {
    title: '已加入新服务器',
    body: '你已完成授权并成功加入。',
    tone: 'success',
  },
  joined_nickname_pending: {
    title: '已加入新服务器，但昵称暂未同步',
    body: '你的账号已成功加入。请联系管理员检查 Bot 的“管理昵称”权限或昵称长度。',
    tone: 'warning',
  },
  authorization_declined: {
    title: '未完成 Discord 授权',
    body: '只有在 Discord 授权页确认后，系统才可以将你加入新服务器。',
    tone: 'warning',
  },
  account_mismatch: {
    title: 'Discord 账号不一致',
    body: '你授权的 Discord 账号与当前网站登录账号不同。请使用同一个 Discord 账号重新登录后再试。',
    tone: 'error',
  },
  missing_authorization: {
    title: '授权权限不足',
    body: '请重新点击迁移按钮，并在 Discord 页面确认加入服务器权限。',
    tone: 'error',
  },
  login_required: {
    title: '需要先登录网站',
    body: '请先使用你的 Discord 账号登录网站，再发起迁移。',
    tone: 'warning',
  },
  unavailable: {
    title: '迁移暂未开放',
    body: '服务器迁移入口当前没有开启，请稍后再试。',
    tone: 'warning',
  },
  configuration_error: {
    title: '迁移服务配置异常',
    body: '系统暂时无法发起 Discord 授权，请联系管理员处理。',
    tone: 'error',
  },
  internal_bot_not_configured: {
    title: '迁移服务暂不可用',
    body: '服务器尚未完成内部连接配置，请稍后再试。',
    tone: 'error',
  },
  internal_bot_timeout: {
    title: 'Discord 响应超时',
    body: '请稍后重试；如已加入服务器，系统会自动识别，无需担心重复加入。',
    tone: 'warning',
  },
  internal_bot_unavailable: {
    title: '迁移服务暂不可用',
    body: 'Bot 当前未连接，请稍后再试。',
    tone: 'error',
  },
  migration_disabled: {
    title: '迁移暂未开放',
    body: '服务器迁移入口当前没有开启，请稍后再试。',
    tone: 'warning',
  },
  migration_target_not_configured: {
    title: '迁移服务配置异常',
    body: '新服务器尚未完成配置，请联系管理员处理。',
    tone: 'error',
  },
  client_not_ready: {
    title: 'Bot 尚未准备就绪',
    body: '请稍后重试。',
    tone: 'warning',
  },
  bot_missing_permissions: {
    title: 'Bot 权限不足',
    body: '新服务器中的 Bot 尚未具备执行迁移所需权限，请联系管理员处理。',
    tone: 'error',
  },
  discord_join_failed: {
    title: '暂时无法加入服务器',
    body: 'Discord 未能完成加群操作，请稍后重试。',
    tone: 'error',
  },
  unexpected_error: {
    title: '迁移未完成',
    body: '系统发生了未知错误，请稍后重试。',
    tone: 'error',
  },
};

const toneClasses = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  error: 'border-rose-300 bg-rose-50 text-rose-900',
};

export default async function DiscordMigrationPage({ searchParams }: MigrationPageProps) {
  const session = await getServerSession();
  if (!session?.discordId) {
    redirect('/accounts/discord/login?callbackUrl=%2Fdiscord%2Fmigration');
  }

  const params = await searchParams;
  const rawStatus = params.status;
  const status = typeof rawStatus === 'string' ? rawStatus : rawStatus?.[0];
  const message = status ? statusMessages[status] ?? statusMessages.unexpected_error : null;
  const config = getDiscordMigrationConfig();

  // Preserve the post-join result messages, but avoid asking an existing
  // member to authorize again whenever they revisit the migration link.
  const hasFreshJoinResult = status === 'joined' || status === 'joined_nickname_pending';
  if (config.enabled && !hasFreshJoinResult) {
    let alreadyMember = false;
    try {
      const result = await postInternalBot<MigrationStatusResponse>('/internal/discord/migration/status', {
        discordId: session.discordId,
      });
      alreadyMember = result.alreadyMember;
    } catch (error) {
      const code = error instanceof InternalBotError ? error.code : 'unexpected_error';
      console.warn('[discord-migration] membership precheck unavailable', { code });
    }
    if (alreadyMember) redirect('/profile');
  }

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-6 py-16 text-[#171717]">
      <section className="mx-auto max-w-2xl">
        <article className="rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_10px_30px_rgba(17,24,39,0.04)] sm:p-10">
          <h1 className="text-3xl font-semibold tracking-wide">加入 {config.targetGuildName}</h1>

          {message ? (
            <div className={`mt-6 rounded-2xl border px-5 py-4 ${toneClasses[message.tone]}`}>
              <h2 className="font-semibold">{message.title}</h2>
              <p className="mt-1 text-sm leading-6 opacity-85">{message.body}</p>
            </div>
          ) : null}

          <div className="mt-8 space-y-3">
            {config.enabled ? (
              <a
                href="/api/discord/migration/start"
                className="flex w-full items-center justify-center rounded-2xl bg-[#f8c84a] px-6 py-4 text-base font-semibold text-[#4e3600] transition hover:bg-[#e9b42d]"
              >
                授权并加入新服务器
              </a>
            ) : (
              <span className="flex w-full items-center justify-center rounded-2xl bg-gray-200 px-6 py-4 text-base font-semibold text-gray-500">
                迁移入口暂未开放
              </span>
            )}
            <Link
              href="/profile"
              className="flex w-full items-center justify-center rounded-2xl border border-black/15 px-6 py-4 text-base font-semibold text-gray-700 transition hover:border-[#f8c84a] hover:text-[#b77900]"
            >
              返回个人中心
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
