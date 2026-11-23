// 로그인한 통계 화면(creator-screen)·공식 내보내기(official-export)·플랫폼 공식 공개 화면(public-page)에서 사람이 확인한 수치를 남긴다(2026-11-14).
// ① API 수집이 아니다. source는 'external:<종류>'이고 채널 문서(연결·수집 상태·lastCollectedAt)는 바꾸지 않는다.
// ② 계정 기간 합계(account-period)·계정 누적(account-lifetime)은 externalMetricObservations에만 둔다.
//    posts·snapshots·channelSnapshots에 넣지 않으므로 게시물 조회수 합계·그래프와 섞이지 않는다.
// ③ 게시물 누적(post-lifetime)만, API 수집기가 없는 플랫폼의 연결 없는 채널에서 다른 출처의 게시물·기록과 겹치지 않을 때
//    API와 같은 게시물 열쇠(채널:게시물 번호)로 posts·snapshots에 넣어 기존 분석에서 보이게 한다. 그 밖에는 관측 기록으로만 둔다.
// ④ 서버는 어떤 주소도 열지 않는다(리다이렉트·SSRF 없음). 주소는 플랫폼 공식 호스트 목록으로만 검사하고,
//    출처 주소는 경로까지만 남긴다(쿼리·조각을 버려 세션·토큰이 섞이지 않게 한다).
// ⑤ 기록 ID는 채널·종류·기간·게시물·증거 해시로 정해진다. 같은 원본 재시도는 늘지 않고, 같은 ID에 다른 값이 오면 409다.
import {createHash} from 'node:crypto';
import {accountCatalog,matchAccount,platformKey,accountAddressKey,facebookLegacyPublicId,MANAGED_ACCOUNT_STATUSES} from './account-catalog.mjs';
import {PLATFORM_CAPABILITIES} from './collectors.mjs';
import {ownerAt} from './organization.mjs';

export const EXTERNAL_OBSERVATION_KIND='externalMetricObservations';
export const EXTERNAL_STATE_KIND='externalCollectionStates';
// creator-screen: 로그인한 크리에이터 통계 화면, official-export: 플랫폼 공식 내보내기 파일, public-page: 로그인 없이 보이는 플랫폼 공식 공개 화면(예: t.me/s/<계정>).
// public-page는 그 플랫폼의 게시물 공개 호스트(와 계정 자기 하위 도메인)만 받고, 계정 경로가 있는 플랫폼은 그 계정의 공개 화면이어야 한다. 어떤 출처도 API 연결로 세지 않는다.
export const EXTERNAL_SOURCE_TYPES=Object.freeze(['creator-screen','official-export','public-page']);
export const EXTERNAL_SOURCE_BASIS=Object.freeze({
  'creator-screen':'로그인한 크리에이터 통계 화면에서 사람이 확인한 값이에요.',
  'official-export':'플랫폼 공식 내보내기 파일에서 사람이 확인한 값이에요.',
  'public-page':'로그인 없이 누구나 보는 플랫폼 공식 공개 화면에서 사람이 확인한 값이에요. 소유자 통계 화면의 값이 아니에요.',
});
export const EXTERNAL_KINDS=Object.freeze(['post-lifetime','account-period','account-lifetime']);
// analyticsMax는 /api/analytics가 외부 관측을 한 번에 돌려주는 줄 수의 상한이다. 11-15에 500에서 10000으로 올렸다.
// 등록 계정 71개가 90일 동안 하루 한 줄씩 남기고 7일, 30일, 60일, 90일 합계를 더해도 이 안에 들어간다. 상한이 500이었을 때는 90일 응답에서 계정이 통째로 빠지고 truncated가 켜져서 화면이 합계를 내지 못했다.
// 상한을 넘으면 가장 오래된 관측부터 빠지고 truncated가 true가 된다. 응답이 끝없이 커지지 않도록 상한은 남겨 둔다. 한 번에 기록하는 줄 수(rows)와 상세 조회 상한(listMax)은 이것과 따로 정한다.
export const EXTERNAL_LIMITS=Object.freeze({bytes:200000,rows:200,label:120,title:300,url:600,segment:160,metricLabels:20,maxAgeDays:400,futureSkewMs:5*60000,periodDays:366,listDefault:100,listMax:500,analyticsMax:10000});
// 종류(grain)마다 받는 수치. post-lifetime은 게시물 기록(snapshots)의 여섯 칸과 같다.
export const EXTERNAL_METRICS=Object.freeze({
  'post-lifetime':Object.freeze(['views','likes','comments','shares','saves','reach']),
  'account-period':Object.freeze(['views','impressions','reach','visitors','likes','comments','shares','saves','followersGained','followersLost','profileVisits','linkClicks','watchTimeMinutes','postsPublished']),
  'account-lifetime':Object.freeze(['followers','posts','views','likes','visitors']),
});
export const EXTERNAL_BASIS=Object.freeze({
  'post-lifetime':'사람이 확인한 게시물 한 개의 관측 시점 누적값이에요. 출처 종류는 sourceType·sourceBasis에 따로 적어요.',
  'account-period':'플랫폼 화면이 보여 준 계정의 기간 합계예요. 게시물 조회수 합계·그래프와 합치지 않아요.',
  'account-lifetime':'플랫폼 화면이 보여 준 계정 누적값(관측 시점)이에요. 게시물 합계와 합치지 않아요.',
  analytics:'로그인한 통계 화면, 플랫폼 공식 내보내기 파일, 누구나 볼 수 있는 플랫폼 공식 공개 화면에서 사람이 직접 확인한 값이에요. 어디서 확인했는지는 기록마다 따로 적어 두었어요. 계정의 기간 합계와 계정 누적값은 플랫폼이 보여 준 계정 전체의 값이라서, 게시물 합계나 그래프에 더하지 않고 여기에만 따로 보여 드려요. 게시물 하나의 누적값은 자동 수집이 없는 플랫폼의 연결되지 않은 채널이고 API 같은 다른 출처의 기록이 없을 때만 기존 게시물 기록에 넣어서 게시물 합계와 그래프에 반영해요. 같은 날 여러 번 확인한 경우에는 가장 최근 값 하나만 남겨요. 이 목록에 보이는 값은 그 위에 한 번 더 더하지 않고, 채널끼리도 합치지 않아요.',
});
// source: 통계 화면·내보내기의 공식 호스트, post: 게시물 공개 호스트. 목록 밖 호스트는 거절한다(서버가 열어 보지 않는다).
// ownHost: 계정마다 자기 하위 도메인을 쓰는 곳 — 원장·채널 주소의 그 호스트 하나만 더한다.
// ownerSegment: 게시물 주소의 첫 칸이 그 계정(원장 주소의 첫 칸)이어야 하는 곳. public-page 출처 주소도 그 계정 경로여야 하고,
// publicPrefix는 계정 앞에 올 수 있는 공식 공개 미리보기 칸이다(t.me/s/<계정>).
export const EXTERNAL_SOURCE_RULES=Object.freeze({
  youtube:{source:['studio.youtube.com','www.youtube.com'],post:['www.youtube.com','youtube.com','m.youtube.com','youtu.be']},
  instagram:{source:['www.instagram.com','business.facebook.com','www.facebook.com'],post:['www.instagram.com','instagram.com']},
  facebook:{source:['business.facebook.com','www.facebook.com'],post:['www.facebook.com','facebook.com','m.facebook.com']},
  tiktok:{source:['www.tiktok.com'],post:['www.tiktok.com','tiktok.com']},
  threads:{source:['www.threads.com','www.threads.net'],post:['www.threads.com','threads.com','www.threads.net','threads.net']},
  x:{source:['x.com'],post:['x.com','twitter.com']},
  linkedin:{source:['www.linkedin.com'],post:['www.linkedin.com']},
  telegram:{source:['web.telegram.org'],post:['t.me'],ownerSegment:true,publicPrefix:['s']},
  behance:{source:['www.behance.net'],post:['www.behance.net']},
  'naver-clip':{source:['clip.naver.com','creator-advisor.naver.com'],post:['clip.naver.com']},
  'naver-blog':{source:['admin.blog.naver.com','blog.naver.com','m.blog.naver.com','creator-advisor.naver.com'],post:['blog.naver.com','m.blog.naver.com'],ownerSegment:true},
  tistory:{source:['www.tistory.com'],post:[],ownHost:'.tistory.com'},
  pinterest:{source:['www.pinterest.com','analytics.pinterest.com'],post:['www.pinterest.com','pinterest.com']},
  'kakao-channel':{source:['business.kakao.com','center-pf.kakao.com'],post:['pf.kakao.com'],ownerSegment:true},
  substack:{source:['substack.com'],post:[],ownHost:'.substack.com'},
  brunch:{source:['brunch.co.kr'],post:['brunch.co.kr'],ownerSegment:true},
  douyin:{source:['creator.douyin.com','www.douyin.com'],post:['www.douyin.com']},
  xiaohongshu:{source:['creator.rednote.com','creator.xiaohongshu.com','www.xiaohongshu.com','www.rednote.com'],post:['www.xiaohongshu.com','www.rednote.com']},
  rutube:{source:['studio.rutube.ru','rutube.ru'],post:['rutube.ru']},
  vk:{source:['vk.com','vk.ru'],post:['vk.com','vk.ru']},
});
// VK 게시물 주소(wall-<소유자>_<번호> · clip-<소유자>_<번호>)의 소유자 칸과 대조할 커뮤니티 번호(11-19). 원장에 VK 커뮤니티 번호 칸이 아직 없어 원장 계정 ID로 여기에 둔다.
// 원장이나 채널에 숫자 외부 번호가 생기면 그 값도 함께 받는다. 근거: 공개 클립 목록 vk.ru/clips/synklab_ru의 클립 칸이 모두 owner=-243082040이고, 공식 내보내기 파일 이름이 243082040_community_common_…이다.
export const VK_COMMUNITY_IDS=Object.freeze({'lab-ru-vk':'243082040'});
const API_PLATFORMS=new Set(PLATFORM_CAPABILITIES.filter(capability=>capability.mode!=='manual').map(capability=>capability.id));
const MANAGED=new Set(MANAGED_ACCOUNT_STATUSES);
const TOP_KEYS=Object.freeze(['sourceType','sourceUrl','observedAt','evidenceSha256','identity','labels','exportFormat','observations']);
const ROW_KEYS=Object.freeze({'post-lifetime':['kind','post','metrics','labels'],'account-period':['kind','period','metrics','labels'],'account-lifetime':['kind','metrics','labels']});
const LABEL_KEYS=Object.freeze(['screenTitle','periodLabel','selectedRange','unit','timeZone']);
const EXPORT_FORMATS=Object.freeze(['csv','tsv','xlsx','json','pdf']);
const POST_QUERY=Object.freeze(['v','id','story_fbid','fbid','blogId','logNo']);
const EMPTY_SHA256='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
// RedNote(샤오훙수) 게시물 번호의 확인된 모양: 소문자 16진수 24자리(실제 증거 기준). 다른 모양은 받지 않는다.
const XHS_NOTE=/^[0-9a-f]{24}$/;
const ISO=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|([+-])(\d{2}):(\d{2}))$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const POST_ID=/^[\p{L}\p{N}_.:@~-]{1,200}$/u;

