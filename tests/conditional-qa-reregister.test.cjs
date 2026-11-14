'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const { reregisterInputs, parse } = require('../tools/conditional-qa/reregister.cjs');
const { write, read, materialize } = require('../tools/conditional-qa/inputs.cjs');
const { acquire } = require('../tools/conditional-qa/worker.cjs');
const { REPO } = require('../tools/conditional-qa/github.cjs');
const { sha256 } = require('../tools/conditional-qa/contract.cjs');

// 11-06 6051236295 repackaged four git-ignored PATH films and the tracked manifest followed; the worker kept the 11-01 bytes and every later commit failed S063-S067.
const FILM = 'experiences/path-vr/assets/interview/film/strict-question-720p.mp4';
function fixture(t) {
  const tmp = fs.realpathSync.native(os.tmpdir()), dir = fs.mkdtempSync(path.join(tmp, 'synk-qa-reregister-'));
  t.after(() => { const real = fs.realpathSync.native(dir); assert.ok(real.startsWith(tmp + path.sep) && path.basename(real).startsWith('synk-qa-reregister-')); fs.rmSync(real, { recursive: true, force: true }); });
  const source = path.join(dir, 'source'), state = path.join(dir, 'state');
  const put = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
  put(path.join(source, '.gitignore'), '*.mp4\n'); put(path.join(source, 'tracked.json'), '{}\n');
  const old = Buffer.from('film packed on 11-01'), current = Buffer.from('film repacked on 11-06');
  put(path.join(source, FILM), current);
  const run = args => cp.execFileSync('git', args, { cwd: source, windowsHide: true, stdio: 'ignore' });
  run(['init', '-q']); run(['add', '.gitignore', 'tracked.json']);
  write(path.join(state, 'owner.json'), { version: 1, purpose: 'synk-conditional-qa', state });
  write(path.join(state, 'config.json'), { version: 1, repo: REPO, state, sourceRepo: source, root: path.join(state, 'workspace/SYNK-appsscript') });
  put(path.join(state, 'blobs', sha256(old)), old);
  const rows = [{ area: 'app', file: FILM, sha256: sha256(old), bytes: old.length, source: path.join(source, FILM) },
    { area: 'app', file: 'tracked.json', sha256: sha256('{}\n'), bytes: 3, source: path.join(source, 'tracked.json') }];
  put(path.join(state, 'blobs', rows[1].sha256), '{}\n');
  write(path.join(state, 'inputs.json'), { version: 1, frozenCommit: 'f'.repeat(40), files: rows });
  return { dir, source, state, old, current, inputs: path.join(state, 'inputs.json'), options: { state, files: [FILM], reason: 'shared copy repackaged the film and the tracked manifest followed', now: 1000 } };
}
function shortPath(name) {
  // Read existing aliases only; never enable 8.3 names or change the volume.
  const script='Add-Type -TypeDefinition \'using System; using System.Text; using System.Runtime.InteropServices; public static class ShortPathProbe { [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern uint GetShortPathName(string path, StringBuilder output, uint length); }\'; $b=New-Object System.Text.StringBuilder 32768; if([ShortPathProbe]::GetShortPathName($env:SYNK_QA_SHORT_PATH,$b,32768) -eq 0){throw "GetShortPathName failed"}; $b.ToString()';
  return cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,env:{...process.env,SYNK_QA_SHORT_PATH:name}}).trim();
}
test('a preview changes nothing; applying pins the shared copy bytes and keeps the old version', t => {
  const f = fixture(t), before = fs.readFileSync(f.inputs);
  const preview = reregisterInputs(f.options);
  assert.equal(preview.applied, false);
  assert.deepEqual(preview.files, [{ file: FILM, from: sha256(f.old), to: sha256(f.current), bytes: f.current.length, unchanged: false }]);
  assert.deepEqual(fs.readFileSync(f.inputs), before);
  assert.equal(fs.existsSync(path.join(f.state, 'blobs', sha256(f.current))), false);
  assert.equal(fs.existsSync(path.join(f.state, 'input-history')), false);
  const result = reregisterInputs({ ...f.options, apply: true }), row = read(f.inputs).files[0];
  assert.equal(row.sha256, sha256(f.current)); assert.equal(row.bytes, f.current.length);
  assert.deepEqual(row.replaced.map(old => [old.sha256, old.bytes, old.request]), [[sha256(f.old), f.old.length, result.id]]);
  assert.deepEqual(fs.readFileSync(path.join(f.state, 'blobs', sha256(f.current))), f.current);
  assert.deepEqual(fs.readFileSync(path.join(f.state, 'blobs', sha256(f.old))), f.old);
  const ledger = read(path.join(f.state, 'input-history', `${result.id}.json`));
  assert.equal(ledger.state, 'applied'); assert.equal(ledger.inputsAfterSha256, sha256(fs.readFileSync(f.inputs)));
  assert.equal(fs.existsSync(path.join(f.state, 'worker.lock')), false);
  // Running it again finds nothing to move.
  assert.equal(reregisterInputs({ ...f.options, apply: true }).files[0].unchanged, true);
  assert.equal(read(f.inputs).files[0].replaced.length, 1);
});
test('a checkout holding a replaced version gets the new bytes; unknown bytes are still refused', t => {
  const f = fixture(t); reregisterInputs({ ...f.options, apply: true });
  const rows = read(f.inputs).files.filter(row => row.file === FILM), target = path.join(f.dir, 'checkout'), film = path.join(target, FILM);
  fs.mkdirSync(path.dirname(film), { recursive: true }); fs.writeFileSync(film, f.old);
  assert.deepEqual(materialize(f.state, rows, target), [{ file: film, sha256: sha256(f.current) }]);
  assert.deepEqual(fs.readFileSync(film), f.current);
  assert.equal(fs.existsSync(film + '.cqa-new'), false);
  fs.writeFileSync(film, 'edited by a test');
  assert.throws(() => materialize(f.state, rows, target), /Existing fixture changed/);
  assert.deepEqual(fs.readFileSync(film), Buffer.from('edited by a test'));
});
test('a live worker, tracked source, an unregistered file or a bad request leaves the list alone', t => {
  const f = fixture(t), before = fs.readFileSync(f.inputs), unlock = acquire(f.state);
  try { assert.throws(() => reregisterInputs({ ...f.options, apply: true }), /already running/); } finally { unlock(); }
  assert.throws(() => reregisterInputs({ ...f.options, files: ['tracked.json'], apply: true }), /Tracked source is never pinned/);
  assert.throws(() => reregisterInputs({ ...f.options, files: ['experiences/path-vr/assets/new.mp4'], apply: true }), /Not a single registered app input/);
  assert.throws(() => reregisterInputs({ ...f.options, files: ['../escape.mp4'], apply: true }), /Invalid/);
  assert.throws(() => reregisterInputs({ ...f.options, files: [FILM, FILM] }), /distinct/);
  assert.throws(() => reregisterInputs({ ...f.options, reason: ' ' }), /reason is required/);
  assert.deepEqual(fs.readFileSync(f.inputs), before);
  assert.equal(fs.existsSync(path.join(f.state, 'blobs', sha256(f.current))), false);
  assert.equal(fs.existsSync(path.join(f.state, 'worker.lock')), false);
});
test('the command line names files, the state and the reason; an unknown flag is refused', () => {
  assert.deepEqual(parse(['--state', 'S', '--reason', 'why', 'a\\b.mp4', '--apply']), { files: ['a/b.mp4'], state: 'S', reason: 'why', apply: true });
  assert.throws(() => parse(['--reason']), /Missing value/);
  assert.throws(() => parse(['--force', 'a.mp4']), /Unknown option/);
  assert.equal(parse(['--add','a.mp4']).add,true);
});

