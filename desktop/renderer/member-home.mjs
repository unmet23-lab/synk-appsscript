import {APP_IDS,APPS,statusLabel} from './state.mjs';
import {accountStorageKey,displayLibraryAppId,displayLibraryAppIds,projectLibraryPreferences} from './library.mjs';
import {createDraftRecovery} from './draft-recovery.mjs';

export const HOME_KEY='synk.platform.member-home.v1';
const MAX_RECORDS=60;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const stamp=value=>Number.isSafeInteger(value)&&value>0&&value<=8640000000000000;
const canSave=library=>library?.status==='ready'&&!!library.owner&&library.owner!=='anonymous-local';
const activeApp=id=>id==='partners'?'pulse':id;
const arrow='<svg class="i" aria-hidden="true"><use href="#i-arrow-right"/></svg>';
// 싱ㅋ 시그널 2 포스터(표시 전용): 누끼 물건은 제 색으로 세우고, 장면 그림은 이중톤, 흰 바탕 사진은 인화지로 붙인다.
const CUTOUT_ART=new Set(['world-book.avif','laptop.webp','care-note.webp','fortune-star.avif','studio-camera.webp']);
const artMode=cover=>CUTOUT_ART.has(cover)?'cut':/-cover\.webp$/.test(cover)?'scene':'print';
const posterArt=(id,className)=>{const cover=APPS[id]?.cover;if(!cover)return '';const mode=artMode(cover);return '<span class="'+className+' is-'+mode+'" aria-hidden="true"><img class="art-'+mode+'" src="/assets/launcher/'+esc(cover)+'" alt="" decoding="async"></span>';};
const posterWord=(id,className)=>{const lines=String(APPS[id]?.word||APPS[id]?.short||'').split('\n'),len=Math.max(...lines.map(line=>line.replace(/\s/g,'').length),1);return '<span class="'+className+(lines.length>1?' two-line':'')+'" style="--len:'+len+'" aria-hidden="true">'+lines.map(esc).join('<br>')+'</span>';};
const homeTone=row=>{if(!row)return 'wait';const stage=APPS[row.id]?.stage;if(stage==='planned'||row.status==='planned')return 'planned';if(row.publicWebAvailable)return 'ok';if(stage==='preview'||row.status==='preview')return 'preview';if(row.reason==='CHECKING')return 'wait';if(row.canLaunch)return row.updateAvailable?'wait':'ok';return 'off';};

