import { localizeSiteMetadata } from "@/lib/site-copy-metadata";
import { getSiteCopy } from "@/lib/site-copy-server";

import { SiteText } from "@/components/SiteCopyProvider";
import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalDocument } from '@/components/legal/LegalDocument';
import {
  LEGAL_EFFECTIVE_DATE,
  PUBLIC_CONTACT_EMAIL,
  SUPPORT_DISCORD_URL,
  SUPPORT_WECHAT_ID,
} from '@/lib/legal';

const defaultMetadata: Metadata = {
  title: '充值余额与退款规则｜点了么娱乐公会',
  description: '点了么娱乐公会充值余额有效期、未消费余额退款、订单取消和售后处理规则。',
  alternates: { canonical: '/recharge-policy' },
};

export async function generateMetadata(): Promise<Metadata> {
  return localizeSiteMetadata(defaultMetadata, await getSiteCopy(), "site.app.recharge.policy.page");
}


const sections = [
  {
    id: 'balance',
    title: '充值到账与余额有效期',
    content: (
      <>
        <ul>
          <li><SiteText copyKey="site.app.recharge.policy.page.8870769434c0" /></li>
          <li><strong><SiteText copyKey="site.app.recharge.policy.page.773b77fca2cf" /></strong><SiteText copyKey="site.app.recharge.policy.page.f2b7152ad666" /></li>
          <li><SiteText copyKey="site.app.recharge.policy.page.76025f2e8594" /></li>
          <li><SiteText copyKey="site.app.recharge.policy.page.868bf6da83ef" /></li>
        </ul>
      </>
    ),
  },
  {
    id: 'payment',
    title: '充值前请核对',
    content: (
      <>
        <p><SiteText copyKey="site.app.recharge.policy.page.e594295fbce2" /><Link href="/recharge"><SiteText copyKey="site.app.recharge.policy.page.4a11db2e2867" /></Link><SiteText copyKey="site.app.recharge.policy.page.16293cf40557" /></p>
        <p><SiteText copyKey="site.app.recharge.policy.page.e1d7d844ef61" /></p>
      </>
    ),
  },
  {
    id: 'unused-refund',
    title: '未消费余额退款',
    content: (
      <>
        <p><strong><SiteText copyKey="site.app.recharge.policy.page.7ea1674fc7bc" /></strong><SiteText copyKey="site.app.recharge.policy.page.52b4c22858f0" /></p>
        <p><SiteText copyKey="site.app.recharge.policy.page.6b31fa55274a" /></p>
      </>
    ),
  },
  {
    id: 'cancellation',
    title: '陪玩订单取消',
    content: (
      <>
        <ul>
          <li><strong><SiteText copyKey="site.app.recharge.policy.page.2a72a4564eb2" /></strong><SiteText copyKey="site.app.recharge.policy.page.fb2fd46c188a" /></li>
          <li><SiteText copyKey="site.app.recharge.policy.page.79de76255f2d" /></li>
          <li><SiteText copyKey="site.app.recharge.policy.page.eeaba58fe463" /></li>
        </ul>
      </>
    ),
  },
  {
    id: 'service-issues',
    title: '迟到、缺席或中途结束',
    content: (
      <>
        <p><SiteText copyKey="site.app.recharge.policy.page.2231a7dc5203" /></p>
      </>
    ),
  },
  {
    id: 'process',
    title: '申请材料与处理时间',
    content: (
      <>
        <p><SiteText copyKey="site.app.recharge.policy.page.6dfb841cec97" /></p>
        <ul>
          <li><SiteText copyKey="site.app.recharge.policy.page.425e65033f34" /></li>
          <li><SiteText copyKey="site.app.recharge.policy.page.91cf9b32cc6c" /></li>
          <li><SiteText copyKey="site.app.recharge.policy.page.d35a014ac573" /></li>
        </ul>
        <p><SiteText copyKey="site.app.recharge.policy.page.87604c20cd11" /><strong><SiteText copyKey="site.app.recharge.policy.page.ac1c003bfbe3" /></strong><SiteText copyKey="site.app.recharge.policy.page.cc68757402d7" /></p>
      </>
    ),
  },
  {
    id: 'exceptions',
    title: '安全核验与异常情形',
    content: (
      <>
        <p><SiteText copyKey="site.app.recharge.policy.page.4ef12c576ab3" /></p>
        <p><SiteText copyKey="site.app.recharge.policy.page.1aaa3ad3b92c" /></p>
      </>
    ),
  },
  {
    id: 'contact',
    title: '售后联系方式',
    content: (
      <>
        <p><SiteText copyKey="site.app.recharge.policy.page.0a9d4593aced" /><strong>{SUPPORT_WECHAT_ID}</strong>
        </p>
        <p><SiteText copyKey="site.app.recharge.policy.page.960189df3fc9" /><a href={SUPPORT_DISCORD_URL} target="_blank" rel="noopener noreferrer"><SiteText copyKey="site.app.recharge.policy.page.e65af5c777e4" /></a>
        </p>
        <p><SiteText copyKey="site.app.recharge.policy.page.7f7afef79045" /><a href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a>
        </p>
        <p><SiteText copyKey="site.app.recharge.policy.page.34c3799a2e45" /></p>
      </>
    ),
  },
];

export default function RechargePolicyPage() {
  return (
    <LegalDocument
      copyNamespace="site.app.recharge.policy.page"
      eyebrow="Payment & Refund"
      title="充值余额与退款规则"
      description="本规则明确充值比例、余额有效期、未消费余额退款、接单后取消及异常服务的售后处理方式。"
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      sections={sections}
    />
  );
}
