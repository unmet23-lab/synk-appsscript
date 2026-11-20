'use strict';
// 진짜 Electron으로 창 안의 PULSE 뷰를 돌려 보는 짧은 시험(검정 구 3단계 구현 설계 6절).
//   node_modules/electron/dist/electron.exe tools/pulse-view-smoke.cjs
// 숨은 창 하나에 실제 WebContentsView를 붙인다. 저장소 밖 주소에는 나가지 않는다(문서는 data: 주소다).
// 보는 것: 띠 아래 자리와 배율, 숨겨도 문서가 남음, 창을 닫기 전에 PULSE에 묻는 문(쓰던 글 없음 · 머묾 · 나감), 플랫폼 문서가 바뀌면 숨김,
// 뷰가 PULSE 관리자가 준 세션 · 권한 거절 · 주소 거르기 · 초대 preload를 실제로 쓰는지(설계 검토 R8).
// 초점은 숨은 창에서 잴 수 없어 보지 않는다(설치본에서 본다).
const {app,BrowserWindow,WebContentsView,session}=require('electron');
const path=require('node:path');
const {createPulseViewHost}=require('../src/pulse-view.cjs');
const {installDraftExitGuard}=require('../src/draft-exit.cjs');

const results=[];
const check=(name,ok,details={})=>{results.push({name,ok:!!ok});process.stdout.write(JSON.stringify({name,ok:!!ok,...details})+'\n');};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const PLATFORM='data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><body style="margin:0;background:#000"><div id="band" style="height:56px"></div>');
const PULSE='data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><title>PULSE</title><body style="background:#000"><script>window.kept=Math.random();addEventListener("beforeunload",e=>{if(window.dirty){e.preventDefault();e.returnValue="";}})</script>');
const prefs={sandbox:true,contextIsolation:true,nodeIntegration:false,webviewTag:false};

async function platformWindow(){
  const win=new BrowserWindow({show:false,useContentSize:true,width:1440,height:940,backgroundColor:'#000000',webPreferences:{sandbox:true,contextIsolation:true}});
  await win.loadURL(PLATFORM);
  return win;
}
async function withPulse({dirty=false,answer=0}={}){
  const win=await platformWindow(),changes=[],asked=[];let quits=0,kept=0;
  const host=createPulseViewHost({WebContentsView,getWindow:()=>win,onChange:value=>changes.push(value)});
  const surface=host.createSurface({backgroundColor:'#000000',webPreferences:prefs});
  const dialog={showMessageBoxSync(parent,options){asked.push({parent,options});return answer;}};
  installDraftExitGuard({contents:surface.webContents,window:surface.dialogParent(),dialog,text:{title:'SYNK PULSE',message:'시험',detail:'시험'}});
  await surface.loadURL(PULSE);
  if(dirty)await surface.webContents.executeJavaScript('window.dirty=true;1',true);
  host.installCloseGate(win,{quitting:()=>false,quit:()=>{quits++;},onKept:()=>{kept++;}});
  return {win,host,surface,changes,asked,get quits(){return quits;},get kept(){return kept;}};
}

