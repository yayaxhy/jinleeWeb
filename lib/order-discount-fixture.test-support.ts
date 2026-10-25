import { Prisma } from '@prisma/client';
import type { DiscountWriterDependencies } from './order-discount-audit';

// Deliberately models both PointShopGrant.orderId (purchase) and consumeOrderId.
// Isolated state rolls back on callback failure; no Prisma client is constructed.
export function discountFixture(source: 'coupon' | 'pointshop' | 'lottery' = 'coupon', special = false) {
  const d = (n: number | string) => new Prisma.Decimal(n);
  const now = new Date('2026-10-22T12:00:00Z');
  const locks: string[] = [];
  const counts = { transactions: 0, claims: 0, credits: 0, records: 0 };
  const hooks: { onOrderLock?: () => void; onMemberLock?: () => void; afterClaim?: () => void; afterCredit?: () => void; recordError?: boolean; auditError?: boolean; commitError?: boolean; contention?: number } = {};
  const base = { id: 'voucher', dlmId: 'H', expiresAt: new Date('2026-10-31T12:00:00Z'), consumeAmount: null, consumeTargetId: null, consumeTargetDlmId: null };
  const coupon = { ...base, type: special ? 'DISCOUNT_80' : 'DISCOUNT_90', status: 'ACTIVE', issuedAt: new Date('2026-10-21T12:00:00Z'), consumedAt: null, orderId: null };
  const grant = { ...base, orderId: 'shop-purchase', deliveryStatus: 'DELIVERED', deliveryType: 'COUPON', couponType: special ? 'DISCOUNT_80' : 'DISCOUNT_90', couponStatus: 'ACTIVE', issuedAt: new Date('2026-10-21T12:00:00Z'), consumedAt: null, consumeOrderId: null };
  const draw = { ...base, prizeId: 'prize-80', prize: { id: 'prize-80', name: '8折券' }, status: 'UNUSED', createdAt: new Date('2026-10-21T12:00:00Z'), consumeAt: null, consumeOrderId: null };
  // A loose state shape lets negative cases model corrupted/legacy persisted data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let state: any = {
    order: { id: 'O', hostId: 'host', hostDlmId: 'H', workerId: 'worker', status: 'ENDED', unitPrice: d(60), totalMinutes: 65, createdAt: new Date('2026-10-20T12:00:00Z') },
    audit: { orderId: 'O', paymentTransactionId: 'P', transactionOrderId: 1, hostIndividualTransactionId: 'PH', workerIndividualTransactionId: 'PW', hostId: 'host', workerId: 'worker', gross: d(100), netAmount: d(80), feeAmount: d(20) },
    payment: { Transid: 'P', orderID: 1, fromId: 'host', toId: 'worker', fromDlmId: 'H', toDlmId: 'W', amount: d(100), netAmount: d(80), feeAmount: d(20) },
    identities: [{ dlmId: 'H', discordUserId: 'host' }, { dlmId: 'W', discordUserId: 'worker' }],
    receipts: [
      { transactionId: 'PH', dlmId: 'H', discordId: 'host', thirdPartydiscordId: 'worker', typeOfTransaction: '点单', amountChange: d(100), balanceBefore: d(200), balanceAfter: d(100) },
      { transactionId: 'PW', dlmId: 'W', discordId: 'worker', thirdPartydiscordId: 'host', typeOfTransaction: '点单', amountChange: d(80), balanceBefore: d(0), balanceAfter: d(80) },
    ],
    wallet: { totalBalance: d(100), recharge: d(60), income: d(40), totalSpent: d(100) },
    coupon: source === 'coupon' ? [coupon] : [], pointShopGrant: source === 'pointshop' ? [grant] : [], lotteryDraw: source === 'lottery' ? [draw] : [], discount: null, revert: null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clone = (x: any): any => x instanceof Prisma.Decimal ? d(x.toString()) : x instanceof Date ? new Date(x) : Array.isArray(x) ? x.map(clone) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k,v]) => [k,clone(v)])) : x;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([key, value]: [string, any]) => {
    const actual = row[key];
    if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Prisma.Decimal)) {
      if ('in' in value) return value.in.includes(actual);
      if ('gt' in value) return actual != null && actual > value.gt;
      if ('lte' in value) return actual != null && actual <= value.lte;
      return matches(actual ?? {}, value);
    }
    return actual === value;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx: any = {
    $executeRaw: async (q: TemplateStringsArray) => { if(q.join('').includes('"Order"')) { locks.push('Order'); hooks.onOrderLock?.(); } return 1; },
    $queryRaw: async (q: TemplateStringsArray, id: string) => {
      const table = q.join('').includes('"DlmUser"') ? 'DlmUser' : 'Member'; locks.push(`${table}:${id}`);
      if (table === 'Member') hooks.onMemberLock?.();
      return clone(state.identities.filter((x: { dlmId: string; discordUserId: string }) => table === 'DlmUser' ? x.dlmId === id : x.discordUserId === id));
    },
    order: { findUnique: async () => clone(state.order) },
    orderAudit: { findUnique: async () => clone(state.audit) },
    transaction: { findUnique: async () => clone(state.payment) },
    dlmUser: { findUnique: async ({where}: {where: object}) => clone(state.identities.find((x: object) => matches(x,where)) ?? null) },
    revert: { findUnique: async () => clone(state.revert) },
    individualTransaction: { findUnique: async ({where}: {where: {transactionId: string}}) => clone(state.receipts.find((x: {transactionId: string}) => x.transactionId === where.transactionId) ?? null) },
    orderDiscountAudit: { findUnique: async () => clone(state.discount), create: async ({data}: {data: object}) => { if (hooks.auditError) throw Error('audit failed'); if (state.discount) throw Error('unique'); return state.discount = {...clone(data),id:'DA'}; } },
  };
  for (const table of ['coupon','pointShopGrant','lotteryDraw']) {
    tx[table] = {
      findFirst: async ({where}: {where: object}) => clone(state[table].find((x: object) => matches(x,where)) ?? null),
      findMany: async ({where}: {where: object}) => clone(state[table].filter((x: object) => matches(x,where))),
      findUnique: async ({where}: {where: object}) => clone(state[table].find((x: object) => matches(x,where)) ?? null),
      updateMany: async ({where,data}: {where: object;data: {status?: string;couponStatus?: string}}) => {
        const rows=state[table].filter((x: object)=>matches(x,where));
        for (const row of rows) Object.assign(row,clone(data));
        if ((data.status??data.couponStatus)==='USED' && rows.length) { counts.claims++; hooks.afterClaim?.(); }
        return {count:rows.length};
      },
    };
  }
  const deps: DiscountWriterDependencies = {
    db: { $transaction: async (work: (tx: Prisma.TransactionClient)=>Promise<unknown>, options: {isolationLevel: string}) => {
      if (options.isolationLevel !== 'Serializable') throw Error('isolation');
      counts.transactions++;
      if (hooks.contention && counts.transactions <= hooks.contention) throw new Prisma.PrismaClientKnownRequestError('aborted',{code:'P2034',clientVersion:'test'});
      const snapshot=clone(state);
      let result;
      try { result=await work(tx); } catch (e) { state=snapshot; throw e; }
      if (hooks.commitError) throw Error('lost commit acknowledgement');
      return result;
    } } as DiscountWriterDependencies['db'],
    getWallet: async () => clone(state.wallet),
    applyWallet: async (_tx,input) => { counts.credits++; state.wallet.recharge=state.wallet.recharge.add(input.rechargeDelta); state.wallet.totalBalance=state.wallet.totalBalance.add(input.totalBalanceDelta); hooks.afterCredit?.(); return clone(state.wallet); },
    record: async (_tx,input) => { counts.records++; if(hooks.recordError) throw Error('record failed'); const row={...clone(input),transactionId:'REBATE'}; state.receipts.push(row); return row; },
    suppressNotifications: async () => undefined,
  };
  return { deps, tx: tx as Prisma.TransactionClient, state: () => state, hooks, counts, locks, now, d };
}
