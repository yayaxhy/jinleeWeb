import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { OPERATION_ART, PRIZE_ART_BY_NAME, getVipArtworkPath } from './brand-artwork-catalog';
import { resolveLocalVoucherArt, resolveVoucherDisplayArt } from './local-voucher-art';

test('all 66 catalog assets are bundled with valid PNG/GIF headers', () => {
  const assets = new Set([
    ...Object.values(OPERATION_ART),
    ...Object.values(PRIZE_ART_BY_NAME),
    ...Array.from({ length: 12 }, (_, i) => getVipArtworkPath(i + 1)),
  ]);
  assert.equal(assets.size, 66);
  let physicalFiles = 0;
  for (const group of ['operations', 'prizes', 'vip']) {
    physicalFiles += readdirSync(`public/brand/dlm-v1/${group}`).length;
  }
  assert.equal(physicalFiles, 66);
  for (const asset of assets) {
    const data = readFileSync(path.join('public', asset));
    assert.ok(data.length > 100, asset);
    if (asset.endsWith('.gif')) assert.match(data.subarray(0, 6).toString(), /^GIF8[79]a$/);
    else assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', asset);
  }
});

test('approved prize art overrides both expired and still-valid historical images', () => {
  const expected = '/brand/dlm-v1/prizes/01-cupcake-voucher.png';
  assert.equal(resolveLocalVoucherArt('小蛋糕代金券'), expected);
  assert.equal(resolveVoucherDisplayArt('小蛋糕代金券', 'https://cdn.discordapp.com/attachments/old.png?ex=1'), expected);
  assert.equal(resolveVoucherDisplayArt('小蛋糕代金券', 'https://example.com/old.png'), expected);
  assert.equal(resolveVoucherDisplayArt('小蛋糕代金券', '/lottery-fusion/business/小蛋糕.png'), expected);
  assert.equal(resolveLocalVoucherArt('抽成降1%券'), resolveLocalVoucherArt('抽成降1%'));
  assert.equal(resolveLocalVoucherArt('4位数靓号券'), resolveLocalVoucherArt('4位数靓号卡'));
  assert.equal(resolveLocalVoucherArt('特殊九折券'), resolveLocalVoucherArt('特殊9折券'));
  assert.equal(resolveLocalVoucherArt('9折券'), null);
});

test('unmapped prizes keep valid user-managed art; expired URLs fall back safely', () => {
  const custom = 'https://example.com/custom.png';
  assert.equal(resolveVoucherDisplayArt('新奖品', custom), custom);
  assert.equal(resolveVoucherDisplayArt('新奖品', '/gift-wall/custom.png'), '/gift-wall/custom.png');
  for (const host of ['cdn.discordapp.com', 'media.discordapp.net']) {
    assert.equal(resolveVoucherDisplayArt('新奖品', `https://${host}/attachments/old.png?ex=1`), null);
    const future = `https://${host}/attachments/new.png?ex=${(Math.floor(Date.now() / 1000) + 3600).toString(16)}`;
    assert.equal(resolveVoucherDisplayArt('新奖品', future), future);
  }
  assert.equal(resolveVoucherDisplayArt('新奖品', 'javascript:alert(1)'), null);
  assert.equal(resolveVoucherDisplayArt('新奖品', 'not a URL'), null);
  assert.equal(resolveLocalVoucherArt('__proto__'), null);
});

test('seven new voucher images override old URLs while the four excluded prizes keep their original art', () => {
  const oldUrl = 'https://example.com/old-custom-prize.png';
  const names = ['陪玩评语券', '香水代金券', '旋转木马代金券', '南瓜车代金券', '留声机代金券', '月冠名92折券', '月冠名9折券'];
  const paths = names.map((name) => resolveVoucherDisplayArt(name, oldUrl));
  assert.ok(paths.every((art) => art?.startsWith('/brand/dlm-v1/prizes/')));
  assert.equal(new Set(paths).size, 7);
  assert.notEqual(resolveLocalVoucherArt('月冠名92折券'), resolveLocalVoucherArt('月冠名9折券'));
  for (const name of ['兔兔宝宝', '狐狸宝宝', '猪猪宝宝', '小鸡宝宝']) {
    assert.equal(resolveLocalVoucherArt(name), null);
    assert.equal(resolveVoucherDisplayArt(name, oldUrl), oldUrl);
  }
});
