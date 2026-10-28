'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const test=require('node:test'),assert=require('node:assert/strict');
const {prepareChildLocation,readChildLocationHelperPin}=require('../tools/build-child-release.cjs');
const {inventory}=require('../tools/freeze-platform-release.cjs');
const common=path.resolve(__dirname,'..');
const helperPin=stage=>crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,'src/mac-application-location.cjs'))).digest('hex');
const baseline="'use strict';\napp.enableSandbox();\nconst suiteBindingKey=null;\napp.on('second-instance',(_event,argv)=>{createWindow();});\napp.on('activate',()=>{createWindow();});\napp.whenReady().then(()=>{createWindow();});\nfunction createWindow(){calls.push('main');}\n";
function fixture(t,id='world'){
  const stage=fs.mkdtempSync(path.join(os.tmpdir(),'synk-child-refresh-'));
  t.after(()=>fs.rmSync(stage,{recursive:true,force:true}));
  fs.mkdirSync(path.join(stage,'src'));fs.writeFileSync(path.join(stage,'src/main.cjs'),baseline);
  fs.writeFileSync(path.join(stage,'runtime.json'),JSON.stringify({clientId:id}));
  fs.writeFileSync(path.join(stage,'src/records.cjs'),'unchanged');return stage;
}
test('refreshing either verified child reuses a complete canonical gate without changing any bytes',t=>{
  for(const id of ['world','messenger']){
    const stage=fixture(t,id),first=prepareChildLocation(stage,common);assert.equal(first.changed.length,2);
    const before=inventory(stage),pin=helperPin(stage),next=prepareChildLocation(stage,common,pin);
    assert.equal(next.reused,true);assert.equal(next.clientId,id);assert.deepEqual(next.changed,[]);
    assert.equal(next.unchangedFiles,before.length);assert.equal(next.userDataOperations,0);assert.deepEqual(inventory(stage),before);
  }
});
test('an existing helper cannot hide a missing or changed startup/activate/second-instance gate',t=>{
  for(const [from,to] of [["if(!appLocationReady)return;",''],['if(!location.continueStartup||appLocationQuitting)return;',''],['appLocationReady=true;','appLocationReady=false;']]){
    const stage=fixture(t);prepareChildLocation(stage,common);const pin=helperPin(stage),file=path.join(stage,'src/main.cjs');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(from,to));
    const before=inventory(stage);assert.throws(()=>prepareChildLocation(stage,common,pin),/gate differs/);assert.deepEqual(inventory(stage),before);
  }
});
test('a changed helper or an overlaid main with a missing helper is rejected without writes',t=>{
  for(const missing of [false,true]){const stage=fixture(t);prepareChildLocation(stage,common);const pin=helperPin(stage),helper=path.join(stage,'src/mac-application-location.cjs');
    if(missing)fs.unlinkSync(helper);else fs.appendFileSync(helper,'\n// changed\n');
    const before=inventory(stage);assert.throws(()=>prepareChildLocation(stage,common,pin),missing?/already applied/:/helper differs/);assert.deepEqual(inventory(stage),before);
  }
});

test('an existing gate requires its verified archive pin and preserves older baseline copy',t=>{
 const stage=fixture(t);prepareChildLocation(stage,common);const helper=path.join(stage,'src/mac-application-location.cjs');fs.appendFileSync(helper,'\n// older pinned public copy\n');const before=inventory(stage),pin=helperPin(stage);
 assert.throws(()=>prepareChildLocation(stage,common),/verified baseline/);assert.throws(()=>prepareChildLocation(stage,common,'0'.repeat(64)),/verified baseline/);
 assert.equal(prepareChildLocation(stage,common,pin).reused,true);assert.deepEqual(inventory(stage),before);
});
test('helper pins come from real ASAR bytes with Windows and Unix package path separators',async t=>{
  const asar=require('@electron/asar'),stage=fixture(t),out=fs.mkdtempSync(path.join(os.tmpdir(),'synk-child-asar-'));
  t.after(()=>fs.rmSync(out,{recursive:true,force:true}));
  const plain=path.join(out,'plain.asar');await asar.createPackage(stage,plain);assert.equal(readChildLocationHelperPin(asar,plain),null);
  prepareChildLocation(stage,common);const packed=path.join(out,'gate.asar');await asar.createPackage(stage,packed);
  const expected=helperPin(stage);assert.equal(readChildLocationHelperPin(asar,packed),expected);
  for(const separator of ['\\','/']){
    const portable={listPackage:archive=>asar.listPackage(archive).map(name=>name.replaceAll('\\','/').replaceAll('/',separator)),extractFile:(...args)=>asar.extractFile(...args)};
    assert.equal(readChildLocationHelperPin(portable,packed),expected);
  }
});
