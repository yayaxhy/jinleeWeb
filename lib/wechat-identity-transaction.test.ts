import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountProvider, Prisma } from '@prisma/client';
import { ensureWechatIdentityTx, lockWechatIdentitiesTx } from './wechat-identity-transaction';

type Binding = { id: string; dlmId: string; provider: AccountProvider; providerUserId: string; unionId: string | null };
function fixture(bindings: Binding[] = []) {
  const owners = new Set(bindings.map(row => row.dlmId)); const writes: string[] = []; const locks: string[] = [];
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray, key: string) => { locks.push(key); return sql.join('').includes('DlmUser') ? owners.has(key) ? [{ dlmId: key }] : [] : []; },
    accountBinding: {
      findUnique: async ({ where }: { where: { provider_providerUserId: { provider: AccountProvider; providerUserId: string } } }) => bindings.find(b => b.provider === where.provider_providerUserId.provider && b.providerUserId === where.provider_providerUserId.providerUserId) ?? null,
      findMany: async ({ where }: { where: { unionId: string } }) => bindings.filter(b => b.unionId === where.unionId),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Binding> }) => { writes.push('binding:update'); const row=bindings.find(b=>b.id===where.id)!; Object.assign(row,data); return row; },
      create: async ({ data }: { data: Binding }) => { writes.push('binding:create'); const row={...data,id:`b${bindings.length}`}; bindings.push(row); return row; },
    },
    dlmUser: {
      update: async ({ where }: { where: { dlmId: string } }) => { writes.push('user:update'); return { dlmId: where.dlmId, member: null }; },
      create: async ({ data }: { data: { dlmId: string } }) => { writes.push('user:create'); owners.add(data.dlmId); return { ...data, member:null }; },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, bindings, writes, locks };
}
const old = (provider: AccountProvider, dlmId='A', unionId: string|null='U'): Binding => ({ id:provider,dlmId,provider,providerUserId:provider+'-open',unionId });

test('web and mini resolve the same verified union owner without adding wallets', async()=>{
 const f=fixture([old(AccountProvider.WECHAT_MINIPROGRAM)]);
 const result=await ensureWechatIdentityTx(f.tx,{provider:AccountProvider.WECHAT_WEB,openId:'web-new',unionId:'U'},()=> 'new');
 assert.equal(result.dlmUser.dlmId,'A'); assert.equal(f.bindings.length,2); assert(!f.writes.includes('user:create'));
 assert(f.locks.indexOf('wechat:union:U') < f.locks.indexOf('A'));
});
test('preexisting cross-app conflict rejects before profile or wallet writes',async()=>{
 const f=fixture([old(AccountProvider.WECHAT_MINIPROGRAM,'A'),old(AccountProvider.WECHAT_WEB,'B')]);
 await assert.rejects(ensureWechatIdentityTx(f.tx,{provider:AccountProvider.WECHAT_WEB,openId:AccountProvider.WECHAT_WEB+'-open',unionId:'U'},()=> 'new'),/wechat_identity_conflict/);
 assert.deepEqual(f.writes,[]);
});
test('an openid cannot replace its established union identity',async()=>{
 const f=fixture([old(AccountProvider.WECHAT_MINIPROGRAM)]);
 await assert.rejects(ensureWechatIdentityTx(f.tx,{provider:AccountProvider.WECHAT_MINIPROGRAM,openId:AccountProvider.WECHAT_MINIPROGRAM+'-open',unionId:'OTHER'},()=> 'new'),/wechat_identity_mismatch/);
 assert.deepEqual(f.writes,[]);
});
test('new mini registration requires unionid, as website registration does',async()=>{
 for(const provider of [AccountProvider.WECHAT_MINIPROGRAM, AccountProvider.WECHAT_WEB]){
  const f=fixture();await assert.rejects(ensureWechatIdentityTx(f.tx,{provider,openId:'new'},()=> 'new'),/wechat_unionid_required/);assert.deepEqual(f.writes,[]);
 }
});
test('omitted unionid never clears the known cross-app identity',async()=>{
 const f=fixture([old(AccountProvider.WECHAT_MINIPROGRAM)]);
 await ensureWechatIdentityTx(f.tx,{provider:AccountProvider.WECHAT_MINIPROGRAM,openId:AccountProvider.WECHAT_MINIPROGRAM+'-open',unionId:null},()=> 'new');
 assert.equal(f.bindings[0].unionId,'U');
});
test('legacy mini identity without unionid can only log into its existing owner',async()=>{
 const f=fixture([old(AccountProvider.WECHAT_MINIPROGRAM,'A',null)]);
 const r=await ensureWechatIdentityTx(f.tx,{provider:AccountProvider.WECHAT_MINIPROGRAM,openId:AccountProvider.WECHAT_MINIPROGRAM+'-open'},()=> 'new');
 assert.equal(r.dlmUser.dlmId,'A');assert.equal(f.bindings.length,1);
});
test('second application reuses an account committed by the first application',async()=>{
 const f=fixture();const mini=await ensureWechatIdentityTx(f.tx,{provider:AccountProvider.WECHAT_MINIPROGRAM,openId:'mini',unionId:'U'},()=> 'new');
 const web=await ensureWechatIdentityTx(f.tx,{provider:AccountProvider.WECHAT_WEB,openId:'web',unionId:'U'},()=> 'wrong');
 assert.equal(mini.dlmUser.dlmId,web.dlmUser.dlmId);assert.equal(f.writes.filter(v=>v==='user:create').length,1);
});
test('identity locks use a deterministic deduplicated order',async()=>{
 const f=fixture();await lockWechatIdentitiesTx(f.tx,{unionIds:['Z','A','Z'],providerKeys:[{provider:AccountProvider.WECHAT_WEB,providerUserId:'b'}]});
 assert.deepEqual(f.locks,[...new Set(f.locks)].sort());
});
