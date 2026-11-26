// PULSE 「인플루언서 광고」 창의 채널 명단(조각 ①, 2026-11-21). 설계는 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절이다.
// 대표(관리자)가 직원 화면 「채널 명단」에서 칸을 넣고 고치고 빼며, 스위치 people(pulse-features.mjs)로 손님에게 보일지 정한다.
// 저장은 범용 표 documents의 종류 하나(pulsePeopleRoster, id main)다. 프로젝트 문서는 건드리지 않는다.
// 이 저장소는 공개라 실제 채널의 이름 · 주소 · 값은 여기 두지 않는다 — 운영 문서에만 있다. 여기 기본값은 SYNK 캐스팅북의 가상 인물(예시 칸)뿐이다.
// 그림은 캐스팅북 정적 그림(이미 공개된 파일 — 가상 인물 칸만)과 대표가 올린 그림(조각 ③ · pulse-people-media.mjs, 「media:<id>」)이다. 바깥 그림 주소는 받지 않는다(설계 검토 P1-1 · P1-2).
// 손님에게는 켜짐이고 예시가 아닌 칸만 보인다. 그런 칸이 없으면 스위치가 켜져 있어도 창이 없다(설계 검토 물음 3).
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';
import {PEOPLE_MEDIA_KIND,PEOPLE_MEDIA_LIMITS,PEOPLE_MEDIA_WRITES,PEOPLE_MEDIA_DELETE_FILES,mediaIdOf} from './pulse-people-media.mjs';
import {openPeopleRequests} from './pulse-people-requests.mjs';

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
// 올린 그림(media:<id>)은 그 그림 문서가 있을 때만 받는다(hasMedia). 저장된 문서를 읽을 때는 꼴만 보고, 문서가 사라진 그림은 그 칸의 그림만 비운다.
// stored: 저장된 문서를 읽을 때다. 그림은 지금 목록에 있거나 캐스팅북 그림 꼴(CASTING_PATH)이면 꼴 · 개수 · 겹침 검사를 원래 배열 그대로 지나고,
// 목록에서 빠진 그림만 돌려줄 때 비운다 — 그림 하나 때문에 명단 전체가 깨지지 않게, 그러면서 꼴이 틀린 문서는 고쳐 읽지 않게(Fable F5 · GPT 다시 검수 GA1).
function entry(value,at,newId,stored=false,hasMedia=()=>false){
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
  const image=value.image??'',samples=value.samples??[],uploaded=src=>{const id=mediaIdOf(src);return !!id&&(stored||hasMedia(id));},known=stored?src=>castingImage(src)||typeof src==='string'&&CASTING_PATH.test(src)||uploaded(src):src=>castingImage(src)||uploaded(src);
  if(image!==''&&!known(image))throw bad(at,'대표 그림');
  if(!Array.isArray(samples)||samples.length>PEOPLE_LIMITS.samples||samples.some(src=>!known(src))||new Set(samples).size!==samples.length)throw bad(at,'장면 그림');
  // 실제 채널(가상 인물 아님)에는 캐스팅북 얼굴을 쓰지 않는다. 예시가 아닌 칸은 손님이 열어 볼 채널 주소가 있어야 한다(설계 검토 P2).
  const casting=src=>!!src&&!mediaIdOf(src);
  if(!value.virtual&&(casting(image)||samples.some(casting)))throw Object.assign(new Error(`${at}번째 칸은 실제 채널이라 캐스팅북 그림을 쓸 수 없어요. 올린 그림을 쓰거나 그림을 비워 주세요.`),{status:400});
  if(!value.example&&!url)throw Object.assign(new Error(`${at}번째 칸은 손님에게 보이는 채널이라 채널 주소(https)가 있어야 해요.`),{status:400});
  return {id,name,platform:value.platform,handle,url,topics:[...topics],audience,
    followers:count(value.followers,at,'팔로워 수',10_000_000_000),avgViews:count(value.avgViews,at,'평균 조회 수',10_000_000_000),
    prices:{post:count(prices.post,at,'게시 값',1_000_000_000),review:count(prices.review,at,'후기 값',1_000_000_000)},
    image:castingImage(image)||mediaIdOf(image)&&hasMedia(mediaIdOf(image))?image:'',samples:samples.filter(src=>castingImage(src)||mediaIdOf(src)&&hasMedia(mediaIdOf(src))),virtual:value.virtual,example:value.example,active:value.active};
}
// 저장된 문서를 읽을 때: 꼴이 틀리면 깨진 것으로 본다(읽기는 빈 명단, 쓰기는 409 — 덮어써서 남은 칸을 잃지 않게).
function readDoc(doc,hasMedia=()=>false){
  if(doc==null)return {version:0,entries:PEOPLE_SEED.map(item=>structuredClone(item)),seed:true,broken:false};
  try{
    if(!isObject(doc)||!Number.isSafeInteger(doc.version)||doc.version<1||!Array.isArray(doc.entries)||doc.entries.length>PEOPLE_LIMITS.entries)throw new Error('broken');
    const entries=doc.entries.map((item,i)=>entry(item,i+1,()=>{throw new Error('broken');},true,hasMedia));
    if(new Set(entries.map(item=>item.id)).size!==entries.length)throw new Error('broken');
    return {version:doc.version,entries,seed:false,broken:false,updatedAt:doc.updatedAt||null,updatedBy:doc.updatedBy||null};
  }catch{return {version:doc?.version??0,entries:[],seed:false,broken:true};}
}
// 손님에게 보이는 칸: 켜짐 · 예시 아님. 손님용 칸만 싣는다.
// 올린 그림은 손님 그림 경로로 바꿔 싣는다(공개 주소가 아니다 — 손님 세션 · 스위치 · 켜진 칸을 요청마다 본다).
const customerSrc=src=>{const id=mediaIdOf(src);return id?`/pulse/api/people/media/${id}`:src;};
const customerEntry=item=>({id:item.id,name:item.name,platform:item.platform,handle:item.handle,url:item.url,topics:[...item.topics],audience:item.audience,followers:item.followers,avgViews:item.avgViews,prices:{...item.prices},image:customerSrc(item.image),samples:item.samples.map(customerSrc),virtual:item.virtual});

