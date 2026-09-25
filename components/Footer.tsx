import Link from 'next/link';

import {
  PUBLIC_CONTACT_EMAIL,
  SUPPORT_DISCORD_URL,
  SUPPORT_WECHAT_ID,
} from '@/lib/legal';

type SupportLink = { label: string; href: string; newTab?: boolean };

const supportLinks: SupportLink[] = [
  { label: 'Discord 客服', href: SUPPORT_DISCORD_URL, newTab: true },
];

const legalLinks: SupportLink[] = [
  { label: '服务价格', href: '/peiwanList' },
  { label: '用户协议', href: '/terms' },
  { label: '隐私政策', href: '/privacy' },
  { label: '充值与退款', href: '/recharge-policy' },
];

export function Footer() {
  return (
    <footer className="bg-white text-neutral-900 border-t border-neutral-200">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-10 text-center sm:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em]">服务与规则</p>
          <ul className="space-y-1 text-sm leading-6">
            {legalLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em]">售后联系</p>
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
          <p className="text-sm leading-6 text-neutral-700">
            微信客服：<span className="font-semibold">{SUPPORT_WECHAT_ID}</span>
          </p>
          <p className="text-sm leading-6 text-neutral-700">
            负责人邮箱：
            <a className="font-semibold hover:underline" href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>
              {PUBLIC_CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>

    </footer>
  );
}
