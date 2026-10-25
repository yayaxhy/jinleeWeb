import assert from 'node:assert/strict';
import test from 'node:test';
import { getBindingReviewMessage } from './discord-binding-feedback';

test('every relation-migration refusal gives a concrete Chinese explanation without suggesting asset deletion', () => {
  for (const code of ['pending_operation', 'manual_boss_conflict', 'legacy_mirror_conflict', 'claim_conflict', 'point_shop_conflict', 'conversation_conflict', 'relations_remaining']) {
    const message = getBindingReviewMessage(`account_merge_${code}`);
    assert.ok(message && /账号/.test(message), code);
    assert.match(message, /等待|客服/);
    assert.doesNotMatch(message, /先解绑|清空|清零|删除/);
  }
});

test('binding ownership and protected-unbind failures use the same user-facing explanation', () => {
  assert.match(getBindingReviewMessage('incoming_discord_already_bound')!, /不能直接合并两个 Discord/);
  assert.match(getBindingReviewMessage('discord_unbind_requires_asset_review')!, /资产.*归属/);
  assert.match(getBindingReviewMessage('discord_binding_changed')!, /重新登录/);
  assert.equal(getBindingReviewMessage('binding_state_changed'), getBindingReviewMessage('discord_binding_changed'));
});

test('unknown and prototype-property error values are not mistaken for reviewable conflicts', () => {
  for (const value of [undefined, '', 'unknown_failure', '__proto__', 'toString']) assert.equal(getBindingReviewMessage(value), null);
});
