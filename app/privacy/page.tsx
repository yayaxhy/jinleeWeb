import type { Metadata } from 'next';

import { LegalDocument } from '@/components/legal/LegalDocument';
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_ENTITY_NAME,
  PUBLIC_CONTACT_EMAIL,
  SUPPORT_DISCORD_URL,
  SUPPORT_WECHAT_ID,
} from '@/lib/legal';

export const metadata: Metadata = {
  title: '隐私政策｜锦鲤公会',
  description: '锦鲤公会收集、使用、保存和保护个人信息的规则。',
  alternates: { canonical: '/privacy' },
};

const sections = [
  {
    id: 'scope',
    title: '适用范围与个人信息处理者',
    content: (
      <>
        <p>
          本政策适用于您访问锦鲤公会网站，以及使用账户、充值、陪玩需求、订单和售后等相关功能的过程。个人信息处理者为
          <strong>{LEGAL_ENTITY_NAME}</strong>。
        </p>
        <p>第三方网站或服务由相应第三方独立运营，其个人信息处理活动适用其自身隐私规则。</p>
      </>
    ),
  },
  {
    id: 'collection',
    title: '我们收集的信息',
    content: (
      <>
        <ul>
          <li><strong>账户与身份信息：</strong>锦鲤账户标识，以及您通过 Discord 或微信授权提供的用户标识、昵称、头像和绑定状态。</li>
          <li><strong>服务与互动信息：</strong>您提交的游戏、区服、服务需求、订单、评价、消息、售后记录，以及您主动上传或提供的内容。</li>
          <li><strong>充值与交易信息：</strong>订单号、充值金额、支付渠道、支付状态、第三方交易参考号、退款和售后状态。银行卡号等支付账户核心信息通常由支付机构直接处理。</li>
          <li><strong>设备与日志信息：</strong>IP 地址或其加密、摘要形式，浏览器和设备类型、访问页面、访问时间、来源页面、Cookie 标识及登录安全事件；我们可能根据登录 IP 记录粗略的国家、地区或城市信息，不用于精确定位。</li>
        </ul>
        <p>请不要在公开区域或非必要场景中提交身份证件、银行卡完整号码、密码、验证码等敏感信息。</p>
      </>
    ),
  },
  {
    id: 'purpose',
    title: '我们如何使用信息',
    content: (
      <>
        <ul>
          <li>创建、识别和保护账户，完成 Discord 或微信登录与绑定；</li>
          <li>展示陪玩信息、处理需求、履行订单、完成充值到账和退款售后；</li>
          <li>发送必要的服务通知，回复咨询、投诉和争议；</li>
          <li>防范欺诈、账号滥用和系统攻击，排查故障并改进服务质量；</li>
          <li>履行财务、税务、网络安全、消费者权益保护等法定义务。</li>
        </ul>
        <p>如需将个人信息用于与上述目的没有直接或合理关联的新用途，我们会依法另行告知，并在需要时取得您的同意。</p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookie 与保存期限',
    content: (
      <>
        <p>
          网站使用必要 Cookie 维持登录状态、识别访问和保障安全。登录会话通常保存 7 天；访客标识 Cookie 最长约 1 年。您可通过浏览器清除 Cookie，但部分登录和账户功能可能因此无法正常使用。
        </p>
        <p>
          我们仅在实现本政策所述目的所需的最短期限内保存个人信息。登录安全记录通常保存约 1 年；账户资料在账户存续及处理删除请求所需期间保存；交易、退款、售后和财务记录按适用法律及解决争议所需期限保存。期限届满后将依法删除或匿名化处理，但法律另有规定的除外。
        </p>
      </>
    ),
  },
  {
    id: 'sharing',
    title: '委托处理、共享与第三方服务',
    content: (
      <>
        <p>我们不会出售您的个人信息。为实现必要功能，相关信息可能按最小必要原则提供给下列服务方：</p>
        <ul>
          <li>Discord、微信等账户登录、绑定及沟通服务提供方；</li>
          <li>支付宝、微信支付、银行卡收单等支付和退款服务提供方；</li>
          <li>网站托管、内容分发、数据库、安全防护和技术支持服务提供方；</li>
          <li>依法有权查询的行政、司法或其他主管机关。</li>
        </ul>
        <p>
          对受托处理个人信息的服务方，我们会依法约定处理目的、期限、方式、信息种类和保护措施，并进行必要监督。发生合并、分立、转让等主体变更时，我们会依法告知接收方信息并要求其继续受本政策约束。
        </p>
      </>
    ),
  },
  {
    id: 'cross-border',
    title: '可能涉及的境外服务',
    content: (
      <>
        <p>
          当您主动选择 Discord 或境外银行卡收单等服务时，相应第三方可能在境外处理与该功能有关的信息。具体处理方式以第三方隐私政策为准，您可选择不使用相应渠道。
        </p>
        <p>如相关处理构成向境外提供个人信息，我们将按照适用法律履行相应的告知、同意及个人信息出境程序。</p>
      </>
    ),
  },
  {
    id: 'rights',
    title: '您的个人信息权利',
    content: (
      <>
        <p>
          您可以依法请求查阅、复制、更正、补充或删除个人信息，撤回基于同意作出的授权，注销账户，并要求说明个人信息处理规则。
          撤回同意不影响撤回前基于同意已经进行的处理活动。
        </p>
        <p>
          提交请求时，我们可能为保护账户安全而核验身份。法律法规规定的保存期限未届满，或删除在技术上难以实现时，我们将停止除存储和采取必要安全保护措施之外的处理。
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: '信息安全',
    content: (
      <>
        <p>
          我们采取与业务规模相适应的访问控制、传输保护、日志审计和数据最小化等措施保护个人信息。互联网环境无法保证绝对安全；发生可能影响您权益的安全事件时，我们会依法采取补救措施并履行通知或报告义务。
        </p>
      </>
    ),
  },
  {
    id: 'minors',
    title: '未成年人保护',
    content: (
      <>
        <p>
          未满 18 周岁的用户应在监护人指导下使用本服务。对于不满 14 周岁未成年人的个人信息，我们会按照法律规定取得监护人同意并采取专门保护措施。若监护人发现相关信息未经同意被处理，请及时联系我们。
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: '政策更新与联系我们',
    content: (
      <>
        <p>
          本政策发生重大变化时，我们会通过网站显著提示等合理方式告知。个人信息相关问题、投诉或权利请求，可通过微信
          <strong> {SUPPORT_WECHAT_ID}</strong> 或
          <a href={SUPPORT_DISCORD_URL} target="_blank" rel="noopener noreferrer"> Discord 客服频道</a> 联系。
        </p>
        <p>
          网站负责人邮箱：<a href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a>。
        </p>
        <p>我们会核实请求并在法律规定期限内答复。为保护信息安全，请勿通过公开频道发送证件原件、支付密码或验证码。</p>
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