test('explicit additions preserve all old inputs, pin new bytes and materialize them in an independent checkout', t => {
  const f=fixture(t),file='new-photo.webp',bytes=Buffer.from('new public casting photo'),before=read(f.inputs);
  fs.writeFileSync(path.join(f.source,file),bytes);
  const options={...f.options,files:[file],add:true};
  assert.equal(reregisterInputs(options).files[0].from,null);
  assert.deepEqual(read(f.inputs),before,'preview does not change the registry');
  const result=reregisterInputs({...options,apply:true}),after=read(f.inputs);
  assert.deepEqual(after.files.slice(0,-1),before.files,'the existing preserved fixtures remain intact');
  assert.equal(after.files.at(-1).sha256,sha256(bytes));
  assert.equal(read(path.join(f.state,'input-history',result.id+'.json')).add,true);
  const checkout=path.join(f.dir,'new-checkout');
  materialize(f.state,[after.files.at(-1)],checkout);
  assert.deepEqual(fs.readFileSync(path.join(checkout,file)),bytes);
  assert.throws(()=>reregisterInputs({...options,apply:true}),/already registered/);
  assert.throws(()=>reregisterInputs({...options,files:['.gitignore'],apply:true}),/Tracked source/);
  const unchanged=fs.readFileSync(f.inputs);
  assert.throws(()=>reregisterInputs({...options,files:['missing.webp'],apply:true}),/ENOENT/);
  assert.deepEqual(fs.readFileSync(f.inputs),unchanged);
  const outside=path.join(f.dir,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'private.webp'),'outside');
  fs.symlinkSync(outside,path.join(f.source,'linked'),'junction');
  assert.throws(()=>reregisterInputs({...options,files:['linked/private.webp'],apply:true}),/inside the source repository/);
  assert.deepEqual(fs.readFileSync(f.inputs),unchanged,'resolved paths cannot escape through a directory link');
});

