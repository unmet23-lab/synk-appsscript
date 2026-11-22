// PULSE 「인플루언서 광고」 의뢰 동작(조각 ②, 2026-11-23). 설계는 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절 「조각 ②」다.
// 의뢰는 프로젝트 문서(studio.people)에 둔다 — pulse-studio.mjs mutate의 확장 동작이라 판 번호 · 트랜잭션 · 기록 줄 · 알림 · 일지를 그대로 탄다.
// 순서: 손님 의뢰(sent) → 담당자 값 안내(quoted) → 손님 동의(agreed) → 크몽 결제 확인(paid) → 게시(posted) → 결과(done). 어느 때든 닫힘(closed).
// 손님은 값에 동의하기 전(sent · quoted)까지 거둘 수 있다. 동의하면 담당자가 크몽 결제 요청을 보내므로, 그 뒤 멈추는 것은 담당자가 닫는다(크몽에서 이미 결제했는데 앱에서 거둬 결제를 적을 수 없게 되지 않게 — GPT 검수 GA3).
// 의뢰 하나에 채널 하나, 프로젝트마다 열린 의뢰 한 건. 채널 이름 · 값은 보낼 때 서버가 명단에서 복사한다(화면이 보낸 이름 · 값을 믿지 않는다 — 설계 검토 P1-4).
// 명단은 선택 모듈(pulse-people.mjs)이라 여기서 import하지 않고 people로 주입받는다. 없으면 새 의뢰만 막고, 이미 있는 의뢰의 동작은 그대로 된다.
import {randomUUID} from 'node:crypto';
import {applyInlineTranslations,inlineObject} from './pulse-translations.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
export const PEOPLE_STATUSES=Object.freeze(['sent','quoted','agreed','paid','posted','done','closed']);
// 열린 의뢰: 아직 끝나지도 닫히지도 않은 것. 프로젝트 보관을 막고(client-projects.mjs) 담당자 차례 꼬리표를 단다.
export const PEOPLE_OPEN=Object.freeze(['sent','quoted','agreed','paid','posted']);
const CUSTOMER_CANCEL=['sent','quoted'];
export const PEOPLE_LIMITS=Object.freeze({requests:20,open:1,posts:5,trail:20});
const FIELDS={
  people_request:['channelId','note','rosterVersion'],people_agree:['requestId','amount'],people_cancel:['requestId','why'],
  people_quote:['requestId','amount','includes','postBy','translation'],people_paid:['requestId','ref'],people_posted:['requestId','posts','disclosed'],
  people_done:['requestId','result','translation'],people_close:['requestId','why','translation'],
};
const CUSTOMER_ONLY=['people_request','people_agree','people_cancel'];
export const peopleActions=action=>Object.hasOwn(FIELDS,action)?FIELDS[action]:undefined;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const realDay=day=>{if(typeof day!=='string'||!DAY.test(day))return false;const at=Date.parse(day+'T00:00:00Z');return Number.isFinite(at)&&new Date(at).toISOString().slice(0,10)===day;};
// 막는 문자: 제어 문자(줄바꿈은 한마디에서만 받는다), C1 제어 문자, 줄 · 문단 구분자, 방향 덮어쓰기.
const BLOCKED=new RegExp('['+[[0x00,0x09],[0x0b,0x1f],[0x7f,0x9f],[0x2028,0x2029],[0x202a,0x202e],[0x2066,0x2069]].map(([from,to])=>String.fromCharCode(from)+'-'+String.fromCharCode(to)).join('')+']');
// message: 틀릴 때의 문장 그대로(고정 문장 — 손님 길의 문장은 화면 영어 사전에 키로 있다).
function text(value,max,message,{lines=false}={}){
  if(value===undefined||value===null)return '';
  if(typeof value!=='string'||!value.isWellFormed()||BLOCKED.test(value)||!lines&&value.includes('\n')||[...value.trim()].length>max)throw fail(message);
  return value.trim();
}
const amountOf=value=>Number.isSafeInteger(value)&&value>=10000&&value<=100000000;
function postUrl(value){
  if(typeof value!=='string'||value.length>2000)throw fail('게시물 주소를 확인해 주세요.');
  let parsed;try{parsed=new URL(value.trim());}catch{throw fail('게시물 주소는 https://로 시작해야 해요.');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||!parsed.hostname.includes('.')||parsed.href.length>1000)throw fail('게시물 주소는 https://로 시작해야 해요.');
  return parsed.href;
}
export const peopleOf=studio=>object(studio?.people)&&Array.isArray(studio.people.requests)?studio.people.requests:[];
export const openPeopleRequests=studio=>peopleOf(studio).filter(item=>PEOPLE_OPEN.includes(item?.status));
const trail=(item,kind,by,at)=>[...(Array.isArray(item.trail)?item.trail:[]),{kind,at,by}].slice(-PEOPLE_LIMITS.trail);
function find(studio,requestId){
  if(typeof requestId!=='string'||!UUID.test(requestId))throw fail('의뢰를 찾지 못했어요. 새로 불러와 주세요.',404);
  const list=peopleOf(studio),at=list.findIndex(item=>item?.id===requestId);
  if(at<0)throw fail('의뢰를 찾지 못했어요. 새로 불러와 주세요.',404);
  return {list,at,item:list[at]};
}
function moved(status,allowed){if(!allowed.includes(status))throw fail('그사이 의뢰가 다음 단계로 넘어갔어요. 새로 불러와 주세요.',409);}

