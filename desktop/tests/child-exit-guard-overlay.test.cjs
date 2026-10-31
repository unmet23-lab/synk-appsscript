'use strict';
// The bundled Workspace client is the reviewed public package plus exact overlays. Its company page keeps unsaved
// drafts with beforeunload, so without a will-prevent-unload prompt the window would not close (10-22).
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {applyChildExitGuardOverlay,overlayChildExitGuard}=require('../tools/apply-child-exit-guard-overlay.cjs');
const {prepareChildOverlays}=require('../tools/build-child-release.cjs');
const {inventory}=require('../tools/freeze-platform-release.cjs');
const common=path.resolve(__dirname,'..');
// Same lines as the public Workspace 0.4.11 / 0.4.48 entry point (src/main.cjs lines 23 and 137, LF).
const baseline="'use strict';\nconst {installDraftExitGuard}=require('./draft-exit.cjs');\napp.enableSandbox();\nconst suiteBindingKey=null;\napp.on('second-instance',(_event,argv)=>{createWindow();});\napp.on('activate',()=>{createWindow();});\napp.whenReady().then(()=>{createWindow();});\nfunction createWindow(){\n  const isPlatform=runtime.clientId==='platform';\n  if(isPlatform)installDraftExitGuard({contents,window,dialog,getRecoveryAvailable:()=>!!draftRecovery?.available()});\n  calls.push('main');\n}\n";
// The public 0.4.11 helper: memo wording only, no text option.
const oldHelper="'use strict';\nfunction installDraftExitGuard({contents,window,dialog}){contents.on('will-prevent-unload',event=>{if(dialog.showMessageBoxSync(window,{title:'작성 중인 메모'})===1)event.preventDefault();});}\nmodule.exports={installDraftExitGuard};\n";
function fixture(t,id='messenger',main=baseline){
  const stage=fs.mkdtempSync(path.join(os.tmpdir(),'synk-child-exit-'));t.after(()=>fs.rmSync(stage,{recursive:true,force:true}));
  fs.mkdirSync(path.join(stage,'src'));fs.writeFileSync(path.join(stage,'src/main.cjs'),main);fs.writeFileSync(path.join(stage,'src/draft-exit.cjs'),oldHelper);
  fs.writeFileSync(path.join(stage,'runtime.json'),JSON.stringify({clientId:id}));fs.writeFileSync(path.join(stage,'src/records.cjs'),'unchanged');return stage;
}
test('Workspace overlay changes only the entry point and the shared exit helper, and a refreshed copy is reused as is',t=>{
  const stage=fixture(t),first=applyChildExitGuardOverlay(stage,common);
  assert.equal(first.ok,true);assert.equal(first.reused,false);assert.deepEqual(first.changed.map(row=>row.path).sort(),['src/draft-exit.cjs','src/main.cjs']);
  assert.deepEqual(fs.readFileSync(path.join(stage,'src/draft-exit.cjs')),fs.readFileSync(path.join(common,'src/draft-exit.cjs')));
  assert.equal(fs.readFileSync(path.join(stage,'src/records.cjs'),'utf8'),'unchanged');
  const main=fs.readFileSync(path.join(stage,'src/main.cjs'),'utf8');
  assert.match(main,/\nconst \{installDraftExitGuard,WORKSPACE_EXIT_TEXT\}=require\('\.\/draft-exit\.cjs'\);\n/);
  assert.match(main,/available\(\)\}\);else if\(runtime\.clientId==='messenger'\)installDraftExitGuard\(\{contents,window,dialog,text:WORKSPACE_EXIT_TEXT\}\);\n/);
  const before=inventory(stage),next=applyChildExitGuardOverlay(stage,common);
  assert.equal(next.reused,true);assert.deepEqual(next.changed,[]);assert.deepEqual(inventory(stage),before);
});
test('a CRLF entry point with LF lines from the location gate keeps every line ending',t=>{
  // The public Workspace 0.4.48 entry point is CRLF except the LF lines the location gate overlay added.
  const crlf=baseline.replaceAll('\n','\r\n').replace("app.enableSandbox();\r\n","const {createMacApplicationLocationGate}=require('./mac-application-location.cjs');\napp.enableSandbox();\r\n");
  const stage=fixture(t,'messenger',crlf),receipt=applyChildExitGuardOverlay(stage,common),main=fs.readFileSync(path.join(stage,'src/main.cjs'),'utf8');
  assert.equal(receipt.reused,false);assert.equal(main.split('\r\n').length,crlf.split('\r\n').length);assert.equal(main.split('\n').length,crlf.split('\n').length);
  assert.match(main,/WORKSPACE_EXIT_TEXT\}\);\r\n  calls\.push/);assert.equal(applyChildExitGuardOverlay(stage,common).reused,true);
});
test('only the Workspace client takes the overlay and an unknown entry point fails before any file changes',t=>{
  const world=fixture(t,'world'),worldBefore=inventory(world);
  assert.throws(()=>applyChildExitGuardOverlay(world,common),/only for Workspace/);assert.deepEqual(inventory(world),worldBefore);
  for(const main of [baseline.replace('!!draftRecovery?.available()','draftRecovery?.available()===true'),baseline.replace("  if(isPlatform)","    if(isPlatform)"),baseline.replace("available()});\n","available()});calls.push('more');\n"),baseline.replace("const {installDraftExitGuard}=","const {installDraftExitGuard} = "),baseline+baseline.split('\n').slice(9,10).join('\n')+'\n']){
    const stage=fixture(t,'messenger',main),before=inventory(stage);
    assert.throws(()=>applyChildExitGuardOverlay(stage,common),/anchor mismatch/);assert.deepEqual(inventory(stage),before);
  }
  const tampered=fixture(t,'messenger',overlayChildExitGuard(baseline).replace('text:WORKSPACE_EXIT_TEXT','text:WORKSPACE_EXIT_TEXT,getRecoveryAvailable:()=>true')),before=inventory(tampered);
  assert.throws(()=>applyChildExitGuardOverlay(tampered,common),/exit guard differs|canonical/);assert.deepEqual(inventory(tampered),before);
});
test('a release source whose helper lost the Workspace wording stops the child build unchanged',t=>{
  const source=fs.mkdtempSync(path.join(os.tmpdir(),'synk-child-exit-source-'));t.after(()=>fs.rmSync(source,{recursive:true,force:true}));
  fs.mkdirSync(path.join(source,'src'));fs.writeFileSync(path.join(source,'src/draft-exit.cjs'),oldHelper);
  const stage=fixture(t),before=inventory(stage);
  assert.throws(()=>applyChildExitGuardOverlay(stage,source),/helper differs/);assert.deepEqual(inventory(stage),before);
});
test('the overlaid Workspace entry point asks before a page guard keeps closing, and WORLD stays as it was',()=>{
  const helper=require('../src/draft-exit.cjs');
  for(const clientId of ['messenger','world']){
    const contents=new EventEmitter(),window={isDestroyed:()=>false},shown=[];let choice=0;
    vm.runInNewContext(overlayChildExitGuard(baseline).replace(/^app\.[\s\S]*?(?=function createWindow)/m,'')+'createWindow();\n',{require:id=>{assert.equal(id,'./draft-exit.cjs');return helper;},runtime:{clientId},contents,window,dialog:{showMessageBoxSync(target,options){assert.equal(target,window);shown.push(options);return choice;}},draftRecovery:null,calls:[]});
    const unload=()=>{const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};contents.emit('will-prevent-unload',event);return event.defaultPrevented;};
    if(clientId==='world'){assert.equal(contents.listenerCount('will-prevent-unload'),0);continue;}
    assert.equal(unload(),false);assert.equal(shown[0].title,'SYNK Workspace');assert.deepEqual(shown[0].buttons,['돌아가서 저장','저장하지 않고 나가기']);
    choice=1;assert.equal(unload(),true);
  }
});
test('child refresh adds the exit helper to the allowed paths for Workspace only, after the location gate',t=>{
  for(const id of ['world','messenger']){
    const stage=fixture(t,id),result=prepareChildOverlays(stage,common);
    assert.equal(result.overlay.ok,true);assert.equal(result.allowed.has('src/main.cjs'),true);
    assert.equal(result.allowed.has('src/draft-exit.cjs'),id==='messenger');assert.equal(result.exitGuard?.ok===true,id==='messenger');
    const main=fs.readFileSync(path.join(stage,'src/main.cjs'),'utf8');
    assert.match(main,/appLocationReady/);assert.equal(main.includes('WORKSPACE_EXIT_TEXT'),id==='messenger');
    assert.equal(fs.readFileSync(path.join(stage,'src/draft-exit.cjs'),'utf8')===oldHelper,id==='world');
  }
});
