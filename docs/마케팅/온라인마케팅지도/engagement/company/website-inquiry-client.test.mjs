import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('./public/website-inquiries.js',import.meta.url),'utf8');
const healthSource=await readFile(new URL('./public/automation-health.js',import.meta.url),'utf8');
// 13판 그리기 도우미(mt*)는 maker-tools.js 앞 절반에 있다 — 탭 파일보다 먼저 읽는다.
const kit=await readFile(new URL('./public/maker-tools.js',import.meta.url),'utf8');
const kitFront=kit.slice(0,kit.indexOf('\n// ── 상태와 화면 바꾸기'));
function fixture(){
  const listeners={};
  const context=vm.createContext({
    state:{user:{id:'admin',role:'admin'},tab:'workroom'},wr:{view:'tools'},makerTools:{view:'inquiries'},
    document:{addEventListener(name,callback){listeners[name]=callback;}},
    location:{search:''},URLSearchParams,Date,Intl,FormData,
    escape:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    api:async()=>({}),render(){},notify(){},confirm:()=>true,navigator:{clipboard:{writeText:async()=>{}}},
  });
  vm.runInContext(kitFront,context);
  vm.runInContext(source+'\nglobalThis.testExports={state:websiteInquiryState,panel:websiteInquiriesPanel,load:wiLoad,reset:websiteInquiriesReset,select:wiSelect,ensure:websiteInquiriesEnsure,navCount:websiteInquiriesNavCount,mutate:wiMutate};',context);
  const api=context.testExports;api.state.identity='admin:admin';
  return {context,api,listeners};
}
const data=()=>({draftOnly:true,settings:{enabled:false,revision:0,intervalMinutes:5},connection:{configured:false,formId:'form-id'},run:{status:'not-connected',lastSuccessAt:null},items:[]});
const inquiry=(id,status,extra={})=>({id,email:id+'@example.test',type:'LAB · 한국어 교육',message:id+' 문의 내용',createdAt:'2026-10-21T01:00:00Z',revision:1,status,
  classification:{category:'lab',label:'한국어 교육',reason:'문의 양식에서 「LAB · 한국어 교육」 유형을 직접 골랐어요.',nextAction:'학습 목표 · 지금 수준 · 원하는 방식을 보고 답변을 다듬어요.',isTest:false},replyDraft:id+' 초안',task:null,...extra});
