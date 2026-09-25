import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalDocument } from '@/components/legal/LegalDocument';
import {
  LEGAL_EFFECTIVE_DATE,
  PUBLIC_CONTACT_EMAIL,
  SUPPORT_DISCORD_URL,
  SUPPORT_WECHAT_ID,
} from '@/lib/legal';

export const metadata: Metadata = {
  title: '充值余额与退款规则｜点了么娱乐公会',
  description: '点了么娱乐公会充值余额有效期、未消费余额退款、订单取消和售后处理规则。',
  alternates: { canonical: '/recharge-policy' },
};

const sections = [
  {
    id: 'balance',
    title: '充值到账与余额有效期',
    content: (
      <>
        <ul>
          <li>人民币 1 元充值后增加 1 单位账户余额，到账金额以充值订单和账户记录为准。</li>
          <li><strong>充值余额永久有效</strong>，不会仅因长时间未使用而失效。</li>
          <li>余额可用于平台内支持的陪玩服务或其他明确展示的功能，不产生利息，不具备储蓄或理财属性。</li>
          <li>充值余额不能通过普通提现功能直接提现；未消费余额需要按照本规则联系客服申请退款。</li>
        </ul>
      </>
    ),
  },
  {
    id: 'payment',
    title: '充值前请核对',
    content: (
      <>
        <p>
          创建充值订单前，请核对登录账户、充值金额和支付渠道。支付宝、微信支付或银行卡等渠道是否可用，以
          <Link href="/recharge">充值页面</Link>当时展示为准。
        </p>
        <p>支付成功后系统通常自动到账；如长时间未到账，请勿重复支付，并联系客服提供订单号和支付状态截图协助核实。</p>
      </>
    ),
  },
  {
    id: 'unused-refund',
    title: '未消费余额退款',
    content: (
      <>
        <p><strong>充值后尚未消费的余额可以申请退款。</strong>已实际用于支付服务或兑换并使用的部分，不属于未消费余额。</p>
        <p>
          退款原则上退回原支付渠道；因原渠道期限、账户状态或技术原因无法原路退回时，客服会在核验账户归属后与您确认其他合规退款方式。
          支付机构、银行或银行卡组织的实际入账时间不计入平台处理时间。
        </p>
      </>
    ),
  },
  {
    id: 'cancellation',
    title: '陪玩订单取消',
    content: (
      <>
        <ul>
          <li><strong>陪玩接单后 5 分钟内</strong>，您可以取消并退款。</li>
          <li>超过 5 分钟或服务已经开始的，客服将根据已经履行的服务时长、双方确认内容及实际情况处理。</li>
          <li>退款可先退回账户余额；如属于未消费的充值余额，您仍可依照上一条申请退回支付账户。</li>
        </ul>
      </>
    ),
  },
  {
    id: 'service-issues',
    title: '迟到、缺席或中途结束',
    content: (
      <>
        <p>
          如陪玩迟到、缺席或在约定服务完成前中途结束，请尽快联系客服售后，并保留订单、时间和沟通记录。客服核实后将根据实际履行情况协调处理，不影响您依法享有的消费者权利。
        </p>
      </>
    ),
  },
  {
    id: 'process',
    title: '申请材料与处理时间',
    content: (
      <>
        <p>申请退款或售后时，请提供：</p>
        <ul>
          <li>会员账户标识或绑定的 Discord / 微信账户信息；</li>
          <li>充值或服务订单号、申请退款金额及原因；</li>
          <li>核实问题所必需的支付截图、服务时间或沟通记录。</li>
        </ul>
        <p>
          客服受理并取得必要资料后，平台通常在<strong> 24 至 48 小时内</strong>完成审核和平台侧退款处理。
          退款提交支付渠道后，最终到账时间以支付机构或银行处理进度为准。
        </p>
      </>
    ),
  },
  {
    id: 'exceptions',
    title: '安全核验与异常情形',
    content: (
      <>
        <p>
          为防止盗刷、洗钱、账户冒用或重复退款，平台可在必要范围内核验订单和账户归属。涉嫌欺诈、付款尚未结算、支付渠道争议处理中或依法需要配合调查的订单，处理时间可能相应延长，客服会告知进展。
        </p>
        <p>客服不会索要您的支付密码、短信验证码或银行卡完整号码，请勿向任何人提供上述信息。</p>
      </>
    ),
  },
  {
    id: 'contact',
    title: '售后联系方式',
    content: (
      <>
        <p>
          微信客服：<strong>{SUPPORT_WECHAT_ID}</strong>
        </p>
        <p>
          Discord：
          <a href={SUPPORT_DISCORD_URL} target="_blank" rel="noopener noreferrer">进入客服频道</a>
        </p>
        <p>
          网站负责人邮箱：<a href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a>
        </p>
        <p>请优先通过私聊或客服工单发送订单资料，不要在公开频道披露支付凭证和个人信息。</p>
      </>
    ),
  },
];

export default function RechargePolicyPage() {
  return (
    <LegalDocument
      eyebrow="Payment & Refund"
      title="充值余额与退款规则"
      description="本规则明确充值比例、余额有效期、未消费余额退款、接单后取消及异常服务的售后处理方式。"
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      sections={sections}
    />
  );
}
