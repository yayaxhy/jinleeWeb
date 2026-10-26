import { localizeSiteMetadata } from "@/lib/site-copy-metadata";
import { getSiteCopy } from "@/lib/site-copy-server";

import { SiteText } from "@/components/SiteCopyProvider";
import type { Metadata } from 'next';

import { LegalDocument } from '@/components/legal/LegalDocument';
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_ENTITY_NAME,
  PUBLIC_CONTACT_EMAIL,
  SUPPORT_DISCORD_URL,
  SUPPORT_WECHAT_ID,
} from '@/lib/legal';

const defaultMetadata: Metadata = {
  title: '隐私政策｜点了么娱乐公会',
  description: '点了么娱乐公会收集、使用、保存和保护个人信息的规则。',
  alternates: { canonical: '/privacy' },
};

export async function generateMetadata(): Promise<Metadata> {
  return localizeSiteMetadata(defaultMetadata, await getSiteCopy(), "site.app.privacy.page");
}


const sections = [
  {
    id: 'scope',
    title: '适用范围与个人信息处理者',
    content: (
      <>
        <p><SiteText copyKey="site.app.privacy.page.9ae86831cc1f" /><strong>{LEGAL_ENTITY_NAME}</strong>。
        </p>
        <p><SiteText copyKey="site.app.privacy.page.b6604e730400" /></p>
      </>
    ),
  },
  {
    id: 'collection',
    title: '我们收集的信息',
    content: (
      <>
        <ul>
          <li><strong><SiteText copyKey="site.app.privacy.page.fadbc797c16b" /></strong><SiteText copyKey="site.app.privacy.page.83bc21f1c3cd" /></li>
          <li><strong><SiteText copyKey="site.app.privacy.page.48f3aa50c02e" /></strong><SiteText copyKey="site.app.privacy.page.17fb998b220f" /></li>
          <li><strong><SiteText copyKey="site.app.privacy.page.fca1af16b7c7" /></strong><SiteText copyKey="site.app.privacy.page.b72371c06129" /></li>
          <li><strong><SiteText copyKey="site.app.privacy.page.b690585c6115" /></strong><SiteText copyKey="site.app.privacy.page.34f94daeaae2" /></li>
        </ul>
        <p><SiteText copyKey="site.app.privacy.page.20663e65bfe0" /></p>
      </>
    ),
  },
  {
    id: 'purpose',
    title: '我们如何使用信息',
    content: (
      <>
        <ul>
          <li><SiteText copyKey="site.app.privacy.page.3a50b78a7cdb" /></li>
          <li><SiteText copyKey="site.app.privacy.page.79b98e7c5e88" /></li>
          <li><SiteText copyKey="site.app.privacy.page.fa17f58c4cb9" /></li>
          <li><SiteText copyKey="site.app.privacy.page.e763bfb3006a" /></li>
          <li><SiteText copyKey="site.app.privacy.page.d2a8b0c771a4" /></li>
        </ul>
        <p><SiteText copyKey="site.app.privacy.page.855c0c2c60be" /></p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookie 与保存期限',
    content: (
      <>
        <p><SiteText copyKey="site.app.privacy.page.824b49c3e129" /></p>
        <p><SiteText copyKey="site.app.privacy.page.f1b5841b38e8" /></p>
      </>
    ),
  },
  {
    id: 'sharing',
    title: '委托处理、共享与第三方服务',
    content: (
      <>
        <p><SiteText copyKey="site.app.privacy.page.508534feb748" /></p>
        <ul>
          <li><SiteText copyKey="site.app.privacy.page.2a9102c640f9" /></li>
          <li><SiteText copyKey="site.app.privacy.page.5b806c01fe43" /></li>
          <li><SiteText copyKey="site.app.privacy.page.847ffa4344ed" /></li>
          <li><SiteText copyKey="site.app.privacy.page.d969055cb867" /></li>
        </ul>
        <p><SiteText copyKey="site.app.privacy.page.3d7e95be08ce" /></p>
      </>
    ),
  },
  {
    id: 'cross-border',
    title: '可能涉及的境外服务',
    content: (
      <>
        <p><SiteText copyKey="site.app.privacy.page.90515d0257d2" /></p>
        <p><SiteText copyKey="site.app.privacy.page.ca6c60999b49" /></p>
      </>
    ),
  },
  {
    id: 'rights',
    title: '您的个人信息权利',
    content: (
      <>
        <p><SiteText copyKey="site.app.privacy.page.17173783418a" /></p>
        <p><SiteText copyKey="site.app.privacy.page.4ead0e900508" /></p>
      </>
    ),
  },
  {
    id: 'security',
    title: '信息安全',
    content: (
      <>
        <p><SiteText copyKey="site.app.privacy.page.915811289d1e" /></p>
      </>
    ),
  },
  {
    id: 'minors',
    title: '未成年人保护',
    content: (
      <>
        <p><SiteText copyKey="site.app.privacy.page.ac76771bfb6c" /></p>
      </>
    ),
  },
  {
    id: 'contact',
    title: '政策更新与联系我们',
    content: (
      <>
        <p><SiteText copyKey="site.app.privacy.page.1b969e23e283" /><strong> {SUPPORT_WECHAT_ID}</strong><SiteText copyKey="site.app.privacy.page.30f4d7cfe8c3" /><a href={SUPPORT_DISCORD_URL} target="_blank" rel="noopener noreferrer"><SiteText copyKey="site.app.privacy.page.c9946f2525ae" /></a><SiteText copyKey="site.app.privacy.page.1de6ba2d0457" /></p>
        <p><SiteText copyKey="site.app.privacy.page.7f7afef79045" /><a href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a>。
        </p>
        <p><SiteText copyKey="site.app.privacy.page.baec6c2b9f3c" /></p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Privacy"
      title="隐私政策"
      description="本政策说明我们在提供账户、陪玩、充值和售后服务时如何收集、使用、保存和保护个人信息，以及您如何行使相关权利。"
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      sections={sections}
    />
  );
}
