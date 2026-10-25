import assert from 'node:assert/strict';
import test from 'node:test';
import { discountFixture } from './order-discount-fixture.test-support';
import { createDiscountApplier } from './order-discount-transaction';
const apply = (f: ReturnType<typeof discountFixture>, source: string) => createDiscountApplier(f.deps)({orderId:'O',dlmId:'H',discordUserId:'host',kind:source==='lottery'?'lottery':'coupon',now:f.now});

for (const source of ['coupon', 'pointshop', 'lottery'] as const) {
  test(`${source}: consumes once, credits actual wallet delta, saves reversible evidence`, async () => {
    const f = discountFixture(source, source === 'lottery');
    const result = await apply(f, source);
    assert.equal(result.status, 'applied');
    const state = f.state();
    assert.equal(state.discount.voucherKind, source);
    assert.equal(state.discount.rebateTransactionId, 'REBATE');
    assert.equal(state.discount.workerDlmId, 'W');
    assert.equal(state.discount.voucherType, source === 'lottery' ? 'prize-80' : 'DISCOUNT_90');
    assert.equal(state.discount.voucherExpiresAt.toISOString(), '2026-10-31T12:00:00.000Z');
    assert.equal(state.wallet.totalBalance.toString(), source === 'lottery' ? '112' : '106');
    assert.equal(state.wallet.recharge.toString(), source === 'lottery' ? '72' : '66');
    assert.deepEqual(f.locks, ['Order','DlmUser:H','DlmUser:W','Member:host','Member:worker']);
    assert.equal((await apply(f, source)).status, 'already_used');
    assert.equal(f.counts.credits,1);

  });
}
for (const source of ['coupon', 'pointshop', 'lottery'] as const) {
  test(`${source}: expired voucher never produces credit or audit`, async () => {
    const f=discountFixture(source,source==='lottery');
    const table=source==='pointshop'?'pointShopGrant':source==='lottery'?'lotteryDraw':'coupon';
    f.state()[table][0].expiresAt=f.now;
    assert.match((await apply(f,source)).status,/^no_(coupon|lottery)$/);
    assert.equal(f.counts.credits,0);assert.equal(f.state().discount,null);
  });
}
for (const source of ['coupon', 'pointshop', 'lottery'] as const) {
  test(`${source}: inconsistent already-consumed candidates cannot starve later eligible voucher`, async () => {
    const f=discountFixture(source,source==='lottery');
    const table=source==='pointshop'?'pointShopGrant':source==='lottery'?'lotteryDraw':'coupon';
    f.state()[table].unshift({...f.state()[table][0],id:'stale', [source==='lottery'?'consumeAt':'consumedAt']:f.now});
    assert.equal((await apply(f,source)).status,'applied');assert.equal(f.state().discount.voucherId,'voucher');
  });
}
test('rereads status under the Order lock',async()=>{
  const f=discountFixture();f.hooks.onOrderLock=()=>{f.state().order.status='ACTIVE';};
  assert.equal((await apply(f,'coupon')).status,'order_not_ended');assert.equal(f.counts.credits,0);
});
test('reversal marker prevents any voucher use',async()=>{
  const f=discountFixture();f.state().revert={id:'R'};
  assert.equal((await apply(f,'coupon')).status,'order_reverted');assert.equal(f.counts.claims,0);
});
test('missing original audit is manual, without creating accounts',async()=>{
  const f=discountFixture();f.state().audit=null;
  assert.equal((await apply(f,'coupon')).status,'requires_review');assert.equal(f.counts.claims,0);
});
test('legacy null fixed owner cannot fall back to old Discord',async()=>{
  const f=discountFixture();f.state().order.hostDlmId=null;
  assert.equal((await apply(f,'coupon')).status,'not_order_host');assert.equal(f.counts.claims,0);
});
test('receipt owner changing after planned wallet locks aborts use',async()=>{
  const f=discountFixture();f.hooks.onMemberLock=()=>{f.state().payment.toDlmId='NEW';f.state().receipts[1].dlmId='NEW';};
  assert.equal((await apply(f,'coupon')).status,'requires_review');assert.equal(f.counts.claims,0);
});
test('worker Discord rebound to another account is never re-resolved',async()=>{
  const f=discountFixture();f.state().identities[1].discordUserId='new-worker';f.state().identities.push({dlmId:'OTHER',discordUserId:'worker'});
  assert.equal((await apply(f,'coupon')).status,'requires_review');assert.equal(f.counts.claims,0);
});
test('host binding changes while waiting: abort instead of crediting stale identity',async()=>{
  const f=discountFixture();f.hooks.onMemberLock=()=>{f.state().identities[0].discordUserId='new-host';};
  assert.equal((await apply(f,'coupon')).status,'requires_review');assert.equal(f.counts.claims,0);
});
test('consumed voucher under transferred owner still blocks another discount',async()=>{
  const f=discountFixture();f.state().lotteryDraw=[{id:'old',dlmId:'OTHER',status:'USED',consumeOrderId:'O',prize:{name:'renamed'}}];
  assert.equal((await apply(f,'coupon')).status,'already_used');assert.equal(f.counts.claims,0);
});
test('voucher facts altered at consumption cause rollback, not fabricated audit',async()=>{
  const f=discountFixture();f.hooks.afterClaim=()=>{f.state().coupon[0].consumeAmount=f.d(99);};
  assert.equal((await apply(f,'coupon')).status,'requires_review');assert.equal(f.state().coupon[0].status,'ACTIVE');assert.equal(f.counts.credits,0);
});
test('unexpected actual wallet delta rolls back voucher and money',async()=>{
  const f=discountFixture();f.hooks.afterCredit=()=>{f.state().wallet.recharge=f.d(65);};
  assert.equal((await apply(f,'coupon')).status,'requires_review');assert.equal(f.state().wallet.totalBalance.toString(),'100');assert.equal(f.state().coupon[0].status,'ACTIVE');assert.equal(f.state().discount,null);
});
for (const fault of ['recordError','auditError'] as const) {
  test(`${fault}: whole callback rolls back and never retries a generic failure`,async()=>{
    const f=discountFixture();f.hooks[fault]=true;
    assert.equal((await apply(f,'coupon')).status,'outcome_unknown');assert.equal(f.counts.transactions,1);assert.equal(f.state().wallet.totalBalance.toString(),'100');assert.equal(f.state().coupon[0].status,'ACTIVE');assert.equal(f.state().receipts.length,2);
  });
}
test('lost commit acknowledgement never repeats credit',async()=>{
  const f=discountFixture();f.hooks.commitError=true;
  assert.equal((await apply(f,'coupon')).status,'outcome_unknown');assert.equal(f.counts.transactions,1);assert.equal(f.counts.credits,1);assert.ok(f.state().discount);
});
test('only explicit aborted contention retries',async()=>{
  const f=discountFixture();f.hooks.contention=2;
  assert.equal((await apply(f,'coupon')).status,'applied');assert.equal(f.counts.transactions,3);assert.equal(f.counts.credits,1);
});
test('contention bounded at three attempts',async()=>{
  const f=discountFixture();f.hooks.contention=3;
  assert.equal((await apply(f,'coupon')).status,'requires_review');assert.equal(f.counts.transactions,3);assert.equal(f.counts.credits,0);
});