export function parseHomeRecords(raw,owner){
  try{
    const doc=JSON.parse(raw);
    if(doc?.version!==1||doc.owner!==owner||!Array.isArray(doc.records))return [];
    const seen=new Set();
    return doc.records.filter(row=>row&&typeof row.id==='string'&&/^[a-z0-9-]{1,80}$/.test(row.id)&&!seen.has(row.id)&&seen.add(row.id)&&['task','note'].includes(row.kind)&&APP_IDS.includes(activeApp(row.appId))&&clean(row.title,80)&&stamp(row.createdAt)).slice(0,MAX_RECORDS).map(row=>({id:row.id,kind:row.kind,appId:row.appId,title:clean(row.title,80),body:clean(row.body,1200),done:row.kind==='task'&&row.done===true,createdAt:row.createdAt}));
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
    if(!object(row)||!keys(row,['id','kind','appId','title','body','done','createdAt'])||typeof row.id!=='string'||!/^[a-z0-9-]{1,80}$/.test(row.id)||seen.has(row.id)||!['task','note'].includes(row.kind)||!APP_IDS.includes(activeApp(row.appId))||typeof row.title!=='string'||!row.title.trim()||row.title.length>80||typeof row.body!=='string'||row.body.length>1200||typeof row.done!=='boolean'||row.kind==='note'&&row.done||!stamp(row.createdAt))throw unreadableHomeRecords();
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
  const first=purposeChoice||pendingReady?.appId||recentReady?.id||available[0]||pending[0]?.appId||recent[0]?.id||order[0]||null;
  const nextTask=pending.find(row=>row.appId===first)||null;
  const firstEntry=nextTask?.entryId||recent.find(row=>row.id===first)?.entryId||(first==='messenger'&&!homeLaunchTarget(actions[first])&&library.appIds.includes('teacher')&&homeLaunchTarget(actions.teacher)?'teacher':first);
  return {canSave:canSave(library),order,recent,first,firstEntry,nextTask,nextKind:nextTask?'task':recent.some(row=>row.id===first)?'recent':'start',available,favorites:[...new Set(prefs?.favorites||[])].filter(id=>order.includes(id)),tasks,notes:visibleRecords.filter(row=>row.kind==='note'),clients};
}

export function mountMemberHome(root,{storage,getSnapshot,onApp,onPurpose,onAccount,onBenefits,onToast,getAppAction=()=>null,onLaunch,onRetry,bridge=globalThis.synkDesktop}){
  const store=createHomeStore(storage);let formOpen=false,message='',lastOwner=null,draft=null,discardRequested=false,recordQuery='',recordFilter='all',recoveryCandidate=null;
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
    const recordCard=row=>'<article tabindex="-1" data-member-record="'+esc(row.id)+'" class="member-record brand-'+row.appId+(row.done?' is-done':'')+'"><span class="label">'+esc(APPS[row.appId].short)+'</span><h3>'+esc(row.title)+'</h3>'+(row.body?'<p class="member-record-body">'+esc(row.body)+'</p>':'')+'<div class="member-record-actions">'+(row.kind==='task'?'<button class="ghost-button" data-member-toggle="'+row.id+'" aria-pressed="'+row.done+'" '+(storageBlocked?'disabled':'')+'>'+(row.done?'완료됨 · 다시 열기':'완료 표시')+'</button>':'')+launchButton(row.entryId||row.appId,'앱 열기','ghost-button')+'<button class="text-link" data-member-app="'+row.appId+'">앱 정보 '+arrow+'</button><button class="text-link member-remove" data-member-remove="'+row.id+'" aria-label="'+esc(row.title)+' 삭제" '+(storageBlocked?'disabled':'')+'>삭제</button></div></article>';
    const appCard=(id,subtitle,entryId=id)=>{const direct=homeLaunchTarget(actions[entryId])&&onLaunch,pending=direct&&actions[entryId]?.pending;return '<article class="member-app brand-'+id+'"><button class="member-app-main" data-member-'+(direct?'launch':'app')+'="'+(direct?entryId:id)+'" '+(pending?'disabled aria-busy="true"':'')+' aria-label="'+esc(APPS[id].name)+(pending?' 여는 중':direct?' 다시 열기':' 소개 보기')+'"><span class="member-app-mark" aria-hidden="true">'+esc(APPS[id].mark)+'</span><span><strong>'+esc(APPS[id].name)+'</strong><small>'+esc(subtitle||statusLabel(model.clients.find(row=>row.id===id)))+'</small><span class="member-app-hint">'+(pending?'여는 중…':direct?'다시 열기':'소개 보기')+' '+arrow+'</span></span></button>'+(direct?'<button class="text-link member-app-info" data-member-app="'+id+'" aria-label="'+esc(APPS[id].name)+' 앱 정보">정보</button>':'')+'</article>';};
    let next;
    if(loading&&snapshot.library.phase==='signing-in')next='<section class="member-next member-connection" aria-busy="true"><span class="label">SIGN IN</span><h2>브라우저에서 로그인을 마쳐 주세요.</h2><p role="status">기본 브라우저에 열린 SYNK ID 창에서 Google이나 이메일로 로그인하면 여기로 돌아와요. 창이 안 보이면 오른쪽 위 「로그인 중」을 눌러 취소한 뒤 다시 해 주세요.</p></section>';
    else if(loading)next='<section class="member-next member-connection" aria-busy="true"><span class="label">LOADING</span><h2>내 앱을 불러오고 있어요.</h2><p role="status">로그인 상태와 쓸 수 있는 앱을 불러오는 중이에요. 잠시만 기다려 주세요.</p></section>';
    else if(unavailable)next='<section class="member-next member-connection"><span class="label">CONNECTION</span><h2>앱 목록을 불러오지 못했어요.</h2><p>인터넷 연결을 확인하고 다시 불러와 주세요. 다시 불러와도 이 PC에 남긴 메모는 그대로예요.</p><div class="member-next-actions"><button class="solid-button" data-member-retry>다시 불러오기 '+arrow+'</button><button class="text-link" data-member-account>계정 보기</button></div></section>';
    else if(!app)next='<section class="member-next member-connection"><span class="label">MY APPS</span><h2>아직 쓸 수 있는 앱이 없어요.</h2><p>학교나 회사에서 이 계정에 앱을 열어 주면 여기에 나와요. 회원 혜택은 지금 바로 쓸 수 있어요.</p><div class="member-next-actions"><button class="solid-button" data-member-benefits>회원 혜택 보기 '+arrow+'</button><button class="text-link" data-member-account>계정 보기</button></div></section>';
    else{
      const direct=homeLaunchTarget(actions[model.firstEntry])&&onLaunch;
      const matchesPurpose=active&&personal.selected===model.first;
      const label=model.nextKind==='task'?'YOUR NEXT STEP':model.nextKind==='recent'?'WELCOME BACK':matchesPurpose?'FOR YOUR PURPOSE':direct?'READY NOW':'START HERE';
      const title=model.nextTask?model.nextTask.title:model.nextKind==='recent'?app.name:app.name;
      const copy=model.nextTask?app.name+'에 남겨 둔 할 일이에요. 일은 그 앱을 열어서 해요.':model.nextKind==='recent'?'가장 최근에 연 앱이에요. 여기서 바로 다시 열 수 있어요.':matchesPurpose?personal.reason:direct?'바로 열 수 있는 앱이에요. 무엇을 하는 앱인지는 「앱 소개」에서 볼 수 있어요.':'처음이라면 이 앱에서 무엇을 할 수 있는지부터 보세요.';
      next='<section class="member-next member-poster-hero brand-'+model.first+'">'+posterArt(model.first,'member-next-art')+posterWord(model.first,'member-next-word')+'<div class="member-next-copy"><span class="label">'+label+'</span><h2>'+esc(title)+'</h2><p>'+esc(copy)+'</p><div class="member-next-actions">'+(direct?launchButton(model.firstEntry,model.nextKind==='recent'?'다시 열기':'지금 열기'):'<button class="solid-button" data-member-app="'+model.first+'">앱 소개 보기 '+arrow+'</button>')+(direct?'<button class="text-link" data-member-app="'+model.first+'">앱 소개 '+arrow+'</button>':'')+(guest?'<button class="text-link" data-member-account>로그인하고 내 앱 보기</button>':'')+'</div></div></section>';
    }
    // 내 앱 선반: 이 계정에 연결된 앱만 포스터로 보여 준다(누르면 기존 앱 소개로).
    const shelf=loading||unavailable||!model.order.length?'':'<section class="member-section member-shelf-section" aria-labelledby="member-shelf-title"><div class="member-section-heading"><h2 id="member-shelf-title">내 앱 <span class="count">'+String(model.order.length).padStart(2,'0')+'</span></h2><span>'+(guest?'로그인 전에 둘러볼 수 있는 앱':'이 계정에서 쓸 수 있는 앱')+'</span></div><div class="member-shelf">'+model.order.map((id,index)=>{const row=model.clients.find(item=>item.id===id),state=statusLabel(row),chip=String(state).split(' · ').pop();return '<button class="member-poster brand-'+id+'" data-member-app="'+id+'" aria-label="'+esc(APPS[id].name)+' 소개 보기, '+esc(state)+'"><span class="member-poster-top"><span class="member-poster-index">'+String(index+1).padStart(2,'0')+'</span><span class="member-poster-state" data-tone="'+homeTone(row)+'"><span class="led"></span>'+esc(chip)+'</span></span>'+posterArt(id,'member-poster-art')+'<span class="member-poster-copy">'+posterWord(id,'member-poster-word')+'<strong>'+esc(APPS[id].name)+'</strong></span></button>';}).join('')+'</div></section>';
    root.innerHTML='<header class="member-heading"><div><span class="label">YOUR SYNK</span><h1 id="member-home-title" tabindex="-1">'+(model.canSave?'이어서 할 것':'SYNK 앱 둘러보기')+'</h1><p>'+(model.canSave?'최근에 연 앱과 남겨 둔 할 일을 여기서 바로 열어요.':'하려는 일을 고르면 맞는 앱이 먼저 나와요.')+'</p></div><button class="ghost-button" data-member-remember="'+esc(personal.context||'everyday')+'" '+(loading||unavailable?'disabled':'')+'>'+(personal.sessionOnly?'다음에도 이렇게 보기':personal.active?'순서 바꾸기':'순서 정하기')+'</button></header>'
      +'<div class="member-purpose" aria-label="하려는 일">'+[['student','배우기'],['creator','만들기'],['everyday','일상 챙기기'],['customer','제작 의뢰']].map(([id,label])=>'<button data-member-purpose="'+id+'" aria-pressed="'+(!!active&&personal.context===id)+'" '+(loading||unavailable?'disabled':'')+'>'+label+'</button>').join('')+'</div>'
      +(personal.sessionOnly?'<p class="member-session-note">고른 일은 이 창에서만 적용돼요. 다음에도 쓰려면 위의 「다음에도 이렇게 보기」를 눌러 주세요.</p>':'')+next+shelf
      +'<section class="member-section"><div class="member-section-heading"><h2>최근에 연 앱</h2><span>'+ (snapshot.prefs?.accountLibrary?'계정에 저장된 기록':'이 PC의 실행 기록') +'</span></div>'+(model.recent.length?'<div class="member-apps">'+model.recent.map(row=>appCard(row.id,new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(row.at)+(snapshot.prefs?.accountLibrary?' 열기 선택':' 실행'),row.entryId||row.id)).join('')+'</div>':'<p class="member-empty">앱을 열면 여기에 나와요.</p>')+'</section>'
      +(model.favorites.length?'<section class="member-section"><div class="member-section-heading"><h2>즐겨찾기</h2><span>라이브러리에서 별표한 앱</span></div><div class="member-apps">'+model.favorites.map(id=>appCard(id)).join('')+'</div></section>':'')
      +'<section class="member-section"><div class="member-section-heading"><div><h2>내 메모</h2><p>앱에서 이어서 할 일이나 기억할 결과를 적어 두는 곳이에요. 이 PC에 지금 계정으로 저장돼요.</p></div><button class="ghost-button" '+(model.canSave?'data-member-add':'data-member-account')+' '+(loading||unavailable||model.canSave&&(!model.order.length||storageBlocked)?'disabled':'')+'>'+(model.canSave?'메모 쓰기':'로그인')+'</button></div>'
      +(storageBlocked&&model.canSave?'<div class="member-draft-choice" role="alert" data-member-storage-error><strong>저장한 메모를 읽지 못했어요.</strong><p>'+esc(storageState.message)+'</p><button class="ghost-button" type="button" data-member-retry-storage>다시 읽기</button></div>':'')
      +(recoveryState.error&&model.canSave?'<div class="member-draft-choice" role="alert" data-member-recovery-error><strong>임시 저장한 메모를 확인하지 못했어요.</strong><p>'+esc(recoveryState.error.message)+'</p><button class="ghost-button" type="button" data-member-retry-recovery '+(!recoveryState.retryable?'disabled':'')+'>'+(recoveryState.pending?'확인 중…':'다시 시도')+'</button></div>':'')
      +(recoveryCandidate&&model.canSave?'<div class="member-draft-choice" role="group" aria-label="임시 저장한 메모"><strong>쓰다 만 메모가 있어요.</strong><p>이 PC에 암호화해 둔 임시 저장본이에요. 불러온 뒤 저장해 주세요.</p><div><button class="solid-button" type="button" data-member-recover>불러오기</button><button class="ghost-button" type="button" data-member-forget-recovery>버리기</button></div></div>':'')
      +(formOpen&&model.canSave?'<form id="member-record-form" class="member-form"><label>종류<select name="kind"><option value="task">이어서 할 일</option><option value="note">결과 메모</option></select></label><label>연결할 앱<select name="appId">'+model.order.map(id=>'<option value="'+id+'">'+esc(APPS[id].name)+'</option>').join('')+'</select></label><label class="member-field-wide">제목<input name="title" required maxlength="80" placeholder="예: 다음 시안에서 확인할 부분"></label><label class="member-field-wide">내용<textarea name="body" maxlength="1200" rows="3" placeholder="다시 볼 때 필요한 것만 적어 주세요."></textarea></label><label class="member-consent member-field-wide"><input type="checkbox" name="consent" required>이 PC에 지금 계정으로 저장하는 데 동의해요.</label><div class="member-form-actions member-field-wide"><button class="solid-button" type="submit" '+(!model.order.length||storageBlocked?'disabled':'')+'>저장</button><button class="ghost-button" type="button" data-member-cancel>취소</button></div></form>':'')
      +(discardRequested?'<div class="member-draft-choice" role="group" aria-labelledby="member-draft-title"><strong id="member-draft-title">아직 저장하지 않은 내용이 있어요.</strong><p>계속 쓰거나, 쓰던 내용을 버리고 닫을 수 있어요.</p><div><button class="solid-button" type="button" data-member-keep>계속 쓰기</button><button class="ghost-button" type="button" data-member-discard>버리기</button></div></div>':'')
      +'<p class="member-message" role="status">'+esc(message)+'</p>'+(records.length?'<div class="member-record-filters"><label>메모 찾기<input type="search" data-member-record-search value="'+esc(recordQuery)+'" placeholder="제목·내용·앱 이름" aria-controls="member-record-results"></label><label>보기<select data-member-record-filter aria-controls="member-record-results">'+[['all','전부'],['pending','안 끝낸 할 일'],['done','끝낸 할 일'],['notes','결과 메모']].map(([value,label])=>'<option value="'+value+'" '+(recordFilter===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div>':'')+'<div id="member-record-results" class="member-record-columns"><div><h3 class="member-column-title">이어서 할 일 <span>'+shownTasks.length+'</span></h3>'+(shownTasks.length?shownTasks.map(recordCard).join(''):'<p class="member-empty">'+(recordQuery||recordFilter!=='all'?'찾는 할 일이 없어요.':'이어서 할 일을 적어 두면 여기에 모여요.')+'</p>')+'</div><div><h3 class="member-column-title">저장한 결과 메모 <span>'+shownNotes.length+'</span></h3>'+(shownNotes.length?shownNotes.map(recordCard).join(''):'<p class="member-empty">'+(recordQuery||recordFilter!=='all'?'찾는 메모가 없어요.':'기억할 결과를 적어 두면 여기에 모여요.')+'</p>')+'</div></div></section>'
      +'<section class="member-discover"><div><span class="label">SYNK FOR YOU</span><h2>회원 혜택 네 가지</h2><p>내 성향, AI 구독 계정판, 무료 운세, 플레저. 넷 다 무료예요.</p><button class="ghost-button" data-member-benefits>회원 혜택 보기 '+arrow+'</button></div><div class="member-discover-stack" aria-hidden="true">'+[['care','플레저'],['fortune','운세'],['insight','성향'],['subscriptions','구독']].map(([id,word])=>'<span class="brand-'+id+'"><b style="--len:'+word.length+'">'+word+'</b></span>').join('')+'</div></section>';
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
    else if('memberAdd' in data){formOpen=true;message='';discardRequested=false;render();root.querySelector('[name=title]')?.focus();}
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
