import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { DlmAdminOperationStatus, DlmAdminOperationType, Prisma, type DlmAdminOperation } from '@prisma/client';

import { rechargeManualWechatBoss } from './manual-wechat-boss';
import { MANUAL_WECHAT_REVERSAL_ACTION, ManualWechatReversalError } from './manual-wechat-recharge-reversal';
import { prisma } from './prisma';

const D = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const input = {
  requestId: 'request-1', operatorDiscordId: '525770714574225408', dlmId: 'DLM-A',
  amount: '50', receiptAccount: 'account-A', note: 'original-note',
};
const options = { debitTransactionType: 'TEST_DEBIT' };

function positiveOperation(): DlmAdminOperation {
  return {
    id: 'operation-1', requestId: input.requestId, dlmId: input.dlmId, operatorDiscordId: input.operatorDiscordId,
    type: DlmAdminOperationType.MANUAL_WECHAT_RECHARGE, status: DlmAdminOperationStatus.COMPLETED,
    sourceOperationId: null, receiptReference: input.receiptAccount,
    details: { amount: '50.00', receiptAccount: input.receiptAccount, note: input.note },
    result: { dlmId: input.dlmId, amount: '50.00', rechargeId: 'C-original', balanceAfter: '200.00', rechargeRequestId: input.requestId },
    failureReason: null, createdAt: new Date('2026-11-01T12:00:00Z'), updatedAt: new Date('2026-11-01T12:00:00Z'),
  };
}

function setup(t: TestContext, operation: DlmAdminOperation | null = null, race = false) {
  const replace = (target: object, key: string, value: unknown) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { value, configurable: true, writable: true });
    t.after(() => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    });
  };
  const state = {
    wallet: { totalBalance: D(150), recharge: D(125), income: D(25), totalSpent: D(12), loyaltyPoints: D(8) },
    operations: operation ? [operation] : [] as DlmAdminOperation[],
    recharges: [] as Prisma.RechargeUncheckedCreateInput[],
    receipts: [] as Prisma.IndividualTransactionUncheckedCreateInput[],
    transactions: 0,
    lookups: 0,
  };
  const lookup = async () => {
    state.lookups++;
    return race && state.lookups === 1 ? null : state.operations[0] ?? null;
  };
  const walletRead = async () => ({ dlmId: input.dlmId, discordUserId: null, ...state.wallet });
  const tx = {
    dlmAdminOperation: {
      findUnique: lookup,
      create: async ({ data }: { data: Prisma.DlmAdminOperationUncheckedCreateInput }) => {
        state.operations.push({ ...positiveOperation(), ...data } as DlmAdminOperation);
        return data;
      },
    },
    manualWechatBoss: { findUnique: async () => ({ dlmId: input.dlmId, dlmUser: { discordUserId: null } }) },
    detachedDiscordAccount: { findUnique: async () => null },
    dlmUser: {
      findUnique: walletRead,
      update: async ({ data }: { data: Record<keyof typeof state.wallet, { increment: Prisma.Decimal }> }) => {
        for (const key of Object.keys(state.wallet) as Array<keyof typeof state.wallet>) {
          state.wallet[key] = state.wallet[key].add(data[key].increment);
        }
        return { ...state.wallet };
      },
    },
    recharge: {
      create: async ({ data }: { data: Prisma.RechargeUncheckedCreateInput }) => {
        state.recharges.push(data);
        return { RechargeID: 'C-new' };
      },
    },
    individualTransaction: {
      create: async ({ data }: { data: Prisma.IndividualTransactionUncheckedCreateInput }) => {
        state.receipts.push(data);
        return { ...data, transactionId: 'IT-new', deltaAmount: D(String(data.balanceAfter)).sub(String(data.balanceBefore)) };
      },
    },
    $executeRaw: async () => 1,
    $queryRaw: async () => [{ dlmId: input.dlmId, discordUserId: null }],
  } as unknown as Prisma.TransactionClient;
  replace(prisma.dlmAdminOperation, 'findUnique', lookup);
  replace(prisma.dlmUser, 'findUnique', walletRead);
  replace(prisma, '$transaction', async <T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>) => {
    state.transactions++;
    if (race) throw { code: 'P2002' };
    return callback(tx);
  });
  return state;
}

const conflict = (error: unknown) => error instanceof ManualWechatReversalError && error.code === 'REQUEST_CONFLICT';

test('positive recharge keeps its existing wallet, ledger and audit behavior without debit options', async (t) => {
  const state = setup(t);
  const result = await rechargeManualWechatBoss(input);
  assert.equal(result.replayed, false);
  assert.equal(result.result.amount, '50.00');
  assert.equal(result.result.rechargeRequestId, input.requestId);
  assert.equal(state.wallet.totalBalance.toString(), '200');
  assert.equal(state.wallet.recharge.toString(), '175');
  assert.equal(state.wallet.income.toString(), '25');
  assert.equal(String(state.recharges[0].amount), '50');
  assert.equal(state.receipts[0].typeOfTransaction, '充值');
});

