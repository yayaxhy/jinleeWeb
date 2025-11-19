import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  title: '陪玩列表 - Jinlee Club',
};

export default function PartnersPage() {
  return (
    <main className="min-h-screen relative text-white">
      <Image
        src="/bg.png"
        alt="Jinlee Club partners"
        fill
        priority
        className="object-cover brightness-[0.65]"
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
        <p className="text-xs uppercase tracking-[0.6em] text-white/70">PEIWAN LIST</p>
        <h1 className="text-[3rem] sm:text-[5rem] font-bold tracking-[0.25em] text-[#2800ff]">敬请期待</h1>
        <p className="text-lg text-white/80 max-w-2xl">
          陪玩列表功能正在筹备中，更多精彩即将上线。
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-2 text-sm uppercase tracking-[0.2em] hover:bg-white/10"
        >
          返回主页
        </Link>
      </div>
    </main>
  );
}
