import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleEditableCopyAdmin } from './editable-copy-admin';
import { EditableCopyError } from './editable-copy-service';
const base = 'https://example.test';
const make = (body: unknown, origin = base) => new Request(`${base}/api/admin/copy`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function deps() {
  const writes: Array<{scope:string;value:unknown;actorId:string}> = [];
  return { writes, session: async () => ({discordId:'123'}),isAdmin:(id:string)=>id==='123',enabled:()=>true,publicUrl:base,
    inspect:async(scope:string)=>({ok:true,scope,revision:0}),execute:async(scope:string,value:unknown,actorId:string)=>{writes.push({scope,value,actorId});return {ok:true,scope,revision:1};} };
}
test('copy admin authenticates before reading or publishing; actor comes from session',async()=>{
  const d=deps();const body={scope:'site',action:'publish',expectedRevision:0,overrides:{}};
  assert.equal((await handleEditableCopyAdmin(make(body),{...d,session:async()=>null})).status,403);
  assert.equal(d.writes.length,0);assert.equal((await handleEditableCopyAdmin(make(body),d)).status,200);assert.equal(d.writes[0].actorId,'123');
});
test('cross-origin, unknown scope and disabled copy reject without publication',async()=>{
  const d=deps();const body={scope:'site',action:'publish',expectedRevision:0,overrides:{}};
  assert.equal((await handleEditableCopyAdmin(make(body,'https://attacker.test'),d)).status,403);
  assert.equal((await handleEditableCopyAdmin(make({...body,scope:'internal'}),d)).status,400);
  assert.equal((await handleEditableCopyAdmin(make(body),{...d,enabled:()=>false})).status,503);assert.equal(d.writes.length,0);
});
test('catalog and history are admin-only; duplicate cursor/scope rejected',async()=>{
  const d=deps();for(const query of ['scope=site&scope=bot','scope=site&beforeVersion=0','scope=site&beforeVersion=2&beforeVersion=3']) assert.equal((await handleEditableCopyAdmin(new Request(`${base}/api/admin/copy?${query}`),d)).status,400);
  assert.equal((await handleEditableCopyAdmin(new Request(`${base}/api/admin/copy?scope=site&beforeVersion=2`),d)).status,200);
});
test('conflicts retain status; internal failures do not expose credentials',async()=>{
  const d=deps();const request=()=>make({scope:'bot',action:'publish',expectedRevision:0,overrides:{}});
  assert.equal((await handleEditableCopyAdmin(request(),{...d,execute:async()=>{throw new EditableCopyError(409,'revision changed');}})).status,409);
  const response=await handleEditableCopyAdmin(request(),{...d,execute:async()=>{throw new Error('postgresql://secret');}});
  assert.equal(response.status,503);assert.equal((await response.text()).includes('secret'),false);
});
test('oversized streaming request is rejected before execute',async()=>{
  const d=deps();const response=await handleEditableCopyAdmin(make({scope:'site',overrides:{x:'x'.repeat(2*1024*1024+4096)}}),d);
  assert.equal(response.status,413);assert.equal(d.writes.length,0);
});
