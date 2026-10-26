import { localizeSiteMetadata } from "@/lib/site-copy-metadata";
import { getSiteCopy } from "@/lib/site-copy-server";

import { SiteText } from "@/components/SiteCopyProvider";
import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalDocument } from '@/components/legal/LegalDocument';
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_TYPE,
  PUBLIC_CONTACT_EMAIL,
  SUPPORT_DISCORD_URL,
  SUPPORT_WECHAT_ID,
  UNIFIED_SOCIAL_CREDIT_CODE,
} from '@/lib/legal';

const defaultMetadata: Metadata = {
  title: '用户协议｜点了么娱乐公会',
  description: '点了么娱乐公会网站服务、账户、下单、付款、取消及售后相关约定。',
  alternates: { canonical: '/terms' },
};

export async function generateMetadata(): Promise<Metadata> {
  return localizeSiteMetadata(defaultMetadata, await getSiteCopy(), "site.app.terms.page");
}


const sections = [
  {
    id: 'operator',
    title: '运营主体与协议范围',
    content: (
      <>
        <p><SiteText copyKey="site.app.terms.page.37fbbef1629a" /><strong>{LEGAL_ENTITY_NAME}</strong><SiteText copyKey="site.app.terms.page.54997a58af2b" />{LEGAL_ENTITY_TYPE}<SiteText copyKey="site.app.terms.page.19e7d8ff6b4a" />{UNIFIED_SOCIAL_CREDIT_CODE}。
        </p>
        <p><SiteText copyKey="site.app.terms.page.7ffa05ca5caa" /></p>
      </>
    ),
  },
  {
    id: 'service-and-price',
    title: '服务内容与价格',
    content: (
      <>
        <p><SiteText copyKey="site.app.terms.page.c162daee2814" /><Link href="/peiwanList"><SiteText copyKey="site.app.terms.page.01258d8583fe" /></Link><SiteText copyKey="site.app.terms.page.7123c1068339" /></p>
        <p><SiteText copyKey="site.app.terms.page.26fffae95652" /></p>
      </>
    ),
  },
  {
    id: 'account',
    title: '账户与身份信息',
    content: (
      <>
        <p><SiteText copyKey="site.app.terms.page.8ccca0807e67" /></p>
        <p><SiteText copyKey="site.app.terms.page.5691ccd11f7c" /></p>
      </>
    ),
  },
  {
    id: 'orders',
    title: '下单与服务履行',
    content: (
      <>
        <p><SiteText copyKey="site.app.terms.page.39bb5124e310" /></p>
        <p><SiteText copyKey="site.app.terms.page.b59ea62e1a19" /></p>
      </>
    ),
  },
  {
    id: 'cancellation',
    title: '取消、退款与售后',
    content: (
      <>
        <ul>
          <li><SiteText copyKey="site.app.terms.page.503a352b30ba" /></li>
          <li><SiteText copyKey="site.app.terms.page.71161b79dcee" /></li>
          <li><SiteText copyKey="site.app.terms.page.bee7e1d3d784" /></li>
          <li><SiteText copyKey="site.app.terms.page.a1aa42471b12" /></li>
        </ul>
        <p><SiteText copyKey="site.app.terms.page.d5e8363e7543" /><Link href="/recharge-policy"><SiteText copyKey="site.app.terms.page.023f8ed78381" /></Link><SiteText copyKey="site.app.terms.page.eda4b7d10418" /></p>
      </>
    ),
  },
  {
    id: 'payment',
    title: '充值与付款',
    content: (
      <>
        <p><SiteText copyKey="site.app.terms.page.2766e4cde2eb" /></p>
        <p><SiteText copyKey="site.app.terms.page.90bf74ef55ab" /></p>
      </>
    ),
  },
  {
    id: 'conduct',
    title: '使用规范',
    content: (
      <>
        <p><SiteText copyKey="site.app.terms.page.d03ae49ddcf6" /></p>
        <ul>
          <li><SiteText copyKey="site.app.terms.page.9cdc7c43185c" /></li>
          <li><SiteText copyKey="site.app.terms.page.cf9d4c6fa1a4" /></li>
          <li><SiteText copyKey="site.app.terms.page.fb84c317fe3f" /></li>
        </ul>
        <p><SiteText copyKey="site.app.terms.page.3e00f71c7970" /></p>
      </>
    ),
  },
  {
    id: 'changes',
    title: '规则更新与责任边界',
    content: (
      <>
        <p><SiteText copyKey="site.app.terms.page.3326e2b455c5" /></p>
        <p><SiteText copyKey="site.app.terms.page.042e13f501c3" /></p>
      </>
    ),
  },
  {
    id: 'contact',
    title: '联系客服与争议处理',
    content: (
      <>
        <p><SiteText copyKey="site.app.terms.page.5e7eac99ccae" /><strong>{SUPPORT_WECHAT_ID}</strong><SiteText copyKey="site.app.terms.page.30f4d7cfe8c3" /><a href={SUPPORT_DISCORD_URL} target="_blank" rel="noopener noreferrer"><SiteText copyKey="site.app.terms.page.2de1f9bcd32f" /></a><SiteText copyKey="site.app.terms.page.943890947c37" /></p>
        <p><SiteText copyKey="site.app.terms.page.7f7afef79045" /><a href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a>。
        </p>
        <p><SiteText copyKey="site.app.terms.page.2b26526fcea1" /></p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="用户协议"
      description="本协议说明点了么娱乐公会网站的服务内容、价格确认、账户使用、订单履行、取消退款和售后规则。"
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      sections={sections}
    />
  );
}
