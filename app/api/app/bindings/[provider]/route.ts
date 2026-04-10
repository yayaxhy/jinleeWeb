import { AccountProvider } from '@prisma/client';
import { NextResponse } from 'next/server';
import { unbindJinleeUserChannel, isDiscordBindingError } from '@/lib/discord-binding';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { destroySession } from '@/lib/session';

const providerMap: Record<string, AccountProvider> = {
  discord: AccountProvider.DISCORD,
  wechat: AccountProvider.WECHAT_MINIPROGRAM,
};

const statusForBindingError = (code: string) => {
  switch (code) {
    case 'jinlee_user_not_found':
    case 'channel_not_bound':
      return 404;
    case 'last_login_method_forbidden':
    case 'peiwan_requires_discord':
      return 409;
    default:
      return 400;
  }
};

type RouteContext = {
  params: Promise<{
    provider: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const providerType = providerMap[provider];
  if (!providerType) {
    return NextResponse.json({ ok: false, error: 'unsupported_provider' }, { status: 404 });
  }

  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await unbindJinleeUserChannel({
      jinleeId: currentUser.jinleeId,
      provider: providerType,
    });

    const response = NextResponse.json({
      ok: true,
      provider,
      loggedOut:
        (providerType === AccountProvider.DISCORD && currentUser.sessionSource === 'web') ||
        (providerType === AccountProvider.WECHAT_MINIPROGRAM &&
          currentUser.sessionSource === 'wechat_program') ||
        result.loggedOut,
    });

    if (providerType === AccountProvider.DISCORD && currentUser.sessionSource === 'web') {
      destroySession(response);
    }

    return response;
  } catch (error) {
    if (isDiscordBindingError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
        },
        { status: statusForBindingError(error.code) },
      );
    }

    console.error('[bindings.delete] failed', error);
    return NextResponse.json({ ok: false, error: 'unbind_failed' }, { status: 500 });
  }
}
