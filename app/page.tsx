import { NavBar } from '@/components/NavBar';
import { PeiwanRecommendations } from '@/components/home/PeiwanRecommendations';
import { Footer } from '@/components/Footer';

export default function Home() {
  return (
    <main className="min-h-screen relative text-neutral-900 bg-white flex flex-col">
      <section className="relative h-screen w-full overflow-hidden">
        <video
          src="/homePage/FINAL.mp4"
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="relative z-20">
          <NavBar />
        </div>
        <div className="relative z-10 flex h-full items-center justify-center" />
      </section>
      <section className="relative z-20 bg-white h-screen w-full overflow-hidden">
        <PeiwanRecommendations />
      </section>
      <Footer />
    </main>
  );
}
