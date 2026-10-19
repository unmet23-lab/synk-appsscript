'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {parseLedger,audit,readBackupSummary,readPreservationSummary,atomicJson}=require('../tools/보존점검.cjs');
const {spawnSync}=require('node:child_process');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-preservation-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('ledger aliases, siblings, unknown sources and external links stay distinct',t=>{
  const root=fixture(t),ledger=path.join(root,'ledger.md');
  const text='| `[base]` | `docs/art/` |\n| `[nested]` | `[base]shots/` |\n### S01 · image\n- **결과물:** `[nested]one.png`, `two.png`\n- **지시문:** `[gone]prompt.txt`, `short_….txt`\n- **출처:** [remote](https://example.com/reference)\n';
  const parsed=parseLedger(text,{root,ledger});
  assert.equal(parsed.cases.length,1);
  assert.equal(parsed.cases[0].references[0].absolute,path.join(root,'docs/art/shots/one.png'));
  assert.equal(parsed.cases[0].references[1].absolute,path.join(root,'docs/art/shots/two.png'));
  assert.equal(parsed.cases[0].references[2].unresolved,true);
  assert.equal(parsed.cases[0].references[4].external,true);
});
test('local receipts never become current remote proof; detects changed, missing and secret paths',async t=>{
  const root=fixture(t),ledger=path.join(root,'ledger.md'),media=path.join(root,'docs/art');fs.mkdirSync(media,{recursive:true});
  fs.writeFileSync(path.join(media,'one.png'),'approved');fs.writeFileSync(path.join(media,'two.png'),'changed');
  fs.writeFileSync(path.join(media,'auth.json'),'SECRET_MUST_NOT_APPEAR');
  fs.writeFileSync(ledger,'### S01 · approved\n- **결과물:** `docs/art/one.png`, `two.png`, `missing.png`\n- **지시문:** `docs/art/auth.json`\n');
  const manifest=path.join(root,'upload-done.jsonl');
  fs.writeFileSync(manifest,[{path:'docs/art/one.png',bytes:8,sha256:digest('approved'),id:'private-drive-id',ok:true},{path:'docs/art/two.png',bytes:3,sha256:digest('old'),id:'private-drive-id2',ok:true}].map(x=>JSON.stringify(x)).join('\n'));
  const report=await audit({root,ledger,manifestDefinitions:[{file:manifest,base:root,kind:'uploaded'}]});
  assert.equal(report.counts.backupMatched,1);assert.equal(report.counts.backupChanged,1);assert.equal(report.counts.missing,1);
  assert.equal(report.scope.remoteChecked,false);assert.equal(report.scope.deleted,0);
  assert.ok(!JSON.stringify(report).includes('private-drive-id'));assert.ok(!JSON.stringify(report).includes('SECRET_MUST_NOT_APPEAR'));
  assert.equal(fs.readFileSync(path.join(media,'two.png'),'utf8'),'changed');
});
test('hash budget reports deferred work without claiming fingerprint verification',async t=>{
  const root=fixture(t),ledger=path.join(root,'ledger.md');fs.mkdirSync(path.join(root,'docs'));fs.writeFileSync(path.join(root,'docs/large.mp4'),'large');
  fs.writeFileSync(ledger,'### S01 · result\n- **결과물:** `docs/large.mp4`');
  const report=await audit({root,ledger,manifestDefinitions:[],maxHashBytes:0});
  assert.equal(report.counts.hashChecked,0);assert.equal(report.counts.hashDeferred,1);assert.equal(report.cases[0].references[0].file.sha256,undefined);
});
test('backup summaries require explicit root, redact fields and detect stale monitor',t=>{
  const root=fixture(t),now=Date.now();assert.equal(readBackupSummary().source.available,false);
  atomicJson(path.join(root,'backup-monitor.json'),{schemaVersion:1,status:'failed',checkedAt:new Date(now).toISOString(),counts:{failed:1},issues:[{code:'BACKUP_FAILED',label:'SECRET PROVIDER MESSAGE'}],credentials:'SECRET'});
  const view=readBackupSummary({backupRoot:root,now});assert.equal(view.status,'failed');assert.ok(!JSON.stringify(view).includes('SECRET'));
  assert.equal(readBackupSummary({backupRoot:root,now:now+3*3600000}).source.stale,true);
});
test('summary preserves audit limitations and reports preservation gaps',t=>{
  const root=fixture(t),file=path.join(root,'report.json');atomicJson(file,{schemaVersion:1,checkedAt:new Date().toISOString(),counts:{missing:2,hashDeferred:1,backupUnrecorded:3}});
  const view=readPreservationSummary({reportPath:file});assert.equal(view.status,'attention');assert.equal(view.counts.missing,2);assert.ok(view.scope.includes('원격'));assert.equal(view.issues.length,3);
});
test('directory-relative siblings do not become nested under the preceding child',t=>{
  const root=fixture(t),base=path.join(root,'assets');fs.mkdirSync(path.join(base,'v2_raw'),{recursive:true});fs.mkdirSync(path.join(base,'v2_check'));
  const ledger=path.join(root,'ledger.md');
  const parsed=parseLedger('### S21 · reference\n- **결과물:** `'+base.replace(/\\/g,'/')+'/`(`v2_raw/`, `v2_check/`)\n',{root,ledger});
  assert.equal(parsed.cases[0].references[2].absolute,path.join(base,'v2_check'));
});
test('cloud folder contents are not opened for fingerprinting',async t=>{
  const root=fixture(t),cloud=path.join(root,'OneDrive');fs.mkdirSync(cloud);fs.writeFileSync(path.join(cloud,'approved.png'),'cloud-data');
  const ledger=path.join(root,'ledger.md');fs.writeFileSync(ledger,'### S01 · cloud\n- **결과물:** `'+path.join(cloud,'approved.png').replace(/\\/g,'/')+'`');
  const report=await audit({root,ledger,manifestDefinitions:[]});
  assert.equal(report.counts.cloudDeferred,1);assert.equal(report.counts.hashChecked,0);assert.equal(report.cases[0].references[0].file.fingerprint,'cloud_locality_unconfirmed');
});

