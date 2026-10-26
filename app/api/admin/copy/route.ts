import { handleEditableCopyAdmin } from '@/lib/editable-copy-admin';
import { editableCopyEnabled, getCopyState, getEditableCopyService, withLegacyBotCopyState } from '@/lib/editable-copy-store';
import { getServerSession } from '@/lib/session';
import { canManageGuildOperations } from '@/lib/admin';

export const dynamic = 'force-dynamic';
function handle(request: Request) {
  return handleEditableCopyAdmin(request, {
    session: getServerSession, isAdmin: canManageGuildOperations, enabled: editableCopyEnabled,
    inspect: getCopyState,
    execute: async (scope, value, actorId) => withLegacyBotCopyState(scope, await getEditableCopyService(scope).execute(value, actorId)),
    publicUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL,
  });
}
export const GET = handle;
export const POST = handle;