// people: pulse-people.mjs createPulsePeople의 {visible, read}. 명단 판 · 칸 · 스위치를 같은 트랜잭션에서 읽는다.
export function applyPeopleAction({studio,row,input,staff,stamp,locale='ko',people=null}){
  const action=input.action,now=stamp.at,by=staff?'staff':'customer';
  if(CUSTOMER_ONLY.includes(action)&&staff)throw fail('고객 화면에서만 할 수 있어요.',403);
  if(!CUSTOMER_ONLY.includes(action)&&!staff)throw fail('담당자 화면에서만 할 수 있어요.',403);
  const save=(list)=>{studio.people={schemaVersion:1,requests:list};};
  if(action==='people_request'){
    if(!people||!people.visible())throw fail('지금은 인플루언서 광고 의뢰를 받지 않아요.',404);
    if(!(row.versions||[]).length)throw fail('영상 시안이 나온 뒤에 의뢰할 수 있어요.',409);
    const roster=people.read();
    if(input.rosterVersion!==roster.version)throw fail('그사이 채널 명단이 바뀌었어요. 새로 불러온 뒤 다시 보내 주세요.',409);
    const channel=roster.entries.find(item=>item.id===input.channelId&&item.active&&!item.example);
    if(!channel)throw fail('고를 수 없는 채널이에요. 새로 불러와 주세요.',404);
    const list=peopleOf(studio),open=list.filter(item=>PEOPLE_OPEN.includes(item?.status));
    // 프로젝트마다 열린 의뢰(보냄 ~ 게시)는 한 건이다(처음 설계 3-4절). 그래서 한 프로젝트에 같은 채널의 열린 의뢰가 둘 생기는 길이 없고,
    // 주소 꼴 · 계정 이름으로 같은 채널을 알아볼 일이 없다 — 그런 추측은 어떻게 좁혀도 다른 채널을 같다고 보거나 별칭을 놓쳤다(GPT 검수 일곱 회차 · Fable 설계 검토).
    if(open.length>=PEOPLE_LIMITS.open)throw fail('진행 중인 의뢰가 끝난 뒤에 다른 채널에 의뢰할 수 있어요.',409);
    if(list.length>=PEOPLE_LIMITS.requests)throw fail('이 프로젝트의 의뢰 기록이 가득 찼어요. 담당자에게 알려 주세요.',409);
    const note=text(input.note,500,'한마디를 확인해 주세요.',{lines:true});
    const copied={id:channel.id,name:channel.name,platform:channel.platform,handle:channel.handle||'',url:channel.url||'',virtual:channel.virtual===true,price:Number.isSafeInteger(channel.prices?.post)?channel.prices.post:null};
    save([...list,{id:randomUUID(),at:now,updatedAt:now,status:'sent',channel:copied,note,quote:null,agreedAt:null,paid:null,posts:[],disclosed:false,postedAt:null,result:'',doneAt:null,closed:null,trail:[{kind:'sent',at:now,by}]}]);
    return;
  }
  const {list,at,item}=find(studio,input.requestId),put=next=>{const copy=[...list];copy[at]={...next,updatedAt:now};save(copy);};
  if(action==='people_agree'){
    moved(item.status,['quoted']);
    if(input.amount!==item.quote?.amount)throw fail('그사이 값이 바뀌었어요. 새 값을 보고 다시 골라 주세요.',409);
    put({...item,status:'agreed',agreedAt:now,trail:trail(item,'agreed',by,now)});return;
  }
  if(action==='people_cancel'){
    moved(item.status,CUSTOMER_CANCEL);
    put({...item,status:'closed',closed:{by,why:text(input.why,300,'까닭을 확인해 주세요.'),at:now,from:item.status},trail:trail(item,'closed',by,now)});return;
  }
  if(action==='people_quote'){
    moved(item.status,['sent','quoted']);
    if(!amountOf(input.amount))throw fail('금액은 1만 원에서 1억 원 사이의 원 단위 숫자로 적어 주세요.');
    const includes=text(input.includes,200,'포함된 것을 확인해 주세요.'),postBy=input.postBy===undefined||input.postBy===''?'':input.postBy;
    if(postBy!==''&&!realDay(postBy))throw fail('게시 예정일을 확인해 주세요.');
    applyInlineTranslations(studio,[{key:`people:${item.id}:includes`,source:includes,max:200,text:inlineObject(input.translation,['includes']).includes}],{locale,stamp});
    put({...item,status:'quoted',quote:{amount:input.amount,includes,postBy,at:now,by:stamp.authorName},trail:trail(item,'quoted',by,now)});return;
  }
  if(action==='people_paid'){
    moved(item.status,['agreed']);
    put({...item,status:'paid',paid:{at:now,by:stamp.authorName,ref:text(input.ref,80,'주문 메모를 확인해 주세요.')},trail:trail(item,'paid',by,now)});return;
  }
  if(action==='people_posted'){
    moved(item.status,['paid']);
    if(!Array.isArray(input.posts)||!input.posts.length||input.posts.length>PEOPLE_LIMITS.posts)throw fail(`게시물 주소를 1~${PEOPLE_LIMITS.posts}개 넣어 주세요.`);
    const posts=[...new Set(input.posts.map(postUrl))];
    // 손님에게 「광고」 표시를 붙인다고 약속했으므로 담당자가 확인해야 게시로 넘긴다(설계 검토 P2).
    if(input.disclosed!==true)throw fail('게시물에 「광고」 표시가 붙었는지 확인해 주세요.');
    put({...item,status:'posted',posts,disclosed:true,postedAt:now,trail:trail(item,'posted',by,now)});return;
  }
  if(action==='people_done'){
    moved(item.status,['posted']);
    const result=text(input.result,300,'결과 한 줄을 확인해 주세요.');if(!result)throw fail('결과 한 줄을 적어 주세요.');
    applyInlineTranslations(studio,[{key:`people:${item.id}:result`,source:result,max:300,text:inlineObject(input.translation,['result']).result}],{locale,stamp});
    put({...item,status:'done',result,doneAt:now,trail:trail(item,'done',by,now)});return;
  }
  if(action==='people_close'){
    moved(item.status,PEOPLE_OPEN);
    const why=text(input.why,300,'닫는 까닭을 확인해 주세요.');if(!why)throw fail('닫는 까닭을 적어 주세요. 손님에게 보여요.');
    applyInlineTranslations(studio,[{key:`people:${item.id}:why`,source:why,max:300,text:inlineObject(input.translation,['why']).why}],{locale,stamp});
    put({...item,status:'closed',closed:{by,why,at:now,from:item.status},trail:trail(item,'closed',by,now)});return;
  }
  throw fail('의뢰 동작을 확인해 주세요.');
}

