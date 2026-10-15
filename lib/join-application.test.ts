import test from 'node:test';
import assert from 'node:assert/strict';
import { validateJoinApplication, validateJoinImages, MAX_JOIN_IMAGE_BYTES, MAX_JOIN_BODY_BYTES } from './join-application';
import { handleJoinSubmission, JoinDeliveryError } from './join-submit';

export const applicant = '123456789012345678';
export const draft = () => ({
  discordId: '999999999999999999', exclusive: '是', assessment: 'unassessed', tier: '',
  fields: { nickname: '测试申请', gender: '女', voice: '温柔', region: '德国', wechat: 'test-only', guild: '无', inviter: '', intro: '一起快乐开黑', otherGames: '双人成行', sourceGuild: '', card: '', heroes: '' },
  games: [{ name: 'Valorant', level: '钻石', price: '20', unit: '小时' }],
});
export const image = (kind = 'photo') => ({ kind, contentType: 'image/png', data: Buffer.from('\x89PNG\r\n\x1a\nfixture', 'binary').toString('base64') });
const origin = 'https://example.test';
const request = (body: unknown, headers: Record<string, string> = {}) => new Request(`${origin}/api/join`, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('verified Discord identity overrides the browser; unassessed ignores stale conditional fields', () => {
  const value = draft(); value.tier = 'VAL 大神'; value.fields.sourceGuild = '旧公会'; value.fields.card = 'Jett';
  const result = validateJoinApplication(value, applicant);
  assert.deepEqual(result.errors, {});
  assert.equal(result.data.discordId, applicant);
  assert.equal(result.data.tier, ''); assert.equal(result.data.fields.sourceGuild, ''); assert.equal(result.data.fields.card, '');
});
test('intro, mandatory fields, pricing and assessment are validated server-side', () => {
  const value = draft(); value.fields.intro = '字'.repeat(21); value.fields.wechat = ''; value.games[0].price = '-1'; value.assessment = 'bad';
  const { errors } = validateJoinApplication(value, applicant);
  for (const key of ['intro', 'wechat', 'price-0', 'assessment']) assert.ok(errors[key]);
});
test('transfer requires source guild and level; masters require their card details', () => {
  const value = draft(); value.assessment = 'transfer'; value.tier = 'VAL 大神';
  const { errors } = validateJoinApplication(value, applicant);
  for (const key of ['sourceGuild', 'card', 'heroes']) assert.ok(errors[key]);
});
test('rank screenshot is optional; each assessment requires exactly its own evidence', () => {
  assert.deepEqual(validateJoinImages([image()], 'unassessed').errors, {});
  assert.ok(validateJoinImages([image()], 'transfer').errors['assessment-records']);
  assert.ok(validateJoinImages([image()], 'passed').errors['passed-records']);
  assert.deepEqual(validateJoinImages([image(), image('passed')], 'passed').errors, {});
  assert.ok(Object.keys(validateJoinImages([image(), image('transfer')], 'passed').errors).length);
  assert.ok(Object.keys(validateJoinImages([image(), image()], 'unassessed').errors).length);
});
test('bad signatures and oversized transport images are rejected', () => {
  assert.ok(validateJoinImages([{ ...image(), data: Buffer.from('<svg/>').toString('base64') }], 'unassessed').errors['personal-photos']);
  assert.ok(validateJoinImages([{ ...image(), data: Buffer.alloc(MAX_JOIN_IMAGE_BYTES + 1).toString('base64') }], 'unassessed').errors['personal-photos']);
});
test('submission refuses cross-origin, missing login and invalid fields without delivery', async () => {
  let calls = 0;
  const deps = { origin, getSession: async () => ({ discordId: applicant }), deliver: async () => { calls++; return { applicationId: 'JOIN-test', submittedAt: '' }; } };
  assert.equal((await handleJoinSubmission(request({}, { origin: 'https://evil.test' }), deps)).status, 403);
  assert.equal((await handleJoinSubmission(request({}), { ...deps, getSession: async () => null })).status, 401);
  assert.equal((await handleJoinSubmission(request({ application: {}, images: [] }), deps)).status, 400);
  assert.equal(calls, 0);
});
test('bounded body rejects a chunked oversized request; complete application reaches only the session identity', async () => {
  let sent = '';
  const deps = { origin, getSession: async () => ({ discordId: applicant }), deliver: async (application: { discordId: string }) => { sent = application.discordId; return { applicationId: 'JOIN-1234567890abcdef', submittedAt: new Date().toISOString() }; } };
  const large = new Request(`${origin}/api/join`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: ' '.repeat(MAX_JOIN_BODY_BYTES + 1) });
  assert.equal((await handleJoinSubmission(large, deps)).status, 413); assert.equal(sent, '');
  const response = await handleJoinSubmission(request({ application: draft(), images: [image()] }), deps);
  assert.equal(response.status, 200); assert.equal(sent, applicant); assert.equal((await response.json()).ok, true);
});
test('delivery failure never reports success, while ambiguous receipts are shown for HR follow-up', async () => {
  const deps = { origin, getSession: async () => ({ discordId: applicant }), deliver: async () => { throw new JoinDeliveryError('delivery_uncertain', 409, 'JOIN-1234567890abcdef'); } };
  const response = await handleJoinSubmission(request({ application: draft(), images: [image()] }), deps);
  assert.equal(response.status, 409);
  const body = await response.json(); assert.notEqual(body.ok, true); assert.equal(body.applicationId, 'JOIN-1234567890abcdef');
});
