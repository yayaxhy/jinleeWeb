import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDiscordLoginDisplayName } from './discord-login-display-name';

test('a real guild nickname takes precedence', () => {
  assert.equal(resolveDiscordLoginDisplayName({
    guildNickname: ' 新昵称 ', memberDisplayName: '旧昵称', username: 'discord-user',
  }), '新昵称');
});

test('missing, empty and whitespace guild nicknames preserve the saved member name', () => {
  for (const guildNickname of [undefined, null, '', '   ']) {
    assert.equal(resolveDiscordLoginDisplayName({
      guildNickname, memberDisplayName: '陪玩业务名', globalName: 'Discord全局名', username: 'discord-user',
    }), '陪玩业务名');
  }
});

test('older account records remain valid nickname fallbacks', () => {
  assert.equal(resolveDiscordLoginDisplayName({
    memberDisplayName: ' ', jinleeDisplayName: '平台昵称', peiwanDisplayName: '陪玩昵称', username: 'discord-user',
  }), '平台昵称');
  assert.equal(resolveDiscordLoginDisplayName({ peiwanDisplayName: '陪玩昵称', username: 'discord-user' }), '陪玩昵称');
});

test('only accounts without any saved nickname fall back to Discord names', () => {
  assert.equal(resolveDiscordLoginDisplayName({ globalName: '全局名称', username: 'discord-user' }), '全局名称');
  assert.equal(resolveDiscordLoginDisplayName({ globalName: ' ', username: 'discord-user' }), 'discord-user');
});