test('tracked file aliases inside the source root are refused before adding blobs or history', t => {
  const f=fixture(t),inside=path.join(f.source,'inside');fs.mkdirSync(inside);fs.writeFileSync(path.join(inside,'tracked.webp'),'tracked fixture');
  cp.execFileSync('git',['add','inside/tracked.webp'],{cwd:f.source,windowsHide:true,stdio:'ignore'});
  fs.symlinkSync(inside,path.join(f.source,'alias'),'junction');
  const before=fs.readFileSync(f.inputs),blobs=fs.readdirSync(path.join(f.state,'blobs'));
  assert.throws(()=>reregisterInputs({...f.options,files:['alias/tracked.webp'],add:true,apply:true}),/Tracked source/);
  assert.deepEqual(fs.readFileSync(f.inputs),before);assert.deepEqual(fs.readdirSync(path.join(f.state,'blobs')),blobs);
  assert.equal(fs.existsSync(path.join(f.state,'input-history')),false);
});

test('case or directory aliases cannot register one source twice, including in the same request', t => {
  const f=fixture(t),folder=path.join(f.source,'photos');fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'new-photo.webp'),'first bytes');
  fs.symlinkSync(folder,path.join(f.source,'photos-alias'),'junction');
  const file='photos/new-photo.webp',alias=process.platform==='win32'?'photos/new-photo.WEBP':'photos-alias/new-photo.webp';
  const options={...f.options,files:[file],add:true,apply:true};
  assert.throws(()=>reregisterInputs({...options,files:[file,alias]}),/distinct|already registered|canonical/);
  reregisterInputs(options);fs.writeFileSync(path.join(folder,'new-photo.webp'),'rebuilt bytes');
  const before=fs.readFileSync(f.inputs),blobs=fs.readdirSync(path.join(f.state,'blobs'));
  assert.throws(()=>reregisterInputs({...options,files:[alias]}),/already registered|canonical/);
  assert.throws(()=>reregisterInputs({...options,files:['photos-alias/new-photo.webp']}),/already registered|canonical/);
  assert.deepEqual(fs.readFileSync(f.inputs),before);assert.deepEqual(fs.readdirSync(path.join(f.state,'blobs')),blobs);
});

test('new inputs require the exact canonical relative name before any persistent changes', t => {
  const f=fixture(t),folder=path.join(f.source,'Photos');fs.mkdirSync(folder);
  const file='Photos/new-photo.webp',bytes=Buffer.from('public fixture');fs.writeFileSync(path.join(f.source,file),bytes);
  fs.symlinkSync(folder,path.join(f.source,'photo-link'),'junction');
  const aliases=['photo-link/new-photo.webp',...(process.platform==='win32'?['photos/new-photo.webp','Photos/NEW-PHOTO.WEBP']:[])];
  const before=fs.readFileSync(f.inputs),blobs=fs.readdirSync(path.join(f.state,'blobs'));
  for(const alias of aliases)for(const apply of [false,true]){
    assert.throws(()=>reregisterInputs({...f.options,files:[alias],add:true,apply}),/canonical relative path/);
    assert.deepEqual(fs.readFileSync(f.inputs),before);assert.deepEqual(fs.readdirSync(path.join(f.state,'blobs')),blobs);
    assert.equal(fs.existsSync(path.join(f.state,'input-history')),false);assert.equal(fs.existsSync(path.join(f.state,'worker.lock')),false);
  }
  reregisterInputs({...f.options,files:[file],add:true,apply:true});
  const row=read(f.inputs).files.at(-1),checkout=path.join(f.dir,'canonical-checkout');
  assert.equal(row.file,file);materialize(f.state,[row],checkout);
  assert.deepEqual(fs.readdirSync(checkout),['Photos']);assert.deepEqual(fs.readdirSync(path.join(checkout,'Photos')),['new-photo.webp']);
  assert.deepEqual(fs.readFileSync(path.join(checkout,file)),bytes);
});

