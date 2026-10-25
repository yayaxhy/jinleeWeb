import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, type PrismaClient } from '@prisma/client';
import { executeAccountMigrationTx, previewAccountMigrationTx, runAccountMigration, type AccountMigrationInput } from './account-migration';
import { migrationModels, migrationOwnerFields, migrationUniqueKeys, type MigrationRow } from './account-migration-records';
import { mergeMigrationPeiwan, migrationPlanFingerprint } from './account-migration-policy';

const A = '111111111111111111', B = '222222222222222222', C = '333333333333333333';
const now = new Date('2026-10-24T12:00:00Z');
const future = (days: number) => new Date(now.getTime() + days * 86400000);
const requestId = '12345678-1234-4234-8234-123456789abc';
const dec = (value: string | number) => new Prisma.Decimal(value);
const input: AccountMigrationInput = { sourceDlmId: 'DA', targetDlmId: 'DB', actorDlmId: 'OP', actorDiscordId: C,
  mode: 'ADMIN', roleSnapshot: { sourceRoleIds: [], targetRoleIds: [], gameRoleIds: [], reminderRoleIds: [] } };
const copy = (value: unknown): unknown => value instanceof Date ? new Date(value) : value instanceof Prisma.Decimal ? dec(value.toString()) :
  Array.isArray(value) ? value.map(copy) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copy(entry)])) : value;
const eq = (left: unknown, right: unknown) => left instanceof Date && right instanceof Date ? left.getTime() === right.getTime()
  : left instanceof Prisma.Decimal || right instanceof Prisma.Decimal ? String(left) === String(right) : left === right;
const matches = (row: MigrationRow, where: MigrationRow = {}): boolean => Object.entries(where).every(([field, value]) => {
  if (field === 'OR') return (value as MigrationRow[]).some(item => matches(row, item));
  if (field === 'AND') return (Array.isArray(value) ? value : [value]).every(item => matches(row, item));
  if (field === 'NOT') return !matches(row, value as MigrationRow);
  if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Prisma.Decimal)) {
    const op = value as MigrationRow;
    if (Array.isArray(op.in)) return op.in.some(item => eq(row[field], item));
    if (Object.hasOwn(op, 'not')) return !eq(row[field], op.not);
    if (Object.hasOwn(op, 'gt')) return Number(row[field]) > Number(op.gt);
    if (Object.hasOwn(op, 'gte')) return Number(row[field]) >= Number(op.gte);
    if (Object.hasOwn(op, 'lt')) return Number(row[field]) < Number(op.lt);
    if (Object.hasOwn(op, 'lte')) return Number(row[field]) <= Number(op.lte);
    if (!(field in row)) return matches(row, op);
  }
  return eq(row[field], value);
});

