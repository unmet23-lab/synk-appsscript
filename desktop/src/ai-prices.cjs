'use strict';
// AI 구독 계정판의 요금표(10-19 3차). 앱 안 기본 사본과 synk.im 갱신본 가운데 서비스마다 더 최근에 확인한 쪽을 쓴다.
// 화면(subscriptions.mjs)은 확인한 지 60일이 지난 서비스의 금액과 결제 주기를 말하지 않는다.
// 갱신본은 고정 주소에서 받기만 한다(사용 기록·계정은 보내지 않는다). 출처는 앱 안 공식 안내 열쇠(HELP_LINKS)로만 가리켜
// 받은 파일이 새 주소를 열게 하지 못하고, 문장은 앱이 만든다(받은 파일에는 숫자·날짜·정해진 낱말만 있다).
const PRICES_URL='https://synk.im/desktop/ai-prices.json';
const MAX_BYTES=32*1024,DAY=864e5,FLOOR=new Date(2026,0,1).getTime(),DEAL_DAYS=62;
// 서비스마다 받을 요금제 열쇠(계정판이 읽는 요금제 이름을 소문자·기호 없이)와 출처로 쓸 수 있는 공식 안내 열쇠.
const PLAN_KEYS=Object.freeze({claude:['pro','max5x','max20x'],higgsfield:['starter','plus','ultra'],typecast:['free','lite','plus']});
const SOURCES=Object.freeze({claude:['claude-plans'],higgsfield:['higgsfield-pricing','higgsfield-annual'],typecast:['typecast-api-pricing']});
// 앱 안 기본 사본(10-19 공식 요금표를 앱 안 브라우저로 직접 확인). month: 월 결제 한 달, year: 연간 결제 1년 치(없으면 연간 결제가 없다), credits: 한 달 크레딧.
// 금액은 공식 기본값(세전)이고, krVat는 한국 결제에 붙는 부가세율이다 — 화면은 한국 결제 값(기본값 × (1 + krVat))을 「한국 결제 · 부가세 포함」으로 보인다(Fable 3차 시안 P2-4).
const DEFAULT_PRICES=Object.freeze({
  schemaVersion:1,kind:'synk-ai-prices',
  services:{
    // claude.com 요금표: 기본값 Pro 월 $20 · 연간 1년 치 $200(한 달 $17꼴), Max 5x $100(「$100부터」), 결제 주기는 Pro 월간·연간, Max 둘은 월간만.
    // Max 20x $200은 Anthropic 도움말 11049741(「Max 20x: $200 per month」, 같은 날 2차 Fable 확인). 한국에서 열면 페이지가 「Prices include 10% VAT」와 함께 $22 · $220 · $110부터로 덧씌워 보인다(카드 원래 값 `data-original-text` $20 · $200 · $100부터).
    claude:{checked:'2026-10-19',source:'claude-plans',currency:'USD',tax:'excluded',krVat:0.1,plans:{pro:{month:20,year:200},max5x:{month:100},max20x:{month:200}}},
    // higgsfield.ai 요금표(세금 별도): 월 결제 Starter $19 · Plus $59 · Ultra $129, 연간 결제는 한 달 $19 · $47 · $99(Starter는 차이 없음), 한 달 크레딧 270 · 1,200 · 3,000(Ultra는 6,000 · 9,000 등급도 있다).
    // 도움말 「Can I switch between monthly and annual billing?」: 연간 결제에서 월 결제로는 못 돌아온다(annualLock).
    higgsfield:{checked:'2026-10-19',source:'higgsfield-pricing',currency:'USD',tax:'excluded',annualLock:true,plans:{starter:{month:19,year:228,credits:270},plus:{month:59,year:564,credits:1200},ultra:{month:129,year:1188,credits:3000}}},
    // typecast.ai API 요금표(계정판은 API 키로 읽는다): 무료 $0 · 라이트 $15 · 플러스 $280, 한 달 크레딧 15,000 · 200,000 · 4,000,000. API 요금제에는 연간 결제가 없다(연간 10% 할인은 스튜디오 요금제).
    typecast:{checked:'2026-10-19',source:'typecast-api-pricing',currency:'USD',tax:null,plans:{free:{month:0,credits:15000},lite:{month:15,credits:200000},plus:{month:280,credits:4000000}}},
  },
  // 할인 시기: 공식 공지로 날짜를 확인한 할인만 synk.im 갱신본에 넣는다(앱 기본 사본에는 없다).
  deals:[],
});

const DATE=/^(\d{4})-(\d{2})-(\d{2})$/;
// 'YYYY-MM-DD' → 이 PC 시간대의 그날 0시. 없는 날짜(2월 30일 등)는 받지 않는다.
function dayStamp(value){
  const m=DATE.exec(typeof value==='string'?value:'');if(!m)return null;
  const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  return d.getFullYear()===Number(m[1])&&d.getMonth()===Number(m[2])-1&&d.getDate()===Number(m[3])?d.getTime():null;
}
const price=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100000?Math.round(v*100)/100:null;
const amount=v=>Number.isSafeInteger(v)&&v>0&&v<=1e9?v:null;
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
// 확인한 날은 2026년부터 오늘(하루 여유)까지만 받는다 — 앞날짜로 60일 문을 피하지 못하게.
// 앱 기본 사본(trusted)은 상한을 보지 않는다 — PC 시계가 늦어도 기본 사본까지 버려 금액·크레딧이 모두 사라지지 않게(Fable 3차 시안 P3-9).
const checkedAt=(value,now,trusted=false)=>{const at=dayStamp(value);return at!==null&&at>=FLOOR&&(trusted||at<=now+DAY)?at:null;};

