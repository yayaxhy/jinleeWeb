import { migrationExtraOwnerFields } from './account-migration-records';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { detachDiscordAccountTx } from './discord-detach-transaction';
import { createQuotaTestState, createQuotaTestTransaction } from './manual-quota.test-support';
const old='123456789123456789'; const owner='DLM-A'; const parked=`detached:${owner}`;const dec=(n:number)=>new Prisma.Decimal(n);
type Row=Record<string,unknown>;
const clone=(x:unknown):unknown=>x instanceof Prisma.Decimal?new Prisma.Decimal(x):x instanceof Date?new Date(x):Array.isArray(x)?x.map(clone):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,clone(v)])):x;
const match=(row:Row,where:Row):boolean=>Object.entries(where).every(([k,v])=>k==='OR'?(v as Row[]).some(w=>match(row,w)):v&&typeof v==='object'&&'in' in v?(v.in as unknown[]).includes(row[k]):row[k]===v);
function fixture(){
 const data:Record<string,Row[]>={
 dlmUser:[{dlmId:owner,discordUserId:old,sessionVersion:3,totalBalance:dec(2),income:dec(1),recharge:dec(1),totalSpent:dec(0),loyaltyPoints:dec(0)}],
 member:[{discordUserId:old,status:'PEIWAN',totalBalance:dec(100),income:dec(40),recharge:dec(60),totalSpent:dec(800)}],
 accountBinding:[{id:'dc',dlmId:owner,provider:'DISCORD',providerUserId:old,unionId:null},{id:'wx',dlmId:owner,provider:'WECHAT_WEB',providerUserId:'wx',unionId:'U'}],
 wechatProgramSession:[{id:'token',dlmId:owner}],pEIWAN:[{PEIWANID:18,discordUserId:old,totalEarn:dec(50)}],
 loyaltyPoint:[{discordUserId:old,dlmId:owner,points:dec(-7)}],coupon:[{id:'coupon',discordId:old,dlmId:null}],
 recharge:[{RechargeID:'R1',toWhom:old,dlmId:null}],withdraw:[{id:'W1',discordId:old,dlmId:null}],individualTransaction:[{transactionId:'T1',discordId:old,dlmId:null}],
 lotteryDraw:[{id:'draw',userId:old,dlmId:null}],order:[{id:'ended',hostId:old,hostDlmId:null,status:'ENDED'}],
 autoCommissionBuff:[{userId:old,activeUntil:new Date('2030-01-01')}],commissionBuff:[{userId:old,expiresAt:new Date('2030-01-02')}],
 referral:[{inviteeId:old,inviterId:'222222222222222222',enabled:true}],referralPolicy:[{id:'policy',inviterId:old,enabled:true}],
 farmPlot:[],farmActionLog:[],farmVisit:[],farmPlotHelp:[],bossChannelBinding:[],peiwanDeletion:[],peiwanGameProfile:[],redEnvelope:[],redEnvelopeClaim:[],guildJoinRecord:[],blockStackGame:[],vipBenefitProfile:[],heartCounter:[],blockStackPlayer:[],blockStackDraw:[],detachedDiscordAccount:[],accountMigration:[],accountOwnership:[],withdrawalAccount:[],pointShopCart:[],pointShopOrder:[],pointShopGrant:[],pointShopPointLedger:[],transaction:[],commission:[],
 };
 const quotas=createQuotaTestState();quotas.flowBuff.set(old,{userId:old,remainingExtra:dec(80),expiresAt:new Date('2030-01-01'),createdAt:new Date(0)});
 quotas.manualQuotaBatch.set('expired',{id:'expired',userId:old,kind:'flow',remainingExtra:dec(100),expiresAt:new Date('2000-01-01')});
 const trace:string[]=[];let failAt:string|null=null;
 async function run(input={dlmId:owner,expectedSessionVersion:3,rolePlan:{version:1,source:{dlmId:owner,discordId:old},target:{dlmId:owner,discordId:null}} as Prisma.InputJsonValue}){
  const staged=clone(data) as typeof data;const quota=createQuotaTestTransaction(quotas);
  const rows=(model:string)=>staged[model]??(staged[model]=[]);
  const beforeWrite=(model:string)=>{trace.push(`write:${model}`);if(failAt===model)throw Error('simulated persistence failure');};
  const delegate=(model:string)=>({
   findUnique:async({where,include}:{where:Row;include?:Row})=>{const r=rows(model).find(r=>match(r,where));return r?model==='dlmUser'&&include?{...r,member:rows('member').find(m=>m.discordUserId===r.discordUserId),accountBindings:rows('accountBinding').filter(b=>b.dlmId===r.dlmId)}:clone(r):null;},
   findFirst:async({where}:{where:Row})=>rows(model).find(r=>match(r,where))??null,
   findMany:async({where}:{where:Row})=>rows(model).filter(r=>match(r,where)).map(clone),
   create:async({data:entry}:{data:Row})=>{beforeWrite(model);rows(model).push(entry);return entry;},
   update:async({where,data:patch}:{where:Row;data:Row})=>{beforeWrite(model);const row=rows(model).find(r=>match(r,where));assert(row);const prior={...row};for(const[k,v]of Object.entries(patch))row[k]=v&&typeof v==='object'&&'increment'in v?Number(row[k])+Number(v.increment):v;
    if(model==='member'&&patch.discordUserId){for(const m of Prisma.dmmf.datamodel.models){for(const f of m.fields){if(f.kind==='object'&&f.type==='Member'&&f.relationFromFields?.length===1&&f.relationToFields?.[0]==='discordUserId'){const key=m.name[0].toLowerCase()+m.name.slice(1);for(const related of rows(key))if(related[f.relationFromFields[0]]===prior.discordUserId)related[f.relationFromFields[0]]=row.discordUserId;}}}}
    return row;},
   updateMany:async({where,data:patch}:{where:Row;data:Row})=>{beforeWrite(model);const found=rows(model).filter(r=>match(r,where));for(const r of found)Object.assign(r,patch);return{count:found.length};},
   deleteMany:async({where}:{where:Row})=>{beforeWrite(model);const initial=rows(model);const after=initial.filter(r=>!match(r,where));staged[model]=after;return{count:initial.length-after.length};},
   upsert:async({create}:{create:Row})=>{beforeWrite(model);rows(model).push(create);return create;},
  });
  const tx={...Object.fromEntries(Object.keys(data).map(k=>[k,delegate(k)])),flowBuff:quota.tx.flowBuff,spendBuff:quota.tx.spendBuff,manualQuotaBatch:quota.tx.manualQuotaBatch,manualQuotaRestoration:quota.tx.manualQuotaRestoration,
   $queryRaw:async(parts:TemplateStringsArray|Prisma.Sql,...args:string[])=>{if(!Array.isArray(parts))return quota.tx.$queryRaw(parts as Prisma.Sql);const sql=parts.join('?');trace.push(sql);return sql.includes('FROM "DlmUser"')?rows('dlmUser').filter(r=>r.dlmId===args[0]):sql.includes('FROM "Member"')?rows('member').filter(r=>r.discordUserId===args[0]):[];},
   $executeRaw:async(parts:TemplateStringsArray|Prisma.Sql)=>Array.isArray(parts)?0:quota.tx.$executeRaw(parts as Prisma.Sql),
  } as unknown as Prisma.TransactionClient;
  const result=await detachDiscordAccountTx(tx,input);for(const k of Object.keys(staged))data[k]=staged[k];quota.commit();return result;
 }
 return{data,quotas,trace,run,fail:(model:string)=>{failAt=model;}};
}
test('asset-bearing worker can unlink without deleting assets, while the old Discord wallet disappears',async()=>{
 const f=fixture();const r=await f.run();assert.equal(r.loggedOut,true);assert.equal(f.data.dlmUser[0].discordUserId,null);assert.equal(String(f.data.dlmUser[0].totalBalance),'100');assert.equal(String(f.data.dlmUser[0].loyaltyPoints),'-7');
 assert.equal(f.data.member[0].discordUserId,parked);assert.equal(f.data.pEIWAN[0].discordUserId,parked);assert.equal(f.data.pEIWAN[0].PEIWANID,18);
 assert.deepEqual(f.data.accountBinding.map(b=>b.provider),['WECHAT_WEB']);assert.equal(f.data.wechatProgramSession.length,0);assert.equal(f.data.dlmUser[0].sessionVersion,4);
 assert.equal(f.data.coupon[0].dlmId,owner);assert.equal(f.data.coupon[0].discordId,parked);assert.equal(f.data.individualTransaction[0].discordId,old);assert.equal(f.data.individualTransaction[0].dlmId,owner);
 assert.equal(f.data.referral[0].enabled,false);assert.equal(f.data.accountMigration[0].mode,'DETACH');assert.equal(f.data.accountOwnership[0].currentDiscordId,null);
});
test('ordinary and restored quota custody preserves expiration without reviving old quota',async()=>{
 const f=fixture();await f.run();assert.equal(f.quotas.flowBuff.has(old),false);assert.equal(f.quotas.flowBuff.get(parked)?.remainingExtra?.toString(),'80');
 assert.equal(f.quotas.manualQuotaBatch.get('expired')?.userId,parked);assert.equal((f.quotas.manualQuotaBatch.get('expired')?.expiresAt as Date).toISOString(),'2000-01-01T00:00:00.000Z');
});
test('unlink cannot remove the last usable login even with an empty wallet',async()=>{
 const f=fixture();f.data.accountBinding=f.data.accountBinding.filter(b=>b.provider==='DISCORD');await assert.rejects(f.run(),/last_login_method_forbidden/);assert.equal(f.data.member[0].discordUserId,old);assert(!f.trace.some(x=>x.startsWith('write:')));
});
test('a stale source session or mismatched role recipient cannot move assets',async()=>{
 const f=fixture();await assert.rejects(f.run({dlmId:owner,expectedSessionVersion:2,rolePlan:{}}),/binding_state_changed/);
 await assert.rejects(f.run({dlmId:owner,expectedSessionVersion:3,rolePlan:{version:1,source:{dlmId:owner,discordId:'other'},target:{dlmId:owner,discordId:null}}}),/role_plan_changed/);
 assert.equal(f.data.member[0].discordUserId,old);assert.equal(f.data.accountMigration.length,0);
});
test('failure saving ownership evidence rolls back the entire detach',async()=>{
 const f=fixture();f.fail('accountOwnership');await assert.rejects(f.run(),/simulated persistence failure/);assert.equal(f.data.dlmUser[0].discordUserId,old);assert.equal(f.data.member[0].discordUserId,old);assert.equal(f.data.accountBinding.length,2);assert.equal(f.data.accountMigration.length,0);assert.equal(f.quotas.flowBuff.has(old),true);
});
test('identity and wallet locks precede all detach writes',async()=>{
 const f=fixture();await f.run();const firstWrite=f.trace.findIndex(x=>x.startsWith('write:'));assert(firstWrite>0);assert(f.trace.slice(0,firstWrite).some(x=>x.includes('pg_advisory_xact_lock')));assert(f.trace.slice(0,firstWrite).some(x=>x.includes('FROM "Member"')&&x.includes('FOR UPDATE')));
});


