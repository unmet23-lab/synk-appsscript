// 검정 구 4단계(docs/디자인/플랫폼_클라이언트_검정구_20261116/4단계_구현설계.md 7절): PC 앱의 native 연결에서 회사 비밀번호로 들어오거나
// 초대로 가입한 직후, 아직 SYNK ID에 이어지지 않은 회사 계정을 방금 넣은 비밀번호로 지금 SYNK ID에 잇는다. 실패하면 방금 만든 회사 세션을 끝낸다.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./public/synk-id.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const signedIn=(account=id,generation=1,name='유호')=>({configured:true,signedIn:true,status:'signed-in',sessionGeneration:generation,account:{synk_user_id:account,display_name:name}});

function fixture({auth=signedIn(),me={user:{id:'company-A'},csrfToken:'csrf-A',synkUserId:null},request,native=true,form=true,meApi=false}={}){
  const calls=[],moves=[],appended=[],renders=[],authListeners=[];let currentAuth=auth,currentMe=me;
  const formEl={isConnected:true,append(node){appended.push(node);}};
  const document={addEventListener(){},querySelector:selector=>selector==='#auth-form'&&form?formEl:selector==='#synk-link-note'?appended.find(node=>node.id==='synk-link-note')||null:null,createElement:()=>{const node={id:'',className:'',textContent:'',remove(){const at=appended.indexOf(node);if(at>=0)appended.splice(at,1);}};return node;}};
  const desktop={authStatus:async()=>currentAuth,onAuthChanged(fn){authListeners.push(fn);return()=>{};},
    companyRequest:async(operation,params)=>{calls.push({operation,params});if(request)return request(operation,params);
      if(operation==='status')return {enabled:true,linked:false,canLink:true,session:'company'};
      if(operation==='challenge')return {challenge:'synthetic-challenge'};
      if(operation==='exchange'){currentMe={...currentMe,synkUserId:currentAuth.account.synk_user_id};return {ok:true,linked:true};}
      if(operation==='logout'){currentMe={user:null,csrfToken:'',synkUserId:null};return {ok:true};}
      return {ok:true};}};
  const context=vm.createContext({window:{...(native?{synkDesktop:desktop}:{}),addEventListener(){}},document,
    fetch:async(path,options)=>{calls.push({path,options});return {ok:true,status:200,json:async()=>currentMe};},
    location:{href:'https://workspace.synk.im/',pathname:'/',search:'',hash:'',replace:value=>moves.push(value),reload:()=>moves.push('reload')},
    history:{replaceState(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},URL,URLSearchParams,AbortSignal,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},
    state:{user:null,csrf:''},renderAuth(){renders.push({mode:context.state.authMode,notice:context.state.authNotice});},notify(){},modal(){},closeModal(){},escape:String,api:async path=>{if(meApi&&path==='/api/me')return currentMe;throw Error('api() must not be used here');}});
  vm.runInContext(source,context);
  return {run:code=>vm.runInContext(code,context),calls,moves,appended,renders,authListeners,setAuth:value=>{currentAuth=value;},setRequest:value=>{request=value;},get me(){return currentMe;}};
}

test('the native sign-in line names the SYNK ID the company account will be linked to',async()=>{
  const f=fixture();await f.run('installNativeLinkNote()');
  assert.equal(f.appended.length,1);assert.equal(f.appended[0].id,'synk-link-note');
  assert.equal(f.appended[0].textContent,'들어오면 이 회사 계정이 SYNK ID(유호)에 이어져요.');
  const nameless=fixture({auth:signedIn(id,1,'')});await nameless.run('installNativeLinkNote()');
  assert.equal(nameless.appended[0].textContent,'들어오면 이 회사 계정이 지금 로그인한 SYNK ID에 이어져요.','no name keeps a whole sentence (검수 A3)');
  const browser=fixture({native:false});await browser.run('installNativeLinkNote()');assert.equal(browser.appended.length,0,'a browser has no native link');
  const signedOut=fixture({auth:{configured:true,signedIn:false,status:'signed-out',sessionGeneration:1,account:null}});await signedOut.run('installNativeLinkNote()');
  assert.equal(signedOut.appended.length,0);assert.equal(await signedOut.run("linkNativeCompanyAfterPassword('pw-synthetic')"),false);
});

