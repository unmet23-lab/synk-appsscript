'use strict';
// Synthetic provider + in-memory PostgreSQL. Runs the real native auth, DPAPI,
// IPC, preload, security rules and compiled teacher UI; no external login.
const {app,BrowserWindow,session,ipcMain,safeStorage}=require('electron');
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto');
const {createFixture}=require('../../../SYNK-talk/tools/qa-synk-classroom-fixture.cjs');
const {configuration}=require('../src/auth-config.cjs'),{createTokenStore}=require('../src/auth-store.cjs'),{createAuthService}=require('../src/auth-service.cjs');
const {preferences}=require('../src/security.cjs'),{TEACHER}=require('../src/teacher-preview.cjs'),{secureTeacherSession,secureTeacherWindow}=require('../src/teacher-security.cjs'),{bindTeacherIPC,sendTeacherAuth}=require('../src/teacher-account.cjs');
const artifactPrefix=process.argv.find(arg=>arg.startsWith('--artifact-prefix='))?.slice(18)||'teacher-account-native';
if(!/^[a-z0-9][a-z0-9-]{0,100}$/.test(artifactPrefix))throw Error('Invalid artifact prefix');
app.enableSandbox();app.setPath('userData',path.join(os.tmpdir(),'synk-teacher-native-qa-'+process.pid));
const checks=[],errors=[],calls=[];let fixture,provider,window,auth,unbind,temporary;
const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,...(detail?{detail}:{})});console.log(JSON.stringify({check:name,ok:!!ok}));if(!ok)throw Error(name);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label,timeout=15000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{if(await fn())return;}catch(error){last=error;}await sleep(50);}throw Error('Timeout: '+label+(last?' ('+String(last)+')':''));}
async function listen(server){await new Promise(r=>server.listen(0,'127.0.0.1',r));return server.address().port;}
async function close(server){if(!server)return;server.closeAllConnections();await new Promise(r=>server.close(r));}
async function run(code){let timeout;try{return await Promise.race([window.webContents.executeJavaScript(code,true),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Native renderer evaluation timed out')),20000);})]);}finally{clearTimeout(timeout);}}
const child=()=>window.webContents.mainFrame.frames.find(f=>f.url.includes('/teacher-world/'));
app.whenReady().then(async()=>{try{
  fixture=await createFixture();const {users,sql,cls}=fixture;
  const student=await fixture.api('learner','/api/student');await fixture.api('learner','/api/world/sharing',{enabled:true,revision:student.sharing.revision});
  const callbackProbe=http.createServer(),callbackPort=await listen(callbackProbe);await close(callbackProbe);
  const codes=new Map(),tokens=new Map(),refreshes=new Map();let serial=0,grants=0,classroomOffline=false;
  provider=http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,'http://127.0.0.1'),chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks).toString();
    const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    const access=req.headers.authorization?.replace('Bearer ','');
    if(url.pathname==='/auth/v1/oauth/authorize'){
      if(url.searchParams.get('client_id')!=='synthetic-teacher')return reply(400,{error:'unknown_client'});
      const code='code-'+crypto.randomUUID();codes.set(code,Object.fromEntries(url.searchParams));const target=new URL(url.searchParams.get('redirect_uri'));target.search=new URLSearchParams({code,state:url.searchParams.get('state')});res.writeHead(302,{Location:target.href});res.end();return;
    }
    if(url.pathname==='/auth/v1/oauth/token'){
      const form=new URLSearchParams(body),client=form.get('client_id');
      if(form.get('grant_type')==='authorization_code'){
        const saved=codes.get(form.get('code'));if(!saved||saved.client_id!==client||saved.redirect_uri!==form.get('redirect_uri')||saved.code_challenge!==crypto.createHash('sha256').update(form.get('code_verifier')).digest('base64url'))return reply(400,{error:'invalid_grant'});codes.delete(form.get('code'));grants++;
      }else{if(refreshes.get(form.get('refresh_token'))!==client)return reply(400,{error:'invalid_grant'});refreshes.delete(form.get('refresh_token'));}
      const token='synthetic-access-'+(++serial),refresh='synthetic-refresh-'+serial;tokens.set(token,client);refreshes.set(refresh,client);return reply(200,{token_type:'bearer',access_token:token,refresh_token:refresh,expires_in:3600});
    }
    if(tokens.get(access)!=='synthetic-teacher')return reply(401,{ok:false,error:{code:'AUTH_REQUIRED'}});
    if(url.pathname==='/auth/v1/user')return reply(200,{id:users.teacher.identity.id});
    if(url.pathname==='/auth/v1/logout'){tokens.delete(access);refreshes.clear();res.writeHead(204);res.end();return;}
    if(url.pathname==='/functions/v1/synk-account'||url.pathname.startsWith('/functions/v1/synk-classroom/')){
      if(classroomOffline&&url.pathname.startsWith('/functions/v1/synk-classroom/'))return reply(503,{ok:false,error:{code:'SERVICE_UNAVAILABLE',message:'합성 수업 연결 중단',retryable:true}});
      calls.push({path:url.pathname,product:req.headers['x-synk-product'],method:req.method});
      const response=await fetch(fixture.base+req.url,{method:req.method,headers:{...req.headers,host:new URL(fixture.base).host,authorization:'Bearer synthetic-teacher'},...(req.method==='POST'?{body}:{})});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
    }
    reply(404,{ok:false});
  }catch(error){errors.push(error.message);res.writeHead(500);res.end('{}');}});
  const origin='http://127.0.0.1:'+await listen(provider),entry=fixture.base+'/synk-account/teacher.html';
  const raw={version:1,supabaseUrl:origin,accountApiUrl:origin,supabasePublishableKey:'sb_publishable_synthetic',clients:{teacher:{clientId:'synthetic-teacher',redirectUri:`http://127.0.0.1:${callbackPort}/synk/oauth/teacher/callback`},world:{clientId:'synthetic-world',redirectUri:`http://127.0.0.1:${callbackPort+1}/synk/oauth/world/callback`}}};
  const config=configuration(raw,'teacher','development');temporary=await fsp.mkdtemp(path.join(os.tmpdir(),'synk-teacher-vault-'));
  const store=createTokenStore({directory:temporary,safeStorage,scope:TEACHER.sessionScope,configFingerprint:config.fingerprint});check('real Windows secure storage available',store.available());
  const createAuth=()=>createAuthService({config,store,openExternal:async url=>{const result=await fetch(url);check('real loopback PKCE callback accepted',result.status===200);},onChange:state=>sendTeacherAuth(window,state,entry)});
  auth=createAuth();await auth.initialize();
  const partition='persist:synk-teacher-native-qa-'+process.pid;secureTeacherSession(session.fromPartition(partition),entry);
  window=new BrowserWindow({width:1280,height:900,show:false,webPreferences:{...preferences(path.resolve(__dirname,'../src/teacher-preload.cjs'),partition),offscreen:true,backgroundThrottling:false}});secureTeacherWindow(window,entry);
  window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
  const bind=()=>bindTeacherIPC({ipcMain,getWindow:()=>window,auth,entry,environment:{clientId:'teacher',authProduct:'world',sessionScope:TEACHER.sessionScope,separateClient:true,productionReady:false}});unbind=bind();
  await window.loadURL(entry);await wait(()=>run(`!!document.getElementById('connect')&&!document.getElementById('connect').hidden`),'login entry');
  check('standalone renderer has no WORLD launcher or Node bridge',await run(`typeof require==='undefined'&&typeof synkDesktop==='undefined'&&!!synkTeacher&&!document.querySelector('iframe')`));
  await run(`document.getElementById('connect').click()`);await wait(()=>!!child(),'teacher iframe');await wait(()=>child().executeJavaScript(`document.documentElement?.dataset.ready==='true'`),'teacher ready');
  check('native PKCE login verified and scoped teacher class opened',grants===1&&auth.status().signedIn&&await child().executeJavaScript(`document.getElementById('class-title').textContent==='합성 검증 수업'`));
  check('iframe receives scoped host but no credentials or native bridge',await child().executeJavaScript(`typeof synkTeacher==='undefined'&&typeof require==='undefined'&&!Object.keys(parent.SYNKClassroomHost).some(k=>/token|login|learning|memory/i.test(k))`));
  check('all classroom HTTP calls use WORLD API product',calls.length>1&&calls.every(c=>c.product==='world'));
  const encrypted=await fsp.readFile(path.join(temporary,'auth-session.enc'));check('refresh token persisted with real DPAPI encryption',encrypted.length>20&&!encrypted.includes(Buffer.from('synthetic-refresh'))&&(await store.load()).refreshToken.startsWith('synthetic-refresh'));
  const worldStore=createTokenStore({directory:temporary,safeStorage,scope:'im.synk.world.preview',configFingerprint:configuration(raw,'world','development').fingerprint});let crossed=false;try{await worldStore.load();crossed=true;}catch{}check('WORLD cannot restore teacher encrypted session',!crossed);
  const invalid=await fetch(origin+'/auth/v1/oauth/token',{method:'POST',body:new URLSearchParams({grant_type:'refresh_token',client_id:'synthetic-world',refresh_token:(await store.load()).refreshToken})});check('provider rejects teacher refresh token for WORLD client',invalid.status===400);
  check('learner and arbitrary API IPC rejected',await run(`(async()=>{const a=await synkTeacher.accountRequest('learningGet',{after:0,revision:1}),b=await synkTeacher.accountRequest('classroom',{operation:'startRun',classId:'x',body:{}});return a.error.code==='INVALID_REQUEST'&&b.error.code==='INVALID_REQUEST';})()`));
  await child().executeJavaScript(`document.getElementById('assign').click();document.getElementById('content-select').value='reading-detail';document.getElementById('content-select').dispatchEvent(new Event('change'));document.querySelector('textarea[name=instructions]').value='교사 앱에서 보낸 읽기 확인';document.querySelector('#assignment-form button[type=submit]').click();`);
  await wait(async()=>((await fixture.state())?.assignments||[]).length===1,'teacher assignment');
  const assignment=(await fixture.state()).assignments[0];check('real teacher iframe assigns through native IPC and PostgreSQL',assignment.contentId==='reading-detail');
  const learnerView=await fixture.api('learner','/api/student');const assigned=learnerView.assignments.find(a=>a.id===assignment.id);check('learner API sees independent teacher assignment',!!assigned);
  const submitted=await fixture.api('learner','/api/submissions',{assignmentId:assignment.id,revision:assigned.revision,answers:{'detail-open':'b','detail-books':'b','detail-return':'c'},idempotencyKey:crypto.randomUUID()});check('learner API submits teacher assignment to canonical service',submitted.ok===true);
  await child().executeJavaScript(`document.getElementById('refresh').click()`);await wait(()=>child().executeJavaScript(`document.getElementById('assignments').textContent.includes('제출 완료')`),'teacher submission');check('native teacher UI displays actual WORLD result',true);
  classroomOffline=true;await run(`window.__teacherHostBeforeNetworkLoss=window.SYNKClassroomHost;document.querySelector('.teacher-class-controls button').click()`);
  await wait(()=>run(`document.querySelector('#teacher-workspace > .small').textContent.includes('확인하지 못했어요')`),'temporary classroom outage');
  check('classroom outage retains teacher frame and blocks stale scoped requests',await run(`(()=>{try{window.SYNKClassroomHost.request('/api/workspace');return false;}catch(error){return error.code==='NETWORK_ERROR'&&!!document.querySelector('iframe')&&window.SYNKClassroomHost===window.__teacherHostBeforeNetworkLoss;}})()`));
  classroomOffline=false;await run(`document.querySelector('.teacher-class-controls button').click()`);await wait(()=>run(`document.getElementById('notice').textContent.includes('수업 연결이 복구')`),'classroom reconnect');
  check('successful membership recheck restores existing native teacher workspace and clears offline notice',await run(`window.SYNKClassroomHost===window.__teacherHostBeforeNetworkLoss&&!document.getElementById('notice').classList.contains('error')&&!document.querySelector('#teacher-workspace > .small').textContent.includes('확인하지 못했어요')`)&&await child().executeJavaScript(`document.getElementById('assignments').textContent.includes('제출 완료')`));
  const previousRefresh=(await store.load()).refreshToken;auth.dispose();unbind();auth=createAuth();unbind=bind();await auth.initialize();await wait(()=>!!child(),'restored teacher iframe');await wait(()=>child().executeJavaScript(`document.documentElement?.dataset.ready==='true'`),'restored teacher ready');
  check('new native auth service restores DPAPI session and rotates refresh for same teacher',auth.status().signedIn&&grants===1&&(await store.load()).refreshToken!==previousRefresh&&await child().executeJavaScript(`document.getElementById('class-title').textContent==='합성 검증 수업'`));
  await child().executeJavaScript(`document.querySelector('[data-view=assignments]').click();document.getElementById('assignments').scrollIntoView({block:'start'});`);
  await fsp.mkdir(path.join(__dirname,'../artifacts'),{recursive:true});
  for(const width of [1280,390]){
    window.setContentSize(width,900);await sleep(300);
    await child().executeJavaScript(`document.getElementById('assignments').scrollIntoView({block:'start'});`);
    check('teacher native responsive width '+width,await run(`document.documentElement.scrollWidth===document.documentElement.clientWidth`)&&await child().executeJavaScript(`document.documentElement.scrollWidth===document.documentElement.clientWidth`));
    const picture=await Promise.race([window.webContents.capturePage(),sleep(5000).then(()=>{throw Error('Native capture timed out');})]);await fsp.writeFile(path.join(__dirname,`../artifacts/${artifactPrefix}-${width}.png`),picture.toPNG());
  }
  await sql`delete from engine.staff_classes where staff_id=${users.teacher.id}::uuid and class_id=${cls.class_id}::uuid`;
  await run(`document.querySelector('.teacher-class-controls button').click()`);await wait(()=>run(`!document.querySelector('iframe')&&!window.SYNKClassroomHost`),'revoked classroom removed');check('teacher membership withdrawal closes existing classroom',true);
  check('teacher with no assigned class sees clear empty state and no learner fallback',auth.status().signedIn&&await run(`document.getElementById('teacher-workspace').textContent.includes('등록된 담당 수업이 없어요')&&!document.getElementById('sign-out').hidden&&!document.getElementById('world-games')`));
  const denied=await run(`synkTeacher.accountRequest('classroom',{operation:'workspace',classId:${JSON.stringify(cls.class_id)}})`);check('revoked teacher cannot request former class through IPC',denied.ok===false&&denied.error.status===403);
  await run(`document.getElementById('sign-out').click()`);await wait(()=>!auth.status().signedIn,'logout');await wait(()=>run(`!document.getElementById('connect').hidden&&!document.querySelector('iframe')`),'logout entry');check('logout removes native token vault and scoped host',!(await store.load())&&await run(`!window.SYNKClassroomHost`));
  await wait(async()=>{const [row]=await sql`select revoked_at from engine.synk_sessions where auth_session_id=${users.teacher.identity.sessionId}::uuid`;return !!row?.revoked_at;},'server account session revoked');check('logout revokes actual PostgreSQL account session and provider refresh',refreshes.size===0);
  check('no visible window or external browser opened',!window.isVisible());check('no renderer or fixture errors',errors.length===0&&fixture.errors.length===0,errors);
}catch(error){checks.push({name:'run',ok:false,error:error?.stack||String(error)});}
finally{
  const report={checkedAt:new Date().toISOString(),synthetic:true,production:false,platform:process.platform,offscreenCompositor:true,scope:'actual Electron + DPAPI + PKCE loopback + native IPC + compiled teacher UI + PGlite classroom; learner submits through API, not WORLD UI; synthetic provider, no public auth registration',checks,errors,ok:checks.every(c=>c.ok)};
  fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,`../artifacts/${artifactPrefix}.json`),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,passed:checks.filter(c=>c.ok).length,total:checks.length,failures:checks.filter(c=>!c.ok)}));
  const ending=setTimeout(()=>app.exit(report.ok?0:1),5000);unbind?.();auth?.dispose();window?.destroy();await close(provider);await fixture?.close();if(temporary&&path.dirname(temporary)===os.tmpdir()&&path.basename(temporary).startsWith('synk-teacher-vault-'))await fsp.rm(temporary,{recursive:true,force:true});clearTimeout(ending);app.exit(report.ok?0:1);
}});
