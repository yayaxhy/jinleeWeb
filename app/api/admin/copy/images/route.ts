import { handleCopyImageUpload } from '@/lib/editable-copy-image-admin';
import { getEditableCopyCatalog } from '@/lib/editable-copy-store';
import { canManageGuildOperations } from '@/lib/admin';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function POST(request: Request) {
  return handleCopyImageUpload(request, {
    session: getServerSession, isAdmin: canManageGuildOperations, catalog: getEditableCopyCatalog,
    publicUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL,
  });
}