test('a password session that is not linked yet is linked with the password just typed, then reloads the messenger',async()=>{
  const f=fixture();await f.run('installNativeLinkNote()');
  assert.equal(await f.run("linkNativeCompanyAfterPassword('pw-synthetic')"),true);
  const ops=f.calls.filter(call=>call.operation).map(call=>call.operation);
  assert.deepEqual(ops,['status','challenge','exchange']);
  assert.equal(JSON.stringify(f.calls.find(call=>call.operation==='challenge').params),JSON.stringify({action:'link',currentPassword:'pw-synthetic',csrfToken:'csrf-A',confirm:true}));
  assert.equal(JSON.stringify(f.calls.find(call=>call.operation==='exchange').params),JSON.stringify({challenge:'synthetic-challenge',confirm:true}));
  assert.deepEqual(f.moves,['/?tab=messenger'],'the invite document / is left for the messenger entry');
  assert.equal(f.me.synkUserId,id);
});

test('nothing happens without the note, without a session or when the session already came in through SYNK ID',async()=>{
  const noNote=fixture();assert.equal(await noNote.run("linkNativeCompanyAfterPassword('pw-synthetic')"),false);assert.equal(noNote.calls.length,0);
  const synk=fixture({me:{user:{id:'company-A'},csrfToken:'csrf-A',synkUserId:id}});await synk.run('installNativeLinkNote()');
  assert.equal(await synk.run("linkNativeCompanyAfterPassword('pw-synthetic')"),false);assert.equal(synk.calls.filter(call=>call.operation).length,0);
  const none=fixture({me:{user:null,csrfToken:'',synkUserId:null}});await none.run('installNativeLinkNote()');
  assert.equal(await none.run("linkNativeCompanyAfterPassword('pw-synthetic')"),false);
  const empty=fixture();await empty.run('installNativeLinkNote()');assert.equal(await empty.run("linkNativeCompanyAfterPassword('')"),false);
});

test('a SYNK ID or generation that changed after the note is never linked, and the new company session is ended',async()=>{
  for(const changed of [signedIn(other,1,'다른 사람'),signedIn(id,2)]){
    const f=fixture();await f.run('installNativeLinkNote()');f.setAuth(changed);
    await assert.rejects(f.run("linkNativeCompanyAfterPassword('pw-synthetic')"),error=>error.code==='SYNK_LINK_CHANGED');
    const ops=f.calls.filter(call=>call.operation).map(call=>call.operation);
    assert.deepEqual(ops,['logout']);assert.equal(JSON.stringify(f.calls.find(call=>call.operation==='logout').params),JSON.stringify({csrfToken:'csrf-A'}));
    assert.deepEqual(f.moves,[]);
    assert.equal(await f.run("linkNativeCompanyAfterPassword('pw-synthetic')"),false,'the failed stamp is dropped; a redrawn form takes a new one (검수 A2)');
  }
});

test('a refused link (already linked elsewhere) or an outage ends the unlinked session and says why',async()=>{
  const conflict=fixture({request:(operation)=>{if(operation==='status')return {enabled:true};if(operation==='challenge')return {challenge:'c'};if(operation==='exchange')throw Object.assign(new Error('이미 다른 계정에 연결되어 있습니다. 기존 연결을 먼저 해제해 주세요.'),{code:'LINK_CONFLICT'});return {ok:true};}});
  await conflict.run('installNativeLinkNote()');
  await assert.rejects(conflict.run("linkNativeCompanyAfterPassword('pw-synthetic')"),error=>error.code==='LINK_CONFLICT'&&/이미 다른 계정/.test(error.message));
  assert.deepEqual(conflict.calls.filter(call=>call.operation).map(call=>call.operation),['status','challenge','exchange','logout']);assert.deepEqual(conflict.moves,[]);
  const closed=fixture({request:(operation)=>{if(operation==='status')return {enabled:false};return {ok:true};}});await closed.run('installNativeLinkNote()');
  await assert.rejects(closed.run("linkNativeCompanyAfterPassword('pw-synthetic')"),error=>error.code==='SYNK_LINK_UNAVAILABLE');
  assert.deepEqual(closed.calls.filter(call=>call.operation).map(call=>call.operation),['status','logout']);
});

