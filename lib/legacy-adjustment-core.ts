import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { AdjustmentError, parseAdjustmentCommand, type AdjustmentCommand } from './legacy-adjustment';
import { lockDlmWalletsTx } from './dlm-wallet-lock';
import { lockManualQuotaOwnersTx } from './manual-quota-transfer';

type Tx = Prisma.TransactionClient;
type Db = Pick<PrismaClient, '$transaction' | 'revert'>;
type Owner = { dlmId: string; discordId: string | null; memberKey: string | null };
const dec = (v: string | Prisma.Decimal | number) => new Prisma.Decimal(v);
function fail(code: string, message: string): never { throw new AdjustmentError(code, message); }
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));
function stable(v: unknown): string {
  const plain = JSON.parse(JSON.stringify(v));
  const sort = (x: unknown): unknown => Array.isArray(x) ? x.map(sort) : x && typeof x === 'object'
    ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, val]) => [k, sort(val)])) : x;
  return JSON.stringify(sort(plain));
}
const hash = (v: unknown) => createHash('sha256').update(stable(v)).digest('hex');
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};

/** Exact DLM lineage only. Never infer an original owner from a reused Discord account. */
async function ownerTx(tx: Tx, original: string): Promise<Owner> {
  let id = original; const visited = new Set<string>();
  for (let n = 0; n < 32; n++) {
    if (visited.has(id)) break; visited.add(id);
    const current = await tx.dlmUser.findUnique({ where: { dlmId: id }, select: { dlmId: true, discordUserId: true } });
    if (current) {
      const detached = current.discordUserId ? null : await tx.detachedDiscordAccount.findUnique({ where: { ownerDlmId: id } });
      return { dlmId: id, discordId: current.discordUserId, memberKey: current.discordUserId ?? detached?.memberKey ?? null };
    }
    const aliases = await tx.accountOwnership.findMany({ where: { identityKind: 'DLM', identityKey: id, originalDlmId: id }, take: 2 });
    if (aliases.length !== 1) break;
    id = aliases[0].currentDlmId;
  }
  return fail('owner_unresolved', `无法确认账户 ${original} 的当前归属，请先核实账号记录`);
}

async function sourceTx(tx: Tx, source: AdjustmentCommand['source']) {
  if (source.kind === 'GIFT') {
    const a = await tx.giftAudit.findUnique({ where: { individualTransactionId: source.id } });
    const b = await tx.giftAudit.findUnique({ where: { paymentTransactionId: source.id } });
    if (a && b && a.id !== b.id) fail('source_ambiguous', '原流水关联到不同打赏，不能处置');
    const audit = a ?? b;
    if (!audit) fail('source_missing', '找不到对应打赏审计；不能凭备注创建退款原单');
    const [payment, individual] = await Promise.all([
      tx.transaction.findUnique({ where: { Transid: audit.paymentTransactionId } }),
      tx.individualTransaction.findUnique({ where: { transactionId: audit.individualTransactionId } }),
    ]);
    return { kind: source.kind, id: audit.individualTransactionId, canonicalKey: audit.individualTransactionId, auditId: audit.id,
      createdAt: audit.createdAt.toISOString(), snapshot: { audit, payment, individual } };
  }
  const order = await tx.order.findUnique({ where: /^\d+$/.test(source.id) && Number.isSafeInteger(Number(source.id)) ? { displayNo: Number(source.id) } : { id: source.id } });
  if (!order) fail('source_missing', '找不到原订单');
  if (order.status !== 'ENDED') fail('source_not_ended', '只能人工处置已结束订单');
  const audit = await tx.orderAudit.findUnique({ where: { orderId: order.id } });
  const payment = audit ? await tx.transaction.findUnique({ where: { Transid: audit.paymentTransactionId } }) : null;
  return { kind: source.kind, id: order.id, canonicalKey: `ORDER:${order.id}`, auditId: audit?.id ?? null,
    createdAt: order.createdAt.toISOString(), snapshot: { order, audit, payment } };
}

