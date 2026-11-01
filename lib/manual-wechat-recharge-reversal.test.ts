import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';

import {
  MANUAL_WECHAT_REVERSAL_ACTION,
  ManualWechatReversalError,
  reverseManualWechatBossRecharge,
  type ManualWechatReversalInput,
} from './manual-wechat-recharge-reversal';
import { recordWalletTransaction } from './wallet-ledger-write';

type Dependencies = NonNullable<Parameters<typeof reverseManualWechatBossRecharge>[2]>;
type Wallet = Awaited<ReturnType<Dependencies['readWallet']>>;
type Operation = Prisma.DlmAdminOperationUncheckedCreateInput;
type Recharge = Prisma.RechargeUncheckedCreateInput;
type Receipt = Prisma.IndividualTransactionUncheckedCreateInput & { transactionId: string; deltaAmount: Prisma.Decimal };
type State = { wallet: Wallet; operations: Map<string, Operation>; recharges: Recharge[]; receipts: Receipt[] };
const D = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const input: ManualWechatReversalInput = {
  requestId: 'request-1', operatorDiscordId: '525770714574225408', dlmId: 'DLM-A',
  amount: '50', receiptAccount: 'account-A', reason: 'overcharge-50',
};
const options = { transactionType: 'TEST_REVERSAL' };

function harness(config: {
  wallet?: Partial<Record<keyof Wallet, string>>;
  missingBoss?: boolean;
  resolvedDlmId?: string;
  discordId?: string;
  ledgerFailure?: boolean;
  auditFailure?: boolean;
  commitFault?: 'P2034' | 'P2002';
} = {}) {
  let state: State = {
    wallet: {
      totalBalance: D(config.wallet?.totalBalance ?? '150'), income: D(config.wallet?.income ?? '25'),
      recharge: D(config.wallet?.recharge ?? '125'), totalSpent: D(config.wallet?.totalSpent ?? '12'),
      loyaltyPoints: D(config.wallet?.loyaltyPoints ?? '8'),
    },
    operations: new Map(), recharges: [], receipts: [],
  };
  const events: string[] = [];
  const transactions = new WeakMap<object, State>();
  let attempts = 0;
  const db = {
    async $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>, settings: { isolationLevel: string }) {
      attempts++;
      assert.equal(settings.isolationLevel, 'Serializable');
      const draft: State = {
        wallet: { ...state.wallet }, operations: new Map(state.operations),
        recharges: [...state.recharges], receipts: [...state.receipts],
      };
      const tx = {
        dlmAdminOperation: {
          findUnique: async ({ where }: { where: { requestId: string } }) => draft.operations.get(where.requestId) ?? null,
          create: async ({ data }: { data: Operation }) => {
            if (config.auditFailure) throw new Error('synthetic-audit-failure');
            if (draft.operations.has(data.requestId)) throw { code: 'P2002' };
            draft.operations.set(data.requestId, data);
            return data;
          },
        },
        manualWechatBoss: {
          findUnique: async ({ where }: { where: { dlmId: string } }) =>
            config.missingBoss || where.dlmId !== 'DLM-A' ? null : { dlmId: where.dlmId },
        },
        recharge: {
          create: async ({ data }: { data: Recharge }) => {
            draft.recharges.push(data);
            return { RechargeID: `C${draft.recharges.length}` };
          },
        },
        individualTransaction: {
          create: async ({ data }: { data: Prisma.IndividualTransactionUncheckedCreateInput }) => {
            if (config.ledgerFailure) throw new Error('synthetic-ledger-failure');
            const receipt = {
              ...data, transactionId: `IT${draft.receipts.length + 1}`,
              deltaAmount: D(String(data.balanceAfter)).sub(String(data.balanceBefore)),
            };
            draft.receipts.push(receipt);
            return receipt;
          },
        },
        $executeRaw: async () => { events.push('suppress-notification'); return 1; },
      } as unknown as Prisma.TransactionClient;
      transactions.set(tx, draft);
      const result = await callback(tx);
      if (attempts === 1 && config.commitFault) {
        // Unique failure models a concurrent request that has already committed this same intent.
        if (config.commitFault === 'P2002') state = draft;
        throw { code: config.commitFault };
      }
      state = draft;
      return result;
    },
  };
  const deps: Dependencies = {
    db: db as unknown as Dependencies['db'],
    lockWallet: async (_tx, identity) => {
      events.push('lock');
      return { dlmId: config.resolvedDlmId ?? identity.dlmId, discordId: config.discordId ?? null, memberKey: config.discordId ?? null };
    },
    readWallet: async (tx) => {
      events.push('read');
      return { ...transactions.get(tx)!.wallet };
    },
    applyWallet: async (tx, params) => {
      events.push('apply');
      assert.equal(params.incomeDelta, undefined);
      assert.equal(params.totalSpentDelta, undefined);
      assert.equal(params.loyaltyPointsDelta, undefined);
      const draft = transactions.get(tx)!;
      draft.wallet = {
        ...draft.wallet,
        totalBalance: draft.wallet.totalBalance.add(params.totalBalanceDelta ?? 0),
        recharge: draft.wallet.recharge.add(params.rechargeDelta ?? 0),
      };
      return { ...draft.wallet };
    },
    recordTransaction: recordWalletTransaction,
  };
  return { deps, events, state: () => state, attempts: () => attempts };
}