test('the sign-in and join submit link right after the password response, before the native check, and drop the password',()=>{
  const at=appSource.indexOf("case 'auth': {"),end=appSource.indexOf("case 'add-channels'",at),block=appSource.slice(at,end);
  const sent=block.indexOf('await api(endpoint, values)'),link=block.indexOf('linkNativeCompanyAfterPassword(password)'),check=block.indexOf('prepareSynkCompanyEntry()');
  assert.ok(sent>0&&link>sent&&check>link,'link runs between the password response and the native check');
  assert.match(block,/endpoint === '\/api\/join' \|\| endpoint === '\/api\/login'/);
  assert.match(block,/const password = values\.password; values\.password = '';/);
  // 잇기가 실패하면 로그인 칸을 새로 그리고 까닭을 안내로, 회사 이메일을 미리 채운다(가입 칸에는 이메일 칸이 없다, 검수 A1 · A2)
  assert.ok(block.includes("catch (linkError) { state.authMode = 'login'; state.authToken = ''; state.authNotice = linkError?.message"),'a failed link goes back to the login form');
  assert.ok(block.includes("state.authPrefill = String(signedIn?.user?.email || values.email || ''); renderAuth(); break; }"),'with the company e-mail filled in');
  assert.ok(block.includes('let signedIn=null;try{signedIn=await api(endpoint, values);}'));
  const render=appSource.slice(appSource.indexOf('function renderAuth()'),appSource.indexOf('function shell('));
  assert.match(render,/\(join\|\|login\)&&typeof installNativeLinkNote==='function'/);
});

// 회사 화면 Fable 최종(pc-orb-step4-company-web-20261122)
test('a SYNK ID with no linked company account opens the login form with a line, not the error screen (F1)',async()=>{
  const f=fixture({meApi:true,me:{user:null,csrfToken:'',synkUserId:null},request:(operation)=>{if(operation==='status')return {enabled:true};if(operation==='challenge')return {challenge:'c'};if(operation==='exchange')throw Object.assign(new Error('기존 회사 계정에서 SYNK ID를 먼저 연결해 주세요.'),{code:'NOT_LINKED'});return {ok:true};}});
  assert.equal(await f.run('prepareNativeSynkCompanyEntry()'),false);
  assert.deepEqual(f.renders.map(r=>r.mode),['login']);
  assert.equal(f.renders[0].notice,'이 SYNK ID에 이어진 회사 계정이 아직 없어요. 회사 비밀번호로 한 번 들어오면 지금 SYNK ID에 이어져요.');
  const other=fixture({meApi:true,me:{user:null,csrfToken:'',synkUserId:null},request:(operation)=>{if(operation==='status')return {enabled:true};if(operation==='challenge')return {challenge:'c'};throw Object.assign(new Error('잠시 뒤'),{code:'COMPANY_UNAVAILABLE'});}});
  await assert.rejects(other.run('prepareNativeSynkCompanyEntry()'),error=>error.code==='SYNK_PLATFORM_ENTRY');
  assert.deepEqual(other.renders,[],'other failures keep the error screen');
});

test('a SYNK ID sign-in after the form was drawn redraws the line and takes a new stamp (F2)',async()=>{
  const f=fixture({auth:{configured:true,signedIn:false,status:'signed-out',sessionGeneration:1,account:null}});
  await f.run('installNativeLinkNote()');assert.equal(f.appended.length,0);
  f.setAuth(signedIn(id,2,'유호'));for(const listener of f.authListeners)listener();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.appended.length,1);assert.equal(f.appended[0].textContent,'들어오면 이 회사 계정이 SYNK ID(유호)에 이어져요.');
  assert.equal(await f.run("linkNativeCompanyAfterPassword('pw-synthetic')"),true);
  f.setAuth(signedIn(other,3,'다른 사람'));for(const listener of f.authListeners)listener();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.appended.length,1,'the old line is replaced, not added to');assert.equal(f.appended[0].textContent,'들어오면 이 회사 계정이 SYNK ID(다른 사람)에 이어져요.');
});

test('a SYNK ID that changes between the link requests is never linked (F3)',async()=>{
  const f=fixture();await f.run('installNativeLinkNote()');
  f.setRequest(operation=>{if(operation==='status')return {enabled:true};if(operation==='challenge'){f.setAuth(signedIn(other,1,'다른 사람'));return {challenge:'c'};}if(operation==='exchange')throw Error('exchange must not run');return {ok:true};});
  await assert.rejects(f.run("linkNativeCompanyAfterPassword('pw-synthetic')"),error=>error.code==='SYNK_LINK_CHANGED');
  assert.deepEqual(f.calls.filter(call=>call.operation).map(call=>call.operation),['status','challenge','logout']);
});