// 보기: 직원은 저장 꼴 그대로. 손님에게는 크몽 주문 메모(paid.ref)와 담당자 이름(by)을 내리지 않는다. 꼴이 깨진 줄은 뺀다.
export function peopleRequestsView(studio,{staff=false}={}){
  const list=peopleOf(studio).filter(item=>object(item)&&typeof item.id==='string'&&PEOPLE_STATUSES.includes(item.status)&&object(item.channel));
  if(!list.length)return undefined;
  if(staff)return {requests:list.map(item=>structuredClone(item))};
  return {requests:list.map(item=>{
    const {paid,quote,...rest}=structuredClone(item);
    return {...rest,quote:object(quote)?{amount:quote.amount,includes:quote.includes||'',postBy:quote.postBy||'',at:quote.at}:null,paid:object(paid)?{at:paid.at}:null};
  })};
}

// 알림(client-notifications.mjs): 이번 쓰기로 상태가 바뀐(또는 값을 다시 보낸) 의뢰마다 사건 하나. 기록 줄의 동작 이름을 믿지 않고 앞뒤 문서를 견준다.
export function peopleEvents(before,after){
  const old=new Map(peopleOf(before).map(item=>[item?.id,item])),out=[];
  for(const item of peopleOf(after)){
    if(!object(item))continue;
    const prev=old.get(item.id);
    if(!prev){if(item.status==='sent')out.push({kind:'sent',item});continue;}
    if(prev.status===item.status&&!(item.status==='quoted'&&prev.quote?.at!==item.quote?.at))continue;
    out.push({kind:item.status,item});
  }
  return out;
}
