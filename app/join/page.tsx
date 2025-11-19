import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  title: '加入我们 - Jinlee Club',
};

export default function JoinPage() {
  return (
    <main className="min-h-screen relative text-white">
      <Image
        src="/bg.png"
        alt="Join Jinlee Club"
        fill
        priority
        className="object-cover brightness-[0.65]"
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
        <p className="text-xs uppercase tracking-[0.6em] text-white/70">JOIN US</p>
        <h1 className="text-[3rem] sm:text-[5rem] font-bold tracking-[0.25em] text-[#2800ff]">敬请期待</h1>
        <p className="text-lg text-white/80 max-w-2xl">
          加入我们页面正在建设中，敬请期待最新招募信息。
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