test('native canonical paths preserve link behavior and reject Windows short-name aliases', t => {
  const f=fixture(t),folder=path.join(f.source,'long-source-directory');fs.mkdirSync(folder);
  const tracked='long-source-directory/tracked-photo-with-long-name.webp',file='long-source-directory/new-photo-with-long-name.webp';
  fs.writeFileSync(path.join(f.source,tracked),'tracked fixture');fs.writeFileSync(path.join(f.source,file),'first input bytes');
  cp.execFileSync('git',['add','--',tracked],{cwd:f.source,windowsHide:true,stdio:'ignore'});
  fs.symlinkSync(folder,path.join(f.source,'linked'),'junction');
  for(const name of [f.source,folder,path.join(f.source,'linked')])assert.equal(fs.realpathSync.native(name),fs.realpathSync(name));
  if(process.platform!=='win32'){
    assert.throws(()=>reregisterInputs({...f.options,files:['linked/'+path.basename(tracked)],add:true,apply:true}),/Tracked source/);
    return;
  }
  const trackedAlias='long-source-directory/'+path.basename(shortPath(path.join(f.source,tracked)));
  const alias='long-source-directory/'+path.basename(shortPath(path.join(f.source,file)));
  if(alias.toLowerCase()===file.toLowerCase()||trackedAlias.toLowerCase()===tracked.toLowerCase()){
    t.diagnostic('This volume has no 8.3 aliases; native link equivalence was checked.');return;
  }
  const before=fs.readFileSync(f.inputs),blobs=fs.readdirSync(path.join(f.state,'blobs'));
  assert.throws(()=>reregisterInputs({...f.options,files:[trackedAlias],add:true,apply:true}),/Tracked source/);
  assert.deepEqual(fs.readFileSync(f.inputs),before);assert.deepEqual(fs.readdirSync(path.join(f.state,'blobs')),blobs);
  assert.equal(fs.existsSync(path.join(f.state,'input-history')),false);
  const directoryAlias=path.basename(shortPath(folder))+'/'+path.basename(file);
  for(const name of [alias,directoryAlias])for(const apply of [false,true]){
    assert.throws(()=>reregisterInputs({...f.options,files:[name],add:true,apply}),/canonical relative path/);
    assert.deepEqual(fs.readFileSync(f.inputs),before);assert.deepEqual(fs.readdirSync(path.join(f.state,'blobs')),blobs);
    assert.equal(fs.existsSync(path.join(f.state,'input-history')),false);
  }
  const configFile=path.join(f.state,'config.json'),config=read(configFile);config.sourceRepo=shortPath(f.source);write(configFile,config);
  const options={...f.options,files:[file],add:true,apply:true};
  assert.throws(()=>reregisterInputs({...options,files:[file,alias]}),/distinct|canonical/);
  reregisterInputs(options);
  const row=read(f.inputs).files.at(-1),checkout=path.join(f.dir,'short-root-checkout');materialize(f.state,[row],checkout);
  assert.equal(row.file,file);assert.deepEqual(fs.readdirSync(path.join(checkout,'long-source-directory')),[path.basename(file)]);
  assert.equal(fs.readFileSync(path.join(checkout,file),'utf8'),'first input bytes');
  fs.writeFileSync(path.join(f.source,file),'rebuilt input bytes');
  const registered=fs.readFileSync(f.inputs),registeredBlobs=fs.readdirSync(path.join(f.state,'blobs'));
  assert.throws(()=>reregisterInputs({...options,files:[file]}),/already registered/);
  assert.deepEqual(fs.readFileSync(f.inputs),registered);assert.deepEqual(fs.readdirSync(path.join(f.state,'blobs')),registeredBlobs);
  t.diagnostic('Actual 8.3 file and directory aliases rejected; canonical names materialized from a short source root.');
});