test('negative amount delegates to the reversal ledger with optional note and trusted debit label', async (t) => {
  const state = setup(t);
  const result = await rechargeManualWechatBoss({ ...input, amount: '-50.00', note: undefined }, options);
  assert.equal(result.replayed, false);
  assert.equal(result.result.amount, '-50.00');
  assert.equal(result.result.rechargeRequestId, input.requestId);
  assert.equal(state.wallet.totalBalance.toString(), '100');
  assert.equal(state.wallet.recharge.toString(), '75');
  assert.equal(state.wallet.income.toString(), '25');
  assert.equal(String(state.recharges[0].amount), '-50');
  assert.equal(state.receipts[0].typeOfTransaction, options.debitTransactionType);
  assert.equal((state.operations[0].details as { action: string }).action, MANUAL_WECHAT_REVERSAL_ACTION);
  assert.equal((state.operations[0].details as { reason: unknown }).reason, null);
});

test('negative amounts require explicit debit options and preserve the prior validation otherwise', async (t) => {
  const state = setup(t);
  await assert.rejects(rechargeManualWechatBoss({ ...input, amount: '-50' }), /请填写有效金额和微信收款账号。/);
  assert.equal(state.transactions, 0);
  assert.equal(state.lookups, 0);
});

test('positive and negative submissions cannot reuse each other’s request IDs', async (t) => {
  const state = setup(t);
  await rechargeManualWechatBoss({ ...input, amount: '-50' }, options);
  await assert.rejects(rechargeManualWechatBoss(input, options), conflict);
  assert.equal(state.wallet.totalBalance.toString(), '100');
  assert.equal(state.recharges.length, 1);
  state.operations[0] = positiveOperation();
  await assert.rejects(rechargeManualWechatBoss({ ...input, amount: '-50' }, options), conflict);
  assert.equal(state.wallet.totalBalance.toString(), '100');
  assert.equal(state.recharges.length, 1);
});

test('valid positive replay uses the original recharge ID and reads current balance', async (t) => {
  const state = setup(t, positiveOperation());
  const result = await rechargeManualWechatBoss({ ...input, amount: '50.00' });
  assert.equal(result.replayed, true);
  assert.equal(result.result.rechargeRequestId, input.requestId);
  assert.equal((result.result as { rechargeId: string }).rechargeId, 'C-original');
  assert.equal((result.result as { currentBalance: string }).currentBalance, '150.00');
  assert.equal(state.transactions, 0);
  assert.equal(state.recharges.length, 0);
});

test('initial lookup and duplicate-request race both reject mismatched positive replay intent', async (t) => {
  const changes: Array<(operation: DlmAdminOperation) => void> = [
    (operation) => { operation.type = DlmAdminOperationType.RECHARGE_CASHBACK; },
    (operation) => { operation.sourceOperationId = 'source-operation'; },
    (operation) => { operation.dlmId = 'DLM-B'; },
    (operation) => { operation.operatorDiscordId = 'other-operator'; },
    (operation) => { operation.receiptReference = 'other-account'; },
    (operation) => { (operation.details as { amount: string }).amount = '-50.00'; },
    (operation) => { (operation.details as { receiptAccount: string }).receiptAccount = 'other-account'; },
    (operation) => { (operation.details as { note: string }).note = 'changed-note'; },
    (operation) => { (operation.result as { amount: string }).amount = '-50.00'; },
    (operation) => { (operation.result as { dlmId: string }).dlmId = 'DLM-B'; },
    (operation) => { (operation.result as { rechargeId: string }).rechargeId = ''; },
  ];
  for (const race of [false, true]) {
    for (const [index, change] of changes.entries()) {
      await t.test(`race=${race}, mismatch=${index}`, async (child) => {
        const operation = positiveOperation();
        change(operation);
        const state = setup(child, operation, race);
        await assert.rejects(rechargeManualWechatBoss(input), conflict);
        assert.equal(state.recharges.length, 0);
        assert.equal(state.wallet.totalBalance.toString(), '150');
      });
    }
  }
});

test('duplicate-request race preserves valid positive replay', async (t) => {
  const state = setup(t, positiveOperation(), true);
  const result = await rechargeManualWechatBoss(input);
  assert.equal(result.replayed, true);
  assert.equal((result.result as { rechargeId: string }).rechargeId, 'C-original');
  assert.equal(state.transactions, 1);
  assert.equal(state.recharges.length, 0);
});

test('signed delegation preserves note length validation before any transaction', async (t) => {
  const state = setup(t);
  await assert.rejects(
    rechargeManualWechatBoss({ ...input, amount: '-50', note: 'x'.repeat(501) }, options),
    (error: unknown) => error instanceof ManualWechatReversalError && error.code === 'INVALID_INPUT',
  );
  assert.equal(state.transactions, 0);
});