const fields = ['income', 'recharge', 'totalBalance', 'totalSpent', 'loyaltyPoints'] as const;
function amounts(row: { income: Prisma.Decimal; recharge: Prisma.Decimal; totalBalance: Prisma.Decimal; totalSpent: Prisma.Decimal; loyaltyPoints: Prisma.Decimal }) {
  const result = Object.fromEntries(fields.map(k => [k, row[k].toString()])) as Record<typeof fields[number], string>;
  if (fields.some(k => !dec(result[k]).isFinite() || dec(result[k]).decimalPlaces() > 4) || !dec(result.income).add(result.recharge).eq(result.totalBalance)) fail('wallet_inconsistent', '账户总额与分项不符，请先核实账目');
  return result;
}
async function voucherTx(tx: Tx, model: AdjustmentCommand['vouchers'][number]['model'], id: string) {
  if (model === 'coupon') return tx.coupon.findUnique({ where: { id } });
  if (model === 'lotteryDraw') return tx.lotteryDraw.findUnique({ where: { id } });
  return tx.pointShopGrant.findUnique({ where: { id } });
}
function voucherFields(row: NonNullable<Awaited<ReturnType<typeof voucherTx>>>) {
  return { ownerDlmId: row.dlmId, memberKey: 'discordId' in row ? row.discordId : 'userId' in row ? row.userId : row.discordUserId,
    status: 'couponStatus' in row ? row.couponStatus : row.status, consumedAt: 'consumeAt' in row ? row.consumeAt : row.consumedAt,
    orderId: 'consumeOrderId' in row ? row.consumeOrderId : row.orderId, expiresAt: row.expiresAt };
}

/** Preview and execution run the same plan builder. The hash binds original facts,
 * explicit evidence, resolved identities, and every affected before/after value. */
