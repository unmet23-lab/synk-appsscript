'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{spawnSync}=require('node:child_process'),P=require('../receiver/setup.cjs'),S=require('../receiver/sync.cjs');
const ENDPOINT='https://script.google.com/macros/s/deployment_example/exec',DATE='2026-10-01T10:00:00.000Z';
async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'pulse-setup-'));t.after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('pulse-setup-'));await fs.rm(root,{recursive:true,force:true});});
  const baseDir=path.join(root,'private'),outputDir=path.join(root,'public');let n=0;const options={baseDir,outputDir,now:()=>new Date(DATE),randomBytes:()=>Buffer.alloc(32,++n)};return {root,baseDir,outputDir,options};
}
test('setup keeps raw tokens in private files and generates only hashed owner configuration',async t=>{
  const f=await fixture(t),result=await P.prepare(f.options),connection=JSON.parse(await fs.readFile(path.join(f.baseDir,'connection.json'),'utf8')),invite=JSON.parse(await fs.readFile(path.join(f.baseDir,'invite.json'),'utf8')),source=await fs.readFile(path.join(f.outputDir,'OwnerSetup.gs'),'utf8');
  assert.equal(result.endpointConfigured,false);assert.equal(result.remoteInitialized,false);assert.equal(connection.endpoint,'');assert.equal(connection.inboxDir,path.join(f.baseDir,'inbox'));assert.match(connection.adminToken,/^[a-f0-9]{64}$/);assert.match(invite.token,/^[a-f0-9]{64}$/);assert.notEqual(connection.adminToken,invite.token);assert.equal(Date.parse(invite.expiresAt)-Date.parse(invite.createdAt),P.SEVEN_DAYS);
  assert(source.includes(S.digest(connection.adminToken)));assert(source.includes(S.digest(invite.token)));assert(!source.includes(connection.adminToken));assert(!source.includes(invite.token));assert(!JSON.stringify(result).includes(invite.token));assert(!JSON.stringify(result).includes(connection.adminToken));await assert.rejects(()=>fs.access(path.join(f.baseDir,'customer-link.txt')));
  if(process.platform!=='win32')for(const name of ['connection.json','invite.json'])assert.equal((await fs.stat(path.join(f.baseDir,name))).mode&0o077,0);
});
test('rerunning preserves tokens, invitation lifetime and unknown private settings while endpoint is added',async t=>{
  const f=await fixture(t);await P.prepare(f.options);const originalConnection=JSON.parse(await fs.readFile(path.join(f.baseDir,'connection.json'),'utf8')),originalInvite=await fs.readFile(path.join(f.baseDir,'invite.json'),'utf8');originalConnection.keepThisSetting='retained';await fs.writeFile(path.join(f.baseDir,'connection.json'),JSON.stringify(originalConnection));
  const result=await P.prepare({...f.options,endpoint:ENDPOINT,now:()=>new Date(Date.parse(DATE)+3600000),randomBytes:()=>{throw Error('must not generate again');}}),connection=JSON.parse(await fs.readFile(path.join(f.baseDir,'connection.json'),'utf8')),invite=JSON.parse(originalInvite);
  assert.equal(connection.endpoint,ENDPOINT);assert.equal(connection.adminToken,originalConnection.adminToken);assert.equal(connection.keepThisSetting,'retained');assert.equal(await fs.readFile(path.join(f.baseDir,'invite.json'),'utf8'),originalInvite);assert.equal(result.inviteExpiresAt,invite.expiresAt);assert.equal(await fs.readFile(path.join(f.baseDir,'customer-link.txt'),'utf8'),ENDPOINT+'?invite='+invite.token+'\n');
  await P.prepare({...f.options,randomBytes:()=>{throw Error('must not generate again');}});assert.equal(JSON.parse(await fs.readFile(path.join(f.baseDir,'connection.json'),'utf8')).endpoint,ENDPOINT);
});
test('generated editor setup is idempotent and never replaces a different admin hash or used invite',async t=>{
  const f=await fixture(t);await P.prepare(f.options);const source=await fs.readFile(path.join(f.outputDir,'OwnerSetup.gs'),'utf8'),props=new Map(),records=new Map();let initialized=0,writes=0;
  const sandbox={Date:class extends Date{static now(){return Date.parse(DATE);}},PULSE_INTAKE_:{prefix:'pulse.intake.v1.'},PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key)||null,setProperty:(key,value)=>{props.set(key,value);writes++;}})},initializeInbox_:()=>{initialized++;},intakeLocked_:fn=>fn(),intakeAssert_:(ok,code)=>{if(!ok)throw Error(code);},intakeEqual_:(a,b)=>a===b,intakeGet_:key=>records.get(key)||null,intakePut_:(key,value)=>records.set(key,value)};
  vm.runInNewContext(source,sandbox);assert.equal(sandbox.applyOwnerSetup_().configured,true);assert.equal(initialized,1);assert.equal(writes,1);assert.equal(records.size,1);
  const key=[...records.keys()][0],existing=records.get(key);existing.requestId='already_started';sandbox.applyOwnerSetup_();assert.equal(writes,1);assert.equal(records.get(key).requestId,'already_started');assert.equal(records.size,1);
  props.set('pulse.intake.v1.adminTokenHash','f'.repeat(64));const before=initialized;assert.throws(()=>sandbox.applyOwnerSetup_(),/admin_config_mismatch/);assert.equal(initialized,before);assert.equal(props.get('pulse.intake.v1.adminTokenHash'),'f'.repeat(64));
});
test('public editor wrapper rejects anonymous and remote customers before any setup mutation',()=>{
  const source=P.ownerSource({adminTokenHash:'a'.repeat(64),inviteHash:'b'.repeat(64),createdAt:DATE,expiresAt:new Date(Date.parse(DATE)+P.SEVEN_DAYS).toISOString()});
  for(const [active,effective] of [['','owner@example.com'],['customer@example.com','owner@example.com'],['',''],[' ',' ']]){
    let mutations=0;const sandbox={ScriptApp:{AuthMode:{FULL:'FULL'},requireAllScopes:mode=>assert.equal(mode,'FULL')},Session:{getActiveUser:()=>({getEmail:()=>active}),getEffectiveUser:()=>({getEmail:()=>effective})},intakeAssert_:(ok,code)=>{if(!ok)throw Error(code);}};
    vm.runInNewContext(source,sandbox);sandbox.applyOwnerSetup_=()=>{mutations++;};assert.throws(()=>sandbox.applyOwnerSetup(),/owner_only/);assert.equal(mutations,0);
  }
  let mutations=0;const owner={ScriptApp:{AuthMode:{FULL:'FULL'},requireAllScopes:mode=>assert.equal(mode,'FULL')},Session:{getActiveUser:()=>({getEmail:()=>'owner@example.com'}),getEffectiveUser:()=>({getEmail:()=>'owner@example.com'})},intakeAssert_:(ok,code)=>{if(!ok)throw Error(code);}};
  vm.runInNewContext(source,owner);owner.applyOwnerSetup_=()=>{mutations++;return {configured:true};};assert.equal(owner.applyOwnerSetup().configured,true);assert.equal(mutations,1);
});
test('missing granular consent stops before identity lookup or any setup mutation',()=>{
  const source=P.ownerSource({adminTokenHash:'a'.repeat(64),inviteHash:'b'.repeat(64),createdAt:DATE,expiresAt:new Date(Date.parse(DATE)+P.SEVEN_DAYS).toISOString()}),calls=[];
  const sandbox={ScriptApp:{AuthMode:{FULL:'FULL'},requireAllScopes:mode=>{calls.push('require:'+mode);throw Error('consent_required');}},Session:{getActiveUser:()=>{calls.push('identity');throw Error('must_not_run');},getEffectiveUser:()=>{calls.push('effective');throw Error('must_not_run');}},intakeAssert_:()=>{calls.push('assert');}};
  vm.runInNewContext(source,sandbox);sandbox.applyOwnerSetup_=()=>{calls.push('mutation');};assert.throws(()=>sandbox.applyOwnerSetup(),/consent_required/);assert.deepEqual(calls,['require:FULL']);
});
test('owner identity scope and deployment execution identity remain explicit',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(__dirname,'../receiver/appsscript.json'),'utf8'));assert.deepEqual([...manifest.oauthScopes].sort(),['https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/script.send_mail','https://www.googleapis.com/auth/userinfo.email']);assert.equal(manifest.webapp.executeAs,'USER_DEPLOYING');
});
test('unsafe endpoints and overlapping private-public directories fail before exposing secrets',async t=>{
  const f=await fixture(t);for(const endpoint of ['https://evil.example/exec','http://script.google.com/macros/s/id/exec','https://script.google.com/macros/s/id/exec?invite=private'])await assert.rejects(()=>P.prepare({...f.options,endpoint}),e=>e.code==='invalid_endpoint');
  await assert.rejects(()=>fs.access(f.baseDir));await assert.rejects(()=>P.prepare({...f.options,baseDir:path.join(f.outputDir,'private')}),e=>e.code==='private_public_directories_overlap');await assert.rejects(()=>P.prepare({...f.options,outputDir:path.join(f.baseDir,'public')}),e=>e.code==='private_public_directories_overlap');
  assert.deepEqual(P.parseArgs([]),{});assert.deepEqual(P.parseArgs(['--endpoint',ENDPOINT]),{endpoint:ENDPOINT});assert.throws(()=>P.parseArgs(['--adminToken','secret']),e=>e.code==='invalid_setup_arguments');
});
test('existing expired or malformed secrets are preserved instead of silently rotated',async t=>{
  const f=await fixture(t);await P.prepare(f.options);const config=await fs.readFile(path.join(f.baseDir,'connection.json'),'utf8'),invite=await fs.readFile(path.join(f.baseDir,'invite.json'),'utf8');
  await assert.rejects(()=>P.prepare({...f.options,now:()=>new Date(Date.parse(DATE)+P.SEVEN_DAYS+1)}),e=>e.code==='setup_invite_expired');assert.equal(await fs.readFile(path.join(f.baseDir,'connection.json'),'utf8'),config);assert.equal(await fs.readFile(path.join(f.baseDir,'invite.json'),'utf8'),invite);
  const broken=JSON.parse(config);broken.adminToken='bad-secret';await fs.writeFile(path.join(f.baseDir,'connection.json'),JSON.stringify(broken));await assert.rejects(()=>P.prepare(f.options),e=>e.code==='invalid_existing_admin_token'&&!String(e).includes('bad-secret'));
});
test('public artifact scanning blocks accidental secret copies before owner source is written',async t=>{
  const f=await fixture(t);await fs.mkdir(f.outputDir,{recursive:true});await fs.writeFile(path.join(f.outputDir,'Index.html'),'accidental '+Buffer.alloc(32,1).toString('hex'));
  await assert.rejects(()=>P.prepare(f.options),e=>e.code==='public_secret_detected');await assert.rejects(()=>fs.access(path.join(f.outputDir,'OwnerSetup.gs')));await assert.rejects(()=>fs.access(path.join(f.baseDir,'connection.json')));
});
test('CLI invalid input reports a fixed code without echoing a token or private URL',()=>{
  const secret='sensitive-token-that-must-not-print',run=spawnSync(process.execPath,[require.resolve('../receiver/setup.cjs'),'--endpoint','https://evil.example/'+secret],{encoding:'utf8'});assert.equal(run.status,1);assert(!run.stdout.includes(secret));assert(!run.stderr.includes(secret));assert.equal(JSON.parse(run.stderr).code,'invalid_endpoint');
});
