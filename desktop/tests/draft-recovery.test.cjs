'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createDraftRecovery,MAX_AGE}=require('../src/draft-recovery.cjs');
const payload={kind:'note',appId:'world',title:'복구할 제목',body:'비공개 작성 중 내용'};
function fixture(t,{available=true,platform='win32'}={}){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-draft-test-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));let now=1000000,account={signedIn:true,status:'signed-in',sessionGeneration:1,account:{synk_user_id:'synthetic-owner-a'}},key=crypto.randomBytes(32);const events=[];
  const safeStorage={isEncryptionAvailable:()=>available,getSelectedStorageBackend:()=>platform==='linux'?'basic_text':undefined,encryptString:text=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(text,'utf8'),cipher.final(),cipher.getAuthTag()]);},decryptString:data=>{const decipher=crypto.createDecipheriv('aes-256-gcm',key,data.subarray(0,12));decipher.setAuthTag(data.subarray(-16));return Buffer.concat([decipher.update(data.subarray(12,-16)),decipher.final()]).toString('utf8');}};
  const args={directory,safeStorage,getAccount:()=>account,now:()=>now,platform,onChange:value=>events.push(value),configFingerprint:'synthetic-config'};
  return {directory,store:createDraftRecovery(args),args,events,owner:account.account.synk_user_id,setAccount:value=>{account=value;},advance:ms=>{now+=ms;}};
}
test('draft recovery defaults off, writes only after account consent, and reloads encrypted data',async t=>{
  const f=fixture(t);assert.equal((await f.store.status()).enabled,false);assert.equal((await f.store.save('member-home',payload)).code,'DRAFT_RECOVERY_DISABLED');assert.deepEqual(fs.readdirSync(f.directory),[]);
  assert.equal((await f.store.setEnabled(true)).enabled,true);assert.equal((await f.store.save('member-home',payload)).ok,true);
  for(const file of fs.readdirSync(f.directory)){const data=fs.readFileSync(path.join(f.directory,file));assert.equal(data.includes(Buffer.from(payload.body)),false);assert.equal(data.includes(Buffer.from(f.owner)),false);}
  const reloaded=createDraftRecovery(f.args),restored=await reloaded.load('member-home');assert.deepEqual(restored.draft,payload);assert.equal(restored.expiresAt-restored.updatedAt,MAX_AGE);assert.equal(f.events.length,1);
});
test('main-owned account identity partitions drafts and rejects in-flight work after identity changes',async t=>{
  const f=fixture(t);await f.store.setEnabled(true);await f.store.save('member-home',payload);
  const pending=f.store.load('member-home');f.setAccount({signedIn:true,status:'signed-in',sessionGeneration:2,account:{synk_user_id:'synthetic-owner-b'}});assert.equal((await pending).code,'AUTH_CHANGED');
  assert.equal((await f.store.load('member-home')).draft,null);assert.equal((await f.store.status()).enabled,false);
  f.setAccount({signedIn:false,status:'signed-out',sessionGeneration:3});assert.equal((await f.store.load('member-home')).code,'AUTH_REQUIRED');
});
test('seven-day expiration purges draft but retains opted-in state; disabling removes all slots and consent',async t=>{
  const f=fixture(t);await f.store.setEnabled(true);await f.store.save('member-home',payload);f.advance(MAX_AGE);const result=await f.store.load('member-home');assert.equal(result.draft,null);assert.equal(result.enabled,true);
  await f.store.save('member-home',payload);await f.store.setEnabled(false);assert.deepEqual(fs.readdirSync(f.directory),[]);assert.equal((await f.store.load('member-home')).draft,null);
});
test('platform draft and member-home draft clear independently and explicit account purge deletes recovery consent',async t=>{
  const f=fixture(t),library={draft:{appId:'care',title:'플랫폼 초안'},parkedDraft:null,editing:{id:'note-123',appId:'care',title:'이전',done:false,createdAt:5}};
  await f.store.setEnabled(true);await f.store.save('member-home',payload);assert.equal((await f.store.save('platform-library',library)).ok,true);await f.store.clear('platform-library');assert.equal((await f.store.load('platform-library')).draft,null);assert.deepEqual((await f.store.load('member-home')).draft,payload);
  await f.store.clearAccount(f.owner);assert.deepEqual(fs.readdirSync(f.directory),[]);
});
test('unsafe storage and non-whitelisted payloads fail closed with no plaintext fallback',async t=>{
  const f=fixture(t,{available:false});assert.equal((await f.store.status()).available,false);assert.equal((await f.store.setEnabled(true)).code,'SECURE_STORAGE_UNAVAILABLE');assert.deepEqual(fs.readdirSync(f.directory),[]);
  const g=fixture(t);await g.store.setEnabled(true);for(const [slot,value]of [['../../token',payload],['member-home',{...payload,appId:'../cmd'}],['member-home',{...payload,body:'x'.repeat(1201)}],['platform-library',{draft:{appId:'world',title:'x'.repeat(241)},editing:null,parkedDraft:null}]])assert.equal((await g.store.save(slot,value)).code,'INVALID_DRAFT');
});