function fixture(extra: Record<string, MigrationRow[]> = {}) {
  const user = (dlmId: string, discordUserId: string, income: number, recharge: number) => ({ dlmId, discordUserId,
    income: dec(income), recharge: dec(recharge), totalBalance: dec(income + recharge), totalSpent: dec(100), loyaltyPoints: dec(10),
    sessionVersion: 2, miniAvailability: 'RESTING', createdAt: now, updatedAt: now });
  const member = (discordUserId: string, income: number, recharge: number) => ({ discordUserId,
    income: dec(income), recharge: dec(recharge), totalBalance: dec(income + recharge), totalSpent: dec(100),
    commissionRate: dec('.75'), baseCommissionRate: dec('.75'), status: 'LAOBAN', serverDisplayName: discordUserId });
  let tables: Record<string, MigrationRow[]> = Object.fromEntries(migrationModels.map(model => [model.name, []]));
  Object.assign(tables, { DlmUser: [user('DA', A, 80, 20), user('DB', B, 10, 10)], Member: [member(A, 80, 20), member(B, 10, 10)],
    LoyaltyPoint: [{ discordUserId: A, dlmId: 'DA', points: dec(10) }, { discordUserId: B, dlmId: 'DB', points: dec(10) }], ...extra });
  let serial = 0;
  let failModel = '';
  const tx: Record<string, unknown> = {};
  const validate = () => {
    for (const model of migrationModels) {
      for (const row of tables[model.name]) for (const relation of model.fields.filter(field => field.kind === 'object' && field.relationFromFields?.length)) {
        if (relation.relationFromFields!.some(field => row[field] == null)) continue;
        const where = Object.fromEntries(relation.relationFromFields!.map((field, index) => [relation.relationToFields![index], row[field]]));
        assert.ok(tables[relation.type].some(parent => matches(parent, where)), `FK ${model.name}.${relation.name} ${JSON.stringify(where)}`);
      }
      for (const key of migrationUniqueKeys(model.name)) {
        const seen: MigrationRow[] = [];
        for (const row of tables[model.name]) {
          if (key.some(field => row[field] == null)) continue;
          assert.ok(!seen.some(other => key.every(field => eq(row[field], other[field]))), `Unique ${model.name} ${key.join(',')}`); seen.push(row);
        }
      }
    }
  };
  for (const model of migrationModels) {
    const name = model.name, delegateName = name[0].toLowerCase() + name.slice(1);
    const select = (row: MigrationRow, args: MigrationRow) => args.select ? Object.fromEntries(Object.entries(args.select as MigrationRow).filter(([, value]) => value === true).map(([field]) => [field, copy(row[field])])) : copy(row);
    tx[delegateName] = {
      findMany: async (args: MigrationRow = {}) => {
        let rows = tables[name].filter(row => matches(row, args.where as MigrationRow));
        if (args.orderBy) { const [field, order] = Object.entries(args.orderBy as MigrationRow)[0]; rows = [...rows].sort((a, b) => (Number(a[field]) - Number(b[field])) * (order === 'desc' ? -1 : 1)); }
        return rows.map(row => select(row, args));
      },
      findFirst: async (args: MigrationRow) => {
        const rows = await (tx[delegateName] as { findMany(a: MigrationRow): Promise<MigrationRow[]> }).findMany(args); return rows[0] ?? null;
      },
      findUnique: async (args: MigrationRow) => { const row = tables[name].find(row => matches(row, args.where as MigrationRow)); return row ? select(row, args) : null; },
      count: async (args: MigrationRow = {}) => tables[name].filter(row => matches(row, args.where as MigrationRow)).length,
      create: async (args: MigrationRow) => {
        if (failModel === name) throw new Error(`injected:${name}`);
        const row = copy(args.data) as MigrationRow;
        for (const field of model.fields) if (row[field.name] === undefined && field.kind !== 'object') {
          if (field.isId && field.type === 'String') row[field.name] = `new-${++serial}`;
          else if (field.hasDefaultValue && typeof field.default !== 'object') row[field.name] = field.default;
          else if (field.type === 'DateTime' && field.hasDefaultValue) row[field.name] = now;
          else if (!field.isRequired) row[field.name] = null;
        }
        if (name === 'AccountMigration') { row.createdAt = now; row.updatedAt = now; }
        tables[name].push(row); return copy(row);
      },
      updateMany: async (args: MigrationRow) => {
        if (failModel === name) throw new Error(`injected:${name}`);
        const rows = tables[name].filter(row => matches(row, args.where as MigrationRow));
        for (const row of rows) {
          const old = copy(row) as MigrationRow;
          for (const [field, value] of Object.entries(args.data as MigrationRow)) {
            if (value && typeof value === 'object' && Object.hasOwn(value, 'increment')) row[field] = typeof row[field] === 'number' ? Number(row[field]) + Number((value as MigrationRow).increment) : dec(String(row[field])).add(dec(String((value as MigrationRow).increment)));
            else row[field] = copy(value);
          }
          // PostgreSQL ON UPDATE CASCADE defaults on all model foreign keys.
          for (const child of migrationModels) for (const relation of child.fields.filter(field => field.type === name && field.kind === 'object' && field.relationFromFields?.length)) {
            const to = relation.relationToFields!;
            if (!to.some(field => !eq(old[field], row[field]))) continue;
            for (const dependent of tables[child.name]) if (relation.relationFromFields!.every((field, i) => eq(dependent[field], old[to[i]]))) relation.relationFromFields!.forEach((field, i) => { dependent[field] = copy(row[to[i]]); });
          }
        }
        return { count: rows.length };
      },
      deleteMany: async (args: MigrationRow) => {
        if (failModel === name) throw new Error(`injected:${name}`);
        const previous = tables[name].length; tables[name] = tables[name].filter(row => !matches(row, args.where as MigrationRow));
        // Do not simulate implicit cascading deletes. Commit FK validation catches
        // every forgotten relation instead of letting the fixture hide data loss.
        return { count: previous - tables[name].length };
      },
    };
  }
  tx.$queryRaw = async (query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => {
    const sql = Array.isArray(query) ? query.join('?') : (query as Prisma.Sql).sql;
    const params = Array.isArray(query) ? values : (query as Prisma.Sql).values;
    if (sql.includes('FOR UPDATE')) {
      if (sql.includes('"DlmUser"')) return tables.DlmUser.filter(row => row.dlmId === params[0]).map(row => ({ dlmId: row.dlmId, discordUserId: row.discordUserId }));
      if (sql.includes('"Member"')) return tables.Member.filter(row => row.discordUserId === params[0]).map(row => ({ discordUserId: row.discordUserId }));
      return (sql.includes('flow_buff') ? tables.FlowBuff : tables.SpendBuff).filter(row => row.userId === params[0]).map(copy);
    }
    return [];
  };
  tx.$executeRaw = async (query: Prisma.Sql) => {
    const table = query.sql.includes('flow_buff') ? 'FlowBuff' : 'SpendBuff';
    const userId = query.values[0];
    if (tables[table].some(row => row.userId === userId)) return 0;
    tables[table].push({ userId, remainingExtra: dec(0), expiresAt: new Date(0), createdAt: now, updatedAt: now }); return 1;
  };
  const transaction = async <T>(fn: (value: Prisma.TransactionClient) => Promise<T>) => {
    const before = copy(tables) as typeof tables;
    try { const result = await fn(tx as unknown as Prisma.TransactionClient); validate(); return result; }
    catch (error) { tables = before; throw error; }
  };
  return { tx: tx as unknown as Prisma.TransactionClient, client: { $transaction: transaction } as unknown as PrismaClient,
    rows: (name: string) => tables[name], setFailure: (name: string) => { failModel = name; }, validate };
}
const prepare = async (f: ReturnType<typeof fixture>, options = input) => {
  const preview = await previewAccountMigrationTx(f.tx, options, now);
  return { ...options, requestId, expectedPreviewHash: preview.previewHash };
};
const profile = (id: number, discordUserId: string, patch: MigrationRow = {}) => ({ PEIWANID: id, discordUserId,
  defaultQuotationCode: 'Q1', quotation_Q1: dec(20), baseCommissionRate: dec('.75'), commissionRate: dec('.75'), totalEarn: dec(100),
  balance: dec(100), status: 'free', sex: '小姐姐', exclusive: false, auditionInviteEnabled: false, type: '娱乐陪玩', level: '优选陪玩',
  MP_url: null, voicePreviewUrl: null, voicePreviewFilename: null, createdAt: now, updatedAt: now, ...patch });

test('complete merge uses latest locked wallet, preserves ledger originals and deletes both old account rows', async () => {
  const f = fixture({ IndividualTransaction: [{ transactionId: 'IT1', dlmId: 'DA', discordId: A, thirdPartydiscordId: C, amountChange: dec(5), balanceBefore: dec(95), balanceAfter: dec(100), typeOfTransaction: '收入', timeCreatedAt: now }],
    Transaction: [{ Transid: 'T1', fromId: A, toId: B, fromDlmId: 'DA', toDlmId: 'DB', money: dec(5), timeCreatedAt: now }],
    Coupon: [{ id: 'C1', discordId: A, dlmId: 'DA', consumeTargetId: A, consumeTargetDlmId: 'DA', status: 'ACTIVE', expiresAt: future(3), type: 'DISCOUNT_90' }] });
  const args = await prepare(f);
  for (const row of [f.rows('DlmUser')[0], f.rows('Member')[0]]) { row.recharge = dec(0); row.totalBalance = dec(80); }
  const result = await runAccountMigration(f.client, args);
  assert.equal(result.mergedWallet.totalBalance, '100');
  assert.equal(f.rows('DlmUser').length, 1); assert.equal(f.rows('Member').length, 1);
  assert.equal(f.rows('DlmUser')[0].sessionVersion, 3);
  assert.equal(f.rows('IndividualTransaction')[0].discordId, A); assert.equal(f.rows('IndividualTransaction')[0].dlmId, 'DB');
  assert.equal(f.rows('Transaction')[0].fromId, B); assert.equal(f.rows('Coupon')[0].consumeTargetId, B);
  assert.equal((f.rows('AccountMigrationArchive').find(row => row.model === 'Transaction')!.payload as MigrationRow).fromId, A);
  assert.equal(f.rows('AccountOwnership').find(row => row.identityKind === 'DLM')!.currentDlmId, 'DB');
  const count = f.rows('AccountMigrationArchive').length;
  const replay = await runAccountMigration(f.client, args); assert.deepEqual(replay, result);
  assert.equal(f.rows('AccountMigrationArchive').length, count);
  await assert.rejects(runAccountMigration(f.client, { ...args, targetDlmId: 'DX' }), /编号/);
});

test('profile keeps old public id, new valid media/prices/base, higher rank and all game roles', async () => {
  const f = fixture({ PEIWAN: [profile(1, A, { MP_url: 'old.png', voicePreviewUrl: 'old.mp3', voicePreviewFilename: 'old', level: '殿堂陪玩' }), profile(2, B, { MP_url: 'new.png', quotation_Q1: dec(30), totalEarn: dec(50), auditionInviteEnabled: false })],
    PeiwanGameProfile: [{ id: 'g1', peiwanId: 1, discordUserId: A, sourceRoleId: C, gameCode: 'VAL', tier: 'TECH' }, { id: 'g2', peiwanId: 2, discordUserId: B, sourceRoleId: '444444444444444444', gameCode: 'VAL', tier: 'MASTER' }],
    Order: [{ id: 'o1', hostId: A, hostDlmId: 'DA', workerId: B, peiwanId: 2, status: 'ENDED', unitPrice: dec(17), commissionRate: dec('.81'), displayNo: 1 }] });
  f.rows('PEIWAN')[1].baseCommissionRate = dec('.95'); // PEIWAN is the actual long-term base, even if Member is stale.
  await runAccountMigration(f.client, await prepare(f));
  const p = f.rows('PEIWAN')[0]; assert.equal(p.PEIWANID, 1); assert.equal(p.discordUserId, B); assert.equal(p.MP_url, 'new.png');
  assert.equal(p.voicePreviewUrl, 'old.mp3'); assert.equal(p.level, '殿堂陪玩'); assert.equal(String(p.quotation_Q1), '30'); assert.equal(String(p.baseCommissionRate), '0.95');
  assert.equal(String(p.totalEarn), '150'); assert.equal(p.type, '大神陪玩'); assert.equal(f.rows('PeiwanGameProfile').length, 2);
  assert.equal(f.rows('Order')[0].peiwanId, 1); assert.equal(String(f.rows('Order')[0].unitPrice), '17'); assert.equal(String(f.rows('Order')[0].commissionRate), '0.81');
});

test('batch expiry never extends, expired ordinary quota stays expired, target auto progress unchanged', async () => {
  const f = fixture({ FlowBuff: [{ userId: A, remainingExtra: dec(100), expiresAt: future(5), createdAt: now }],
    SpendBuff: [{ userId: A, remainingExtra: dec(99), expiresAt: future(-1), createdAt: now }],
    ManualQuotaBatch: [{ id: 'qb', userId: B, kind: 'flow', remainingExtra: dec(200), expiresAt: future(20) }],
    ManualQuotaRestoration: [{ id: 'qr', userId: A, kind: 'flow', remainingExtra: dec(10), expiresAt: future(2), sourceKey: 'gift:1' }],
    CommissionBuff: [{ userId: A, boost: dec('.01'), expiresAt: future(10) }, { userId: B, boost: dec('.01'), expiresAt: future(20) }],
    AutoCommissionBuff: [{ userId: A, currentAmount: dec(7000), activeUntil: future(20), windowStart: future(-5), windowEnd: now },
      { userId: B, currentAmount: dec(6000), activeUntil: future(5), windowStart: future(-20), windowEnd: now, lastQualifiedAt: future(-25), tierExpiries: { '1': future(5).toISOString() } }] });
  const args = await prepare(f); await f.client.$transaction(tx => executeAccountMigrationTx(tx, args, now));
  assert.equal(f.rows('ManualQuotaBatch').length, 3); assert.equal((f.rows('ManualQuotaBatch').find(row => row.id === `${requestId}:flow`)!.expiresAt as Date).getTime(), future(5).getTime());
  assert.equal((f.rows('ManualQuotaBatch').find(row => row.kind === 'spend')!.expiresAt as Date).getTime(), future(-1).getTime());
  assert.equal(f.rows('ManualQuotaRestoration')[0].userId, B);
  assert.equal(String(f.rows('AutoCommissionBuff')[0].currentAmount), '6000'); assert.equal((f.rows('AutoCommissionBuff')[0].activeUntil as Date).getTime(), future(20).getTime());
  assert.equal((f.rows('CommissionBuff')[0].expiresAt as Date).getTime(), future(20).getTime());
});

test('identity or benefit changes invalidate preview while ordinary money changes do not', async () => {
  const f = fixture({ ManualQuotaBatch: [{ id: 'qb', userId: A, kind: 'flow', remainingExtra: dec(200), expiresAt: future(20) }] });
  const args = await prepare(f); f.rows('ManualQuotaBatch')[0].remainingExtra = dec(190);
  await assert.rejects(runAccountMigration(f.client, args), /重新预览/); assert.equal(f.rows('DlmUser').length, 2);
});

test('transaction error after wallet/relations restores every original row', async () => {
  const f = fixture({ Coupon: [{ id: 'c', discordId: A, dlmId: 'DA' }] }); const args = await prepare(f);
  const before = JSON.stringify(f.rows('DlmUser')); f.setFailure('Member');
  await assert.rejects(runAccountMigration(f.client, args), /injected/);
  assert.equal(JSON.stringify(f.rows('DlmUser')), before); assert.equal(f.rows('Coupon')[0].dlmId, 'DA');
  assert.equal(f.rows('AccountMigration').length, 0); assert.equal(f.rows('AccountMigrationArchive').length, 0);
});

test('incompatible farm slot archives dependent activity without deleting the other crop or compatible coin assets', async () => {
  const f = fixture({ FarmProfile: [{ discordUserId: A, coins: dec(3), experience: 10, unlockedPlots: 4 }, { discordUserId: B, coins: dec(7), experience: 20, unlockedPlots: 5 }],
    FarmPlot: [{ id: 'p1', discordUserId: A, plotIndex: 0, seedType: 'ROSE' }, { id: 'p2', discordUserId: B, plotIndex: 0, seedType: 'WHEAT' }],
    FarmPlotCareEvent: [{ id: 'care', farmPlotId: 'p1', cropCycle: 1, type: 'WATER' }], FarmActionLog: [{ id: 'log', discordUserId: A, actionType: 'PLANT' }] });
  const preview = await previewAccountMigrationTx(f.tx, input, now); assert.equal(preview.conflicts.length, 1);
  const result = await runAccountMigration(f.client, { ...input, requestId, expectedPreviewHash: preview.previewHash });
  assert.equal(f.rows('FarmProfile').length, 1); assert.equal(String(f.rows('FarmProfile')[0].coins), '10');
  assert.equal(f.rows('FarmPlot')[0].seedType, 'WHEAT'); assert.equal(f.rows('FarmActionLog')[0].discordUserId, B);
  assert.ok(result.skipped.some(row => row.model === 'FarmPlotCareEvent'));
  assert.ok(f.rows('AccountMigrationArchive').some(row => row.model === 'FarmPlotCareEvent'));
});

test('heart directional totals add, self relation stays archive, source invitations end with original payouts', async () => {
  const f = fixture({ Member: [
    { discordUserId: A, totalBalance: dec(100), income: dec(80), recharge: dec(20), totalSpent: dec(100), baseCommissionRate: dec('.75') },
    { discordUserId: B, totalBalance: dec(20), income: dec(10), recharge: dec(10), totalSpent: dec(100), baseCommissionRate: dec('.75') },
    { discordUserId: C }], HeartCounter: [{ id: 1, fromMemberId: A, toMemberId: C, total: 300 }, { id: 2, fromMemberId: B, toMemberId: C, total: 300 }, { id: 3, fromMemberId: A, toMemberId: B, total: 50 }],
    Referral: [{ inviteeId: A, inviterId: C, type: 'LAOBAN', enabled: true }, { inviteeId: B, inviterId: C, type: 'LAOBAN', enabled: true }],
    ReferralPayout: [{ id: 'rp', referralId: A, orderId: 'gift:x', amount: dec(600) }] });
  await runAccountMigration(f.client, await prepare(f));
  assert.equal(f.rows('HeartCounter').length, 1); assert.equal(f.rows('HeartCounter')[0].total, 600);
  assert.ok(f.rows('AccountMigrationArchive').some(row => row.model === 'HeartCounter' && row.disposition === 'SELF_RELATION_HISTORY_ONLY'));
  assert.equal(f.rows('Referral').length, 1); assert.equal(f.rows('Referral')[0].inviteeId, B);
  const snapshot = f.rows('AccountMigration')[0].snapshot as { referralCapCarry: Array<{ amount: string; payouts: unknown[] }> };
  assert.equal(snapshot.referralCapCarry[0].amount, '600'); assert.equal(snapshot.referralCapCarry[0].payouts.length, 1);
  assert.ok(f.rows('AccountMigrationArchive').some(row => row.model === 'ReferralPayout'));
});

test('new WeChat login wins and both old mini sessions revoke; legacy credentials stay archive', async () => {
  const f = fixture({ AccountBinding: [{ id: 'wa', dlmId: 'DA', provider: 'WECHAT_WEB', providerUserId: 'oa', unionId: 'ua' }, { id: 'wb', dlmId: 'DB', provider: 'WECHAT_MINIPROGRAM', providerUserId: 'ob', unionId: 'ub' }],
    WechatProgramSession: [{ id: 'sa', dlmId: 'DA', providerAccountId: 'wa', tokenHash: 'ha' }, { id: 'sb', dlmId: 'DB', providerAccountId: 'wb', tokenHash: 'hb' }] });
  await runAccountMigration(f.client, await prepare(f));
  assert.equal(f.rows('AccountBinding').length, 1); assert.equal(f.rows('AccountBinding')[0].id, 'wb'); assert.equal(f.rows('WechatProgramSession').length, 0);
  assert.ok(f.rows('AccountMigrationArchive').some(row => row.model === 'AccountBinding' && (row.payload as MigrationRow).id === 'wa'));
});

test('same-owner chains flatten without touching a reused Discord original identity', async () => {
  const f = fixture({ AccountOwnership: [{ id: 'alias', identityKind: 'DLM', identityKey: 'OLD', originalDlmId: 'OLD', currentDlmId: 'DA', currentDiscordId: A, migrationId: 'prev', retiredAt: now }] });
  await runAccountMigration(f.client, await prepare(f));
  assert.equal(f.rows('AccountOwnership').find(row => row.id === 'alias')!.currentDlmId, 'DB');
  assert.ok(f.rows('AccountOwnership').some(row => row.identityKind === 'DISCORD' && row.originalDlmId === 'DA'));
});

test('active order precondition refuses before mutation', async () => {
  const f = fixture({ Order: [{ id: 'running', hostId: A, hostDlmId: 'DA', workerId: B, status: 'RUNNING' }] });
  await assert.rejects(previewAccountMigrationTx(f.tx, input, now), /迁移前提/); assert.equal(f.rows('AccountMigration').length, 0);
});

test('0 price is invalid, false settings are not treated as empty, empty target media falls back', () => {
  const merged = mergeMigrationPeiwan(profile(1, A, { auditionInviteEnabled: true, MP_url: 'old' }), profile(2, B, { auditionInviteEnabled: false, MP_url: '' }), { discordUserId: B }, 100)!;
  assert.equal(merged.auditionInviteEnabled, false); assert.equal(merged.MP_url, 'old');
  assert.throws(() => mergeMigrationPeiwan(profile(1, A), profile(2, B, { quotation_Q1: dec(0) }), { discordUserId: B }, 100), /有效正数/);
});

test('metadata coverage discovers every direct owner FK and leaves immutable audit snapshots outside updates', () => {
  for (const model of migrationModels) for (const field of model.fields) if (field.kind === 'object' && ['DlmUser', 'Member', 'PEIWAN'].includes(field.type)) {
    const kind = field.type === 'DlmUser' ? 'dlm' : field.type === 'Member' ? 'member' : 'peiwan';
    for (const name of field.relationFromFields ?? []) assert.ok(migrationOwnerFields(model.name)[kind].has(name));
  }
  assert.equal(migrationOwnerFields('GiftAudit').dlm.size, 0); assert.equal(migrationOwnerFields('OrderAudit').member.size, 0);
  assert.ok(!migrationOwnerFields('IndividualTransaction').member.has('discordId'));
  assert.equal(migrationPlanFingerprint({ FlowBuff: [] }, {}), migrationPlanFingerprint({ FlowBuff: [{ userId: A, remainingExtra: dec(0), expiresAt: new Date(0) }] }, {}));
});


test('third-party WeChat owner is rejected while source and target sharing one verified identity can merge', async () => {
  const same = fixture({ AccountBinding: [{ id: 'wa', dlmId: 'DA', provider: 'WECHAT_WEB', providerUserId: 'oa', unionId: 'same' }, { id: 'wb', dlmId: 'DB', provider: 'WECHAT_MINIPROGRAM', providerUserId: 'ob', unionId: 'same' }] });
  await runAccountMigration(same.client, await prepare(same));
  assert.deepEqual(same.rows('AccountBinding').map(row => row.dlmId), ['DB', 'DB']);
  const conflict = fixture({ AccountBinding: [{ id: 'wa', dlmId: 'DA', provider: 'WECHAT_WEB', providerUserId: 'oa', unionId: 'same' }, { id: 'wx', dlmId: 'THIRD', provider: 'WECHAT_MINIPROGRAM', providerUserId: 'ox', unionId: 'same' }] });
  await assert.rejects(prepare(conflict), /第三个账户/);
  assert.equal(conflict.rows('AccountMigration').length, 0);
});

test('detached wallet uses current DLM balance and only saved roles; source income is historical even when original Discord is reused', async () => {
  const f = fixture({ DetachedDiscordAccount: [{ ownerDlmId: 'DA', memberKey: 'detached:DA', originalDiscordId: B, detachedAt: now }],
    AccountMigration: [{ id: 'detach:previous', mode: 'DETACH', sourceDlmId: 'DA', targetDlmId: 'DA', createdAt: future(-1), rolePlan: { gameRoleIds: [C], reminderRoleIds: [] } }],
    IndividualTransaction: [{ transactionId: 'old-income', dlmId: 'DA', discordId: B, thirdPartydiscordId: C, balanceBefore: dec(0), balanceAfter: dec(6000), typeOfTransaction: '点单', timeCreatedAt: future(-2) }, { transactionId: 'new-income', dlmId: 'DB', discordId: B, thirdPartydiscordId: C, balanceBefore: dec(0), balanceAfter: dec(6000), typeOfTransaction: '点单', timeCreatedAt: future(-1) }] });
  f.rows('DlmUser')[0].discordUserId = null; f.rows('DlmUser')[0].recharge = dec(70); f.rows('DlmUser')[0].totalBalance = dec(150);
  f.rows('Member')[0].discordUserId = 'detached:DA'; f.rows('LoyaltyPoint')[0].discordUserId = 'detached:DA';
  await runAccountMigration(f.client, await prepare(f));
  const row = f.rows('AccountMigration').find(row => row.id === requestId)!;
  const rolePlan = row.rolePlan as { source: { discordId: string | null }; gameRoleIds: string[] };
  assert.equal(rolePlan.source.discordId, null);
  assert.deepEqual(rolePlan.gameRoleIds, [C]);
  assert.deepEqual((row.snapshot as { excludedAutoCommissionTransactionIds: string[] }).excludedAutoCommissionTransactionIds, ['old-income']);
  assert.equal(String(f.rows('DlmUser')[0].totalBalance), '170'); assert.equal(f.rows('DetachedDiscordAccount').length, 0);
});

test('legacy income gets current owner without rewriting original Discord and source IDs alone are excluded', async () => {
  const f = fixture({ IndividualTransaction: [{ transactionId: 'old', dlmId: null, discordId: A, thirdPartydiscordId: C }, { transactionId: 'new', dlmId: null, discordId: B, thirdPartydiscordId: C }] });
  await runAccountMigration(f.client, await prepare(f));
  assert.deepEqual(f.rows('IndividualTransaction').map(row => [row.dlmId, row.discordId]), [['DB', A], ['DB', B]]);
  assert.deepEqual((f.rows('AccountMigration')[0].snapshot as { excludedAutoCommissionTransactionIds: string[] }).excludedAutoCommissionTransactionIds, ['old']);
});

test('merged direct chats keep all messages, conservative read positions and self-chat as history', async () => {
  const f = fixture({ MiniConversation: [{ id: 'old-chat', type: 'DIRECT', peerKey: 'DA:DC', userAId: 'DA', userBId: 'DC', userALastReadAt: now, userBLastReadAt: future(-2) }, { id: 'new-chat', type: 'DIRECT', peerKey: 'DB:DC', userAId: 'DB', userBId: 'DC', userALastReadAt: future(-1), userBLastReadAt: now }, { id: 'self-chat', type: 'DIRECT', peerKey: 'DA:DB', userAId: 'DA', userBId: 'DB' }],
    MiniMessage: [{ id: 'm1', conversationId: 'old-chat', senderDlmId: 'DA', content: 'old' }, { id: 'm2', conversationId: 'new-chat', senderDlmId: 'DB', content: 'new' }, { id: 'm3', conversationId: 'self-chat', senderDlmId: 'DA', content: 'history' }] });
  f.rows('DlmUser').push({ dlmId: 'DC' });
  await runAccountMigration(f.client, await prepare(f));
  assert.equal(f.rows('MiniMessage').length, 3); assert.equal(f.rows('MiniMessage')[0].conversationId, 'new-chat');
  const chat = f.rows('MiniConversation').find(row => row.id === 'new-chat')!;
  assert.equal((chat.userALastReadAt as Date).getTime(), future(-1).getTime()); assert.equal((chat.userBLastReadAt as Date).getTime(), future(-2).getTime());
  assert.match(String(f.rows('MiniConversation').find(row => row.id === 'self-chat')!.peerKey), /^migration-history:/);
});


test('farm helper history follows the new account and duplicate crop eligibility remains consumed', async () => {
  const f = fixture({ FarmProfile: [{ discordUserId: B }], FarmPlot: [{ id: 'plot', discordUserId: B, plotIndex: 0 }], FarmPlotHelp: [
    { id: 'old-help', farmPlotId: 'plot', cropCycle: 1, helperDiscordId: A }, { id: 'new-help', farmPlotId: 'plot', cropCycle: 1, helperDiscordId: B },
    { id: 'old-next', farmPlotId: 'plot', cropCycle: 2, helperDiscordId: A },
  ] });
  await runAccountMigration(f.client, await prepare(f));
  assert.equal(f.rows('FarmPlotHelp').length, 2); assert.ok(f.rows('FarmPlotHelp').every(row => row.helperDiscordId === B));
  assert.ok(f.rows('AccountMigrationArchive').some(row => row.model === 'FarmPlotHelp' && (row.payload as MigrationRow).id === 'old-help'));
});

test('pending payment IDs and submitted withdrawal payout details survive ownership change untouched', async () => {
  const f = fixture({ StripePayment: [{ id: 'sp', outTradeNo: 'stripe-original', discordUserId: A, dlmId: 'DA', status: 'PENDING', paymentIntentId: 'pi-original', rechargeAmount: dec(100) }],
    ZPayRechargeOrder: [{ id: 'zp', outTradeNo: 'zpay-original', discordUserId: A, dlmId: 'DA', status: 'PENDING', amount: dec(50) }],
    WechatNativePayment: [{ id: 'wp', outTradeNo: 'wechat-original', discordUserId: A, dlmId: 'DA', status: 'PENDING', rechargeAmount: dec(30) }],
    Withdraw: [{ id: 'w-old', discordId: A, dlmId: 'DA', amount: dec(100), method: 'old-confirmed-destination', createdAt: future(-1) }, { id: 'w-new', discordId: B, dlmId: 'DB', amount: dec(200), method: 'target-destination', createdAt: future(-2) }] });
  await runAccountMigration(f.client, await prepare(f));
  assert.equal(f.rows('StripePayment')[0].paymentIntentId, 'pi-original'); assert.equal(f.rows('ZPayRechargeOrder')[0].outTradeNo, 'zpay-original'); assert.equal(f.rows('WechatNativePayment')[0].outTradeNo, 'wechat-original');
  for (const model of ['StripePayment', 'ZPayRechargeOrder', 'WechatNativePayment', 'Withdraw']) assert.ok(f.rows(model).every(row => row.dlmId === 'DB'));
  assert.equal(f.rows('Withdraw')[0].method, 'old-confirmed-destination'); assert.equal(String(f.rows('Withdraw')[0].amount), '100');
});

test('both VIP reward instances and issued coupons remain when duplicate claim state is merged', async () => {
  const f = fixture({ VipBenefitGrant: [{ id: 'old-grant', discordUserId: A, benefitCode: 'V1' }, { id: 'new-grant', discordUserId: B, benefitCode: 'V1' }],
    VipBenefitGrantInstance: [{ id: 'old-instance', grantId: 'old-grant', sequence: 1, sourceCouponId: 'old-coupon' }, { id: 'new-instance', grantId: 'new-grant', sequence: 1, sourceCouponId: 'new-coupon' }],
    Coupon: [{ id: 'old-coupon', discordId: A, dlmId: 'DA' }, { id: 'new-coupon', discordId: B, dlmId: 'DB' }] });
  await runAccountMigration(f.client, await prepare(f));
  assert.equal(f.rows('VipBenefitGrant').length, 1); assert.equal(f.rows('VipBenefitGrantInstance').length, 2); assert.equal(f.rows('Coupon').length, 2);
  assert.deepEqual(f.rows('VipBenefitGrantInstance').map(row => row.sequence).sort(), [1, 2]);
  assert.ok(f.rows('Coupon').every(row => row.dlmId === 'DB'));
});


test('cross-guild join eligibility keeps each guild and archives only the same-guild duplicate', async () => {
  const f = fixture({ GuildJoinRecord: [
    { userId: A, guildId: 'guild-1', firstJoinedAt: future(-10) },
    { userId: A, guildId: 'guild-2', firstJoinedAt: future(-9) },
    { userId: B, guildId: 'guild-1', firstJoinedAt: future(-8) },
    { userId: B, guildId: 'guild-3', firstJoinedAt: future(-7) },
  ] });
  f.validate();
  await runAccountMigration(f.client, await prepare(f));
  assert.deepEqual(f.rows('GuildJoinRecord').map(row => [row.userId, row.guildId]).sort(),
    [[B, 'guild-1'], [B, 'guild-2'], [B, 'guild-3']]);
  const duplicate = f.rows('AccountMigrationArchive').filter(row => row.model === 'GuildJoinRecord' && row.disposition === 'DUPLICATE_STATE_ORIGINAL_EVIDENCE_PRESERVED');
  assert.equal(duplicate.length, 1);
  assert.deepEqual(JSON.parse(String(duplicate[0].recordKey)), { userId: A, guildId: 'guild-1' });
  assert.equal((duplicate[0].payload as MigrationRow).guildId, 'guild-1');
});

test('cross-guild invite rewards preserve independent receipts without repeating an already claimed guild reward', async () => {
  const receipt = (id: string, inviteeId: string, guildId: string) => ({ id, inviteeId, guildId,
    inviterId: C, rewardAmount: dec(2), rewardedAt: future(-1), createdAt: future(-1) });
  const f = fixture({ InviteLinkUsage: [receipt('old-1', A, 'guild-1'), receipt('old-2', A, 'guild-2'),
    receipt('new-1', B, 'guild-1'), receipt('new-3', B, 'guild-3')] });
  f.rows('Member').push({ discordUserId: C });
  f.validate();
  await runAccountMigration(f.client, await prepare(f));
  assert.deepEqual(f.rows('InviteLinkUsage').map(row => [row.inviteeId, row.guildId, row.id]).sort(),
    [[B, 'guild-1', 'new-1'], [B, 'guild-2', 'old-2'], [B, 'guild-3', 'new-3']]);
  const duplicate = f.rows('AccountMigrationArchive').filter(row => row.model === 'InviteLinkUsage' && row.disposition === 'DUPLICATE_STATE_ORIGINAL_EVIDENCE_PRESERVED');
  assert.equal(duplicate.length, 1); assert.equal((duplicate[0].payload as MigrationRow).id, 'old-1');
  assert.equal(f.rows('IndividualTransaction').length, 0);
});


test('expired open dispatch history migrates without reopening or extending its original deadline', async () => {
  const f = fixture({ DispatchRequest: [{ id: 'expired-dispatch', ownerDlmId: 'DA', ownerDiscordUserId: A,
    status: 'OPEN', expiresAt: now }] });
  const args = await prepare(f);
  await f.client.$transaction(tx => executeAccountMigrationTx(tx, args, now));
  const moved = f.rows('DispatchRequest')[0];
  assert.equal(moved.ownerDlmId, 'DB'); assert.equal(moved.ownerDiscordUserId, B);
  assert.equal(moved.status, 'OPEN'); assert.equal((moved.expiresAt as Date).getTime(), now.getTime());
  const original = f.rows('AccountMigrationArchive').find(row => row.model === 'DispatchRequest')!.payload as MigrationRow;
  assert.equal(original.ownerDlmId, 'DA'); assert.equal(original.status, 'OPEN');
});

test('live or unproven dispatch deadlines still prevent account migration before any write', async () => {
  for (const expiresAt of [new Date(now.getTime() + 1), null, new Date(NaN)]) {
    const f = fixture({ DispatchRequest: [{ id: 'open-dispatch', ownerDlmId: 'DA', ownerDiscordUserId: A,
      status: 'OPEN', expiresAt }] });
    await assert.rejects(previewAccountMigrationTx(f.tx, input, now), /迁移前提/);
    assert.equal(f.rows('AccountMigration').length, 0);
    assert.equal(f.rows('DlmUser').length, 2);
  }
});
