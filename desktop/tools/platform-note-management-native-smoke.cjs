'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const desktop=path.resolve(__dirname,'..'),repo=path.resolve(desktop,'..'),option=(name,fallback)=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3)||fallback;
const out=path.resolve(option('out',path.join(repo,'docs','_ops','qa','platform-note-management-20261009'))),bundle=path.resolve(option('bundle',path.join(desktop,'renderer','platform-continuity.mjs'))),css=path.resolve(option('css',path.join(desktop,'renderer','platform-continuity.css')));
const prefix='SYNK_PLATFORM_NOTES_QA ',sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const safeProfile=value=>path.dirname(path.resolve(value))===path.resolve(os.tmpdir())&&path.basename(value).startsWith('synk-platform-notes-');
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-platform-notes-'));
  try{
    const result=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile,'--out='+out,'--bundle='+bundle,'--css='+css],{cwd:desktop,windowsHide:true,encoding:'utf8',timeout:60000});
    const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-1800)};
    report.process={exitCode:result.status,signal:result.signal,error:result.error?.message||null};
    if(result.status!==0||result.error){report.ok=false;report.error||=result.error?.message||'ELECTRON_EXIT_'+result.status;}
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'native-notes.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(value=>!value.ok),error:report.error,output:path.join(out,'native-notes.json')},null,2));
    if(!report.ok)process.exitCode=1;
  }finally{if(!safeProfile(profile))throw Error('Unsafe temporary profile');fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});}
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron'),profile=option('profile','');
  if(!profile||!safeProfile(profile))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');
  protocol.registerSchemesAsPrivileged([{scheme:'synk-notes',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    let win,stage='startup';const checks=[],errors=[],requests=[],screenshots=[],served=new Map();
    const check=(name,ok,details={})=>{stage=name;checks.push({name,ok:!!ok,...details});if(!ok)throw Error(name);},pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const finish=(ok,error)=>{
      const loadedSources=Object.fromEntries([...served].map(([key,value])=>[key,{sha256:value.sha256,unchanged:fs.existsSync(value.file)&&sha(fs.readFileSync(value.file))===value.sha256}]));
      const scripts=Object.fromEntries(['platform-note-management-native-smoke.cjs','platform-note-management-fixture.mjs'].map(file=>[file,sha(fs.readFileSync(path.join(__dirname,file)))]));
      process.stdout.write(prefix+JSON.stringify({ok,error,checkedAt:new Date().toISOString(),scope:'Hidden sandboxed Chromium component fixture with selected native JS/CSS and local font/asset. Synthetic A/B/CAP accounts and memory CAS only. No installed app, credentials, real account/profile, external requests, build, install or release. Screenshots cover the library component, not the complete launcher shell.',bundle,css,versions:{electron:process.versions.electron,chrome:process.versions.chrome},scripts,loadedSources,checks,errors,requests,screenshots})+'\n');
      if(win&&!win.isDestroyed())win.destroy();app.exit(ok?0:1);
    };
    try{
      fs.mkdirSync(out,{recursive:true});Menu.setApplicationMenu(null);const isolated=session.fromPartition('platform-note-management-synthetic');
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(request,callback)=>{requests.push(request.url);callback({cancel:true});});
      const paths={'/entry.mjs':bundle,'/library.css':css,'/fixture.mjs':path.join(__dirname,'platform-note-management-fixture.mjs'),'/assets/launcher/button-soft.webp':path.join(desktop,'assets','launcher','button-soft.webp'),'/assets/SUIT.woff2':path.join(desktop,'assets','launcher','SUIT.woff2')};
      isolated.protocol.handle('synk-notes',request=>{
        const headers={'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self'; font-src 'self'; frame-src 'none'; form-action 'none'; base-uri 'none'",'x-content-type-options':'nosniff','cache-control':'no-store'};
        try{
          const url=new URL(request.url);if(url.host!=='fixture'||url.search||url.hash||request.method!=='GET')return new Response('Unavailable',{status:404,headers});
          if(url.pathname==='/index.html')return new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK isolated note management fixture</title><link rel="stylesheet" href="/library.css"><style>@font-face{font-family:SUIT;src:url(/assets/SUIT.woff2)}:root{font-family:SUIT,system-ui,sans-serif;color:#17202a;background:#fcfbf7}body{margin:0}button,input,select{font:inherit}#fixture{box-sizing:border-box}</style><main id="fixture"></main><script type="module" src="/fixture.mjs"></script></html>',{headers:{...headers,'content-type':'text/html; charset=utf-8'}});
          const file=paths[url.pathname];if(!file)return new Response('Unavailable',{status:404,headers});
          const bytes=fs.readFileSync(file);served.set(url.pathname,{file,sha256:sha(bytes)});
          return new Response(bytes,{headers:{...headers,'content-type':({'.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.webp':'image/webp'})[path.extname(file)]}});
        }catch(error){errors.push({stage,message:error.message});return new Response('Unavailable',{status:404,headers});}
      });
      win=new BrowserWindow({width:1280,height:1080,useContentSize:true,show:false,webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:false,offscreen:true}});
      win.webContents.on('console-message',(event,level,message,line,sourceId)=>{if(event.level==='error'||event.level===3||level===3)errors.push({message:event.message||message,stage,sourceId:event.sourceId||sourceId,lineNumber:event.lineNumber||line});});
      const run=source=>win.webContents.executeJavaScript(source),qa='window.__platformNotesQA';
      const until=async source=>{for(let i=0;i<240;i++){if(await run(source))return true;await pause(15);}return false;};
      const snap=()=>run(qa+'.snapshot()'),settled=()=>until('!'+qa+'.pending()&&'+qa+'.ready()');
      const screenshot=async(name,width,selector)=>{win.setContentSize(width,1080);await until('innerWidth==='+width);await run(selector?qa+'.scrollTo('+JSON.stringify(selector)+')':'scrollTo(0,0)');await pause(80);const geometry=await run(qa+'.geometry()');check(name+'-width-and-no-overflow',geometry.width===width&&geometry.scrollWidth<=geometry.clientWidth&&geometry.overflow.length===0,geometry);const img=await win.webContents.capturePage();fs.writeFileSync(path.join(out,name+'.png'),img.toPNG());screenshots.push({file:name+'.png',width:img.getSize().width,height:img.getSize().height,viewport:geometry.width});};
      const click=(action,id)=>run(qa+'.click('+JSON.stringify(action)+(id?','+JSON.stringify(id):'')+')');
      await win.loadURL('synk-notes://fixture/index.html');check('fixture-ready',await until("document.documentElement.dataset.ready==='true'"));await run(qa+'.connect()');check('account-A-ready',await until(qa+'.ready()'));await run(qa+'.expand()');await run('document.fonts.ready');
      let s=await snap();check('unfinished-first-and-completed-collapsed',s.completedHidden&&JSON.stringify(s.visibleNoteIds)===JSON.stringify(['todo-a','todo-b'])&&s.allNoteIds.at(-1)==='done-a',s);
      check('connection-has-no-write',await run(qa+'.calls().every(row=>row.operation==="platformLoad")'));
      await run(qa+'.toggleCompletedKeyboard()');win.webContents.sendInputEvent({type:'keyDown',keyCode:'Enter'});win.webContents.sendInputEvent({type:'char',keyCode:'\r'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Enter'});
      check('keyboard-expands-completed',await until(qa+'.snapshot().completedHidden===false'),await run('({active:document.activeElement.outerHTML,completed:'+qa+'.snapshot().completedHidden})'));await click('show-completed');check('completed-can-collapse-again',(await snap()).completedHidden);
      await screenshot('library-1280',1280);await screenshot('notes-1280',1280,'.continuity-notes');await screenshot('library-390',390);await screenshot('notes-390',390,'.continuity-notes');win.setContentSize(1280,1080);
      await click('toggle-note','todo-a');s=await snap();check('marking-done-moves-note-to-collapsed-completed-group',s.completedHidden&&!s.visibleNoteIds.includes('todo-a')&&s.projection.notes.find(row=>row.id==='todo-a').done);
      await click('show-completed');await click('toggle-note','todo-a');s=await snap();check('reopening-completed-note-restores-unfinished-group',s.visibleNoteIds[0]==='todo-a'&&!s.projection.notes.find(row=>row.id==='todo-a').done);await click('show-completed');check('done-toggle-saves-settle',await settled());
      const parked='새 메모로 계속 작성하던 합성 초안',edited='수정하면서 저장 상태가 바뀌어도 이어지는 한글 메모';
      await run(qa+'.input('+JSON.stringify(parked)+',"care");'+qa+'.beginProbe()');await click('edit-note','todo-a');s=await snap();
      check('edit-reuses-editor-and-parks-new-note',await run(qa+'.probe().sameInput&&'+qa+'.probe().sameForm&&'+qa+'.probe().sameSelect&&'+qa+'.probe().focused')&&s.title==='부탁 대화의 첫 문장 다듬기'&&s.heading==='메모 수정',s);
      await run(qa+'.input('+JSON.stringify(edited)+',"rehearsal");'+qa+'.beginProbe();'+qa+'.hold("platformSave");'+qa+'.change({type:"favorite",id:"world"})');
      check('background-save-starts-during-edit',await until(qa+'.held("platformSave")'));
      const retained=async name=>{const p=await run(qa+'.probe()');check(name,p.sameInput&&p.sameForm&&p.sameSelect&&p.connected&&p.focused&&p.value===edited&&p.appId==='rehearsal'&&p.start===2&&p.end===6&&p.direction==='backward',p);};
      await retained('editing-focus-and-selection-during-save');await run(qa+'.release("platformSave")');check('background-save-finishes',await settled());await retained('editing-focus-and-selection-after-save');
      await run(qa+'.submit()');check('edited-note-restores-parked-draft',await until(qa+'.snapshot().heading==="새 메모"&&'+qa+'.snapshot().title==='+JSON.stringify(parked)));check('edit-save-settles',await settled());
      s=await snap();let row=await run(qa+'.record("A").state.notes.find(row=>row.id==="todo-a")');check('edit-updates-only-title-and-app',row.title===edited&&row.appId==='rehearsal'&&row.id==='todo-a'&&row.done===false&&row.createdAt===100&&s.appId==='care'&&s.projection.notes.length===3,row);
      await click('edit-note','todo-a');await run(qa+'.input("취소할 수정", "world")');await click('cancel-edit');check('cancel-restores-parked-draft-and-saved-note',(await snap()).title===parked&&await run(qa+'.record("A").state.notes.find(row=>row.id==="todo-a").title==='+JSON.stringify(edited)));
      await run(qa+'.input("")');const original=await run(qa+'.record("A").state.notes');await click('remove-note','todo-a');await click('remove-note','todo-b');s=await snap();check('two-deletes-retain-two-undo-items',s.projection.notes.length===1&&!s.undoHidden&&s.undoMessage.includes('2개'),s);
      await click('undo-note');check('first-undo-restores-most-recent-delete',(await snap()).projection.notes.some(row=>row.id==='todo-b')&&!(await snap()).projection.notes.some(row=>row.id==='todo-a'));
      await click('undo-note');await click('undo-note');check('repeated-undo-restores-original-order-without-duplicates',JSON.stringify((await snap()).projection.notes)===JSON.stringify(original)&&(await snap()).undoHidden);check('undo-saves-settle',await settled());
      await click('show-completed');await click('remove-note','done-a');await click('undo-note');s=await snap();check('undo-keeps-completed-metadata-and-reveals-restored-note',!s.completedHidden&&s.projection.notes.find(row=>row.id==='done-a').done===true&&s.visibleNoteIds.includes('done-a'));check('completed-undo-settles',await settled());
      await run(qa+'.hold("platformSave")');await click('remove-note','todo-b');check('account-A-save-is-held',await until(qa+'.held("platformSave")'));await run(qa+'.input("A에서만 남긴 새 초안")');await click('edit-note','todo-a');await run(qa+'.input("A의 미완료 수정");'+qa+'.switchAccount("B")');
      check('account-B-replaces-note-state',await until(qa+'.ready()&&'+qa+'.snapshot().projection?.notes[0]?.id==="only-b"'));s=await snap();check('account-switch-clears-edit-draft-and-undo',s.title===''&&s.heading==='새 메모'&&s.undoHidden&&!s.allNoteIds.includes('todo-a')&&!s.allNoteIds.includes('todo-b'),s);
      await run(qa+'.release("platformSave")');await pause(120);check('late-A-save-never-writes-B',await run(qa+'.record("B").state.notes.length===1&&'+qa+'.record("B").state.notes[0].id==="only-b"&&'+qa+'.calls().filter(row=>row.operation==="platformSave"&&row.owner==="B").length===0'));
      await run(qa+'.switchAccount("CAP")');check('capacity-account-ready',await until(qa+'.ready()&&'+qa+'.snapshot().projection?.notes.length===60'));s=await snap();check('sixty-note-capacity-guidance-disables-new-submit',s.capacity.includes('60/60')&&s.capacity.includes('가득')&&s.submitDisabled,s);
      const beforeCapWrites=await run(qa+'.calls().filter(row=>row.operation==="platformSave").length');const capError=await run(qa+'.rejectOverCapacity()');check('sixty-first-note-is-rejected-without-write',capError?.code==='NOTE_LIMIT'&&(await snap()).projection.notes.length===60&&await run(qa+'.calls().filter(row=>row.operation==="platformSave").length==='+beforeCapWrites),{capError});
      await click('edit-note','cap-0');check('edit-remains-available-at-capacity',!(await snap()).submitDisabled);await run(qa+'.input("60개에서도 기존 메모 수정");'+qa+'.submit()');check('capacity-edit-settles',await settled()&&await until(qa+'.snapshot().heading==="새 메모"'));check('capacity-edit-keeps-sixty-notes',await run(qa+'.record("CAP").state.notes.length===60&&'+qa+'.record("CAP").state.notes[0].title==="60개에서도 기존 메모 수정"'));
      await click('remove-note','cap-1');check('deleting-frees-one-place',!(await snap()).submitDisabled&&(await snap()).capacity.includes('59/60'));await run(qa+'.input("빈자리에 새로 남긴 메모");'+qa+'.submit()');check('replacement-save-settles',await settled()&&await until(qa+'.snapshot().projection?.notes.length===60'));
      s=await snap();check('undo-is-disabled-when-replacement-fills-capacity',s.undoDisabled&&!s.undoHidden&&s.submitDisabled&&s.projection.notes.length===60,s);await click('undo-note');check('disabled-undo-never-exceeds-sixty',(await snap()).projection.notes.length===60);
      await screenshot('capacity-390',390,'[data-note-form]');
      await click('edit-note','cap-0');await run(qa+'.input("다른 저장본을 읽기 전의 수정");'+qa+'.replaceRemoteNote("CAP","cap-0","다른 기기에서 갱신한 저장본");'+qa+'.clickNotebook("refresh")');
      check('explicit-document-reload-clears-editor-and-undo-state',await until(qa+'.ready()&&'+qa+'.snapshot().heading==="새 메모"&&'+qa+'.snapshot().title===""&&'+qa+'.snapshot().undoHidden'),await snap());
      check('document-reload-does-not-submit-discarded-edit',await run(qa+'.record("CAP").state.notes.find(row=>row.id==="cap-0").title==="다른 기기에서 갱신한 저장본"'));
      check('loaded-candidate-assets-unchanged',[...served.values()].every(value=>sha(fs.readFileSync(value.file))===value.sha256));
      check('no-network-or-console-errors',requests.length===0&&errors.length===0,{requests,errors});await run(qa+'.dispose()');finish(true);
    }catch(error){finish(false,error.message);}
  }).catch(error=>{process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message})+'\n');app.exit(1);});
}
