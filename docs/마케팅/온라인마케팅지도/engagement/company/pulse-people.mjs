// PULSE 「인플루언서 광고」 창의 채널 명단(조각 ①, 2026-11-21). 설계는 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절이다.
// 대표(관리자)가 직원 화면 「채널 명단」에서 칸을 넣고 고치고 빼며, 스위치 people(pulse-features.mjs)로 손님에게 보일지 정한다.
// 저장은 범용 표 documents의 종류 하나(pulsePeopleRoster, id main)다. 프로젝트 문서는 건드리지 않는다.
// 이 저장소는 공개라 실제 채널의 이름 · 주소 · 값은 여기 두지 않는다 — 운영 문서에만 있다. 여기 기본값은 SYNK 캐스팅북의 가상 인물(예시 칸)뿐이다.
// 그림은 캐스팅북 정적 그림(이미 공개된 파일)만 받는다. 바깥 그림 주소와 올리기는 조각 ③에서 따로 짓는다(설계 검토 P1-1 · P1-2).
// 손님에게는 켜짐이고 예시가 아닌 칸만 보인다. 그런 칸이 없으면 스위치가 켜져 있어도 창이 없다(설계 검토 물음 3).
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';

export const PULSE_PEOPLE_KIND='pulsePeopleRoster';
const ID='main';
export const PEOPLE_TOPICS=Object.freeze(['food','beauty','fitness','home','daily','outdoor','fashion','tech','pet','kids']);
export const PEOPLE_PLATFORMS=Object.freeze(['instagram','youtube','tiktok','blog']);
export const PEOPLE_LIMITS=Object.freeze({entries:60,samples:3,topics:3});
const CHANNEL_ID=/^ch_[a-z0-9]{4,16}$/;
const URL_MAX=1000;
// 막는 문자: 제어 문자(줄바꿈 · 탭 포함), C1 제어 문자, 줄 · 문단 구분자, 방향 덮어쓰기(pulse-marketing.mjs와 같다).
const BLOCKED=new RegExp('['+[[0x00,0x1f],[0x7f,0x9f],[0x2028,0x2029],[0x202a,0x202e],[0x2066,0x2069]].map(([from,to])=>String.fromCharCode(from)+'-'+String.fromCharCode(to)).join('')+']');
const FIELDS=['id','name','platform','handle','url','topics','audience','followers','avgViews','prices','image','samples','virtual','example','active'];

// 캐스팅북 그림(대표 사진 · 전신 · 옷 두 벌 · 장면). 가상 인물 칸만 쓴다(실제 채널이 AI 얼굴로 나가지 않게 — 설계 검토 P2).
export const CASTING_IMAGES=Object.freeze(CASTING_MODELS.map(model=>({model:model.id,name:model.name,images:[model.image,...(model.photos||[]).map(photo=>photo.src)]})));
const CASTING_SET=new Set(CASTING_IMAGES.flatMap(item=>item.images));
const CASTING_PATH=/^\.\/assets\/casting\/(?:photos\/)?[a-z0-9-]+\.webp$/;
export const castingImage=src=>typeof src==='string'&&CASTING_SET.has(src);

// 처음 명단: 캐스팅북 모델 여섯(창업자 기반 M03은 넣지 않는다). 모두 예시 · 가상 인물이고 숫자와 값은 비운다.
const SEED=[['F02',['food','daily'],'카페 · 디저트를 즐기는 20대'],['F01',['beauty'],'메이크업 · 스킨케어에 관심 있는 20~30대'],['F07',['fitness','daily'],'러닝 · 홈트를 하는 20~30대'],
  ['F05',['home','food'],'집밥 · 살림을 챙기는 30대'],['M04',['daily'],'자취 · 사회초년생 일상을 보는 20대'],['M05',['outdoor'],'캠핑 · 주말 나들이를 즐기는 30대']];