test('legacy alias rows remain unchanged until explicit re-registration and still block canonical additions', t => {
  const f=fixture(t),folder=path.join(f.source,'photos');fs.mkdirSync(folder);
  const file='photos/legacy.webp',alias='legacy-link/legacy.webp',bytes=Buffer.from('legacy input');fs.writeFileSync(path.join(f.source,file),bytes);
  fs.symlinkSync(folder,path.join(f.source,'legacy-link'),'junction');
  const manifest=read(f.inputs),row={area:'app',file:alias,sha256:sha256(bytes),bytes:bytes.length,source:path.join(f.source,alias)};
  manifest.files.push(row);write(f.inputs,manifest);fs.writeFileSync(path.join(f.state,'blobs',row.sha256),bytes);
  const before=fs.readFileSync(f.inputs),blobs=fs.readdirSync(path.join(f.state,'blobs'));
  for(const apply of [false,true])assert.throws(()=>reregisterInputs({...f.options,files:[file],add:true,apply}),/already registered/);
  assert.deepEqual(fs.readFileSync(f.inputs),before);assert.deepEqual(fs.readdirSync(path.join(f.state,'blobs')),blobs);
  assert.equal(fs.existsSync(path.join(f.state,'input-history')),false);
  fs.writeFileSync(path.join(f.source,file),'explicit legacy update');
  reregisterInputs({...f.options,files:[alias],apply:true});
  const after=read(f.inputs);assert.deepEqual(after.files.slice(0,-1),manifest.files.slice(0,-1));
  assert.equal(after.files.at(-1).file,alias);assert.equal(after.files.at(-1).replaced[0].sha256,row.sha256);
  assert.deepEqual(fs.readFileSync(path.join(f.state,'blobs',row.sha256)),bytes);
});