// mediaWrites: 명단 그림 쓰기(조각 ③)를 열었는지. 기본은 pulse-people-media.mjs의 PEOPLE_MEDIA_WRITES(읽기 먼저 · 쓰기는 다음 판 — GPT 검수 GA1).
// steady: 지우는 중인 그림의 나이를 재는 단조 시계(밀리초). 시험이 가짜를 준다.
export function createPulsePeople({store,clientProjects,features,clock=()=>new Date().toISOString(),randomId=()=>Math.random().toString(36).slice(2,10),mediaWrites=PEOPLE_MEDIA_WRITES,steady=()=>performance.now()}){
  if(!store||!clientProjects||!features)throw new TypeError('채널 명단 설정이 이상해요.');
  let accountedAt=steady();
  // 지우는 중(gone — 파일을 지운 뒤 문서를 뗀다)인 그림은 없는 것으로 친다.
  const mediaDoc=id=>{const doc=typeof id==='string'?store.get(PEOPLE_MEDIA_KIND,id):null;return doc&&!doc.gone?doc:null;};
  const mediaDocs=()=>(store.all?.(PEOPLE_MEDIA_KIND)||[]).filter(item=>item&&typeof item.id==='string');
  const current=()=>readDoc(store.get(PULSE_PEOPLE_KIND,ID),id=>!!mediaDoc(id));
  const tx=fn=>typeof store.transaction==='function'?store.transaction(fn):fn();
  const enabled=()=>features.read().people===true;
  const selectable=()=>current().entries.filter(item=>item.active&&!item.example);
  // 손님 방 자료의 features.people: 스위치가 켜졌고 고를 수 있는 칸이 하나 이상일 때만 참이다.
  const visible=()=>enabled()&&selectable().length>0;
  const admin=user=>{const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);if(live.role!=='admin')throw fail('관리자만 채널 명단을 볼 수 있어요.',403);return live;};
  function adminView(user){
    admin(user);const doc=current();
    return {version:doc.version,entries:doc.entries,seed:doc.seed,broken:doc.broken,updatedAt:doc.updatedAt||null,updatedBy:doc.updatedBy||null,enabled:enabled(),visible:visible(),
      topics:PEOPLE_TOPICS,platforms:PEOPLE_PLATFORMS,limits:PEOPLE_LIMITS,casting:CASTING_IMAGES,
      // 올린 그림(조각 ③): 최근 것부터. 대표 화면이 그림 고르기에 쓰고, 직원 그림 경로로 그린다.
      mediaOpen:mediaWrites===true,
      // 쓰기를 열기 전에는 지금 명단이 가리키는 그림만 고르기에 싣는다(되돌린 판에서 저장이 400으로 막힐 그림을 내놓지 않게 — GPT 다시 검수 GA2).
      uploads:mediaDocs().filter(item=>!item.gone&&(mediaWrites===true||doc.entries.some(entry=>entry.image===`media:${item.id}`||entry.samples.includes(`media:${item.id}`)))).sort((a,b)=>String(b.at).localeCompare(String(a.at))).map(item=>({ref:`media:${item.id}`,url:`/api/pulse-people/media/${item.id}`,at:item.at||null}))};
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
    // 쓰기를 열기 전에는 새 그림을 받지 않고, 지금 명단에 이미 있는 그림만 그대로 다시 저장할 수 있다(뒤 판에서 되돌렸을 때도 명단을 고칠 수 있게).
    const kept=new Set(doc.entries.flatMap(item=>[item.image,...item.samples]).map(mediaIdOf).filter(Boolean));
    const entries=input.entries.map((item,i)=>entry(item,i+1,newId,false,id=>!!mediaDoc(id)&&(mediaWrites===true||kept.has(id))));
    if(new Set(entries.map(item=>item.id)).size!==entries.length)throw fail('같은 id의 칸이 둘 있어요. 새로 불러온 뒤 다시 저장해 주세요.');
    // 진행 중인 의뢰가 있는 칸은 지울 수 없고, 채널 주소(# 뒤 제외)와 플랫폼도 바꿀 수 없다. 「켜 둠」을 끄면 새 의뢰만 막힌다.
    // 의뢰는 보낼 때 채널을 복사해 두므로 지우거나 고쳐 써도 깨지지는 않지만, 진행 중인 광고의 칸이 다른 채널을 가리키면 그 칸의 진행 건수가 엉뚱한 채널에 붙는다(GPT 검수 GA2 · GA3).
    // 저장된 주소와 글자 그대로 견준다 — 같은 채널을 주소 꼴로 알아보는 추측은 두지 않는다(설계 9절 「같은 채널」). 이름 · 값 · 그림 · 계정 이름 · 「켜 둠」은 고칠 수 있다.
    const after=new Map(entries.map(item=>[item.id,item])),bare=url=>String(url||'').split('#')[0];
    const touched=doc.entries.filter(item=>{const next=after.get(item.id);return !next||next.platform!==item.platform||bare(next.url)!==bare(item.url);});
    if(touched.length){
      const busy=new Map();for(const row of store.all?.('clientProjects')||[])if(row?.stage!=='archived')for(const request of openPeopleRequests(row.studio))busy.set(request.channel?.id,(busy.get(request.channel?.id)||0)+1);
      const stuck=touched.find(item=>busy.has(item.id));
      if(stuck&&!after.has(stuck.id))throw fail(`「${stuck.name}」 칸은 진행 중인 의뢰 ${busy.get(stuck.id)}건이 있어 지울 수 없어요. 손님에게 더 보이지 않게 하려면 「켜 둠」을 꺼 주세요.`,409);
      if(stuck)throw fail(`「${stuck.name}」 칸은 진행 중인 의뢰 ${busy.get(stuck.id)}건이 있어 채널 주소와 플랫폼을 바꿀 수 없어요. 고쳐야 하면 이 칸의 「켜 둠」을 끄고 새 칸으로 넣어 주세요. 이 칸은 의뢰가 끝난 뒤 지울 수 있어요.`,409);
    }
    const next={version:doc.version+1,entries,updatedAt:clock(),updatedBy:live.id};
    return tx(()=>{store.put(PULSE_PEOPLE_KIND,ID,next);const removed=sweep();return {...adminView(user),removed};});
  }
  // 손님 경로. 프로젝트는 초대 세션에서만 정한다. 스위치가 꺼졌거나 고를 칸이 없으면 없는 주소다. 오류 문장은 영어 사전에 이미 있는 것만 쓴다.
  function customerList(token,search=''){
    if(!visible())throw fail('고객 요청을 찾을 수 없습니다.',404);
    if(search)throw fail('주소를 확인해 주세요.');
    clientProjects.session(token);
    // version: 의뢰를 보낼 때 손님이 본 명단 판(조각 ② — 그사이 명단이 바뀌었으면 의뢰가 409).
    const doc=current();return {version:doc.version,entries:doc.entries.filter(item=>item.active&&!item.example).map(customerEntry)};
  }
  // 올린 그림 정리: 명단이 가리키지 않고 올린 지 한 시간이 지난 그림을 「지우는 중(gone)」으로 표시만 하고, 지우는 중으로 하루를 지난 그림의 파일 이름을 돌려준다.
  // 부른 쪽이 커밋 뒤 디스크에서 지우고 forgetMedia로 문서를 뗀다. gone은 되돌리지 않는다(되살리면 파일 지우기와 다시 겹친다 — Fable 설계 검토 ④).
  // 명단 문서가 깨졌으면 무엇을 가리키는지 알 수 없어 아무것도 지우지 않는다.
  // 하루는 벽시계로 재지 않는다(둘째 판 GPT GA1 → 다시 GA2, 설계 다시). 정리 때마다 이 서버 프로세스의 단조 시계가 앞 정리 뒤로 흐른 시간을 지우는 중인 그림의 agedMs에 더한다.
  // 시계를 앞뒤로 돌려도 하루가 줄지 않고, 서버가 꺼져 있거나 잠든 시간은 세지 않아 지우기가 늦어질 뿐이다. 프로세스의 첫 정리는 그 프로세스가 뜬 때부터 센다.
  // 같은 데이터 폴더를 쓰는 서버 프로세스는 하나라고 본다. 둘이 함께 돌면 같은 시간을 두 번 센다(운영은 컨테이너 하나를 멈춘 뒤 새로 띄운다 — Fable 설계 검토 P2-1, 한계).
  // 6시간 정리 예약이 꺼진 서버에서는 명단 저장 · 그림 올리기 때만 나이가 쌓인다(Fable 설계 검토 P2-2, 한계 — 지우기가 늦어질 뿐이다).
  // 그래서 지우는 중 표시 뒤 실제로 하루가 지나야 파일을 지운다. 표시 전에 잡힌 백업은 실제 6시간 안에 끝난다(workspace-media.mjs MEDIA_READ_WINDOW_MS — 단조 시계 포함, GPT 다섯째 GA3).
  function sweep(){
    const doc=readDoc(store.get(PULSE_PEOPLE_KIND,ID),()=>true);if(doc.broken)return [];
    const used=new Set(doc.entries.flatMap(item=>[item.image,...item.samples]).map(mediaIdOf).filter(Boolean)),now=Date.parse(clock()),removed=[];
    const tick=steady(),step=tick-accountedAt>0?tick-accountedAt:0;if(tick>accountedAt)accountedAt=tick;
    for(const item of mediaDocs()){
      // 지우기가 실패하면 문서가 남아 다음 정리가 다시 지운다(GPT 검수 GA8). 파일을 지운 뒤 문서는 forgetMedia가 뗀다.
      if(item.gone){
        const aged=(Number.isFinite(item.agedMs)&&item.agedMs>0?item.agedMs:0)+step;
        if(step>0)store.put(PEOPLE_MEDIA_KIND,item.id,{...item,agedMs:aged});
        if(PEOPLE_MEDIA_DELETE_FILES&&typeof item.diskName==='string'&&aged>=PEOPLE_MEDIA_LIMITS.goneMs)removed.push(item.diskName);
        continue;
      }
      // 한 시간 유예는 벽시계로 본다. 시계가 망가졌거나 올린 때보다 앞에 있으면 표시하지 않는다(지우기가 늦어질 뿐이다).
      if(used.has(item.id)||!Number.isFinite(now))continue;
      const at=Date.parse(item.at);if(Number.isFinite(at)&&now-at<PEOPLE_MEDIA_LIMITS.graceMs)continue;
      store.put(PEOPLE_MEDIA_KIND,item.id,{...item,gone:true,goneAt:new Date(now).toISOString(),agedMs:0});
    }
    return removed;
  }
  // 파일을 지운 그림의 문서를 뗀다(지우는 중인 것만).
  function forgetMedia(names){const gone=new Set(names);tx(()=>{for(const item of mediaDocs())if(item.gone&&gone.has(item.diskName))store.remove(PEOPLE_MEDIA_KIND,item.id);});}
  // 그림 하나를 명단 그림으로 적는다(파일은 부른 쪽이 먼저 자리에 둔다). 관리자만, 모두 200장까지(먼저 정리한 뒤 센다).
  function addMedia(user,metadata){
    const live=admin(user);
    return tx(()=>{
      const removed=sweep();
      if(!mediaWrites)throw fail('명단 그림 올리기는 아직 열리지 않았어요.',404);
      if(mediaDocs().filter(item=>!item.gone).length>=PEOPLE_MEDIA_LIMITS.count)throw fail(`명단 그림은 ${PEOPLE_MEDIA_LIMITS.count}장까지 둘 수 있어요. 쓰지 않는 칸의 그림을 비운 뒤 한 시간 뒤에 다시 올려 주세요.`,409);
      store.put(PEOPLE_MEDIA_KIND,metadata.id,{id:metadata.id,diskName:metadata.diskName,mimeType:metadata.mimeType,byteSize:metadata.byteSize,at:clock(),by:live.id});
      return {ref:`media:${metadata.id}`,url:`/api/pulse-people/media/${metadata.id}`,removed};
    });
  }
  function adminMedia(user,id){admin(user);const doc=mediaDoc(id);if(!doc)throw fail('그림을 찾지 못했어요.',404);return doc;}
  // 손님 그림 경로: 요청마다 스위치 · 손님 세션 · 그 그림을 가리키는 켜진(예시 아닌) 칸을 본다(설계 검토 P1-2).
  function customerMedia(token,id){
    if(!visible())throw fail('그림을 찾지 못했어요.',404);
    clientProjects.session(token);
    const ref=`media:${id}`,shown=selectable().some(item=>item.image===ref||item.samples.includes(ref)),doc=shown?mediaDoc(id):null;
    if(!doc)throw fail('그림을 찾지 못했어요.',404);
    return doc;
  }
  return {visible,adminView,save,customerList,read:()=>current(),addMedia,adminMedia,customerMedia,sweep,forgetMedia,mediaOpen:()=>mediaWrites===true,assertAdmin:user=>{admin(user);}};
}
