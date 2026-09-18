import Link from 'next/link';

import {
  ICP_QUERY_URL,
  ICP_RECORD_NUMBER,
  LEGAL_ENTITY_NAME,
  PUBLIC_CONTACT_EMAIL,
  SUPPORT_DISCORD_URL,
  SUPPORT_WECHAT_ID,
  UNIFIED_SOCIAL_CREDIT_CODE,
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

      <div className="border-t border-neutral-200">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-2 px-6 py-5 text-center text-xs leading-5 text-neutral-600">
          <span>{LEGAL_ENTITY_NAME}</span>
          <span>统一社会信用代码：{UNIFIED_SOCIAL_CREDIT_CODE}</span>
          <Link
            href={ICP_QUERY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-black hover:underline"
          >
            {ICP_RECORD_NUMBER}
          </Link>
          <span className="uppercase tracking-[0.14em]">© Jinlee Club 2025–2026</span>
        </div>
      </div>
    </footer>
  );
}
