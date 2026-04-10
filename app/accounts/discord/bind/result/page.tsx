type DiscordBindResultPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const resolveValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const getMessage = (status?: string, code?: string) => {
  if (status === 'success' && code === 'already_bound') {
    return {
      title: '账号已经绑定',
      body: '这个微信账号之前已经和当前 Discord 账号完成关联。返回小程序刷新“绑定页”即可看到最新状态。',
      tone: 'success',
    };
  }

  if (status === 'success') {
    return {
      title: '绑定成功',
      body: '当前微信账号已经和 Discord 账号关联完成。回到小程序绑定页刷新后，就能看到已绑定状态。',
      tone: 'success',
    };
  }

  switch (code) {
    case 'invalid_bind_token':
      return {
        title: '绑定链接已失效',
        body: '请回到微信小程序重新生成新的绑定链接，再发起一次绑定。',
        tone: 'error',
      };
    case 'discord_already_bound_to_other_wechat':
      return {
        title: 'Discord 已绑定其他微信账号',
        body: '当前 Discord 账号已经关联了另一位微信用户，不能直接再次绑定。请先确认你使用的是正确账号。',
        tone: 'error',
      };
    case 'discord_session_missing':
      return {
        title: 'Discord 登录状态缺失',
        body: '请重新从小程序绑定页发起授权，完成 Discord 登录后再试。',
        tone: 'error',
      };
    default:
      return {
        title: '绑定失败',
        body: '系统没有完成这次账号绑定。请返回微信小程序重新发起，如果持续失败再检查线上日志。',
        tone: 'error',
      };
  }
};

export default async function DiscordBindResultPage({ searchParams }: DiscordBindResultPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const status = resolveValue(resolvedSearchParams.status);
  const code = resolveValue(resolvedSearchParams.code);
  const message = getMessage(status, code);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
      <div className="max-w-lg rounded-[32px] border border-black/5 bg-white p-8 text-center shadow-sm space-y-5">
        <p
          className={`text-xs uppercase tracking-[0.45em] ${
            message.tone === 'success' ? 'text-emerald-600' : 'text-red-500'
          }`}
        >
          Discord Binding
        </p>
        <h1 className="text-3xl font-semibold tracking-wide text-[#171717]">{message.title}</h1>
        <p className="text-sm leading-7 text-gray-500">{message.body}</p>
        <div className="rounded-2xl bg-[#f8fafc] px-4 py-4 text-xs leading-6 text-gray-500">
          这个页面是给小程序 `web-view` 用的。现在可以直接返回微信小程序，然后下拉刷新绑定页。
        </div>
      </div>
    </main>
  );
}
