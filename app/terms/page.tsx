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

export const metadata: Metadata = {
  title: '用户协议｜点了么娱乐公会',
  description: '点了么娱乐公会网站服务、账户、下单、付款、取消及售后相关约定。',
  alternates: { canonical: '/terms' },
};

const sections = [
  {
    id: 'operator',
    title: '运营主体与协议范围',
    content: (
      <>
        <p>
          本网站及“点了么娱乐公会 / DLMClub”相关网站服务由<strong>{LEGAL_ENTITY_NAME}</strong>运营，主体类型为
          {LEGAL_ENTITY_TYPE}，统一社会信用代码为 {UNIFIED_SOCIAL_CREDIT_CODE}。
        </p>
        <p>
          本协议适用于您访问网站、注册或绑定账户、充值、提交陪玩需求、购买或使用陪玩服务，以及使用相关售后服务的过程。
          当您注册、下单、付款或继续使用相关功能，即表示您已阅读并同意本协议及页面明确引用的规则。
        </p>
      </>
    ),
  },
  {
    id: 'service-and-price',
    title: '服务内容与价格',
    content: (
      <>
        <p>
          平台提供游戏陪玩信息展示、需求沟通、订单协助、账户充值和售后协调等服务。具体可选陪玩、游戏项目及价格以
          <Link href="/peiwanList">陪玩列表</Link>实时展示为准；陪玩卡片以“币/小时”标示服务单价。
        </p>
        <p>
          实际服务对象、游戏、时长、开始时间、价格和其他个性化要求，以您在下单或沟通确认环节最终确认的内容为准。
          如页面价格与最终确认内容不一致，平台应在您付款或余额扣减前向您明确说明并取得确认。
        </p>
      </>
    ),
  },
  {
    id: 'account',
    title: '账户与身份信息',
    content: (
      <>
        <p>
          部分功能需要通过 Discord 或微信登录、绑定或识别账户。您应提供真实、准确且属于您本人的账户信息，并妥善保管登录状态、验证码和设备。
        </p>
        <p>
          因您主动泄露凭证、将账户交由他人使用等原因造成的损失，由责任方依法承担；如发现异常登录或非本人操作，请立即联系客服处理。
        </p>
      </>
    ),
  },
  {
    id: 'orders',
    title: '下单与服务履行',
    content: (
      <>
        <p>
          您应在下单时说明游戏、区服、预计时长和合理需求。陪玩接单后，双方应按确认的时间和内容履行服务，并遵守游戏平台规则及正常社交边界。
        </p>
        <p>
          网络波动、游戏维护、账号限制或其他不可归责于一方的情况影响履行时，请及时保留记录并联系客服协商改期、补时或其他处理方案。
        </p>
      </>
    ),
  },
  {
    id: 'cancellation',
    title: '取消、退款与售后',
    content: (
      <>
        <ul>
          <li>陪玩接单后 5 分钟内，您可以取消并退款。</li>
          <li>超过上述时间或服务已经开始的，按已实际履行的服务情况和双方确认内容处理。</li>
          <li>陪玩迟到、缺席或中途结束服务时，请联系客服售后；客服将核实订单与沟通记录后协调处理。</li>
          <li>充值余额的有效期、未消费余额退款方式和处理时间，以《充值余额与退款规则》为准。</li>
        </ul>
        <p>
          详细规则请查看<Link href="/recharge-policy">充值余额与退款规则</Link>。本协议不排除或限制消费者依法享有的权利。
        </p>
      </>
    ),
  },
  {
    id: 'payment',
    title: '充值与付款',
    content: (
      <>
        <p>
          网站可能提供支付宝、微信支付和银行卡等付款渠道，实际可用渠道以充值页面为准。人民币 1 元充值后增加 1 单位账户余额；支付前请核对金额、渠道和收款页面信息。
        </p>
        <p>
          充值余额永久有效。充值余额仅用于平台内支持的服务和功能，不具备储蓄、理财或利息属性，也不能通过普通提现功能直接提现；未消费余额可按退款规则联系客服申请退款。
        </p>
      </>
    ),
  },
  {
    id: 'conduct',
    title: '使用规范',
    content: (
      <>
        <p>使用网站和陪玩服务时，不得实施违法违规、欺诈、骚扰、侵害他人权益或破坏平台系统安全的行为，包括但不限于：</p>
        <ul>
          <li>利用服务从事代练作弊、账号盗用、非法交易或规避游戏平台规则的活动；</li>
          <li>发布违法、有害、侮辱、歧视、骚扰或侵犯隐私的内容；</li>
          <li>未经授权访问系统、批量抓取数据、干扰接口或绕过安全措施。</li>
        </ul>
        <p>平台可依法采取提醒、限制功能、暂停服务或向有关部门报告等必要措施，并保留追究责任的权利。</p>
      </>
    ),
  },
  {
    id: 'changes',
    title: '规则更新与责任边界',
    content: (
      <>
        <p>
          因业务、服务流程或法律法规变化需要更新本协议时，平台会通过网站公示等合理方式告知。对您权利义务有重大影响的变更，将依法采用显著方式提示。
        </p>
        <p>
          平台将依法保障服务安全并处理合理投诉。任何责任限制均不适用于因故意或重大过失造成损害、侵害人身权益，或法律规定不得限制或免除责任的情形。
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: '联系客服与争议处理',
    content: (
      <>
        <p>
          售后与投诉可通过微信 <strong>{SUPPORT_WECHAT_ID}</strong> 或
          <a href={SUPPORT_DISCORD_URL} target="_blank" rel="noopener noreferrer"> Discord 客服</a> 联系。为便于核实，请提供会员账户标识、订单号、问题说明和必要的支付或沟通记录。
        </p>
        <p>
          网站负责人邮箱：<a href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a>。
        </p>
        <p>
          双方应先友好协商处理争议；协商不成的，可依法向有管辖权的人民法院提起诉讼，或通过法律允许的其他途径解决。
        </p>
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
