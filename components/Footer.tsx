import Link from 'next/link';

type SupportLink = { label: string; href: string; newTab?: boolean };

const supportLinks: SupportLink[] = [
  { label: 'Discord 链接', href: 'https://discord.gg/mUNUNQEmCA', newTab: true },
];

export function Footer() {
  return (
    <footer className="bg-white text-neutral-900 border-t border-neutral-200">
      <div className="mx-auto w-full max-w-[1400px] px-6 py-10 flex justify-center">
        <div className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em]">联系我们</p>
          <ul className="space-y-1 text-sm leading-6">
            {supportLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="hover:underline"
                  target={link.newTab ? '_blank' : undefined}
                  rel={link.newTab ? 'noopener noreferrer' : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-neutral-200">
        <div className="w-full flex flex-wrap items-center justify-start gap-4 px-6 py-4 text-xs text-neutral-600 uppercase tracking-[0.14em]">
          <span>© Jinlee Club 2025</span>
        </div>
      </div>
    </footer>
  );
}
