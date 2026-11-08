'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const b2 = require('../src/b2.cjs');
const { BackupEngine, parseKit, APP, VERIFIED, DAY } = require('../src/engine.cjs');
const { Profiles } = require('../src/profiles.cjs');
const key = { keyId: 'test-key-id-12345', applicationKey: 'TEST-only+fake/key=123456789' };
const vault = '450e7286-744b-4d69-aeef-00c5244f54df';
const provider = b2.provider({ endpoint: 's3.us-east-005.backblazeb2.com', bucket: 'backup-fixture', prefix: `work-backup/${vault}` }, vault);
const encryptionKey = crypto.randomBytes(32);
const secretStore = {
  encrypt(text) { const iv=crypto.randomBytes(12), c=crypto.createCipheriv('aes-256-gcm',encryptionKey,iv); return Buffer.concat([iv,c.update(text),c.final(),c.getAuthTag()]); },
  decrypt(bytes) { const d=crypto.createDecipheriv('aes-256-gcm',encryptionKey,bytes.subarray(0,12)); d.setAuthTag(bytes.subarray(-16)); return Buffer.concat([d.update(bytes.subarray(12,-16)),d.final()]).toString(); }
};
const id = 'a'.repeat(64);
async function fixture(extra = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-cloud-'));
  const source = path.join(root, 'source'), keys = path.join(root, 'keys');
  await fs.mkdir(source); await fs.mkdir(keys); await fs.writeFile(path.join(source,'fixture.txt'),'fixture only');
  const calls = [];
  const engine = new BackupEngine({ stateDir:path.join(root,'state'), resticPath:'fixture', providerType:'b2', secretStore, intervalMs:3600000,
    probe:async()=>({serverTime:Date.now()}), runner:async (args, options)=>{ calls.push({args,options}); if (args[0]==='cat') return JSON.stringify({id}); return ''; }, ...extra });
  await engine.open(); return { engine, root, source, keys, calls };
}
const setup = f => f.engine.setupCloud({sources:[f.source],endpoint:provider.endpoint,bucket:provider.bucket,credentials:key});

test('encrypted operator preset survives restart without exposing keys or starting backup; wrong bucket cannot reuse it', async () => {
  const f = await fixture();
  await f.engine.prepareCloudConnection({endpoint:provider.endpoint,bucket:provider.bucket,credentials:key});
  assert.equal(f.engine.config,null); assert.equal(f.engine.getState().automatic,false);
  const cipher=await fs.readFile(path.join(f.engine.stateDir,'connection.bin'));
  for(const secret of Object.values(key)){assert.ok(!cipher.includes(Buffer.from(secret)));assert.ok(!JSON.stringify(f.engine.getState()).includes(secret));}
  const restart = new BackupEngine({stateDir:f.engine.stateDir,resticPath:'fixture',providerType:'b2',secretStore,runner:f.engine.runner,probe:async()=>({serverTime:Date.now()})});
  await restart.open(); assert.equal(restart.getState().cloudConnection.bucket,provider.bucket);
  await assert.rejects(restart.setupCloud({sources:[f.source],endpoint:provider.endpoint,bucket:'another-bucket',credentials:{}}));
  await restart.setupCloud({sources:[f.source],endpoint:provider.endpoint,bucket:provider.bucket,credentials:{}});
  assert.deepEqual(restart.cloudCredentials,key); assert.equal(restart.config.automatic,false);
});

test('B2 endpoint and recovery-kit validation prevent arbitrary hosts and path substitution',()=>{
  assert.equal(b2.endpoint('s3.us-west-004.backblazeb2.com'), 'https://s3.us-west-004.backblazeb2.com');
  for (const value of ['http://s3.us-east-005.backblazeb2.com','https://evil.example/','https://s3.us-east-005.backblazeb2.com.evil.example','https://user:pass@s3.us-east-005.backblazeb2.com','https://s3.us-east-005.backblazeb2.com:444','https://s3.us-east-005.backblazeb2.com/x/..','https://s3.us-east-005.backblazeb2.com/?key=x','https://s3.us-east-005.backblazeb2.com/#a','https://s3.us-east-005.backblazeb2.com\\evil']) assert.throws(()=>b2.endpoint(value));
  const kit={format:APP,version:2,type:'b2',provider,repository:b2.repository(provider,vault),repositoryId:id,vaultId:vault,password:crypto.randomBytes(32).toString('base64url')};
  assert.equal(parseKit(JSON.stringify(kit)).provider.type,'b2');
  assert.throws(()=>parseKit(JSON.stringify({...kit,repository:'s3:https://evil.example/repo'})));
  assert.throws(()=>parseKit(JSON.stringify({...kit,provider:{...provider,prefix:'other-user'}})));
});

