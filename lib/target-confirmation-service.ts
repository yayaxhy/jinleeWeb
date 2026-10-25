import type { PrismaClient } from '@prisma/client';
import type { SessionSnapshot } from '../types/session';
import { newEntityOnlyTime } from './operating-entity-cutover';
import { COUPON_VOUCHER_META, SPECIAL_ACTION_COUPON_TYPE_BY_PRIZE, SPECIAL_ACTION_KIND_BY_PRIZE, inferPrizeTypeByPrizeName } from './voucherCatalog';
import { resolveVoucherTargetIdentity, VoucherRequestIdentityError } from './voucher-request-identity';
import {
  TargetConfirmationError, normalizeTargetConfirmationScope,
  type ConfirmationIdentity, type ConfirmationTarget, type ConfirmationVoucher,
  type TargetConfirmationCodec, type TargetConfirmationScope,
} from './target-confirmation';

type Client = Pick<PrismaClient, 'dlmUser' | 'member' | 'pEIWAN' | 'coupon' | 'pointShopGrant' | 'lotteryDraw'>;
type Dependencies = { client: Client; codec: TargetConfirmationCodec; isAdmin: (discordId: string | null) => boolean; now?: () => Date };
const fail = (): never => { throw new TargetConfirmationError(); };
const profileSelect = { dlmId: true, discordUserId: true, sessionVersion: true, discordDisplayName: true, wechatDisplayName: true,
  member: { select: { discordUserId: true, serverDisplayName: true } } } as const;
const displayName = (row: { dlmId: string; discordDisplayName: string | null; wechatDisplayName: string | null; member: { serverDisplayName: string | null } | null }) =>
  (row.member?.serverDisplayName || row.discordDisplayName || row.wechatDisplayName || row.dlmId).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 256) || row.dlmId;

/** Fixed DLM lookups only. Never fall back to a potentially reused Discord. */
async function recheckIdentity(client: Client, expected: ConfirmationIdentity) {
  const row = await client.dlmUser.findUnique({ where: { dlmId: expected.dlmId }, select: profileSelect });
  if (!row || row.discordUserId !== expected.discordUserId ||
      (expected.discordUserId !== null && row.member?.discordUserId !== expected.discordUserId)) return fail();
  return row;
}
export async function readTargetConfirmationCaller(client: Client, session: SessionSnapshot | null): Promise<ConfirmationIdentity> {
  if (!session) throw new TargetConfirmationError('未登录', 401);
  // Legacy sessions without a stable DLM must log in again; a lookup by their
  // old Discord would turn an account reuse into a different initiator.
  if (!session.dlmId) return fail();
  const caller = { dlmId: session.dlmId, discordUserId: session.discordId ?? null };
  const current = await recheckIdentity(client, caller);
  if (current.sessionVersion !== (session.sessionVersion ?? 1)) return fail();
  return caller;
}
async function recheckTarget(client: Client, expected: ConfirmationTarget) {
  const current = await recheckIdentity(client, expected);
  if (expected.peiwanId !== undefined) {
    const profile = await client.pEIWAN.findUnique({ where: { PEIWANID: expected.peiwanId }, select: { PEIWANID: true, discordUserId: true } });
    if (!profile || profile.discordUserId !== expected.discordUserId) return fail();
  }
  return { ...expected, displayName: displayName(current) };
}

function checkVoucherPurpose(scope: TargetConfirmationScope, selected: ConfirmationVoucher) {
  if (scope.prizeName && scope.prizeName !== selected.prizeName) return fail();
  if (scope.purpose !== 'gift') {
    const kind = SPECIAL_ACTION_KIND_BY_PRIZE[selected.prizeName];
    if (!kind || kind === 'simple') return fail();
  }
  return selected;
}

/** Read an exact source/ID, including its real type. This same read is used
 * after verification, so a vanished or spent voucher never selects a fallback. */
