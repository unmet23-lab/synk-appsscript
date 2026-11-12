'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {Readable}=require('node:stream');
const {RecommendedBackup,RecommendedEngine,approval,estimate,candidates,exclusionPattern,native}=require('../src/recommended.cjs');
const {BackupEngine}=require('../src/engine.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('cost approval binds scope, price and storage cap; incomplete scans never upload',()=>{
 const plan={hash:'a',complete:true,bytes:1e9,sources:['C:\\work'],exclusions:[]};
 const input={planHash:'a',destination:'b2',maxBytes:2e9,monthlyUSD:1};const a=approval(plan,input);
 assert.notEqual(a.hash,approval(plan,{...input,maxBytes:3e9}).hash);assert.throws(()=>approval({...plan,complete:false},input));assert.throws(()=>approval(plan,{...input,planHash:'stale'}));assert.throws(()=>approval(plan,{...input,maxBytes:1}));assert.ok(estimate(1e12).month12USD>estimate(1e12).month1USD);
});
test('recommendations remove overlap and visibly exclude sensitive/manual/cache paths',{skip:process.platform!=='win32'&&'Windows 경로 규칙을 보는 시험 — GitHub Windows에서 돈다(tools/conditional-qa)'},()=>{
 const rows=[['C:\\work','irreplaceable'],['C:\\work\\sub','ai_settings'],['C:\\work\\secrets','credential_location'],['C:\\manual','external_manual']];
 const p=candidates({scan_complete:false,candidates:rows.map(([raw,category])=>({path:{raw},category,state:'present'}))},['C:\\state']);
 assert.deepEqual(p.sources,['C:\\work']);assert.ok(p.exclusions.includes('C:\\work\\secrets'));assert.equal(p.discoveryComplete,false);assert.deepEqual(p.manual,['C:\\manual']);
});
test('no destructive commands are reachable in the recommendation engine',async()=>{
 const e=new RecommendedEngine({stateDir:os.tmpdir(),secretStore:{},runner:()=>{throw Error('must not run');}});
 for(const cmd of ['forget','prune','unlock'])await assert.rejects(e.run([cmd]),/삭제/);
 assert.equal(exclusionPattern('C:\\work\\[keep]'),'C:/work/[[]keep]');assert.throws(()=>exclusionPattern('C:\\bad\nname'));
});
test('changed exclusions, partial scans and growth stop the schedule',()=>{
 const m=new RecommendedBackup({root:os.tmpdir()});const permit={sources:['C:\\work'],exclusions:[],sourceBytes:100,maxBytes:200,growth:1.2};const fresh={complete:true,errors:[],sources:permit.sources,exclusions:[],bytes:100};
 assert.doesNotThrow(()=>m.checkFresh(fresh,permit));assert.throws(()=>m.checkFresh({...fresh,bytes:150},permit));assert.throws(()=>m.checkFresh({...fresh,exclusions:[{path:'new',reason:'reparse'}]},permit));assert.throws(()=>m.checkFresh({...fresh,errors:['unreadable']},permit));
});
test('deferred cloud expansion never starts a provider operation',async()=>{
 const e=new RecommendedEngine({stateDir:os.tmpdir(),secretStore:{},providerType:'b2',runner:()=>assert.fail('provider must not run')});
 await assert.rejects(e.initialize({}),/클라우드 확장은 보류/);await assert.rejects(e.backupPlan({},{}),/클라우드 확장은 보류/);
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'recommend-deferred-'));let scanned=false;
 const m=new RecommendedBackup({root,scan:()=>{scanned=true;assert.fail('no scan before rejection');}});m.preview={hash:'p',complete:true,bytes:1,sources:['C:\\work'],exclusions:[]};
 await assert.rejects(m.start({planHash:'p',destination:'b2',maxBytes:1e9,monthlyUSD:1}),/클라우드 확장은 보류/);assert.equal(scanned,false);assert.equal(m.state().cloudReady,false);assert.equal(m.state().cloudDeferred,true);await assert.rejects(fs.access(path.join(root,'plan.json')));
});
test('exclusive operation lock never removes an existing owner lock',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'recommend-lock-'));await fs.writeFile(path.join(root,'operation.lock'),'owner');const m=new RecommendedBackup({root});await assert.rejects(m.operation(()=>assert.fail('must not execute')),/잠금/);assert.equal(await fs.readFile(path.join(root,'operation.lock'),'utf8'),'owner');
});
test('dead operation lock is preserved and a new process can continue',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'recommend-dead-lock-'));await fs.writeFile(path.join(root,'operation.lock'),JSON.stringify({pid:2147483647,at:'2000-01-01'}));const m=new RecommendedBackup({root});assert.equal(await m.operation(async()=>42),42);assert.ok((await fs.readdir(root)).some(x=>x.startsWith('stale-operation-')));
});
test('native UTF-8 output survives split multibyte boundaries',async()=>{
 const value='한글 경로 👩‍💻'.repeat(10000);const out=await native(process.execPath,['-e',"const b=Buffer.from('한글 경로 👩‍💻'.repeat(10000));for(let i=0;i<b.length;i+=65537)process.stdout.write(b.subarray(i,i+65537));"]);assert.equal(out,value);
});
test('native plan -> append-only backup -> fresh independent restore, original and earlier snapshots retained',{skip:!process.env.SWB_RECOMMENDED_RESTIC,timeout:240000},async()=>{
 const root=await fs.mkdtemp(path.join(process.env.SWB_TEST_TMPDIR||os.tmpdir(),'recommend-native-'));
 for(const d of ['source','store','state','fresh','keys','restores'])await fs.mkdir(path.join(root,d));
 const originals={'한글.md':Buffer.from('# 업무 자료\nAI instructions'),'settings.json':Buffer.from('{"theme":"light"}'),'model.safetensors':crypto.randomBytes(2048)};
 for(const [n,b]of Object.entries(originals))await fs.writeFile(path.join(root,'source',n),b);
 await fs.mkdir(path.join(root,'source','node_modules'));await fs.writeFile(path.join(root,'source','package.json'),'{}');await fs.writeFile(path.join(root,'source','node_modules','skip.txt'),'regenerable');
 await fs.writeFile(path.join(root,'single.md'),'single file');
 await fs.writeFile(path.join(root,'source','[private].txt'),'must remain excluded');
 const request={sources:[path.join(root,'source'),path.join(root,'single.md')],exclusions:[path.join(root,'source','[private].txt').toUpperCase()],manual:['C:\\manual-export'],discoveryComplete:false};
 // Synthetic test-only key wrapper. Production uses native DPAPI.
 const secretStore={encrypt:async x=>Buffer.from(x),decrypt:async x=>x.toString()};
 const m=new RecommendedBackup({root:path.join(root,'state'),resticPath:process.env.SWB_RECOMMENDED_RESTIC,plannerPath:process.env.SWB_RECOMMENDED_PLANNER,secretStore,registerStartup:async()=>false});await m.open();const plan=await m.previewRequest(request);assert.equal(plan.complete,true);assert.ok(plan.exclusions.some(x=>x.reason==='node_modules_with_package_json'));
 await m.start({planHash:plan.hash,destination:'local',maxBytes:1e9,monthlyUSD:1},{parent:path.join(root,'store'),keyFile:path.join(root,'keys','kit.json')});const e=m.engine,first=e.config.lastBackup.id;await m.backup();assert.equal((await e.snapshots()).length,2);assert.ok((await e.snapshots()).some(x=>x.id===first));
 const fresh=new BackupEngine({stateDir:path.join(root,'fresh'),resticPath:process.env.SWB_RECOMMENDED_RESTIC,secretStore});await fresh.open();await fresh.importRecoveryKit({text:await fs.readFile(path.join(root,'keys','kit.json'),'utf8'),repository:e.config.repository});fresh.config.readOnly=true;await fresh.save();
 const result=(await fresh.restoreLatest({parent:path.join(root,'restores')})).lastRestore;assert.equal(result.files,5);
 const restored=path.join(result.path,...path.join(root,'source').replace(':','').split(path.sep));
 for(const [n,b]of Object.entries(originals)){assert.equal(sha(await fs.readFile(path.join(root,'source',n))),sha(b));assert.equal(sha(await fs.readFile(path.join(restored,n))),sha(b));}
 await assert.rejects(fs.access(path.join(restored,'node_modules','skip.txt')));
 await assert.rejects(fs.access(path.join(restored,'[private].txt')));
 assert.equal((await e.snapshots()).length,2);await m.stop();await fresh.stop();
});