test('explicit stale Web session binding rejected before claim',async()=>{const f=discountFixture();assert.equal((await createDiscountApplier(f.deps)({orderId:'O',dlmId:'H',discordUserId:'stale',kind:'coupon',now:f.now})).status,'requires_review');assert.equal(f.counts.claims,0);});

test('rebate cannot exceed original paid gross if order pricing was altered',async()=>{const f=discountFixture();f.state().order.unitPrice=f.d(6000);f.state().audit.gross=f.d(10);f.state().audit.netAmount=f.d(8);f.state().audit.feeAmount=f.d(2);Object.assign(f.state().payment,{amount:f.d(10),netAmount:f.d(8),feeAmount:f.d(2)});Object.assign(f.state().receipts[0],{amountChange:f.d(10),balanceBefore:f.d(110),balanceAfter:f.d(100)});Object.assign(f.state().receipts[1],{amountChange:f.d(8),balanceBefore:f.d(0),balanceAfter:f.d(8)});assert.equal((await apply(f,'coupon')).status,'requires_review');assert.equal(f.counts.credits,0);assert.equal(f.state().coupon[0].status,'ACTIVE');});

test('DLM-only authenticated host credits fixed DLM and writes null Discord',async()=>{const f=discountFixture();f.state().order.hostId=null;f.state().audit.hostId=null;f.state().payment.fromId=null;f.state().receipts[0].discordId=null;f.state().receipts[1].thirdPartydiscordId='SYSTEM';f.state().identities[0].discordUserId=null;assert.equal((await createDiscountApplier(f.deps)({orderId:'O',dlmId:'H',discordUserId:null,kind:'coupon',now:f.now})).status,'applied');assert.equal(f.state().discount.ownerDiscordId,null);assert.equal(f.state().wallet.totalBalance.toString(),'106');});

for(const deliveryStatus of ['PENDING','FAILED']) test(`pointshop ${deliveryStatus} is never spendable`,async()=>{const f=discountFixture('pointshop');f.state().pointShopGrant[0].deliveryStatus=deliveryStatus;assert.equal((await apply(f,'pointshop')).status,'no_coupon');assert.equal(f.counts.claims,0);assert.equal(f.counts.credits,0);assert.equal(f.state().discount,null);});
test('pointshop delivery change after claim aborts with no credit',async()=>{const f=discountFixture('pointshop');f.hooks.afterClaim=()=>{f.state().pointShopGrant[0].deliveryStatus='FAILED';};assert.equal((await apply(f,'pointshop')).status,'requires_review');assert.equal(f.counts.credits,0);assert.equal(f.state().pointShopGrant[0].couponStatus,'ACTIVE');});

test('expiry clock is read after all wallet locks',async()=>{const f=discountFixture();let checked=false;f.deps.now=()=>{assert.equal(f.locks.at(-1),'Member:worker');checked=true;return f.now;};assert.equal((await createDiscountApplier(f.deps)({orderId:'O',dlmId:'H',discordUserId:'host',kind:'coupon'})).status,'applied');assert.ok(checked);});

// Keep the Web calculation aligned with the confirmed Bot policy.
for (const source of ['coupon', 'pointshop'] as const) {
  for (const [minutes, price, expected] of [[5, 60, '0'], [120, 60, '11.5'], [121, 60, '11.6'], [185, 60, '18'], [600, 60, '20'], [185, 35.35, '10.61']] as const) {
    test(`ordinary ${source} all ${minutes} minutes at ${price}, cap 20`, async () => {
      const f = discountFixture(source);
      f.state().order.totalMinutes = minutes; f.state().order.unitPrice = f.d(price);
      const result = await apply(f, source);
      if (expected === '0') { assert.equal(result.status, 'no_fee'); assert.equal(f.counts.claims, 0); return; }
      assert.equal(result.status, 'applied');
      assert.equal(f.state().discount.amount.toString(), expected);
      assert.equal(f.state().wallet.totalBalance.sub(100).toString(), expected);
      assert.equal(f.state().discount.voucherExpiresAt.toISOString(), '2026-10-31T12:00:00.000Z');
    });
  }
}