function code(expected: string) {
  return (error: unknown) => error instanceof ManualWechatReversalError && error.code === expected;
}

test('reversal reduces only recharge and total balance and appends a signed finance record and complete audit', async () => {
  const h = harness({ discordId: 'linked-discord-id' });
  const outcome = await reverseManualWechatBossRecharge(input, options, h.deps);
  assert.equal(outcome.replayed, false);
  assert.equal(outcome.result.amount, '-50.00');
  assert.equal(outcome.result.balanceAfter, '100.00');
  const state = h.state();
  assert.equal(state.wallet.totalBalance.toString(), '100');
  assert.equal(state.wallet.recharge.toString(), '75');
  assert.equal(state.wallet.income.toString(), '25');
  assert.equal(state.wallet.totalSpent.toString(), '12');
  assert.equal(state.wallet.loyaltyPoints.toString(), '8');
  assert.equal(state.recharges.length, 1);
  assert.equal(String(state.recharges[0].amount), '-50');
  assert.equal(state.recharges[0].fromWhom, input.operatorDiscordId);
  assert.equal(state.recharges[0].dlmId, input.dlmId);
  assert.equal(state.recharges[0].toWhom, input.dlmId);
  assert.equal(state.recharges[0].settlementReconciliation, undefined);
  assert.equal(state.receipts[0].deltaAmount.toString(), '-50');
  assert.equal(state.receipts[0].discordId, 'linked-discord-id');
  assert.equal(state.receipts[0].typeOfTransaction, options.transactionType);
  const audit = state.operations.get(input.requestId)!;
  assert.equal(audit.sourceOperationId, undefined);
  assert.equal(audit.receiptReference, input.receiptAccount);
  assert.deepEqual(audit.details, {
    action: MANUAL_WECHAT_REVERSAL_ACTION, requestedAmount: '50.00', receiptAccount: input.receiptAccount, reason: input.reason,
  });
  assert.deepEqual(h.events, ['lock', 'read', 'suppress-notification', 'apply']);
});

test('invalid amounts and required fields fail before opening a transaction', async () => {
  for (const amount of ['-10', '0', '1.001', '1000000.01', 'Infinity', 'NaN', '1e2', '', {}, null]) {
    const h = harness();
    await assert.rejects(reverseManualWechatBossRecharge({ ...input, amount }, options, h.deps), code('INVALID_INPUT'));
    assert.equal(h.attempts(), 0);
  }
  for (const fields of [{ receiptAccount: '' }, { requestId: 'x'.repeat(121) }, { reason: 'x'.repeat(501) }]) {
    const h = harness();
    await assert.rejects(reverseManualWechatBossRecharge({ ...input, ...fields }, options, h.deps), code('INVALID_INPUT'));
    assert.equal(h.attempts(), 0);
  }
});

test('optional notes normalize to null for idempotency and nonempty notes remain in the audit', async () => {
  const h = harness();
  const withoutNote = await reverseManualWechatBossRecharge({ ...input, reason: undefined }, options, h.deps);
  assert.equal(withoutNote.replayed, false);
  assert.equal((h.state().operations.get(input.requestId)!.details as { reason: unknown }).reason, null);
  for (const reason of [null, '', '   ']) {
    const replay = await reverseManualWechatBossRecharge({ ...input, reason }, options, h.deps);
    assert.equal(replay.replayed, true);
    assert.equal(h.state().recharges.length, 1);
  }
  await assert.rejects(
    reverseManualWechatBossRecharge({ ...input, reason: 'added-after-submission' }, options, h.deps),
    code('REQUEST_CONFLICT'),
  );

  const withNote = harness();
  await reverseManualWechatBossRecharge({ ...input, reason: '  original-note  ' }, options, withNote.deps);
  assert.equal((withNote.state().operations.get(input.requestId)!.details as { reason: unknown }).reason, 'original-note');
});