test('detached role plan uses locked entitlements and fixed peer owners, not stale preflight data',async()=>{
 const f=fixture();f.data.vipBenefitProfile.push({discordUserId:old,roleOptOut:true});
 f.data.heartCounter.push({fromMemberId:old,toMemberId:'222222222222222222'});
 f.data.dlmUser.push({dlmId:'PEER-DLM',discordUserId:'222222222222222222'});
 await f.run({dlmId:owner,expectedSessionVersion:3,rolePlan:{version:1,source:{dlmId:owner,discordId:old},target:{dlmId:owner,discordId:null},vipRoleOptOut:false,fuxingActiveUntil:null,sourceWasPeiwan:false}});
 const plan=f.data.accountMigration[0].rolePlan as Row;
 assert.equal(plan.vipRoleOptOut,true);assert.equal(plan.sourceWasPeiwan,true);
 assert.equal(plan.fuxingActiveUntil,'2030-01-01T00:00:00.000Z');assert.equal(typeof plan.createdAt,'string');
 assert.deepEqual(plan.heartPeerOwners,[{dlmId:'PEER-DLM',discordId:'222222222222222222'}]);
});


test('unlink preserves a later inherited Fuxing floor before the background refresh runs',async()=>{
 const f=fixture();f.data.accountMigration.push({id:'prior',targetDlmId:owner,status:'COMPLETED',autoCommissionProgressDiscordId:'PROGRESS',inheritedAutoCommissionUntil:new Date('2031-01-01')});
 await f.run();const migration=f.data.accountMigration.at(-1)!;
 assert.equal((migration.inheritedAutoCommissionUntil as Date).toISOString(),'2031-01-01T00:00:00.000Z');
 assert.equal(migration.autoCommissionProgressDiscordId,'PROGRESS');
 assert.equal((migration.rolePlan as Row).fuxingActiveUntil,'2031-01-01T00:00:00.000Z');
});


