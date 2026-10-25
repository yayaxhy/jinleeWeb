import * as siteCopy from "./site-copy";
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { Prisma } from '@prisma/client';
import * as prismaTypes from '@prisma/client';
import * as outbox from './notification-outbox';
const D = (value: string | number) => new Prisma.Decimal(value);
function fixture(file = './manual-wechat-boss.ts') {
  let state = { balance: D(100), notices: [] as any[], ledger: [] as any[], operations: [] as any[] };
  let fail = false; let suppressed = false;
  const prisma: any = { dlmAdminOperation: { findUnique: async () => null }, $transaction: async (work: (tx: any) => Promise<unknown>) => {
    const prior = state; const draft = { ...state, notices: [...state.notices], ledger: [...state.ledger], operations: [...state.operations] };
    const create = async ({ data }: any) => { draft.ledger.push(data); return { ...data, id: 'record', RechargeID: 'recharge', transactionId: 'ledger' }; };
    const tx: any = {
      $executeRaw: async (parts: TemplateStringsArray) => { if (parts.join('').includes('set_config')) suppressed = true; return 1; },
      manualWechatBoss: { findUnique: async () => ({ dlmUser: { discordUserId: 'discord-1' } }) },
      member: { upsert: async () => ({}) },
      recharge: { create }, individualTransaction: { create }, expense: { create },
      dlmAdminOperation: {
        findUnique: async ({ where }: any) => where.id ? ({ id: 'original', dlmId: 'old', type: 'MANUAL_WECHAT_RECHARGE', status: 'COMPLETED', sourceOperationId: null, receiptReference: 'receipt', result: { amount: '25', rechargeId: 'original-recharge' } }) : null,
        create: async ({ data }: any) => { draft.operations.push(data); return data; },
      },
      guildNotificationOutbox: { upsert: async ({ where, create }: any) => {
        assert(suppressed, 'explicit source must suppress generic trigger');
        if (fail) throw new Error('outbox write failed');
        const existing = draft.notices.find(r => r.dedupeKey === where.dedupeKey); if (existing) return existing;
        draft.notices.push(create); return create;
      } },
      draft,
    };
    try { const result = await work(tx); state = draft; return result; } catch (error) { state = prior; throw error; }
  } };
  const dependencies: Record<string, unknown> = {
    '@prisma/client': prismaTypes, '@/lib/prisma': { prisma }, '@/lib/dlm-id': { generateDlmId: () => 'new-dlm' },
    '@/lib/manual-wechat-operation-replay': { manualOperationResultForCurrentAccount: (v: unknown) => v, replayManualWechatRechargeResult: async (v: unknown) => v },
    './notification-outbox': outbox, './site-copy': siteCopy,
    '@/lib/dlm-wallet': {
      getDlmWalletSnapshotTx: async (tx: any) => ({ totalBalance: tx.draft.balance, recharge: tx.draft.balance }),
      applyDlmWalletDeltaTx: async (tx: any, input: any) => { tx.draft.balance = tx.draft.balance.add(input.totalBalanceDelta); return { totalBalance: tx.draft.balance }; },
    },
  };
  const exports: Record<string, any> = {};
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: (name: string) => { assert(name in dependencies, name); return dependencies[name]; }, console, Date });
  return { methods: exports, state: () => state, fail: () => { fail = true; } };
}
for (const [method, params, key] of [
  ['rechargeManualWechatBoss', { receiptAccount: '收款账户' }, 'manual-recharge'],
  ['giftManualWechatBoss', { reason: 'VIP福利' }, 'manual-gift'],
  ['correctManualWechatBossRecharge', { sourceOperationId: 'original', targetDlmId: 'new', reason: '归属更正' }, 'manual-correction'],
] as const) {
  test(`${method}: task is written with the completed operation and original request key`, async () => {
    const f = fixture(); await f.methods[method]({ requestId: 'req-1', operatorDiscordId: 'staff', dlmId: 'D1', amount: '25', ...params });
    assert.equal(f.state().operations.length, 1); assert.equal(f.state().notices.length, 1);
    assert.equal(f.state().notices[0].dedupeKey, `${key}:req-1`); assert.equal(f.state().notices[0].recipientDiscordId, 'discord-1');
  });
  test(`${method}: enqueue failure rolls back its operation and all money writes`, async () => {
    const f = fixture(); f.fail(); await assert.rejects(f.methods[method]({ requestId: 'req-1', operatorDiscordId: 'staff', dlmId: 'D1', amount: '25', ...params }), /outbox write failed/);
    assert.equal(f.state().balance.toString(), '100'); assert.equal(f.state().ledger.length, 0); assert.equal(f.state().operations.length, 0); assert.equal(f.state().notices.length, 0);
  });
}
test('separated correction service enqueues the same bounded task source', async () => {
  const f = fixture('./manual-wechat-recharge-correction.ts');
  await f.methods.correctManualWechatBossRecharge({ requestId: 'req-2', operatorDiscordId: 'staff', sourceOperationId: 'original', targetDlmId: 'new', reason: '归属更正' });
  assert.equal(f.state().notices[0].dedupeKey, 'manual-correction:req-2'); assert.equal(f.state().notices[0].recipientDlmId, 'new');
});

for (const [method, params, prefix, title, body] of [
  ['rechargeManualWechatBoss', { receiptAccount: '收款账户' }, 'manual.wechat.boss', '333c89553678', 'f0c16910c207'],
  ['giftManualWechatBoss', { reason: 'VIP福利' }, 'manual.wechat.boss', '1f323e4eedfb', 'a53c46d4da12'],
  ['correctManualWechatBossRecharge', { sourceOperationId: 'original', targetDlmId: 'new', reason: '归属更正' }, 'manual.wechat.boss', 'ee3080c6807e', '70d9c17d5c0c'],
] as const) test(`${method}: editable notification preserves transaction facts and request identity`, async () => {
  const baseline = fixture(), changed = fixture();
  const input = { requestId: 'copy-request', operatorDiscordId: 'staff', dlmId: 'D1', amount: '25', ...params };
  await baseline.methods[method](input);
  await changed.methods[method](input, siteCopy.createSiteCopy({ [`site.lib.${prefix}.${title}`]: '公会账目通知', [`site.lib.${prefix}.${body}`]: '本次 {value1}，余额 {value2}。' }));
  const notice = changed.state().notices[0];
  assert.equal(notice.title, '公会账目通知');
  assert.match(notice.body, /^本次 25.00，余额 [0-9]+。$/);
  assert.equal(notice.dedupeKey, baseline.state().notices[0].dedupeKey);
  assert.equal(notice.recipientDlmId, baseline.state().notices[0].recipientDlmId);
  assert.equal(JSON.stringify(changed.state().ledger), JSON.stringify(baseline.state().ledger));
  assert.equal(changed.state().balance.toString(), baseline.state().balance.toString());
});
