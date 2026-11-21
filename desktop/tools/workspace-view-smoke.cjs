'use strict';
// 진짜 Electron으로 창 안의 Workspace 뷰를 돌려 보는 짧은 시험(검정 구 4단계 구현 설계 3.2 · 4절).
//   node_modules/electron/dist/electron.exe tools/workspace-view-smoke.cjs
// 숨은 창 하나에 실제 Workspace 관리자(workspace-app.cjs)와 뷰 자리 둘(space-view.cjs)을 붙인다. 망에는 나가지 않는다.
// 회사 문서(https://workspace.synk.im/…)는 시험 통의 https를 가로채 이 파일이 준다. 마이크와 화면은 실제로 열지 않는다
// (관리자의 허락 판정만 적고 Electron에는 늘 거절을 준다. 화면 고르기는 아무것도 고르지 않는다).
// 보는 것: 뷰 preload와 통의 회사 입구 preload가 같이 도는지, native 연결 일곱 이름이 최상위 회사 문서에만 서는지,
// 메신저 iframe의 마이크 요청이 소리만일 때 그 판정에 닿는지, iframe의 화면 공유가 보이는 동안만 고르기로 가는지,
// 바깥 최상위 문서를 거르는지, 창을 닫을 때 PULSE와 Workspace의 문이 차례로 묻는지, 계정이 바뀌면 뷰를 닫는지.
// 숨은 분류 창(company-entry.cjs)은 이 시험의 범위가 아니다(설치본에서 본다).
const {app,BrowserWindow,WebContentsView,session}=require('electron');
const path=require('node:path'),os=require('node:os'),fs=require('node:fs');
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'synk-workspace-view-smoke-'));
app.setPath('userData',userData);
const {createSpaceViewHost}=require('../src/space-view.cjs');
const {createWorkspaceApp,workspaceAppPartition}=require('../src/workspace-app.cjs');
const {installDraftExitGuard}=require('../src/draft-exit.cjs');

const results=[];
const check=(name,ok,details={})=>{results.push({name,ok:!!ok});process.stdout.write(JSON.stringify({name,ok:!!ok,...details})+'\n');};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const PLATFORM='data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><body style="margin:0;background:#000"><div id="band" style="height:56px"></div>');
const PULSE='data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><title>PULSE</title><body style="background:#000">');
const COMPANY_TOP='<!doctype html><meta charset="utf-8"><title>Workspace</title><body style="background:#fff">'
  +'<iframe id="m" src="/messenger/" allow="microphone; display-capture" style="width:400px;height:300px;border:0"></iframe>'
  +'<script>window.dirty=false;addEventListener("beforeunload",e=>{if(window.dirty){e.preventDefault();e.returnValue="";}});</script>';
const COMPANY_MESSENGER='<!doctype html><meta charset="utf-8"><title>messenger</title><body>메신저</body>';
const SMOKE_PRELOAD=path.join(userData,'smoke-session-preload.cjs');
fs.writeFileSync(SMOKE_PRELOAD,"require('electron').contextBridge.exposeInMainWorld('__workspaceSessionPreload',true);");

