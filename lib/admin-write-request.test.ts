import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationRetryLimit, readAdminJsonWrite } from './admin-write-request';

const url = 'https://console.example.test';
const request = (body = '{"limit":100}', headers: Record<string, string> = {}) => new Request(`${url}/api/admin/write`, {
  method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json', ...headers }, body,
});
test('cross-origin, same-site sibling and missing Origin writes are refused before parsing', async () => {
  for (const origin of ['https://attacker.example.test', 'https://unrelated.test', 'null', '']) {
    const result = await readAdminJsonWrite(request('{', { Origin: origin }), url);
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.response.status, 403);
  }
});
test('simple form/text writes cannot trigger staff operations', async () => {
  for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', '']) {
    const result = await readAdminJsonWrite(request('{"limit":100}', { 'Content-Type': contentType }), url);
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.response.status, 415);
  }
});
test('empty, malformed and non-object JSON are rejected rather than defaulting retry count', async () => {
  for (const body of ['', '{', 'null', '[]', '100', '"message"']) {
    const result = await readAdminJsonWrite(request(body), url);
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.response.status, 400);
  }
  for (const body of [{}, { limit: null }, { limit: '100' }, { limit: 0 }, { limit: -1 }, { limit: NaN }, { limit: Infinity }]) {
    assert.equal(notificationRetryLimit(body), null);
  }
});
test('existing same-origin support and explicit retry payloads pass unchanged', async () => {
  for (const body of [{ text: '你好，正在为你核实。' }, { limit: 100 }]) {
    const result = await readAdminJsonWrite(request(JSON.stringify(body), { 'Content-Type': 'application/json; charset=UTF-8' }), url);
    assert.equal(result.ok, true); if (result.ok) assert.deepEqual(result.body, body);
  }
  assert.equal(notificationRetryLimit({ limit: 100 }), 100);
});
test('actual UTF-8 bytes are bounded even with a forged Content-Length', async () => {
  const result = await readAdminJsonWrite(request(JSON.stringify({ text: '字'.repeat(6000) }), { 'Content-Length': '1' }), url);
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.response.status, 413);
});