export const PEOPLE_SEED=Object.freeze(SEED.map(([code,topics,audience])=>{
  const model=CASTING_MODELS.find(item=>item.id===code),photo=kind=>(model.photos||[]).filter(item=>item.kind===kind).map(item=>item.src);
  return Object.freeze({id:'ch_seed'+code.toLowerCase(),name:model.name,platform:'instagram',handle:'',url:'',topics:Object.freeze(topics),audience,followers:null,avgViews:null,prices:Object.freeze({post:null,review:null}),
    image:model.image,samples:Object.freeze([...photo('scene'),...photo('look')].slice(0,PEOPLE_LIMITS.samples)),virtual:true,example:true,active:true});
}));

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
// 「을 · 를」은 앞 낱말의 받침으로 고른다(id는 「아이디」로 읽어 「를」).
const eul=word=>{const c=word.charCodeAt(word.length-1);return c>=0xac00&&c<=0xd7a3?((c-0xac00)%28?'을':'를'):'를';};
const bad=(at,what)=>Object.assign(new Error(`${at}번째 칸의 ${what}${eul(what)} 확인해 주세요.`),{status:400});
const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function text(value,at,what,max,empty=true){
  if(typeof value!=='string'||BLOCKED.test(value)||!value.isWellFormed())throw bad(at,what);
  const out=value.trim(),size=[...out].length;
  if(size>max||!empty&&!size)throw bad(at,what);
  return out;
}
const count=(value,at,what,max)=>{if(value===null||value===undefined||value==='')return null;if(!Number.isSafeInteger(value)||value<0||value>max)throw bad(at,what);return value;};
function channelUrl(value,at){
  // 길이는 저장할 꼴(parsed.href — 한글은 퍼센트 인코딩으로 길어진다)로 잰다. 저장한 주소를 다시 읽을 때도 이 검사를 그대로 지난다(카본 A1).
  const out=text(value,at,'채널 주소',2000);if(!out)return '';
  let parsed;try{parsed=new URL(out);}catch{throw bad(at,'채널 주소');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||!parsed.hostname.includes('.')||parsed.href.length>URL_MAX)throw bad(at,'채널 주소');
  return parsed.href;
}
// 칸 하나. 아는 칸만 받고(모르는 칸 400), id가 비면 새 칸이라 서버가 만든다.
// stored: 저장된 문서를 읽을 때다. 그림은 지금 목록에 있거나 캐스팅북 그림 꼴(CASTING_PATH)이면 꼴 · 개수 · 겹침 검사를 원래 배열 그대로 지나고,
// 목록에서 빠진 그림만 돌려줄 때 비운다 — 그림 하나 때문에 명단 전체가 깨지지 않게, 그러면서 꼴이 틀린 문서는 고쳐 읽지 않게(Fable F5 · GPT 다시 검수 GA1).
function entry(value,at,newId,stored=false){
  if(!isObject(value)||Object.keys(value).some(key=>!FIELDS.includes(key)))throw bad(at,'꼴');
  const id=value.id===undefined||value.id===''?newId():value.id;
  if(typeof id!=='string'||!CHANNEL_ID.test(id))throw bad(at,'id');
  const name=text(value.name,at,'이름',40,false);
  if(!PEOPLE_PLATFORMS.includes(value.platform))throw bad(at,'플랫폼');
  const handle=text(value.handle??'',at,'계정 이름',60),url=channelUrl(value.url??'',at),audience=text(value.audience??'',at,'보는 사람 한 줄',80);
  const topics=value.topics;
  if(!Array.isArray(topics)||!topics.length||topics.length>PEOPLE_LIMITS.topics||new Set(topics).size!==topics.length||topics.some(topic=>!PEOPLE_TOPICS.includes(topic)))throw bad(at,'주제');
  for(const key of ['virtual','example','active'])if(typeof value[key]!=='boolean')throw bad(at,key==='virtual'?'가상 인물 표시':key==='example'?'예시 표시':'켜짐');
  const prices=value.prices??{post:null,review:null};
  if(!isObject(prices)||Object.keys(prices).some(key=>!['post','review'].includes(key)))throw bad(at,'값');
  const image=value.image??'',samples=value.samples??[],known=stored?src=>castingImage(src)||typeof src==='string'&&CASTING_PATH.test(src):castingImage;
  if(image!==''&&!known(image))throw bad(at,'대표 그림');
  if(!Array.isArray(samples)||samples.length>PEOPLE_LIMITS.samples||samples.some(src=>!known(src))||new Set(samples).size!==samples.length)throw bad(at,'장면 그림');
  // 실제 채널(가상 인물 아님)에는 캐스팅북 얼굴을 쓰지 않는다. 예시가 아닌 칸은 손님이 열어 볼 채널 주소가 있어야 한다(설계 검토 P2).
  if(!value.virtual&&(image||samples.length))throw Object.assign(new Error(`${at}번째 칸은 실제 채널이라 캐스팅북 그림을 쓸 수 없어요. 그림을 비워 주세요.`),{status:400});
  if(!value.example&&!url)throw Object.assign(new Error(`${at}번째 칸은 손님에게 보이는 채널이라 채널 주소(https)가 있어야 해요.`),{status:400});
  return {id,name,platform:value.platform,handle,url,topics:[...topics],audience,
    followers:count(value.followers,at,'팔로워 수',10_000_000_000),avgViews:count(value.avgViews,at,'평균 조회 수',10_000_000_000),
    prices:{post:count(prices.post,at,'게시 값',1_000_000_000),review:count(prices.review,at,'후기 값',1_000_000_000)},
    image:castingImage(image)?image:'',samples:samples.filter(castingImage),virtual:value.virtual,example:value.example,active:value.active};
}
// 저장된 문서를 읽을 때: 꼴이 틀리면 깨진 것으로 본다(읽기는 빈 명단, 쓰기는 409 — 덮어써서 남은 칸을 잃지 않게).
function readDoc(doc){
  if(doc==null)return {version:0,entries:PEOPLE_SEED.map(item=>structuredClone(item)),seed:true,broken:false};
  try{
    if(!isObject(doc)||!Number.isSafeInteger(doc.version)||doc.version<1||!Array.isArray(doc.entries)||doc.entries.length>PEOPLE_LIMITS.entries)throw new Error('broken');
    const entries=doc.entries.map((item,i)=>entry(item,i+1,()=>{throw new Error('broken');},true));
    if(new Set(entries.map(item=>item.id)).size!==entries.length)throw new Error('broken');
    return {version:doc.version,entries,seed:false,broken:false,updatedAt:doc.updatedAt||null,updatedBy:doc.updatedBy||null};
  }catch{return {version:doc?.version??0,entries:[],seed:false,broken:true};}
}
// 손님에게 보이는 칸: 켜짐 · 예시 아님. 손님용 칸만 싣는다.
const customerEntry=item=>({id:item.id,name:item.name,platform:item.platform,handle:item.handle,url:item.url,topics:[...item.topics],audience:item.audience,followers:item.followers,avgViews:item.avgViews,prices:{...item.prices},image:item.image,samples:[...item.samples],virtual:item.virtual});