const prefs={sandbox:true,contextIsolation:true,nodeIntegration:false,webviewTag:false};
async function platformWindow(){
  const win=new BrowserWindow({show:false,useContentSize:true,width:1440,height:940,backgroundColor:'#000000',webPreferences:{sandbox:true,contextIsolation:true}});
  await win.loadURL(PLATFORM);
  return win;
}
// 시험 통을 준비한다: https를 가로채 회사 문서를 주고, 관리자가 거는 허락 · 화면 공유 처리기를 감싸 판정만 적는다
function prepareJar(scope,log){
  const jar=session.fromPartition(workspaceAppPartition(scope));
  jar.protocol.handle('https',request=>{
    const url=new URL(request.url);
    if(url.origin!=='https://workspace.synk.im')return new Response('not here',{status:404});
    if(url.pathname==='/')return new Response(COMPANY_TOP,{headers:{'content-type':'text/html; charset=utf-8'}});
    if(url.pathname==='/messenger/')return new Response(COMPANY_MESSENGER,{headers:{'content-type':'text/html; charset=utf-8'}});
    return new Response('',{status:404});
  });
  // 화면을 담는 요청(장치 종류가 빈 media)은 관리자의 판정을 그대로 준다. 그 판정은 고르기를 거친다. 마이크와 카메라는 늘 거절해 장치를 열지 않는다
  const screen=(permission,details)=>permission==='display-capture'||permission==='media'&&Array.isArray(details?.mediaTypes)&&details.mediaTypes.length===0;
  const setRequest=jar.setPermissionRequestHandler.bind(jar);
  jar.setPermissionRequestHandler=handler=>setRequest((contents,permission,callback,details)=>handler(contents,permission,allowed=>{log.permissions.push({permission,allowed,mediaTypes:details?.mediaTypes||null,requestingUrl:details?.requestingUrl||'',isMainFrame:details?.isMainFrame,sameContents:contents===log.contents()});callback(screen(permission,details)?allowed:false);},details));
  const setDisplay=jar.setDisplayMediaRequestHandler.bind(jar);
  jar.setDisplayMediaRequestHandler=handler=>setDisplay((request,callback)=>{let frame=null;try{frame={url:request.frame?.url,top:request.frame?.top===log.contents()?.mainFrame,isTop:request.frame===log.contents()?.mainFrame};}catch(error){frame={error:String(error)};}log.displays.push({videoRequested:request.videoRequested,audioRequested:request.audioRequested,frame});handler(request,callback);});
  // 시험용 표시 preload를 통에 하나 더 건다. 관리자가 거는 회사 입구 preload와 뷰 preload가 함께 도는지 본다
  jar.registerPreloadScript({type:'frame',id:'workspace-view-smoke',filePath:SMOKE_PRELOAD});
  return jar;
}

