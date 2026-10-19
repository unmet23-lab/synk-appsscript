import { TRAVEL_PLACES, TRAVEL_META } from './places-v2.mjs';
import { planTravel, replanTravel, replanRemainingTravel, suggestTravelRecovery, normalizePlannerInput, plannerInputFingerprint, assessCompanionFit, estimateWalkingLeg, PREFERENCE_LABELS } from './planner.mjs';
import { createWalkingRouter } from './walking-router.mjs';
import { evaluateRealStay } from './real-conditions.mjs';
import { REAL_CONDITION_CALENDAR } from './real-places.mjs';
import { ORIGIN_BOUNDS, originPoint, originPosition, createMapOrigin } from './planner-origin.mjs';
import { createTravelMemory, validateTravelMemory, defaultTravelQuery, loadTravelMemory, saveTravelMemory, clearTravelMemory, setTravelConsent, exportTravelMemory, importTravelMemory, TRAVEL_STORAGE_KEY, TRAVEL_MAX_BYTES } from './planner-storage.mjs';
import { recordPlanDecision, recordPlanExposure, recordVisit, recordTripOutcome, proposeVisitPreference, confirmTravelPreference, removeTravelPreference, editTravelVisit, removeTravelVisit, clearTravelHistory, TRAVEL_VISIT_REASONS } from './planner-feedback.mjs';
import { TRAVEL_ACCOUNT_CONTRACT } from './planner-account.mjs';
import { createTravelAccountSession } from './planner-account-session.mjs';
import { TRAVEL_LOGIN_FIELDS, validateTravelLoginDraft } from './planner-login-draft.mjs';
import * as LoomModule from '../../tools/lib/loom-motion.js';
const Loom = LoomModule.default ?? globalThis.LoomMotion;
const $=selector=>document.querySelector(selector), $$=selector=>[...document.querySelectorAll(selector)];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'#';}catch{return '#';}};
const e=escape, money=value=>Number(value||0).toLocaleString('ko-KR')+'원';
const placeMap=new Map(TRAVEL_PLACES.map(p=>[p.id,p]));
const categoryLabel={food:'한 끼의 즐거움',tea:'차와 카페',culture:'문화와 산책',stay:'하룻밤의 쉼'};
const categoryShort={food:'한 끼',tea:'차와 카페',culture:'문화와 산책',stay:'숙소'};
const seoulDay=date=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short'}).format(new Date(date+'T12:00:00+09:00'));
const budgetLabel=value=>value>=10000&&value%10000===0?value/10000+'만 원':money(value);
// 하고 싶은 것 → 엔진 취향(prefs)과 실제 장소 표시(check). 궁궐은 역사+산책, 골목은 산책+야외라서
// 취향으로 서로 갈리고, 넣었는지는 진짜 궁·한옥 골목·시장 표시로 확인한다.
const INTENTS={food:{short:'맛집',prefs:{food:true},check:{category:'food'}},tea:{short:'차',prefs:{tea:true},check:{category:'tea'}},art:{short:'전시',prefs:{art:true},check:{feature:'art'}},
 palace:{short:'궁궐',prefs:{history:true,walk:true},check:{feature:'palace'}},alley:{short:'골목',prefs:{walk:true,outdoor:true},check:{feature:'hanok',category:'culture'}},market:{short:'시장',prefs:{marketFood:true},check:{feature:'market'}}};
const MANAGED=new Set(Object.values(INTENTS).flatMap(intent=>Object.keys(intent.prefs)));
// 쓸 시간 → 장소 수·걷기 상한. 상한은 넉넉히 두고 엔진이 덜 걷는 쪽을 고른다.
const HOURS={1:{label:'1시간',stops:1,walk:20},2:{label:'2시간',stops:2,walk:50},3:{label:'3시간',stops:3,walk:70},5:{label:'반나절',stops:4,walk:100},8:{label:'하루',stops:5,walk:150}};
// 사진이 없는 곳은 그곳 대표 메뉴를 펠트로 구운 그림을 쓴다(2026-10-19 굽기).
const FELT={'gaeseong-mandu-koong':'mandu',hwangsaengga:'kalguksu',tosokchon:'samgyetang','gwanghwamun-mijin':'memil','balwoo-gongyang':'baru','kyungin-traditional-teahouse':'tea-table','osulloc-bukchon':'green-tea','beautiful-tea-museum':'tea-tin','fritz-wonseo':'croissant','onion-anguk':'pandoro'};
const feltSrc=name=>`./assets/felt/${name}.webp`;
const minutesOf=value=>Number(value.slice(0,2))*60+Number(value.slice(3));
const clockText=value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let picks=[],pickHours=3,dialFrame=0,foodByHand=false,handWhen=null,animatedPlan=null,chooserIssue=null,chooserChanges={appointments:[],kept:[],meal:null};const dial={value:3,velocity:0};
// 폼에서 직접 켠 취향. 고르기는 이것을 끄지 않는다.
const handPrefs=new Set();
let mapLoaded;const mapReady=new Promise(resolve=>{mapLoaded=resolve;});
const origins=[{id:'anguk',name:'안국역',lat:37.5765,lon:126.9854},{id:'gyeongbokgung',name:'경복궁역',lat:37.57585,lon:126.9731},{id:'jonggak',name:'종각역',lat:37.57016,lon:126.98306},{id:'gwanghwamun',name:'광화문역',lat:37.57153,lon:126.9766}];
let memory=createTravelMemory(), outcome=null, pending=null, routeLeg=null, network=null, mapZoom=1, selectedCategory='all', toastTimer, activeDecision=null, formDirty=false, restored=false, editingVisit=null;
let exposureObserver=null, formPreferences={}, formRequiredFeatures={}, formRequiredCategories=[];
let originTarget='trip', originDraft=null;
let destinationDraft=null;
let companionDraft=[];
let recoveryChoices=[];
let accountSession=null, accountApplying=false;
const baseOrigins=structuredClone(origins);
// A slower device must not move an existing record's event clock backwards.
const now=()=>new Date(Math.max(Date.now(),Date.parse(memory.updatedAt)||0)).toISOString();
const koreanDate=at=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
function notice(message){$('#form-error').textContent=message;$('#form-error').hidden=false;}
function persist(){
 if(accountApplying||accountSession?.hydrating||accountLocked())return;
 memory.updatedAt=now();
 if(accountSession?.active){memory.consent=false;void accountSession.persist(memory).catch(error=>toast(error.message));return;}
 if(memory.consent){try{saveTravelMemory(memory);}catch(error){memory.consent=false;toast('저장하지 못했어요. 화면의 여행은 유지돼요. 파일로 가져갈 수 있어요.');}}
}
function accountLocked(){const content=$('#travel-product-content');return Boolean(accountSession?.locked||content?.inert||content?.hidden);}
function closeTravelDialogs(){for(const dialog of $$('dialog'))if(dialog.open)dialog.close();}
function resetOriginChoices(){
 origins.splice(0,origins.length,...structuredClone(baseOrigins));$('#origin').replaceChildren();
 for(const origin of origins){const option=document.createElement('option');option.value=origin.id;option.textContent=origin.name;$('#origin').append(option);}
 originDraft=null;originTarget='trip';destinationDraft=null;$('#origin-content').innerHTML='';$('#origin-footer').innerHTML='';
}
function captureGuestDraft(){
 return {formDirty,formPreferences:{...formPreferences},formRequiredFeatures:{...formRequiredFeatures},formRequiredCategories:[...formRequiredCategories],origins:structuredClone(origins),
  companions:readCompanions(),controls:[...$('#trip-form').querySelectorAll('input,select')].filter(control=>!control.closest('[data-companion-id]')).map(control=>({value:control.value,checked:control.checked,options:control.tagName==='SELECT'?[...control.options].map(option=>({value:option.value,text:option.textContent})):null})),
  outcome:structuredClone(outcome),pending:structuredClone(pending),recoveryChoices:structuredClone(recoveryChoices),changeHtml:$('#plan-change').innerHTML,changeHidden:$('#plan-change').hidden,
  destinationDraft:structuredClone(destinationDraft),originTarget,originDraft:structuredClone(originDraft),originHtml:$('#origin-content').innerHTML,originOpen:$('#origin-dialog').open,
  originHeading:$('#origin-dialog h2').textContent,originFooter:$('#origin-footer').innerHTML,
  originControls:[...$('#origin-content').querySelectorAll('input')].map(control=>({id:control.id,value:control.value})),
 };
}
function restoreGuestDraft(draft){
 origins.splice(0,origins.length,...structuredClone(draft.origins));
 writeCompanions(draft.companions??[]);
 const controls=[...$('#trip-form').querySelectorAll('input,select')].filter(control=>!control.closest('[data-companion-id]'));
 draft.controls.forEach((value,index)=>{const control=controls[index];if(!control)return;if(value.options){control.replaceChildren();for(const item of value.options){const option=document.createElement('option');option.value=item.value;option.textContent=item.text;control.append(option);}}control.value=value.value;control.checked=value.checked;});
 formDirty=draft.formDirty;formPreferences=draft.formPreferences;formRequiredFeatures=draft.formRequiredFeatures;formRequiredCategories=draft.formRequiredCategories;
 outcome=draft.outcome;pending=draft.pending;recoveryChoices=draft.recoveryChoices;$('#plan-change').innerHTML=draft.changeHtml;$('#plan-change').hidden=draft.changeHidden;
 destinationDraft=draft.destinationDraft;originTarget=draft.originTarget;originDraft=draft.originDraft;$('#origin-content').innerHTML=draft.originHtml;
 $('#origin-dialog h2').textContent=draft.originHeading;$('#origin-footer').innerHTML=draft.originFooter;
 labelOriginPicker();syncScheduleFields();updateCompanionCount();
 for(const field of draft.originControls){const control=$('#'+field.id);if(control)control.value=field.value;}
 picksFromQuery({preferences:readPreferences()});
 if(draft.formDirty)handWhen={date:$('#trip-date').value,start:$('#start-time').value};
 if(draft.originOpen)$('#origin-dialog').showModal();
}
function loginFieldKey(control){
 if(control.dataset.taste)return 'taste:'+control.dataset.taste;
 if(['preference','avoid'].includes(control.name))return control.name+':'+control.value;
 return TRAVEL_LOGIN_FIELDS.includes(control.id)?control.id:null;
}
function captureLoginDraft(){
 const controls={};for(const control of $('#trip-form').querySelectorAll('input,select')){if(control.closest('[data-companion-id]'))continue;const key=loginFieldKey(control);if(key)controls[key]={value:control.value,checked:Boolean(control.checked)};}
 const cleanPoint=point=>point?{id:point.id,name:point.name,lat:point.lat,lon:point.lon}:null;
 return validateTravelLoginDraft({controls,companions:readCompanions(),preferences:{...formPreferences},requiredFeatures:{...formRequiredFeatures},requiredCategories:[...formRequiredCategories],
  origin:cleanPoint(origins.find(row=>row.id===$('#origin').value)),destination:cleanPoint(destinationDraft),formDirty,
  panels:{conditions:$('#conditions-panel').open,companions:$('#companions-details').open,schedule:$('#schedule-details').open}});
}
function restoreLoginDraft(raw){
 const draft=validateTravelLoginDraft(raw);if(!draft)return;
 formPreferences=draft.preferences;formRequiredFeatures=draft.requiredFeatures;formRequiredCategories=draft.requiredCategories;
 if(draft.origin){const index=origins.findIndex(row=>row.id===draft.origin.id);if(index<0)origins.push(draft.origin);else origins[index]=draft.origin;
  let option=[...$('#origin').options].find(row=>row.value===draft.origin.id);if(!option){option=document.createElement('option');option.value=draft.origin.id;$('#origin').append(option);}option.textContent=draft.origin.name;}
 destinationDraft=draft.destination;
 if(destinationDraft){let option=[...$('#destination').options].find(row=>row.value==='custom');if(!option){option=document.createElement('option');option.value='custom';$('#destination').append(option);}option.textContent=destinationDraft.name;}
 writeCompanions(draft.companions);
 for(const control of $('#trip-form').querySelectorAll('input,select')){if(control.closest('[data-companion-id]'))continue;const field=draft.controls[loginFieldKey(control)];if(!field)continue;
  if(['walking','max-leg-walk','rest-every','rest-duration','stop-count'].includes(control.id)&&![...control.options].some(row=>row.value===field.value)){const option=document.createElement('option');option.value=field.value;option.textContent=field.value+(control.id==='stop-count'?'곳':'분');control.append(option);}
  control.value=field.value;control.checked=field.checked;
 }
 clearRecovery();pending=null;$('#plan-change').hidden=true;formDirty=draft.formDirty;
 $('#conditions-panel').open=draft.panels.conditions;$('#companions-details').open=draft.panels.companions;$('#schedule-details').open=draft.panels.schedule;
 syncScheduleFields();updateCompanionCount();picksFromQuery({preferences:readPreferences()});
 // 로그인 전에 폼을 고치던 중이면 돌아온 날짜·출발 시각을 직접 정한 것으로 둔다(고르기가 다시 덮지 않게).
 if(draft.formDirty)handWhen={date:$('#trip-date').value,start:$('#start-time').value};
}
function applyAccountState(value,{guest=false}={}){
 accountApplying=true;
 try{
  closeTravelDialogs();memory=validateTravelMemory({...value,consent:guest?value.consent:false});
  resetOriginChoices();editingVisit=null;$('#place-detail').innerHTML='';$('#progress-content').innerHTML='';$('#swap-content').innerHTML='';
  writeInput(memory.query);picksFromQuery(memory.query);restorePlan({snapshot:true});renderMemory();
  // 계정 화면이 잠겨 있던 동안 넘긴 뒤로·앞으로를 지금 보이는 화면에 맞춘다.
  history.replaceState({pathView:memory.plan?'result':'intent'},'');
 }finally{accountApplying=false;}
}
function showAccount(){closeTravelDialogs();$('#travel-account-panel').scrollIntoView({behavior:'smooth',block:'center'});$('#travel-account').focus({preventScroll:true});}
async function connectTravelAccount(){
 const mount=$('#travel-account'),content=$('#travel-product-content');if(!mount||!content)return;
 mount.tabIndex=-1;
 try{accountSession=await createTravelAccountSession({mount,content,getState:()=>memory,applyState:applyAccountState,captureGuestDraft,restoreGuestDraft,captureLoginDraft,restoreLoginDraft,closeDialogs:closeTravelDialogs,
  notebookOptions:{configUrl:new URL('./config.json',import.meta.url).href},
  onLoginRestore:()=>toast('로그인 전 여행과 입력하던 조건을 복원했어요. 적용하지 않은 일정 미리보기는 다시 계산해 주세요.'),
  beforeNavigate:()=>!formDirty||globalThis.confirm(accountSession?.active?'아직 적용하지 않은 조건이 있어요. 계정 화면을 바꾸면 이 입력은 사라질 수 있어요. 계속할까요?':'아직 적용하지 않은 조건이 있어요. 로그인할 때는 현재 여행과 입력을 이 탭에 30분 동안 임시 보관해 돌아오면 복원해요. 계속할까요?'),
  onStatus:()=>{if($('#memory-dialog').open)renderMemory();},
 });}catch{mount.textContent='계정 연결을 준비하지 못했어요. 현재 여행은 이 기기에서 계속 사용할 수 있어요.';}
}
function photo(place,cls='',loading='lazy'){return place.photo?`<img class="${e(cls)}" src="${e(place.photo.src)}" alt="${e(place.photo.alt||place.name+'의 모습')}" loading="${loading}" decoding="async">`:'';}
function credit(place){const p=place.photo;return p?`<a href="${e(safeUrl(p.sourceUrl))}" target="_blank" rel="noopener noreferrer">${e(p.title||place.name)}</a> © ${e(p.author)} · <a href="${e(safeUrl(p.licenseUrl))}" target="_blank" rel="noopener noreferrer">${e(p.license)}</a> · ${e(p.modifications||'변경 없음')}`:'';}
// 사진이 없는 곳은 다른 곳 사진을 빌리지 않고, 같은 크기의 정보 카드로 보여 준다.
function placeTile(place,{compact=false,show='menu'}={}){
 const menus=place.menuItems?.slice(0,2)??[],first=menus[0]?.name,old=menus.some(item=>item.sourcePublishedAt);
 if(compact){const text=show==='name'?place.name:first||categoryShort[place.category]||place.name;return `<span class="tile tile-${e(place.category)} tile-compact"><strong>${e(text)}</strong>${show!=='name'&&first?`<span class="tile-cat">${e(categoryShort[place.category])}</span>`:''}</span>`;}
 return `<span class="tile tile-${e(place.category)}"><span class="tile-cat">${menus.length?(old?'예전에 소개된 메뉴':'확인한 메뉴'):e(categoryShort[place.category]||'')}</span><strong>${menus.length?menus.map(item=>e(item.name)).join('<br>'):e(place.area||'종로')+' · 공식 안내로 확인'}</strong></span>`;
}
// 사진 → 펠트 그림 → 정보 카드 순서. 펠트 그림은 이름 옆에만 쓰여 글로 다시 읽지 않는다.
function feltImage(place,cls=''){return FELT[place.id]?`<img class="${e(cls)}" src="${feltSrc(FELT[place.id])}" alt="" loading="lazy" decoding="async">`:'';}
function placeCover(place){return place.photo?photo(place):FELT[place.id]?`<span class="felt-cover tint-${e(place.category)}">${feltImage(place)}</span>`:placeTile(place);}
function placeThumb(place){return place.photo?photo(place):FELT[place.id]?`<span class="thumb-felt tint-${e(place.category)}">${feltImage(place)}</span>`:placeTile(place,{compact:true,show:'name'});}
function placeLink(place){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name+' '+place.address)}`;}
function directionLink(from,to){const p=from.coordinates??from,destination=to.address?to.name+' '+to.address:(to.coordinates??to).lat+','+(to.coordinates??to).lon;return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(p.lat+','+p.lon)}&destination=${encodeURIComponent(destination)}&travelmode=walking`;}
function readCompanions(){
 return companionDraft.map(row=>{
  const card=$$('[data-companion-id]').find(el=>el.dataset.companionId===row.id);
  if(!card)return structuredClone(row);
  const preferences={...row.preferences},requiredFeatures={...row.requiredFeatures};
  for(const control of card.querySelectorAll('[data-companion-preference]')){const key=control.dataset.companionPreference;if(control.value==='')delete preferences[key];else preferences[key]=control.value==='true';}
  for(const control of card.querySelectorAll('[data-companion-required]')){const key=control.dataset.companionRequired;if(control.checked)requiredFeatures[key]=true;else if(requiredFeatures[key]===true)delete requiredFeatures[key];}
  return {id:row.id,label:card.querySelector('[data-companion-label]').value,preferences,requiredFeatures};
 });
}
function writeCompanions(rows=[]){
 companionDraft=structuredClone(rows);renderCompanions();
}
function renderCompanions(){
 const list=$('#companions-list');if(!list)return;
 const primaryKeys=['food','tea','art','history','indoor','outdoor'];
 const requiredLabels={indoor:'실내 장소만',quiet:'조용함 확인 필요',vegetarian:'식사는 채식 확인 필요',stepFree:'계단 없는 접근 확인 필요'};
 list.innerHTML=companionDraft.map((row,index)=>{
  const field=key=>`<label class="companion-preference" for="companion-${index}-${e(key)}"><span>${e(PREFERENCE_LABELS[key])}</span><select id="companion-${index}-${e(key)}" data-companion-preference="${e(key)}"><option value="" ${typeof row.preferences[key]!=='boolean'?'selected':''}>정하지 않음</option><option value="true" ${row.preferences[key]===true?'selected':''}>좋아요</option><option value="false" ${row.preferences[key]===false?'selected':''}>피하고 싶어요</option></select></label>`;
  const otherRequired=Object.entries(row.requiredFeatures).filter(([key,value])=>!Object.hasOwn(requiredLabels,key)||value===false);
  return `<article class="companion-card" data-companion-id="${e(row.id)}"><header><strong>여행자 ${index+1}</strong><button class="button secondary" type="button" data-remove-companion="${e(row.id)}" aria-label="${e(row.label)} 취향 삭제">삭제</button></header><details class="companion-editor" ${!Object.keys(row.preferences).length&&!Object.keys(row.requiredFeatures).length?'open':''}><summary>${e(row.label)} · 취향 ${Object.keys(row.preferences).length}개${Object.keys(row.requiredFeatures).length?' · 필수 '+Object.keys(row.requiredFeatures).length+'개':''}</summary><label class="field" for="companion-label-${index}">구분할 별칭<input id="companion-label-${index}" data-companion-label maxlength="24" value="${e(row.label)}" placeholder="예: 나, 친구, 동행 1"></label><p class="micro">실명 없이 구분해도 좋아요. 이번 여행에 원하는 것만 직접 골라주세요.</p><div class="companion-preferences">${primaryKeys.map(field).join('')}</div><details><summary>음식·카페와 나머지 취향</summary><div class="companion-preferences">${Object.keys(PREFERENCE_LABELS).filter(key=>!primaryKeys.includes(key)).map(field).join('')}</div></details><details><summary>이 사람에게 꼭 필요한 조건</summary><div class="companion-requirements">${Object.entries(requiredLabels).map(([key,label])=>`<label><input type="checkbox" data-companion-required="${key}" ${row.requiredFeatures[key]===true?'checked':''}> ${e(label)}</label>`).join('')}</div><p class="micro">필수 조건은 자료로 확인돼야 해요. 메뉴 취향은 알레르기 확인을 대신하지 않습니다.</p>${otherRequired.length?`<p class="micro">파일에서 이어진 조건: ${otherRequired.map(([key,value])=>e(PREFERENCE_LABELS[key])+': '+(value?'필수':'반드시 제외')).join(' · ')}</p><button class="button secondary" type="button" data-clear-companion-extra="${e(row.id)}">이 추가 필수 조건 해제</button>`:''}</details></details></article>`;
 }).join('');
 updateCompanionCount();
}
function updateCompanionCount(){
 const total=Number($('#adults').value)+Number($('#children').value),count=companionDraft.length;
 $('#companions-count').textContent=count?`전체 ${total}명 중 ${count}명의 취향을 입력하고 있어요. 나머지 사람의 취향은 추정하지 않아요.`:'아직 사람별 취향을 넣지 않았어요. 위의 공통 조건으로 추천합니다.';
 $('#add-companion').disabled=count>=6||count>=total;
}
function updateCompanionLabel(target){
 const card=target.closest('[data-companion-id]');if(!card)return;
 const person=readCompanions().find(row=>row.id===card.dataset.companionId);if(!person)return;
 const label=person.label||'별칭을 입력해 주세요',required=Object.keys(person.requiredFeatures).length;
 card.querySelector('.companion-editor>summary').textContent=label+' · 취향 '+Object.keys(person.preferences).length+'개'+(required?' · 필수 '+required+'개':'');
 card.querySelector('[data-remove-companion]').setAttribute('aria-label',label+' 취향 삭제');
}
function editCompanions(action,id){
 const rows=readCompanions();
 if(action==='add'){
  if(rows.length>=6||rows.length>=Number($('#adults').value)+Number($('#children').value)){toast('총인원 안에서 최대 6명의 취향을 넣을 수 있어요.');return;}
  let index=1;while(rows.some(row=>row.id==='person-'+index))index++;
  rows.push({id:'person-'+index,label:'동행 '+index,preferences:{},requiredFeatures:{}});
 }else if(action==='remove'){
  const index=rows.findIndex(row=>row.id===id);if(index===-1)return;rows.splice(index,1);
 }else if(action==='clear-extra'){
  const row=rows.find(row=>row.id===id);if(!row)return;
  row.requiredFeatures=Object.fromEntries(Object.entries(row.requiredFeatures).filter(([key,value])=>['indoor','quiet','vegetarian','stepFree'].includes(key)&&value===true));
 }
 writeCompanions(rows);clearRecovery();formDirty=true;pending=null;$('#plan-change').hidden=true;$('#form-error').hidden=true;
 if(action==='add')$('#companions-list [data-companion-id]:last-child [data-companion-label]')?.focus();
}
function companionSummary(plan,input){
 if(!input.companions?.length)return '';
 const fits=assessCompanionFit(plan.stops,input.companions),names=ids=>ids.map(id=>placeMap.get(id)?.name??id).join(', ');
 const copy=row=>{
  const label=PREFERENCE_LABELS[row.key];
  if(row.status==='reflected')return row.value?`${label} · ${names(row.matchedPlaceIds)}`:row.matchedPlaceIds.length?`${label} 피하기 · 관련 장소의 특성 확인`:`${label} 피하기 · 해당 방문 없음`;
  if(row.status==='conflict')return `${label}을 피하고 싶지만 포함 · ${names(row.conflictPlaceIds)}`;
  if(row.status==='unknown')return `${label}${row.value?'':' 피하기'} · 장소 정보가 부족해요`;
  return `${label}${row.value?'':' 피하기'} · 이번 코스에는 반영하지 못했어요`;
 };
 return `<section class="companion-results"><h4>각자의 취향은 어떻게 반영됐나요?</h4><p class="micro">전체 ${input.party.adults+input.party.children}명 중 입력한 ${fits.length}명 기준이에요. ${input.planningMode==='remaining'?'앞으로 갈 곳만 비교하며 이미 다녀온 곳은 세지 않아요. ':''}취향을 더 적어도 한 사람의 비중이 커지지 않게 비교합니다.</p>${fits.map(fit=>{const person=input.companions.find(p=>p.id===fit.id);return `<article class="companion-fit"><h5>${e(fit.label)}</h5>${fit.preferences.length?`<ul>${fit.preferences.map(row=>`<li class="fit-${e(row.status)}">${e(copy(row))}</li>`).join('')}</ul>`:'<p>선호는 따로 정하지 않았어요.</p>'}${Object.keys(person.requiredFeatures).length?`<p class="micro">요청한 필수 조건 · ${Object.entries(person.requiredFeatures).map(([key,value])=>e(PREFERENCE_LABELS[key])+(value?'':' 제외')).join(' · ')}</p>`:''}</article>`;}).join('')}<p class="micro">확인된 장소 특성과 고른 취향을 비교한 결과예요. 실제 만족도나 현장 상태를 측정한 값은 아닙니다.</p></section>`;
}

