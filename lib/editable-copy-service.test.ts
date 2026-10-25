import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEditableCopyService, EditableCopyError, parseCopyScope, type CopyDb } from './editable-copy-service';
import type { EditableCopyEntry } from './editable-copy-contract';
const catalog: EditableCopyEntry[] = [{ key: 'site.welcome', group: '欢迎', label: '问候', defaultText: '欢迎 {name}', variables: ['name'], maxLength: 100 }];
function fixture() {
  let config: { scope: string; revision: number; activeVersion: number } | null = null;
  let rows: Array<{ scope: string; version: number; overrides: unknown; actorId: string; reason: string; createdAt: Date; rollbackOf: number | null }> = [];
  let failInsert = false; let creates = 0; let tail: Promise<void> = Promise.resolve();
  const db: CopyDb = {
    editableCopyConfig: {
      async findUnique() { return config && { ...config }; },
      async createMany({ data }) { creates++; config ??= { scope: data[0].scope, revision: 0, activeVersion: 0 }; },
      async updateMany({ where, data }) { if (!config || config.revision !== where.revision || config.activeVersion !== where.activeVersion) return { count: 0 }; config = { ...config, revision: config.revision + data.revision.increment, activeVersion: data.activeVersion }; return { count: 1 }; },
    },
    editableCopyVersion: {
      async findUnique({ where }) { return rows.find(row => row.scope === where.scope_version.scope && row.version === where.scope_version.version) ?? null; },
      async findMany({ where, take }) { return rows.filter(row => row.scope === where.scope && (!where.version || row.version < where.version.lt)).sort((a,b) => b.version-a.version).slice(0,take); },
      async create({ data }) { if (failInsert) throw new Error('insert failed'); rows.push({ ...data, createdAt: new Date('2026-10-24') }); },
    },
    async $transaction(callback) {
      const previous = tail; let release!: () => void; tail = new Promise<void>(resolve => { release = resolve; }); await previous;
      const before = structuredClone({ config, rows });
      try { return await callback(db); } catch(error) { config=before.config;rows=before.rows;throw error; } finally { release(); }
    },
  };
  return { service: createEditableCopyService(db, 'site', catalog), get creates() {return creates;}, failInsert() { failInsert=true; }, get rows(){return rows;} };
}
const publish = (revision: number, text: string) => ({ scope: 'site', action: 'publish', expectedRevision: revision, overrides: { 'site.welcome': text } });
test('copy inspection and startup reads never create database rows', async () => {
  const f=fixture();assert.equal((await f.service.inspect()).activeVersion,0);assert.equal((await f.service.loadPublished()).version,0);assert.equal(f.creates,0);
});
test('simultaneous edits with the same revision permit one publication', async () => {
  const f=fixture();const results=await Promise.allSettled([f.service.execute(publish(0,'您好 {name}'),'admin-a'),f.service.execute(publish(0,'你好 {name}'),'admin-b')]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);const rejected=results.find(x=>x.status==='rejected') as PromiseRejectedResult;
  assert.equal((rejected.reason as EditableCopyError).status,409);assert.equal(f.rows.length,1);assert.equal((await f.service.loadPublished()).overrides['site.welcome'],'您好 {name}');
});
test('publication pointer and immutable history roll back together on failure',async()=>{
  const f=fixture();await f.service.execute(publish(0,'您好 {name}'),'admin');f.failInsert();await assert.rejects(f.service.execute(publish(1,'你好 {name}'),'admin'));
  assert.equal((await f.service.inspect()).revision,1);assert.equal((await f.service.loadPublished()).version,1);assert.equal(f.rows.length,1);
});
test('rollback creates a new version and retains actor and originals',async()=>{
  const f=fixture();await f.service.execute(publish(0,'您好 {name}'),'a');await f.service.execute(publish(1,'你好 {name}'),'b');
  const result=await f.service.execute({scope:'site',action:'rollback',expectedRevision:2,targetVersion:1},'c');
  assert.equal(result.activeVersion,3);assert.equal(result.overrides['site.welcome'],'您好 {name}');assert.equal(f.rows[2].rollbackOf,1);assert.equal(f.rows[0].actorId,'a');assert.equal(f.rows[2].actorId,'c');
});
test('invalid template, forged actor field and scope never write',async()=>{
  const f=fixture();await assert.rejects(f.service.execute(publish(0,'删除姓名'),'a'));await assert.rejects(f.service.execute({...publish(0,'你好 {name}'),actorId:'forged'},'a'));
  assert.throws(()=>parseCopyScope('other'));assert.equal(f.creates,0);
});