async function readExactVoucher(client: Client, caller: ConfirmationIdentity, scope: TargetConfirmationScope, selected: Pick<ConfirmationVoucher, 'source' | 'voucherId'>, now: Date) {
  const idWhere = { where: { id: selected.voucherId }, select: { id: true } } as const;
  const sourceRows = await Promise.all([
    client.coupon.findFirst(idWhere), client.pointShopGrant.findFirst(idWhere), client.lotteryDraw.findFirst(idWhere),
  ]);
  // Bot's legacy voucher protocol carries an exact ID but searches three
  // sources. Reject existing cross-table collisions instead of guessing which
  // source it will consume. No account-scoped filtering may hide a collision.
  if (sourceRows.filter(Boolean).length > 1) {
    throw new TargetConfirmationError('券编号存在冲突，请管理员核实后重新查询并确认。', 409, 'TARGET_CONFIRMATION_REVIEW_REQUIRED');
  }
  if (!sourceRows[['coupon', 'pointshop', 'lottery'].indexOf(selected.source)]) return fail();
  const common = { id: selected.voucherId, dlmId: caller.dlmId };
  let prizeName: string | undefined;
  let isGift = false;
  if (selected.source === 'coupon') {
    const row = await client.coupon.findFirst({ where: { ...common, status: 'ACTIVE', consumedAt: null, orderId: null,
      issuedAt: newEntityOnlyTime(), expiresAt: { gt: now } }, select: { type: true } });
    if (row) { prizeName = COUPON_VOUCHER_META[row.type]?.prizeName; isGift = COUPON_VOUCHER_META[row.type]?.prizeType === 'GIFT'; }
  } else if (selected.source === 'pointshop') {
    const row = await client.pointShopGrant.findFirst({ where: { ...common, deliveryType: 'COUPON', deliveryStatus: 'DELIVERED', couponStatus: 'ACTIVE',
      consumedAt: null, consumeOrderId: null, issuedAt: newEntityOnlyTime(), OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { couponType: true, itemName: true } });
    if (row) {
      prizeName = row.couponType ? COUPON_VOUCHER_META[row.couponType]?.prizeName : row.itemName.trim();
      isGift = row.couponType ? COUPON_VOUCHER_META[row.couponType]?.prizeType === 'GIFT' : inferPrizeTypeByPrizeName(prizeName) === 'GIFT';
    }
  } else {
    const row = await client.lotteryDraw.findFirst({ where: { ...common, status: 'UNUSED', consumeAt: null, consumeOrderId: null,
      createdAt: newEntityOnlyTime(), ...(scope.purpose === 'gift' ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } : { expiresAt: { gt: now } }) },
      select: { prize: { select: { name: true, type: true } } } });
    if (row) { prizeName = row.prize?.name; isGift = row.prize?.type === 'GIFT'; }
  }
  if (!prizeName || (scope.purpose === 'gift' && !isGift)) return fail();
  return checkVoucherPurpose(scope, { ...selected, prizeName });
}

async function selectVoucher(client: Client, caller: ConfirmationIdentity, scope: TargetConfirmationScope, now: Date): Promise<ConfirmationVoucher> {
  if (scope.lotteryId) return readExactVoucher(client, caller, scope, { source: 'lottery', voucherId: scope.lotteryId }, now);
  if (scope.couponId) {
    // Existing source precedence is preserved, but an explicit ID can never
    // fall through to a different voucher or the caller's next lottery prize.
    const coupon = await client.coupon.findFirst({ where: { id: scope.couponId, dlmId: caller.dlmId }, select: { id: true } });
    return readExactVoucher(client, caller, scope, { source: coupon ? 'coupon' : 'pointshop', voucherId: scope.couponId }, now);
  }
  const prizeName = scope.prizeName!;
  const couponType = SPECIAL_ACTION_COUPON_TYPE_BY_PRIZE[prizeName];
  if (!couponType || !SPECIAL_ACTION_KIND_BY_PRIZE[prizeName] || SPECIAL_ACTION_KIND_BY_PRIZE[prizeName] === 'simple') return fail();
  const coupon = await client.coupon.findFirst({ where: { dlmId: caller.dlmId, type: couponType, status: 'ACTIVE', consumedAt: null, orderId: null,
    issuedAt: newEntityOnlyTime(), expiresAt: { gt: now } }, orderBy: [{ expiresAt: 'asc' }, { issuedAt: 'asc' }, { id: 'asc' }], select: { id: true } });
  if (coupon) return readExactVoucher(client, caller, scope, { source: 'coupon', voucherId: coupon.id }, now);
  const grant = await client.pointShopGrant.findFirst({ where: { dlmId: caller.dlmId, deliveryType: 'COUPON', deliveryStatus: 'DELIVERED', couponType,
    couponStatus: 'ACTIVE', consumedAt: null, consumeOrderId: null, issuedAt: newEntityOnlyTime(), OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: [{ expiresAt: 'asc' }, { issuedAt: 'asc' }, { id: 'asc' }], select: { id: true } });
  if (grant) return readExactVoucher(client, caller, scope, { source: 'pointshop', voucherId: grant.id }, now);
  const draw = await client.lotteryDraw.findFirst({ where: { dlmId: caller.dlmId, status: 'UNUSED', consumeAt: null, consumeOrderId: null,
    createdAt: newEntityOnlyTime(), prize: { name: prizeName }, expiresAt: { gt: now } }, orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }], select: { id: true } });
  if (!draw) return fail();
  return readExactVoucher(client, caller, scope, { source: 'lottery', voucherId: draw.id }, now);
}