test('child-directory sheet resolves locally while later directories remain siblings',t=>{
  const root=fixture(t),base=path.join(root,'assets'),out=path.join(base,'conti/out');fs.mkdirSync(out,{recursive:true});
  fs.mkdirSync(path.join(base,'cap540'));fs.mkdirSync(path.join(base,'review'));fs.writeFileSync(path.join(out,'_시트.png'),'sheet');
  const parsed=parseLedger('### S20 · reference\n- **결과물:** `'+base.replace(/\\/g,'/')+'/`(`conti/out/` 장면 PNG·`_시트.png`, `cap540/` 캡처, `review/` 검토)\n',{root,ledger:path.join(root,'ledger.md')});
  const refs=parsed.cases[0].references;
  assert.equal(refs[2].absolute,path.join(out,'_시트.png'));
  assert.equal(refs[3].absolute,path.join(base,'cap540'));assert.equal(refs[4].absolute,path.join(base,'review'));
});

test('unreadable references and folders are not reported as lost originals',async t=>{
  const root=fixture(t),ledger=path.join(root,'ledger.md'),blocked=path.join(root,'docs/blocked.png'),folder=path.join(root,'docs/private');
  fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(ledger,'### S01 · result\n- **결과물:** `docs/blocked.png`, `docs/private/`');
  const originalStat=fs.lstatSync,originalRead=fs.readdirSync;
  t.mock.method(fs,'lstatSync',function(file,...args){if(path.resolve(file)===blocked)throw Object.assign(new Error('private'),{code:'EACCES'});return originalStat.call(fs,file,...args);});
  t.mock.method(fs,'readdirSync',function(file,...args){if(path.resolve(file)===folder)throw Object.assign(new Error('private'),{code:'EACCES'});return originalRead.call(fs,file,...args);});
  const report=await audit({root,ledger,manifestDefinitions:[]});
  assert.equal(report.counts.missing,0);assert.equal(report.counts.unreadable,2);assert.equal(report.cases[0].references[0].status,'unreadable');
  const out=path.join(root,'report.json');atomicJson(out,report);
  assert.ok(readPreservationSummary({reportPath:out}).issues.some(x=>x.code==='PRESERVATION_READ_FAILED'));
});

test('a torn receipt row preserves valid backup evidence and surfaces partial reading',async t=>{
  const root=fixture(t),ledger=path.join(root,'ledger.md'),manifest=path.join(root,'upload-done.jsonl');fs.mkdirSync(path.join(root,'docs'));
  fs.writeFileSync(path.join(root,'docs/one.png'),'approved');fs.writeFileSync(ledger,'### S01 · result\n- **결과물:** `docs/one.png`');
  fs.writeFileSync(manifest,JSON.stringify({path:'docs/one.png',bytes:8,sha256:digest('approved'),id:'private-id',ok:true})+'\n{"path":');
  const report=await audit({root,ledger,manifestDefinitions:[{file:manifest,base:root,kind:'uploaded'}]});
  assert.equal(report.counts.backupMatched,1);assert.equal(report.counts.manifestUnreadable,1);assert.equal(report.manifestSources[0].invalidRows,1);
  assert.ok(!JSON.stringify(report).includes('private-id'));
});

test('an unknown audit lock owner exits unsuccessfully without removing the lock',t=>{
  const root=fixture(t),folder=path.join(root,'docs/마케팅/제작양식'),out=path.join(root,'report.json');fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'만족사례_장부.md'),'### S01 · result\n');fs.writeFileSync(out+'.lock','interrupted-lock-write');
  const result=spawnSync(process.execPath,[path.resolve(__dirname,'../tools/보존점검.cjs'),'--root',root,'--out',out],{encoding:'utf8'});
  assert.equal(result.status,2);assert.equal(JSON.parse(result.stdout).status,'lock_owner_unconfirmed');assert.equal(fs.readFileSync(out+'.lock','utf8'),'interrupted-lock-write');assert.equal(fs.existsSync(out),false);
});
