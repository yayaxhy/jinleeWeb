import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { buildSignaturePayload, buildZPaySignature, verifyZPaySignature } from './zpay';

test('ZPay signs raw values in ASCII key order and excludes signatures and empty values', () => {
  const params = {
    name: '充值 & 金额=100',
    money: '100.00',
    pid: 'merchant-test',
    _extra: 'underscore',
    A: 'upper',
    a: 'lower',
    sign: 'ignored',
    sign_type: 'MD5',
    empty: '',
    absent: undefined,
    missing: null,
  };
  const canonical = 'A=upper&_extra=underscore&a=lower&money=100.00&name=充值 & 金额=100&pid=merchant-test';
  const expected = createHash('md5').update(`${canonical}fixture-secret`, 'utf8').digest('hex');
  assert.equal(buildSignaturePayload(params), canonical);
  assert.equal(buildZPaySignature(params, 'fixture-secret'), expected);
  assert.equal(verifyZPaySignature(params, 'fixture-secret', expected), true);
  assert.equal(verifyZPaySignature(params, 'fixture-secret', expected.toUpperCase()), true);
  assert.equal(verifyZPaySignature({ ...params, money: '1000.00' }, 'fixture-secret', expected), false);
  assert.equal(verifyZPaySignature(params, 'wrong-secret', expected), false);
  for (const sign of ['', '0', 'not-a-signature', 'z'.repeat(32)]) {
    assert.equal(verifyZPaySignature(params, 'fixture-secret', sign), false);
  }
});
