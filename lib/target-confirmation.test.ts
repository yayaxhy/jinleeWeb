import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { createTargetConfirmationCodec, normalizeTargetConfirmationScope, TargetConfirmationError, TARGET_CONFIRMATION_TTL_MS, type TargetConfirmationEvidence } from './target-confirmation';

const secret = 'offline-test-secret-never-production';
const caller = { dlmId: 'caller', discordUserId: '123456789012345678' };
const target = { dlmId: 'receiver', discordUserId: '223456789012345678', displayName: '收礼人', peiwanId: 7 };
const giftScope = () => normalizeTargetConfirmationScope({ purpose: 'gift', target: ' 7 ', couponId: 'coupon-1', prizeName: '小蛋糕代金券' });
const evidence = (): TargetConfirmationEvidence => ({ caller, target, scope: giftScope(), payer: null, selectedVoucher: { source: 'coupon', voucherId: 'coupon-1', prizeName: '小蛋糕代金券' } });
const baseTime = Date.parse('2026-10-22T12:00:00Z');
function fixture() {
  let time = baseTime;
  const codec = createTargetConfirmationCodec({ secret, now: () => time });
  return { codec, time: (value: number) => { time = value; }, token: () => codec.issue(evidence()).confirmationToken };
}

test('domain-separated confirmation signs full evidence and expires after exactly five minutes', () => {
  const f = fixture(); const issued = f.codec.issue(evidence());
  assert.equal(issued.expiresAt, '2026-10-22T12:05:00.000Z');
  const proof = f.codec.verify(issued.confirmationToken, caller, giftScope());
  assert.equal(proof.target.peiwanId, 7); assert.equal(proof.selectedVoucher?.voucherId, 'coupon-1');
  assert.equal(proof.expiresAt - proof.issuedAt, TARGET_CONFIRMATION_TTL_MS);
});
test('expiry is exclusive and a clock before issuance rejects the token', () => {
  const f = fixture(); const token = f.token(); f.time(baseTime + TARGET_CONFIRMATION_TTL_MS - 1);
  assert.ok(f.codec.verify(token, caller, giftScope()));
  for (const time of [baseTime + TARGET_CONFIRMATION_TTL_MS, baseTime - 1, NaN, Infinity]) {
    f.time(time); assert.throws(() => f.codec.verify(token, caller, giftScope()), TargetConfirmationError);
  }
});
test('cannot reuse a token across caller DLM, caller Discord, target string, coupon, prize or purpose', () => {
  const f = fixture(); const token = f.token();
  for (const actor of [{ ...caller, dlmId: 'other' }, { ...caller, discordUserId: target.discordUserId }, { ...caller, discordUserId: null }]) {
    assert.throws(() => f.codec.verify(token, actor, giftScope()), TargetConfirmationError);
  }
  for (const change of [{ target: target.discordUserId }, { couponId: 'coupon-2' }, { prizeName: '香水代金券' }, { purpose: 'voucher' as const }]) {
    assert.throws(() => f.codec.verify(token, caller, { ...giftScope(), ...change }), TargetConfirmationError);
  }
});
test('token binds delegated payer, gift and quantity, including fractional quantities', () => {
  const f = fixture(); const scope = normalizeTargetConfirmationScope({ purpose: 'delegated-gift', target: '7', payerDlmId: 'payer', giftName: '小蛋糕', quantity: 1.5 });
  const token = f.codec.issue({ caller, target, scope, payer: { dlmId: 'payer', discordUserId: null, displayName: '微信老板' }, selectedVoucher: null }).confirmationToken;
  assert.equal(f.codec.verify(token, caller, scope).payer?.discordUserId, null);
  for (const changed of [{ payerDlmId: 'other' }, { giftName: '香水' }, { quantity: 2 }]) assert.throws(() => f.codec.verify(token, caller, { ...scope, ...changed }), TargetConfirmationError);
});
test('legacy prize-only scope still signs the exact selected source and voucher', () => {
  const f = fixture(); const scope = normalizeTargetConfirmationScope({ purpose: 'voucher', target: '7', prizeName: '双倍流水5000券' });
  const token = f.codec.issue({ caller, target, scope, payer: null, selectedVoucher: { source: 'pointshop', voucherId: 'chosen-1', prizeName: scope.prizeName! } }).confirmationToken;
  const proof = f.codec.verify(token, caller, scope);
  assert.equal(proof.scope.couponId, null); assert.equal(proof.selectedVoucher?.voucherId, 'chosen-1');
  assert.throws(() => f.codec.verify(token, caller, { ...scope, couponId: 'chosen-1' }), TargetConfirmationError);
});
test('missing, oversized, appended and tampered tokens fail before returning evidence', () => {
  const f = fixture(); const token = f.token();
  for (const invalid of [null, undefined, '', token + '.extra', 'a'.repeat(8193), token.slice(0, -2) + 'aa', 123, token.replace('.', '..')]) {
    assert.throws(() => f.codec.verify(invalid, caller, giftScope()), TargetConfirmationError);
  }
});
test('ordinary session HMAC and another secret cannot validate target confirmation', () => {
  const f = fixture(); const encoded = f.token().split('.')[0];
  const sessionStyle = encoded + '.' + createHmac('sha256', secret).update(encoded).digest('base64url');
  assert.throws(() => f.codec.verify(sessionStyle, caller, giftScope()), TargetConfirmationError);
  assert.throws(() => createTargetConfirmationCodec({ secret: 'different', now: () => baseTime }).verify(f.token(), caller, giftScope()), TargetConfirmationError);
});
test('even correctly signed malformed claims reject unknown fields, invalid time windows and types', () => {
  const f = fixture(); const raw = JSON.parse(Buffer.from(f.token().split('.')[0], 'base64url').toString());
  for (const payload of [{ ...raw, extra: true }, { ...raw, expiresAt: raw.expiresAt + 1 }, { ...raw, issuedAt: 'today' },
    { ...raw, target: { ...raw.target, peiwanId: 1.1 } }, { ...raw, caller: { ...raw.caller, extra: 'x' } }, { ...raw, selectedVoucher: null }]) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const token = encoded + '.' + createHmac('sha256', secret).update('jinlee-web:target-confirmation:v1\0').update(encoded).digest('base64url');
    assert.throws(() => f.codec.verify(token, caller, giftScope()), TargetConfirmationError);
  }
});
test('request schema rejects unrelated fields, conflicting voucher IDs, unsafe target and quantities', () => {
  for (const raw of [{ ...giftScope(), unexpected: 1 }, { ...giftScope(), lotteryId: 'draw-1' }, { ...giftScope(), target: '1e3' },
    { ...giftScope(), couponId: 'x'.repeat(129) }, { ...giftScope(), prizeName: 'x'.repeat(161) },
    { purpose: 'delegated-gift', target: '7', payerDlmId: 'P', giftName: '礼物', quantity: '1' },
    { purpose: 'delegated-gift', target: '7', payerDlmId: 'P', giftName: '礼物', quantity: Infinity }]) {
    assert.throws(() => normalizeTargetConfirmationScope(raw), TargetConfirmationError);
  }
});
test('current-user runtime fields are ignored only in the trusted expected caller, not signed claims', () => {
  const f = fixture(); const actor = { ...caller, sessionSource: 'web', dlmUser: { any: true } };
  assert.ok(f.codec.verify(f.token(), actor, giftScope()));
});
test('issuer refuses selected voucher mismatches and unbound receiver proof', () => {
  const f = fixture();
  assert.throws(() => f.codec.issue({ ...evidence(), selectedVoucher: { source: 'lottery', voucherId: 'coupon-1', prizeName: '小蛋糕代金券' } }), TargetConfirmationError);
  assert.throws(() => f.codec.issue({ ...evidence(), target: { ...target, discordUserId: '' } }), TargetConfirmationError);
  assert.throws(() => createTargetConfirmationCodec({ secret: '' }), /未配置/);
});