function cleanService(service,raw,now,trusted=false){
  if(!plain(raw)||checkedAt(raw.checked,now,trusted)===null||!SOURCES[service].includes(raw.source)||!['USD','KRW'].includes(raw.currency))return null;
  // krVat: 한국 결제에 붙는 부가세율(0~30%). 모양이 틀리면 그 서비스를 받지 않는다(금액을 반쯤 맞게 말하지 않게).
  if(raw.krVat!==undefined&&raw.krVat!==null&&!(typeof raw.krVat==='number'&&raw.krVat>=0&&raw.krVat<=0.3))return null;
  const plans={};
  for(const key of PLAN_KEYS[service]){
    const p=raw.plans?.[key];if(!plain(p))continue;
    const month=price(p.month),year=p.year===undefined||p.year===null?null:price(p.year),credits=p.credits===undefined||p.credits===null?null:amount(p.credits);
    // 숫자 하나라도 모양이 틀리면 그 요금제는 통째로 버린다(반쯤 맞는 값으로 말하지 않게).
    if(month===null||(p.year!==undefined&&p.year!==null&&year===null)||(p.credits!==undefined&&p.credits!==null&&credits===null))continue;
    plans[key]={month,...(year===null?{}:{year}),...(credits===null?{}:{credits})};
  }
  if(!Object.keys(plans).length)return null;
  // krVat은 적혀 있으면 0도 그대로 둔다(「한국 부가세 없음」을 일부러 적은 것) — 빠진 것과 나눠야 합치기가 기본 사본 값을 이을 수 있다.
  return {checked:raw.checked,source:raw.source,currency:raw.currency,tax:['included','excluded'].includes(raw.tax)?raw.tax:null,...(typeof raw.krVat==='number'?{krVat:raw.krVat}:{}),...(raw.annualLock===true?{annualLock:true}:{}),plans};
}
// 할인 한 줄: 서비스·요금제(없으면 전부)·결제 주기(year 연간 결제 · any 둘 다)·시작·끝(62일 안)·확인한 날·출처·할인 %(선택).
function cleanDeal(raw,now){
  if(!plain(raw)||!Object.hasOwn(PLAN_KEYS,raw.service))return null;
  const from=dayStamp(raw.from),until=dayStamp(raw.until),checked=checkedAt(raw.checked,now);
  if(from===null||until===null||checked===null||until<from||until-from>DEAL_DAYS*DAY||!['year','any'].includes(raw.cycle)||!SOURCES[raw.service].includes(raw.source))return null;
  const plans=Array.isArray(raw.plans)?[...new Set(raw.plans.filter(k=>PLAN_KEYS[raw.service].includes(k)))]:null;
  if(plans&&!plans.length)return null;
  const off=raw.off===undefined||raw.off===null?null:Number.isInteger(raw.off)&&raw.off>=1&&raw.off<=90?raw.off:undefined;
  if(off===undefined)return null;
  return {service:raw.service,...(plans?{plans}:{}),cycle:raw.cycle,from:raw.from,until:raw.until,checked:raw.checked,source:raw.source,...(off===null?{}:{off})};
}
// 받은 요금표 → 쓸 수 있는 모양(못 쓰면 null). 모르는 칸은 버린다. trusted: 앱 기본 사본(확인한 날 상한을 보지 않음).
function validatePrices(raw,now=Date.now(),{trusted=false}={}){
  if(!plain(raw)||raw.schemaVersion!==1||raw.kind!=='synk-ai-prices')return null;
  const services={};
  for(const service of Object.keys(PLAN_KEYS)){const clean=cleanService(service,raw.services?.[service],now,trusted);if(clean)services[service]=clean;}
  const deals=(Array.isArray(raw.deals)?raw.deals.slice(0,20):[]).map(d=>cleanDeal(d,now)).filter(Boolean);
  return Object.keys(services).length||deals.length?{services,deals}:null;
}
// 서비스마다 더 최근에 확인한 쪽(같은 날이면 base). 할인은 둘을 합치고 같은 것(서비스·시작·끝)은 하나만.
// 더 최근 판에 krVat이 빠졌으면 앞 판의 값을 잇는다 — 갱신본에서 그 칸을 빠뜨려도 Claude 금액이 조용히 세전값으로 10% 줄지 않게(구현 검수 P3-B).
function mergePrices(base,extra){
  const services={...(base?.services||{})};
  for(const [service,entry] of Object.entries(extra?.services||{})){
    const prev=services[service];
    if(!prev||entry.checked>prev.checked)services[service]=entry.krVat===undefined&&prev?.krVat!==undefined?{...entry,krVat:prev.krVat}:entry;
  }
  const seen=new Set(),deals=[];
  for(const d of [...(base?.deals||[]),...(extra?.deals||[])]){const key=`${d.service}|${d.from}|${d.until}`;if(!seen.has(key)){seen.add(key);deals.push(d);}}
  return {services,deals};
}
// 응답 본문을 MAX_BYTES까지만 읽는다(길이를 안 밝힌 큰 응답도 다 받지 않는다).
async function readCapped(res,max=MAX_BYTES){
  const declared=Number(res.headers?.get?.('content-length'));
  if(Number.isFinite(declared)&&declared>max)return null;
  if(!res.body?.getReader){const text=await res.text();return Buffer.byteLength(text)>max?null:text;}
  const reader=res.body.getReader(),chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){try{await reader.cancel();}catch{}return null;}chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks).toString('utf8');
}

module.exports={PRICES_URL,MAX_BYTES,DEFAULT_PRICES,PLAN_KEYS,SOURCES,validatePrices,mergePrices,readCapped,dayStamp};