function readMeal(prefix=''){
 const mode=$('#'+prefix+'meal-mode')?.value||'any',start=$('#'+prefix+'meal-start')?.value,end=$('#'+prefix+'meal-end')?.value;
 return {mode,startTime:mode==='window'?start:'12:00',endTime:mode==='window'?end:'13:00'};
}
function syncScheduleFields(prefix=''){
 const window=$('#'+prefix+'meal-window');if(!window)return;
 window.hidden=$('#'+prefix+'meal-mode').value!=='window';
 $('#'+prefix+'meal-start').disabled=window.hidden;$('#'+prefix+'meal-end').disabled=window.hidden;
}
function readScheduleInput(){
 const selected=$('#destination').value,origin=origins.find(p=>p.id===$('#origin').value);
 const destination=selected==='@origin'?{...origin}:selected==='custom'?(destinationDraft?{...destinationDraft}:null):null;
 const appointments=[];for(let i=0;i<3;i++){const placeId=$('#appointment-place-'+i).value;if(placeId)appointments.push({placeId,time:$('#appointment-time-'+i).value});}
 return {destination,appointments,meal:readMeal()};
}
function writeScheduleInput(input){
 const meal=input.meal??{mode:'any',startTime:'12:00',endTime:'13:00'};
 $('#meal-mode').value=meal.mode;$('#meal-start').value=meal.startTime;$('#meal-end').value=meal.endTime;syncScheduleFields();
 for(let i=0;i<3;i++){
  const select=$('#appointment-place-'+i);select.replaceChildren();
  const empty=document.createElement('option');empty.value='';empty.textContent='정하지 않음';select.append(empty);
  for(const place of TRAVEL_PLACES.filter(p=>p.category!=='stay')){const option=document.createElement('option');option.value=place.id;option.textContent=place.name;select.append(option);}
  select.value=input.appointments?.[i]?.placeId??'';$('#appointment-time-'+i).value=input.appointments?.[i]?.time??['12:00','14:00','16:00'][i];
 }
 destinationDraft=input.destination?{...input.destination}:null;
 const select=$('#destination');select.replaceChildren();
 const same=destinationDraft&&['id','name','lat','lon'].every(key=>destinationDraft[key]===input.origin[key]);
 const options=[['','마지막 방문지에서 마치기'],['@origin','출발점으로 돌아오기'],...(destinationDraft?[['custom',destinationDraft.name]]:[])];
 for(const [value,label] of options){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
 select.value=destinationDraft?(same?'@origin':'custom'):'';
}
function labelOriginPicker(){
 if(!$('#origin-content label[for="origin-name"]'))return;
 const destination=originTarget==='destination';
 $('#origin-dialog .eyebrow').textContent=destination?'YOUR FINAL STOP':'YOUR STARTING POINT';
 $('#origin-dialog .dialog-close').setAttribute('aria-label',destination?'도착점 선택 닫기':'출발점 선택 닫기');
 $('#origin-content label[for="origin-name"]').textContent=(destination?'도착점':'출발점')+' 이름 · 선택 사항';
 $('#origin-map').setAttribute('aria-label',destination?'도착 위치 선택 지도':'출발 위치 선택 지도');
}
function showOriginPicker(target='trip'){
 originTarget=target;
 const selected=target==='destination'?(destinationDraft??origins.find(row=>row.id===$('#origin').value)):target==='progress'?progressOrigins().find(row=>row.key===$('#progress-origin').value):origins.find(row=>row.id===$('#origin').value);
 originDraft=null;
 $('#origin-content').innerHTML=`<p>등록된 장소를 찾거나 지도에서 숙소·만날 위치를 직접 눌러주세요.</p><label class="field">등록 장소 이름·주소 검색<input id="origin-search" type="search" placeholder="숙소 또는 장소 이름"></label><div id="origin-matches" class="origin-matches"></div><p id="origin-map-help" class="micro">종로권 지도입니다. 위치를 누르거나 지도에 초점을 둔 뒤 방향키로 조정하세요. 이름 입력만으로 주소가 검색되지는 않아요.</p><div id="origin-map" class="origin-map" tabindex="0" role="group" aria-label="출발 위치 선택 지도" aria-describedby="origin-map-help"></div><p class="map-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors · ODbL</a></p><div class="field"><label for="origin-name">출발점 이름 · 선택 사항</label><input id="origin-name" maxlength="160" placeholder="예: 숙소 정문"></div><details><summary>좌표를 직접 입력하기</summary><div class="field-row"><div class="field"><label for="origin-lat">위도</label><input id="origin-lat" type="number" step="any" inputmode="decimal"></div><div class="field"><label for="origin-lon">경도</label><input id="origin-lon" type="number" step="any" inputmode="decimal"></div></div><button class="button secondary" type="button" data-action="origin-coordinates">이 좌표를 지도에서 확인</button></details><p class="micro">GPS를 사용하지 않아요. 고른 위치에서 가까운 길까지의 연결과 실제 건물 입구는 미확인일 수 있어요.</p>`;
 $('#origin-dialog h2').textContent=target==='destination'?'마지막에 도착할 곳을 골라요.':'내가 있는 곳에서 출발해요.';
 $('#origin-footer').innerHTML=`<p id="origin-selection" class="micro" aria-live="polite">지도를 눌러 위치를 골라주세요.</p><p id="origin-error" class="error" hidden role="alert"></p><button class="button primary" type="button" id="origin-confirm" data-action="accept-origin" disabled>이 위치를 ${target==='destination'?'도착점':'출발점'}으로</button>`;
 labelOriginPicker();renderOriginMap();renderOriginMatches();
 if(selected){try{setOriginPoint(selected,selected.name);}catch{}}
 $('#origin-dialog').showModal();
}
function renderOriginMap(){
 const [south,west,north,east]=ORIGIN_BOUNDS;
 const xy=([lon,lat])=>[(lon-west)/(east-west)*640,(north-lat)/(north-south)*540];
 const roads=(network?.ways??[]).map(way=>{const major=['primary','secondary','tertiary'].includes(way.kind);return `<path d="${way.n.map((i,j)=>(j?'L':'M')+xy(network.nodes[i]).map(v=>v.toFixed(1)).join(',')).join('')}" fill="${way.kind==='park'?'#dce8d8':'none'}" stroke="${major?'#fff':'#d4ded0'}" stroke-width="${major?5:1}"/>`;}).join('');
 const labels=[...origins.slice(0,4),...TRAVEL_PLACES.filter(p=>['gyeongbokgung','changgyeonggung','tongin-market','bukchon-hanok'].includes(p.id)).map(p=>({...p,...p.coordinates}))];
 $('#origin-map').innerHTML=`<svg viewBox="0 0 640 540" aria-hidden="true"><rect width="640" height="540" fill="#edf1e9"/>${roads}${labels.map(p=>{const [x,y]=xy([p.lon,p.lat]);return `<circle cx="${x}" cy="${y}" r="4" fill="#53684e"/><text x="${x+6}" y="${y+4}" font-size="17" fill="#243929" stroke="#fff" stroke-width="3" paint-order="stroke">${e(p.name)}</text>`;}).join('')}<g id="origin-pin" hidden><circle r="14" fill="#39523f" stroke="white" stroke-width="4"/><circle r="3" fill="white"/></g></svg>`;
 if(!network)$('#origin-map-help').textContent='도로 자료를 불러오지 못했어요. 등록 장소나 알고 있는 좌표를 사용해 주세요.';
}
function setOriginPoint(point,name=''){
 const pos=originPosition(point);originDraft={lat:point.lat,lon:point.lon};
 $('#origin-pin').removeAttribute('hidden');$('#origin-pin').setAttribute('transform',`translate(${pos.x*640} ${pos.y*540})`);
 $('#origin-lat').value=point.lat;$('#origin-lon').value=point.lon;$('#origin-name').value=name;
 $('#origin-selection').textContent=`선택했어요. 아래에서 적용해 주세요. · ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
 $('#origin-confirm').disabled=false;$('#origin-error').hidden=true;
}
function renderOriginMatches(){
 const q=$('#origin-search').value.trim().toLocaleLowerCase();
 const matches=TRAVEL_PLACES.filter(p=>p.coordinates).filter(p=>q?(p.name+' '+p.address).toLocaleLowerCase().includes(q):p.category==='stay').slice(0,6);
 $('#origin-matches').innerHTML=matches.length?matches.map(p=>`<button class="button secondary" type="button" data-origin-place="${e(p.id)}"><strong>${e(p.name)}</strong><small>${e(p.address)}</small></button>`).join(''):(q?'<p class="micro">등록 자료에서 찾지 못했어요. 지도에서 위치를 고르거나 좌표를 입력해 주세요.</p>':'');
}
function acceptOrigin(){
 if(!originDraft)return;
 if(originTarget==='destination'){
  destinationDraft=createMapOrigin(originDraft,$('#origin-name').value);const select=$('#destination');
  let option=[...select.options].find(row=>row.value==='custom');if(!option){option=document.createElement('option');option.value='custom';select.append(option);}option.textContent=destinationDraft.name;select.value='custom';
  clearRecovery();formDirty=true;pending=null;$('#plan-change').hidden=true;$('#form-error').hidden=true;$('#origin-dialog').close();select.focus();return;
 }
 const origin=createMapOrigin(originDraft,$('#origin-name').value),existing=origins.findIndex(row=>row.id===origin.id);
 if(existing>=0)origins[existing]={...origin};else origins.push({...origin});
 const select=$(originTarget==='progress'?'#progress-origin':'#origin'),value=originTarget==='progress'?'origin:'+origin.id:origin.id;
 let option=[...select.options].find(row=>row.value===value);if(!option){option=document.createElement('option');option.value=value;select.append(option);}option.textContent=origin.name;select.value=value;
 // Editing the selection remains a draft until the surrounding plan is applied.
 clearRecovery();if(originTarget==='trip'){formDirty=true;pending=null;$('#plan-change').hidden=true;$('#form-error').hidden=true;}
 $('#origin-dialog').close();select.focus();
}
function readPreferences(){
 const preferences={...formPreferences};
 for(const input of $$('[name=preference]')){if(input.checked)preferences[input.value]=true;else if(preferences[input.value]===true)delete preferences[input.value];}
 for(const input of $$('[name=avoid]')){if(input.checked)preferences[input.value]=false;else if(preferences[input.value]===false)delete preferences[input.value];}
 for(const select of $$('[data-taste]')){const key=select.dataset.taste;if(select.value==='')delete preferences[key];else preferences[key]=select.value==='true';}
 return preferences;
}
// patch는 폼 값을 검사하기 전에 덮어쓸 때만 쓴다(첫 화면 고르기).
function readInput(patch=null){
 if(memory.progress?.finished)throw new TypeError('마친 여행은 진행 기록으로 남아 있어요. 새 여행 만들기로 시작해 주세요.');
 if(memory.progress&&$('#trip-date').value!==memory.progress.date)throw new TypeError('여행 중 날짜는 유지해 주세요. 다른 날짜는 새 여행 만들기에서 시작할 수 있어요.');
 if(memory.progress&&$('#start-time').value<memory.progress.currentTime)throw new TypeError('진행 기록보다 이른 시각으로 되돌릴 수 없어요. 현재 이후의 출발 시각을 골라 주세요.');
 const preferences=readPreferences();
 for(const id of ['budget','adults','children'])if($('#'+id).value===''){const error=new TypeError('예산과 인원을 숫자로 입력해 주세요.');error.field=id==='budget'?'budget':'party';throw error;}
 const requiredFeatures={...formRequiredFeatures};for(const key of ['indoor','vegetarian','stepFree']){if($('#require-'+(key==='stepFree'?'stepfree':key)).checked)requiredFeatures[key]=true;else if(requiredFeatures[key]===true)delete requiredFeatures[key];}
 const requiredCategories=formRequiredCategories.filter(key=>key!=='food');if($('#require-food').checked)requiredCategories.push('food');
 const raw={...readScheduleInput(),companions:readCompanions(),planningMode:memory.query.planningMode??'day',date:$('#trip-date').value,startTime:$('#start-time').value,endTime:$('#end-time').value,origin:origins.find(p=>p.id===$('#origin').value),party:{adults:Number($('#adults').value),children:Number($('#children').value)},budget:Number($('#budget').value),maxWalkMinutes:Number($('#walking').value),maxLegWalkMinutes:$('#max-leg-walk').value===''?null:Number($('#max-leg-walk').value),restEveryMinutes:$('#rest-every').value===''?null:Number($('#rest-every').value),restDurationMinutes:Number($('#rest-duration').value),stopCount:Number($('#stop-count').value),preferences,requiredFeatures,requiredCategories,lockedIds:memory.query.lockedIds??[],excludedIds:memory.query.excludedIds??[]};
 patch?.(raw);
 return normalizePlannerInput(raw,{places:TRAVEL_PLACES});
}
function writeInput(input){
 formPreferences={...input.preferences};
 formRequiredFeatures={...input.requiredFeatures};formRequiredCategories=[...input.requiredCategories];
 $('#trip-date').value=input.date;$('#start-time').value=input.startTime;$('#end-time').value=input.endTime;
 if(origins.some(p=>p.id===input.origin.id)){origins[origins.findIndex(p=>p.id===input.origin.id)]={...input.origin};const option=[...$('#origin').options].find(o=>o.value===input.origin.id);if(option)option.textContent=input.origin.name;$('#origin').value=input.origin.id;}
 else{const option=document.createElement('option');option.value=input.origin.id;option.textContent=input.origin.name;$('#origin').append(option);origins.push({...input.origin});$('#origin').value=input.origin.id;}
 $('#adults').value=input.party.adults;$('#children').value=input.party.children;$('#budget').value=input.budget;
 if(![...$('#walking').options].some(o=>Number(o.value)===input.maxWalkMinutes)){const option=document.createElement('option');option.value=input.maxWalkMinutes;option.textContent=input.maxWalkMinutes+'분 이내';$('#walking').append(option);}
 $('#walking').value=input.maxWalkMinutes;
 $('#stop-count').value=input.stopCount;
 for(const [id,value,label] of [['max-leg-walk',input.maxLegWalkMinutes??'','분 이내'],['rest-every',input.restEveryMinutes??'','분마다'],['rest-duration',input.restDurationMinutes??10,'분']]){const select=$('#'+id);if(![...select.options].some(o=>String(o.value)===String(value))){const option=document.createElement('option');option.value=value;option.textContent=value+label;select.append(option);}select.value=value;}
 for(const select of $$('[data-taste]'))select.value=typeof input.preferences[select.dataset.taste]==='boolean'?String(input.preferences[select.dataset.taste]):'';
 for(const checkbox of $$('[name=preference]'))checkbox.checked=input.preferences[checkbox.value]===true;
 for(const checkbox of $$('[name=avoid]'))checkbox.checked=input.preferences[checkbox.value]===false;
 $('#require-food').checked=input.requiredCategories.includes('food');$('#require-indoor').checked=input.requiredFeatures.indoor===true;$('#require-vegetarian').checked=input.requiredFeatures.vegetarian===true;$('#require-stepfree').checked=input.requiredFeatures.stepFree===true;
 writeScheduleInput(input);writeCompanions(input.companions??[]);
}
function settings(query=memory.query){
 return {now:new Date().toISOString(),feedback:memory.confirmedPreferences,routeLeg,intents:intentSpecs(query)};
}
// 고른 것은 취향에서 알아보고, 엔진에는 진짜 궁·한옥 골목·시장 같은 장소 표시로 알린다(여행 조건에는 들어가지 않는다).
function intentSpecs(query){return dayIntents(query).map(id=>({id,...INTENTS[id].check}));}
// ── 첫 화면 고르기: 하고 싶은 것 → 몇 시간. 둘 다 건너뛰어도 하루가 나온다. ──
// 고르기는 아래 폼에 바로 적는다. 폼이 하나뿐인 원본이라 「이 시간으로 하루 만들기」와 폼 단추가 같은 조건을 쓴다.
function seoulClock(){return minutesOf(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()));}
function nextDate(date){const day=new Date(date+'T00:00:00Z');day.setUTCDate(day.getUTCDate()+1);return day.toISOString().slice(0,10);}
// 폼에서 날짜·출발 시각을 직접 정했으면 그날 그 시각부터(오늘이면 지금 이후로). 아니면 오늘 남은 시간에 들어갈 때
// 10분 뒤 출발, 안 되면 내일 10시. 긴 일정은 저녁 8시, 짧은 일정은 9시까지 끝낸다.
// 고르기가 폼에 써 넣은 날짜·시각은 직접 정한 것으로 보지 않고 매번 다시 계산한다.
function chooserWindow(hours){
 const today=koreanDate(new Date().toISOString()),tomorrow=nextDate(today),span=hours*60,latest=hours>=5?1200:1260;
 const soon=Math.ceil((seoulClock()+10)/10)*10,soonest=Math.max(600,soon);
 if(handWhen&&handWhen.date>=today){
  const asked=/^\d\d:\d\d$/.test(handWhen.start)?minutesOf(handWhen.start):600,first=handWhen.date===today?Math.max(540,soon):540,start=Math.max(first,Math.min(asked,latest-span));
  // 직접 정한 시각을 옮겼으면 까닭(이미 지남·너무 이른 시각·늦게 끝남)을 같이 돌려준다.
  const shift=asked===start?null:asked>start?'late':handWhen.date===today&&asked<soon?'past':'early';
  if(start+span<=latest)return {date:handWhen.date,start,end:start+span,when:handWhen.date===today?'오늘':handWhen.date===tomorrow?'내일':seoulDay(handWhen.date),today:handWhen.date===today,asked,shift};
 }
 return soonest+span<=latest?{date:today,start:soonest,end:soonest+span,when:'오늘',today:true}:{date:tomorrow,start:600,end:600+span,when:'내일',moved:true};
}
const lunchIncluded=(span,hours)=>hours>=5&&span.start<=720&&span.end>=810;
const servesPick=(place,id)=>{const rule=INTENTS[id].check;return (!rule.category||place.category===rule.category)&&(!rule.feature||place.features?.[rule.feature]===true);};
// 고른 것마다 출발점에서 갈 수 있는 곳의 걷는 상단·걷고 머무는 시간. 엔진이 일정을 짜기 전에 시간 화면에서 미리 알려 준다.
// 그 시간에 고르기가 잡을 날짜·시각에 문을 연 곳만 센다(쉬는 날인 궁·미술관은 빼고, 안내가 없는 곳은 엔진처럼 후보로 둔다).
const pickCache=new Map();
function pickOptions(id,hours){
 const origin=origins.find(row=>row.id===$('#origin').value)??origins[0],span=chooserWindow(hours),key=[id,origin.lat,origin.lon,Boolean(routeLeg),span.date,span.start,span.end].join('|');
 if(!pickCache.has(key)){
  const at=new Date().toISOString();
  const opens=(place,walk)=>{for(let arrive=span.start+walk;arrive+place.planningStayMinutes<=span.end;arrive+=30)if(evaluateRealStay(place,{date:span.date,time:clockText(arrive),stayMinutes:place.planningStayMinutes},{now:at,calendar:REAL_CONDITION_CALENDAR}).status!=='unmatched')return true;return false;};
  pickCache.set(key,TRAVEL_PLACES.filter(place=>place.dayPlannerEligible!==false&&place.coordinates&&servesPick(place,id)).map(place=>{const leg=estimateWalkingLeg(origin,place,{routeLeg});return {place,walk:leg.maxMinutes,total:leg.maxMinutes+place.planningStayMinutes};}).filter(row=>opens(row.place,row.walk)));
 }
 return pickCache.get(key);
}
const pickFits=(id,hours)=>pickOptions(id,hours).some(row=>row.total<=hours*60&&row.walk<=HOURS[hours].walk);
// 한 곳을 더 붙일 여유(가장 짧은 다른 곳 ≈ 40분)가 있는지
const pickPairs=(id,hours)=>pickOptions(id,hours).some(row=>row.total+40<=hours*60&&row.walk<=HOURS[hours].walk);
const pickMinutes=(id,hours)=>Math.min(...pickOptions(id,hours).filter(row=>row.walk<=HOURS[hours].walk).map(row=>row.total));
// 고른 두 가지를 그 시간에 한 일정으로 이을 수 있는지: 모든 후보 짝을 두 순서로, 엔진과 같은 걷기 추정(상단)·머무는 시간·
// 운영 시각으로 본다. 여는 시각까지는 15분씩 1시간까지 기다려 본다. 길 찾기는 직선거리 하한으로 거른 짝에만 돌린다.
const legCache=new Map();
const legBetween=(a,b)=>{const key=[a.id,b.id,Boolean(routeLeg)].join('|');if(!legCache.has(key))legCache.set(key,estimateWalkingLeg(a,b,{routeLeg}).maxMinutes);return legCache.get(key);};
// 길 찾기(경로 거리÷50+3분)와 직선 추정 어느 쪽보다도 길지 않은 하한
const legFloor=(a,b)=>{const plain=estimateWalkingLeg(a,b);return Math.min(Math.max(2,Math.ceil(plain.distanceMeters/50+3)),plain.maxMinutes);};
function pairFits(a,b,hours){
 const span=chooserWindow(hours),at=new Date().toISOString(),rows=id=>pickOptions(id,hours).filter(row=>row.walk<=HOURS[hours].walk);
 const opens=(place,arrive)=>evaluateRealStay(place,{date:span.date,time:clockText(arrive),stayMinutes:place.planningStayMinutes},{now:at,calendar:REAL_CONDITION_CALENDAR}).status!=='unmatched';
 const enter=(place,from)=>{for(let arrive=from;arrive<=from+60&&arrive+place.planningStayMinutes<=span.end;arrive+=15)if(opens(place,arrive))return arrive;return null;};
 for(const x of rows(a))for(const y of rows(b))for(const [first,second] of [[x,y],[y,x]]){
  if(first.place.id===second.place.id)continue;
  const stay=second.place.planningStayMinutes,earliest=span.start+first.walk+first.place.planningStayMinutes;
  if(earliest+legFloor(first.place,second.place)+stay>span.end)continue;
  const arrive=enter(first.place,span.start+first.walk);if(arrive===null)continue;
  const next=enter(second.place,arrive+first.place.planningStayMinutes+legBetween(first.place,second.place));
  if(next!==null)return true;
 }
 return false;
}
// 이 시간에 넣을 고른 것과 들어갈 곳 수. 2시간에 다른 곳과 짝을 못 짓는 긴 곳(전시·궁궐 등)을 고르면 그 한 곳으로 잡고,
// 같이 고른 다른 것은 이번에 빼며 몇 시간부터 같이 들어가는지 알린다. 곳 수는 고른 곳의 걷고 머무는 시간으로 어림한다.
function chooserPlan(fits){
 const hours=HOURS[pickHours],long=hours.stops===2?fits.find(id=>!pickPairs(id,pickHours)):undefined;
 if(long){
  const left=fits.filter(id=>id!==long),both=[long,...left];
  return {long,left,count:1,used:picks.filter(id=>!left.includes(id)),together:[3,5,8].find(h=>both.every(id=>pickFits(id,h))&&both.reduce((sum,id)=>sum+pickMinutes(id,h),0)<=h*60)};
 }
 // 고른 곳들의 걷고 머무는 시간에 짧은 곳(≈40분)을 더해 몇 곳쯤 들어갈지 어림한다.
 const estimate=list=>{const need=list.slice(0,hours.stops).map(id=>pickMinutes(id,pickHours));let count=need.length,used=need.reduce((sum,value)=>sum+value,0);
  while(count<hours.stops&&(!need.length||used+40<=pickHours*60)){count++;used+=40;}return count;};
 let count=estimate(fits);
 // 따로는 들어가도 한 일정으로 잇지 못하는 두 가지(예: 늦은 오후의 궁궐과 찻집)는 미리 알리고, 긴 쪽 없이 곳 수를 다시 어림한다.
 const shown=fits.slice(0,Math.min(hours.stops,count));let apart=null;
 for(let i=0;i<shown.length&&!apart;i++)for(let j=i+1;j<shown.length&&!apart;j++)if(!pairFits(shown[i],shown[j],pickHours))apart=[shown[i],shown[j]];
 if(apart){const longer=pickMinutes(apart[0],pickHours)>=pickMinutes(apart[1],pickHours)?apart[0]:apart[1];count=estimate(fits.filter(id=>id!==longer));}
 return {long,left:[],count:Math.max(1,count),used:picks,apart};
}
// 받침이 있으면 '은', 없으면 '는'
function withEun(word){const code=word.charCodeAt(word.length-1)-0xAC00;return word+(code>=0&&code<11172&&code%28?'은':'는');}
// 받침에 따라 조사를 붙인다.
function josa(word,yes,no){const code=word.charCodeAt(word.length-1)-0xAC00;return word+(code>=0&&code<11172&&code%28?yes:no);}
let hoursChosen=false;
// 고른 것 아래 안내. 시간을 고른 뒤라면 그 시간에 실제로 넣는 것만 말한다.
function pickNote(){
 if(!picks.length)return '고르지 않으면 가까운 곳을 고루 섞어요.';
 const names=list=>list.map(id=>INTENTS[id].short).join(' · ');
 if(hoursChosen){
  const fits=picks.filter(id=>pickFits(id,pickHours)),plan=chooserPlan(fits),kept=fits.filter(id=>!plan.left.includes(id));
  if(kept.length<picks.length)return kept.length?`${names(picks)} — 고른 ${HOURS[pickHours].label}에는 ${names(kept)}만 넣어요.`:`${names(picks)} — 고른 ${HOURS[pickHours].label}에는 넣기 어려워요. 시간을 늘려 보세요.`;
 }
 return `${names(picks)} — 하나씩은 꼭 넣을게요.`;
}
function syncPicks(note){
 for(const button of $$('[data-intent]'))button.setAttribute('aria-pressed',String(picks.includes(button.dataset.intent)));
 $('#pick-note').textContent=note||pickNote();
}
// 고른 것은 바로 아래 폼의 취향에도 적는다(폼이 하나뿐인 원본). 폼에서 직접 켠 취향은 고르기가 끄지 않는다.
function writePicks(){
 const owned=new Set(picks.flatMap(id=>Object.keys(INTENTS[id].prefs))),current=readPreferences();
 for(const key of MANAGED){
  const box=$(`[name=preference][value="${key}"]`),avoid=$(`[name=avoid][value="${key}"]`),taste=$(`[data-taste="${key}"]`);
  if(owned.has(key)){formPreferences[key]=true;if(box)box.checked=true;if(avoid)avoid.checked=false;if(taste)taste.value='true';}
  else if(current[key]===true&&!handPrefs.has(key)){delete formPreferences[key];if(box)box.checked=false;if(taste)taste.value='';}
 }
}
// 고른 것을 빼면 그 취향은 폼에서 직접 켰더라도 같이 끈다. 마지막으로 누른 쪽을 따른다.
// 세 개까지 — 넘치면(폼에서 넷 이상 켠 뒤에도) 먼저 고른 것부터 뺀다.
function togglePick(id){
 const dropped=picks.includes(id)?[id]:picks.slice(0,Math.max(0,picks.length-2));
 for(const drop of dropped)for(const key of Object.keys(INTENTS[drop].prefs))handPrefs.delete(key);
 picks=picks.includes(id)?picks.filter(x=>x!==id):[...picks.slice(dropped.length),id];
 writePicks();syncPicks(dropped.length&&dropped[0]!==id?`세 개까지 고를 수 있어요. ${josa(dropped.map(x=>INTENTS[x].short).join('·'),'을','를')} 뺐어요.`:'');
}
// 폼에서 고친 취향이 고른 것과 같아지면 고르기에도 그대로 보인다.
function picksFromForm(control){
 const key=control.dataset.taste??control.value;if(!MANAGED.has(key))return;
 const prefs=readPreferences(),derived=Object.keys(INTENTS).filter(id=>Object.entries(INTENTS[id].prefs).every(([name,value])=>prefs[name]===value));
 if(prefs[key]===true)handPrefs.add(key);else handPrefs.delete(key);
 picks=[...picks.filter(id=>derived.includes(id)),...derived.filter(id=>!picks.includes(id))];syncPicks();
}
// 저장된 조건이나 되돌린 조건에서 고른 것을 다시 읽는다. 고른 것에 속하지 않는 켠 취향은 직접 켠 것으로 둔다.
function picksFromQuery(query){
 picks=dayIntents(query);handPrefs.clear();
 const owned=new Set(picks.flatMap(id=>Object.keys(INTENTS[id].prefs)));
 for(const [key,value] of Object.entries(query.preferences??{}))if(MANAGED.has(key)&&value===true&&!owned.has(key))handPrefs.add(key);
 syncPicks();
}
function pushView(view){if(history.state?.pathView!==view)history.pushState({pathView:view},'');}
function showStep(step,{push=true}={}){
 $('#step-intent').hidden=step!==1;$('#step-time').hidden=step!==2;
 if(step===2){hoursChosen=true;applyChooser();renderTimeStep();}else syncPicks();
 if(push)pushView(step===2?'time':'intent');
 (step===2?$('#time-title'):$('#chooser-title')).focus({preventScroll:true});
 $('#before-result').scrollIntoView({behavior:reducedMotion()?'instant':'smooth',block:'start'});
}
// 지금 일정은 새 하루를 받아들일 때까지 그대로 둔다. 고르기 화면에서 언제든 돌아갈 수 있다.
function showChooser(step=1,{push=true}={}){
 document.body.classList.remove('has-plan');$('#result').hidden=true;$('#empty-result').hidden=true;$('#before-result').hidden=false;
 $('#chooser-back').hidden=!memory.plan;showStep(step,{push});
}
// 시간 고리 하나만 Loom 스프링으로 움직인다.
function animateDial(target){
 const ring=$('#ring-fill'),draw=value=>ring.setAttribute('stroke-dasharray',`${Math.max(0,Math.min(100,value/8*100)).toFixed(2)} 100`);
 cancelAnimationFrame(dialFrame);
 if(reducedMotion()){dial.value=target;dial.velocity=0;draw(target);return;}
 let last=null;
 const frame=time=>{if(last===null)last=time;Loom.advanceSpring(dial,target,.3,Math.min((time-last)/1000,.04));last=time;draw(dial.value);
  if(Math.abs(dial.value-target)>.005||Math.abs(dial.velocity)>.02)dialFrame=requestAnimationFrame(frame);else{dial.value=target;dial.velocity=0;draw(target);}};
 dialFrame=requestAnimationFrame(frame);
}
function renderTimeStep(){
 const span=chooserWindow(pickHours),hours=HOURS[pickHours],origin=origins.find(row=>row.id===$('#origin').value)??origins[0];
 const fits=picks.filter(id=>pickFits(id,pickHours)),misses=picks.filter(id=>!fits.includes(id)),plan=chooserPlan(fits);
 $('#chooser-card').dataset.sky=String(pickHours);
 $('#time-context').textContent=`${span.today?'지금 '+clockText(seoulClock())+' · ':''}${origin.name}에서 출발해요`;
 $('#dial-hours').textContent=hours.label;
 $('#dial-range').textContent=`${span.when} ${clockText(span.start)}–${clockText(span.end)}`;
 for(const chip of $$('.time-chips [data-hours]'))chip.setAttribute('aria-pressed',String(Number(chip.dataset.hours)===pickHours));
 const fitted=plan.used.filter(id=>fits.includes(id)),shown=fitted.slice(0,plan.count),names=list=>list.map(id=>INTENTS[id].short).join('·');
 $('#fit-objs').innerHTML=Array.from({length:plan.count},(_,i)=>shown[i]?`<img src="${feltSrc('intent-'+shown[i])}" alt="">`:'<i></i>').join('');
 // 이 시간에 못 들어가는 것은 몇 시간부터 넉넉한지, 고르기가 폼에서 무엇을 맞췄는지 미리 알린다.
 // 식사 안내는 폼에 실제로 적힌 「식사를 꼭 포함」을 그대로 읽는다.
 // 시간을 늘리면 창이 다른 날(오늘 → 내일)로 넘어가면 그 날을 같이 말한다.
 const later=misses.map(id=>{
  const short=INTENTS[id].short,sameDay=[1,2,3,5,8].find(h=>chooserWindow(h).date===span.date&&pickFits(id,h)),anyDay=sameDay??[1,2,3,5,8].find(h=>pickFits(id,h));
  if(!anyDay)return `${short} 갈 곳을 지금 출발점에서 찾지 못했어요`;
  if(sameDay)return `${withEun(short)} ${HOURS[sameDay].label}부터 넉넉해요`;
  return `${withEun(short)} ${span.when==='오늘'?'오늘은 어렵고 ':''}${chooserWindow(anyDay).when} ${josa(HOURS[anyDay].label,'이면','면')} 넉넉해요`;
 });
 const notes=chooserIssue?[`아래 조건에서 먼저 고칠 곳이 있어요 · ${chooserIssue.message}`]:[...later,
  plan.long?`${withEun(INTENTS[plan.long].short)} 한 곳으로 시간이 꽉 차요`:'',
  plan.left.length?`${withEun(names(plan.left))} ${plan.together?HOURS[plan.together].label+'부터 같이 들어가요':'이번에는 빼요'}`:'',
  plan.apart?`${withEun(names(plan.apart))} 이 시간에 한 일정으로 잇기 어려워 들어가는 쪽을 넣어요`:'',
  $('#require-food').checked?'식사 한 끼 포함':'',
  span.moved?'오늘은 남은 시간이 짧아 내일로 잡았어요':'',
  span.shift?`직접 정한 ${clockText(span.asked)} 출발${{past:'은 이미 지나',early:'은 너무 일러',late:`로는 ${josa(hours.label,'이','가')} 늦게 끝나`}[span.shift]} ${clockText(span.start)}부터 잡았어요`:'',
  ...chooserChanges.appointments.map(row=>`${row.time} ${placeMap.get(row.placeId)?.name??''} 약속은 이 시간 밖이라 빼요`),
  chooserChanges.meal?`정한 식사 시간대(${chooserChanges.meal.startTime}–${chooserChanges.meal.endTime})는 이 시간 밖이라 빼요`:'',
  fitted.length>plan.count?'고른 게 많아 들어가는 만큼 넣어요':shown.length<plan.count&&plan.count>1?(shown.length?`나머지 ${plan.count-shown.length}곳은 가까운 곳으로 골라요`:'가까운 곳을 고루 섞어요'):''].filter(Boolean);
 $('#fit-text').innerHTML=`<b>${plan.count===1?(plan.long?'한 곳에 넉넉히 머물러요':'가까운 1곳이 딱 맞아요'):plan.count+'곳쯤 들어가요'}</b>${e(notes.join(' · ')||'남는 시간은 머무는 시간으로 넉넉히 채워요')}`;
 animateDial(pickHours);
}
// 고른 것이 아닌 폼의 선택(피하기·세부 맛·필수 조건·동행·인원·예산·출발점·직접 정한 날짜와 시각)은 그대로 두고,
// 고른 것·시간만 덮어 이번 여행 조건을 만든다. 폼 값을 먼저 검사하지 않고 덮은 뒤 한 번만 검사한다.
function chooserQuery(){
 // 여행 중 기록은 그날의 남은 일정에 묶여 있다. 새 날짜의 하루는 「새 여행 만들기」 뒤에 고른다.
 if(memory.progress)throw new TypeError('여행 중에는 「여행 중이라면」에서 남은 일정을 맞춰 주세요. 새 하루는 내 여행의 「새 여행 만들기」로 시작해요.');
 const span=chooserWindow(pickHours),hours=HOURS[pickHours],fits=picks.filter(id=>pickFits(id,pickHours)),plan=chooserPlan(fits);
 chooserChanges={appointments:[],kept:[],meal:null};
 return readInput(raw=>{
  Object.assign(raw,{planningMode:'day',date:span.date,startTime:clockText(span.start),endTime:clockText(span.end),stopCount:plan.long?1:hours.stops,maxWalkMinutes:hours.walk,lockedIds:[],excludedIds:[]});
  // 이번에 넣을 고른 것의 취향만 켜고, 고르기가 켰던 나머지는 끈다. 폼에서 직접 켠 것과 피하기는 그대로 둔다.
  const owned=new Set(plan.used.flatMap(id=>Object.keys(INTENTS[id].prefs)));
  for(const key of MANAGED)if(owned.has(key))raw.preferences[key]=true;else if(raw.preferences[key]===true&&!handPrefs.has(key))delete raw.preferences[key];
  if(raw.meal.mode==='none'&&plan.used.includes('food'))raw.meal={mode:'any',startTime:'12:00',endTime:'13:00'};
  if(raw.meal.mode==='window'&&(raw.meal.endTime<raw.startTime||raw.meal.startTime>=raw.endTime)){chooserChanges.meal={...raw.meal};raw.meal={mode:'any',startTime:'12:00',endTime:'13:00'};}
  // 식사 필수는 직접 고친 폼 값을 따르고, 아니면 이 시간에 들어가는 맛집을 골랐거나 반나절 이상이 점심을 걸칠 때만 넣는다.
  const meal=foodByHand?raw.requiredCategories.includes('food'):raw.meal.mode!=='none'&&(plan.used.includes('food')&&fits.includes('food')||lunchIncluded(span,pickHours));
  raw.requiredCategories=[...raw.requiredCategories.filter(key=>key!=='food'),...(meal?['food']:[])];
  // 이 시간 밖의 예약·약속은 빼고 시간 화면에 알린다.
  const inside=row=>row.time>=raw.startTime&&row.time<raw.endTime;
  chooserChanges.kept=raw.appointments;chooserChanges.appointments=raw.appointments.filter(row=>!inside(row));raw.appointments=raw.appointments.filter(inside);
 });
}
// 폼이 잘못된 상태면 폼은 그대로 두고 그 까닭을 시간 화면에 보인다. 만들 때는 폼을 열어 그 칸을 알려 준다.
// 이 시간 밖이라 뺀 예약·식사 시간대는 폼에서 지우지 않아, 시간을 바꾸면 다시 들어간다.
function applyChooser(){
 try{
  const query=chooserQuery();writeInput(query);
  if(chooserChanges.appointments.length||chooserChanges.meal)writeScheduleInput({...query,appointments:chooserChanges.kept,meal:chooserChanges.meal??query.meal});
  chooserIssue=null;return true;
 }catch(error){chooserIssue=error;return false;}
}
// 지도 자료가 오기 전에 만들면 모든 구간이 직선 추정이 된다. 잠깐(최대 8초) 기다린다.
async function waitForMap(button){if(network)return;button.textContent='지도 자료를 불러오는 중…';await Promise.race([mapReady,new Promise(resolve=>setTimeout(resolve,8000))]);}
async function makeDay(){
 const button=$('#make-day');button.disabled=true;
 try{await waitForMap(button);button.textContent='하루를 맞추는 중…';await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const input=chooserQuery();writeInput(input);planThenAsk(input);}
 catch(error){if(formField(error.field))showFormError(error);else toast(error.message);}
 finally{button.disabled=false;button.innerHTML='이 시간으로 하루 만들기 <span aria-hidden="true">↗</span>';}
}
function scheduleNote(input){
 const rows=[];
 if(input.meal?.mode==='none')rows.push('식당 방문 생략');
 if(input.meal?.mode==='window')rows.push(`식사 시작 ${input.meal.startTime}–${input.meal.endTime}`);
 for(const row of input.appointments??[])rows.push(`${row.time} ${placeMap.get(row.placeId)?.name??row.placeId} 약속`);
 if(input.destination)rows.push(`${input.endTime}까지 ${input.destination.name} 도착`);
 return rows.length?`<p class="schedule-note"><strong>지킬 시간과 도착점</strong> · ${rows.map(e).join(' · ')}</p>`:'';
}
function progressMealFields(){
 const meal=memory.query.meal??{mode:'any',startTime:'12:00',endTime:'13:00'};
 return `<div class="field"><label for="progress-meal-mode">남은 일정의 식사</label><select id="progress-meal-mode"><option value="any" ${meal.mode==='any'?'selected':''}>취향에 맞춰 고르기</option><option value="window" ${meal.mode==='window'?'selected':''}>정한 시간대에 식사 시작</option><option value="none" ${meal.mode==='none'?'selected':''}>이미 먹었거나 식사 생략</option></select></div><div class="field-row meal-window" id="progress-meal-window"><div class="field"><label for="progress-meal-start">식사 시작 가능 시각</label><input id="progress-meal-start" type="time" value="${e(meal.startTime)}"></div><div class="field"><label for="progress-meal-end">늦어도 식사 시작</label><input id="progress-meal-end" type="time" value="${e(meal.endTime)}"></div></div><p class="micro">식사 완료만으로 다음 식사를 자동 생략하지 않아요. 시각을 고정한 장소를 완료·건너뜀으로 적용하면 그 약속은 남은 조건에서 빠집니다. 정정 후 약속 시각도 필요하면 여행 조건에서 다시 입력해 주세요.</p>`;
}
function beginExposure(){
 exposureObserver?.disconnect();
 const decision=memory.journal.decisions.findLast(row=>row.selectedId===memory.plan?.id);activeDecision=decision?.id??null;
 if(!activeDecision)return;
 exposureObserver=new IntersectionObserver(entries=>{if(!entries.some(entry=>entry.isIntersecting)||document.visibilityState!=='visible')return;
  try{memory=recordPlanExposure(memory,{decisionId:activeDecision,now:now()});persist();}catch(error){toast(error.message);}exposureObserver.disconnect();
 },{threshold:0.1});exposureObserver.observe($('#plan-overview'));
}
function acceptResult(result,{scroll=true,record=true}={}){
 clearRecovery();
 pending=null;restored=false;mapZoom=1;
 if(result.primary){
  if(result.progress)memory.progress=structuredClone(result.progress);
  else if(memory.progress)memory.progress.requiredCategories=[...new Set([...memory.progress.requiredCategories.filter(key=>!memory.query.requiredCategories.includes(key)||result.input.requiredCategories.includes(key)),...result.input.requiredCategories])];
  memory.query=result.input;memory.plan=result.primary;memory.updatedAt=now();writeInput(result.input);
  outcome=result;
  if(record)memory=recordPlanDecision(memory,{planId:result.primary.id,candidateIds:[result.primary,...result.alternatives].map(p=>p.id),now:now()});
  renderResult();persist();beginExposure();pushView('result');
  if(scroll){$('#result-title').focus({preventScroll:true});$('#result').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
  formDirty=false;
 }else{renderUnavailable(result);}
}
const FORM_FIELDS={date:'#trip-date',startTime:'#start-time',endTime:'#end-time',budget:'#budget',party:'#adults',maxWalkMinutes:'#walking',maxLegWalkMinutes:'#max-leg-walk',restEveryMinutes:'#rest-every',restDurationMinutes:'#rest-duration',meal:'#meal-mode',appointments:'#appointment-place-0',destination:'#destination',companions:'#companions-count'};
const formField=field=>Object.hasOwn(FORM_FIELDS,field??'')?FORM_FIELDS[field]:null;
// 폼의 어느 칸이 문제인지 폼을 열어 그 칸으로 보낸다.
function showFormError(error){
 notice(error.message);$('#conditions-panel').open=true;
 if(/^(meal|appointments|destination)/.test(error.field??'')){$('#more-conditions').open=true;$('#schedule-details').open=true;}
 if(error.field==='companions'){$('#more-conditions').open=true;$('#companions-details').open=true;}
 $(formField(error.field)||'#trip-date').focus();
}
async function generate(event){
 event?.preventDefault();$('#form-error').hidden=true;const button=$('#generate');button.disabled=true;button.textContent='당신의 하루를 맞추는 중…';
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 try{await waitForMap(button);button.textContent='당신의 하루를 맞추는 중…';
  // 첫 화면에서 고른 것은 이미 폼에 적혀 있어 폼 그대로 쓴다.
  const input=readInput();
  planThenAsk(input);}
 catch(error){showFormError(error);}
 finally{button.disabled=false;button.innerHTML='내 조건으로 하루 만들기 <span aria-hidden="true">↗</span>';}
}
function renderUnavailable(result){
 $('#empty-result').hidden=false;$('#before-result').hidden=true;$('#result').hidden=true;
 const rows=[...result.unknowns,...result.blocked],unique=[...new Set(rows.map(row=>row.reason))].slice(0,5);
 $('#empty-result').innerHTML=`<p class="eyebrow">하나만 바꿔 볼게요</p><h3 id="empty-title" tabindex="-1">이 조건을 모두 지키는<br>여행안을 아직 찾지 못했어요.</h3><ul>${unique.map(reason=>`<li>${e(reason)}</li>`).join('')}</ul><p>필수 조건은 임의로 풀지 않았어요. 확인이 필요한 조건을 다시 보거나, 시간·예산·걷기 범위를 직접 바꿔 보세요.</p>${memory.progress?'':'<button class="button secondary" type="button" data-action="back-to-chooser">하고 싶은 것·시간 다시 고르기</button>'}${memory.plan?'<button class="button secondary" data-action="previous-plan">이전 여행안으로 돌아가기</button>':''}`;
 $('#empty-result').insertAdjacentHTML('beforeend',renderRecovery(result));
 $('#empty-title').focus({preventScroll:true});$('#empty-result').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderRecovery(result,progress=null){
 const recovery=suggestTravelRecovery(result.input,settings(result.input));
 recoveryChoices=recovery.suggestions.map(choice=>({...choice,progress:progress?structuredClone(progress):null}));
 if(!recoveryChoices.length)return '<p class="micro">작은 시간·걷기·예산 조정으로 가능한 안도 아직 없어요. 필수 조건의 자료를 확인하거나 다른 출발점·날짜로 직접 바꿔주세요.</p>';
 const labels={endTime:'마칠 시각',maxWalkMinutes:'걷기 상한',budget:'일행 예산',lockedIds:'유지할 장소'};
 const value=(field,v)=>field==='budget'?money(v):field==='maxWalkMinutes'?v+'분':field==='lockedIds'?(v.map(id=>placeMap.get(id)?.name??id).join(', ')||'없음'):v;
 return `<div class="recovery-options"><h4>이 정도 바꾸면 가능한 안이 있어요.</h4><p class="micro">직접 적용할 안을 골라주세요. 필수 조건·취향·제외 장소는 계속 지킵니다. 이동과 체류는 예상이며 미확인 비용은 별도예요.</p>${recoveryChoices.map((choice,i)=>{const p=choice.result.primary;return `<article class="recovery-card"><h5>${e(choice.label)}</h5><ul>${choice.changes.map(c=>`<li>${e(labels[c.field])} · ${e(value(c.field,c.from))} → <strong>${e(value(c.field,c.to))}</strong></li>`).join('')}</ul><p>${p.stops.map(s=>e(placeMap.get(s.placeId).name)).join(' → ')}</p><p>도보 ${p.walking.minMinutes}–${p.walking.maxMinutes}분 · ${p.cost.unknownPlaceIds.length?'확인된 부분합':'표시 비용'} ${money(p.cost.knownAmount)}${p.cost.unknownPlaceIds.length?' + 미확인 '+p.cost.unknownPlaceIds.length+'곳':''} · 종료 ${e(p.endTime)}</p>${p.status==='partial'?'<p class="micro">운영·가격·접근 정보의 확인이 남은 초안이에요.</p>':''}${scheduleNote(choice.result.input)}${companionSummary(p,choice.result.input)}<button class="button secondary" type="button" data-recovery="${i}">이 조건과 일정 적용하기</button></article>`;}).join('')}</div>`;
}
function applyRecovery(index){
 const choice=recoveryChoices[Number(index)];if(!choice){toast('조건이 바뀌었어요. 다시 계산해 주세요.');return;}
 const result={...choice.result,...(choice.progress?{progress:choice.progress}:{})};
 if(choice.progress)validateTravelMemory({...memory,query:result.input,plan:result.primary,progress:choice.progress,updatedAt:now()},{now:now()});
 recoveryChoices=[];if(choice.progress)$('#progress-dialog').close();
 acceptResult(result);toast('선택한 조건 변경과 일정을 적용했어요.');
}
function clearRecovery(){
 recoveryChoices=[];for(const panel of $$('.recovery-options'))panel.hidden=true;
}
// 결과 위 막대: 적용한 조건만 짧게. 고치려면 막대를 열어 같은 폼을 쓴다.
function renderConditionChips(){
 const q=memory.query;if(!q){$('#condition-chips').innerHTML='';return;}
 const chips=[seoulDay(q.date),q.startTime+'–'+q.endTime,q.origin.name+' 출발','성인 '+q.party.adults+(q.party.children?' · 아이 '+q.party.children:''),budgetLabel(q.budget),'걷기 '+q.maxWalkMinutes+'분 이내','최대 '+q.stopCount+'곳'];
 $('#condition-chips').innerHTML=chips.map(text=>`<span class="cond-chip">${e(text)}</span>`).join('');
}
function dayIntents(q){return Object.keys(INTENTS).filter(id=>Object.entries(INTENTS[id].prefs).every(([key,value])=>q.preferences?.[key]===value));}
function durationText(value){const h=Math.floor(value/60),m=value%60;return value<=0?'':h?`${h}시간${m?' '+m+'분':''}`:`${m}분`;}
// 받침이 없거나 ㄹ이면 '로', 아니면 '으로'
function withRo(word){const code=word.charCodeAt(word.length-1)-0xAC00,last=code>=0&&code<11172?code%28:0;return word+(last===0||last===8?'로':'으로');}
function dayTitle(q,plan){
 if(q.planningMode==='remaining')return '지금부터, 남은 '+plan.stops.length+'곳';
 const span=minutesOf(q.endTime)-minutesOf(q.startTime),length=span===480?'하루':span===300?'반나절':durationText(span);
 // 고른 것 가운데 실제로 넣은 것만 제목에 쓴다.
 const places=plan.stops.map(stop=>placeMap.get(stop.placeId)),covered=dayIntents(q).filter(id=>places.some(place=>servesPick(place,id)));
 return covered.length?`${withRo(covered.map(id=>INTENTS[id].short).join(' · '))} 채운 ${length}`:`${plan.stops.length}곳에 담은 ${length}`;
}
// 지도 창을 열기 전 요약 카드에 보이는 작은 동선 그림. 길 자료가 없어도 장소 좌표만으로 그린다.
// 그리는 칸의 실제 크기로 그려 빈 띠 없이 채운다.
function routeThumb(plan,W=320,H=156){
 const q=memory.query,legs=[...plan.legs,...(plan.returnLeg?[plan.returnLeg]:[])];
 const points=[q.origin,...plan.stops.map(s=>placeMap.get(s.placeId).coordinates),...legs.flatMap(l=>l.coordinates.map(([lon,lat])=>({lon,lat})))];
 const minX=Math.min(...points.map(p=>p.lon)),maxX=Math.max(...points.map(p=>p.lon)),minY=Math.min(...points.map(p=>p.lat)),maxY=Math.max(...points.map(p=>p.lat));
 const k=Math.cos(37.57*Math.PI/180),rx=Math.max((maxX-minX)*k,.0004),ry=Math.max(maxY-minY,.0004),s=Math.min((W-48)/rx,(H-40)/ry);
 const ox=(W-rx*s)/2,oy=20+(H-40-ry*s)/2,xy=(lon,lat)=>[ox+(lon-minX)*k*s,oy+(maxY-lat)*s];
 const line=coords=>coords.map(([lon,lat],i)=>(i?'L':'M')+xy(lon,lat).map(n=>n.toFixed(1)).join(',')).join('');
 const [sx,sy]=xy(q.origin.lon,q.origin.lat);
 return `<svg viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#eef2ea"/>${legs.map(l=>`<path d="${line(l.coordinates)}" fill="none" stroke="#54734f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"${l.source==='osm-walking-network'?'':' stroke-dasharray="5 5"'}/>`).join('')}<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5" fill="#fff" stroke="#39523f" stroke-width="3"/>${plan.stops.map((stop,i)=>{const c=placeMap.get(stop.placeId).coordinates,[x,y]=xy(c.lon,c.lat);return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="#39523f" stroke="#fff" stroke-width="2.5"/><text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="InterTight,SUIT,sans-serif">${i+1}</text>`;}).join('')}</svg>`;
}
function openMap(){if(!memory.plan)return;mapZoom=1;$('#map-dialog').showModal();requestAnimationFrame(()=>renderMap());}
// 결과 화면의 주인공: 경로 띠·하루 막대·요약 카드·이야기 카드. 사진이 없는 곳은 그곳 메뉴를 구운 펠트 그림.
function renderJourney(plan){
 const q=memory.query,stops=plan.stops,today=defaultTravelQuery().date,free=Math.max(0,minutesOf(q.endTime)-minutesOf(plan.endTime));
 $('#result-title').textContent=dayTitle(q,plan);
 const end=(name,last)=>`<li class="route-end"><span class="route-dot${last?' is-end':''}" aria-hidden="true"></span><span>${e(name)}</span></li>`;
 const pin=(stop,i)=>{const place=placeMap.get(stop.placeId);return `<li><a class="route-pin tint-${e(place.category)}${place.photo?'':' is-felt'}" href="#stop-${e(place.id)}" aria-label="${i+1}번째 ${e(place.name)} 카드로">${place.photo?`<img src="${e(place.photo.src)}" alt="" loading="lazy" decoding="async">`:feltImage(place)}<b aria-hidden="true">${i+1}</b></a></li>`;};
 const parts=[];
 stops.forEach((stop,i)=>{if(plan.legs[i].maxMinutes)parts.push(['walk',plan.legs[i].maxMinutes]);if(stop.waitMinutes)parts.push(['wait',stop.waitMinutes]);parts.push(['stay',stop.stayMinutes]);});
 if(plan.returnLeg?.maxMinutes)parts.push(['walk',plan.returnLeg.maxMinutes]);
 if(free)parts.push(['free',free]);
 const total=kind=>parts.filter(([key])=>key===kind).reduce((sum,[,value])=>sum+value,0),names={stay:'머무름',walk:'걷기',wait:'기다림',free:'여유'};
 const key=Object.keys(names).filter(kind=>total(kind)).map(kind=>`${names[kind]} ${durationText(total(kind))}`);
 $('#journey-strip').innerHTML=`<ol class="route-strip" aria-label="${e(q.origin.name)}에서 ${stops.map(s=>e(placeMap.get(s.placeId).name)).join(', ')} 차례로">${end(q.origin.name)}${stops.map(pin).join('')}${plan.destination?end(plan.destination.name,true):''}</ol><div class="daybar" role="img" aria-label="${e(q.startTime)}부터 ${e(q.endTime)}까지 · ${e(key.join(', '))}">${parts.map(([kind,value])=>`<i class="${kind}" data-w="${value}"></i>`).join('')}</div><p class="daybar-key" aria-hidden="true">${Object.keys(names).filter(kind=>total(kind)).map(kind=>`<span class="k-${kind}">${names[kind]} ${durationText(total(kind))}</span>`).join('')}</p>`;
 for(const part of $$('#journey-strip .daybar i'))part.style.flexGrow=part.dataset.w;
 const picked=dayIntents(q),unknownCost=plan.cost.unknownPlaceIds.length;
 const fit=picked.length?`<ul class="intent-fit">${picked.map(id=>{const names=stops.map(s=>placeMap.get(s.placeId)).filter(place=>servesPick(place,id)).map(place=>place.name);return `<li><img src="${feltSrc('intent-'+id)}" alt="" width="30" height="30"><b>${e(INTENTS[id].short)}</b><span>${names.length?e(names.join(', ')):'이번 시간에는 넣지 못했어요'}</span></li>`;}).join('')}</ul>`:`<p class="plan-note">고른 것이 없어서 가까운 곳을 고루 섞었어요.</p>`;
 $('#plan-overview').innerHTML=`<dl class="facts"><div><dt>${memory.progress?'남은 일정':'시간'}</dt><dd>${e(plan.startTime)}–${e(plan.endTime)}<small>${stops.length}곳 · ${q.party.adults}명${q.party.children?' + 아이 '+q.party.children+'명':''}</small></dd></div><div><dt>걷기</dt><dd>${plan.walking.minMinutes}–${plan.walking.maxMinutes}분<small>시설 안 걷기는 별도</small></dd></div><div><dt>${unknownCost?'비용':'표시 비용'}</dt><dd>${unknownCost?(plan.cost.knownAmount?money(plan.cost.knownAmount)+'부터':'확인 필요'):money(plan.cost.knownAmount)}<small>${unknownCost?(plan.cost.knownAmount?unknownCost+'곳은 금액 확인 필요':unknownCost+'곳 · 공식 안내에서 확인'):'교통·추가 주문 별도'}</small></dd></div><div><dt>여유</dt><dd>${free?durationText(free):'딱 맞음'}<small>${free?'끝나고 남는 시간':'고른 시간을 다 썼어요'}</small></dd></div></dl>${q.planningMode==='remaining'?'':fit}${plan.status==='partial'?`<p class="plan-note">확인할 항목이 남은 초안이에요. 운영·비용·접근은 카드마다 아래 안내에서 이유와 공식 링크를 볼 수 있어요.</p>`:''}${restored?'<p class="warning-note">'+(restored==='progress'?'마지막으로 적용한 남은 일정입니다. 진행 상황 수정에서 현재 시각·위치·예산을 확인해 다시 맞출 수 있어요.':restored==='snapshot'?'저장 당시의 일정과 예상 수치입니다. 현재 운영·가격을 확인한 새 추천이 아니에요. 방문 기록을 이어 쓰거나 날짜를 바꿔 새 여행을 만들 수 있어요.':'저장한 계획을 현재 장소 자료로 다시 계산했어요. 유지할 장소와 이전 방문 기록은 그대로 이어집니다.')+'</p>':''}`;
 const legRow=(leg,from,to)=>`<div class="leg"><img class="leg-shoes" src="${feltSrc('shoes')}" alt="" width="34" height="28"><span>${leg.maxMinutes?`${e(from.name)}에서 걸어서 ${leg.minMinutes}–${leg.maxMinutes}분`:`${e(from.name)} 바로 옆`}${leg.source!=='osm-walking-network'?' · 위치 기반 추정':''}</span><a href="${e(directionLink(from,to))}" target="_blank" rel="noopener noreferrer">길 확인 ↗</a></div>`;
 const skippable=q.date===today&&!memory.progress?.finished;
 $('#timeline').innerHTML=stops.map((stop,i)=>{
  const place=placeMap.get(stop.placeId),from=i?placeMap.get(stops[i-1].placeId):q.origin;
  const locked=q.lockedIds.includes(place.id),appointment=(q.appointments??[]).find(row=>row.placeId===place.id);
  const media=place.photo?photo(place,'story-photo',i?'lazy':'eager'):FELT[place.id]?feltImage(place,'story-felt'):placeTile(place);
  return `${legRow(plan.legs[i],from,place)}${stop.preStartPause?`<p class="rest-slot"><strong>${e(stop.preStartPause.startTime)}–${e(stop.preStartPause.endTime)} · 시작 전 ${stop.preStartPause.durationMinutes}분 쉬는 여유</strong><span>기다리는 시간에 포함했어요. 좌석·쉼터는 미확인이에요.</span></p>`:''}<article class="story tint-${e(place.category)} ${place.photo?'has-photo':'has-felt'}" id="stop-${e(place.id)}"><div class="story-media"><button class="story-media-button" data-place="${e(place.id)}" tabindex="-1" aria-label="${e(place.name)} 자세히">${media}</button><span class="story-time"><b>${e(stop.arrivalTime)}</b>–${e(stop.departureTime)}</span><div class="story-cap"><p class="story-kind">${e(categoryShort[place.category])} · ${durationText(stop.stayMinutes)} 머물기</p><h3><button class="stop-title" data-place="${e(place.id)}">${e(place.name)}</button></h3></div></div><div class="story-body">${appointment?`<p class="schedule-note">${e(appointment.time)} 예약·약속 시각 고정</p>`:''}<p class="stop-reason">${e(stop.reasons.slice(0,2).join(' · ')||place.description)}</p><p class="stop-cost">${stop.cost.status==='unknown'?(stop.cost.knownAmount?money(stop.cost.knownAmount)+' + 확인 필요':'금액 확인 필요'):money(stop.cost.knownAmount)}</p>${(stop.pauses??[]).map(p=>`<p class="rest-slot"><strong>${e(p.startTime)}–${e(p.endTime)} · ${p.durationMinutes}분 쉬는 여유</strong><span>이 장소에서 쉴 시간으로 잡았어요. 좌석·쉼터는 미확인이에요.</span></p>`).join('')}<div class="stop-actions"><button class="act ${locked?'locked':''}" data-lock="${e(place.id)}" aria-pressed="${locked}" aria-label="${e(place.name)} 유지">${locked?'유지 중 ✓':'이곳은 유지'}</button><button class="act" data-swap="${e(place.id)}" aria-label="${e(place.name)} 대신 다른 곳으로 바꾸기">다른 곳으로 바꾸기</button>${skippable?`<button class="act act-quiet" data-skip-stop="${e(place.id)}" aria-label="${e(place.name)} 건너뛰기">건너뛰기</button>`:''}<button class="act act-quiet" data-place="${e(place.id)}" aria-label="${e(place.name)} 자세히">자세히</button></div><details class="stop-details"><summary>${stop.schedule.status==='unknown'?'운영 확인 필요':'운영 안내와 비용 근거'}</summary><p>${e(stop.schedule.reason)}</p>${plan.checks.filter(c=>c.kind==='route'&&c.placeId===place.id).map(c=>`<p class="warning-note">${e(c.reason)}</p>`).join('')}<p>${e(stop.cost.unknowns.join(' ')||place.costNote)}</p>${stop.waitMinutes?`<p>예정 시작까지 ${stop.waitMinutes}분 기다리는 시간이에요.</p>`:''}<p>머무는 ${stop.stayMinutes}분은 계획용 제안이에요. ${e(place.openingNote||'')}</p><a href="${e(safeUrl(place.visitSourceUrl||place.sourceUrl))}" target="_blank" rel="noopener noreferrer">공식 안내 확인 ↗</a>${place.photo?`<p class="photo-credit">${credit(place)}</p>`:''}</details></div></article>`;
 }).join('')+(free>=10&&!plan.destination?`<div class="free-row"><img src="${feltSrc('bench')}" alt="" width="76" height="62"><div><strong>여유 ${durationText(free)}</strong><span>${e(plan.endTime)}에 일정이 끝나요. 근처에서 쉬거나 마음에 든 곳에 더 머물러도 돼요.</span></div></div>`:'');
 const fresh=animatedPlan!==plan.id;animatedPlan=plan.id;
 [...$('#timeline').querySelectorAll('.story')].forEach((card,i)=>{if(fresh)card.style.animationDelay=Math.min(i,5)*80+'ms';else card.classList.add('settled');});
 $('#aside-links').innerHTML=`${q.date===today&&!memory.progress?.finished?'<button class="link-button" type="button" data-action="open-progress">여행 중이라면 · 지금부터 다시 맞추기</button>':''}${memory.progress?'':'<button class="link-button" type="button" data-action="new-day">새 하루 만들기</button>'}`;
 renderMapThumb(plan);
}
function renderMapThumb(plan){const box=$('#map-thumb');box.innerHTML=routeThumb(plan,box.clientWidth||320,box.clientHeight||156);}
function renderResult(){
 const plan=memory.plan;if(!plan)return;
 renderProgressSummary();
 document.body.classList.add('has-plan');$('#result').hidden=false;$('#before-result').hidden=true;$('#empty-result').hidden=true;
 $('#conditions-panel').open=false;renderConditionChips();
 $('#result-kicker').textContent=seoulDay(memory.query.date)+' · '+memory.query.origin.name+'에서 출발';
 renderJourney(plan);
 if(plan.stops.length<memory.query.stopCount)$('#plan-overview').insertAdjacentHTML('beforeend',`<p class="micro">시간·동선·취향을 비교해 최대 ${memory.query.stopCount}곳 가운데 ${plan.stops.length}곳으로 ${plan.stops.some(stop=>stop.reasons.some(reason=>reason.includes('더 머물게')))?'잡고 머무는 시간을 늘렸어요':'잡았어요'}. 더 넣고 싶은 곳은 아래 장소 둘러보기에서 골라도 좋아요.</p>`);
 // Saved estimates still allow explicit replanning for an upcoming/current day.
 $('#quick-actions').hidden=memory.query.date<defaultTravelQuery().date;
 if(plan.destination&&plan.returnLeg){const leg=plan.returnLeg,last=placeMap.get(plan.stops.at(-1).placeId);$('#timeline').insertAdjacentHTML('beforeend',`<article class="journey-arrival"><p class="kicker">마지막 도착</p><h4>${e(leg.arrivalTime)} · ${e(plan.destination.name)}</h4><p>${e(last.name)}에서 ${e(leg.departureTime)} 출발 · 도보 ${leg.minMinutes}–${leg.maxMinutes}분 예상</p><p>마칠 시각 ${e(memory.query.endTime)}까지의 이동을 포함했어요. 도착점에서의 체류·시설 이용은 포함하지 않습니다.</p>${plan.checks.filter(c=>c.kind==='route.return').map(c=>`<p class="micro">${e(c.reason)}</p>`).join('')}<a href="${e(directionLink(last,plan.destination))}" target="_blank" rel="noopener noreferrer">마지막 이동 길 확인 ↗</a></article>`);}
 $('#plan-overview').insertAdjacentHTML('beforeend',scheduleNote(memory.query)+companionSummary(plan,memory.query));
 renderMap();renderAlternatives();
 renderEvidence();
 $('#plan-change').hidden=true;
}
// 확인 질문과 추천 근거. 질문은 일정을 먼저 보인 뒤 계산해 붙일 수 있어 따로 그린다.
function renderEvidence(){
 const q=outcome?.question,open=$('#result-evidence .engine-evidence')?.open;
 $('#result-evidence').innerHTML=`${q?renderQuestion(q):''}<details class="engine-evidence"${open?' open':''}><summary>추천에 반영한 조건과 자료 보기</summary><p>이번 날짜·출발점·인원·시간·예산, 직접 고른 취향과 확인한 평소 취향을 비교했어요. 취향이 확인되지 않은 장소 특성은 만들어내지 않아요.</p><p>장소 안내 확인: ${e(TRAVEL_META.checkedAt)} · 지도 자료: ${e(network?.sourceTimestamp?.slice(0,10)||'불러오지 못함')}. 이동은 예상 범위이며 현장 안내를 우선해 주세요.</p><p>추천·조건 검사: SYNK Atlas Core. 선택·방문 기록: Trail. 실제 노출과 방문 후 결과 구분: Temper. 지도 표현의 움직임: Loom.</p></details>`;
}
// 일정을 먼저 보이고, 확인 질문(만들기 시간의 대부분)은 같은 시각·같은 조건으로 다시 계산해 같은 일정일 때만 붙인다.
// 계산은 질문 워커가 맡아 결과 직후의 누름이 질문 계산(PC 1초 안팎)을 기다리지 않는다.
// 워커를 못 쓰면(띄우기·모듈·지도 읽기 실패) 결과가 한 번 그려진 다음 프레임 뒤 여기서 계산한다.
// 그때는 콘솔에 까닭을 한 줄 남긴다 — 공개본에서 워커 파일이 빠져도 화면은 그대로라 달리 알 길이 없다.
const questionWorkerUrl=new URL('./question-worker.mjs',import.meta.url);
let questionToken=0,questionWorker=null,questionAsked=null;
function planThenAsk(input){
 const options=settings(input),result=planTravel(input,{...options,ask:false}),token=++questionToken;
 acceptResult(result);
 if(result.primary)askQuestion({token,input,options,result});
}
// 바꾸기 전 비교(빠른 변경·답하기·장소 넣기·바꾸기·남은 일정)도 질문 없이 계산해 바로 보인다. 미리보기는 질문을 쓰지 않고,
// 받아들이면(acceptChange) 같은 시각·같은 조건으로 묻는다. 그 조건은 미리보기에 적어 둔다 —
// 계정 화면을 오가면 미리보기를 복제하므로 경로 함수는 빼고 지도를 썼는지만 적는다.
function withoutQuestion(plan,options){
 const result=plan({...options,ask:false});
 // 남은 일정은 다녀온 곳이 채운 고른 것을 엔진이 뺀다. 엔진이 실제로 쓴 것만 적어야 같은 일정·질문이 나온다.
 if(result.primary)result.questionLater=structuredClone({planId:result.primary.id,now:options.now,feedback:options.feedback,routed:Boolean(options.routeLeg),intents:options.intents.filter(rule=>result.engineAudit.intents.includes(rule.id))});
 return result;
}
// 다른 안 비교는 지금 결과를 펼쳐 일정만 바꾼 것이라 적힌 일정과 달라 새로 묻지 않는다(지금 결과의 질문을 그대로 가져간다).
function acceptChange(){
 const result=pending,later=result.questionLater;
 acceptResult(result);
 if(later?.planId===result.primary?.id)askQuestion({token:++questionToken,input:result.input,result,options:{now:later.now,feedback:later.feedback,intents:later.intents,routeLeg:later.routed?routeLeg:null}});
}
function askQuestion(asked){
 const {token,input,options}=asked,worker=startQuestionWorker();
 // 지도 경로 함수는 넘길 수 없어 지도를 썼는지와 그 지도의 판만 알린다.
 if(worker)try{worker.postMessage({token,input,now:options.now,feedback:options.feedback,intents:options.intents,routed:Boolean(options.routeLeg),mapStamp:network?.sourceTimestamp??null});questionAsked=asked;return;}
 catch(error){console.warn('확인 질문을 워커에 보내지 못해 화면에서 계산해요.',error);}
 askHere(asked);
}
function askHere({token,input,options,result}){
 requestAnimationFrame(()=>setTimeout(()=>{
  if(token!==questionToken||outcome!==result)return;
  const full=planTravel(input,options);attachQuestion({token,result},full.primary?.id,full.question);
 },30));
}
function attachQuestion({token,result},primaryId,question){
 if(token!==questionToken||outcome!==result||primaryId!==result.primary.id||!question)return;
 result.question=question;renderEvidence();
}
// 질문 워커는 한 번만 띄워 둔다. 띄우지 못하거나 모듈을 못 읽으면 그 뒤로는 화면에서 계산한다.
function startQuestionWorker(){
 if(questionWorker!==null)return questionWorker;
 try{
  const worker=new Worker(questionWorkerUrl,{type:'module'});
  const fail=()=>{questionWorker=false;worker.terminate();console.warn('확인 질문 워커를 읽지 못해 화면에서 계산해요.');const asked=questionAsked;questionAsked=null;if(asked)askHere(asked);};
  worker.addEventListener('message',({data})=>{
   const asked=questionAsked;if(data?.token!==asked?.token)return;questionAsked=null;
   if(data.error){console.warn('확인 질문 워커가 계산하지 못해 화면에서 계산해요: '+data.error);askHere(asked);}
   else attachQuestion(asked,data.primaryId,data.question);
  });
  worker.addEventListener('error',event=>{event.preventDefault();fail();});
  worker.addEventListener('messageerror',fail);
  questionWorker=worker;
 }catch(error){questionWorker=false;console.warn('확인 질문 워커를 띄우지 못해 화면에서 계산해요.',error);}
 return questionWorker;
}
function progressPlaceIds(){
 return [...(memory.progress?.completed??[]).map(row=>row.placeId),...(memory.progress?.skippedIds??[])];
}
function renderProgressSummary(){
 const progress=memory.progress,panel=$('#progress-summary');panel.hidden=!progress;
 if(!progress)return;
 panel.innerHTML=`<p class="eyebrow">${e(progress.date)} · ${progress.finished?'오늘 일정을 마쳤어요':'지금까지의 하루'}</p><h3>${progress.finished?'오늘의 여행을 마쳤어요.':'다녀온 곳은 남기고, 다음으로.'}</h3><p class="micro">${e(progress.currentTime)} 기준으로 직접 알려주신 진행 상황이에요. 위치·방문·지출을 자동 확인한 기록은 아닙니다.</p>${progress.completed.length?`<ul class="completed-list">${progress.completed.map(row=>`<li><span>다녀왔어요</span><button class="text-button" data-place="${e(row.placeId)}">${e(placeMap.get(row.placeId).name)}</button><small>${e(row.completedTime)}까지 방문했다고 표시</small></li>`).join('')}</ul>`:'<p class="micro">다녀왔다고 표시한 장소는 없어요.</p>'}${progress.skippedIds.length?`<p class="micro">건너뛴 곳 · ${progress.skippedIds.map(id=>e(placeMap.get(id).name)).join(' · ')}</p>`:''}<div class="memory-actions"><button class="button secondary" data-action="open-progress">${progress.finished?'진행 기록 정정·여행 이어가기':'진행 상황 수정'}</button><button class="button secondary" data-action="new-trip">취향을 이어 새 여행 만들기</button>${progress.finished?'<button class="button secondary" data-action="open-memory">기록 보관·가져가기</button>':''}</div><p class="micro">완료 표시는 만족도 평가나 평소 취향으로 자동 저장하지 않아요. 장소 이름을 누르면 방문 경험을 따로 남길 수 있어요.</p>`;
}
function progressOrigins(){
 const rows=[...origins.filter(origin=>!origin.id.startsWith('place:')).map(origin=>({...origin,key:['anguk','gyeongbokgung','jonggak','gwanghwamun'].includes(origin.id)?'station:'+origin.id:'origin:'+origin.id})),...TRAVEL_PLACES.filter(p=>p.coordinates).map(p=>({id:'place:'+p.id,key:'place:'+p.id,name:p.name,lat:p.coordinates.lat,lon:p.coordinates.lon}))];
 return rows;
}
// skipId: 오늘 카드의 「건너뛰기」로 열면 그 장소를 건너뛸 곳으로 미리 골라 둔다. 적용은 창에서 직접.
function showProgress(skipId=null){
 clearRecovery();
 if(formDirty){
  if(!memory.progress?.finished){toast('수정 중인 여행 조건을 먼저 적용해 주세요.');return;}
  writeInput(memory.query);formDirty=false;$('#form-error').hidden=true;
  toast('마친 여행의 미적용 입력을 저장된 조건으로 돌렸어요. 진행 상황을 정정하거나 여행을 이어갈 수 있어요.');
 }
 if(!memory.plan&&!memory.progress)return;
 if(memory.query.date>koreanDate(new Date().toISOString())){toast('여행 중 조정은 여행 날짜부터 사용할 수 있어요. 지금은 여행 조건을 수정해 주세요.');return;}
 pending=null;$('#plan-change').hidden=true;
 const progress=memory.progress,ids=[...new Set([...progressPlaceIds(),...(memory.plan?.stops??[]).map(s=>s.placeId),...memory.query.lockedIds,...(memory.query.appointments??[]).map(row=>row.placeId)])];
 const locations=progressOrigins(),current=locations.find(o=>o.id===memory.query.origin.id)?.key??locations[0].key;
 const timeNow=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
 const start=[memory.query.startTime,progress?.currentTime??'00:00',timeNow].sort().at(-1);
 $('#progress-content').innerHTML=`<form id="progress-form"><p>다녀온 곳과 건너뛸 곳을 고른 뒤, 다시 출발할 조건을 알려주세요. 적용 전까지 기존 일정은 유지됩니다.</p><div class="progress-places">${ids.map(id=>{const state=progress?.completed.some(row=>row.placeId===id)?'completed':progress?.skippedIds.includes(id)||id===skipId?'skipped':'remaining';return `<div class="progress-place"><label for="progress-${e(id)}">${e(placeMap.get(id).name)}${memory.query.lockedIds.includes(id)?'<small>유지 설정 중 · 완료/건너뜀 선택 시 유지 해제</small>':''}${(memory.query.appointments??[]).some(row=>row.placeId===id)?'<small>예약·약속 시각 고정 · 완료/건너뜀 선택 시 남은 일정에서 해제</small>':''}</label><select id="progress-${e(id)}" data-progress-place="${e(id)}"><option value="remaining" ${state==='remaining'?'selected':''}>앞으로 갈 후보</option><option value="completed" ${state==='completed'?'selected':''}>다녀왔어요</option><option value="skipped" ${state==='skipped'?'selected':''}>이번에는 건너뛰기</option></select></div>`;}).join('')}</div><p class="micro">다녀온 시각은 아래에 입력한 시각까지 방문했다는 본인의 표시로 남아요. 건너뛰기는 취향이나 방문 평가로 쓰지 않아요. 그래서 같은 분야의 다른 곳은 남은 일정에 다시 들어올 수 있어요.</p><div class="field-row"><div class="field"><label for="progress-time">다시 출발할 시각</label><input id="progress-time" type="time" value="${e(start)}" required></div><div class="field"><label for="progress-end">여행 마칠 시각</label><input id="progress-end" type="time" value="${e(memory.query.endTime)}" required></div></div><div class="field"><label for="progress-origin">현재 출발 위치를 직접 골라주세요</label><select id="progress-origin">${locations.map(o=>`<option value="${e(o.key)}" ${o.key===current?'selected':''}>${e(o.name)}${o.key.startsWith('station:')?' · 대표 역 위치':o.key.startsWith('place:')?' · 장소 위치':' · 저장한 출발점'}</option>`).join('')}</select><small>이전 출발지를 표시해 두었어요. 현재 위치로 직접 바꿔주세요. GPS를 사용하지 않으며 실제 출구·입구와 차이가 있어요.</small><button class="button secondary" type="button" data-action="choose-progress-origin">지도·숙소에서 출발점 고르기</button></div><div class="field"><label for="progress-budget">앞으로 쓸 일행 전체 예산 · 원</label><input id="progress-budget" type="number" min="0" max="10000000" step="1000" inputmode="numeric" placeholder="남은 금액을 직접 입력"><small>이미 쓴 돈을 추정해 빼지 않아요. 추가 주문·교통비는 별도예요.</small></div><div class="field-row"><div class="field"><label for="progress-walk">앞으로 이동하며 걷기 · 분</label><input id="progress-walk" type="number" min="0" max="360" value="${memory.query.maxWalkMinutes}" inputmode="numeric"></div><div class="field"><label for="progress-stops">앞으로 최대 몇 곳?</label><select id="progress-stops">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===Math.max(1,memory.plan?.stops.length??1)?'selected':''}>${n}곳</option>`).join('')}</select></div></div><p class="micro">앞으로 갈 후보는 모두 방문한다는 뜻은 아니에요. 유지한 장소는 계속 지킵니다. 이미 마친 분야의 필수 포함은 충족된 것으로 보되 취향은 유지해요. 식사를 이미 했다면 아래에서 식사 생략을 직접 골라주세요. 한 구간 걷기와 쉬는 간격도 기존 설정을 이어갑니다.</p>${progressMealFields()}<p class="micro">${memory.query.destination?`마지막 도착점은 ${e(memory.query.destination.name)}입니다. 바꾸려면 이 창을 닫고 여행 조건의 마지막 도착점을 수정해 주세요.`:'마지막 방문지에서 마칩니다.'}</p><p id="progress-error" class="error" role="alert" hidden></p><div id="progress-recovery"></div><div class="progress-actions"><button class="button primary" type="submit">남은 일정 비교하기</button><button class="button secondary" type="button" data-action="finish-trip">오늘은 여기서 마치기</button></div><p class="micro">마치기는 남은 계획을 끝내고 직접 표시한 진행 기록을 보관해요. 예산 입력은 필요 없으며, 위 시각을 마친 시각으로 기록합니다.</p></form>`;
 syncScheduleFields('progress-');$('#progress-dialog').showModal();
}
function collectProgress(){
 const time=$('#progress-time').value;
 if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)||time<(memory.progress?.currentTime??memory.query.startTime))throw new TypeError('이전 진행 기록·출발보다 이르지 않은 시각을 입력해 주세요.');
 const completed=[],skippedIds=[];
 for(const select of $$('[data-progress-place]')){const id=select.dataset.progressPlace;if(select.value==='completed')completed.push({placeId:id,completedTime:memory.progress?.completed.find(row=>row.placeId===id)?.completedTime??time});else if(select.value==='skipped')skippedIds.push(id);}
 return {date:memory.query.date,completed,skippedIds,currentTime:time,requiredCategories:[...(memory.progress?.requiredCategories??memory.query.requiredCategories)],finished:false,updatedAt:now()};
}
function progressBaseQuery(progress){
 const previous=new Set(progressPlaceIds());
 return {...memory.query,requiredCategories:[...progress.requiredCategories],excludedIds:memory.query.excludedIds.filter(id=>!previous.has(id))};
}
function previewRemaining(event){
 event?.preventDefault();const button=$('#progress-form button[type=submit]');button.disabled=true;
 pending=null;$('#plan-change').hidden=true;
 try{
  for(const id of ['progress-budget','progress-walk'])if($('#'+id).value==='')throw new TypeError('남은 예산과 걷기 시간을 직접 입력해 주세요.');
  const progress=collectProgress(),origin=progressOrigins().find(row=>row.key===$('#progress-origin').value);
  const base=progressBaseQuery(progress);base.endTime=$('#progress-end').value;base.meal=readMeal('progress-');
  const result=withoutQuestion(options=>replanRemainingTravel(base,{...options,completedIds:progress.completed.map(row=>row.placeId),skippedIds:progress.skippedIds,currentTime:progress.currentTime,origin,remainingBudget:Number($('#progress-budget').value),maxWalkMinutes:Number($('#progress-walk').value),stopCount:Number($('#progress-stops').value)}),settings());
  if(!result.primary){$('#progress-error').textContent='현재 조건으로 남은 일정을 찾지 못했어요. 기존 일정과 진행 기록은 유지됩니다.';$('#progress-error').hidden=false;$('#progress-recovery').innerHTML=renderRecovery(result,progress);return;}
  validateTravelMemory({...memory,query:result.input,plan:result.primary,progress,updatedAt:progress.updatedAt},{now:now()});
  pending={...result,progress};$('#progress-dialog').close();
  $('#plan-change').innerHTML=`<div class="change-preview"><p class="eyebrow">지금부터 갈 곳만 다시 맞췄어요</p><h4>${e(progress.currentTime)} · ${e(result.input.origin.name)}에서 출발</h4><p>다녀온 ${progress.completed.length}곳 · 건너뛴 ${progress.skippedIds.length}곳은 남은 동선에서 제외했어요.</p><p>${result.primary.stops.map(s=>e(placeMap.get(s.placeId).name)).join(' → ')}</p><p>앞으로 도보 ${result.primary.walking.minMinutes}–${result.primary.walking.maxMinutes}분 · 확인된 ${result.primary.cost.status==='unknown'?'부분합':'표시 비용'} ${money(result.primary.cost.knownAmount)}${result.primary.cost.unknownPlaceIds.length?' + 금액 확인 필요 '+result.primary.cost.unknownPlaceIds.length+'곳':''} · 종료 ${e(result.primary.endTime)}</p>${scheduleNote(result.input)}${companionSummary(result.primary,result.input)}<p>남은 예산 ${money(result.input.budget)} 기준이에요. 이전 일정의 비용을 실제 지출로 차감하지 않았어요.</p><button class="button primary" data-action="accept-change">이 남은 일정으로 바꾸기</button><button class="button secondary" data-action="cancel-change">원래 계획 유지</button></div>`;
  $('#plan-change').hidden=false;$('#before-result').hidden=true;$('#plan-change').scrollIntoView({behavior:'smooth',block:'center'});
 }catch(error){$('#progress-error').textContent=error.message;$('#progress-error').hidden=false;}
 finally{button.disabled=false;}
}
function finishTrip(){
 try{
  const progress=collectProgress();progress.finished=true;
  const removed=[...progress.completed.map(row=>row.placeId),...progress.skippedIds],base=progressBaseQuery(progress);
  const query=normalizePlannerInput({...base,planningMode:'remaining',lockedIds:base.lockedIds.filter(id=>!removed.includes(id)),appointments:(base.appointments??[]).filter(row=>!removed.includes(row.placeId)),excludedIds:[...new Set([...base.excludedIds,...removed])]});
  const next={...memory,query,plan:null,progress,updatedAt:progress.updatedAt};
  memory=validateTravelMemory(next,{now:now()});pending=null;outcome=null;activeDecision=null;formDirty=false;exposureObserver?.disconnect();
  $('#progress-dialog').close();writeInput(memory.query);restorePlan();persist();toast('오늘 여행을 마쳤어요. 직접 표시한 진행 기록을 남겼습니다.');
 }catch(error){$('#progress-error').textContent=error.message;$('#progress-error').hidden=false;}
}
function renderQuestion(q){
 return `<section class="change-preview refinement"><p class="kicker">하나만 더 알려주세요</p><h4>${e(q.label)}</h4><p>답하기 전에, 같은 조건에서 달라지는 여행안을 비교해 보세요.</p><div class="refinement-grid">${q.options.map(option=>{
  const p=option.preview;if(!p)return '';
  // 도보 차이는 지금 보이는 일정 기준으로 잰다. 다른 안을 받아들이면 질문은 원래 일정에서 계산한 그대로 따라온다.
  const walk=memory.plan?p.walking.maxMinutes-memory.plan.walking.maxMinutes:p.changes.walkMaxDelta;
  return `<article class="refinement-option"><div class="refinement-photos">${p.stops.slice(0,3).map(s=>{const place=placeMap.get(s.placeId);return place?placeThumb(place):`<span class="tile tile-compact"><strong>${e(s.name)}</strong></span>`;}).join('')}</div><h5>${e(option.label)}</h5><p class="refinement-route">${p.stops.map(s=>e(s.name)).join(' → ')}</p><dl><dt>예상 도보</dt><dd>${p.walking.minMinutes}–${p.walking.maxMinutes}분 <small>(${walk===0?'현재와 같음':`${walk>0?'+':''}${walk}분`})</small></dd><dt>${p.costStatus==='unknown'?'확인된 부분합':'확인된 표시 비용'}</dt><dd>${money(p.knownAmount)}${p.costStatus==='unknown'?' + 미확인':''}</dd><dt>마칠 시각</dt><dd>${e(p.endTime)}</dd></dl><button class="chip" data-refine="${e(q.about)}" data-value="${option.value}">이쪽으로 비교하기</button>${p.stops.some(s=>placeMap.get(s.placeId)?.photo)?`<details><summary>사진 출처</summary>${p.stops.filter(s=>placeMap.get(s.placeId)?.photo).map(s=>`<p class="photo-credit">${credit(placeMap.get(s.placeId))}</p>`).join('')}</details>`:''}</article>`;
 }).join('')}</div><p class="micro">${e(q.caveat)}</p></section>`;
}
function renderAlternatives(){
 const plans=outcome?.alternatives??[];
 $('#alternatives').innerHTML=plans.length?`<h4>다른 방향의 하루도 있어요.</h4><div class="alt-grid">${plans.slice(0,2).map((p,i)=>`<article class="alternative"><div class="alt-thumbs" aria-hidden="true">${p.stops.slice(0,5).map(s=>placeThumb(placeMap.get(s.placeId))).join('')}</div><h5>${e(p.label)}</h5><p>${p.stops.map(s=>e(placeMap.get(s.placeId).name)).join(' → ')}</p><p>도보 ${p.walking.minMinutes}–${p.walking.maxMinutes}분 · 확인 금액 ${money(p.cost.knownAmount)}${p.cost.unknownPlaceIds.length?' + 미확인':''}</p><button class="chip" data-alternative="${i}">이 여행안 비교하기</button></article>`).join('')}</div>`:'';
}
function renderMap(){
 const plan=memory.plan;if(!plan)return;
 // 지도 틀의 실제 비율로 그려 빈 띠 없이 꽉 채운다. 숨어 있을 때만 예전 비율을 쓴다.
 const box=$('#route-map'),boxW=box?.clientWidth||0,boxH=box?.clientHeight||0;
 const mapHeight=boxW>0&&boxH>0?Math.round(800*boxH/boxW):innerWidth<=600?700:430,mapRatio=800/mapHeight;
 const allLegs=[...plan.legs,...(plan.returnLeg?[plan.returnLeg]:[])];
 const points=[memory.query.origin,...(plan.destination?[plan.destination]:[]),...plan.stops.map(s=>placeMap.get(s.placeId).coordinates),...allLegs.flatMap(l=>l.coordinates.map(([lon,lat])=>({lon,lat})))];
 let minX=Math.min(...points.map(p=>p.lon)),maxX=Math.max(...points.map(p=>p.lon)),minY=Math.min(...points.map(p=>p.lat)),maxY=Math.max(...points.map(p=>p.lat));
 const midX=(minX+maxX)/2,midY=(minY+maxY)/2;
 let w=Math.max(maxX-minX,.006)/mapZoom,h=Math.max(maxY-minY,.004)/mapZoom;
 if(w/h<mapRatio)w=h*mapRatio;else h=w/mapRatio;w*=1.35;h*=1.35;
 minX=midX-w/2;minY=midY-h/2;
 const xy=p=>[(p[0]-minX)/w*800,mapHeight-(p[1]-minY)/h*mapHeight];
 const path=coords=>coords.map((p,i)=>`${i?'L':'M'}${xy(p).map(n=>n.toFixed(1)).join(',')}`).join('');
 let roads='';if(network){roads=network.ways.map(way=>{
  const coords=way.n.map(i=>network.nodes[i]);if(!coords.some(p=>p[0]>minX&&p[0]<minX+w&&p[1]>minY&&p[1]<minY+h))return '';
  const park=way.kind==='park',major=['primary','secondary','tertiary'].includes(way.kind);
  return `<path d="${path(coords)}" fill="${park?'#dce8d8':'none'}" stroke="${park?'#d4e1d1':major?'#ffffff':'#dce2d8'}" stroke-width="${park?1:major?5:1.7}"/>`;
 }).join('');}
 const route=allLegs.map(l=>{const osm=l.source==='osm-walking-network'&&l.coordinates.length>2,main=osm?l.coordinates.slice(1,-1):l.coordinates;return `<path d="${path(main)}" fill="none" stroke="${osm?'#54734f':'#a0744b'}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" ${osm?'':'stroke-dasharray="6 6"'}/>${osm?`<path d="${path(l.coordinates.slice(0,2))} ${path(l.coordinates.slice(-2))}" fill="none" stroke="#a0744b" stroke-width="3" stroke-dasharray="4 4"/>`:''}`;}).join('');
 const [ox,oy]=xy([memory.query.origin.lon,memory.query.origin.lat]);
 const markerScale=800/($('#route-map').clientWidth||Math.max(260,innerWidth-48)),markerRadius=13*markerScale,labelSize=12*markerScale,hitRadius=23*markerScale;
 const markers=plan.stops.map((stop,i)=>{const p=placeMap.get(stop.placeId),[x,y]=xy([p.coordinates.lon,p.coordinates.lat]);return `<g class="map-point" data-map-place="${e(p.id)}" tabindex="0" role="button" aria-label="${i+1}번째 장소 ${e(p.name)} 자세히"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hitRadius}" fill="transparent"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${markerRadius}" fill="#39523f" stroke="white" stroke-width="3"/><text x="${x.toFixed(1)}" y="${(y+4*markerScale).toFixed(1)}" text-anchor="middle" fill="white" font-size="${labelSize}">${i+1}</text></g>`;}).join('');
 const end=plan.destination?xy([plan.destination.lon,plan.destination.lat]):null;
 const endMarker=end?`<circle cx="${end[0]}" cy="${end[1]}" r="${9*markerScale}" fill="white" stroke="#8b613f" stroke-width="3"/><text x="${end[0]+12*markerScale}" y="${end[1]-12*markerScale}" font-size="${labelSize}" stroke="white" stroke-width="3" paint-order="stroke">도착</text>`:'';
 $('#route-map').innerHTML=`<svg class="route-map-svg" viewBox="0 0 800 ${mapHeight}" aria-label="${e(memory.query.origin.name)}에서 ${plan.stops.map(s=>e(placeMap.get(s.placeId).name)).join(', ')}${plan.destination?', '+e(plan.destination.name)+'까지':''}를 잇는 예상 보행 지도" role="group"><defs><clipPath id="map-clip"><rect width="800" height="${mapHeight}" rx="5"/></clipPath></defs><g clip-path="url(#map-clip)">${roads}${route}<circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="7" fill="white" stroke="#39523f" stroke-width="3"/><text class="map-label" x="${(ox+11).toFixed(1)}" y="${(oy+20).toFixed(1)}" font-size="${labelSize}" stroke="white" stroke-width="3" paint-order="stroke">출발 · ${e(memory.query.origin.name)}</text>${markers}${endMarker}</g></svg><div class="map-legend">${plan.stops.map((s,i)=>`<button class="text-button" data-place="${e(s.placeId)}"><b>${i+1}</b>${e(placeMap.get(s.placeId).name)}</button>`).join('')}${plan.destination?`<span>도착 · ${e(plan.destination.name)}</span>`:''}</div>`;
}
function animateZoom(target){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){mapZoom=target;renderMap();return;}
 let last=null,frames=0;const state={value:mapZoom,velocity:0};
 function frame(t){if(last===null)last=t;Loom.advanceSpring(state,target,.13,Math.min((t-last)/1000,.04));last=t;mapZoom=state.value;if(frames++%2===0)renderMap();if(Math.abs(mapZoom-target)>.01)requestAnimationFrame(frame);else{mapZoom=target;renderMap();}}requestAnimationFrame(frame);
}
function previewChange(result,label){
 if(!result.primary){pending=null;$('#plan-change').innerHTML=`<div class="change-preview"><h4>이 변경으로는 조건을 모두 지킬 수 없었어요.</h4><p>기존 일정은 그대로 두었어요. 아래 변경안을 직접 골라 적용할 수 있습니다.</p>${renderRecovery(result)}<button class="button secondary" data-action="cancel-change">원래 계획 유지</button></div>`;$('#plan-change').hidden=false;$('#plan-change').scrollIntoView({behavior:'smooth',block:'center'});return;}
 pending=result;const current=memory.plan,next=result.primary;
 const change=next.cost.knownAmount-current.cost.knownAmount,walk=next.walking.maxMinutes-current.walking.maxMinutes;
 $('#plan-change').innerHTML=`<div class="change-preview"><p class="kicker">바꾸기 전에, 달라지는 점</p><h4>${e(label)}</h4><p>${next.stops.map(s=>e(placeMap.get(s.placeId).name)).join(' → ')}</p><p>예상 걷기 상단 ${walk>0?'+':''}${walk}분 · 확인 금액 ${change>0?'+':''}${money(change)} · 종료 ${e(current.endTime)} → ${e(next.endTime)}</p>${scheduleNote(result.input)}${companionSummary(next,result.input)}<p>${next.cost.unknownPlaceIds.length?'미확인 비용 '+next.cost.unknownPlaceIds.length+'곳은 별도로 확인해야 해요.':''} ${memory.query.lockedIds.length?'유지한 장소 '+memory.query.lockedIds.length+'곳을 함께 검사했어요.':''}</p><button class="button primary" data-action="accept-change">이 코스로 바꾸기</button> <button class="button secondary" data-action="cancel-change">원래 계획 유지</button></div>`;$('#plan-change').hidden=false;$('#plan-change').scrollIntoView({behavior:'smooth',block:'center'});
}
function adjust(kind){
 if(formDirty){toast('수정 중인 여행 조건을 먼저 적용해 주세요.');return;}
 const input=structuredClone(memory.query);let label='여행안 바꾸기';
 if(kind==='less-walk'){input.maxWalkMinutes=Math.max(5,Math.floor(input.maxWalkMinutes*.7));if(input.preferences.walk!==true)input.preferences.walk=false;label='걷기 상한을 '+input.maxWalkMinutes+'분으로 줄였어요.';}
 if(kind==='less-cost'){input.budget=Math.floor(input.budget*.75/1000)*1000;label='예산을 '+money(input.budget)+'으로 줄였어요.';}
 if(kind==='indoors'){input.preferences.indoor=true;input.preferences.outdoor=false;label='방문지는 실내를 우선했어요. 장소 사이 이동은 야외예요.';}
 if(kind==='later'){const t=Number(input.startTime.slice(0,2))*60+Number(input.startTime.slice(3))+30;input.startTime=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');label='출발을 30분 늦춰 다시 맞췄어요.';}
 try{previewChange(withoutQuestion(options=>planTravel(input,options),settings(input)),label);}catch(error){toast(error.message);}
}
function renderVenueFacts(place){
 const items=place.menuItems??[],visit=place.visitInfo;if(!items.length&&!visit)return '';
 const units={'menu-item':'메뉴 표시가','course-menu':'코스 표시가','exchange-unit':'교환 단위 표시가'};
 return `<section class="verified-facts"><h3>메뉴와 방문 전 확인</h3>${items.length?`<p class="micro">아래는 확인한 메뉴 정보예요. 일행 전체의 식비나 현재 주문 가능 여부를 보장하지 않아요.</p><dl class="menu-facts">${items.map(item=>`<div><dt>${e(item.name)}</dt><dd><strong>${item.amount===null?'금액 미확인':money(item.amount)}</strong> · ${e(units[item.unit]||'표시가')}${item.amount!==null&&item.taxStatus==='not-stated'?' · 세금 포함 여부 미표기':''}<p>${e(item.availabilityNote)}</p>${item.sourcePublishedAt?`<p class="micro">원문 작성: ${e(item.sourcePublishedAt)} · 현재 제공 여부는 다시 확인해 주세요.</p>`:''}<a href="${e(safeUrl(item.sourceUrl))}" target="_blank" rel="noopener noreferrer">메뉴 근거 ↗</a> <span class="micro">${e(item.verifiedAt)} 확인</span></dd></div>`).join('')}</dl>`:''}${visit?`<div class="visit-facts">${[['운영',visit.hoursNote],['예약',visit.reservationNote],['입장·접근',visit.entranceNote]].filter(([,note])=>note).map(([label,note])=>`<p><strong>${label}</strong> · ${e(note)}</p>`).join('')}<p>${(visit.sourceUrls??[]).map((url,i)=>`<a href="${e(safeUrl(url))}" target="_blank" rel="noopener noreferrer">방문 안내 ${i+1} ↗</a>`).join(' · ')} <span class="micro">${e(visit.verifiedAt)} 확인</span></p></div>`:''}</section>`;
}
function showPlace(id){
 const place=placeMap.get(id);if(!place)return;editingVisit=null;
 $('#place-detail').innerHTML=`${place.photo?photo(place,'detail-image')+`<p class="photo-credit">${credit(place)}</p>`:placeCover(place)}<p class="stop-type">${e(categoryLabel[place.category])}</p><h2>${e(place.name)}</h2><p class="detail-description">${e(place.description)}</p><dl class="detail-grid"><dt>어디에</dt><dd>${e(place.address)}</dd><dt>운영 안내</dt><dd>${e(place.openingNote||'공식 안내에서 확인해 주세요.')}</dd><dt>비용</dt><dd>${e(place.costNote)}</dd><dt>나에게 맞는 점</dt><dd>${Object.entries(place.features??{}).filter(([k,v])=>v&&PREFERENCE_LABELS[k]).map(([k])=>e(PREFERENCE_LABELS[k])).join(' · ')||'아직 비교할 취향 자료가 부족해요.'}</dd><dt>기본 안내 확인</dt><dd>${e(place.verifiedAt||place.checkedAt)} · ${e(place.sourceLabel)}</dd></dl><div class="detail-actions"><a class="button secondary" href="${e(safeUrl(place.bookingUrl||place.sourceUrl))}" target="_blank" rel="noopener noreferrer">공식 안내·예약 확인 ↗</a><a class="button secondary" href="${e(placeLink(place))}" target="_blank" rel="noopener noreferrer">지도에서 보기 ↗</a>${place.dayPlannerEligible!==false?(memory.plan?.stops.some(stop=>stop.placeId===id)?'<p class="micro">지금 일정에 들어 있는 곳이에요.</p>':`<button class="button primary" data-include="${e(id)}">이곳을 넣어 여행 만들기</button>`):'<p class="micro">숙박 날짜별 요금·객실 비교는 아직 연결하지 않았어요.</p>'}</div>${renderVenueFacts(place)}${Object.entries(place.provenance?.featuresByKey??{}).filter(([,v])=>v.freshnessNote).map(([key,v])=>`<p class="micro">${e(PREFERENCE_LABELS[key])} 자료: ${e(v.freshnessNote)}</p>`).join('')}<section class="review-section"><h3>다녀왔다면, 어땠나요?</h3><p class="micro">방문한 경험만 남겨주세요. 저장이나 추천 선택을 방문으로 보지 않아요.</p><form id="visit-form" data-place-id="${e(id)}"><label for="visit-rating">이 장소에서의 경험</label><br><select id="visit-rating"><option value="5">5 · 정말 좋았어요</option><option value="4">4 · 좋았어요</option><option value="3" selected>3 · 보통이었어요</option><option value="2">2 · 아쉬웠어요</option><option value="1">1 · 많이 아쉬웠어요</option></select><div class="reason-checks">${TRAVEL_VISIT_REASONS.map(r=>`<label><input name="visit-reason" type="checkbox" value="${r.id}"> ${e(r.label)}</label>`).join('')}</div><button class="button secondary" type="submit">방문 경험 남기기</button></form><div id="preference-suggestions"></div></section>`;
 $('#place-dialog').showModal();
}
function showSwap(id){
 const place=placeMap.get(id);if(!place)return;
 $('#swap-content').innerHTML=`<p class="micro">${e(place.name)} 대신 넣을 곳을 골라주세요. 운영·동선·시간·예산을 다시 비교한 뒤 적용해요.</p>${TRAVEL_PLACES.filter(p=>p.category===place.category&&p.id!==id&&!progressPlaceIds().includes(p.id)&&!memory.plan.stops.some(s=>s.placeId===p.id)&&p.dayPlannerEligible!==false).map(p=>`<article class="swap-row">${placeThumb(p)}<div><h3>${e(p.name)}</h3><p>${e(p.costNote)}</p></div><button class="chip" data-replace-from="${e(id)}" data-replace-to="${e(p.id)}">이곳으로 비교</button></article>`).join('')||'<p>지금 자료에서 같은 분야의 대안을 찾지 못했어요.</p>'}`;$('#swap-dialog').showModal();
}
function renderExplore(){
 const term=$('#place-search').value.trim().toLowerCase(),mixed=(()=>{const a=TRAVEL_PLACES.filter(p=>p.photo),b=TRAVEL_PLACES.filter(p=>!p.photo),out=[];while(a.length||b.length){out.push(...a.splice(0,2),...b.splice(0,1));}return out;})(),filtered=mixed.filter(p=>(selectedCategory==='all'||p.category===selectedCategory)&&(p.name+' '+p.description).toLowerCase().includes(term));
 $('#catalogue-count').textContent='공식 안내를 확인한 '+TRAVEL_PLACES.length+'곳';
 $('#place-grid').innerHTML=filtered.map(p=>`<article class="place-card"><button class="place-image-button" data-place="${e(p.id)}" aria-label="${e(p.name)} 자세히" tabindex="-1">${placeCover(p)}</button><p class="place-cat">${e(categoryShort[p.category])}</p><h3><button class="place-title" data-place="${e(p.id)}">${e(p.name)}</button></h3><p class="place-desc">${e(p.description)}</p></article>`).join('')||'<p>이름이 맞는 장소가 없어요. 다른 단어로 찾아보세요.</p>';
}
function invalidatePreferencePreview(){
 clearRecovery();
 pending=null;if(outcome)outcome={...outcome,question:null,alternatives:[]};
 $('#plan-change').hidden=true;if(memory.plan)renderResult();
}
function renderMemory(){
 const visited=memory.visits, prefs=memory.confirmedPreferences,hasPlan=!!memory.plan;
 $('#memory-content').innerHTML=`<section class="memory-section"><h3>${hasPlan?e(memory.query.date)+' · '+memory.plan.stops.length+'곳의 여행':memory.progress?.finished?e(memory.query.date)+' · 마친 여행':'아직 만든 여행이 없어요.'}</h3>${accountSession?.active?'<p>지금은 로그인한 계정의 여행을 편집해요. 로그인 전 브라우저 저장본은 별도로 유지합니다.</p>':`<label><input id="save-consent" type="checkbox" ${memory.consent?'checked':''}> 이 브라우저에 여행과 취향을 보관할게요</label><p>날짜·조건·계획·진행 상황·동행 별칭과 취향·직접 남긴 방문 경험을 보관해요. 동의를 끄면 이 기기의 저장본을 지우고 현재 화면은 유지합니다.</p>`}<div class="memory-actions"><button class="button primary" data-action="new-trip">취향을 이어 새 여행 만들기</button><button class="button secondary" data-action="export-json">여행 파일 저장</button><button class="button secondary" data-action="import-json">여행 파일 가져오기</button>${hasPlan||memory.progress?'<button class="button secondary" data-action="export-text">공유용 일정 저장</button>':''}</div><input type="file" id="import-file" accept=".json,application/json" hidden><p>여행 파일을 다른 기기로 옮겨 ‘가져오기’를 누르면 이어 쓸 수 있어요. 파일에는 확인한 취향·방문 기록과 이번 여행의 동행 별칭·취향이 포함됩니다. 공유용 일정에는 개인 취향·방문 의견을 넣지 않아요.</p></section><section class="memory-section"><h3>다음에도 기억할 취향</h3>${prefs.length?prefs.map(p=>`<div class="preference-row"><span>${e(PREFERENCE_LABELS[p.key])} ${p.value?'선호':'피하기'}</span><button class="text-button" data-forget-pref="${e(p.key)}">반영에서 빼기</button></div>`).join(''):'<p>다음 여행에도 쓰겠다고 직접 확인한 취향이 없어요.</p>'}<details><summary>평소 취향 직접 추가하기</summary><form id="preference-form"><select id="preference-key" aria-label="기억할 취향">${Object.entries(PREFERENCE_LABELS).map(([key,label])=>`<option value="${e(key)}">${e(label)}</option>`).join('')}</select><select id="preference-value" aria-label="취향 방향"><option value="true">선호해요</option><option value="false">피하고 싶어요</option></select><button class="button secondary" type="submit">다음에도 반영하기</button></form></details><p>이번 여행에서 직접 고른 조건이 평소 취향보다 우선해요. 자료가 없는 장소 특성은 추정하지 않아요.</p></section><section class="memory-section"><h3>남긴 방문 경험 ${visited.length}</h3>${visited.length?visited.slice().reverse().map(v=>`<div class="visit-row"><strong>${e(placeMap.get(v.placeId)?.name)}</strong> · ${v.rating}/5<small>${e(koreanDate(v.at))} · ${v.reasons.map(r=>e(TRAVEL_VISIT_REASONS.find(x=>x.id===r)?.label)).join(' · ')}</small><button class="text-button" data-edit-visit="${e(v.id)}">수정</button> <button class="text-button" data-delete-visit="${e(v.id)}">삭제</button></div>`).join(''):'<p>아직 남긴 방문 경험이 없어요. 다녀온 장소의 상세 화면에서 기록할 수 있어요.</p>'}${visited.some(v=>v.decisionId===activeDecision)&&!memory.journal.outcomes.some(o=>memory.journal.exposures.find(x=>x.id===o.exposureId)?.decisionId===activeDecision)?'<form id="trip-rating-form"><label>이번 여행 전체는 어땠나요? <select id="trip-rating"><option value="5">5 · 정말 좋았어요</option><option value="4">4 · 좋았어요</option><option value="3">3 · 보통이었어요</option><option value="2">2 · 아쉬웠어요</option><option value="1">1 · 많이 아쉬웠어요</option></select></label><button class="button secondary" type="submit">여행 전체 평가 남기기</button></form>':''}</section><section class="memory-section"><h3>계정으로 이어 쓰기</h3><p>${e(accountSession?.active?'계정 저장 상태와 로그인 관리는 별도 영역에서 확인해 주세요.':TRAVEL_ACCOUNT_CONTRACT.reason)}</p><button class="button secondary" data-action="show-account">계정 연결 상태 보기</button></section><section class="memory-section"><button class="text-button danger" data-action="clear-history">방문 기록과 평소 취향 모두 지우기</button><br><button class="text-button danger" data-action="reset-all">${accountSession?.active?'현재 계정의 새 여행으로 초기화':'이 브라우저의 여행 전체 초기화'}</button><p>${accountSession?.active?'현재 계정 기록이 빈 여행으로 저장됩니다. 로그인 전 브라우저 기록은 유지됩니다.':'전체 초기화는 현재 여행과 저장본을 지워요.'} 이미 내보낸 파일은 직접 관리해야 합니다.</p></section>`;
}
function showMemory(){if(accountLocked()){showAccount();return;}renderMemory();$('#memory-dialog').showModal();}
function download(text,name,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('브라우저에 파일 저장을 요청했어요. 다운로드 목록을 확인하세요.');}
function exportText(){
 const p=memory.plan,progress=memory.progress;if(!p&&!progress)return;
 const lines=['SYNK PATH · 나의 서울 여행',memory.query.date];
 const meal=memory.query.meal;
 if(meal?.mode==='none')lines.push('식당 방문 생략');
 else if(meal?.mode==='window')lines.push(`식사 시작 ${meal.startTime}~${meal.endTime} 사이`);
 if(memory.query.destination)lines.push(`${memory.query.endTime}까지 ${memory.query.destination.name} 도착`);
 if(progress){lines.push(progress.finished?'오늘 여행 마침':'지금부터 남은 일정',progress.currentTime+' 기준 · 직접 표시한 진행 기록',...progress.completed.map(row=>'다녀왔다고 표시: '+placeMap.get(row.placeId).name+' ('+row.completedTime+'까지)'),...(progress.skippedIds.length?['건너뜀: '+progress.skippedIds.map(id=>placeMap.get(id).name).join(', ')]:[]),'');}
 if(p){lines.push(`${p.startTime}~${p.endTime} / 성인 ${memory.query.party.adults}명, 아이 ${memory.query.party.children}명`,`확인된 표시 비용 ${money(p.cost.knownAmount)}${p.cost.unknownPlaceIds.length?' + 금액 확인 필요 '+p.cost.unknownPlaceIds.length+'곳':''}`,`일정의 예상 도보 ${p.walking.minMinutes}~${p.walking.maxMinutes}분 (시설 안 별도)`,'');
  p.stops.forEach((s,i)=>{const place=placeMap.get(s.placeId),appointment=(memory.query.appointments??[]).find(row=>row.placeId===s.placeId);lines.push(...(s.preStartPause?[`${s.preStartPause.startTime}~${s.preStartPause.endTime} 시작 전 쉬는 여유 ${s.preStartPause.durationMinutes}분 (대기 시간에 포함, 좌석·쉼터 미확인)`]:[]),`${i+1}. ${s.arrivalTime}~${s.departureTime} ${place.name}`,...(appointment?[`직접 정한 예약·약속 시작 ${appointment.time}`]:[]),place.address,s.schedule.reason,...(s.pauses??[]).map(p=>`${p.startTime}~${p.endTime} 쉬는 여유 ${p.durationMinutes}분 (좌석·쉼터 미확인)`),...s.cost.unknowns,placeLink(place),place.sourceUrl,'');});
  if(p.destination&&p.returnLeg)lines.push(`마지막 도착 ${p.returnLeg.arrivalTime} · ${p.destination.name}`,`${p.returnLeg.departureTime} 출발 · 도보 ${p.returnLeg.minMinutes}~${p.returnLeg.maxMinutes}분 예상`,directionLink(placeMap.get(p.stops.at(-1).placeId),p.destination),'');
 }
 lines.push('실시간 영업·예약 확인이 아닙니다. 표시 메뉴·일반 관람 외 비용은 별도입니다.','지도 © OpenStreetMap contributors (ODbL): https://www.openstreetmap.org/copyright');
 download(lines.join('\n'),`SYNK-PATH-${memory.query.date}.txt`,'text/plain;charset=utf-8');
}
async function importFile(file){
 if(!file||accountLocked())return;if(file.size>TRAVEL_MAX_BYTES){toast('여행 파일은 512 KB까지 불러올 수 있어요.');return;}
 const previous=memory,generation=accountSession?.generation,isAccount=Boolean(accountSession?.active);
 const isCurrent=()=>generation===accountSession?.generation&&isAccount===Boolean(accountSession?.active)&&!accountLocked();
 try{const imported=importTravelMemory(await file.text());
  if(!isCurrent())return;
  applyAccountState(imported,{guest:!isAccount});
  if(isAccount)persist();else clearTravelMemory();
  $('#memory-dialog').close();
  toast(isAccount?'여행을 현재 계정에 가져왔어요. 로그인 전 기록은 유지했어요.':'여행을 가져왔어요. 이 기기 저장은 새로 선택해 주세요.');
 }catch(error){if(!isCurrent())return;applyAccountState(previous,{guest:!isAccount});toast(error.message);}
}
function restorePlan({snapshot=false}={}){
 clearRecovery();
 outcome=null;pending=null;formDirty=false;exposureObserver?.disconnect();
 $('#plan-change').hidden=true;
 activeDecision=memory.journal.decisions.findLast(d=>d.selectedId===memory.plan?.id)?.id??null;
 renderProgressSummary();
 if(!memory.plan){document.body.classList.remove('has-plan');$('#result').hidden=true;$('#empty-result').hidden=true;$('#before-result').hidden=!!memory.progress?.finished;return;}
 if(memory.progress||snapshot){restored=memory.progress?'progress':'snapshot';writeInput(memory.query);renderResult();return;}
 const prior=memory.plan,priorLocks=[...memory.query.lockedIds];restored='snapshot';
 if(memory.query.date>=defaultTravelQuery().date){
  try{const result=planTravel({...memory.query,lockedIds:prior.stops.map(s=>s.placeId)},settings());
   if(result.primary){
    const sameIntent=JSON.stringify(result.primary.stops.map(s=>[s.placeId,s.arrivalTime,s.departureTime]))===JSON.stringify(prior.stops.map(s=>[s.placeId,s.arrivalTime,s.departureTime]))&&JSON.stringify(result.primary.destination??null)===JSON.stringify(prior.destination??null)&&result.primary.endTime===prior.endTime;
    result.input.lockedIds=priorLocks;result.primary.lockedIds=priorLocks;
    result.primary.inputFingerprint=plannerInputFingerprint(result.input);
    if(sameIntent){result.primary.id=prior.id;}
    memory.query=result.input;memory.plan=result.primary;outcome={...result,alternatives:[]};restored='refreshed';
    if(!sameIntent)memory=recordPlanDecision(memory,{planId:memory.plan.id,now:now()});
   }
  }catch(error){toast('저장 당시 계획을 열었어요. 현재 조건으로 만들기는 날짜와 조건을 확인해 주세요.');}
 }
 writeInput(memory.query);renderResult();persist();
 if(restored==='refreshed')beginExposure();
}
document.addEventListener('click',event=>{
 const target=event.target.closest('button,[data-map-place]');if(!target)return;
 if(!target.closest('#travel-account-panel')&&accountLocked()){if(target.dataset.action==='show-account')showAccount();return;}
 try{
  if(formDirty&&(target.dataset.lock||target.dataset.swap||target.dataset.replaceFrom||target.dataset.alternative!==undefined||target.dataset.refine||target.dataset.action==='accept-change')){toast('수정 중인 조건을 먼저 적용해 주세요.');return;}
  if(target.dataset.action==='add-companion'){editCompanions('add');return;}
  if(target.dataset.removeCompanion){editCompanions('remove',target.dataset.removeCompanion);return;}
  if(target.dataset.clearCompanionExtra){editCompanions('clear-extra',target.dataset.clearCompanionExtra);return;}
  if(target.matches('.dialog-close')){target.closest('dialog').close();return;}
  if(target.dataset.place){showPlace(target.dataset.place);return;}
  if(target.dataset.originPlace){const place=placeMap.get(target.dataset.originPlace);setOriginPoint(place.coordinates,place.name);return;}
  if(target.dataset.recovery!==undefined){applyRecovery(target.dataset.recovery);return;}
  if(target.dataset.mapPlace){showPlace(target.dataset.mapPlace);return;}
  if(target.dataset.intent){togglePick(target.dataset.intent);return;}
  if(target.dataset.step){showStep(Number(target.dataset.step));return;}
  if(target.dataset.hours){pickHours=Number(target.dataset.hours);applyChooser();renderTimeStep();return;}
  if(target.dataset.skipStop){showProgress(target.dataset.skipStop);return;}
  if(target.dataset.category){selectedCategory=target.dataset.category;$$('[data-category]').forEach(b=>{const selected=b===target;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',selected);});renderExplore();return;}
  if(target.dataset.lock){invalidatePreferencePreview();const id=target.dataset.lock,locks=memory.query.lockedIds;memory.query.lockedIds=locks.includes(id)?locks.filter(x=>x!==id):[...locks,id];memory.plan.lockedIds=[...memory.query.lockedIds];memory.plan.inputFingerprint=plannerInputFingerprint(memory.query);persist();renderResult();document.querySelector?.('[data-lock="'+id+'"]')?.focus();toast(memory.query.lockedIds.includes(id)?'다음 변경에서도 이곳을 유지할게요.':'유지 설정을 해제했어요.');return;}
  if(target.dataset.swap){if((memory.query.appointments??[]).some(row=>row.placeId===target.dataset.swap)){toast('시각을 고정한 장소예요. 여행 조건에서 예약·약속을 먼저 수정해 주세요.');return;}showSwap(target.dataset.swap);return;}
  if(target.dataset.replaceFrom){if(progressPlaceIds().includes(target.dataset.replaceTo)){toast('완료·건너뛴 곳은 진행 상황에서 먼저 정정해 주세요.');return;}const result=withoutQuestion(options=>replanTravel(memory.query,{...options,replace:{fromId:target.dataset.replaceFrom,toId:target.dataset.replaceTo}}),settings());$('#swap-dialog').close();previewChange(result,'장소를 바꾸고 전체 일정을 다시 맞췄어요.');return;}
  if(target.dataset.include){const id=target.dataset.include;if(progressPlaceIds().includes(id)){toast('완료·건너뛴 곳은 진행 상황에서 먼저 정정해 주세요.');return;}const input=readInput();input.lockedIds=[...new Set([...input.lockedIds,id])];input.excludedIds=input.excludedIds.filter(x=>x!==id);$('#place-dialog').close();if(memory.plan)previewChange(withoutQuestion(options=>planTravel(input,options),settings(input)),'선택한 장소를 포함한 여행안');else planThenAsk(input);return;}
  if(target.dataset.adjust){adjust(target.dataset.adjust);return;}
  if(target.dataset.alternative!==undefined){const p=outcome.alternatives[Number(target.dataset.alternative)];previewChange({...outcome,primary:p,alternatives:[memory.plan,...outcome.alternatives.filter(x=>x.id!==p.id)]},p.label);return;}
  if(target.dataset.refine){const input=structuredClone(memory.query);input.preferences[target.dataset.refine]=target.dataset.value==='true';previewChange(withoutQuestion(options=>planTravel(input,options),settings(input)),'답해주신 취향으로 다시 골랐어요.');return;}
  if(target.dataset.forgetPref){memory=removeTravelPreference(memory,target.dataset.forgetPref,{now:now()});invalidatePreferencePreview();persist();renderMemory();toast('이 취향을 다음 추천에서 빼었어요. 현재 일정은 유지해요.');return;}
  if(target.dataset.deleteVisit){memory=removeTravelVisit(memory,target.dataset.deleteVisit,{now:now()});invalidatePreferencePreview();persist();renderMemory();toast('방문 기록과 그 기록에서 확인한 취향을 지웠어요.');return;}
  if(target.dataset.editVisit){const visit=memory.visits.find(v=>v.id===target.dataset.editVisit);$('#memory-dialog').close();showPlace(visit.placeId);editingVisit=visit.id;$('#visit-rating').value=visit.rating;$$('[name=visit-reason]').forEach(c=>c.checked=visit.reasons.includes(c.value));$('#visit-form button').textContent='방문 경험 수정하기';return;}
  if(target.dataset.confirmPreference){memory=confirmTravelPreference(memory,{key:target.dataset.confirmPreference,value:target.dataset.value==='true',feedbackId:target.dataset.feedbackId,now:now()});invalidatePreferencePreview();persist();$('#preference-suggestions').innerHTML='<p class="warning-note">다음 추천에도 반영할 취향으로 확인했어요. 현재 장소의 객관적 특성으로 쓰지는 않아요.</p>';return;}
  switch(target.dataset.action){
   case 'show-account':showAccount();break;
   case 'choose-origin':showOriginPicker();break;
   case 'choose-destination':showOriginPicker('destination');break;
   case 'choose-progress-origin':showOriginPicker('progress');break;
   case 'accept-origin':acceptOrigin();break;
   case 'origin-coordinates':try{if($('#origin-lat').value===''||$('#origin-lon').value==='')throw Error('위도와 경도를 모두 입력해 주세요.');setOriginPoint({lat:Number($('#origin-lat').value),lon:Number($('#origin-lon').value)},$('#origin-name').value);}catch(error){$('#origin-error').textContent=error.message;$('#origin-error').hidden=false;}break;
   case 'open-progress':showProgress();break;
   case 'make-day':makeDay();break;
   case 'open-map':openMap();break;
   case 'back-to-chooser':clearRecovery();$('#empty-result').hidden=true;$('#before-result').hidden=false;showStep(picks.length?2:1);break;
   case 'finish-trip':finishTrip();break;
   case 'open-memory':showMemory();break;
   case 'accept-change':if(pending)acceptChange();break;
   case 'cancel-change':clearRecovery();pending=null;$('#plan-change').hidden=true;if(memory.progress?.finished)restorePlan();break;
   case 'previous-plan':clearRecovery();$('#empty-result').hidden=true;writeInput(memory.query);picksFromQuery(memory.query);formDirty=false;renderResult();pushView('result');$('#result-title').focus({preventScroll:true});break;
   case 'new-day':showChooser(1);break;
   case 'export-json':download(exportTravelMemory(memory),`SYNK-PATH-${memory.query.date}.json`,'application/json');break;
   case 'export-text':exportText();break;
   case 'import-json':$('#import-file').click();break;
   case 'new-trip':delete memory.progress;memory.query=defaultTravelQuery();memory.plan=null;outcome=null;pending=null;activeDecision=null;formDirty=false;exposureObserver?.disconnect();writeInput(memory.query);picksFromQuery(memory.query);foodByHand=false;handWhen=null;restorePlan();persist();$('#memory-dialog').close();$('#step-time').hidden=true;$('#step-intent').hidden=false;$('#before-result').scrollIntoView({behavior:'smooth',block:'start'});toast('방문 기록과 확인한 평소 취향은 이어 가요. 새 하루를 골라 주세요.');break;
   case 'clear-history':memory=clearTravelHistory(memory,{now:now()});activeDecision=null;invalidatePreferencePreview();persist();renderMemory();toast('방문 기록과 평소 취향을 지웠어요. 여행 계획은 유지해요.');break;
   case 'reset-all':if(!accountSession?.active)clearTravelMemory();memory=createTravelMemory();persist();clearRecovery();outcome=null;pending=null;formDirty=false;$('#plan-change').hidden=true;activeDecision=null;editingVisit=null;exposureObserver?.disconnect();resetOriginChoices();writeInput(memory.query);picksFromQuery(memory.query);foodByHand=false;handWhen=null;document.body.classList.remove('has-plan');$('#result').hidden=true;$('#empty-result').hidden=true;$('#before-result').hidden=false;$('#step-time').hidden=true;$('#step-intent').hidden=false;renderProgressSummary();renderMemory();toast(accountSession?.active?'현재 계정에 빈 여행을 저장해요. 로그인 전 기록은 유지했어요.':'이 브라우저의 새 여행 기록을 초기화했어요.');break;
  }
 }catch(error){toast(error.message);}
});
document.addEventListener('keydown',event=>{if(event.target.matches('[data-map-place]')&&['Enter',' '].includes(event.key)){event.preventDefault();showPlace(event.target.dataset.mapPlace);}});
document.addEventListener('click',event=>{const map=event.target.closest('#origin-map');if(!map||!network)return;const rect=map.querySelector('svg').getBoundingClientRect();setOriginPoint(originPoint(Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))));});
document.addEventListener('keydown',event=>{if(event.target.id!=='origin-map'||!network||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const p=originDraft?originPosition(originDraft):{x:.5,y:.5},step=event.shiftKey?.02:.005;if(event.key==='ArrowLeft')p.x-=step;if(event.key==='ArrowRight')p.x+=step;if(event.key==='ArrowUp')p.y-=step;if(event.key==='ArrowDown')p.y+=step;setOriginPoint(originPoint(Math.max(0,Math.min(1,p.x)),Math.max(0,Math.min(1,p.y))));});
document.addEventListener('input',event=>{if(event.target.closest('#progress-form'))clearRecovery();if(event.target.id==='origin-search')renderOriginMatches();if(['origin-lat','origin-lon'].includes(event.target.id))$('#origin-confirm').disabled=true;});
document.addEventListener('submit',event=>{
 if(accountLocked()){event.preventDefault();return;}
 if(event.target.id==='trip-form'){generate(event);return;}
 if(event.target.id==='progress-form'){previewRemaining(event);return;}
 event.preventDefault();try{
  if(event.target.id==='visit-form'){
   const data={placeId:event.target.dataset.placeId,rating:Number($('#visit-rating').value),reasons:$$('[name=visit-reason]:checked').map(c=>c.value),now:now()};
   const linked=memory.query.date<=defaultTravelQuery().date&&memory.plan?.stops.some(s=>s.placeId===data.placeId)&&memory.journal.exposures.some(x=>x.decisionId===activeDecision);
   if(linked){data.planId=memory.plan.id;data.decisionId=activeDecision;}
   const editedId=editingVisit;memory=editedId?editTravelVisit(memory,editedId,data):recordVisit(memory,data);editingVisit=null;if(editedId)invalidatePreferencePreview();persist();const visit=memory.visits.at(-1),ideas=proposeVisitPreference(visit);
   $('#preference-suggestions').innerHTML=`<p class="warning-note">방문 경험을 남겼어요.${memory.consent?'':' 새로고침 후에도 보려면 내 여행에서 보관을 선택해 주세요.'}</p>${ideas.map(idea=>`<div class="change-preview"><p>${e(idea.label)}</p><button class="button secondary" data-confirm-preference="${e(idea.key)}" data-value="${idea.value}" data-feedback-id="${e(idea.feedbackId)}">네, 다음에도 반영해 주세요</button><p class="micro">답하지 않으면 평소 취향으로 저장하지 않아요.</p></div>`).join('')}`;
  }
  if(event.target.id==='preference-form'){memory=confirmTravelPreference(memory,{key:$('#preference-key').value,value:$('#preference-value').value==='true',now:now()});invalidatePreferencePreview();persist();renderMemory();toast('다음 여행에도 쓸 취향으로 확인했어요.');}
  if(event.target.id==='trip-rating-form'){memory=recordTripOutcome(memory,{decisionId:activeDecision,rating:Number($('#trip-rating').value),now:now()});persist();renderMemory();toast('여행 전체의 경험을 남겼어요.');}
 }catch(error){toast(error.message);}
});
document.addEventListener('change',event=>{
 if(accountLocked())return;
 if(event.target.id==='meal-mode')syncScheduleFields();if(event.target.id==='progress-meal-mode')syncScheduleFields('progress-');
 if(event.target.matches('[name=preference],[name=avoid]')&&event.target.checked){const other=event.target.name==='preference'?'avoid':'preference';for(const input of $$('[name='+other+']'))if(input.value===event.target.value)input.checked=false;}
 if(event.target.closest('#trip-form')&&(event.target.matches('[name=preference],[name=avoid]')||event.target.dataset.taste))picksFromForm(event.target);
 try{if(event.target.id==='save-consent'){if(accountSession?.active){renderMemory();return;}memory=setTravelConsent(memory,event.target.checked);if(memory.consent)persist();else clearTravelMemory();toast(memory.consent?'이 브라우저에 보관했어요.':'이 기기의 저장본을 지웠어요. 현재 화면은 유지돼요.');}
 if(event.target.id==='import-file')importFile(event.target.files[0]);}catch(error){toast(error.message);}
});
$('#trip-form').addEventListener('input',event=>{if(['adults','children'].includes(event.target.id))updateCompanionCount();updateCompanionLabel(event.target);clearRecovery();formDirty=true;pending=null;$('#plan-change').hidden=true;$('#form-error').hidden=true;});
$('#place-search').addEventListener('input',renderExplore);
for(const id of ['memory-open','save-open','review-open'])$('#'+id).addEventListener('click',showMemory);
$('#map-zoom-in').addEventListener('click',()=>animateZoom(Math.min(3,mapZoom*1.3)));
$('#map-zoom-out').addEventListener('click',()=>animateZoom(Math.max(.7,mapZoom/1.3)));
window.addEventListener('storage',event=>{if(event.key===TRAVEL_STORAGE_KEY||event.key===null){if(accountSession?.active){accountSession.invalidateGuestConsent();return;}memory.consent=false;toast('다른 탭에서 저장본이 바뀌었어요. 현재 작업은 유지하고 자동 저장을 멈췄어요.');if($('#memory-dialog').open)renderMemory();}});
window.addEventListener('pagehide',()=>accountSession?.suspend());
window.addEventListener('popstate',event=>{
 const view=event.state?.pathView;if(!view||accountLocked())return;
 closeTravelDialogs();
 // 여행 중이거나 마친 여행에는 새 하루 고르기가 없어 결과에 머문다.
 if(view==='result'||memory.progress){
  if(view!=='result')history.replaceState({pathView:'result'},'');
  if(memory.plan){clearRecovery();writeInput(memory.query);picksFromQuery(memory.query);renderResult();$('#result-title').focus({preventScroll:true});$('#result').scrollIntoView({behavior:'instant',block:'start'});}
  return;
 }
 if($('#before-result').hidden){showChooser(view==='time'?2:1,{push:false});return;}
 showStep(view==='time'?2:1,{push:false});
});
$('#require-food').addEventListener('change',()=>{foodByHand=true;});
// 고르기 시간은 사용자가 폼에서 직접 고친 날짜·출발 시각을 따른다(고르기가 써 넣은 값은 세지 않는다).
for(const id of ['trip-date','start-time'])$('#'+id).addEventListener('change',()=>{handWhen={date:$('#trip-date').value,start:$('#start-time').value};});
window.addEventListener('pageshow',event=>{if(event.persisted)void accountSession?.resume();});
window.addEventListener('resize',()=>{if(!memory.plan)return;if($('#map-dialog').open)renderMap();if(!$('#result').hidden)renderMapThumb(memory.plan);});
// 출발지를 바꾸고 돌아오면 시간 고르기의 「어디에서 출발」 문구도 새로 쓴다.
$('#origin-dialog').addEventListener('close',()=>{if(!$('#before-result').hidden&&!$('#step-time').hidden){applyChooser();renderTimeStep();}});
// 건너뛰기 링크는 지금 보이는 첫 제목(고르기·결과·결과 없음)으로 간다.
$('.skip').addEventListener('click',event=>{const target=['#result-title','#empty-title','#time-title','#chooser-title'].map(selector=>$(selector)).find(el=>el?.offsetParent);if(!target)return;event.preventDefault();target.focus();target.scrollIntoView({block:'start'});});
// 휴대폰의 「지도로 보기」는 아래로 읽어 내려갈 때 비켜 주고, 위로 올라오면 다시 나온다.
let lastScroll=scrollY;
window.addEventListener('scroll',()=>{const y=scrollY;if(Math.abs(y-lastScroll)<12)return;$('.map-fab')?.classList.toggle('is-away',y>lastScroll&&y>200);lastScroll=y;},{passive:true});
window.addEventListener('beforeunload',event=>{if(formDirty){event.preventDefault();event.returnValue='';}});
try{const saved=loadTravelMemory();if(saved){memory=saved;restored=true;}}catch(error){toast(error.message);}
writeInput(memory.query);renderExplore();picksFromQuery(memory.query);
handWhen=memory.query.date>koreanDate(new Date().toISOString())?{date:memory.query.date,start:memory.query.startTime}:null;
$('#hero-place-count').textContent='가입 없이 시작 · 서울 종로의 실제 장소 '+TRAVEL_PLACES.filter(p=>p.dayPlannerEligible!==false).length+'곳';
$('#photo-credit-list').innerHTML=TRAVEL_PLACES.filter(p=>p.photo).map(p=>`<p class="photo-credit"><strong>${e(p.name)}</strong> · ${credit(p)}</p>`).join('');
try{const response=await fetch('./assets/jongno-walking.json');if(!response.ok)throw Error('map unavailable');network=await response.json();routeLeg=createWalkingRouter(network);$('#load-status').textContent='실제 장소 '+TRAVEL_PLACES.length+'곳 · 지도 기반 예상 이동으로 비교해요.';}
catch(error){$('#load-status').textContent='지도를 불러오지 못했어요. 위치 기반 추정으로 비교하며 실제 경로는 따로 확인해 주세요.';}
mapLoaded();
// 질문 워커는 지도를 받은 뒤에 미리 띄운다. 같은 지도 파일을 두 번 동시에 받지 않고, 첫 하루 만들기의 질문이 워커 준비를 기다리지 않는다.
startQuestionWorker();
history.replaceState({pathView:memory.plan?'result':'intent'},'');
// Startup must leave saved bytes untouched until the OAuth handoff is read.
// Stored estimates remain a snapshot until an explicit planning action.
restorePlan({snapshot:true});
await connectTravelAccount();