test('interrupted explicit override retries its stored key instead of an older preset',async()=>{
  let fail=true;
  const f=await fixture({runner:async()=>{if(fail)throw new Error('offline fixture');return JSON.stringify({id});}});
  await f.engine.prepareCloudConnection({endpoint:provider.endpoint,bucket:provider.bucket,credentials:key});
  const override={keyId:'override-fixture-key',applicationKey:'override-fixture-secret'};
  await assert.rejects(f.engine.setupCloud({sources:[f.source],endpoint:provider.endpoint,bucket:'override-bucket',credentials:override}),/offline fixture/);
  assert.equal(f.engine.getState().cloudConnection.bucket,'override-bucket');fail=false;
  await f.engine.setupCloud({sources:[f.source],endpoint:provider.endpoint,bucket:'override-bucket',credentials:{}});
  assert.deepEqual(f.engine.cloudCredentials,override);assert.equal(f.engine.config.provider.bucket,'override-bucket');
});
test('restic child environment has explicit keys and excludes ambient credentials and debug sinks',()=>{
  const polluted={SystemRoot:'C:\\Windows',PATH:'safe',RESTIC_PASSWORD_FILE:'bad',RESTIC_REPOSITORY:'bad',RESTIC_DEBUG_LOG:'bad',AWS_PROFILE:'bad',AWS_SHARED_CREDENTIALS_FILE:'bad',AWS_SESSION_TOKEN:'bad',HTTPS_PROXY:'http://evil',B2_ACCOUNT_KEY:'bad'};
  const out=b2.childOptions(provider,key,'C:/state',polluted,'password');
  assert.equal(out.env.AWS_ACCESS_KEY_ID,key.keyId); assert.equal(out.env.AWS_EC2_METADATA_DISABLED,'true');
  for(const name of Object.keys(polluted).filter(n=>!['SystemRoot','PATH'].includes(n))) assert.equal(out.env[name],undefined,name);
  assert.ok(out.args.includes('s3.region=us-east-005')); assert.ok(!out.args.join(' ').includes(key.applicationKey));
  assert.equal(b2.childOptions(null,null,'C:/state',polluted,'password').env.AWS_ACCESS_KEY_ID,undefined);
});