test('canonical fixtures and cleanup work under a child temporary root, including Windows short paths', t => {
  const f=fixture(t),tmp=path.join(f.dir,'long-child-temporary-directory');fs.mkdirSync(tmp);
  const alias=process.platform==='win32'?shortPath(tmp):tmp,env={...process.env,TEMP:alias,TMP:alias,TMPDIR:alias};
  // A fresh test runner needs TAP stdout, not its parent's internal IPC reporter.
  delete env.NODE_TEST_CONTEXT;
  const child=cp.spawnSync(process.execPath,['--test','--test-timeout=120000','--test-reporter=tap','--test-name-pattern=^(new inputs require|native canonical paths)',__filename],{encoding:'utf8',windowsHide:true,timeout:120000,env});
  assert.equal(child.status,0,child.stdout+'\n'+child.stderr);assert.match(child.stdout,/# pass 2\b/);
  if(process.platform==='win32'&&alias.toLowerCase()!==tmp.toLowerCase())assert.match(child.stdout,/Actual 8\.3 file and directory aliases rejected/);
  assert.deepEqual(fs.readdirSync(tmp),[],'child after hooks remove all canonical fixture directories');
});

test('interrupted additions recover the prepared receipt after the registry write without adding a duplicate', t => {
  const f=fixture(t),file='recover-photo.webp',bytes=Buffer.from('recoverable synthetic input');fs.writeFileSync(path.join(f.source,file),bytes);
  const options={...f.options,files:[file],add:true,apply:true},rename=fs.renameSync;
  const interrupted=t.mock.method(fs,'renameSync',(from,to)=>{const value=rename(from,to);if(to===f.inputs)throw Error('synthetic interruption after registry write');return value;});
  assert.throws(()=>reregisterInputs(options),/synthetic interruption/);interrupted.mock.restore();
  const before=fs.readFileSync(f.inputs),history=fs.readdirSync(path.join(f.state,'input-history'));
  assert.equal(history.length,1);const receipt=path.join(f.state,'input-history',history[0]);assert.equal(read(receipt).state,'prepared');
  assert.throws(()=>reregisterInputs({...options,reason:'different request'}),/already registered/);
  const prepared=fs.readFileSync(receipt),preview=reregisterInputs({...options,apply:false});
  assert.equal(preview.recoveryPending,true);assert.deepEqual(fs.readFileSync(receipt),prepared,'recovery preview never completes a receipt');
  const blob=path.join(f.state,'blobs',sha256(bytes));fs.writeFileSync(blob,'corrupt synthetic blob');
  assert.throws(()=>reregisterInputs(options),/Immutable input blob changed/);
  assert.deepEqual(fs.readFileSync(receipt),prepared);assert.deepEqual(fs.readFileSync(f.inputs),before);
  fs.writeFileSync(blob,bytes);
  const altered=read(f.inputs);altered.unrelatedChange=true;write(f.inputs,altered);
  assert.throws(()=>reregisterInputs(options),/already registered/,'prepared after-hash must bind the exact applied registry');
  assert.deepEqual(fs.readFileSync(receipt),prepared);fs.writeFileSync(f.inputs,before);
  const result=reregisterInputs(options);
  assert.equal(result.recovered,true);assert.equal(result.id,read(receipt).id);assert.equal(read(receipt).state,'applied');
  assert.equal(read(receipt).inputsAfterSha256,sha256(before));assert.deepEqual(fs.readFileSync(f.inputs),before);
  assert.equal(read(f.inputs).files.filter(row=>row.file===file).length,1);assert.deepEqual(fs.readdirSync(path.join(f.state,'input-history')),history);
  assert.deepEqual(fs.readFileSync(path.join(f.state,'blobs',sha256(bytes))),bytes);
  assert.equal(fs.existsSync(path.join(f.state,'worker.lock')),false);
});

test('applied registry ownership prevents stale prepared additions from being recovered again', t => {
  const f=fixture(t),file='orphan-photo.webp';fs.writeFileSync(path.join(f.source,file),'synthetic orphan input');
  const options={...f.options,files:[file],add:true,apply:true},rename=fs.renameSync,before=fs.readFileSync(f.inputs);
  const interrupted=t.mock.method(fs,'renameSync',(from,to)=>{if(to===f.inputs)throw Error('synthetic interruption before registry write');return rename(from,to);});
  for(let i=0;i<2;i++)assert.throws(()=>reregisterInputs({...options,now:1000+i}),/synthetic interruption/);
  interrupted.mock.restore();assert.deepEqual(fs.readFileSync(f.inputs),before);
  const directory=path.join(f.state,'input-history'),orphans=fs.readdirSync(directory).map(name=>({file:path.join(directory,name),bytes:fs.readFileSync(path.join(directory,name))}));
  assert.equal(orphans.length,2);for(const row of orphans)assert.equal(JSON.parse(row.bytes).state,'prepared');
  const applied=reregisterInputs({...options,now:1002}),registered=fs.readFileSync(f.inputs);
  assert.equal(read(path.join(directory,applied.id+'.json')).inputsAfterSha256,sha256(registered));
  for(const row of orphans)assert.equal(JSON.parse(row.bytes).inputsAfterSha256,sha256(registered));
  for(const apply of [false,true])assert.throws(()=>reregisterInputs({...options,now:1003,apply}),/already registered/);
  for(const row of orphans)assert.deepEqual(fs.readFileSync(row.file),row.bytes,'a failed attempt is not falsely completed');
  assert.equal(fs.readdirSync(directory).length,3);assert.deepEqual(fs.readFileSync(f.inputs),registered);
  assert.equal(fs.existsSync(path.join(f.state,'worker.lock')),false);
});

test('an existing corrupt blob is rejected before a prepared history receipt is written', t => {
  const f=fixture(t),file='corrupt-photo.webp',bytes=Buffer.from('synthetic new input');fs.writeFileSync(path.join(f.source,file),bytes);
  const blob=path.join(f.state,'blobs',sha256(bytes));fs.writeFileSync(blob,'synthetic corrupt blob');const before=fs.readFileSync(f.inputs);
  assert.throws(()=>reregisterInputs({...f.options,files:[file],add:true,apply:true}),/Immutable input blob changed/);
  assert.deepEqual(fs.readFileSync(f.inputs),before);assert.equal(fs.existsSync(path.join(f.state,'input-history')),false);
  assert.equal(fs.readFileSync(blob,'utf8'),'synthetic corrupt blob');assert.equal(fs.existsSync(path.join(f.state,'worker.lock')),false);
});