export function createPulsePeople({store,clientProjects,features,clock=()=>new Date().toISOString(),randomId=()=>Math.random().toString(36).slice(2,10)}){
  if(!store||!clientProjects||!features)throw new TypeError('채널 명단 설정이 이상해요.');
  const current=()=>readDoc(store.get(PULSE_PEOPLE_KIND,ID));
  const enabled=()=>features.read().people===true;
  const selectable=()=>current().entries.filter(item=>item.active&&!item.example);
  // 손님 방 자료의 features.people: 스위치가 켜졌고 고를 수 있는 칸이 하나 이상일 때만 참이다.
  const visible=()=>enabled()&&selectable().length>0;
  const admin=user=>{const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);if(live.role!=='admin')throw fail('관리자만 채널 명단을 볼 수 있어요.',403);return live;};
  function adminView(user){
    admin(user);const doc=current();
    return {version:doc.version,entries:doc.entries,seed:doc.seed,broken:doc.broken,updatedAt:doc.updatedAt||null,updatedBy:doc.updatedBy||null,enabled:enabled(),visible:visible(),
      topics:PEOPLE_TOPICS,platforms:PEOPLE_PLATFORMS,limits:PEOPLE_LIMITS,casting:CASTING_IMAGES};
  }
  // 통째 저장. 판 번호가 지금 것과 같아야 한다(다른 탭이 먼저 저장했으면 409). 깨진 문서는 덮지 않는다.
  function save(user,input){
    const live=admin(user);
    if(!isObject(input)||Object.keys(input).some(key=>!['version','entries'].includes(key)))throw fail('저장할 명단을 확인해 주세요.');
    const doc=current();
    if(doc.broken)throw fail('저장된 채널 명단 문서를 읽지 못해 저장을 멈췄어요. 개발 담당에게 알려 주세요.',409);
    if(input.version!==doc.version)throw fail('다른 화면에서 명단이 바뀌었어요. 새로 불러온 뒤 다시 저장해 주세요.',409);
    if(!Array.isArray(input.entries)||input.entries.length>PEOPLE_LIMITS.entries)throw fail(`채널은 ${PEOPLE_LIMITS.entries}개까지 둘 수 있어요.`);
    const used=new Set(input.entries.map(item=>isObject(item)&&typeof item.id==='string'?item.id:'').filter(Boolean));
    const newId=()=>{for(let i=0;i<20;i++){const id='ch_'+String(randomId()).toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,12);if(CHANNEL_ID.test(id)&&!used.has(id)){used.add(id);return id;}}throw fail('새 칸의 id를 만들지 못했어요. 다시 저장해 주세요.',500);};
    const entries=input.entries.map((item,i)=>entry(item,i+1,newId));
    if(new Set(entries.map(item=>item.id)).size!==entries.length)throw fail('같은 id의 칸이 둘 있어요. 새로 불러온 뒤 다시 저장해 주세요.');
    const next={version:doc.version+1,entries,updatedAt:clock(),updatedBy:live.id};
    store.put(PULSE_PEOPLE_KIND,ID,next);
    return adminView(user);
  }
  // 손님 경로. 프로젝트는 초대 세션에서만 정한다. 스위치가 꺼졌거나 고를 칸이 없으면 없는 주소다. 오류 문장은 영어 사전에 이미 있는 것만 쓴다.
  function customerList(token,search=''){
    if(!visible())throw fail('고객 요청을 찾을 수 없습니다.',404);
    if(search)throw fail('주소를 확인해 주세요.');
    clientProjects.session(token);
    return {entries:selectable().map(customerEntry)};
  }
  return {visible,adminView,save,customerList,read:()=>current()};
}