/** Every dependency is injected; only findUnique/findFirst reads are used. */
export function createTargetConfirmationService(deps: Dependencies) {
  const { client, codec } = deps;
  const now = deps.now ?? (() => new Date());
  const checkAccess = (caller: ConfirmationIdentity, scope: TargetConfirmationScope) => {
    if (!caller.discordUserId) return fail();
    if (scope.purpose === 'delegated-gift' && !deps.isAdmin(caller.discordUserId)) throw new TargetConfirmationError('无权访问', 403);
  };
  return {
    async issue(session: SessionSnapshot | null, rawScope: unknown) {
      const scope = normalizeTargetConfirmationScope(rawScope);
      const caller = await readTargetConfirmationCaller(client, session);
      checkAccess(caller, scope);
      const selectedVoucher = scope.purpose === 'delegated-gift' ? null : await selectVoucher(client, caller, scope, now());
      const requirePeiwan = scope.purpose === 'delegated-gift' || SPECIAL_ACTION_KIND_BY_PRIZE[selectedVoucher?.prizeName ?? ''] === 'peiwan_review';
      const resolved = await resolveVoucherTargetIdentity(client, scope.target, requirePeiwan).catch(error => {
        if (error instanceof VoucherRequestIdentityError) return fail();
        throw error;
      });
      if (!resolved) throw new TargetConfirmationError('未找到可用的目标账号，请重新查询并确认对象。', 404);
      const target = await recheckTarget(client, { ...resolved, displayName: resolved.dlmId });
      let payer = null;
      if (scope.purpose === 'delegated-gift') {
        const row = await client.dlmUser.findUnique({ where: { dlmId: scope.payerDlmId! }, select: profileSelect });
        if (!row) return fail();
        await recheckIdentity(client, row);
        payer = { dlmId: row.dlmId, discordUserId: row.discordUserId, displayName: displayName(row) };
      }
      // A caller merge while target reads were in flight must not mint a token
      // for an obsolete session identity.
      await readTargetConfirmationCaller(client, session);
      return { ...codec.issue({ caller, scope, target, payer, selectedVoucher }), target,
        ...(payer ? { payer } : {}), ...(selectedVoucher ? { selectedVoucher } : {}) };
    },
    async verify(token: unknown, caller: ConfirmationIdentity, rawScope: unknown) {
      const scope = normalizeTargetConfirmationScope(rawScope);
      const proof = codec.verify(token, caller, scope);
      checkAccess(caller, scope);
      await recheckIdentity(client, caller);
      await recheckTarget(client, proof.target);
      if (proof.payer) await recheckIdentity(client, proof.payer);
      if (proof.selectedVoucher) {
        const current = await readExactVoucher(client, caller, scope, proof.selectedVoucher, now());
        if (current.prizeName !== proof.selectedVoucher.prizeName) return fail();
      }
      return proof;
    },
  };
}
