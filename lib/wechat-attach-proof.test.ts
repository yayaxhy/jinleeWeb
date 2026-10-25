import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiscordChangeProof } from './discord-change-proof';
import { finishWechatAttachmentProof } from './wechat-attach-proof';
const now = 1792800000000;
const intent = () => createDiscordChangeProof('DISCORD-ACCOUNT', 3, now);
const target = { dlmId: 'DISCORD-ACCOUNT', sessionVersion: 3, discordUserId: '123456789123456789' };
const source = { dlmId: 'WECHAT-ACCOUNT', sessionVersion: 5 };

test('verified website target and WeChat source produce a full-merge preview proof without extending authorization', () => {
 const start = intent(); const proof = finishWechatAttachmentProof(start, target, source, start.csrf, now + 100);
 assert.equal(proof.sourceDlmId, source.dlmId); assert.equal(proof.sourceSessionVersion, 5);
 assert.equal(proof.targetDlmId, target.dlmId); assert.equal(proof.targetDiscordId, target.discordUserId);
 assert.equal(proof.requestId, start.requestId); assert.equal(proof.expiresAt, start.expiresAt);
});
test('stale target session, mismatched owner and CSRF cannot authorize an attachment', () => {
 const start = intent();
 for (const owner of [{ ...target, sessionVersion: 4 }, { ...target, dlmId: 'OTHER' }, { ...target, discordUserId: null }]) {
  assert.throws(() => finishWechatAttachmentProof(start, owner, source, start.csrf, now), /state_changed/);
 }
 assert.throws(() => finishWechatAttachmentProof(start, target, source, 'unrelated-state', now), /state_changed/);
});
test('expired or already-completed intent cannot be repurposed for a new attachment', () => {
 const start = intent();
 assert.throws(() => finishWechatAttachmentProof(start, target, source, start.csrf, start.expiresAt), /state_changed/);
 assert.throws(() => finishWechatAttachmentProof({ ...start, targetDlmId: 'USED' }, target, source, start.csrf, now), /state_changed/);
});
test('the same verified account remains the same owner and can be presented as already linked', () => {
 const start = intent(); const proof = finishWechatAttachmentProof(start, target, {dlmId:target.dlmId,sessionVersion:3}, start.csrf, now);
 assert.equal(proof.sourceDlmId, proof.targetDlmId);
});
