import { canManagePointShop } from '@/lib/admin';
import { handlePointShopImageUpload } from '@/lib/point-shop-image-upload';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handlePointShopImageUpload(request, {
    session: getServerSession,
    isAdmin: canManagePointShop,
    publicUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL,
  });
}
