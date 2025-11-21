import { PeiwanListClient } from './PeiwanListClient';

export const metadata = {
  title: '陪玩列表 - Jinlee Club',
};

export default function PartnersPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-10">
      <PeiwanListClient />
    </main>
  );
}