test('inquiry UI distinguishes missing connection from zero inquiries and offers no external send action',()=>{
  const f=fixture();f.api.state.data=data();const html=f.api.panel();
  assert.match(html,/연결 전에는 문의가 없다고 볼 수 없어요/);assert.match(html,/연결 전이라 비어 있어요/);assert.equal((html.match(/연결이 아직 없어요/g)||[]).length,1,'the connection guidance appears once, in the collection line');assert.doesNotMatch(html,/첫 수집 결과를 기다리고/,'before a connection the list does not promise a first collection');
  assert.match(html,/data-wi-action="collect" disabled>지금 수집</,'collecting needs a connection');
  assert.doesNotMatch(html,/고객에게 보내기|data-wi-action="send"|mailto:/);
  assert.doesNotMatch(html,/판단하지 않습니다|첫 수집 결과를 기다리고 있습니다/,'old formal sentences are gone');
});
test('contact text and draft render as escaped text and unsafe task URLs never become links',()=>{
  const f=fixture(),view=data();view.items=[{id:'i1',email:'<img src=x onerror=alert(1)>',type:'<script>',message:'<script>alert(1)</script>',createdAt:'2026-10-20T00:00:00Z',revision:1,status:'new',
    classification:{label:'<img>',reason:'<script>',nextAction:'확인',isTest:false},replyDraft:'</textarea><script>alert(1)</script>',task:{href:'javascript:alert(1)'}}];
  f.api.state.data=view;f.api.select('i1');const html=f.api.panel();
  assert.doesNotMatch(html,/<script>|<img src=x|javascript:/);assert.match(html,/&lt;script&gt;/);assert.match(html,/고객에게 보내지 않아요/);
  assert.doesNotMatch(html,/고객에게 발송되지 않습니다/);
});
test('identity changes discard an old pending response and erase cached customer data on reset',async()=>{
  const f=fixture();let resolve;f.context.api=()=>new Promise(done=>{resolve=done;});
  const pending=f.api.load();f.context.state.user={id:'other',role:'admin'};resolve(data());await pending;
  assert.equal(f.api.state.data,null);
  f.api.state.data={items:[{email:'private@example.test'}]};f.api.reset();assert.equal(f.api.state.data,null);assert.equal(f.api.state.draft,null);
});
test('non-admin panel contains no cached inquiry data',()=>{
  const f=fixture();f.context.state.user.role='member';f.api.state.identity='admin:member';
  f.api.state.data={...data(),items:[{email:'private@example.test'}]};assert.doesNotMatch(f.api.panel(),/private@example/);assert.match(f.api.panel(),/회사 관리자만/);
  assert.equal(f.api.navCount(),null,'non-admins get no menu count');
});
test('automation view uses an independent metadata-only inquiry section and preserves existing card contracts',()=>{
  const f=fixture();f.context.location.origin='https://workspace.example.test';f.context.URL=URL;
  vm.runInContext(healthSource+'\nglobalThis.healthTest={section:ahWebsiteInquiry,href:ahHref,cardCount:ahCardIds.length};',f.context);
  const {section,href,cardCount}=f.context.healthTest;
  assert.equal(cardCount,17);
  for(const status of ['not-connected','paused','failed','ready','running','catching-up']){
    const html=section({enabled:status!=='paused',configured:status!=='not-connected',status,lastSuccessAt:'2026-10-20T01:00:00Z',nextCheckAt:'2026-10-20T02:00:00Z',email:'PRIVATE@example.test',error:'PRIVATE customer diagnostic'});
    assert.match(html,/문의 접수함 열기/);assert.doesNotMatch(html,/PRIVATE|data-ah-card=/);assert.match(html,/최근 전체 수집 완료/);
  }
  assert.equal(href('/?tab=workroom&section=tools&tool=inquiries'),'/?tab=workroom&section=tools&tool=inquiries');
  const stopped=section({enabled:true,configured:true,status:'ready',schedulerEnabled:false,nextCheckAt:'2026-10-20T02:00:00Z'});
  assert.match(stopped,/서버 자동 수집 꺼짐|예약 꺼짐/);assert.doesNotMatch(stopped,/5분마다 문의를 읽어/);
  assert.match(section(null),/상태 확인 불가/);
  f.context.state.user.role='member';assert.equal(section({enabled:true,configured:true,status:'ready'}),'');
});

test('enabled collection settings never imply execution when the server scheduler is stopped',()=>{
  const f=fixture();f.api.state.data={...data(),settings:{enabled:true,revision:1,intervalMinutes:5},connection:{configured:true,formId:'form-id'},run:{status:'ready'},schedulerEnabled:false};
  const html=f.api.panel();assert.match(html,/서버 자동 수집 꺼짐/);assert.match(html,/주기적으로 돌지 않아요/);assert.match(html,/data-wi-action="collect"\s*>지금 수집</);
  assert.doesNotMatch(html,/5분마다 ·|다음 수집/,'a stopped scheduler shows no interval or next run');
  assert.doesNotMatch(html,/주기적으로 실행되지 않습니다/);
});

