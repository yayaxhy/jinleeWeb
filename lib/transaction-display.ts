export const formatTransactionType = (type?: string | null) => {
  if (type === 'Stripe充值') return '信用卡/银行卡充值';
  return type ?? '—';
};
