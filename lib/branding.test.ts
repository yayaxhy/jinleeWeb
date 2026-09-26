import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {
  DISCORD_INVITE_URL, RECHARGE_DESCRIPTION, SITE_ALTERNATE_NAME, SITE_LOGO,
  SITE_NAME, SITE_OG_IMAGE, SITE_OG_IMAGE_HEIGHT, SITE_OG_IMAGE_WIDTH, SITE_URL,
  SITE_WORDMARK, SUPPORT_DISCORD_PROFILE_URL, SUPPORT_DISCORD_USER_ID,
} from './site';
import { SUPPORT_DISCORD_URL } from './legal';
import { buildWechatPayOrderDescription } from './wechat-pay';
import { VIP_LEVELS, getVipLevelLabel } from './vip-levels';
import sitemap from '../app/sitemap';
import robots from '../app/robots';

test('public brand, canonical URLs and support use the new identity', () => {
  assert.equal(SITE_NAME, '点了么娱乐公会');
  assert.equal(SITE_ALTERNATE_NAME, 'DLMClub');
  assert.equal(SITE_WORDMARK, 'DLMCLUB');
  assert.equal(SITE_URL, 'https://dlmclub.com');
  assert.equal(DISCORD_INVITE_URL, 'https://discord.gg/7zrsT2ysYd');
  assert.equal(SUPPORT_DISCORD_USER_ID, '1552030874076315777');
  assert.equal(SUPPORT_DISCORD_URL, SUPPORT_DISCORD_PROFILE_URL);
  assert.equal(SUPPORT_DISCORD_URL, `https://discord.com/users/${SUPPORT_DISCORD_USER_ID}`);
  assert.ok(sitemap().every((entry) => new URL(entry.url).origin === SITE_URL));
  assert.equal(robots().sitemap, `${SITE_URL}/sitemap.xml`);
});

test('logo exports exist, match sharing metadata and contain valid ICO frames', async () => {
  const logo = await sharp(`public${SITE_LOGO}`).metadata();
  assert.equal(logo.width, logo.height);
  const og = await sharp(`public${SITE_OG_IMAGE}`).metadata();
  assert.equal(og.width, SITE_OG_IMAGE_WIDTH);
  assert.equal(og.height, SITE_OG_IMAGE_HEIGHT);
  const apple = await sharp('app/apple-icon.png').metadata();
  assert.equal(apple.width, 180);
  const ico = readFileSync('app/favicon.ico');
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (let i = 0; i < 3; i++) {
    const entry = 6 + i * 16;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const frame = await sharp(ico.subarray(offset, offset + length)).metadata();
    assert.equal(frame.width, ico[entry] || 256);
    assert.equal(frame.height, frame.width);
  }
  assert.notDeepEqual(ico, readFileSync('docs/branding/legacy/favicon-jinlee.ico'));
});

test('WeChat display description uses the new brand without overriding merchant configuration', () => {
  const previous = process.env.WECHAT_PAY_ORDER_DESCRIPTION_PREFIX;
  try {
    delete process.env.WECHAT_PAY_ORDER_DESCRIPTION_PREFIX;
    assert.equal(buildWechatPayOrderDescription(), RECHARGE_DESCRIPTION);
    assert.equal(buildWechatPayOrderDescription('测试用户'), `${RECHARGE_DESCRIPTION}-测试用户`);
    assert.ok(Buffer.byteLength(buildWechatPayOrderDescription('用户'.repeat(100)), 'utf8') <= 127);
    process.env.WECHAT_PAY_ORDER_DESCRIPTION_PREFIX = '自定义展示名';
    assert.equal(buildWechatPayOrderDescription('测试'), '自定义展示名-测试');
  } finally {
    if (previous === undefined) delete process.env.WECHAT_PAY_ORDER_DESCRIPTION_PREFIX;
    else process.env.WECHAT_PAY_ORDER_DESCRIPTION_PREFIX = previous;
  }
});

test('VIP labels match current Discord school-grade roles without changing thresholds', () => {
  assert.deepEqual(
    VIP_LEVELS.map(({ vipLevel, name }) => [vipLevel, name]),
    [
      [1, '小班'],
      [2, '中班'],
      [3, '大班'],
      [4, '一年级'],
      [5, '二年级'],
      [6, '三年级'],
      [7, '四年级'],
      [8, '五年级'],
      [9, '六年级'],
      [10, '初中生'],
      [11, '高中生'],
      [12, '大学生'],
    ],
  );
  assert.deepEqual(
    VIP_LEVELS.map(({ threshold }) => threshold),
    [500, 1500, 3000, 5000, 10000, 20000, 50000, 120000, 210000, 340000, 520000, 880000],
  );
  assert.equal(getVipLevelLabel(7), 'VIP 7 四年级');
});

test('active sources do not reintroduce old public branding or invite links', () => {
  const stale = /锦鲤(?:公会|陪玩|俱乐部|积分|币|客服|福星|庄园|管理)|\bJinlee\b|\bJINLEE\b|jinleeclub\.vip|UJ95zhfJYR|og-jinlee-logo|scheme3-logo/;
  function inspect(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) inspect(file);
      else if (/\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file)) {
        assert.doesNotMatch(readFileSync(file, 'utf8'), stale, file);
      }
    }
  }
  ['app', 'components', 'lib'].forEach(inspect);
});