test('HEAD rejects missing/skewed Date, HTTP failure and deadlines; failed clock probe cannot delete',async t=>{
  const now=Date.now();let scenario={code:200,date:new Date(now).toUTCString()};
  t.mock.method(https,'request',(options,callback)=>{
    assert.equal(options.method,'HEAD');assert.equal(options.hostname,'s3.us-east-005.backblazeb2.com');assert.equal(options.path,'/backup-fixture');assert.ok(!options.headers.authorization.includes(key.applicationKey));
    const request=new EventEmitter();request.destroy=()=>{request.emit('error',new Error('fixture'));request.emit('close');};
    request.end=()=>{if(scenario.silent)return;if(scenario.timeout){request.emit('timeout');return;}callback({statusCode:scenario.code,headers:{date:scenario.date},resume(){}});request.emit('close');};return request;
  });
  assert.ok(Math.abs((await b2.probeBucket(provider,key,{now})).serverTime-now)<1000);
  for(const s of [{code:200},{code:200,date:new Date(now+6*60000).toUTCString()},{code:200,date:new Date(now-6*60000).toUTCString()},{code:403},{code:404},{timeout:true}]){scenario=s;await assert.rejects(b2.probeBucket(provider,key,{now}));}
  t.mock.timers.enable({apis:['setTimeout']});scenario={silent:true};const deadline=b2.probeBucket(provider,key,{now});const rejected=assert.rejects(deadline,/연결하지 못했습니다/);t.mock.timers.tick(25001);await rejected;t.mock.timers.reset();
  const f=await fixture();await setup(f);f.engine.config.health={status:'ok',checkedAt:new Date(now).toISOString()};f.engine.probe=async()=>{throw new Error('clock skew fixture');};await assert.rejects(f.engine.retain(),/clock skew/);assert.ok(!f.calls.some(c=>['forget','prune'].includes(c.args[0])));
});
test('interrupted init retries same prefix and encryption password, persists no plaintext cloud key',async()=>{
  let initialized=false, first=true;
  const f=await fixture({runner:async args=>{ if(args[0]==='cat'){ if(!initialized){const e=new Error('missing');e.exitCode=10;throw e;}return JSON.stringify({id}); } if(args[0]==='init'){ initialized=true; if(first){first=false;throw new Error('network interrupted');} } return ''; }});
  await assert.rejects(setup(f),/interrupted/); const repository=f.engine.config.repository, password=f.engine.secret;
  assert.equal(f.engine.config.repositoryId,null);
  await setup(f); assert.equal(f.engine.config.repository,repository); assert.equal(f.engine.secret,password);
  const settings=await fs.readFile(path.join(f.engine.stateDir,'settings.json'),'utf8');
  const credential=await fs.readFile(path.join(f.engine.stateDir,'credential.bin'));
  for(const secret of [password,key.keyId,key.applicationKey]) {assert.ok(!settings.includes(secret)); assert.ok(!credential.includes(Buffer.from(secret))); assert.ok(!JSON.stringify(f.engine.getState()).includes(secret));}
  await f.engine.saveRecoveryKit(path.join(f.keys,'kit.json'));
  const kit=JSON.parse(await fs.readFile(path.join(f.keys,'kit.json'),'utf8'));
  assert.equal(kit.password,password); assert.equal(kit.type,'b2'); assert.ok(!JSON.stringify(kit).includes(key.applicationKey));
  const restart=new BackupEngine({stateDir:f.engine.stateDir,resticPath:'fixture',providerType:'b2',secretStore,runner:f.engine.runner});
  await restart.open(); assert.equal(restart.secret,password); assert.deepEqual(restart.cloudCredentials,key);
});
test('denied/offline config reads never init, and failed credentials never replace existing key',async()=>{
  const f=await fixture(); await setup(f);
  const before=await fs.readFile(path.join(f.engine.stateDir,'credential.bin'));
  const calls=[];
  f.engine.runner=async(args)=>{calls.push(args); const e=new Error(`AccessDenied ${key.applicationKey} ${encodeURIComponent(key.applicationKey)}`);e.exitCode=1;throw e;};
  await assert.rejects(f.engine.updateCloudCredentials(key), e=>!e.message.includes(key.applicationKey)&&!e.message.includes(encodeURIComponent(key.applicationKey)));
  assert.deepEqual(await fs.readFile(path.join(f.engine.stateDir,'credential.bin')),before);
  assert.ok(!calls.some(a=>a[0]==='init'));
  const g=await fixture({runner:f.engine.runner}); await assert.rejects(setup(g),/AccessDenied/);
  assert.ok(!calls.some(a=>a[0]==='init')); assert.equal(g.engine.config.repositoryId,null);
});
test('fresh cloud import validates identity and is restore-only; wrong key emits no secret',async()=>{
  const f=await fixture(); await setup(f); await f.engine.saveRecoveryKit(path.join(f.keys,'kit.json'));
  const text=await fs.readFile(path.join(f.keys,'kit.json'),'utf8'), kit=JSON.parse(text);
  const g=await fixture({runner:async args=>args[0]==='cat'?JSON.stringify({id}):JSON.stringify([{id:'b'.repeat(64),time:new Date().toISOString(),tags:[APP,`vault:${kit.vaultId}`,VERIFIED]}])});
  await g.engine.importRecoveryKit({text,credentials:key});
  assert.equal(g.engine.config.mode,'restore'); g.engine.config.recoverySaved=true; await assert.rejects(g.engine.setAutomatic(true), /자동 백업을 설정할 수 없습니다/); g.engine.config.health={status:'ok',checkedAt:new Date().toISOString()}; await assert.rejects(g.engine.retain(), /이 저장소는 정리할 수 없습니다/);
  const h=await fixture({runner:async()=>JSON.stringify({id:'c'.repeat(64)})});
  await assert.rejects(h.engine.importRecoveryKit({text,credentials:key}),/다릅니다/); assert.equal(h.engine.config,null);
});
test('cloud full-check age and server clock gate retention; repacking disabled to bound downloads',async()=>{
  const now=Date.now(); const f=await fixture({now:()=>now,probe:async()=>({serverTime:now})}); await setup(f);
  f.engine.config.lastBackup={id:'d'.repeat(64),at:new Date(now).toISOString()};
  f.engine.config.health={status:'ok',checkedAt:new Date(now-31*DAY).toISOString()};
  await assert.rejects(f.engine.retain(),/점검/);
  f.engine.config.health.checkedAt=new Date(now-1000).toISOString();
  f.engine.snapshots=async()=>[{id:'d'.repeat(64),time:new Date(now).toISOString(),tags:[VERIFIED],hostname:f.engine.config.vaultId},{id:'e'.repeat(64),time:new Date(now-2*DAY).toISOString(),tags:[VERIFIED],hostname:f.engine.config.vaultId}];
  await f.engine.retain();
  assert.deepEqual(f.calls.find(c=>c.args[0]==='prune').args,['prune','--max-repack-size','0']);
  assert.ok(!f.calls.some(c=>c.args[0]==='forget'&&c.args.includes('d'.repeat(64))));
});
test('two profiles retain independent state and a running cloud job does not starve local scheduling',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'solo-profiles-'));
  const p=new Profiles({root,resticPath:'fixture',secretStore,runner:async()=>''}); await p.open();
  assert.notEqual(p.engines.local.stateDir,p.engines.b2.stateDir);
  p.selections.local.sources=['C:/local-source']; p.select('b2'); assert.deepEqual(p.selection.sources,[]);
  let local=0,cloud=0; p.engines.local.tick=async()=>{local++;};p.engines.b2.tick=async()=>{cloud++;};
  p.engines.b2.job={kind:'backup'}; p.tick(); assert.equal(local,1);assert.equal(cloud,1);
  p.engines.b2.job=null;
  p.engines.local.config={sources:['C:/work'],repository:'C:/backups'}; p.boundaries();
  assert.ok(p.engines.b2.forbiddenPaths.includes('C:/backups'));
  assert.throws(()=>p.assertOutput('C:/work/restore'));
});