const invalid=(message,code='SYNK_EXTERNAL_INPUT',status=400,details)=>Object.assign(new Error(message),{status,code,...(details?{details}:{})});
const sha=value=>createHash('sha256').update(value).digest('hex');
const kstDay=ms=>new Date(ms+9*3600000).toISOString().slice(0,10);
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const hostOf=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.hostname.toLowerCase():null;}catch{return null;}};
const firstSegment=value=>{try{const segment=decodeURIComponent(new URL(value).pathname).split('/').filter(Boolean)[0];return segment?segment.toLowerCase():null;}catch{return null;}};
const newestFirst=(a,b)=>String(b.observedAt).localeCompare(String(a.observedAt))||String(a.id).localeCompare(String(b.id));
const newerObservation=(a,b)=>String(a.observedAt)>String(b.observedAt)||(a.observedAt===b.observedAt&&(String(a.recordedAt)>String(b.recordedAt)||(a.recordedAt===b.recordedAt&&String(a.id)>String(b.id))));
const publishedDay=row=>{const ms=Date.parse(row.post?.publishedAt);return Number.isFinite(ms)?kstDay(ms):null;};

function cleanText(value,max,label,code='SYNK_EXTERNAL_INPUT'){
  if(typeof value!=='string')throw invalid(`${label}: 글자로 적어 주세요.`,code);
  const text=value.replace(/[\u0000-\u001f\u007f]/g,' ').trim();
  if(text.length>max)throw invalid(`${label}: ${max}자까지 받아요.`,code);
  return text;
}
function instant(value,label,code){
  const match=typeof value==='string'?ISO.exec(value):null;
  if(!match)throw invalid(`${label}: 시간대가 붙은 날짜·시각(예: 2026-11-14T09:30:00+09:00)이어야 해요.`,code);
  const [,year,month,day,hour,minute,second='0',,,offsetHour='0',offsetMinute='0']=match;
  const last=new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate();
  if(Number(month)<1||Number(month)>12||Number(day)<1||Number(day)>last||Number(hour)>23||Number(minute)>59||Number(second)>59||Number(offsetHour)>14||Number(offsetMinute)>59)throw invalid(`${label}: 실제 달력 시각이 아니에요.`,code);
  const ms=Date.parse(value);
  if(!Number.isFinite(ms))throw invalid(`${label}: 시각을 확인해 주세요.`,code);
  return new Date(ms).toISOString();
}
function calendarDay(value,label){
  if(typeof value!=='string'||!DAY.test(value))throw invalid(`${label}: YYYY-MM-DD 날짜여야 해요.`,'SYNK_EXTERNAL_PERIOD');
  const date=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw invalid(`${label}: 실제 달력 날짜가 아니에요.`,'SYNK_EXTERNAL_PERIOD');
  return value;
}
function evidenceOf(value){
  if(typeof value!=='string'||!value.trim())throw invalid('원본 캡처·내보내기 파일의 SHA-256(evidenceSha256)을 넣어 주세요. 증거 없는 수치는 받지 않아요.','SYNK_EXTERNAL_EVIDENCE');
  const hex=value.trim().toLowerCase();
  if(!/^[0-9a-f]{64}$/.test(hex)||/^(.)\1{63}$/.test(hex)||hex===EMPTY_SHA256)throw invalid('원본 파일의 SHA-256 64자리를 확인해 주세요. 빈 파일·자리채움 값은 받지 않아요.','SYNK_EXTERNAL_EVIDENCE');
  return hex;
}
// 주소 검사만 한다. 요청을 보내지 않고, 쿼리는 지정한 게시물 번호 칸만 남긴다.
function officialUrl(value,hosts,{label,code,keepQuery=[]}){
  if(typeof value!=='string'||!value.trim()||value.length>2048)throw invalid(`${label}: 주소를 넣어 주세요.`,code);
  let url;
  try{url=new URL(value.trim());}catch{throw invalid(`${label}: 주소 형식을 확인해 주세요.`,code);}
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))throw invalid(`${label}: 아이디·비밀번호·다른 포트가 없는 https 주소만 받아요.`,code);
  const host=url.hostname.toLowerCase();
  if(!hosts.includes(host))throw invalid(`${label}: 이 플랫폼의 공식 주소가 아니에요(${host}).`,code);
  if(/%(?:2f|5c|00)/i.test(url.pathname))throw invalid(`${label}: 경로를 확인해 주세요.`,code);
  let path;
  try{path=decodeURIComponent(url.pathname);}catch{throw invalid(`${label}: 경로를 확인해 주세요.`,code);}
  const segments=path.split('/').filter(Boolean);
  if(segments.some(segment=>segment.length>EXTERNAL_LIMITS.segment||/[\u0000-\u001f\u007f]/.test(segment)))throw invalid(`${label}: 서명값처럼 너무 긴 칸이 있어요. 화면 주소만 넣어 주세요.`,code);
  const query=new URLSearchParams();
  for(const key of keepQuery){const kept=url.searchParams.get(key);if(kept)query.set(key,kept);}
  const search=query.toString(),href=`https://${host}${url.pathname}${search?'?'+search:''}`;
  if(href.length>EXTERNAL_LIMITS.url)throw invalid(`${label}: 주소가 너무 길어요.`,code);
  return {href,host,segments,query,rawQuery:url.searchParams,values:[...segments,...query.values()]};
}
function metricsOf(kind,value,where){
  if(!plain(value))throw invalid(`${where}: 수치(metrics)를 넣어 주세요.`,'SYNK_EXTERNAL_METRIC_VALUE');
  const allowed=EXTERNAL_METRICS[kind],unknown=Object.keys(value).filter(key=>!allowed.includes(key));
  if(unknown.length)throw invalid(`${where}: ${kind}에는 ${allowed.join('·')}만 넣을 수 있어요(${unknown.slice(0,5).join(', ')}).`,'SYNK_EXTERNAL_METRIC_GRAIN');
  const metrics={};let known=0;
  for(const key of allowed){
    if(!Object.hasOwn(value,key))continue; // 화면에 없던 칸은 0으로 채우지 않고 뺀다.
    const number=value[key];
    if(number===null){metrics[key]=null;continue;}
    if(typeof number!=='number'||!Number.isSafeInteger(number)||number<0)throw invalid(`${where}: ${key}는 0 이상의 정수나 null이어야 해요(글자·소수·음수·NaN·무한대 안 됨).`,'SYNK_EXTERNAL_METRIC_VALUE');
    metrics[key]=number;known++;
  }
  if(!known)throw invalid(`${where}: 확인한 수치가 하나도 없어요. 화면에 없던 수치는 0이 아니라 빼 두세요.`,'SYNK_EXTERNAL_METRIC_VALUE');
  return metrics;
}
// 화면의 기간 이름·선택 범위·단위 글자를 그대로(제어 문자만 빼고) 남긴다. 키 순서는 고정해 재시도 비교가 흔들리지 않게 한다.
function labelsOf(value,kind,where){
  if(value===undefined||value===null)return {};
  if(!plain(value))throw invalid(`${where}: 출처 이름(labels)을 확인해 주세요.`);
  const extra=Object.keys(value).filter(key=>!LABEL_KEYS.includes(key)&&!(kind&&key==='metricLabels'));
  if(extra.length)throw invalid(`${where}: 출처 이름에 알 수 없는 칸이 있어요(${extra.slice(0,5).join(', ')}).`);
  const labels={};
  for(const key of LABEL_KEYS){if(value[key]===undefined||value[key]===null)continue;const text=cleanText(value[key],EXTERNAL_LIMITS.label,`${where} ${key}`);if(text)labels[key]=text;}
  if(kind&&value.metricLabels!==undefined&&value.metricLabels!==null){
    const names=value.metricLabels;
    if(!plain(names)||Object.keys(names).length>EXTERNAL_LIMITS.metricLabels)throw invalid(`${where}: 수치 이름표(metricLabels)를 확인해 주세요.`);
    const wrong=Object.keys(names).filter(name=>!EXTERNAL_METRICS[kind].includes(name));
    if(wrong.length)throw invalid(`${where}: 수치 이름표는 이 종류의 수치에만 달 수 있어요(${wrong.slice(0,5).join(', ')}).`,'SYNK_EXTERNAL_METRIC_GRAIN');
    const metricLabels={};
    for(const name of EXTERNAL_METRICS[kind]){if(!Object.hasOwn(names,name))continue;const text=cleanText(names[name],EXTERNAL_LIMITS.label,`${where} ${name} 이름표`);if(text)metricLabels[name]=text;}
    if(Object.keys(metricLabels).length)labels.metricLabels=metricLabels;
  }
  return labels;
}
// 게시물 번호는 플랫폼마다 게시물 하나를 여는 공식 주소 모양에서만 꺼낸다. 계정 이름 칸을 게시물 번호로 쓰지 않는다.
function postRoute(platform,link){
  const s=link.segments,low=s.map(value=>value.toLowerCase()),q=link.query,n=s.length,num=value=>/^\d{1,30}$/.test(value||'');
  switch(platform){
    case 'youtube':return link.host==='youtu.be'?(n===1?{id:s[0]}:null):n===1&&low[0]==='watch'&&q.get('v')?{id:q.get('v')}:n===2&&['shorts','live'].includes(low[0])?{id:s[1]}:null;
    case 'instagram':return n===2&&['p','reel','reels','tv'].includes(low[0])?{id:s[1]}:null;
    case 'facebook':return n===3&&['posts','videos'].includes(low[1])?{id:s[2],owner:s[0]}:n===2&&low[0]==='reel'?{id:s[1]}:n===1&&low[0]==='permalink.php'&&q.get('story_fbid')?{id:q.get('story_fbid'),...(q.get('id')?{owner:q.get('id')}:{})}:null;
    case 'tiktok':return n===3&&s[0].startsWith('@')&&['video','photo'].includes(low[1])&&num(s[2])?{id:s[2],owner:s[0]}:null;
    case 'threads':return n===3&&s[0].startsWith('@')&&low[1]==='post'?{id:s[2],owner:s[0]}:null;
    case 'x':return n===3&&low[1]==='status'&&num(s[2])?{id:s[2],owner:s[0]}:null;
    case 'linkedin':return n===2&&low[0]==='posts'?{id:s[1]}:n===3&&low[0]==='feed'&&low[1]==='update'?{id:s[2]}:null;
    case 'telegram':case 'kakao-channel':case 'brunch':return n===2&&num(s[1])?{id:s[1],owner:s[0]}:null;
    case 'naver-blog':return n===2&&num(s[1])?{id:s[1],owner:s[0]}:n===1&&low[0]==='postview.naver'&&num(q.get('logNo'))&&q.get('blogId')?{id:q.get('logNo'),owner:q.get('blogId')}:null;
    case 'behance':return (n===2||n===3)&&low[0]==='gallery'&&num(s[1])?{id:s[1]}:null;
    case 'tistory':return n===1&&num(s[0])?{id:s[0]}:n===2&&low[0]==='entry'&&s[1]?{id:s[1]}:null;
    case 'pinterest':return n===2&&low[0]==='pin'&&num(s[1])?{id:s[1]}:null;
    case 'substack':return n===2&&low[0]==='p'?{id:s[1]}:null;
    case 'douyin':return n===2&&['video','note'].includes(low[0])&&num(s[1])?{id:s[1]}:null;
    case 'xiaohongshu':return n===2&&low[0]==='explore'&&XHS_NOTE.test(s[1])?{id:s[1]}:n===4&&low[0]==='user'&&low[1]==='profile'&&XHS_NOTE.test(s[3])?{id:s[3],profile:s[2]}:null;
    case 'rutube':return n===2&&low[0]==='video'&&/^[A-Za-z0-9]{6,64}$/.test(s[1])?{id:s[1]}:null;
    // VK는 벽 글(wall-<소유자>_<번호>)과 클립(clip-<소유자>_<번호>)을 받는다. 벽 글은 wall을 뺀 API 표기도 같은 글로 받는다.
    // 클립은 wall을 뺀 표기가 벽 글 번호와 겹치므로 clip이 붙은 표기 하나만 받는다(11-19). 게시결과도 vk.ru/clip-… 꼴로 적는다.
    // 소유자 칸(커뮤니티는 -<번호>)은 owner로 넘겨 rowOf가 이 채널의 VK 소유자 번호와 대조한다.
    case 'vk':{const m=n===1?/^(wall|clip)((-?\d{1,15})_\d{1,20})$/i.exec(s[0]):null;return !m?null:m[1].toLowerCase()==='wall'?{id:'wall'+m[2],aliases:[m[2]],owner:m[3]}:{id:'clip'+m[2],owner:m[3]};}
    default:return null;
  }
}
// 로그인 통계 화면과 공식 내보내기는 그 플랫폼의 통계 경로여야 하고, 주소에 든 계정 번호나 이름은 아는 값과 같아야 한다.
// 주소에 계정을 가리키는 값이 있으면, 이미 아는 값(원장·채널의 외부 번호, 등록 주소의 계정 키, 등록 handle)과 같아야 한다. 모르는 값은 받지 않는다.
// 계정 값이 없는 경로는 경로만 보고, 계정 확인은 화면에서 옮겨 적은 handle·번호 대조에 맡긴다. 서버는 그 화면에 실제로 로그인했는지 확인하지 못하며, 관리자가 본 화면의 주소를 기록할 뿐이다.
// 채널 하나의 계정 식별 문맥(11-14 설계 정리). record()에서 한 번 만들고 출처 주소(screenRoute·publicRoute)와 게시물 주소(rowOf)가 같은 기준으로 쓴다.
// ids: 외부 번호(원장·채널), 그리고 플랫폼 공식 호스트의 등록 주소에서 모양을 확인하고 꺼낸 번호(YouTube /channel/UC…, RedNote /user/profile/<24자리>,
//      RUTUBE /channel/<숫자>, Facebook profile.php?id=<숫자>). 번호는 글자 그대로 비교하고, 이름에서 번호를 추측하지 않는다.
// names: 등록 handle과 등록 주소의 이름 칸(Facebook 주소 이름, LinkedIn /company/<이름>). 이름은 대소문자를 가리지 않는다.
// ownSegment: 계정 칸이 주소 첫 칸인 플랫폼(Telegram·네이버 블로그·Kakao·Brunch)에서 실제 등록 주소의 첫 칸 하나. handle 같은 다른 별칭은 섞지 않는다.
//      Kakao(_로 시작)와 Brunch(@@로 시작)의 인코딩 번호는 글자 그대로, Telegram·네이버 블로그 이름은 대소문자를 가리지 않고 비교한다.
// 호스트는 www·m을 뗀 이름으로 비교한다(공식 www·모바일 별칭). externalIds에는 외부 번호만 있다(Facebook Business Suite asset_id 비교용).
function channelIdentity(platform,rule,live,account,ownHost){
  const hostKey=value=>String(value||'').toLowerCase().replace(/^(?:www|m)\./,''),official=new Set([...rule.post,...rule.source,...(ownHost?[ownHost]:[])].map(hostKey));
  const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
  const urls=[[live.publicUrl,false],[live.canonicalUrl,false],[account.publicUrl,true]].flatMap(([value,fromCatalog])=>{try{const url=new URL(String(value));return url.protocol==='https:'&&official.has(hostKey(url.hostname))?[{host:hostKey(url.hostname),segments:decodeURIComponent(url.pathname).split('/').filter(Boolean),query:url.searchParams,fromCatalog}]:[];}catch{return [];}});
  // 옛 Facebook 채널의 저장 번호가 이 원장 계정과 같은 공개 프로필 번호이고 원장의 Business Suite 번호와 다를 때만(facebookLegacyPublicId) 외부 번호(asset_id)에서 뺀다. 원장 번호가 없거나 같으면 저장 번호를 그대로 둔다. 공개 번호는 아래 등록 주소 해석이 ids에 넣는다.
  const externalIds=new Set([facebookLegacyPublicId(live,account)?null:live.externalId,account.externalId].map(text).filter(Boolean)),ids=new Set(externalIds);
  const names=new Set([live.handle,account.handle].map(text).filter(Boolean).flatMap(value=>{const key=value.toLowerCase();return [key,key.replace(/^@/,'')];}));
  // 원장 행의 공식 공개 주소(account.publicUrl)에서 꺼낸 번호와 이름은 catalog에도 따로 모은다(11-15 재검수 P1). bindIdentity는 화면 속 계정 값의 근거로 이것만 더 쓴다. 채널 문서의 주소에서 꺼낸 값은 출처 주소와 게시물 주소 검사에만 쓴다.
  const catalog={ids:new Set(),names:new Set()};
  for(const {segments,query,fromCatalog} of urls){
    const low=segments.map(value=>value.toLowerCase()),n=segments.length,id=value=>{ids.add(value);if(fromCatalog)catalog.ids.add(value);},name=value=>{names.add(value);if(fromCatalog)catalog.names.add(value);};
    if(platform==='youtube'&&n===2&&low[0]==='channel'&&/^UC[\w-]{22}$/.test(segments[1]))id(segments[1]);
    if(platform==='xiaohongshu'&&n===3&&low[0]==='user'&&low[1]==='profile'&&XHS_NOTE.test(segments[2]))id(segments[2]);
    if(platform==='rutube'&&n===2&&low[0]==='channel'&&/^\d{1,30}$/.test(segments[1]))id(segments[1]);
    if(platform==='facebook'&&n===1&&low[0]==='profile.php'&&/^\d{1,30}$/.test(query.get('id')||''))id(query.get('id'));
    if(platform==='facebook'&&n===1&&low[0]!=='profile.php'&&/^[a-z0-9.]{2,100}$/.test(low[0]))name(low[0]);
    // /people/<표시 이름>/<번호>로 등록된 Facebook 페이지는 번호만 근거로 꺼낸다. 표시 이름은 소유 근거로 쓰지 않는다.
    if(platform==='facebook'&&n===3&&low[0]==='people'&&/^\d{1,30}$/.test(segments[2]))id(segments[2]);
    if(platform==='linkedin'&&n===2&&low[0]==='company')name(low[1]);
  }
  // 계정 칸 플랫폼의 소유자는 등록 주소가 정확한 프로필 경로일 때만 꺼낸다: /<계정>, 또는 공개 미리보기 /<접두 칸>/<계정>(Telegram /s/<채널>). 다른 모양이나 handle은 쓰지 않는다.
  const profileOwner=({segments})=>segments.length===1?segments[0]:segments.length===2&&(rule.publicPrefix||[]).includes(segments[0].toLowerCase())?segments[1]:null;
  const ownSegment=rule.ownerSegment?urls.map(profileOwner).find(Boolean)||null:null,exactOwner=!!ownSegment&&/^(?:_|@@)/.test(ownSegment);
  // VK 게시물 주소의 소유자 칸과 대조할 값: 원장·채널의 숫자 외부 번호와 VK_COMMUNITY_IDS의 커뮤니티 번호. 커뮤니티 글의 소유자 칸은 -<번호>라 그 꼴로 모은다.
  const vkOwners=new Set(platform==='vk'?[...externalIds,VK_COMMUNITY_IDS[account.id]].map(value=>/^-?\d{1,15}$/.test(String(value||''))?'-'+String(value).replace(/^-/,''):null).filter(Boolean):[]);
  return {ownHost,ownerSegment:rule.ownerSegment===true,prefix:rule.publicPrefix||[],externalIds,catalog,
    ownsVkOwner:value=>typeof value==='string'&&vkOwners.has(value),
    ownsId:value=>typeof value==='string'&&ids.has(value),
    ownsName:value=>typeof value==='string'&&!!value&&(names.has(value.toLowerCase())||names.has(value.toLowerCase().replace(/^@/,''))),
    ownerIs:value=>!!ownSegment&&typeof value==='string'&&(exactOwner?value===ownSegment:value.toLowerCase()===ownSegment.toLowerCase()),
    registered:(link,count,exact=[])=>link.segments.length>=count&&urls.some(own=>own.host===hostKey(link.host)&&own.segments.length===count&&own.segments.every((segment,index)=>exact.includes(index)?segment===link.segments[index]:segment.toLowerCase()===link.segments[index].toLowerCase()))};
}
// sourceType은 creator-screen 또는 official-export다. 로그인 화면이지만 내보내기 파일이 아닌 경로는 creator-screen에서만 받는다.
function screenRoute(platform,link,ctx,sourceType){
  const s=link.segments,low=s.map(value=>value.toLowerCase()),h=link.host,at=(...parts)=>parts.every((part,index)=>low[index]===part);
  const known=value=>ctx.ownsId(value),mine=value=>ctx.ownsName(value);
  const insights=check=>['business.facebook.com','www.facebook.com'].includes(h)&&at('latest','insights')&&(!check||!link.rawQuery.get('asset_id')||ctx.externalIds.has(link.rawQuery.get('asset_id')));
  switch(platform){
    case 'youtube':return h==='studio.youtube.com'&&at('channel')&&/^UC[\w-]{22}$/.test(s[1]||'')&&known(s[1])&&low[2]==='analytics';
    // Business Suite 주소의 asset_id는 연결된 Facebook 페이지 번호라서 Instagram 계정을 증명하지 못한다. Instagram에서는 경로만 본다.
    case 'instagram':return h==='www.instagram.com'?at('accounts','insights'):insights(false);
    case 'facebook':return h==='www.facebook.com'&&at('professional_dashboard')||insights(true);
    case 'tiktok':return at('tiktokstudio');
    case 'threads':return at('insights');
    case 'x':return at('i','account_analytics');
    case 'linkedin':return at('analytics','creator')||at('company')&&low[2]==='admin'&&low[3]==='analytics'&&(mine(s[1])||known(s[1]));
    case 'telegram':return s.length<=1&&(!s.length||['a','k','z'].includes(low[0]));
    case 'behance':return low[0]==='insights'||mine(s[0])&&low[1]==='insights';
    case 'naver-clip':return h==='creator-advisor.naver.com';
    // 주인이 로그인해 연 자기 블로그 글 목록(blog.naver.com/<등록 주소의 첫 칸>)도 받는다(11-23). 글별 누적 조회수(readCount)는 주인 세션에만 차고 로그인 없이는 빈칸이라
    // 공개 화면이 아니고 내보내기 파일도 아니어서 creator-screen으로만 받는다. 글 하나의 주소, 글 번호(logNo)를 쿼리에 단 옛 글 링크, 다른 블로그의 목록은 받지 않는다.
    case 'naver-blog':return h==='creator-advisor.naver.com'||(h==='admin.blog.naver.com'&&ctx.ownerIs(s[0])&&low[1]==='stat')
      ||(sourceType==='creator-screen'&&h==='blog.naver.com'&&s.length===1&&ctx.ownerIs(s[0])&&![...link.rawQuery.keys()].some(key=>key.toLowerCase()==='logno'));
    case 'tistory':return h===ctx.ownHost&&at('manage','statistics');
    case 'pinterest':return h==='analytics.pinterest.com'||at('business','hub')||at('analytics');
    case 'kakao-channel':return h==='business.kakao.com'&&at('space')&&low[2]==='channel'&&ctx.ownerIs(s[3])&&low[4]==='statistics';
    case 'substack':return h===ctx.ownHost&&at('publish','stats');
    case 'brunch':return ['stats','statistics'].includes(low[0])||ctx.ownerIs(s[0])&&['stats','statistics'].includes(low[1]);
    case 'douyin':return h==='creator.douyin.com';
    case 'xiaohongshu':return ['creator.rednote.com','creator.xiaohongshu.com'].includes(h);
    case 'rutube':return h==='studio.rutube.ru';
    case 'vk':return at('groups','dashboard')&&mine(s[2])||at('stats');
    default:return false;
  }
}
// public-page는 이 계정의 공개 프로필 첫 화면(확인된 공개 탭 포함)이거나, 주소에 계정이 드러나는 이 계정의 게시물이어야 한다.
// 프로필 모양은 플랫폼마다 정해 둔 것만 받는다. 주소 속 계정 값은 등록 handle, 등록 주소의 계정 키, 이미 아는 계정 번호, 등록 주소 자체 가운데 하나와 같아야 한다.
// 다른 계정의 공개 화면, 로그인해야 보이는 통계 경로, 계정을 증명할 수 없는 주소는 모두 거절한다.
function publicRoute(platform,link,ctx){
  const s=link.segments,low=s.map(value=>value.toLowerCase()),n=s.length,mine=value=>ctx.ownsName(value),known=value=>ctx.ownsId(value),ownHost=ctx.ownHost,prefix=ctx.prefix;
  // 여러 칸으로 된 공개 프로필(/channel/<번호>, YouTube 옛 주소 /c/<이름>·/user/<이름>, /company/<이름>, /user/profile/<번호>)은 등록 주소의 같은 칸과 정확히 같으면 이 계정으로 본다.
  // YouTube 옛 주소는 handle과 이름이 같아 보여도 같은 계정으로 추측하지 않고, 등록 주소의 /c/·/user/ 앞부분과 정확히 같을 때만 받는다.
  // 등록 주소는 원장이나 채널에 실제로 저장된 공식 공개 주소이고, 프로필 모양을 먼저 확인하므로 대시보드나 로그인 경로는 여기로 들어오지 못한다.
  // 등록 주소의 프로필 열쇠: 호스트는 소문자로(www 제거) 비교하고, 경로는 칸마다 비교한다. 번호처럼 대소문자를 가리는 칸(exact에 적은 위치)은 글자 그대로,
  // 대소문자를 가리지 않는 이름 칸(YouTube /c/·/user/ 이름, LinkedIn 회사 이름)은 소문자로 비교한다. 등록 주소는 그 프로필 자체(칸 수까지)와 같아야 한다.
  const tabs=['videos','shorts','streams','featured','about','playlists'];
  const registered=(count,exact=[])=>ctx.registered(link,count,exact);
  const ownPost=()=>{const route=postRoute(platform,link);return !!route?.owner&&mine(String(route.owner).toLowerCase());};
  switch(platform){
    case 'telegram':case 'naver-blog':case 'kakao-channel':case 'brunch':{const at=prefix.includes(low[0])?1:0,route=postRoute(platform,link);return ctx.ownerIs(s[at])&&n===at+1||!!route&&ctx.ownerIs(route.owner);}
    case 'instagram':case 'x':case 'pinterest':return n===1&&mine(low[0])||ownPost();
    // VK 공개 클립 목록(/clips/<커뮤니티>)은 그 커뮤니티의 클립만 모아 보이고, 클립은 이 목록 위에 열린다(11-19 실화면). VK 게시물 주소에는 계정 이름이 없어 ownPost는 쓰지 않는다.
    case 'vk':return n===1&&mine(low[0])||n===2&&low[0]==='clips'&&mine(s[1]);
    case 'threads':case 'tiktok':case 'naver-clip':return n===1&&low[0].startsWith('@')&&mine(low[0])||ownPost();
    case 'behance':return mine(low[0])&&(n===1||n===2&&low[1]==='info');
    case 'youtube':{if(link.host==='youtu.be')return false;const at=low[0]?.startsWith('@')?1:['channel','c','user'].includes(low[0])?2:0,owned=at===1?mine(s[0]):at===2&&(low[0]==='channel'&&known(s[1])||registered(2,low[0]==='channel'?[1]:[]));return !!owned&&(n===at||n===at+1&&tabs.includes(low[at]));}
    case 'facebook':return n===1&&(low[0]==='profile.php'?known(link.query.get('id')):mine(s[0])||known(s[0]))||n===3&&low[0]==='people'&&/^\d{1,30}$/.test(s[2])&&known(s[2]);
    case 'linkedin':return low[0]==='company'&&(n===2||n===3&&low[2]==='posts')&&(mine(s[1])||known(s[1]))||low[0]==='in'&&n===2&&registered(2);
    case 'xiaohongshu':return low[0]==='user'&&low[1]==='profile'&&known(s[2])&&(n===3||n===4&&XHS_NOTE.test(s[3]));
    case 'rutube':return low[0]==='channel'&&n===2&&known(s[1]);
    case 'tistory':case 'substack':return !!ownHost&&link.host===ownHost&&(n===0||!!postRoute(platform,link));
    default:return false;
  }
}
function rowOf(raw,index,{platform,postHosts,ctx,observedAt,observedDate}){
  const where=`${index+1}번째 관측`;
  if(!plain(raw))throw invalid(`${where}: 형식을 확인해 주세요.`);
  const kind=raw.kind;
  if(!EXTERNAL_KINDS.includes(kind))throw invalid(`${where}: 종류(kind)는 post-lifetime·account-period·account-lifetime 중 하나예요.`,'SYNK_EXTERNAL_METRIC_GRAIN');
  const extra=Object.keys(raw).filter(key=>!ROW_KEYS[kind].includes(key));
  if(extra.length)throw invalid(`${where}: ${kind}이 쓰지 않는 칸이 있어요(${extra.slice(0,5).join(', ')}). 기간 합계·누적·게시물 값을 한 줄에 섞지 마세요.`,'SYNK_EXTERNAL_METRIC_GRAIN');
  const metrics=metricsOf(kind,raw.metrics,where),labels=labelsOf(raw.labels,kind,where);
  let period=null,post=null;
  if(kind==='account-period'){
    const value=raw.period;
    if(!plain(value)||Object.keys(value).some(key=>!['start','end'].includes(key)))throw invalid(`${where}: 기간(period)은 start·end 두 칸이에요.`,'SYNK_EXTERNAL_PERIOD');
    const start=calendarDay(value.start,`${where} 시작일`),end=calendarDay(value.end,`${where} 끝일`);
    if(start>end)throw invalid(`${where}: 시작일이 끝일보다 늦어요.`,'SYNK_EXTERNAL_PERIOD');
    const days=Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1;
    if(days>EXTERNAL_LIMITS.periodDays)throw invalid(`${where}: 기간은 ${EXTERNAL_LIMITS.periodDays}일까지 받아요.`,'SYNK_EXTERNAL_PERIOD');
    if(end>observedDate)throw invalid(`${where}: 관측한 날(${observedDate}, 한국 날짜)보다 늦게 끝나는 기간이에요.`,'SYNK_EXTERNAL_PERIOD');
    period={start,end,days};
  }
  if(kind==='post-lifetime'){
    const value=raw.post;
    if(!plain(value)||Object.keys(value).some(key=>!['externalId','url','publishedAt','title'].includes(key)))throw invalid(`${where}: 게시물(post)은 externalId·url·publishedAt(·title)이에요.`,'SYNK_EXTERNAL_POST');
    if(typeof value.externalId!=='string'||!POST_ID.test(value.externalId))throw invalid(`${where}: 게시물 번호(externalId)를 확인해 주세요.`,'SYNK_EXTERNAL_POST');
    const link=officialUrl(value.url,postHosts,{label:`${where} 게시물 주소`,code:'SYNK_EXTERNAL_POST',keepQuery:POST_QUERY}),route=postRoute(platform,link);
    if(!route||!POST_ID.test(route.id))throw invalid(`${where}: 이 플랫폼에서 게시물 하나를 여는 공식 주소 모양이 아니에요.`,'SYNK_EXTERNAL_POST');
    // 게시물 주소의 계정 칸: 계정 칸 플랫폼은 실제 등록 주소의 첫 칸과, Facebook 숫자 칸은 아는 번호와, 그 밖의 이름은 등록 handle·등록 주소 이름과 같아야 한다.
    // VK는 소유자 칸을 이 채널의 커뮤니티 번호(-<번호>)와 견준다. 모르는 번호의 글과 클립은 받지 않는다.
    const ownerOk=ctx.ownerSegment?ctx.ownerIs(route.owner):platform==='vk'?ctx.ownsVkOwner(route.owner):!route.owner||(platform==='facebook'&&/^\d{1,30}$/.test(route.owner)?ctx.ownsId(route.owner):ctx.ownsName(route.owner));
    if(!ownerOk)throw invalid(`${where}: 게시물 주소가 이 계정의 게시물이 아니에요.`,'SYNK_EXTERNAL_POST');
    if(route.profile&&!ctx.ownsId(route.profile))throw invalid(`${where}: 게시물 주소에 든 프로필 번호를 이 계정의 번호로 확인하지 못했어요.`,'SYNK_EXTERNAL_POST');
    if(route.id!==value.externalId&&!(route.aliases||[]).includes(value.externalId))throw invalid(`${where}: 게시물 번호가 주소에 든 게시물 번호(${route.id})와 달라요.`,'SYNK_EXTERNAL_POST');
    const publishedAt=instant(value.publishedAt,`${where} 게시 시각`,'SYNK_EXTERNAL_POST');
    if(publishedAt>observedAt)throw invalid(`${where}: 게시 시각이 관측 시각보다 뒤예요.`,'SYNK_EXTERNAL_POST');
    const title=value.title===undefined||value.title===null?null:cleanText(value.title,EXTERNAL_LIMITS.title,`${where} 게시물 제목`,'SYNK_EXTERNAL_POST')||null;
    // 같은 게시물의 다른 표기(VK에서 wall을 뺀 번호)는 공식 표기 하나로 저장해서, 기록 ID와 게시물 ID가 갈라지지 않게 한다.
    post={externalId:route.id,url:link.href,publishedAt,title};
  }
  return {kind,period,post,metrics,labels};
}
function accountFor(channel,catalog){
  if(channel.catalogAccountId){
    const bound=catalog.accounts.find(account=>account.id===channel.catalogAccountId);
    return bound&&MANAGED.has(bound.accountStatus)&&platformKey(bound.platform)===platformKey(channel.platform)?bound:null;
  }
  return matchAccount(channel,catalog);
}
// 화면 속 계정 이름·번호가 원장·채널 값과 정확히 같을 때만 받는다. 하나라도 다르면 다른 계정 화면으로 보고 거절한다.
// catalog는 channelIdentity가 확인된 원장 행의 공식 공개 주소(account.publicUrl)에서만 꺼낸 번호와 이름이다(11-15 재검수 P1). 원장 externalId가 Graph 번호인 Facebook 행은 여기서 profile.php?id=의 공개 프로필 번호를 얻는다.
// 채널 문서의 publicUrl과 canonicalUrl에서 꺼낸 값은 계정 값으로 쓰지 않는다. 그 주소가 원장과 다르게 바뀌어 있어도 새 계정 값이 생기지 않게 하려는 것이다. 넣은 칸이 모두 맞아야 한다는 규칙은 그대로다.
function bindIdentity(input,channel,account,catalog){
  if(!plain(input))throw invalid('계정 확인(identity)에 accountId와 화면 속 handle 또는 externalId를 넣어 주세요.','SYNK_EXTERNAL_IDENTITY');
  const extra=Object.keys(input).filter(key=>!['accountId','handle','externalId'].includes(key));
  if(extra.length)throw invalid(`계정 확인에 알 수 없는 칸이 있어요(${extra.slice(0,5).join(', ')}).`,'SYNK_EXTERNAL_IDENTITY');
  if(input.accountId!==account.id)throw invalid('이 채널에 묶인 원장 계정 ID와 달라요.','SYNK_EXTERNAL_IDENTITY');
  const norm=value=>value.trim().replace(/^@/,'').toLowerCase();
  const handles=new Set([channel.handle,account.handle,...(catalog?.names||[])].filter(value=>typeof value==='string'&&value.trim()).map(norm));
  const ids=new Set([channel.externalId,account.externalId,...(catalog?.ids||[])].filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()));
  const proof={accountId:account.id,handle:null,externalId:null,matchedBy:[]};
  for(const [key,accepted,normalize,word] of [['handle',handles,norm,'계정 이름'],['externalId',ids,value=>value.trim(),'계정 번호']]){
    const value=input[key];
    if(value===undefined||value===null)continue;
    if(typeof value!=='string'||!value.trim()||value.length>200)throw invalid(`화면 속 ${word} 값을 확인해 주세요.`,'SYNK_EXTERNAL_IDENTITY');
    if(!accepted.has(normalize(value)))throw invalid(`화면 속 ${word} 값이 원장·채널과 정확히 같지 않아요. 다른 계정의 화면일 수 있어요.`,'SYNK_EXTERNAL_IDENTITY');
    proof[key]=value.trim();proof.matchedBy.push(key);
  }
  if(!proof.matchedBy.length)throw invalid('화면에서 확인한 계정 이름(handle)이나 계정 번호(externalId)를 넣어 주세요.','SYNK_EXTERNAL_IDENTITY');
  return proof;
}

