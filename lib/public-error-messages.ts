/** Expected display text, not an arbitrary transport/runtime error. */
export class PublicMessageError extends Error {}
export const publicMessage = (error: unknown, fallback: string) =>
  error instanceof PublicMessageError ? error.message : fallback;

export function knownPublicMessage(error: unknown, messages: Readonly<Record<string, string>>, fallback: string): string {
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  return Object.hasOwn(messages, message) ? messages[message] : fallback;
}

export const voucherFailureMessage = (error: unknown) => knownPublicMessage(error, {
  no_voucher: 'no_voucher',
  no_card: 'no_card',
  user_not_found: 'user_not_found',
  discord_required: 'discord_required',
  missing_user: 'missing_user',
  missing_target: 'missing_target',
  missing_fields: 'missing_fields',
  review_too_long: 'review_too_long',
  '账号绑定状态已变化或缺少身份凭证，请刷新后重新确认用券对象。': '账号状态已变化，请刷新后重新确认用券对象。',
  '券状态在使用期间发生变化，请刷新后重新确认。': '券状态已变化，请刷新后重新确认。',
}, '暂时无法使用该券，请先核对券状态或联系客服。');

export const wechatBindErrorMessage = (code: unknown) => knownPublicMessage(code, {
  unauthorized: '当前登录态无效，请重新登录后再试。',
  unsupported_session_source: '当前页面只支持网站端发起绑定微信。',
  dlm_user_not_found: '当前账号未找到，请重新登录后再试。',
  last_login_method_forbidden: '至少还要保留一种登录方式，不能解绑最后一个渠道。',
  channel_not_bound: '当前账号还没有绑定微信。',
  unbind_failed: '解绑失败，请稍后再试。',
}, '微信绑定暂不可用，请稍后再试或联系客服。');

export const RECHARGE_UNCONFIRMED = '暂时无法确认充值订单，请先查看充值记录；如已付款，请勿重复支付并联系客服。';
export const giftReviewPublicMessage = (review: { status: string; verified: boolean; reverted: boolean }) => {
  if (review.verified && review.status === 'COMPLETED') return review.reverted
    ? '这笔打赏已有撤回记录，请查看余额；如有疑问请联系客服。'
    : '这笔打赏已完成，本次查询不会重复扣款。';
  if (review.verified && review.status === 'ABANDONED') return '这笔打赏已取消。本次操作不退款；如需再次打赏，请重新确认。';
  return '打赏结果仍需核实，请查询进度或联系客服，勿重复打赏。';
};
export const rechargeErrorMessage = (error: unknown) => knownPublicMessage(error, {
  unauthorized: 'unauthorized',
  invalid_json: 'invalid_json',
  invalid_amount: 'invalid_amount',
  amount_too_small: 'amount_too_small',
  unsupported_stripe_recharge_amount: 'unsupported_stripe_recharge_amount',
  unsupported_stripe_currency: '暂不支持该 Stripe 支付币种。',
  stripe_amount_too_small: 'Stripe 最低付款金额约为 50 美分',
}, RECHARGE_UNCONFIRMED);
