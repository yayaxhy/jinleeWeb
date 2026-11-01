export const formatTransactionType = (type?: string | null) => {
  if (type === 'Stripe充值') return '信用卡/银行卡充值';
  if (type === '人工充值' || type === '微信人工充值' || type === '充值更正转入') return '充值';
  if (type === '充值更正转出') return '充值回退';
  if (type === '人工赠礼调整') return '人工打赏调整';
  return type ?? '—';
};