test('all non-FK current ownership follows detached custody and never remains claimable by a recycled Discord',async()=>{
 const f=fixture(); const quotaModels = new Set(['ManualQuotaBatch', 'ManualQuotaRestoration', 'FlowBuff', 'SpendBuff']);
 for(const [model,fields] of Object.entries(migrationExtraOwnerFields)) {
  if(quotaModels.has(model))continue;
  const name=model[0].toLowerCase()+model.slice(1);
  for(const field of fields.member??[])f.data[name].push({id:`${model}:${field}`, [field]:old, originalActor:old});
 }
 await f.run();
 for(const [model,fields] of Object.entries(migrationExtraOwnerFields)) {
  if(quotaModels.has(model))continue;
  const name=model[0].toLowerCase()+model.slice(1);
  for(const field of fields.member??[]) {
   const row=f.data[name].find(row=>row.id===`${model}:${field}`)!;
   assert.equal(row[field],parked,`${model}.${field} must be parked`);
   assert.equal(row.originalActor,old,'historical actors must stay immutable');
  }
 }
 assert.equal(f.data.individualTransaction[0].discordId,old);
});

test('failure remapping a raw owner rolls back Member custody and every prior transfer',async()=>{
 const f=fixture();f.data.farmPlotHelp.push({id:'help',helperDiscordId:old});f.fail('farmPlotHelp');
 await assert.rejects(f.run(),/simulated persistence failure/);
 assert.equal(f.data.member[0].discordUserId,old);assert.equal(f.data.dlmUser[0].discordUserId,old);
 assert.equal(f.data.farmPlotHelp[0].helperDiscordId,old);assert.equal(f.data.accountMigration.length,0);
 assert.equal(f.quotas.flowBuff.has(old),true);
});