app.whenReady().then(async()=>{
  try{
    check('electron has WebContentsView',typeof WebContentsView==='function',{electron:process.versions.electron});
    {
      const t=await withPulse();const view=t.win.contentView.children[0];
      check('the view is added hidden',view&&view.getVisible()===false,{children:t.win.contentView.children.length});
      t.host.place({visible:true,top:56});
      const [w,h]=t.win.getContentSize();
      check('the view fills the window under the 56 px band',JSON.stringify(view.getBounds())===JSON.stringify({x:0,y:56,width:w,height:h-56})&&view.getVisible(),{bounds:view.getBounds(),size:[w,h]});
      t.win.webContents.setZoomFactor(1.25);t.host.relayout();
      check('the band follows the platform zoom',view.getBounds().y===70,{bounds:view.getBounds()});
      t.win.webContents.setZoomFactor(1);t.host.relayout();
      t.win.setContentSize(960,680);await wait(200);
      check('a resize places the view again',JSON.stringify(view.getBounds())===JSON.stringify({x:0,y:56,width:960,height:624}),{bounds:view.getBounds()});
      const before=await t.surface.webContents.executeJavaScript('window.kept');
      t.host.place({visible:false,top:56});await wait(100);t.host.place({visible:true,top:56});
      check('hiding and showing keeps the PULSE document',await t.surface.webContents.executeJavaScript('window.kept')===before);
      await t.win.loadURL(PLATFORM+'#again');
      check('a same-document move of the platform page keeps the view shown',view.getVisible()===true);
      await t.win.loadURL('data:text/html,other');
      check('a new platform document hides the view and keeps it alive',view.getVisible()===false&&!t.surface.isDestroyed());
      t.win.close();await wait(500);
      check('a clean PULSE closes before the window, without a question, and the window then closes',t.asked.length===0&&t.surface.isDestroyed()&&t.win.isDestroyed(),{asked:t.asked.length});
    }
    {
      const t=await withPulse({dirty:true,answer:0});
      t.win.close();await wait(500);
      check('「돌아가서 저장」 keeps PULSE and the window, asked once over the platform window',!t.surface.isDestroyed()&&!t.win.isDestroyed()&&t.kept===1&&t.asked.length===1&&t.asked[0].parent===t.win,{asked:t.asked.length,kept:t.kept});
      t.win.destroy();await wait(200);
      check('destroying the window closes the kept view without asking',t.surface.isDestroyed()&&t.asked.length===1);
    }
    {
      const t=await withPulse({dirty:true,answer:1});
      t.win.close();await wait(800);
      check('「저장 없이 나가기」 closes PULSE, then the window',t.surface.isDestroyed()&&t.win.isDestroyed()&&t.asked.length===1&&t.kept===0,{asked:t.asked.length});
    }
    {
      // 설계 검토 R8: 뷰가 넘겨받은 세션에서 돈다. 그 세션의 권한 거절과 주소 거르기가 뷰의 요청에 걸리고, preload는 초대 preload다
      const win=await platformWindow(),seen=[];
      const isolated=session.fromPartition('pulse-view-smoke-'+process.pid);
      isolated.setPermissionRequestHandler((_c,_p,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
      isolated.webRequest.onBeforeRequest({urls:['https://*/*']},(details,callback)=>{seen.push(details.url);callback({cancel:true});});
      const host=createPulseViewHost({WebContentsView,getWindow:()=>win});
      // preload가 실제로 도는지는 시험용 preload가 남긴 표시로 본다(문서에 이름 하나를 내놓는다). 실제 초대 preload는 문서에 아무것도 내놓지 않아 볼 수 없다
      const preload=path.join(require('node:os').tmpdir(),'synk-pulse-view-smoke-preload-'+process.pid+'.cjs');
      require('node:fs').writeFileSync(preload,"require('electron').contextBridge.exposeInMainWorld('__pulseViewSmokePreload',true);");
      const surface=host.createSurface({backgroundColor:'#000000',webPreferences:{...prefs,session:isolated,preload}});
      await surface.loadURL(PULSE);
      const last={...(surface.webContents.getLastWebPreferences?.()||{}),ran:await surface.webContents.executeJavaScript('window.__pulseViewSmokePreload===true')};
      require('node:fs').rmSync(preload,{force:true});
      const fetched=await surface.webContents.executeJavaScript("fetch('https://pulse-view-smoke.invalid/probe').then(()=>'loaded',()=>'refused')");
      // 조회는 확인 처리기를 지난다. 거절(denied)이어야 한다. 묻지 않음(prompt)이나 오류는 통과가 아니다(GPT 엔진 검수 GA3)
      const permission=await surface.webContents.executeJavaScript("navigator.permissions.query({name:'notifications'}).then(r=>r.state,()=>'error')");
      check('the view runs in the session it was given, under its refusals and its request filter, with the preload it was given',surface.webContents.session===isolated&&seen.includes('https://pulse-view-smoke.invalid/probe')&&fetched==='refused'&&permission==='denied'&&last.ran===true&&last.sandbox===true&&last.contextIsolation===true,{seen,fetched,permission,preload:last.ran,sandbox:last.sandbox});
      surface.destroy();win.destroy();
    }
    {
      const t=await withPulse({dirty:true,answer:0});
      t.surface.destroy();
      check('destroy() closes a PULSE with a draft without asking (an account change)',t.surface.isDestroyed()&&t.asked.length===0&&t.win.contentView.children.length===0&&t.changes.at(-1)?.open===false);
      t.win.destroy();
    }
  }catch(error){check('smoke ran without throwing',false,{error:String(error?.stack||error).slice(0,400)});}
  const failed=results.filter(r=>!r.ok).length;
  process.stdout.write(JSON.stringify({total:results.length,failed})+'\n');
  app.exit(failed?1:0);
});
app.on('window-all-closed',()=>{});