test('the list puts new and reviewing customer inquiries first and keeps test responses out of counts',()=>{
  const f=fixture(),view={...data(),connection:{configured:true,formId:'form-id'},settings:{enabled:true,revision:1,intervalMinutes:5},run:{status:'ready',lastSuccessAt:'2026-10-21T01:05:00Z',nextCheckAt:'2026-10-21T01:10:00Z'}};
  view.items=[inquiry('done','replied'),inquiry('review','reviewing'),inquiry('fresh','new'),inquiry('closed','closed'),inquiry('check','new',{classification:{category:'test',label:'합성 기능 점검',reason:'문의 내용에 기능 점검 표식이 있어요.',nextAction:'기능 점검 응답이라 고객 문의 수에서 빠져요.',isTest:true},replyDraft:''})];
  f.api.state.data=view;let html=f.api.panel();
  const rows=()=>[...html.matchAll(/data-wi-open="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(rows(),['fresh','review'],'open scope shows only new and reviewing customer inquiries');
  assert.match(html,/5분마다 · 마지막 전체 수집/);assert.match(html,/다음 수집/);
  assert.match(html,/기능 점검 응답 1건은 「모두」에서 봐요/);
  assert.deepEqual({...f.api.navCount()},{value:1,tone:'',label:'새 문의'},'the menu count is new customer inquiries only');
  f.api.state.scope='all';html=f.api.panel();
  assert.deepEqual(rows(),['fresh','review','done','closed','check']);
  assert.match(html,/<span>새 문의<\/span><strong>1<small>건/,'the meter counts the one new customer inquiry, not the test response');
});

test('loading opens the first new inquiry so the first screen shows its draft and next step',async()=>{
  const f=fixture(),view={...data(),connection:{configured:true,formId:'form-id'},settings:{enabled:true,revision:1,intervalMinutes:5},run:{status:'ready',lastSuccessAt:'2026-10-21T01:05:00Z'}};
  view.items=[inquiry('review','reviewing'),inquiry('fresh','new')];f.context.api=async()=>view;
  await f.api.load();assert.equal(f.api.state.selected,'fresh');
  const html=f.api.panel();
  assert.match(html,/data-wi-now/);assert.match(html,/답변 초안을 다듬어요/);assert.match(html,/data-wi-action="draft"/);assert.match(html,/fresh 초안/);
  assert.match(html,/name="status" value="new" checked/);
});

test('after copying a draft the next step asks to mark it replied, which saves the edited draft with the replied status',async()=>{
  const f=fixture(),view={...data(),connection:{configured:true,formId:'form-id'},settings:{enabled:true,revision:1,intervalMinutes:5},run:{status:'ready',lastSuccessAt:'2026-10-21T01:05:00Z'}};
  view.items=[inquiry('fresh','new')];const calls=[];f.context.api=async(path,body)=>{calls.push({path,body});return path==='/api/website-inquiries'?view:{item:{}};};
  await f.api.load();f.api.state.draft.replyDraft='고친 초안';f.api.state.dirty=true;
  const click=action=>f.listeners.click({target:{closest:selector=>selector==='[data-wi-action]'?{dataset:{wiAction:action},disabled:false}:null}});
  await click('copy');assert.ok(f.api.state.copied.fresh,'the copy time is kept for this inquiry');
  const html=f.api.panel();assert.match(html,/복사한 초안을 메일로 보냈나요/);assert.match(html,/에 복사했어요/);assert.doesNotMatch(html,/복사함/);assert.doesNotMatch(html,/보냈어요|보냄/,'copying never claims the mail was sent');
  await click('replied');
  const save=calls.find(call=>call.path==='/api/website-inquiries/fresh');assert.ok(save,'the replied action saves the inquiry');
  assert.deepEqual({...save.body},{revision:1,status:'replied',replyDraft:'고친 초안'});
  assert.equal(f.api.state.copied.fresh,undefined);assert.equal(calls.at(-1).path,'/api/website-inquiries','the list reloads after saving');
});

test('a paused collector on a server whose scheduler is off never promises periodic collection',()=>{
  const f=fixture();f.api.state.data={...data(),settings:{enabled:false,revision:1,intervalMinutes:5},connection:{configured:true,formId:'form-id'},run:{status:'paused',lastSuccessAt:null},schedulerEnabled:false};
  const html=f.api.panel();assert.match(html,/설정을 켜도 주기적으로 돌지 않아요/);assert.doesNotMatch(html,/켜면 5분마다 새 문의를 모아요/);assert.match(html,/자동 수집 설정 켜기/);
  f.api.state.data.schedulerEnabled=true;assert.match(f.api.panel(),/켜면 5분마다 새 문의를 모아요/);
});

test('the reviewing card names the same step as its pill, and marking replied needs a draft',()=>{
  const f=fixture(),view={...data(),connection:{configured:true,formId:'form-id'},settings:{enabled:true,revision:1,intervalMinutes:5},run:{status:'ready',lastSuccessAt:'2026-10-21T01:05:00Z'}};
  view.items=[inquiry('review','reviewing')];f.api.state.data=view;f.api.select('review');
  let html=f.api.panel();assert.match(html,/다듬은 초안을 메일로 보내요/);assert.match(html,/data-wi-action="copy"/);assert.doesNotMatch(html,/메일로 보냈으면 「답변 완료」로 표시해요/);
  assert.match(html,/data-wi-action="replied" >답변 완료로 표시/);
  f.api.state.draft.replyDraft='   ';html=f.api.panel();assert.match(html,/data-wi-action="replied" disabled>답변 완료로 표시/,'an empty draft cannot be marked replied');
});

test('a deep link to a finished inquiry opens it and widens the list so the row stays visible',async()=>{
  const f=fixture(),view={...data(),connection:{configured:true,formId:'form-id'},settings:{enabled:true,revision:1,intervalMinutes:5},run:{status:'ready',lastSuccessAt:'2026-10-21T01:05:00Z'}};
  view.items=[inquiry('fresh','new'),inquiry('done','replied')];f.context.api=async()=>view;f.context.location.search='?inquiryId=done';
  await f.api.load();assert.equal(f.api.state.selected,'done');assert.equal(f.api.state.scope,'all');
  assert.match(f.api.panel(),/data-wi-open="done" data-wi-row="replied" data-search="[^"]*" aria-current="true"/);
});

test('a status saved out of the open list keeps the inquiry selected and visible, and a save never leaves the screen loading',async()=>{
  const f=fixture(),view={...data(),connection:{configured:true,formId:'form-id'},settings:{enabled:true,revision:1,intervalMinutes:5},run:{status:'ready',lastSuccessAt:'2026-10-21T01:05:00Z'}};
  view.items=[inquiry('fresh','new'),inquiry('other','new')];const pending=[];f.context.api=(path,body)=>new Promise((resolve,reject)=>pending.push({path,body,resolve,reject}));
  const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  const click=action=>f.listeners.click({target:{closest:selector=>selector==='[data-wi-action]'?{dataset:{wiAction:action},disabled:false}:null}});
  const first=f.api.load();pending.shift().resolve(view);await first;assert.equal(f.api.state.selected,'fresh');
  const reload=f.api.load();assert.equal(f.api.state.loading,true);
  await click('replied');assert.equal(pending.length,1,'a change is not accepted while the list is being read');
  pending.shift().resolve(view);await reload;assert.equal(f.api.state.loading,false);
  const replied=click('replied');await settle();const request=pending.shift();assert.equal(request.path,'/api/website-inquiries/fresh');
  request.resolve({item:{...view.items[0],status:'replied',revision:2}});await settle();
  assert.equal(f.api.state.draft.status,'replied','the saved inquiry shows its new status before the list comes back');
  pending.shift().resolve({...view,items:[{...view.items[0],status:'replied',revision:2},view.items[1]]});await replied;
  assert.equal(f.api.state.selected,'fresh');assert.equal(f.api.state.scope,'all','the finished inquiry stays in the list');assert.equal(f.api.state.loading,false);
  // A save cuts off a reload in progress; when the save fails, the head buttons are not left locked behind a loading flag.
  const again=f.api.load();const failing=f.api.mutate('fresh',{revision:2,status:'closed',replyDraft:'초안'});assert.equal(f.api.state.loading,false);
  const [stale,save]=pending.splice(0,2);save.reject(Object.assign(new Error('그사이 문의가 바뀌었어요. 새로 읽어 주세요.'),{status:409}));assert.equal(await failing,null);
  stale.resolve(view);await again;assert.equal(f.api.state.loading,false);assert.equal(f.api.state.saving,false);assert.match(f.api.state.error,/새로 읽어 주세요/);
});

const ready=()=>({...data(),connection:{configured:true,formId:'form-id'},settings:{enabled:true,revision:1,intervalMinutes:5},run:{status:'ready',lastSuccessAt:'2026-10-21T01:05:00Z'}});
const press=f=>action=>f.listeners.click({target:{closest:selector=>selector==='[data-wi-action]'?{dataset:{wiAction:action},disabled:false}:null}});
const confirmation=(extra={})=>({id:'fresh',revision:1,google:'present',task:'linked',isTest:false,expiresAt:'2026-10-21T01:20:00Z',token:'1792000000000.'+'a'.repeat(64),...extra});
test('erasing asks the server first, keeps an unsaved draft while checking, names a Google original still there, then erases with the token',async()=>{
  const f=fixture(),view=ready(),calls=[],notes=[],click=press(f);
  view.items=[inquiry('fresh','new',{task:{state:'linked',href:'/?tab=messenger&panel=tasks&channelId=c&messageId=1'}}),inquiry('other','new')];
  f.context.notify=text=>notes.push(text);
  f.context.api=async(path,body)=>{calls.push({path,body});if(path==='/api/website-inquiries')return view;if(path.endsWith('/erase-check'))return {erasure:confirmation()};
    if(path.endsWith('/erase')){view.items=view.items.filter(row=>row.id!=='fresh');return {erased:{id:'fresh',erasedAt:'2026-10-21T01:11:00Z',task:'removed'}};}return {};};
  await f.api.load();assert.equal(f.api.state.selected,'fresh');
  let html=f.api.panel();
  assert.match(html,/data-wi-fold="erase"/);assert.match(html,/data-wi-action="erase-check"[^>]*>지우기 전에 확인</);assert.doesNotMatch(html,/data-wi-action="erase"[ >]/,'the erase button appears only after the check');
  f.api.state.draft.replyDraft='쓰던 초안';f.api.state.dirty=true;
  await click('erase-check');
  assert.equal(calls.at(-1).path,'/api/website-inquiries/fresh/erase-check');assert.deepEqual({...calls.at(-1).body},{revision:1});
  assert.equal(f.api.state.dirty,true,'checking keeps the unsaved draft');assert.equal(f.api.state.draft.replyDraft,'쓰던 초안');
  html=f.api.panel();
  assert.match(html,/이 문의를 지울까요\? 되돌릴 수 없어요/);assert.match(html,/data-wi-google="present"/);assert.match(html,/Google 원본에 이 응답이 아직 있어요/);assert.match(html,/href="https:\/\/docs.google.com\/forms\/d\/form-id\/edit#responses"/);
  assert.match(html,/data-wi-action="erase"[^>]*>Google 원본은 두고 지우기</);assert.match(html,/이 문의로 만든 「홈페이지 문의 답변 검토」 할 일도 함께 지워요/);
  assert.match(html,/<details class="mt-sec" open id="wi-sec-erase-fresh"/,'the section is open on the confirmation');
  await click('erase');
  const erase=calls.find(call=>call.path==='/api/website-inquiries/fresh/erase');assert.deepEqual({...erase.body},{revision:1,token:confirmation().token});
  assert.deepEqual(notes,['문의와 그 할 일을 지웠어요.']);assert.equal(f.api.state.erasure,null);
  assert.equal(calls.at(-1).path,'/api/website-inquiries','the list reloads');assert.equal(f.api.state.selected,'other','the next open inquiry opens');
  assert.doesNotMatch(f.api.panel(),/data-wi-open="fresh"/);
});

test('a confirmation belongs to one inquiry and one revision, and a failed erase goes back to the check',async()=>{
  const f=fixture(),view=ready(),click=press(f);view.items=[inquiry('fresh','new'),inquiry('other','new')];
  f.api.state.data=view;f.api.select('fresh');f.api.state.erasure=confirmation({google:'deleted',task:null});
  let html=f.api.panel();assert.match(html,/data-wi-action="erase"[^>]*>지우기</);assert.match(html,/Google 원본에서는 이미 지웠어요/);assert.doesNotMatch(html,/함께 지워요|Google 원본 열기<\/a><\/li>/);
  view.items[0]={...view.items[0],revision:2};html=f.api.panel();assert.match(html,/지우기 전에 확인/);assert.doesNotMatch(html,/이 문의를 지울까요/,'a changed revision needs a new check');
  view.items[0]={...view.items[0],revision:1};f.api.select('other');assert.equal(f.api.state.erasure,null,'opening another inquiry drops the confirmation');
  f.api.select('fresh');f.api.state.erasure=confirmation({google:'unknown',task:'pending'});
  f.context.api=async()=>{throw Object.assign(new Error('지우기 확인 시간이 지났거나 확인한 내용과 달라요. 「지우기 전에 확인」을 다시 눌러 주세요.'),{status:409});};
  html=f.api.panel();assert.match(html,/Google 원본을 확인하지 못했어요/);assert.match(html,/data-wi-action="erase"[^>]*>지우기</);assert.match(html,/함께 지워요/);
  await click('erase');assert.equal(f.api.state.erasure,null);html=f.api.panel();
  assert.match(html,/「지우기 전에 확인」을 다시 눌러 주세요/);assert.match(html,/data-wi-action="erase-check"/);assert.equal(f.api.state.selected,'fresh');assert.match(html,/data-wi-open="fresh"/);
  f.api.state.erasure=confirmation({task:'unreachable'});html=f.api.panel();assert.match(html,/그 할 일은 이제 쓰지 않는 관리자 계정의 방에 있어 그대로 둬요/);assert.doesNotMatch(html,/할 일도 함께 지워요/);
  for(const google of ['present','deleted','unknown']){f.api.state.erasure=confirmation({google});
    assert.doesNotMatch(f.api.panel().replace(/<[^>]+>/g,' '),/[가-힣](습니다|합니다|입니다|됩니다)[.!?]?(\s|$)/,'the confirmation speaks in the 해요 style');}
});

test('erase requests name themselves on their buttons, a failure stays inside section 03, and cancel or Escape goes back to the check',async()=>{
  const f=fixture(),view=ready(),click=press(f),pending=[],notes=[],settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  view.items=[inquiry('fresh','new'),inquiry('check','new',{classification:{category:'test',label:'합성 기능 점검',reason:'문의 내용에 기능 점검 표식이 있어요.',nextAction:'',isTest:true},replyDraft:''})];
  f.context.api=(path,body)=>new Promise((resolve,reject)=>pending.push({path,body,resolve,reject}));f.context.notify=text=>notes.push(text);
  const load=f.api.load();pending.shift().resolve(view);await load;f.api.select('fresh');
  const checking=click('erase-check');await settle();let html=f.api.panel();
  assert.match(html,/data-wi-action="erase-check"[^>]*>확인 중…</);assert.match(html,/type="submit" disabled>저장</,'the save button keeps its own word while the check runs');
  pending.shift().resolve({erasure:confirmation()});await checking;
  const erasing=click('erase');await settle();html=f.api.panel();assert.match(html,/data-wi-action="erase"[^>]*>지우는 중…</);assert.doesNotMatch(html,/저장 중…/);
  pending.shift().reject(Object.assign(new Error('이 문의의 할 일을 지우지 못해 문의도 그대로 뒀어요. 잠시 뒤 다시 해 주세요.'),{status:502}));await erasing;
  html=f.api.panel();assert.equal(f.api.state.error,'','the failure is not shown at the top, far from the section');
  assert.match(html,/class="mt-error wi-erase-error" role="alert"><span>이 문의의 할 일을 지우지 못해/);assert.match(html,/<details class="mt-sec" open id="wi-sec-erase-fresh"/);
  const again=click('erase-check');assert.equal(f.api.state.eraseError,null,'a new check clears the message');await settle();pending.shift().resolve({erasure:confirmation()});await again;
  await click('erase-cancel');assert.equal(f.api.state.erasure,null);
  const third=click('erase-check');await settle();pending.shift().resolve({erasure:confirmation()});await third;
  f.listeners.keydown({key:'Escape',target:{closest:selector=>selector==='[data-wi-erase]'?{}:null},preventDefault(){}});assert.equal(f.api.state.erasure,null,'Escape is 「그만두기」');
  assert.equal(pending.length,0,'nothing was erased');
  f.api.select('check');assert.match(f.api.panel(),/기능 점검 응답이에요\. 다 봤으면 지워도 돼요/,'a test response says so in section 03');
  // A task left in a room nobody opens is named in the notice.
  f.api.select('fresh');const fourth=click('erase-check');await settle();pending.shift().resolve({erasure:confirmation({task:'unreachable'})});await fourth;
  const last=click('erase');await settle();pending.shift().resolve({erased:{id:'fresh',erasedAt:'2026-10-21T01:11:00Z',task:'unreachable'}});await settle();
  pending.shift().resolve({...view,items:view.items.filter(row=>row.id!=='fresh')});await last;
  assert.deepEqual(notes,['문의를 지웠어요. 할 일은 그 관리자 계정의 방에 그대로 있어요.']);
});

test('non-admin sessions never request the inquiry inbox',()=>{
  const f=fixture();let calls=0;f.context.api=async()=>{calls++;return data();};f.context.state.user.role='member';
  f.api.ensure();assert.equal(calls,0);
});

test('every sentence the inquiry screen writes itself is in the polite 해요 style',()=>{
  const f=fixture(),states=[data(),{...data(),settings:{enabled:false,revision:1,intervalMinutes:5},connection:{configured:true,formId:'form-id'},run:{status:'paused',lastSuccessAt:null}},{...data(),settings:{enabled:true,revision:1,intervalMinutes:5},connection:{configured:true,formId:'form-id'},run:{status:'ready',lastSuccessAt:'2026-10-21T01:05:00Z'}}];
  for(const status of ['new','reviewing','replied','closed'])states.push({...states[2],items:[inquiry('x-'+status,status)]});
  for(const view of states){f.api.state.data=view;f.api.state.scope='all';if(view.items.length)f.api.select(view.items[0].id);else f.api.select(null);
    const text=f.api.panel().replace(/<[^>]+>/g,' ');
    assert.doesNotMatch(text,/[가-힣](습니다|합니다|입니다|됩니다)[.!?]?(\s|$)/,text.slice(0,200));
  }
});
