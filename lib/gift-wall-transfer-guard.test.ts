import assert from 'node:assert/strict';
import test from 'node:test';
import { giftWallTransferHasEvidenceConflict } from './gift-wall-transfer-guard';
const key = 'name';
test('legacy duplicates retain existing deduplication behavior', () => {
  assert.equal(giftWallTransferHasEvidenceConflict([{ name: '花', ownerDlmIdSnapshot: null }], [{ name: '花', ownerDlmIdSnapshot: null }], key), false);
});
for (const evidence of [{ ownerDlmIdSnapshot: 'DLM' }, { peiwanIdSnapshot: 1 }, { giftAuditIdSnapshot: 'AUDIT' }, { couponIds: ['C'] }, { rewardSnapshot: { version: 1 } }]) {
  test(`source or target ${Object.keys(evidence)[0]} blocks destructive duplicate merge`, () => {
    const source = { name: 'category:花', ...evidence }; const target = { name: 'category:花' };
    assert.equal(giftWallTransferHasEvidenceConflict([source], [target], key), true);
    assert.equal(giftWallTransferHasEvidenceConflict([target], [source], key), true);
    assert.equal(giftWallTransferHasEvidenceConflict([source], [{ ...target, name: 'other' }], key), false);
    assert.equal(giftWallTransferHasEvidenceConflict([source], [], key), false);
  });
}
