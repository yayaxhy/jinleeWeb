import { getSiteCopy } from "@/lib/site-copy-server";
import { AccountMigrationError } from '@/lib/account-migration';
import { isSameOriginKnowledgeWrite } from '@/lib/knowledge-validation';
import { getBindingReviewMessage } from '@/lib/discord-binding-feedback';
import { AccountProvider } from '@prisma/client';
import { NextResponse } from 'next/server';
import { unbindDlmUserChannel, isDiscordBindingError } from '@/lib/discord-binding';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { destroySession } from '@/lib/session';

const providerMap: Record<string, AccountProvider> = {
  discord: AccountProvider.DISCORD,
  wechat: AccountProvider.WECHAT_MINIPROGRAM,
};

const statusForBindingError = (code: string) => {
  if (getBindingReviewMessage(code)) return 409;
  switch (code) {
    case 'dlm_user_not_found':
    case 'channel_not_bound':
      return 404;
    case 'last_login_method_forbidden':
    case 'peiwan_requires_discord':
    case 'discord_unbind_requires_asset_review':
    case 'binding_state_changed':
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

  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (currentUser.sessionSource === 'web' && !isSameOriginKnowledgeWrite(request, process.env.NEXTAUTH_URL)) return NextResponse.json({ ok: false, error: '请求来源不符' }, { status: 403 });

  try {
    const result = await unbindDlmUserChannel({
      dlmId: currentUser.dlmId,
      provider: providerType,
      expectedSessionVersion: currentUser.dlmUser.sessionVersion,
    });

    const response = NextResponse.json({
      ok: true,
      provider,
      loggedOut: result.loggedOut,
      requiresReauthentication: result.loggedOut,
    });

    if (result.loggedOut) {
      destroySession(response);
    }

    return response;
  } catch (error) {
    if (error instanceof AccountMigrationError) return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    if (isDiscordBindingError(error)) {
      const copy = await getSiteCopy();
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          ...(getBindingReviewMessage(error.code) ? { message: copy.text(getBindingReviewMessage(error.code), "site.lib.discord.binding.feedback") } : {}),
        },
        { status: statusForBindingError(error.code) },
      );
    }

    console.error('[bindings.delete] failed', error);
    return NextResponse.json({ ok: false, error: 'unbind_failed' }, { status: 500 });
  }
}
