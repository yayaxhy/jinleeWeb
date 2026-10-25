/** Explicitly approved display text, not an arbitrary transport/runtime error. */
export class PublicMessageError extends Error {}
export const publicMessage = (error: unknown, fallback: string) =>
  error instanceof PublicMessageError ? error.message : fallback;

export function knownPublicMessage(error: unknown, messages: Readonly<Record<string, string>>, fallback: string): string {
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  return Object.hasOwn(messages, message) ? messages[message] : fallback;
}

export const voucherFailureMessage = (error: unknown) => knownPublicMessage(error, {
  no_voucher: '没有可用的券，或该券已使用、已过期，请刷新后查看。',
  no_card: '没有可用的靓号卡，请刷新后查看。',
  user_not_found: '未找到可用账号，请重新登录或联系客服。',
  discord_required: '请先绑定 Discord 账号。',
  missing_user: '请重新登录后确认用券。',
  missing_target: '请选择使用对象。',
  missing_fields: '请补全信息后再提交。',
  review_too_long: '评语过长，请缩短后再提交。',
  '账号绑定状态已变化或缺少身份凭证，请刷新后重新确认用券对象。': '账号状态已变化，请刷新后重新确认用券对象。',
  '券状态在使用期间发生变化，请刷新后重新确认。': '券状态已变化，请刷新后重新确认。',
}, '暂时无法使用该券，请先核对券状态或联系客服。');

export const wechatBindErrorMessage = (code: unknown) => knownPublicMessage(code, {
  unauthorized: '请重新登录后再试。',
  unsupported_session_source: '请在网站中发起微信绑定。',
  dlm_user_not_found: '未找到当前账号，请重新登录后再试。',
  last_login_method_forbidden: '至少需要保留一种登录方式，不能解绑最后一个渠道。',
  channel_not_bound: '当前账号还没有绑定微信。',
  unbind_failed: '暂时无法解绑微信，请稍后查看绑定状态或联系客服。',
}, '微信绑定暂不可用，请稍后再试或联系客服。');

export const RECHARGE_UNCONFIRMED = '暂时无法确认充值订单，请先查看充值记录；如已付款，请勿重复支付并联系客服。';
export const giftReviewPublicMessage = (review: { status: string; verified: boolean; reverted: boolean }) => {
  if (review.verified && review.status === 'COMPLETED') return review.reverted
    ? '这笔赠礼已有撤回记录，请查看余额；如有疑问请联系客服。'
    : '这笔赠礼已完成，本次查询不会重复扣款。';
  if (review.verified && review.status === 'ABANDONED') return '这笔赠礼已取消。本次操作不退款；如需再次赠礼，请重新确认。';
  return '赠礼结果仍需核实，请查询进度或联系客服，勿重复赠礼。';
};
export const rechargeErrorMessage = (error: unknown) => knownPublicMessage(error, {
  unauthorized: '请先登录后再充值。',
  invalid_json: '提交信息有误，请刷新页面后重新选择。',
  invalid_amount: '请选择有效的充值金额。',
  amount_too_small: '充值金额低于最低要求，请选择更高金额。',
  unsupported_stripe_recharge_amount: '暂不支持该充值金额，请重新选择。',
  unsupported_stripe_currency: '暂不支持该支付币种，请重新选择。',
  stripe_amount_too_small: '当前金额低于银行卡支付的最低要求，请选择更高金额。',
}, RECHARGE_UNCONFIRMED);