test('insufficient recharge cannot be paid from income and insufficient total balance cannot overdraw', async () => {
  for (const wallet of [{ income: '100', recharge: '10', totalBalance: '110' }, { recharge: '100', totalBalance: '10' }]) {
    const h = harness({ wallet });
    await assert.rejects(reverseManualWechatBossRecharge(input, options, h.deps), code('INSUFFICIENT_BALANCE'));
    assert.equal(h.state().wallet.totalBalance.toString(), wallet.totalBalance);
    assert.equal(h.state().recharges.length, 0);
    assert.equal(h.state().operations.size, 0);
    assert.equal(h.events.includes('apply'), false);
  }
});

test('an identical request replays its receipt and reads the current balance without another debit', async () => {
  const h = harness();
  const first = await reverseManualWechatBossRecharge(input, options, h.deps);
  h.state().wallet.totalBalance = D('90');
  const replay = await reverseManualWechatBossRecharge({ ...input, amount: '50.00' }, options, h.deps);
  assert.equal(replay.replayed, true);
  assert.equal(replay.result.rechargeId, first.result.rechargeId);
  assert.equal(replay.result.balanceAfter, '100.00');
  assert.equal(replay.result.currentBalance, '90.00');
  assert.equal(h.state().recharges.length, 1);
  assert.equal(h.state().receipts.length, 1);
  assert.equal(h.events.filter((event) => event === 'apply').length, 1);
});

test('request reuse with changed intent or another action never replays or debits', async () => {
  for (const changed of [
    { amount: '49' }, { dlmId: 'DLM-B' }, { operatorDiscordId: 'other-admin' },
    { receiptAccount: 'account-B' }, { reason: 'other-reason' },
  ]) {
    const h = harness();
    await reverseManualWechatBossRecharge(input, options, h.deps);
    await assert.rejects(reverseManualWechatBossRecharge({ ...input, ...changed }, options, h.deps), code('REQUEST_CONFLICT'));
    assert.equal(h.state().recharges.length, 1);
    assert.equal(h.state().wallet.totalBalance.toString(), '100');
  }
  const h = harness();
  await reverseManualWechatBossRecharge(input, options, h.deps);
  h.state().operations.get(input.requestId)!.details = { action: 'OTHER_ACTION' };
  await assert.rejects(reverseManualWechatBossRecharge(input, options, h.deps), code('REQUEST_CONFLICT'));
});

test('missing or merged-away selected bosses cannot silently debit another account', async () => {
  for (const config of [{ missingBoss: true }, { resolvedDlmId: 'DLM-B' }]) {
    const h = harness(config);
    await assert.rejects(reverseManualWechatBossRecharge(input, options, h.deps), code('BOSS_NOT_FOUND'));
    assert.equal(h.state().wallet.totalBalance.toString(), '150');
    assert.equal(h.state().recharges.length, 0);
  }
});

test('ledger and audit failures roll back the wallet and every appended record', async () => {
  for (const config of [{ ledgerFailure: true }, { auditFailure: true }]) {
    const h = harness(config);
    await assert.rejects(reverseManualWechatBossRecharge(input, options, h.deps), /synthetic-/);
    assert.equal(h.state().wallet.totalBalance.toString(), '150');
    assert.equal(h.state().wallet.recharge.toString(), '125');
    assert.equal(h.state().recharges.length, 0);
    assert.equal(h.state().receipts.length, 0);
    assert.equal(h.state().operations.size, 0);
  }
});

test('serialization retry and a concurrent duplicate each leave exactly one completed reversal', async () => {
  for (const commitFault of ['P2034', 'P2002'] as const) {
    const h = harness({ commitFault });
    const result = await reverseManualWechatBossRecharge(input, options, h.deps);
    assert.equal(h.attempts(), 2);
    assert.equal(result.replayed, commitFault === 'P2002');
    assert.equal(h.state().wallet.totalBalance.toString(), '100');
    assert.equal(h.state().wallet.recharge.toString(), '75');
    assert.equal(h.state().recharges.length, 1);
    assert.equal(h.state().receipts.length, 1);
    assert.equal(h.state().operations.size, 1);
  }
});