export function publicRecord(row){
  if(!row)return null;
  const {fingerprint:_fingerprint,...rest}=row;
  return rest;
}

// 채널 카드·계정 지도용 요약. API 연결(connected)과 따로 두고 수집 성공으로 세지 않는다.
// 요약의 출처·종류·수치·시각(lastObservedAt, observedAt)은 모두 같은 관측 하나(main)에서 가져온다. 계정 단위 관측이 있으면 그것을 고른다.
// 종류와 상관없이 가장 늦은 관측 시각은 lastObservedAtAnyKind라는 별도 이름으로 둔다. 다른 관측의 수치에 이 시각을 붙여 보여 주지 않기 위해서다.
export function externalCollectionSummary(store,channel){
  if(!channel?.id)return null;
  const state=store.get(EXTERNAL_STATE_KIND,channel.id);
  if(!state?.lastObservedAt||!plain(state.latest))return null;
  const life=state.latest['account-lifetime'],period=state.latest['account-period'],post=state.latest['post-lifetime'];
  const account=life&&period?(life.observedAt>=period.observedAt?life:period):life||period||null;
  const main=account||post;
  if(!main)return null;
  const byKind={};
  for(const kind of EXTERNAL_KINDS){const row=state.latest[kind];if(row)byKind[kind]={sourceType:row.sourceType,sourceBasis:EXTERNAL_SOURCE_BASIS[row.sourceType]||null,observedAt:row.observedAt,period:row.period||null,post:row.post||null,metrics:row.metrics,labels:row.labels||{},sourceLabels:row.sourceLabels||{},basis:EXTERNAL_BASIS[kind]};}
  return {sourceType:main.sourceType,sourceBasis:EXTERNAL_SOURCE_BASIS[main.sourceType]||null,lastObservedAt:main.observedAt,observedAt:main.observedAt,recordId:main.recordId||null,lastObservedAtAnyKind:state.lastObservedAt,kind:main.kind,metrics:main.metrics,period:main.period||null,labels:main.labels||{},basis:EXTERNAL_BASIS[main.kind],
    identityVerified:true,countsAsApiCollection:false,counts:{...(state.counts||{})},byKind};
}

