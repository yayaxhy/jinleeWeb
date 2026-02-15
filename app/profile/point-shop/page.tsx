import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PointShopClient } from '@/components/profile/PointShopClient';
import { getPointShopDashboard } from '@/lib/pointShop';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const decToString = (value: { toString(): string } | null | undefined) =>
  value ? value.toString() : '0';

export default async function PointShopPage() {
  const session = await getServerSession();
  const discordId = session?.discordId;
  if (!discordId) {
    redirect('/');
  }

  const dashboard = await getPointShopDashboard(discordId);

  const initialData = {
    points: decToString(dashboard.points),
    items: dashboard.items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      pointsCost: decToString(item.pointsCost),
      stock: item.stock,
      deliveryType: item.deliveryType,
      balanceCreditAmount: decToString(item.balanceCreditAmount),
    })),
    cart: dashboard.cart
      ? {
          cartId: dashboard.cart.cartId,
          version: dashboard.cart.version,
          updatedAt: dashboard.cart.updatedAt.toISOString(),
          lines: dashboard.cart.lines.map((line) => ({
            itemId: line.itemId,
            sku: line.sku,
            name: line.name,
            quantity: line.quantity,
            unitPoints: decToString(line.unitPoints),
            subtotalPoints: decToString(line.subtotalPoints),
            stock: line.stock,
          })),
          totalQuantity: dashboard.cart.totalQuantity,
          totalPoints: decToString(dashboard.cart.totalPoints),
        }
      : null,
  };

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-16">
      <section className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/profile"
            className="rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-gray-500 hover:bg-black/5"
          >
            返回个人主页
          </Link>
        </div>
        <PointShopClient initialData={initialData} />
      </section>
    </main>
  );
}
