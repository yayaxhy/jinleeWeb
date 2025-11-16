import Image from 'next/image';
import { NavBar } from '@/components/NavBar';

export default function Home() {
  return (
    <main className="min-h-screen relative text-white">
      <Image
        src="/bg.png"
        alt="Jinlee Club"
        fill
        priority
        className="object-cover brightness-[0.65]"
      />

      <div className="relative z-10 flex flex-col items-center justify-center h-screen px-6 text-center">
        <div className="-translate-y-6 sm:-translate-y-20">
          <h1 className="text-[3rem] sm:text-[7rem] font-bold tracking-[0.3em] text-[#2800ff]">
            JINLEE CLUB
          </h1>
        </div>
        <NavBar />
      </div>
    </main>
  );
}
