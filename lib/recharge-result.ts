export type RechargeResultSearchParams = Record<string, string | string[] | undefined>;

export type RechargeResultOrder = {
  id: string;
  amount: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  paidAt: string | null;
};

export type RechargeResultState = RechargeResultOrder['status'] | 'CHECKING' | 'NOT_FOUND' | 'ERROR' | 'UNAUTHORIZED';

export const resolveRechargeResultOrderId = (params: RechargeResultSearchParams) => {
  const candidate = params.out_trade_no ?? params.order;
  if (typeof candidate !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(candidate)) return null;
  return candidate;
};

export const belongsToRechargeUser = (
  order: { jinleeId: string | null; discordUserId: string | null },
  user: { jinleeId: string; discordUserId: string | null },
) => {
  if (order.jinleeId) return order.jinleeId === user.jinleeId;
  return Boolean(order.discordUserId && user.discordUserId && order.discordUserId === user.discordUserId);
};

export const parseRechargeResultOrder = (value: unknown, expectedId: string): RechargeResultOrder | null => {
  if (!value || typeof value !== 'object') return null;
  const order = value as Record<string, unknown>;
  if (
    order.id !== expectedId ||
    typeof order.amount !== 'string' ||
    (order.status !== 'PENDING' && order.status !== 'PAID' && order.status !== 'FAILED')
  ) {
    return null;
  }
  return {
    id: expectedId,
    amount: order.amount,
    status: order.status,
    paidAt: typeof order.paidAt === 'string' ? order.paidAt : null,
  };
};

export const getRechargeResultMessage = (state: RechargeResultState, pollingComplete = false) => {
  switch (state) {
    case 'PAID':
      return { title: '充值成功！', description: '系统已确认到账，可前往个人中心查看余额。' };
    case 'PENDING':
      return pollingComplete
        ? { title: '充值尚未确认', description: '若已完成付款但仍未到账，请联系客服核实。' }
        : { title: '等待充值确认', description: '正在确认到账状态，请稍候。' };
    case 'FAILED':
      return { title: '订单已关闭', description: '此订单未确认充值到账。若已付款，请联系客服核实。' };
    case 'NOT_FOUND':
      return { title: '无法确认充值状态', description: '未找到本次充值订单，请返回充值页面或联系客服核实。' };
    case 'UNAUTHORIZED':
      return { title: '登录已过期', description: '请重新登录后查看充值订单。' };
    case 'ERROR':
      return { title: '暂时无法查询充值状态', description: '请稍后刷新本页。若已付款仍未到账，请联系客服核实。' };
    default:
      return { title: '正在查询充值状态', description: '请稍候，正在确认本次充值的到账状态。' };
  }
};
