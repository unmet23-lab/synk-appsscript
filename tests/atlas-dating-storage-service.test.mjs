import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
import { captureDatingDatabase, armReceiptFull } from './lib/dating-sqlite-faults.mjs';

const tables = ['dating_accounts','dating_receipts','dating_pairs','dating_introductions','dating_alignments','dating_reports','dating_exposures'];
const snapshot = db => Object.fromEntries(tables.map(name=>[name,db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));
async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'synk-live-storage-service-')), filename=path.join(dir,'account.sqlite'), subject=randomUUID();
  const {value:server,database} = captureDatingDatabase(()=>createDatingServer({mode:'account',databasePath:filename,
    verify:async token=>token===subject?{accountId:subject}:null}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-live-storage-service-'));fs.rmSync(dir,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const call=async(route,body)=>{
    const response=await fetch(origin+'/api/atlas-dating'+route,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Authorization:`Bearer ${subject}`,Connection:'close',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(3000)});
    const value=await response.json();return {status:response.status,value};
  };
  const initial=await call('/state');assert.equal(initial.status,200);
  const envelope={requestId:randomUUID(),expectedRevision:initial.value.view.revision,action:{kind:'onboard',
    profile:{nickname:'합성 저장 시험',region:'시험 지역',intro:'실제 사용자 자료 아님'},declared:true,
    consents:{profilePublic:false,receiveInvitations:false,storePreferences:true}}};
  return{filename,subject,database,call,envelope,initial:initial.value.view};
}

for(const kind of ['full-at-receipt','query-only','busy-writer']) test(`actual HTTP ${kind} preserves atomic data and allows one idempotent recovery`,async t=>{
  const f=await fixture(t),before=snapshot(f.database);let recover,blocker;
  try{
    if(kind==='full-at-receipt')recover=armReceiptFull(f.database);
    else if(kind==='query-only'){f.database.exec('PRAGMA query_only=ON;');recover=()=>f.database.exec('PRAGMA query_only=OFF;');}
    else{f.database.exec('PRAGMA busy_timeout=0;');blocker=new DatabaseSync(f.filename);blocker.exec('BEGIN IMMEDIATE;');recover=()=>{blocker.exec('ROLLBACK;');blocker.close();blocker=null;};}
    const failed=await f.call('/action',f.envelope);
    assert.equal(failed.status,503);assert.deepEqual(failed.value,{ok:false,error:{code:'storage-unavailable'}});
    assert.deepEqual(snapshot(f.database),before);assert.equal(f.database.isTransaction,false);
    const receiptWhileFailed=await f.call('/receipt?requestId='+f.envelope.requestId);
    if(kind==='full-at-receipt'){assert.equal(receiptWhileFailed.status,200);assert.equal(receiptWhileFailed.value.status,'not-found');}
    else {assert.equal(receiptWhileFailed.status,503);assert.equal(receiptWhileFailed.value.error.code,'storage-unavailable');}
    assert.deepEqual(snapshot(f.database),before);
    recover();recover=null;
    const missing=await f.call('/receipt?requestId='+f.envelope.requestId);assert.equal(missing.status,200);assert.equal(missing.value.status,'not-found');
    const retry=await f.call('/action',f.envelope);assert.equal(retry.status,200);assert.equal(retry.value.view.revision,f.initial.revision+1);
    assert.equal(retry.value.view.onboarding.complete,true);
    const repeated=await f.call('/action',f.envelope);assert.equal(repeated.status,200);assert.equal(repeated.value.replayed,true);
    assert.equal(repeated.value.view.revision,retry.value.view.revision);
    const receipt=await f.call('/receipt?requestId='+f.envelope.requestId);assert.equal(receipt.status,200);assert.equal(receipt.value.status,'applied');
    assert.equal(receipt.value.appliedRevision,retry.value.appliedRevision);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM dating_receipts WHERE actor=?').get(f.subject).n,1);
    assert.equal(f.database.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  }finally{recover?.();if(blocker){blocker.close();}}
});