async function planTx(tx: Tx, command: AdjustmentCommand, actor: string, now: Date, lock: boolean) {
  const source = await sourceTx(tx, command.source);
  if (lock) {
    if (source.kind === 'ORDER') await tx.$executeRaw`SELECT 1 FROM "Order" WHERE "id" = ${source.id} FOR UPDATE`;
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`original-disposition:${source.canonicalKey}`}, 0))`);
  }
  const existing = await tx.revert.findUnique({ where: { originalTransactionId: source.canonicalKey } });
  if (existing) fail('already_disposed', `原单已有处置记录 ${existing.id}（${existing.status}），不能再次调整`);
  const ids = [...new Set([...command.wallets.map(r => r.dlmId), ...command.hearts.flatMap(r => [r.fromDlmId, r.toDlmId]),
    ...command.vouchers.map(r => r.ownerDlmId), ...command.quotas.map(r => r.ownerDlmId)])].sort();
  const owners = new Map<string, Owner>();
  for (const id of ids) owners.set(id, await ownerTx(tx, id));
  if (lock) {
    await lockDlmWalletsTx(tx, [...owners.values()].map(o => ({ dlmId: o.dlmId, discordUserId: o.discordId })));
    for (const key of [...new Set([...owners.values()].filter(o => !o.discordId && o.memberKey).map(o => o.memberKey!))].sort()) {
      const rows = await tx.$queryRaw<Array<{ discordUserId: string }>>`SELECT "discordUserId" FROM "Member" WHERE "discordUserId" = ${key} FOR UPDATE`;
      if (rows.length !== 1) fail('owner_changed', '解绑账户的保管记录已变化');
    }
    for (const id of ids) if (stable(owners.get(id)) !== stable(await ownerTx(tx, id))) fail('owner_changed', '账户归属变化，请重新预览');
    if (stable(source) !== stable(await sourceTx(tx, command.source))) fail('source_changed', '原单事实已变化，请重新核实');
  }
  const wallets = [];
  const seenWallets = new Set<string>();
  for (const change of command.wallets) {
    const owner = owners.get(change.dlmId)!;
    if (seenWallets.has(owner.dlmId)) fail('duplicate_current_owner', '两个填写的账户已合并为同一账户，请合并调整行');
    seenWallets.add(owner.dlmId);
    const row = await tx.dlmUser.findUnique({ where: { dlmId: owner.dlmId } });
    if (!row) fail('owner_changed', '账户不存在');
    const before = amounts(row);
    const points = owner.memberKey ? await tx.loyaltyPoint.findUnique({ where: { discordUserId: owner.memberKey } }) : null;
    if (owner.discordId && points && (!points.points.eq(before.loyaltyPoints) || (points.dlmId && points.dlmId !== owner.dlmId))) fail('wallet_inconsistent', '积分镜像与账户不一致，请先核实');
    const member = owner.memberKey ? await tx.member.findUnique({ where: { discordUserId: owner.memberKey } }) : null;
    if (owner.memberKey && !member) fail('wallet_missing', '账户钱包记录缺失');
    if (owner.discordId && member && (['income', 'recharge', 'totalBalance', 'totalSpent'] as const).some(k => !member[k].eq(before[k]))) fail('wallet_inconsistent', '网站与Discord钱包不一致，请先核实');
    const profile = owner.memberKey ? await tx.pEIWAN.findUnique({ where: { discordUserId: owner.memberKey }, select: { PEIWANID: true, totalEarn: true, balance: true } }) : null;
    if (profile && (!profile.totalEarn.isFinite() || profile.totalEarn.decimalPlaces() > 4)) fail('profile_inconsistent', '陪玩累计流水格式异常');
    if (!dec(change.earnDelta).isZero() && !profile) fail('profile_missing', '调整陪玩流水必须有当前陪玩档案');
    const delta = { income: change.incomeDelta, recharge: change.rechargeDelta, totalBalance: dec(change.incomeDelta).add(change.rechargeDelta).toString(), totalSpent: change.totalSpentDelta, loyaltyPoints: change.loyaltyPointsDelta };
    const after = Object.fromEntries(fields.map(k => [k, dec(before[k]).add(delta[k]).toString()])) as typeof before;
    if (fields.some(k => dec(after[k]).abs().gte('1000000000000000'))) fail('amount_out_of_range', '调整后的金额超出存储范围');
    wallets.push({ inputDlmId: change.dlmId, ...owner, displayName: row.discordDisplayName ?? row.wechatDisplayName ?? owner.dlmId, ...change,
      dlmId: owner.dlmId, before, after, profileId: profile?.PEIWANID ?? null,
      mirrorsBefore: { member: member ? json({ income: member.income, recharge: member.recharge, totalBalance: member.totalBalance, totalSpent: member.totalSpent }) : null, points: points ? json({ points: points.points, dlmId: points.dlmId }) : null, profileBalance: profile?.balance.toString() ?? null },
      earnBefore: profile?.totalEarn.toString() ?? null, earnAfter: profile ? profile.totalEarn.add(change.earnDelta).toString() : null });
  }
  const hearts = [];
  const seenHearts = new Set<string>();
  for (const change of command.hearts) {
    const from = owners.get(change.fromDlmId)!, to = owners.get(change.toDlmId)!;
    if (!from.memberKey || !to.memberKey || from.dlmId === to.dlmId) fail('heart_owner_invalid', '心动需要两个不同且存在业务身份的账户');
    const key = `${from.memberKey}:${to.memberKey}`;
    if (seenHearts.has(key)) fail('duplicate_heart', '合并后的同一心动关系不能重复调整'); seenHearts.add(key);
    const row = await tx.heartCounter.findUnique({ where: { fromMemberId_toMemberId: { fromMemberId: from.memberKey, toMemberId: to.memberKey } } });
    const before = row?.total ?? 0, after = before + change.delta;
    if (!Number.isSafeInteger(after) || Math.abs(after) > 2147483647) fail('heart_out_of_range', '心动数超出存储范围');
    hearts.push({ ...change, from, to, before, after, rowId: row?.id ?? null });
  }
  const vouchers = [];
  for (const change of [...command.vouchers].sort((a, b) => `${a.model}:${a.id}`.localeCompare(`${b.model}:${b.id}`))) {
    if (lock) {
      const table = change.model === 'coupon' ? Prisma.sql`"Coupon"` : change.model === 'lotteryDraw' ? Prisma.sql`"LotteryDraw"` : Prisma.sql`"PointShopGrant"`;
      await tx.$queryRaw(Prisma.sql`SELECT id FROM ${table} WHERE id = ${change.id} FOR UPDATE`);
    }
    const row = await voucherTx(tx, change.model, change.id);
    if (!row) fail('voucher_missing', '找不到填写的原券');
    const facts = voucherFields(row), owner = owners.get(change.ownerDlmId)!;
    // A legacy null DLM can be accepted only against the selected CURRENT owner
    // key, with the full consumed lifecycle bound to the preview and journal.
    if ((facts.ownerDlmId && (await ownerTx(tx, facts.ownerDlmId)).dlmId !== owner.dlmId) || (!facts.ownerDlmId && (!owner.memberKey || facts.memberKey !== owner.memberKey))) fail('voucher_owner_mismatch', '券不属于填写的账户');
    if ('deliveryType' in row && (row.deliveryType !== 'COUPON' || row.deliveryStatus !== 'DELIVERED')) fail('voucher_not_delivered', '积分商城记录不是已发放的券');
    if (source.kind === 'GIFT' && facts.orderId && facts.orderId !== `GIFT:${source.auditId}`) fail('voucher_source_mismatch', '券的本次使用明确属于其他原单');
    if (facts.status !== 'USED' || !facts.consumedAt) fail('voucher_not_used', '原券并非已使用，不能重复恢复');
    if (source.kind === 'ORDER' && facts.orderId && facts.orderId !== source.id) fail('voucher_source_mismatch', '券明确属于另一订单');
    const expired = facts.expiresAt !== null && facts.expiresAt <= now;
    vouchers.push({ ...change, owner, before: json(row), afterStatus: expired ? 'EXPIRED' : change.model === 'lotteryDraw' ? 'UNUSED' : 'ACTIVE', expiresAt: facts.expiresAt?.toISOString() ?? null });
  }
  const quotas = command.quotas.map(change => { const owner = owners.get(change.ownerDlmId)!;
    if (!owner.memberKey) fail('quota_owner_missing', '额度需要存在业务身份的账户');
    return { ...change, owner, before: '0', after: new Date(change.expiresAt) > now ? change.amount : '0', restoredAmount: new Date(change.expiresAt) > now ? change.amount : '0', expired: new Date(change.expiresAt) <= now };
  });
  const totalWalletDelta = wallets.reduce((n, w) => n.add(w.incomeDelta).add(w.rechargeDelta), dec(0));
  const r = command.reporting;
  if (r.grossDelta !== null && r.payoutDelta !== null && r.referralDelta !== null && r.discountDelta !== null &&
      !dec(r.grossDelta).sub(r.payoutDelta).sub(r.referralDelta).sub(r.discountDelta).eq(totalWalletDelta.negated())) fail('reporting_unbalanced', '财务分类净额必须等于平台钱包净变动的相反数；未知分类请留空待核实');
  const plan = { actor, source, command, wallets, hearts, vouchers, quotas, totalWalletDelta: totalWalletDelta.toString() };
  return { ...plan, previewHash: hash(plan) };
}

export class AdjustmentOutcomeUnknown extends AdjustmentError {
  constructor() { super('outcome_unknown', '本次提交结果尚未确认。请按原请求编号查询，不要创建另一笔退款。', 202); }
}
const receipt = (row: Awaited<ReturnType<Db['revert']['findUnique']>>) => row ? json({ requestId: row.id, sourceKey: row.originalTransactionId, status: row.status, operatorId: row.operatorId, createdAt: row.createdAt, details: row.details }) : null;

export function createLegacyAdjustmentService(deps: { db: Db; isAdmin: (discordId: string) => boolean; now?: () => Date }) {
  function authorize(actor: string) { if (!actor || !deps.isAdmin(actor)) throw new AdjustmentError('forbidden', '仅管理员可执行人工账务处置', 403); }
  return {
    async query(actor: string, requestId: string) {
      authorize(actor); if (!requestId || requestId.length > 200) throw new AdjustmentError('invalid_request', '请求编号无效', 400);
      const row = await deps.db.revert.findUnique({ where: { id: requestId } });
      if (row && (row.status !== 'MANUAL_ADJUSTED' || obj(row.details).mode !== 'LEGACY_MANUAL_ADJUSTMENT')) throw new AdjustmentError('not_manual_request', '该编号不是已完成的人工调整请求，请核对原请求编号', 409);
      return receipt(row);
    },
    async preview(actor: string, input: unknown) {
      authorize(actor); const command = parseAdjustmentCommand(input);
      if (!command.references.length) throw new AdjustmentError('proof_missing', '至少填写一项已核对的凭据编号或地址', 400);
      return deps.db.$transaction(tx => planTx(tx, command, actor, deps.now?.() ?? new Date(), false), { isolationLevel: 'RepeatableRead' });
    },
    async execute(actor: string, input: unknown, expectedPreviewHash: string, confirmed: boolean) {
      authorize(actor); const command = parseAdjustmentCommand(input);
      if (!command.references.length || !confirmed || !/^[a-f0-9]{64}$/.test(expectedPreviewHash)) throw new AdjustmentError('confirmation_required', '请完成凭据核实、预览并明确确认本次处置', 400);
      if (Object.entries(command.reporting).some(([key, value]) => key !== 'explanation' && value === null)) throw new AdjustmentError('reporting_required', '提交前请明确本次实际调整的四项财务分类；不调整填0，不得猜测原旧账', 400);
      const intentHash = hash({ actor, command });
      const replay = (row: NonNullable<Awaited<ReturnType<Db['revert']['findUnique']>>>) => {
        const details = obj(row.details);
        if (row.operatorId !== actor || details.mode !== 'LEGACY_MANUAL_ADJUSTMENT' || details.version !== 1 || details.intentHash !== intentHash) fail('request_conflict', '该请求编号已用于其他操作者或不同调整，不能覆盖');
        if (row.status !== 'MANUAL_ADJUSTED') fail('request_pending', '原请求尚未确认，请只查询原记录');
        return receipt(row)!;
      };
      const saved = await deps.db.revert.findUnique({ where: { id: command.requestId } });
      if (saved) return replay(saved);
      let callbackCompleted = false;
      try {
        return await deps.db.$transaction(async tx => {
          await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`manual-adjustment-request:${command.requestId}`}, 0))`);
          const existing = await tx.revert.findUnique({ where: { id: command.requestId } });
          if (existing) { const result = replay(existing); callbackCompleted = true; return result; }
          const now = deps.now?.() ?? new Date(), plan = await planTx(tx, command, actor, now, true);
          if (plan.previewHash !== expectedPreviewHash) fail('preview_changed', '原单、账户、余额或权益已变化，请重新预览后确认');
          await tx.$executeRaw(Prisma.sql`SELECT set_config('bot.skip_recharge_notify','true',true), set_config('app.suppress_peiwan_notifications','on',true)`);
          const entry = await tx.revert.create({ data: { id: command.requestId, originalTransactionId: plan.source.canonicalKey, operatorId: actor,
            reason: command.proof, status: 'PENDING', createdAt: now } });
          const wallets = [];
          for (const w of plan.wallets) {
            const data = { income: dec(w.after.income), recharge: dec(w.after.recharge), totalBalance: dec(w.after.totalBalance), totalSpent: dec(w.after.totalSpent) };
            const changed = await tx.dlmUser.update({ where: { dlmId: w.dlmId }, data: { ...data, loyaltyPoints: dec(w.after.loyaltyPoints) } });
            if (stable(amounts(changed)) !== stable(w.after)) fail('wallet_write_mismatch', '实际记账结果不符，本次已回滚');
            if (w.memberKey) {
              const member = await tx.member.update({ where: { discordUserId: w.memberKey }, data });
              if ((['income', 'recharge', 'totalBalance', 'totalSpent'] as const).some(k => !member[k].eq(w.after[k]))) fail('wallet_write_mismatch', '钱包同步结果不符');
              const points = await tx.loyaltyPoint.upsert({ where: { discordUserId: w.memberKey }, create: { discordUserId: w.memberKey, dlmId: w.dlmId, points: dec(w.after.loyaltyPoints) }, update: { dlmId: w.dlmId, points: dec(w.after.loyaltyPoints) } });
              if (!points.points.eq(w.after.loyaltyPoints)) fail('benefit_write_mismatch', '积分镜像写入结果不符');
            }
            if (w.profileId !== null) {
              const p = await tx.pEIWAN.update({ where: { PEIWANID: w.profileId }, data: { totalEarn: dec(w.earnAfter!), balance: dec(w.after.totalBalance) } });
              if (p.discordUserId !== w.memberKey || !p.totalEarn.eq(w.earnAfter!) || !p.balance.eq(w.after.totalBalance)) fail('benefit_write_mismatch', '陪玩权益记账结果不符');
            }
            const transactionId = `ITMA${randomUUID().replaceAll('-', '').toUpperCase()}`;
            const actual = await tx.individualTransaction.create({ data: { transactionId, timeCreatedAt: entry.createdAt,
              dlmId: w.dlmId, discordId: w.discordId, thirdPartydiscordId: actor, balanceBefore: dec(w.before.totalBalance), balanceAfter: dec(w.after.totalBalance),
              amountChange: dec(w.after.totalBalance).sub(w.before.totalBalance).abs(), typeOfTransaction: plan.source.kind === 'GIFT' ? '人工赠礼调整' : '人工订单调整' } });
            if (actual.transactionId !== transactionId || !actual.balanceBefore.eq(w.before.totalBalance) || !actual.balanceAfter.eq(w.after.totalBalance)) fail('receipt_mismatch', '调整流水写入不符');
            wallets.push({ ...w, transactionId });
          }
          const hearts = [];
          for (const h of plan.hearts) {
            const actual = await tx.heartCounter.upsert({ where: { fromMemberId_toMemberId: { fromMemberId: h.from.memberKey!, toMemberId: h.to.memberKey! } },
              create: { fromMemberId: h.from.memberKey!, toMemberId: h.to.memberKey!, total: h.after }, update: { total: h.after } });
            if (actual.total !== h.after) fail('benefit_write_mismatch', '心动调整结果不符');
            hearts.push({ ...h, heartCounterId: actual.id });
          }
          const vouchers = [];
          for (const v of plan.vouchers) {
            const before = obj(v.before), common = { dlmId: v.owner.dlmId, consumeAmount: null, consumeTargetId: null, consumeTargetDlmId: null };
            if (v.model === 'coupon') await tx.coupon.update({ where: { id: v.id }, data: { ...common, status: v.afterStatus as 'ACTIVE' | 'EXPIRED', consumedAt: null, orderId: null } });
            else if (v.model === 'lotteryDraw') await tx.lotteryDraw.update({ where: { id: v.id }, data: { ...common, status: v.afterStatus as 'UNUSED' | 'EXPIRED', consumeAt: null, consumeOrderId: null } });
            else await tx.pointShopGrant.update({ where: { id: v.id }, data: { ...common, couponStatus: v.afterStatus as 'ACTIVE' | 'EXPIRED', consumedAt: null, consumeOrderId: null } });
            const after = await voucherTx(tx, v.model, v.id);
            if (!after || voucherFields(after).status !== v.afterStatus || (after.expiresAt?.toISOString() ?? null) !== before.expiresAt || voucherFields(after).consumedAt !== null) fail('benefit_write_mismatch', '券恢复结果不符');
            vouchers.push({ ...v, after: json(after) });
          }
          await lockManualQuotaOwnersTx(tx, plan.quotas.filter(q => !q.expired).map(q => q.owner.memberKey!));
          const quotas = [];
          for (const q of plan.quotas) {
            const restored = q.expired ? null : await tx.manualQuotaRestoration.create({ data: { userId: q.owner.memberKey!, kind: q.kind, remainingExtra: dec(q.restoredAmount), expiresAt: new Date(q.expiresAt) } });
            if (restored && (!restored.remainingExtra.eq(q.restoredAmount) || restored.expiresAt.toISOString() !== q.expiresAt)) fail('benefit_write_mismatch', '退回额度记录不符');
            quotas.push({ ...q, restorationId: restored?.id ?? null });
          }
          const details = json({ version: 1, mode: 'LEGACY_MANUAL_ADJUSTMENT', source: { ...plan.source, snapshot: undefined }, sourceSnapshot: plan.source.snapshot,
            intentHash, command, previewHash: expectedPreviewHash, followUp: { version: 1, status: 'PENDING', ownerDlmIds: [...new Set([...plan.wallets.map(w => w.dlmId), ...plan.hearts.flatMap(h => [h.from.dlmId, h.to.dlmId])])], incomeOwnerDlmIds: plan.wallets.filter(w => !dec(w.rewardIncomeDelta).isZero()).map(w => w.dlmId), attemptedAt: null, nextAttemptAt: null, claimToken: null, lastError: null }, result: { wallets, hearts, vouchers, quotas }, reporting: command.reporting });
          const result = receipt(await tx.revert.update({ where: { id: command.requestId }, data: { status: 'MANUAL_ADJUSTED', details } }))!;
          callbackCompleted = true; return result;
        }, { isolationLevel: 'Serializable', timeout: 30000 });
      } catch (error) {
        if (error instanceof AdjustmentError) throw error;
        const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
        if (code === 'P2034') throw new AdjustmentError('concurrent_change', '并发更新已回滚，请重新预览');
        if (code === 'P2002') {
          const found = await deps.db.revert.findUnique({ where: { id: command.requestId } });
          if (found) return replay(found);
          throw new AdjustmentError('already_disposed', '原单已有处置记录，请查询原单');
        }
        if (callbackCompleted || ['P1001', 'P1002', 'P1008', 'P1017', 'P2028'].includes(code ?? '') || error instanceof Prisma.PrismaClientUnknownRequestError || error instanceof Prisma.PrismaClientRustPanicError) throw new AdjustmentOutcomeUnknown();
        throw error;
      }
    },
  };
}