app.whenReady().then(async()=>{
  try{
    check('electron has WebContentsView and session preload scripts',typeof WebContentsView==='function'&&typeof session.defaultSession.registerPreloadScript==='function',{electron:process.versions.electron});
    const win=await platformWindow();
    const pulseHost=createSpaceViewHost({WebContentsView,getWindow:()=>win});
    const workspaceHost=createSpaceViewHost({WebContentsView,getWindow:()=>win});
    const asked=[],externals=[],shares=[],log={permissions:[],displays:[],contents:()=>null};
    let answer=0,account={signedIn:true,status:'signed-in',account:{synk_user_id:'smoke-'+process.pid}};
    const dialog={showMessageBoxSync(parent,options){asked.push({parent,title:options.title});return answer;},showMessageBox:async()=>({response:0})};
    const scope='account:smoke-'+process.pid;
    const jar=prepareJar(scope,log);
    const nativeStatus={configured:true,signedIn:true,status:'signed-in',account:{synk_user_id:'smoke-'+process.pid,display_name:'시험'}};
    const workspace=createWorkspaceApp({clientId:'platform',getAccount:()=>account,createSurface:options=>workspaceHost.createSurface(options),closeSurfaceForExit:()=>workspaceHost.closeForExit(),isSurfaceVisible:()=>workspaceHost.visible(),
      session,dialog,openExternal:url=>externals.push(url),getDownloads:()=>userData,
      native:{status:()=>nativeStatus,companyRequest:()=>async operation=>({ok:true,operation})},
      // 본체는 화면 공유를 끈 채 낸다(GPT 엔진 검수 GA1, 단위 시험이 지킨다). 여기서는 켜서 고르기 길이 진짜 Electron에서 도는지 본다
      screenShare:true,chooseShare:async()=>{shares.push(1);return pick();}});
    // 고르기는 이 시험 창 자신(검은 data: 문서)만 준다. 실제 화면은 잡지 않는다
    let pick=()=>({video:win.webContents.mainFrame});
    const opened=await workspace.open();
    const view=win.contentView.children.at(-1),contents=view?.webContents;
    log.contents=()=>contents;
    check('Workspace opens as a view in the platform window, hidden until placed',opened?.ok===true&&!!contents&&view.getVisible()===false&&contents.session===jar,{opened,children:win.contentView.children.length});
    workspaceHost.place({visible:true,top:56});
    const [w,h]=win.getContentSize();
    check('the view fills the window under the band',JSON.stringify(view.getBounds())===JSON.stringify({x:0,y:56,width:w,height:h-56})&&view.getVisible());
    const scripts=(jar.getPreloadScripts?.()||[]).map(script=>script.id);
    const top=await contents.executeJavaScript('({native:window.synkDesktop?Object.keys(window.synkDesktop).sort():null,marker:window.__workspaceSessionPreload===true,url:location.href})');
    check('the view preload and the session preloads run together on the company document',top.marker===true&&scripts.includes('synk-company-entry')&&top.url==='https://workspace.synk.im/?tab=messenger',{scripts,top});
    check('the native link has exactly the seven names on the top company document',JSON.stringify(top.native)===JSON.stringify(['accountRequest','authCancelSignIn','authSignIn','authSignOut','authStatus','companyRequest','onAuthChanged'].sort()),{names:top.native});
    const status=await contents.executeJavaScript('window.synkDesktop.authStatus()');
    const company=await contents.executeJavaScript("window.synkDesktop.companyRequest('status')");
    check('native calls reach main through the view only',status?.status==='signed-in'&&company?.operation==='status',{status:status?.status,company});
    // 직원 초대 문서(/)에서는 회사 입구 preload가 실제로 돌아 제 표시를 내놓고, native 연결도 함께 선다(GPT 엔진 검수 GA8)
    await contents.loadURL('https://workspace.synk.im/');
    const employee=await contents.executeJavaScript('({entry:!!window.synkCompanyEntryHost,native:!!window.synkDesktop,url:location.href})');
    check('on the employee document the real company entry preload and the native link run together',employee.entry===true&&employee.native===true&&employee.url==='https://workspace.synk.im/',{employee});
    await contents.loadURL('https://workspace.synk.im/?tab=messenger');
    const messenger=contents.mainFrame.frames.find(frame=>frame.url==='https://workspace.synk.im/messenger/');
    const inFrame=messenger?await messenger.executeJavaScript('({native:typeof window.synkDesktop,marker:window.__workspaceSessionPreload===true})'):null;
    check('the messenger iframe has no native link',!!messenger&&inFrame?.native==='undefined',{inFrame});

    // 마이크: 메신저 iframe이 소리만 청하면 관리자는 허락으로 판정한다(Electron에는 거절을 주어 장치는 열지 않는다)
    const mic=await messenger.executeJavaScript("navigator.mediaDevices.getUserMedia({audio:true}).then(()=>'granted',e=>e.name)",true);
    const micAsk=log.permissions.find(entry=>entry.permission==='media'&&JSON.stringify(entry.mediaTypes)==='["audio"]');
    check('an audio-only request from the messenger iframe reaches the manager and is judged allowed',!!micAsk&&micAsk.allowed===true&&micAsk.sameContents===true&&micAsk.requestingUrl==='https://workspace.synk.im/messenger/',{mic,micAsk:micAsk||null,all:log.permissions.length});
    const cam=await messenger.executeJavaScript("navigator.mediaDevices.getUserMedia({video:true}).then(()=>'granted',e=>e.name)",true);
    const camAsk=log.permissions.find(entry=>entry.permission==='media'&&(entry.mediaTypes||[]).includes('video'));
    check('a camera request is judged refused',!camAsk||camAsk.allowed===false,{cam,camAsk:camAsk||null});
    const notice=await contents.executeJavaScript('Notification.requestPermission()',true);
    check('notifications are refused',notice==='denied'&&!log.permissions.some(entry=>entry.permission==='notifications'&&entry.allowed),{notice});

    // 화면 공유: 보이는 동안 iframe이 청하면 권한 단계에서 본체의 고르기를 한 번 묻고, 고른 것만 영상으로 받는다. 소리는 주지 않는다
    const STREAM=".then(s=>{const kinds=s.getTracks().map(t=>t.kind).join('+');s.getTracks().forEach(t=>t.stop());return 'granted:'+kinds;},e=>e.name)";
    const shared=await messenger.executeJavaScript("navigator.mediaDevices.getDisplayMedia({video:true,audio:true})"+STREAM,true);
    const shareAsk=log.permissions.find(entry=>entry.permission==='media'&&JSON.stringify(entry.mediaTypes)==='[]');
    check('a screen share from the visible messenger iframe asks the picker once at the permission step and gets the picked video only',shares.length===1&&shared==='granted:video'&&shareAsk?.allowed===true&&log.displays.length===1&&log.displays[0].frame?.url==='https://workspace.synk.im/messenger/'&&log.displays[0].frame?.top===true,{shared,asks:shares.length,shareAsk:shareAsk||null,displays:log.displays});
    workspaceHost.place({visible:false,top:56});
    const hidden=await messenger.executeJavaScript("navigator.mediaDevices.getDisplayMedia({video:true})"+STREAM,true);
    check('a screen share while the view is hidden is refused without asking',shares.length===1&&hidden!=='granted:video'&&log.displays.length===1,{hidden,asks:shares.length});
    workspaceHost.place({visible:true,top:56});
    // 옛 화면 캡처(chromeMediaSource)도 같은 권한 요청으로 온다. 고르기를 거치므로 사람이 고르지 않으면 열리지 않는다
    pick=()=>null;
    const legacy=await messenger.executeJavaScript("navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'desktop'}}})"+STREAM,true);
    check('a legacy desktop capture asks the same picker and is refused when nothing is picked',shares.length===2&&legacy==='NotAllowedError'&&log.displays.length===1,{legacy,asks:shares.length});

    // 바깥 최상위 문서로 가려는 페이지는 막히고 시스템 브라우저로 넘긴다. 문서는 회사 문서 그대로다
    await contents.executeJavaScript("location.href='https://example.invalid/away';1",true);await wait(300);
    check('a page that tries to leave for a foreign document stays and the address goes to the system browser',contents.getURL()==='https://workspace.synk.im/?tab=messenger'&&externals.includes('https://example.invalid/away'),{url:contents.getURL(),externals});
    await wait(1600);
    const opener=await contents.executeJavaScript("String(window.open('https://example.org/help'))",true);await wait(100);
    check('window.open goes to the system browser, not a new window',opener==='null'&&externals.includes('https://example.org/help')&&BrowserWindow.getAllWindows().length===1,{externals,windows:BrowserWindow.getAllWindows().length});

    // 창을 닫으면 PULSE 문, Workspace 문이 차례로 묻는다
    const pulse=pulseHost.createSurface({backgroundColor:'#000000',webPreferences:prefs});
    installDraftExitGuard({contents:pulse.webContents,window:pulse.dialogParent(),dialog,text:{title:'SYNK PULSE',message:'시험',detail:'시험'}});
    await pulse.loadURL(PULSE);
    let kept=0,quits=0;
    pulseHost.installCloseGate(win,{quitting:()=>false,quit:()=>{quits++;},onKept:()=>{kept++;}});
    workspaceHost.installCloseGate(win,{quitting:()=>false,quit:()=>{quits++;},onKept:()=>{kept++;}});
    await contents.executeJavaScript('window.dirty=true;1',true);
    answer=0;
    win.close();await wait(800);
    check('「돌아가서 저장」 in Workspace keeps Workspace and the window; the clean PULSE closed first',pulse.isDestroyed()&&!contents.isDestroyed()&&!win.isDestroyed()&&kept===1&&asked.length===1&&asked[0].title==='SYNK Workspace'&&asked[0].parent===win,{asked:asked.map(a=>a.title),kept,pulse:pulse.isDestroyed()});
    // 계정이 바뀌면 묻지 않고 닫는다
    account={signedIn:true,status:'signed-in',account:{synk_user_id:'smoke-other-'+process.pid}};
    workspace.syncContext(account);await wait(200);
    check('another account closes the Workspace view without asking',contents.isDestroyed()&&asked.length===1&&!workspace.hasSurface(),{asked:asked.length});
    win.close();await wait(500);
    check('with both spaces gone the window closes',win.isDestroyed());
    workspace.dispose();
  }catch(error){check('smoke ran without throwing',false,{error:String(error?.stack||error).slice(0,600)});}
  const failed=results.filter(r=>!r.ok).length;
  process.stdout.write(JSON.stringify({total:results.length,failed})+'\n');
  try{fs.rmSync(userData,{recursive:true,force:true});}catch{}
  app.exit(failed?1:0);
});
app.on('window-all-closed',()=>{});
