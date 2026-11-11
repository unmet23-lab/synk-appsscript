import {APP_IDS,APPS,PAUSED_APP_IDS,statusLabel,appArt,josa} from './state.mjs';
import {MEMBER_BENEFITS} from './benefits.mjs';
import {accountStorageKey,displayLibraryAppId,displayLibraryAppIds,projectLibraryPreferences} from './library.mjs';
import {createDraftRecovery} from './draft-recovery.mjs';
import {worldPhoneSection} from './world-phone.mjs';

export const HOME_KEY='synk.platform.member-home.v1';
const MAX_RECORDS=60;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const stamp=value=>Number.isSafeInteger(value)&&value>0&&value<=8640000000000000;
const canSave=library=>library?.status==='ready'&&!!library.owner&&library.owner!=='anonymous-local';
const activeApp=id=>id==='partners'?'pulse':id;
// Stored notes may belong to a paused app; they stay valid and hidden (list() keeps only library apps) until it returns.
const STORED_APP_IDS=[...APP_IDS,...PAUSED_APP_IDS];
const icon=name=>'<svg class="i" aria-hidden="true"><use href="#i-'+name+'"/></svg>';
const arrow=icon('arrow-right');
// 3차 A 진열대(2026-11-08): 인사 → 두 줄 제목 → 회색 선반(이어서 열 앱 · 내 앱 · 회원 혜택) → 할 일 · 메모 1px 목록 → 바닥 한 줄.
// 글 속 앱 이름은 제품 이름(영문 그대로)과 한글 이름을 섞지 않게 화면용 짧은 이름을 쓴다.
const SPOKEN={world:'WORLD',messenger:'워크스페이스',teacher:'내 수업',path:'PATH',pulse:'PULSE',care:'플레저',fortune:'무료 운세'};
const spoken=id=>SPOKEN[id]||APPS[id]?.short||'';
const homeTone=row=>{if(!row)return 'wait';const stage=APPS[row.id]?.stage;if(stage==='planned'||row.status==='planned')return 'planned';if(row.publicWebAvailable)return 'ok';if(stage==='preview'||row.status==='preview')return 'preview';if(row.reason==='CHECKING')return 'wait';if(row.canLaunch)return row.updateAvailable?'wait':'ok';return 'off';};
const dayStart=time=>{const d=new Date(time);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();};
function whenWord(at,now=Date.now()){const days=Math.round((dayStart(now)-dayStart(at))/86400000);return days<=0?'오늘':days===1?'어제':days<7?days+'일 전에':'지난번에';}
function whenText(at,now=Date.now()){const days=Math.round((dayStart(now)-dayStart(at))/86400000),time=new Intl.DateTimeFormat('ko-KR',{hour:'numeric',minute:'2-digit'}).format(at);return days<=0?'오늘 '+time:days===1?'어제 '+time:new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric'}).format(at);}
function stageArt(art,alt=''){return art?'<span class="stage"><img src="'+esc(art.src)+'" alt="'+esc(alt)+'" decoding="async"></span>':'<span class="stage"></span>';}

export function parseHomeRecords(raw,owner){
  try{
    const doc=JSON.parse(raw);
    if(doc?.version!==1||doc.owner!==owner||!Array.isArray(doc.records))return [];
    const seen=new Set();
    return doc.records.filter(row=>row&&typeof row.id==='string'&&/^[a-z0-9-]{1,80}$/.test(row.id)&&!seen.has(row.id)&&seen.add(row.id)&&['task','note'].includes(row.kind)&&STORED_APP_IDS.includes(activeApp(row.appId))&&clean(row.title,80)&&stamp(row.createdAt)).slice(0,MAX_RECORDS).map(row=>({id:row.id,kind:row.kind,appId:row.appId,title:clean(row.title,80),body:clean(row.body,1200),done:row.kind==='task'&&row.done===true,createdAt:row.createdAt}));
  }catch{return [];}
}

const unreadableHomeRecords=()=>Object.assign(Error('이 PC에 저장한 메모 일부를 읽지 못했어요. 원래 메모는 그대로 두었고, 다시 읽을 때까지 새로 쓰거나 고칠 수 없어요.'),{code:'HOME_RECORDS_UNREADABLE'});
// Display parsing may hide unsupported rows. Mutations must validate the entire
// stored document and retain every valid row, including currently hidden apps.
function writableHomeRecords(raw,owner){
  if(raw==null)return [];
  let doc;try{doc=JSON.parse(raw);}catch{throw unreadableHomeRecords();}
  const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const keys=(value,allowed)=>Object.keys(value).every(key=>allowed.includes(key));
  if(!object(doc)||!keys(doc,['version','owner','records'])||doc.version!==1||doc.owner!==owner||!Array.isArray(doc.records)||doc.records.length>MAX_RECORDS)throw unreadableHomeRecords();
  const seen=new Set();
  for(const row of doc.records){
    if(!object(row)||!keys(row,['id','kind','appId','title','body','done','createdAt'])||typeof row.id!=='string'||!/^[a-z0-9-]{1,80}$/.test(row.id)||seen.has(row.id)||!['task','note'].includes(row.kind)||!STORED_APP_IDS.includes(activeApp(row.appId))||typeof row.title!=='string'||!row.title.trim()||row.title.length>80||typeof row.body!=='string'||row.body.length>1200||typeof row.done!=='boolean'||row.kind==='note'&&row.done||!stamp(row.createdAt))throw unreadableHomeRecords();
    seen.add(row.id);
  }
  return doc.records;
}

// These are explicitly written member notes, not inferred product outcomes.
// No product data, private account APIs, or AI calls cross this boundary.
export function createHomeStore(storage,{clock=Date.now}={}){
  function read(library){
    if(!canSave(library))return [];
    return parseHomeRecords(storage.getItem(accountStorageKey(HOME_KEY,library.owner)),library.owner);
  }
  function readForWrite(library){return writableHomeRecords(storage.getItem(accountStorageKey(HOME_KEY,library.owner)),library.owner);}
  function write(library,records){
    storage.setItem(accountStorageKey(HOME_KEY,library.owner),JSON.stringify({version:1,owner:library.owner,records}));
  }
  function requireMember(library){if(!canSave(library))throw Error('SYNK ID로 로그인한 뒤 저장할 수 있어요.');}
  return {
    list(library){return read(library).filter(row=>library.appIds.includes(activeApp(row.appId))).map(row=>{const entry=activeApp(row.appId),appId=displayLibraryAppId(entry,library);return {...row,appId,...(entry!==appId?{entryId:entry}:{})};});},
    storageStatus(library){
      if(!canSave(library))return {ok:false,code:'HOME_ACCOUNT_REQUIRED',message:'SYNK ID로 로그인한 뒤 저장할 수 있어요.'};
      try{readForWrite(library);return {ok:true};}
      catch(error){return error.code==='HOME_RECORDS_UNREADABLE'?{ok:false,code:error.code,message:error.message}:{ok:false,code:'HOME_STORAGE_UNAVAILABLE',message:'저장한 메모를 읽지 못했어요. PC 저장 공간이 부족하지 않은지 봐 주세요.'};}
    },
    add(library,input){
      requireMember(library);
      if(input?.consent!==true)throw Error('이 PC에 저장하는 데 동의해야 저장돼요.');
      if(!['task','note'].includes(input.kind)||!library.appIds.includes(input.appId)||!APP_IDS.includes(input.appId))throw Error('연결할 앱을 골라 주세요.');
      const title=clean(input.title,80);if(!title)throw Error('제목을 적어 주세요.');
      const records=readForWrite(library);if(records.length>=MAX_RECORDS)throw Error('최대 60개까지 저장할 수 있어요. 필요 없는 기록을 지워 주세요.');
      const createdAt=clock();if(!stamp(createdAt))throw Error('PC 시계가 맞지 않아 저장하지 못했어요. 날짜와 시간을 맞춰 주세요.');
      const id=createdAt.toString(36)+'-'+Math.random().toString(36).slice(2,12);
      const row={id,kind:input.kind,appId:input.appId,title,body:clean(input.body,1200),done:false,createdAt};
      write(library,[row,...records]);return row;
    },
    change(library,id,action){
      requireMember(library);const records=readForWrite(library),row=records.find(item=>item.id===id&&library.appIds.includes(activeApp(item.appId)));
      if(!row||!['toggle','remove'].includes(action))throw Error('이 메모를 찾지 못했거나 연결한 앱을 더는 쓸 수 없어요. 내 홈을 다시 열어 주세요.');
      if(action==='toggle'&&row.kind!=='task')throw Error('할 일만 완료 표시를 바꿀 수 있어요.');
      write(library,action==='remove'?records.filter(item=>item.id!==id):records.map(item=>item.id===id?{...item,done:!item.done}:item));
    },
  };
}

export function canOpenFromHome(action){return !!action&&!action.disabled&&['launch','teacher-preview','product-preview','public-web','pulse-app'].includes(action.action);}
const homeLaunchTarget=action=>canOpenFromHome(action)||!!action?.pending&&['launch','teacher-preview','product-preview','public-web','pulse-app'].includes(action.action);
export function hasDraftContent(draft){return !!(clean(draft?.title,80)||clean(draft?.body,1200));}

export function filterHomeRecords(records,query='',filter='all'){
  const terms=String(query).trim().normalize('NFKC').toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
  return records.filter(row=>(filter==='all'||filter==='notes'&&row.kind==='note'||filter==='pending'&&row.kind==='task'&&!row.done||filter==='done'&&row.kind==='task'&&row.done)&&terms.every(term=>[row.title,row.body,APPS[row.appId]?.name].join(' ').normalize('NFKC').toLocaleLowerCase('ko-KR').includes(term)));
}

export function buildHomeModel({library,personal,prefs,clients=[],records=[],actions={}}){
  const allowed=displayLibraryAppIds(library);prefs=projectLibraryPreferences(prefs||{},library);
  const order=[...new Set([...(personal?.order||[]),...allowed])].filter(id=>allowed.includes(id));
  const recent=order.filter(id=>stamp(prefs?.lastLaunch?.[id])).sort((a,b)=>prefs.lastLaunch[b]-prefs.lastLaunch[a]).slice(0,3).map(id=>({id,at:prefs.lastLaunch[id],...(prefs.launchEntries?.[id]&&prefs.launchEntries[id]!==id?{entryId:prefs.launchEntries[id]}:{})}));
  const visibleRecords=records.filter(row=>library?.appIds?.includes(row.entryId||row.appId)).map(row=>{const appId=displayLibraryAppId(row.appId,library);return {...row,appId,...(row.appId!==appId?{entryId:row.appId}:{})};});
  const tasks=visibleRecords.filter(row=>row.kind==='task'),pending=tasks.filter(row=>!row.done).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const available=order.filter(id=>(Object.hasOwn(actions,id)?homeLaunchTarget(actions[id]):clients.some(row=>row.id===id&&row.canLaunch))||(id==='messenger'&&library.appIds.includes('teacher')&&homeLaunchTarget(actions.teacher)));
  const pendingReady=pending.find(row=>available.includes(row.appId));
  const recentReady=recent.find(row=>available.includes(row.id));
  const purposeChoice=personal?.sessionOnly&&allowed.includes(personal.selected)?personal.selected:null;
  const first=purposeChoice||pendingReady?.appId||recentReady?.id||available[0]||pending.find(row=>allowed.includes(row.appId))?.appId||recent[0]?.id||order[0]||null;
  const nextTask=pending.find(row=>row.appId===first)||null;
  const firstEntry=nextTask?.entryId||recent.find(row=>row.id===first)?.entryId||(first==='messenger'&&!homeLaunchTarget(actions[first])&&library.appIds.includes('teacher')&&homeLaunchTarget(actions.teacher)?'teacher':first);
  return {canSave:canSave(library),order,recent,first,firstEntry,nextTask,nextKind:nextTask?'task':recent.some(row=>row.id===first)?'recent':'start',available,favorites:[...new Set(prefs?.favorites||[])].filter(id=>order.includes(id)),tasks,notes:visibleRecords.filter(row=>row.kind==='note'),clients};
}

export function mountMemberHome(root,{storage,getSnapshot,onApp,onPurpose,onAccount,onBenefits,onBenefit,onLibrary,onUpdates,onToast,getAppAction=()=>null,onLaunch,onRetry,bridge=globalThis.synkDesktop}){
  const store=createHomeStore(storage);let formOpen=false,formKind='task',message='',lastOwner=null,draft=null,discardRequested=false,recordQuery='',recordFilter='all',recoveryCandidate=null;
  let renderQueued=false,disposed=false;
  function scheduleRecoveryRender(){
    if(renderQueued||disposed)return;
    renderQueued=true;queueMicrotask(()=>{if(renderQueued&&!disposed)render();});
  }
  const recovery=createDraftRecovery({bridge,slot:'member-home',getContext:()=>getSnapshot().library,getDraft:()=>{
    const value=captureDraft();return hasDraftContent(value)?{kind:value.kind,appId:value.appId,title:value.title,body:value.body}:null;
  },onCandidate:value=>{recoveryCandidate=value;scheduleRecoveryRender();},onError:value=>{if(!recovery.state.error)message=value;scheduleRecoveryRender();},onStateChange:scheduleRecoveryRender});
  function captureDraft(){
    const form=root.querySelector?.('#member-record-form');
    if(form)draft=Object.fromEntries(['kind','appId','title','body','consent'].map(name=>{const field=form.elements.namedItem(name);return [name,name==='consent'?field.checked:field.value];}));
    return draft;
  }
  function hasUnsavedChanges(){return hasDraftContent(captureDraft());}
  function discardDraft(){
    const previous=captureDraft(),previousOwner=getSnapshot().library.owner;
    draft=null;formOpen=false;discardRequested=false;message='';const cleared=recovery.hasUnselectedDraft?Promise.resolve(true):recovery.clear();render({capture:false});
    return cleared.then(ok=>{if(!disposed&&ok===false&&getSnapshot().library.owner===previousOwner&&hasDraftContent(previous)&&!hasUnsavedChanges()){draft=previous;formOpen=true;message='임시 저장본을 지우지 못해 쓰던 내용을 다시 열었어요. 저장하거나 설정에서 「쓰던 메모 되살리기」를 꺼 주세요.';render({capture:false});}return ok;});
  }
  function focusDraft(){formOpen=true;discardRequested=false;render();root.querySelector?.('[name=title]')?.focus();}
  function launchButton(id,label='지금 열기',className='solid-button'){
    const action=getAppAction(id);
    if(!homeLaunchTarget(action)||!onLaunch)return '';
    return '<button class="'+className+'" data-member-launch="'+id+'" '+(action.pending?'disabled aria-busy="true"':'')+'>'+esc(action.pending?'여는 중…':label)+' '+arrow+'</button>';
  }
  function render({capture=true}={}){
    if(disposed)return;
    const snapshot=getSnapshot(),owner=snapshot.library.owner;
    if(capture)captureDraft();
    // A transient account check may omit its owner. Keep the draft only in memory,
    // hidden until that same verified owner returns; a different owner clears it.
    if(owner&&owner!==lastOwner){formOpen=false;message='';draft=null;discardRequested=false;recordQuery='';recordFilter='all';recoveryCandidate=null;lastOwner=owner;}
    if(draft?.appId&&!snapshot.library.appIds.includes(draft.appId)&&snapshot.library.status==='ready'){formOpen=false;draft=null;discardRequested=false;message='이 계정에서 쓸 수 있는 앱이 바뀌어 쓰던 메모를 닫았어요.';}
    void recovery.refresh();
    // This render includes synchronous recovery updates; merge later callbacks.
    renderQueued=false;
    const previousForm=formOpen?root.querySelector?.('#member-record-form'):null;
    const focused=previousForm?.contains(root.ownerDocument?.activeElement)?root.ownerDocument.activeElement:null;
    const focusState=focused?{name:focused.name,start:focused.selectionStart,end:focused.selectionEnd}:null;
    let storageState=store.storageStatus(snapshot.library),records=[];
    try{records=store.list(snapshot.library);}catch{storageState={ok:false,message:'저장한 메모를 읽지 못했어요. PC 저장 공간이 부족하지 않은지 봐 주세요.'};}
    const storageBlocked=!storageState.ok,recoveryState=recovery.state;
    const actions=Object.fromEntries(snapshot.library.appIds.map(id=>[id,getAppAction(id)]));
    const model=buildHomeModel({...snapshot,records,actions}),personal=snapshot.personal||{},active=personal.active||personal.sessionOnly,app=model.first?APPS[model.first]:null;
    const shown=filterHomeRecords([...model.tasks,...model.notes],recordQuery,recordFilter),shownTasks=shown.filter(row=>row.kind==='task'),shownNotes=shown.filter(row=>row.kind==='note');
    const loading=snapshot.library.status==='loading',unavailable=snapshot.library.status==='unavailable',guest=snapshot.library.status==='guest';
    const recentAt=id=>model.recent.find(row=>row.id===id)?.at;
    // 선반 칸 하나: 칸(물건 · 이름 · 설명) 전체가 앱 소개로 가고, 칸 아래에는 행동 하나만 둔다 — 바로 열 수 있는 앱은 「열기」(실행) 단추,
    // 그 밖은 칸 글자(「앱 소개 보기 →」)다. 칸 단추 안에 단추를 넣지 않고, 칸 단추의 ::after가 칸 전체(아래 줄 포함)를 덮는다.
    const appSlot=(id,lead)=>{
      const entry=lead?model.firstEntry:(model.recent.find(row=>row.id===id)?.entryId||id),action=actions[entry],direct=homeLaunchTarget(action)&&!!onLaunch,pending=direct&&action?.pending;
      const row=model.clients.find(item=>item.id===id),state=statusLabel(row),at=recentAt(id);
      const verb=!direct?'':action.action==='pulse-app'?'전용 창 열기':action.action==='public-web'?'웹에서 열기':action.action==='teacher-preview'?'내 수업 열기':'열기';
      const desc=lead&&model.nextTask?'남긴 할 일 · '+model.nextTask.title:APPS[id].description;
      const meta=state+(at?' · '+whenText(at)+'에 열었어요':'');
      const go=direct?'<button class="text-link shelf-go" data-member-launch="'+entry+'" '+(pending?'disabled aria-busy="true"':'')+' aria-label="'+esc(APPS[id].name+(pending?' 여는 중':' '+verb))+'">'+esc(pending?'여는 중…':verb)+' '+icon(['pulse-app','public-web'].includes(action.action)?'arrow-up-right':'arrow-right')+'</button>':'<span class="shelf-go" aria-hidden="true">앱 소개 보기 '+arrow+'</span>';
      return '<li class="shelf-slot'+(lead?' is-lead':'')+'"><button class="shelf-item'+(lead?' is-lead':'')+'" data-member-app="'+id+'" aria-label="'+esc(APPS[id].name+' 앱 소개, '+meta)+'">'+stageArt(appArt(id))+'<span class="shelf-label"><span class="name">'+esc(APPS[id].name)+'</span><span class="desc">'+esc(desc)+'</span><span class="meta"><span class="dot" data-tone="'+homeTone(row)+'" aria-hidden="true"></span>'+esc(meta)+'</span></span></button><p class="shelf-action">'+go+'</p></li>';
    };
    // 로그인한 회원에게 「로그인하면 바로」는 맞지 않아 「바로 보기」로(benefits.mjs 글은 웹과 같이 써서 그대로 둔다).
    const benefitState=item=>snapshot.who&&item.statusLabel==='로그인하면 바로'?'바로 보기':item.statusLabel;
    const benefitSlot=item=>'<li class="shelf-slot"><button class="shelf-item" data-member-benefit="'+item.id+'" aria-label="'+esc(item.name)+' 소개 보기, 회원 혜택 · '+esc(benefitState(item))+'">'+stageArt({src:'/assets/launcher/'+item.asset})+'<span class="shelf-label"><span class="name">'+esc(item.name)+'</span><span class="desc">'+esc(item.headline)+'</span><span class="meta">회원 혜택 · '+esc(benefitState(item))+'</span></span></button><p class="shelf-action"><span class="shelf-go" aria-hidden="true">보기 '+arrow+'</span></p></li>';
    // 선반 넷: 첫 칸(1.7배)은 이어서 열 앱, 나머지는 내 앱(즐겨찾기 · 최근 순)과 회원 혜택.
    const others=[...new Set([...model.favorites,...model.recent.map(row=>row.id),...model.order])].filter(id=>id!==model.first&&model.order.includes(id));
    const benefits=MEMBER_BENEFITS.filter(item=>!model.order.includes(item.id));
    const appsShown=app?[model.first,...others.slice(0,benefits.length?2:3)]:[];
    const benefitsShown=benefits.slice(0,Math.max(0,4-appsShown.length));
    const moreApps=app?Math.max(0,1+others.length-appsShown.length):0;
    const shelf=loading||unavailable?'':'<ul class="shelf'+(app?'':' is-benefits-only')+'" aria-label="'+(app?'내 앱과 회원 혜택':'회원 혜택')+'">'+appsShown.map((id,index)=>appSlot(id,index===0)).join('')+benefitsShown.map(benefitSlot).join('')+'</ul>'+(moreApps?'<p class="shelf-more"><button class="text-link" data-member-library>내 앱 '+model.order.length+'개 모두 보기 '+arrow+'</button></p>':'');
    // 인사 → 두 줄 큰 제목. 글은 홈 모델(할 일 · 최근 · 고른 일 · 바로 열기)에서 나온다.
    const name=app?spoken(model.first):'',direct=!!app&&homeLaunchTarget(actions[model.firstEntry])&&!!onLaunch;
    // 고른 일에 맞는 앱이 목록에 있을 때만 「고른 일에 맞는 ○○」이라고 말한다(personal.matched — 2026-11-11, 「배우기」의 WORLD는 휴대폰 칸).
    const matchesPurpose=active&&personal.matched!==false&&personal.selected===model.first,worldOnPhone=snapshot.library.appIds?.includes('world');
    let who=snapshot.who?snapshot.who+' 님':guest?'반가워요':'내 홈',title,second,lead='',busy=false,extra='';
    if(loading&&snapshot.library.phase==='signing-in'){busy=true;title='브라우저에서 로그인을';second='마쳐 주세요.';lead='<p class="hello-lead" role="status">기본 브라우저에 열린 SYNK ID 창에서 Google이나 이메일로 로그인한 뒤 「연결하기」를 누르면 여기로 돌아와요. 창이 안 보이면 오른쪽 위 「로그인 중」을 눌러 취소한 뒤 다시 해 주세요.</p>';}
    else if(loading){busy=true;title='내 앱을 불러오고 있어요.';second='잠시만 기다려 주세요.';lead='<p class="hello-lead" role="status">로그인 상태와 쓸 수 있는 앱을 불러오는 중이에요.</p>';}
    else if(unavailable){title='앱 목록을';second='불러오지 못했어요.';lead='<p class="hello-lead">인터넷 연결을 확인하고 다시 불러와 주세요. 다시 불러와도 이 PC에 남긴 메모는 그대로예요.</p>';extra='<div class="hello-actions"><button class="solid-button" data-member-retry>다시 불러오기 '+arrow+'</button><button class="text-link" data-member-account>계정 보기</button></div>';}
    else if(!app&&worldOnPhone){title='한국어 공부는';second='휴대폰의 WORLD에서 해요.';lead='<p class="hello-lead">아래 QR을 휴대폰 카메라로 찍으면 바로 열려요. 회원 혜택은 이 PC에서 바로 써요.</p>';extra='<div class="hello-actions"><button class="solid-button" data-member-benefits>회원 혜택 보기 '+arrow+'</button><button class="text-link" data-member-account>계정 보기</button></div>';}
    else if(!app){title='아직 쓸 수 있는 앱이 없어요.';second='회원 혜택은 지금 바로 써요.';lead='<p class="hello-lead">학교나 회사에서 이 계정에 앱을 열어 주면 여기에 나와요.</p>';extra='<div class="hello-actions"><button class="solid-button" data-member-benefits>회원 혜택 보기 '+arrow+'</button><button class="text-link" data-member-account>계정 보기</button></div>';}
    else if(guest){title='로그인 전에도';second=name+josa(name,'을','를')+' 둘러봐요.';extra='<div class="hello-actions"><button class="text-link" data-member-account>로그인하고 내 앱 보기</button></div>';}
    else if(active&&personal.matched===false&&personal.context==='student'){title='한국어 공부는';second='휴대폰의 WORLD에서 해요.';lead='<p class="hello-lead">아래 QR을 휴대폰 카메라로 찍으면 바로 열려요.</p>';}
    else if(model.nextKind==='task'){title=name+'에 남긴 할 일,';second='이어서 할까요?';}
    else if(model.nextKind==='recent'){title=whenWord(recentAt(model.first))+' 하던 '+name+',';second=direct?'이어서 열까요?':'다시 둘러볼까요?';}
    else if(matchesPurpose){title='고른 일에 맞는 '+name+',';second=direct?'지금 열어 볼까요?':'먼저 둘러볼까요?';}
    else if(direct){title='오늘은 '+name+'부터,';second='열어 볼까요?';}
    else{title='처음이라면 '+name+'부터,';second='둘러볼까요?';}
    // 하려는 일: 제목 아래 · 선반 위 왼쪽 정렬 밑줄 글자 탭(라이브러리 필터와 같은 모양). 누르면 이 창에서만 순서가 바뀌고,
    // 그때만 「다음에도 이렇게 보기」가 안내 줄에 나온다(순서 정하기 자체는 라이브러리 · 설정에 있다).
    const purposes='<div class="member-purpose" role="group" aria-label="하려는 일">'+[['student','배우기'],['creator','만들기'],['everyday','일상 챙기기'],['customer','제작 의뢰']].map(([id,label])=>'<button data-member-purpose="'+id+'" aria-pressed="'+(!!active&&personal.context===id)+'" '+(loading||unavailable?'disabled':'')+'>'+label+'</button>').join('')+'</div>';
    const hello='<header class="hello"'+(busy?' aria-busy="true"':'')+'><div class="hello-copy"><p class="who">'+esc(who)+'</p><h1 id="member-home-title" tabindex="-1">'+esc(title)+'<br><span>'+esc(second)+'</span></h1>'+lead+extra+'</div></header>'
      +(app?purposes:'')
      +(personal.sessionOnly?'<p class="member-session-note">고른 일은 이 창에서만 적용돼요. <button class="text-link member-remember" data-member-remember="'+esc(personal.context||'everyday')+'">다음에도 이렇게 보기</button></p>':'');
    // 이어서 할 일 · 결과 메모: 제목 22 + 위 1px 검정 선 + 줄마다 1px 회색 선.
    const recordRow=row=>'<div tabindex="-1" data-member-record="'+esc(row.id)+'" class="member-record member-row'+(row.done?' is-done':'')+'">'+(row.kind==='task'?'<button class="member-check" data-member-toggle="'+row.id+'" aria-pressed="'+row.done+'" aria-label="'+esc(row.title)+(row.done?' 완료됨 · 다시 열기':' 완료 표시')+'" '+(storageBlocked?'disabled':'')+'>'+icon('check')+'</button>':'<span class="member-bullet" aria-hidden="true">—</span>')+'<div class="member-row-text"><strong>'+esc(row.title)+'</strong>'+(row.body?'<p class="member-record-body">'+esc(row.body)+'</p>':'')+'<span class="member-row-actions">'+launchButton(row.entryId||row.appId,'앱 열기','text-link')+'<button class="text-link" data-member-app="'+row.appId+'">앱 정보</button><button class="text-link member-remove" data-member-remove="'+row.id+'" aria-label="'+esc(row.title)+' 삭제" '+(storageBlocked?'disabled':'')+'>삭제</button></span></div><span class="member-tag">'+esc(spoken(row.appId))+'</span></div>';
    const addDisabled=loading||unavailable||model.canSave&&(!model.order.length||storageBlocked)?'disabled':'';
    // 목록에 보이는 앱이 없으면(예: WORLD 권한만 — WORLD는 휴대폰) 메모를 이을 앱이 없어 「적어 두기」를 세우지 않는다(2026-11-11).
    const noListedApp=model.canSave&&!model.order.length&&!loading&&!unavailable;
    const addButton=kind=>noListedApp?'':'<button class="text-link member-add" '+(model.canSave?(kind==='notes'?'data-member-add data-member-kind="note"':'data-member-add'):'data-member-account')+' '+addDisabled+'>'+(model.canSave?'적어 두기':'로그인하고 적기')+'</button>';
    const column=(kind,heading,rows,empty)=>'<section class="member-column" aria-labelledby="member-'+kind+'-title"><div class="member-column-head"><h2 id="member-'+kind+'-title">'+heading+' <span class="num">'+rows.length+'</span></h2>'+addButton(kind)+'</div><div class="member-rows">'+(rows.length?rows.map(recordRow).join(''):'<p class="member-empty">'+empty+'</p>')+'</div></section>';
    const notes='<section class="member-notes-area" aria-label="내 메모">'
      +(storageBlocked&&model.canSave?'<div class="member-draft-choice" role="alert" data-member-storage-error><strong>저장한 메모를 읽지 못했어요.</strong><p>'+esc(storageState.message)+'</p><button class="ghost-button" type="button" data-member-retry-storage>다시 읽기</button></div>':'')
      +(recoveryState.error&&model.canSave?'<div class="member-draft-choice" role="alert" data-member-recovery-error><strong>임시 저장한 메모를 확인하지 못했어요.</strong><p>'+esc(recoveryState.error.message)+'</p><button class="ghost-button" type="button" data-member-retry-recovery '+(!recoveryState.retryable?'disabled':'')+'>'+(recoveryState.pending?'확인 중…':'다시 시도')+'</button></div>':'')
      +(recoveryCandidate&&model.canSave?'<div class="member-draft-choice" role="group" aria-label="임시 저장한 메모"><strong>쓰다 만 메모가 있어요.</strong><p>이 PC에 암호화해 둔 임시 저장본이에요. 불러온 뒤 저장해 주세요.</p><div><button class="solid-button" type="button" data-member-recover>불러오기</button><button class="ghost-button" type="button" data-member-forget-recovery>버리기</button></div></div>':'')
      +(formOpen&&model.canSave?'<form id="member-record-form" class="member-form"><label>종류<select name="kind"><option value="task"'+(formKind==='task'?' selected':'')+'>이어서 할 일</option><option value="note"'+(formKind==='note'?' selected':'')+'>결과 메모</option></select></label><label>연결할 앱<select name="appId">'+model.order.map(id=>'<option value="'+id+'">'+esc(APPS[id].name)+'</option>').join('')+'</select></label><label class="member-field-wide">제목<input name="title" required maxlength="80" placeholder="예: 다음 시안에서 확인할 부분"></label><label class="member-field-wide">내용<textarea name="body" maxlength="1200" rows="3" placeholder="다시 볼 때 필요한 것만 적어 주세요."></textarea></label><label class="member-consent member-field-wide"><input type="checkbox" name="consent" required>이 PC에 지금 계정으로 저장하는 데 동의해요.</label><div class="member-form-actions member-field-wide"><button class="solid-button" type="submit" '+(!model.order.length||storageBlocked?'disabled':'')+'>저장</button><button class="ghost-button" type="button" data-member-cancel>취소</button></div></form>':'')
      +(discardRequested?'<div class="member-draft-choice" role="group" aria-labelledby="member-draft-title"><strong id="member-draft-title">아직 저장하지 않은 내용이 있어요.</strong><p>계속 쓰거나, 쓰던 내용을 버리고 닫을 수 있어요.</p><div><button class="solid-button" type="button" data-member-keep>계속 쓰기</button><button class="ghost-button" type="button" data-member-discard>버리기</button></div></div>':'')
      +'<p class="member-message" role="status">'+esc(message)+'</p>'
      +(records.length?'<div class="member-record-filters"><label class="search">'+icon('search')+'<input type="search" data-member-record-search value="'+esc(recordQuery)+'" placeholder="메모 찾기 · 제목·내용·앱 이름" aria-label="메모 찾기" aria-controls="member-record-results"></label><select data-member-record-filter aria-label="메모 보기" aria-controls="member-record-results">'+[['all','전부'],['pending','안 끝낸 할 일'],['done','끝낸 할 일'],['notes','결과 메모']].map(([value,label])=>'<option value="'+value+'" '+(recordFilter===value?'selected':'')+'>'+label+'</option>').join('')+'</select></div>':'')
      +'<div id="member-record-results" class="member-notes">'+column('tasks','이어서 할 일',shownTasks,recordQuery||recordFilter!=='all'?'찾는 할 일이 없어요.':noListedApp?'이 PC에서 여는 앱이 생기면 그 앱에 이어서 할 일을 적어 둘 수 있어요.':model.canSave?'앱에서 이어서 할 일을 적어 두면 여기에 모여요.':'로그인하면 이어서 할 일을 적어 둘 수 있어요.')+column('notes','결과 메모',shownNotes,recordQuery||recordFilter!=='all'?'찾는 메모가 없어요.':noListedApp?'이 PC에서 여는 앱이 생기면 그 앱의 결과 메모를 남길 수 있어요.':model.canSave?'기억할 결과를 적어 두면 여기에 모여요.':'로그인하면 결과 메모를 남길 수 있어요.')+'</div>'
      +'<p class="member-notes-note">'+(model.canSave?'메모는 이 PC에 지금 계정으로 저장돼요. 일은 연결한 앱을 열어서 해요.':'메모는 SYNK ID로 로그인한 뒤 이 PC에 계정마다 따로 저장돼요.')+'</p></section>';
    // 바닥 한 줄(설치 상태 · 판 · 「업데이트 확인」)은 계정 이어가기 띠 아래에 두려고 index.html의 #home-foot이 맡는다.
    // WORLD는 앱 목록 대신 휴대폰으로 넘어가는 칸 하나(world-phone.mjs). 불러오는 중 · 실패 화면에는 두지 않는다.
    const phone=loading||unavailable?'':worldPhoneSection({qrSrc:'/assets/launcher/world-qr.svg'});
    root.innerHTML=hello+shelf+phone+notes;
    const nextForm=root.querySelector?.('#member-record-form');
    if(draft&&nextForm){for(const [name,value]of Object.entries(draft)){const field=nextForm.elements.namedItem(name);if(name==='consent')field.checked=value;else field.value=value;}if(focusState?.name){const field=nextForm.elements.namedItem(focusState.name);field?.focus({preventScroll:true});if(typeof focusState.start==='number')field.setSelectionRange(focusState.start,focusState.end);}}
  }
  function updateRecordSearch(field){
    recordQuery=field.value;const position=field.selectionStart;render();const next=root.querySelector('[data-member-record-search]');next?.focus({preventScroll:true});if(typeof position==='number')next?.setSelectionRange?.(position,position);
  }
  root.addEventListener('compositionend',event=>{if(event.target?.matches?.('[data-member-record-search]'))updateRecordSearch(event.target);});
  root.addEventListener('input',event=>{
    if(event.target?.matches?.('[data-member-record-search]')){
      if(!event.isComposing)updateRecordSearch(event.target);return;
    }
    captureDraft();if(hasDraftContent(draft))recovery.changed();else if(formOpen)void recovery.clear();
  });
  root.addEventListener('change',event=>{if(event.target?.matches?.('[data-member-record-filter]')){recordFilter=event.target.value;render();root.querySelector('[data-member-record-filter]')?.focus({preventScroll:true});return;}captureDraft();recovery.changed();});
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;const data=button.dataset;
    if(data.memberApp){if(getSnapshot().library.appIds.includes(data.memberApp))onApp(data.memberApp);}
    else if(data.memberLaunch){if(getSnapshot().library.appIds.includes(data.memberLaunch)&&canOpenFromHome(getAppAction(data.memberLaunch)))onLaunch?.(data.memberLaunch);}
    else if(data.memberPurpose)onPurpose?.(data.memberPurpose,{remember:false});
    else if(data.memberRemember)onPurpose?.(data.memberRemember,{remember:true});
    else if('memberRetry' in data)onRetry?.();
    else if('memberRetryStorage' in data){message='';render();(root.querySelector('[data-member-retry-storage]')||root.querySelector('[data-member-add]'))?.focus({preventScroll:true});}
    else if('memberRetryRecovery' in data){const owner=getSnapshot().library.owner;void recovery.retry().then(()=>{if(!disposed&&getSnapshot().library.owner===owner)(root.querySelector('[data-member-retry-recovery]')||root.querySelector('[data-member-recover]')||root.querySelector('[name=title]')||root.querySelector('[data-member-add]'))?.focus({preventScroll:true});});}
    else if('memberAccount' in data)onAccount();
    else if('memberBenefits' in data)onBenefits();
    else if(data.memberBenefit)(onBenefit||onBenefits)?.(data.memberBenefit);
    else if('memberLibrary' in data)onLibrary?.();
    else if('memberUpdates' in data)onUpdates?.();
    else if('memberAdd' in data){
      // 열마다 「적어 두기」가 있다: 누른 열의 종류로 연다. 이미 열린 입력 창이면 쓰던 글은 두고 종류만 바꾼다.
      formKind=data.memberKind==='note'?'note':'task';const kindField=root.querySelector?.('#member-record-form')?.elements?.namedItem('kind');if(kindField)kindField.value=formKind;formOpen=true;message='';discardRequested=false;render();root.querySelector('[name=title]')?.focus();}
    else if('memberCancel' in data){if(hasUnsavedChanges()){discardRequested=true;render();root.querySelector?.('[data-member-keep]')?.focus();}else discardDraft();}
    else if('memberKeep' in data)focusDraft();
    else if('memberDiscard' in data)discardDraft();
    else if('memberRecover' in data){
      if(hasUnsavedChanges()&&!globalThis.confirm('지금 쓰는 내용을 임시 저장본으로 바꿀까요?'))return;
      const value=recovery.take();if(!value||!getSnapshot().library.appIds.includes(value.appId))return;
      draft={...value,consent:false};formOpen=true;discardRequested=false;message='임시 저장본을 불러왔어요. 내용을 보고 저장해 주세요.';render({capture:false});void recovery.flush();root.querySelector('[name=title]')?.focus();
    }
    else if('memberForgetRecovery' in data){void recovery.clear({discardCandidate:true});}
    else if(data.memberToggle||data.memberRemove){try{store.change(getSnapshot().library,data.memberToggle||data.memberRemove,data.memberToggle?'toggle':'remove');message=data.memberToggle?'할 일 상태를 바꿨어요.':'기록을 삭제했어요.';}catch(error){message=error.message;}render();const target=data.memberToggle?'[data-member-toggle="'+data.memberToggle+'"]':'[data-member-add]';root.querySelector(target)?.focus({preventScroll:true});}
  });
  root.addEventListener('submit',event=>{
    if(event.target.id!=='member-record-form')return;event.preventDefault();
    const form=event.target.elements;
    try{store.add(getSnapshot().library,{kind:form.namedItem('kind').value,appId:form.namedItem('appId').value,title:form.namedItem('title').value,body:form.namedItem('body').value,consent:form.namedItem('consent').checked});formOpen=false;draft=null;discardRequested=false;void recovery.clear();message='저장했어요. 이 PC에서 같은 계정으로 열면 다시 볼 수 있어요.';onToast?.(message);render({capture:false});}catch(error){message=error.message;render();}
  });
  function searchRecords(query=''){try{return filterHomeRecords(store.list(getSnapshot().library),query).slice(0,30);}catch{return [];}}
  function focusRecord(id){if(!searchRecords().some(row=>row.id===id)&&!(()=>{try{return store.list(getSnapshot().library).some(row=>row.id===id);}catch{return false;}})())return false;recordQuery='';recordFilter='all';render();const row=root.querySelector?.('[data-member-record="'+id+'"]');row?.scrollIntoView?.({block:'center'});row?.focus?.({preventScroll:true});return !!row;}
  return {render,hasUnsavedChanges,discardDraft,focusDraft,searchRecords,focusRecord,flushDraft:recovery.flush,dispose(){disposed=true;renderQueued=false;recovery.dispose();}};
}
