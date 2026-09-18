import type { ReactNode } from 'react';

import { Footer } from '@/components/Footer';
import { NavBar } from '@/components/NavBar';

type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

type LegalDocumentProps = {
  eyebrow: string;
  title: string;
  description: string;
  effectiveDate: string;
  sections: LegalSection[];
};

export function LegalDocument({
  eyebrow,
  title,
  description,
  effectiveDate,
  sections,
}: LegalDocumentProps) {
  return (
    <div className="min-h-screen bg-[#f7f3ef] text-[#171717]">
      <NavBar />
      <main className="px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <header className="rounded-[2rem] bg-[#111111] px-7 py-10 text-white shadow-xl sm:px-12 sm:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-orange-200/80">{eyebrow}</p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-white/65 sm:text-base">{description}</p>
            <p className="mt-6 text-xs text-white/45">生效及最近更新日期：{effectiveDate}</p>
          </header>

          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[260px_1fr]">
            <aside className="rounded-[1.5rem] border border-black/5 bg-white p-5 shadow-sm lg:sticky lg:top-6">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-neutral-500">目录</p>
              <nav className="mt-4 space-y-1" aria-label={`${title}目录`}>
                {sections.map((section, index) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block rounded-xl px-3 py-2 text-sm leading-6 text-neutral-600 transition hover:bg-neutral-100 hover:text-black"
                  >
                    {index + 1}. {section.title}
                  </a>
                ))}
              </nav>
            </aside>

            <article className="rounded-[2rem] border border-black/5 bg-white px-7 py-9 shadow-sm sm:px-10">
              <div className="space-y-10">
                {sections.map((section, index) => (
                  <section key={section.id} id={section.id} className="scroll-mt-8">
                    <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                      {index + 1}. {section.title}
                    </h2>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-neutral-700 sm:text-[15px] [&_a]:font-medium [&_a]:text-blue-700 [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-neutral-950 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
                      {section.content}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