export function createExternalObservations({store,clock=()=>new Date().toISOString(),catalog=accountCatalog,isConnected=()=>false,audit=()=>{}}={}){
  // post-lifetime만 기존 분석 구조에 넣는다. API 플랫폼·연결 채널·다른 출처 기록이 있으면 넣지 않고 관측으로만 남긴다.
  function project(row,channel,{apiPlatform,connected,events}){
    if(apiPlatform)return {state:'kept-separate',reason:'api-platform'};
    if(connected)return {state:'kept-separate',reason:'api-connected'};
    const postId=`${channel.id}:${row.post.externalId}`,previous=store.get('posts',postId);
    if(previous&&!String(previous.source||'').startsWith('external:'))return {state:'kept-separate',reason:'existing-post-other-source',postId};
    const publishedDate=kstDay(Date.parse(row.post.publishedAt));
    if(previous&&previous.publishedDate!==publishedDate)throw invalid('같은 게시물의 게시일이 앞 관측과 달라요. 화면의 게시일을 다시 확인해 주세요.','SYNK_EXTERNAL_POST_MISMATCH',409,{postId});
    const snapshotId=`${postId}:${row.observedDate}`,old=store.get('snapshots',snapshotId);
    if(old&&!String(old.source||'').startsWith('external:'))return {state:'kept-separate',reason:'existing-snapshot-other-source',postId};
    if(old&&String(old.checkedAt)>row.observedAt)return {state:'not-projected',reason:'newer-observation-same-day',postId,snapshotId};
    // 게시물 정보(제목, 출처, 마지막 확인 시각, 관측 ID)는 지금까지 가장 늦게 본 관측만 고친다. 더 이른 관측은 자기 날의 기록만 더한다.
    if(!previous||row.observedAt>=String(previous.lastSeenAt||''))store.put('posts',postId,{...previous,id:postId,channelId:channel.id,externalId:row.post.externalId,title:row.post.title||previous?.title||'제목 없음',url:previous?.url||row.post.url,
      publishedDate,publishedAt:previous?.publishedAt||row.post.publishedAt,thumbnailUrl:previous?.thumbnailUrl||null,publicationFormat:previous?.publicationFormat||null,
      source:'external:'+row.sourceType,externalObservationId:row.id,unavailableAt:null,lastSeenAt:row.observedAt});

    let ownership;
    try{ownership=ownerAt(events,channel,row.observedAt);}catch{ownership={ownerIds:[],teamId:null,known:false};}
    const snapshot={id:snapshotId,postId,date:row.observedDate,checkedAt:row.observedAt,source:'external:'+row.sourceType,externalObservationId:row.id,evidenceSha256:row.evidenceSha256,ownership};
    for(const key of EXTERNAL_METRICS['post-lifetime'])snapshot[key]=Object.hasOwn(row.metrics,key)?row.metrics[key]:null;
    store.put('snapshots',snapshotId,snapshot);
    return {state:'projected',postId,snapshotId,date:row.observedDate};
  }
  function updateState(channelId,records,at){
    const previous=store.get(EXTERNAL_STATE_KIND,channelId);
    const state={id:channelId,channelId,counts:{...(previous?.counts||{})},latest:{...(previous?.latest||{})},lastObservedAt:previous?.lastObservedAt||null,updatedAt:at};
    for(const row of records){
      state.counts[row.kind]=(state.counts[row.kind]||0)+1;
      const current=state.latest[row.kind];
      if(!current||row.observedAt>current.observedAt||(row.observedAt===current.observedAt&&row.recordedAt>=current.recordedAt))
        state.latest[row.kind]={recordId:row.id,kind:row.kind,sourceType:row.sourceType,observedAt:row.observedAt,recordedAt:row.recordedAt,period:row.period,
          post:row.post?{externalId:row.post.externalId,url:row.post.url,publishedAt:row.post.publishedAt}:null,metrics:row.metrics,labels:row.labels,sourceLabels:row.sourceLabels};
      if(!state.lastObservedAt||row.observedAt>state.lastObservedAt)state.lastObservedAt=row.observedAt;
    }
    store.put(EXTERNAL_STATE_KIND,channelId,state);
  }
  function record(user,channel,input){
    if(user?.role!=='admin')throw invalid('외부 통계 기록은 관리자만 할 수 있어요.','SYNK_EXTERNAL_FORBIDDEN',403);
    if(!plain(input))throw invalid('관측 입력을 확인해 주세요.');
    if(Buffer.byteLength(JSON.stringify(input))>EXTERNAL_LIMITS.bytes)throw invalid('관측 입력이 너무 커요. 나눠서 넣어 주세요.','SYNK_EXTERNAL_INPUT',413);
    const extra=Object.keys(input).filter(key=>!TOP_KEYS.includes(key));
    if(extra.length)throw invalid(`알 수 없는 칸이 있어요(${extra.slice(0,5).join(', ')}). 쿠키·토큰 같은 로그인 정보는 받지 않아요.`);
    const live=channel?.id?store.get('channels',channel.id):null;
    if(!live||live.active===false)throw invalid('운영 중인 채널에만 외부 통계를 기록할 수 있어요.','SYNK_EXTERNAL_CHANNEL',409);
    const platform=platformKey(live.platform),rule=EXTERNAL_SOURCE_RULES[platform];
    if(!rule)throw invalid('이 플랫폼은 공식 통계 주소 목록이 아직 없어요.','SYNK_EXTERNAL_SOURCE');
    const account=accountFor(live,catalog);
    if(!account)throw invalid('원장 관리 계정과 짝지어진 채널에만 기록할 수 있어요.','SYNK_EXTERNAL_IDENTITY');
    const sourceType=input.sourceType;
    if(!EXTERNAL_SOURCE_TYPES.includes(sourceType))throw invalid('출처 종류(sourceType)는 creator-screen·official-export·public-page 중 하나예요.','SYNK_EXTERNAL_SOURCE');
    const evidenceSha256=evidenceOf(input.evidenceSha256);
    const nowMs=Date.parse(clock()),observedAt=instant(input.observedAt,'관측 시각(observedAt)','SYNK_EXTERNAL_OBSERVED_AT'),observedMs=Date.parse(observedAt);
    if(observedMs>nowMs+EXTERNAL_LIMITS.futureSkewMs)throw invalid('관측 시각이 지금보다 뒤예요.','SYNK_EXTERNAL_OBSERVED_AT');
    if(observedMs<nowMs-EXTERNAL_LIMITS.maxAgeDays*86400000)throw invalid(`${EXTERNAL_LIMITS.maxAgeDays}일보다 오래된 관측은 받지 않아요.`,'SYNK_EXTERNAL_OBSERVED_AT');
    const ownAddress=live.publicUrl||live.canonicalUrl||account.publicUrl;
    const ownHost=rule.ownHost?(host=>host&&host.endsWith(rule.ownHost)&&host.length>rule.ownHost.length?host:null)(hostOf(ownAddress)):null;
    // public-page는 로그인 통계 호스트가 아니라 게시물 공개 호스트에서만 받는다. 공개 화면을 로그인 화면으로, 로그인 화면을 공개 화면으로 적지 못한다.
    const publicPage=sourceType==='public-page';
    // 계정 식별 문맥을 한 번 만들고 출처 주소(publicRoute·screenRoute)와 게시물 주소(rowOf) 검사에 같이 쓴다.
    const ctx=channelIdentity(platform,rule,live,account,ownHost);
    // 출처 주소에 남기는 쿼리는 계정을 가리키는 칸뿐이다: Facebook profile.php의 id, 네이버 블로그 PostView의 blogId·logNo. 토큰·추적값은 지운다.
    const sourcePath=(()=>{try{return new URL(String(input.sourceUrl).trim()).pathname.toLowerCase();}catch{return '';}})();
    const sourceQuery=publicPage&&platform==='facebook'&&sourcePath==='/profile.php'?['id']:publicPage&&platform==='naver-blog'&&sourcePath==='/postview.naver'?['blogId','logNo']:[];
    const source=officialUrl(input.sourceUrl,[...(publicPage?rule.post:rule.source),...(ownHost?[ownHost]:[])],{label:publicPage?'공개 화면 주소(sourceUrl)':'통계 화면 주소(sourceUrl)',code:'SYNK_EXTERNAL_SOURCE',keepQuery:sourceQuery});



    if(publicPage&&!publicRoute(platform,source,ctx))throw invalid('공개 화면 주소가 이 계정의 공개 프로필이나 이 계정의 게시물 주소가 아니에요. 로그인해야 보이는 통계 화면이라면 creator-screen으로 기록해 주세요.','SYNK_EXTERNAL_SOURCE');
    if(!publicPage&&!screenRoute(platform,source,ctx,sourceType))throw invalid('통계 화면 주소가 이 플랫폼의 로그인 통계나 내보내기 화면 경로가 아니거나, 주소에 든 계정 번호나 이름이 이 채널과 달라요.','SYNK_EXTERNAL_SOURCE');
    const identity=bindIdentity(input.identity,live,account,ctx.catalog);
    let exportFormat=null;
    if(input.exportFormat!==undefined&&input.exportFormat!==null){
      if(sourceType!=='official-export')throw invalid('내보내기 형식(exportFormat)은 공식 내보내기에만 적어요.','SYNK_EXTERNAL_SOURCE');
      if(!EXPORT_FORMATS.includes(input.exportFormat))throw invalid(`내보내기 형식은 ${EXPORT_FORMATS.join('·')} 중 하나예요.`,'SYNK_EXTERNAL_SOURCE');
      exportFormat=input.exportFormat;
    }
    const sourceLabels=labelsOf(input.labels,null,'요청');
    if(!Array.isArray(input.observations)||!input.observations.length||input.observations.length>EXTERNAL_LIMITS.rows)throw invalid(`관측(observations)은 한 번에 1~${EXTERNAL_LIMITS.rows}개 넣어 주세요.`);
    const observedDate=kstDay(observedMs);
    const rows=input.observations.map((raw,index)=>rowOf(raw,index,{platform,postHosts:[...rule.post,...(ownHost?[ownHost]:[])],ctx,observedAt,observedDate}));
    // 출처 화면마다 받는 관측을 좁힌다(11-19).
    // ① VK 공개 클립 목록에서는 클립만, 커뮤니티 첫 화면에서는 벽 글만 받는다. 같은 숫자의 클립과 벽 글이 서로의 값을 받지 않게 한다.
    //    커뮤니티 첫 화면의 벽 글은 운영판처럼 wall을 뺀 API 표기도 받는다(클립 번호만 막는다).
    // ② 공개 클립 목록은 게시물 목록이라 게시물 누적값만 받는다. 계정 합계로 적지 못한다.
    const seg=source.segments.map(value=>value.toLowerCase()),posts=rows.filter(row=>row.kind==='post-lifetime');
    const vkClips=platform==='vk'&&publicPage&&seg.length===2&&seg[0]==='clips',vkWall=platform==='vk'&&publicPage&&seg.length===1;
    if(vkClips&&posts.some(row=>!row.post.externalId.toLowerCase().startsWith('clip')))throw invalid('VK 공개 클립 목록에서 읽은 게시물은 클립(clip-…)이어야 해요.','SYNK_EXTERNAL_POST');
    if(vkWall&&posts.some(row=>row.post.externalId.toLowerCase().startsWith('clip')))throw invalid('VK 커뮤니티 첫 화면에서 읽은 게시물은 벽 글(wall-…)이어야 해요. 클립은 공개 클립 목록 주소로 적어 주세요.','SYNK_EXTERNAL_POST');
    if(vkClips&&rows.some(row=>row.kind!=='post-lifetime'))throw invalid('게시물 목록에서는 게시물 누적값(post-lifetime)만 기록해요.','SYNK_EXTERNAL_METRIC_GRAIN');
    // ③ 네이버 블로그 글의 숫자는 주인이 로그인해 연 글 목록에서만 받는다(11-23). 글별 조회수는 로그인 없이 빈칸이라 공개 화면(public-page)의 글 관측은 받지 않고,
    //    다른 통계 화면이나 내보내기의 글 관측도 받지 않는다. 조회수 없는 글 관측이 같은 날 목록의 조회수를 빈칸으로 덮지 않게 한다(GPT GA1). 계정 값은 그대로 받는다.
    //    주인 글 목록은 게시물 목록이라 글 누적값만 받고, 글마다 조회수가 숫자로 있어야 한다. 조회수가 빈 줄은 주인 화면이 아니라는 뜻이다.
    const naverList=platform==='naver-blog'&&!publicPage&&source.host==='blog.naver.com'&&seg.length===1;
    if(platform==='naver-blog'&&!naverList&&posts.length)throw invalid('네이버 블로그 글의 숫자는 블로그 주인이 로그인해 연 글 목록(https://blog.naver.com/<아이디>, creator-screen)에서만 받아요.','SYNK_EXTERNAL_SOURCE');
    if(naverList&&rows.some(row=>row.kind!=='post-lifetime'))throw invalid('게시물 목록에서는 게시물 누적값(post-lifetime)만 기록해요.','SYNK_EXTERNAL_METRIC_GRAIN');
    if(naverList&&posts.some(row=>typeof row.metrics.views!=='number'))throw invalid('네이버 블로그 주인 글 목록의 글마다 조회수(views)가 있어야 해요. 조회수가 비었다면 주인으로 로그인한 화면이 아니에요.','SYNK_EXTERNAL_SOURCE');
    const recordedAt=new Date(nowMs).toISOString();
    const drafts=rows.map(row=>({
      id:'xmo_'+sha(JSON.stringify(['v1',live.id,row.kind,row.period?`${row.period.start}..${row.period.end}`:'',row.post?.externalId||'',evidenceSha256])).slice(0,40),
      channelId:live.id,accountId:account.id,platform,kind:row.kind,sourceType,source:'external:'+sourceType,sourceUrl:source.href,sourceHost:source.host,exportFormat,
      observedAt,observedDate,recordedAt,recordedBy:user.id,evidenceSha256,identity:{...identity,verifiedAt:recordedAt},identityVerified:true,countsAsApiCollection:false,
      period:row.period,post:row.post,metrics:row.metrics,labels:row.labels,sourceLabels,
      fingerprint:sha(JSON.stringify(['v1',sourceType,source.href,exportFormat,observedAt,account.id,row.kind,row.period,row.post,row.metrics,row.labels,sourceLabels])),projection:null}));
    const seen=new Set();
    for(const draft of drafts){if(seen.has(draft.id))throw invalid('같은 증거로 같은 종류·기간·게시물 관측이 두 번 들어 있어요.','SYNK_EXTERNAL_DUPLICATE_ROW');seen.add(draft.id);}
    return store.transaction(()=>{
      const prior=store.all(EXTERNAL_OBSERVATION_KIND).filter(row=>row.evidenceSha256===evidenceSha256);
      if(prior.some(row=>row.channelId!==live.id))throw invalid('이 증거 파일은 다른 채널의 관측에 이미 쓰였어요. 채널마다 그 계정 화면의 원본 파일을 따로 남겨 주세요.','SYNK_EXTERNAL_EVIDENCE_OTHER_CHANNEL',409);
      const differs=prior.find(row=>row.sourceType!==sourceType||row.sourceUrl!==source.href||row.observedAt!==observedAt||row.accountId!==account.id||(row.exportFormat??null)!==exportFormat);
      if(differs)throw invalid('같은 증거 파일인데 출처 주소·관측 시각이 앞 기록과 달라요. 앞 기록은 바꾸지 않았어요.','SYNK_EXTERNAL_EVIDENCE_CONFLICT',409,{recordIds:[differs.id]});
      const created=[],existing=[],conflicts=[];
      for(const draft of drafts){const old=store.get(EXTERNAL_OBSERVATION_KIND,draft.id);if(!old)created.push(draft);else if(old.fingerprint===draft.fingerprint)existing.push(old);else conflicts.push(draft.id);}
      if(conflicts.length)throw invalid('같은 증거·같은 칸의 기록이 이미 있는데 값이 달라요. 앞 기록은 바꾸지 않았어요.','SYNK_EXTERNAL_DUPLICATE_CONFLICT',409,{recordIds:conflicts});
      const context={apiPlatform:API_PLATFORMS.has(platform),connected:isConnected(live)===true,events:created.some(row=>row.kind==='post-lifetime')?store.all('ownershipEvents'):[]};
      for(const row of created){if(row.kind==='post-lifetime')row.projection=project(row,live,context);store.put(EXTERNAL_OBSERVATION_KIND,row.id,row);}
      if(created.length){updateState(live.id,created,recordedAt);audit(user,'external-observations-recorded',live.id,{recordIds:created.map(row=>row.id),evidenceSha256,sourceType});}
      const stored=new Map([...created,...existing].map(row=>[row.id,row]));
      return {channelId:live.id,evidenceSha256,created:created.map(row=>row.id),existing:existing.map(row=>row.id),records:drafts.map(draft=>publicRecord(stored.get(draft.id)))};
    });
  }
  function list(user,channel,query=new URLSearchParams()){
    const keys=[...query.keys()];
    if(keys.some(key=>!['kind','limit'].includes(key))||query.getAll('kind').length>1||query.getAll('limit').length>1)throw invalid('조회 조건은 kind·limit을 하나씩만 받아요.');
    const kind=query.get('kind');
    if(kind!==null&&!EXTERNAL_KINDS.includes(kind))throw invalid('관측 종류(kind)는 post-lifetime·account-period·account-lifetime 중 하나예요.');
    const raw=query.get('limit'),limit=raw===null?EXTERNAL_LIMITS.listDefault:Number(raw);
    if(!Number.isInteger(limit)||limit<1||limit>EXTERNAL_LIMITS.listMax)throw invalid(`limit은 1~${EXTERNAL_LIMITS.listMax} 사이 정수예요.`);
    const rows=store.all(EXTERNAL_OBSERVATION_KIND).filter(row=>row.channelId===channel.id&&(!kind||row.kind===kind)).sort(newestFirst);
    return {channelId:channel.id,basis:EXTERNAL_BASIS.analytics,externalCollection:externalCollectionSummary(store,channel),total:rows.length,truncated:rows.length>limit,observations:rows.slice(0,limit).map(publicRecord)};
  }
  // /api/analytics의 별도 키. 넘겨받은 채널(이미 읽기 권한·필터를 거친 후보)의 관측만, 채널별로, 합계 없이 낸다.
  // 선택 기간과의 관계(11-14 실화면 대조): 화면 기본 끝일이 어제라 관측한 날로 거르면 오늘 기록한 어제까지의 값이 모두 빠진다.
  // account-period는 실제 기간이 선택 기간과 겹칠 때, post-lifetime은 게시한 날(한국 날짜)이 선택 기간 안일 때,
  // account-lifetime은 선택 기간과 상관없이 가장 최근 관측으로 낸다. 상세 조회는 모든 관측을 그대로 남긴다.
  // 반복 관측은 수치마다 따로 가린다(11-15 보완 관측 유실 고침). 종류, 기간, 게시물이 같은 관측에서 같은 수치를 같은 정의로 다시 보았으면 가장 최근 관측의 값만 남긴다.
  // 정의는 출처 종류(sourceType), 시간대(timeZone), 단위(unit), 그 수치의 이름표(metricLabels)로 가른다. 시간대와 단위가 그 줄에 없으면 요청 전체의 이름표(sourceLabels)를 쓴다.
  // 이 가운데 하나라도 다르거나 한쪽에만 적혀 있으면 서로 가리지 않는다. 정의가 다른 값이 함께 나가야 화면이 그 값들을 알아보고 한데 묶지 않을 수 있다.
  // 관측은 자기 수치가 모두 더 최근 관측에 다시 나왔을 때만 빠진다. 조회수 내보내기, 프로필 방문 내보내기, 댓글과 공유 화면처럼 따로 본 수치는 각자의 원본으로 남는다.
  // 관측끼리 합치거나 더한 줄은 만들지 않는다. 기간 합계, 누적값, 순 이용자 수는 더하면 뜻이 달라진다.
  function forAnalytics(channels,{start,end}={}){
    const byId=new Map((channels||[]).map(channel=>[channel.id,channel]));
    const selected=row=>{
      if(row.kind==='account-period')return !!row.period&&row.period.start<=end&&row.period.end>=start;
      if(row.kind==='post-lifetime'){const day=publishedDay(row);return day!==null&&day>=start&&day<=end;}
      return row.kind==='account-lifetime';
    };
    const candidates=[],latest=new Map();
    if(byId.size)for(const row of store.all(EXTERNAL_OBSERVATION_KIND)){
      if(!byId.has(row.channelId)||!selected(row))continue;
      candidates.push(row);
      const labels=row.labels||{},source=row.sourceLabels||{},names=labels.metricLabels||{},metrics=Object.keys(row.metrics||{});
      const definition=[row.channelId,row.kind,row.period?`${row.period.start}..${row.period.end}`:'',row.post?.externalId||'',row.sourceType,labels.timeZone??source.timeZone??null,labels.unit??source.unit??null];
      for(const metric of metrics.length?metrics:['']){const key=JSON.stringify([...definition,metric,names[metric]??null]),current=latest.get(key);if(!current||newerObservation(row,current.row))latest.set(key,{row,metric});}
    }
    // 관측마다 그 관측이 가장 최근인 수치만 골라 응답의 metrics에 싣는다(11-15 null 재등장 고침). 줄의 id, 출처, 시각, 기간, 이름표는 그 관측 그대로다.
    // 더 최근 관측이 같은 정의의 같은 수치를 null(화면에 칸은 있었지만 숫자가 없던 칸)로 보였으면 앞 관측의 그 숫자는 응답에서 빠진다. 앞 관측이 다른 수치 때문에 남아도 마찬가지이고, 더 최근 값이 숫자일 때도 같다.
    // 이긴 칸이 모두 null인 관측은 내지 않는다. 수치 칸이 하나도 없는 관측(열쇠 '')은 예전처럼 낸다. 그래서 같은 정의로 같은 수치를 다시 본 관측끼리는 가장 최근 관측 하나만 남는다. 저장된 관측과 상세 조회는 바꾸지 않는다.
    const wins=new Map(),projected=new Map();
    for(const {row,metric} of latest.values()){const mine=wins.get(row.id)||new Set();mine.add(metric);wins.set(row.id,mine);}
    for(const row of candidates){
      const mine=wins.get(row.id);if(!mine)continue;
      const metrics=Object.fromEntries(Object.entries(row.metrics||{}).filter(([metric])=>mine.has(metric)));
      if(mine.has('')||Object.values(metrics).some(value=>value!==null))projected.set(row.id,metrics);
    }
    const rows=candidates.filter(row=>projected.has(row.id)).sort(newestFirst),omittedOlder=candidates.length-rows.length;
    const kept=rows.slice(0,EXTERNAL_LIMITS.analyticsMax),groups=new Map();
    for(const row of kept){
      const channel=byId.get(row.channelId);
      if(!groups.has(channel.id))groups.set(channel.id,{channelId:channel.id,accountId:row.accountId,platform:channel.platform,displayName:channel.displayName||channel.handle||channel.id,observations:[]});
      groups.get(channel.id).observations.push({id:row.id,kind:row.kind,sourceType:row.sourceType,sourceBasis:EXTERNAL_SOURCE_BASIS[row.sourceType]||null,sourceHost:row.sourceHost,observedAt:row.observedAt,observedDate:row.observedDate,period:row.period||null,
        periodMatchesSelection:row.kind==='account-period'&&row.period?row.period.start===start&&row.period.end===end:null,
        post:row.post?{externalId:row.post.externalId,url:row.post.url,publishedAt:row.post.publishedAt}:null,metrics:projected.get(row.id),labels:row.labels||{},sourceLabels:row.sourceLabels||{},basis:EXTERNAL_BASIS[row.kind],projection:row.projection?.state||null});
    }
    // includedInTotals:false는 이 관측 목록 자체를 기존 합계에 더하지 않는다는 뜻이고, 호환을 위해 값을 그대로 둔다.
    // 조건에 맞는 게시물 누적값은 기록할 때 project()가 posts·snapshots에 한 번 넣었으므로 기존 합계에 이미 들어 있다.
    return {start,end,basis:EXTERNAL_BASIS.analytics,includedInTotals:false,
      selection:{'account-period':'source-period-overlaps-selection','post-lifetime':'published-day-in-selection','account-lifetime':'latest-observation',repeats:'newest-source-only'},
      channels:[...groups.values()],truncated:rows.length>kept.length,omittedOlder};
  }
  return {record,list,forAnalytics};
}
