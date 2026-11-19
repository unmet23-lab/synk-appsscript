'use strict';
/**
 * 외부 통계 파싱(2026-11-14) — AI 없이 읽은 크리에이터 화면·공개 화면·공식 내보내기 값을 작업실 외부 관측 봉투로 바꾼다.
 * 봉투는 POST /api/channels/:id/external-observations 본문 그대로다(engagement/company/external-observations.mjs). API 연결로 세지 않는다.
 * 순수 함수만 둔다: 파일·네트워크·현재 시각을 쓰지 않는다. observedAt은 증거에 적힌 캡처 시각 그대로 쓰고,
 * evidenceSha256은 null로 둔다(이 함수는 파일 바이트를 보지 않는다). 증거 파일을 읽어 넘긴 쪽이 그 바이트의 SHA-256(소문자 64자리)을 넣어야 하고,
 * tools/계정통계수집.cjs는 빈 값을 지금 파일 해시로 채우지 않고 거절한다(봉투를 만든 뒤 바뀐 파일을 옛 수치와 묶지 않게).
 * 줄인 수(1.2万·3.4K·1.2만)·소수·빈칸·글자는 고치지 않고 거절한다. 화면에 없던 수치는 0이 아니라 null이다.
 * 알 수 없는 줄·다른 계정 표시가 하나라도 있으면 묶음 전체를 거절한다(일부만 조용히 보내지 않는다). 오류 code는 SYNK_METRICS_<까닭>.
 *
 * parseXhs(evidence, identity) — https://creator.rednote.com/new/note-manager(笔记管理)
 *   evidence {observedAt, accountName, profileId, paginationComplete:true, expectedCount, rows:[{noteId, title, text, metrics:[조회, 댓글, 좋아요, 저장, 공유]}], sourceUrl?, screenTitle?}
 *   identity {accountId, expectedAccountName, externalId(공식 프로필 번호 24자리)}
 *   profileId(필수, 11-14 추가)는 캡처에서 실제로 읽은 공식 프로필 번호이고 externalId와 같아야 한다. 이 칸이 없는 옛 증거는 설정 값으로 채우지 않고 거절한다.
 *   예약 노트도 노트 번호·겹침을 검사하고, expectedCount는 예약을 포함한 고유 노트 수와 맞아야 한다.
 *   text는 줄 구분을 지킨다(실제 꼴: 영상 길이 · 제목 · 「2026-11-13 21:00」 · 수치 다섯 줄). 제목과 다른 줄 하나가 통째로 게시 시각
 *   (앞에 「发布于 」 가능, 「2026年11月13日 21:00」 꼴도 받음)이면 게시 노트(베이징 시각 +08:00)다. 제목·글 속에 섞인 날짜는 세지 않는다.
 *   「定时发布」·「未发布」 줄이 있으면 수치가 비고 미래의 「YYYY-MM-DD HH:mm （GMT+8:00 北京时间）」 줄이 하나일 때만 예약 노트로 건너뛴다.
 *   그 밖의 줄은 거절. 수치는 관측 시점 누적값(post-lifetime) 그대로다.
 * parseTelegram(evidence, identity) — https://t.me/s/<handle> 공개 화면(소유자 통계가 아니다)
 *   evidence {sourceUrl, observedAt, accountHandle, rows:[{post:'<handle>/<번호>', url, datetime, views, text?, likes?, shares?, service?:true|false}]}
 *   identity {accountId, handle}. 모든 줄의 글 번호·정식 주소(이 채널)·시각(있으면)을 검사한다. service:true이고 수치가 하나도 없는 줄만
 *   서비스 줄로 건너뛰고, 그 밖의 줄은 게시 시각과 조회수가 모두 있어야 한다. 좋아요·공유는 실제 수가 없으면 null.
 *   두 파서 모두 읽은 줄은 MAX_INPUT_ROWS(1000)개까지, 관측 한도 MAX_ROWS(200)는 서비스 줄·예약 노트를 뺀 관측 수에만 건다.
 * parseDouyinWorks(evidence, identity) — https://creator.douyin.com/creator-micro/content/manage(内容管理)이 불러오는 작품 목록(11-19)
 *   evidence {observedAt, sourceUrl, ownerUid, total, complete:true, rows:[{awemeId, awemeType, createTime(초), desc, authorUid, authorId, deleted, stats:{play,like,comment,share,collect}}]}
 *   identity {accountId, handle(더우인 번호)}. 예약(게시 시각이 관측보다 뒤)과 지운 작품은 건너뛰고, 나머지는 조회·좋아요·댓글·공유·저장 다섯 칸이 모두 정확한 수여야 한다.
 * parseThreadsInsights(evidence, identity) — https://www.threads.com/insights/ 「최신 게시물」 목록(11-19)
 *   evidence {observedAt, sourceUrl, handle, rows:[{path:'/insights/post/<번호>', lines:[…, '<조회수>', '조회수']}], times:{<번호>: 게시 시각}}
 *   identity {accountId, handle}. 조회수만 넣는다. 게시 시각은 같은 회차 프로필 화면의 time[datetime]이고, 목록의 모든 게시물에 있어야 한다.
 * parseLinkedInPosts(evidence, identity) — https://www.linkedin.com/analytics/post-summary/urn:li:activity:<번호>/ 게시물 분석 화면들(11-19)
 *   evidence {handle, posts:[{activityId, observedAt, sourceUrl, lines}]} → {batches:[{name, evidence, envelope}]}(게시물마다 출처 주소가 달라 봉투 하나씩).
 *   노출수 → views, 회원 도달 → reach, 반응 → likes, 댓글, 저장수 → saves, LinkedIn에서 보내기 → shares(퍼감은 빼고). 게시 시각은 활동 번호의 앞 41비트다.
 * parseNaverDaily(input, identity, observedAt) — https://admin.blog.naver.com/<blogId>/stat/download 조회수·일간 xlsx를 디코딩한 값
 *   input은 {sheets:[{name?, rows}]}(첫 장만) 또는 행 배열. 행은 칸 배열, 칸 주소 열쇠 객체({A8,B8,C8} — 모두 같은 행 번호이고 그 번호가
 *   배열 순서+1), 또는 A·B… / 0·1… 열 열쇠 객체. 머리 행의 「요일」 열은 날짜의 실제 요일과 맞는지만 보고 수치로 읽지 않는다.
 *   「전체」 칸이 있는 머리 행 위(와 장 이름)에 조회수·일간과 기간 「YYYY.MM.DD ~ YYYY.MM.DD」 하나, 머리 행에 날짜 열과 「전체」 열,
 *   그 아래 하루 한 행(오름·내림 차순, 빠진 날·겹친 날 없음). 맨 위나 맨 아래 합계 행은 「전체」 합과 같아야 하고 관측으로 내지 않는다.
 *   값은 「전체」 열만 쓴다(이웃 열을 더하지 않는다). 내보낸 날(한국 날짜)의 값은 아직 바뀌므로 excludedPartialDays로 뺀다.
 *   파일에는 계정이 없으므로 identity(설정의 accountId·블로그 ID)로만 묶는다. 원본 xlsx 해시는 목록(manifest)의 증거 파일이 맡는다.
 * periodSummaries(dailyRows[{date, views|null}], endDay, durations=[7,30,60,90])
 *   끝날까지의 현재 기간과 바로 앞 같은 길이 기간(겹치지 않음)만 셈한다. 모든 날이 있어야 합계, 앞 기간이 0이면 성장률 null·newActivity.
 */
const MAX_ROWS=200,MAX_INPUT_ROWS=1000; // 한 묶음 관측 한도와 읽은 줄 상한(서비스 줄·예약 노트 포함)은 따로 센다.
const ISO=/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:[.][0-9]{1,3})?)?(Z|[+-]([0-9]{2}):([0-9]{2}))$/;
const XHS_SOURCES=Object.freeze(['https://creator.rednote.com/new/note-manager','https://creator.xiaohongshu.com/new/note-manager']);
// 한 줄 전체가 게시 시각인 줄만 받는다(앞에 发布于 가능). 예약 노트는 「定时发布」 줄과 「… （GMT+8:00 北京时间）」 예약 시각 줄을 쓴다.
const XHS_DATE_LINE=/^(?:发布于 ?)?([0-9]{4})(?:年([0-9]{1,2})月([0-9]{1,2})日|-([0-9]{2})-([0-9]{2})) ?([0-9]{1,2}):([0-9]{2})$/;
const XHS_PLAN_LINE=/^(?:定时发布 ?)?([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2}) ?（GMT[+]8:00 北京时间）$/;
const XHS_METRICS=Object.freeze(['조회','댓글','좋아요','저장','공유']);
// 기간 양끝은 숫자 경계여야 한다(「2026.11.121」·「12026.11.10」의 일부를 기간으로 읽지 않는다).
const RANGE=/(?<![0-9])([0-9]{4})[.-]([0-9]{1,2})[.-]([0-9]{1,2})[.]? ?[~∼～] ?([0-9]{4})[.-]([0-9]{1,2})[.-]([0-9]{1,2})(?![0-9])/g;
const DATE_CELL=/^([0-9]{4})[.-]([0-9]{1,2})[.-]([0-9]{1,2})[.]?(?: ?[(]([월화수목금토일])[)])?$/;
const DATE_HEADS=Object.freeze(['날짜','일자','기간','일별']),SUMMARY_LABELS=Object.freeze(['합계','총계']);
const WEEKDAYS='일월화수목금토';
const OTHER_METRICS=Object.freeze(['방문','사용 시간','사용시간','공감','댓글','이웃 증감','이웃증감','유입']); // 「방문」은 순방문자·방문 횟수·재방문·방문자 수를 함께 덮는다.

const fail=(reason,message)=>Object.assign(new Error(message),{code:'SYNK_METRICS_'+reason});
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const blank=value=>value===undefined||value===null||value==='';
const pad=value=>String(value).padStart(2,'0');
const cell=value=>blank(value)?'':String(value).replace(/\s+/g,' ').trim();
const realDay=(y,m,d)=>{const t=new Date(Date.UTC(y,m-1,d));return y>=2000&&t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d;};
const kstDay=ms=>new Date(ms+9*3600000).toISOString().slice(0,10);
const shiftDay=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const accountIdOf=identity=>plain(identity)&&typeof identity.accountId==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(identity.accountId)?identity.accountId:null;
const handleOf=identity=>plain(identity)&&typeof identity.handle==='string'?identity.handle.replace(/^@/,''):'';
const column=letters=>[...letters].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
// 베이징 시각(+08:00) 글자. 실제 달력 시각이 아니면 거절한다(날짜 검사는 느슨하게 하지 않는다).
function beijing(y,month,day,hour,minute,label){
  if(!realDay(y,month,day)||hour>23||minute>59)throw fail('ROW',`${label}: 실제 달력 시각이 아니에요.`);
  return `${y}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+08:00`;
}

function known(value,keys,where){
  if(!plain(value))throw fail('SHAPE',`${where}: 객체여야 해요.`);
  const extra=Object.keys(value).filter(key=>!keys.includes(key));
  if(extra.length)throw fail('SHAPE',`${where}: 약속하지 않은 칸이 있어요(${extra.slice(0,5).join(', ')}).`);
}
function instant(value,label){
  const m=typeof value==='string'?ISO.exec(value):null;
  if(!m||!realDay(Number(m[1]),Number(m[2]),Number(m[3]))||Number(m[4])>23||Number(m[5])>59||Number(m[6]||0)>59||Number(m[8]||0)>14||Number(m[9]||0)>59)
    throw fail('TIME',`${label}: 시간대가 붙은 실제 시각(예: 2026-11-14T09:30:00+09:00)이어야 해요.`);
  return value;
}
// 정확한 수만 받는다: 0 이상의 안전한 정수, 또는 숫자만 있는 글자(세 자리 쉼표 허용). 글자는 꼴을 검사하고 쉼표를 뗀 뒤
// 숫자와 같은 안전 정수 범위만 받는다. 줄인 수·소수·빈칸·null·반올림될 큰 수는 거절한다.
function count(value,label){
  if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)return value;
  const text=typeof value==='string'?value.trim():'';
  if(text.length<=32&&/^(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)$/.test(text)){
    const digits=text.replace(/,/g,'');
    if(BigInt(digits)<=BigInt(Number.MAX_SAFE_INTEGER))return Number(digits);
  }
  throw fail('COUNT',`${label}: 정확한 수가 아니에요(${String(value).slice(0,20)}). 줄인 수(万·千·K·만)·빈칸·안전 범위를 넘는 수는 받지 않아요.`);
}
// 읽은 줄 상한(MAX_INPUT_ROWS)과 한 묶음 관측 한도(MAX_ROWS)는 따로 센다. 서비스 줄·예약 노트는 관측이 아니어서 관측 한도에 넣지 않는다.
function rowsOf(value){
  if(!Array.isArray(value)||value.length>MAX_INPUT_ROWS)throw fail('ROWS',`읽은 줄(rows)은 ${MAX_INPUT_ROWS}개까지의 배열이어야 해요.`);
  return value;
}
function capped(observations,skipped){
  if(observations.length>MAX_ROWS)throw fail('ROWS',`한 묶음의 관측은 ${MAX_ROWS}개까지인데 ${observations.length}개예요(${skipped} 제외).`);
  return observations;
}
// UTF-16 길이 상한 안에서 유니코드 문자(코드 포인트)가 온전히 끝나는 자리까지만 남긴다. 이모지 반쪽(짝 없는 서러게이트)을 만들지 않는다.
function clip(text,max){
  let out='';
  for(const ch of text){if(out.length+ch.length>max)break;out+=ch;}
  return out;
}
function optionalText(value,max,label,cut=false){
  if(blank(value))return null;
  if(typeof value!=='string')throw fail('ROW',`${label}: 글자여야 해요.`);
  const text=cell(value);
  if(text.length>max&&!cut)throw fail('ROW',`${label}: ${max}자까지예요.`);
  return clip(text,max)||null;
}

function parseXhs(evidence,identity){
  const accountId=accountIdOf(identity);
  if(!accountId||typeof identity.expectedAccountName!=='string'||!identity.expectedAccountName.trim()||typeof identity.externalId!=='string'||!/^[0-9a-f]{24}$/.test(identity.externalId))
    throw fail('IDENTITY','샤오훙수 설정에 accountId·화면 계정 이름(expectedAccountName)·공식 프로필 번호(externalId 24자리)가 있어야 해요.');
  known(evidence,['observedAt','accountName','profileId','paginationComplete','expectedCount','rows','sourceUrl','screenTitle'],'샤오훙수 증거');
  const observedAt=instant(evidence.observedAt,'관측 시각(observedAt)');
  if(typeof evidence.accountName!=='string'||evidence.accountName.trim()!==identity.expectedAccountName.trim())throw fail('IDENTITY','화면의 계정 이름이 설정과 정확히 같지 않아요. 다른 계정 화면일 수 있어요.');
  // 공식 프로필 번호는 캡처에서 실제로 읽은 값(profileId)이어야 한다. 화면 이름만 같은 다른 프로필로 묶이지 않게 설정 값으로 채우지 않는다.
  if(typeof evidence.profileId!=='string'||!/^[0-9a-f]{24}$/.test(evidence.profileId))
    throw fail('IDENTITY','증거에 캡처에서 읽은 공식 프로필 번호(profileId, 24자리)가 없어요. 설정 값으로 채우지 않으니 프로필 번호를 함께 읽은 새 캡처로 만들어 주세요.');
  if(evidence.profileId!==identity.externalId)throw fail('IDENTITY','캡처에서 읽은 공식 프로필 번호(profileId)가 설정(externalId)과 달라요. 다른 계정 화면일 수 있어요.');
  const rows=rowsOf(evidence.rows),noteIds=new Set();
  // 게시·예약으로 나누기 전에 모든 줄의 노트 번호를 검사하고 겹침을 막는다. 화면 전체 수는 예약을 포함한 고유 노트 수와 맞아야 한다.
  rows.forEach((row,i)=>{
    const where=`${i+1}번째 노트`;
    known(row,['noteId','title','text','metrics'],where);
    if(typeof row.noteId!=='string'||!/^[0-9a-f]{24}$/.test(row.noteId))throw fail('ROW',`${where}: 노트 번호(24자리)를 확인해 주세요.`);
    if(noteIds.has(row.noteId))throw fail('DUPLICATE',`${where}: 같은 노트가 두 번 있어요.`);
    noteIds.add(row.noteId);
  });
  if(evidence.paginationComplete!==true||evidence.expectedCount!==noteIds.size)
    throw fail('INCOMPLETE',`노트 목록을 끝까지 읽었다는 표시(paginationComplete)와 화면의 전체 수(expectedCount ${evidence.expectedCount})가 읽은 고유 노트 수(${noteIds.size})와 맞아야 해요.`);
  const sourceUrl=evidence.sourceUrl===undefined?XHS_SOURCES[0]:evidence.sourceUrl;
  if(!XHS_SOURCES.includes(sourceUrl))throw fail('SOURCE','노트 관리(note-manager) 공식 주소가 아니에요.');
  const screenTitle=optionalText(evidence.screenTitle,120,'화면 제목'),observations=[];
  let scheduled=0;
  rows.forEach((row,i)=>{
    const where=`${i+1}번째 노트`;
    if(typeof row.text!=='string')throw fail('ROW',`${where}: 화면 글(text)이 없어요.`);
    // 줄 구분을 지킨다. 제목 자리(제목과 같은 첫 줄) 하나만 빼고 본다. 같은 글자의 다른 줄(제목이 날짜 꼴일 때의 게시 시각 줄)은 그대로 검사한다.
    const title=cell(row.title),all=row.text.split(/\r?\n/).map(cell),titleAt=title?all.indexOf(title):-1;
    const lines=all.filter((line,k)=>line&&k!==titleAt);
    const dates=lines.map(line=>XHS_DATE_LINE.exec(line)).filter(Boolean),noMetrics=blank(row.metrics)||(Array.isArray(row.metrics)&&!row.metrics.length);
    if(lines.some(line=>/^(?:定时发布|未发布)/.test(line))){
      const plans=lines.map(line=>XHS_PLAN_LINE.exec(line)).filter(Boolean);
      if(dates.length||!noMetrics||plans.length!==1)throw fail('ROW',`${where}: 예약 표시(定时发布·未发布)가 있으면 수치가 비고 「YYYY-MM-DD HH:mm （GMT+8:00 北京时间）」 예약 시각 줄이 하나뿐이어야 해요.`);
      const p=plans[0],plannedAt=beijing(Number(p[1]),Number(p[2]),Number(p[3]),Number(p[4]),Number(p[5]),`${where} 예약 시각`);
      if(Date.parse(plannedAt)<=Date.parse(observedAt))throw fail('ROW',`${where}: 예약 시각이 관측 시각보다 앞인데 아직 예약으로 보여요.`);
      scheduled++;
      return;
    }
    if(dates.length!==1)throw fail('ROW',`${where}: 한 줄 전체가 게시 시각(YYYY-MM-DD HH:mm, 앞에 发布于 가능)인 줄이 꼭 하나여야 하는데 ${dates.length}개예요. 제목·글 속 날짜는 세지 않아요.`);
    if(!Array.isArray(row.metrics)||row.metrics.length!==5)throw fail('ROW',`${where}: 수치는 조회·댓글·좋아요·저장·공유 다섯 칸이어야 해요.`);
    const [views,comments,likes,saves,shares]=row.metrics.map((value,k)=>count(value,`${where} ${XHS_METRICS[k]}`));
    const d=dates[0],publishedAt=beijing(Number(d[1]),Number(d[2]||d[4]),Number(d[3]||d[5]),Number(d[6]),Number(d[7]),`${where} 게시 시각`);
    if(Date.parse(publishedAt)>Date.parse(observedAt))throw fail('ROW',`${where}: 게시 시각이 관측 시각보다 뒤예요.`);
    observations.push({kind:'post-lifetime',post:{externalId:row.noteId,url:`https://www.rednote.com/user/profile/${identity.externalId}/${row.noteId}`,publishedAt,title:optionalText(row.title,300,`${where} 제목`)},
      metrics:{views,comments,likes,saves,shares}});
  });
  if(!observations.length)throw fail('NO_ROWS','게시된 노트가 없어 보낼 관측이 없어요.');
  capped(observations,'예약 노트');
  return {envelope:{sourceType:'creator-screen',sourceUrl,observedAt,evidenceSha256:null,identity:{accountId,externalId:evidence.profileId},
    labels:{...(screenTitle?{screenTitle}:{}),timeZone:'Asia/Shanghai'},observations},summary:{rows:rows.length,published:observations.length,scheduled}};
}

function parseTelegram(evidence,identity){
  const accountId=accountIdOf(identity),handle=handleOf(identity);
  if(!accountId||!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(handle))throw fail('IDENTITY','텔레그램 설정에 accountId와 채널 이름(handle)이 있어야 해요.');
  known(evidence,['sourceUrl','observedAt','accountHandle','rows'],'텔레그램 증거');
  const observedAt=instant(evidence.observedAt,'관측 시각(observedAt)');
  if(typeof evidence.accountHandle!=='string'||evidence.accountHandle.trim().replace(/^@/,'')!==handle)throw fail('IDENTITY','화면의 채널 이름이 설정과 정확히 같지 않아요. 다른 채널 화면일 수 있어요.');
  const sourceUrl=`https://t.me/s/${handle}`;
  if(evidence.sourceUrl!==sourceUrl)throw fail('SOURCE',`공개 화면 주소는 ${sourceUrl} 이어야 해요.`);
  const rows=rowsOf(evidence.rows),seen=new Set(),observations=[];
  let service=0;
  rows.forEach((row,i)=>{
    const where=`${i+1}번째 글`;
    known(row,['post','url','datetime','views','text','likes','shares','service'],where);
    if(row.service!==undefined&&typeof row.service!=='boolean')throw fail('ROW',`${where}: service는 true·false여야 해요.`);
    const parts=typeof row.post==='string'?row.post.split('/'):[];
    if(parts.length!==2||parts[0]!==handle||!/^[1-9][0-9]{0,9}$/.test(parts[1]))throw fail('ROW',`${where}: 글 번호(post)가 「${handle}/번호」가 아니에요.`);
    if(seen.has(parts[1]))throw fail('DUPLICATE',`${where}: 같은 글이 두 번 있어요.`);
    seen.add(parts[1]);
    const url=`https://t.me/${handle}/${parts[1]}`;
    if(row.url!==url)throw fail('ROW',`${where}: 글 주소가 ${url} 과 정확히 같지 않아요.`);
    const publishedAt=blank(row.datetime)?null:instant(row.datetime,`${where} 게시 시각`);
    if(publishedAt&&Date.parse(publishedAt)>Date.parse(observedAt))throw fail('ROW',`${where}: 게시 시각이 관측 시각보다 뒤예요.`);
    // 서비스 줄은 service:true로 적혔고 수치가 하나도 없을 때만 건너뛴다. 표시가 없거나 false인 줄은 글 줄이라 시각·조회수가 다 있어야 한다.
    if(row.service===true){
      if(!blank(row.views)||!blank(row.likes)||!blank(row.shares))throw fail('ROW',`${where}: 서비스 줄(service:true)에 수치가 있어 어느 쪽인지 알 수 없어요.`);
      service++;
      return;
    }
    if(!publishedAt||blank(row.views))throw fail('PARTIAL',`${where}: 글 줄에는 게시 시각과 조회수가 모두 있어야 해요. 서비스 줄은 service:true로만 건너뛰어요.`);
    const metrics={views:count(row.views,`${where} 조회수`),likes:blank(row.likes)?null:count(row.likes,`${where} 좋아요`),shares:blank(row.shares)?null:count(row.shares,`${where} 공유`)};
    observations.push({kind:'post-lifetime',post:{externalId:parts[1],url,publishedAt,title:optionalText(row.text,120,`${where} 글`,true)},metrics});
  });
  if(!observations.length)throw fail('NO_ROWS','조회수가 있는 글이 없어 보낼 관측이 없어요.');
  capped(observations,'서비스 줄');
  return {envelope:{sourceType:'public-page',sourceUrl,observedAt,evidenceSha256:null,identity:{accountId,handle},observations},summary:{rows:rows.length,posts:observations.length,service}};
}

const DOUYIN_SOURCE='https://creator.douyin.com/creator-micro/content/manage';
// 더우인 크리에이터 센터 「内容管理」 화면이 스스로 불러오는 작품 목록(work_list)의 영상별 누적값이다(11-19). 화면의 播放·点赞·评论·分享·收藏 칸과 같은 값이다.
// 모든 줄의 작성자가 화면을 연 로그인 계정(ownerUid)이고 더우인 번호(authorId)가 설정과 같아야 한다. 게시 시각이 관측보다 뒤인 작품(定时发布)과 지운 작품은 건너뛴다.
function parseDouyinWorks(evidence,identity){
  const accountId=accountIdOf(identity),handle=handleOf(identity);
  if(!accountId||!/^[0-9]{6,20}$/.test(handle))throw fail('IDENTITY','더우인 설정에 accountId와 더우인 번호(handle, 숫자)가 있어야 해요.');
  known(evidence,['observedAt','sourceUrl','ownerUid','total','complete','rows'],'더우인 증거');
  const observedAt=instant(evidence.observedAt,'관측 시각(observedAt)');
  if(evidence.sourceUrl!==DOUYIN_SOURCE)throw fail('SOURCE',`내용 관리 화면 주소는 ${DOUYIN_SOURCE} 이어야 해요.`);
  if(typeof evidence.ownerUid!=='string'||!/^[0-9]{6,30}$/.test(evidence.ownerUid))throw fail('IDENTITY','화면을 연 로그인 계정 번호(ownerUid)가 없어요.');
  const rows=rowsOf(evidence.rows),seen=new Set(),observations=[];
  if(evidence.complete!==true||evidence.total!==rows.length)throw fail('INCOMPLETE',`작품 목록을 끝까지 읽었다는 표시(complete)와 전체 수(total ${evidence.total})가 읽은 작품 수(${rows.length})와 맞아야 해요.`);
  let scheduled=0,deleted=0;
  rows.forEach((row,i)=>{
    const where=`${i+1}번째 작품`;
    known(row,['awemeId','awemeType','createTime','desc','authorUid','authorId','deleted','stats'],where);
    if(typeof row.awemeId!=='string'||!/^[0-9]{6,30}$/.test(row.awemeId))throw fail('ROW',`${where}: 작품 번호(awemeId)를 확인해 주세요.`);
    if(seen.has(row.awemeId))throw fail('DUPLICATE',`${where}: 같은 작품이 두 번 있어요.`);
    seen.add(row.awemeId);
    if(row.authorUid!==evidence.ownerUid||row.authorId!==handle)throw fail('IDENTITY',`${where}: 작성자가 화면을 연 계정이나 설정의 더우인 번호와 달라요.`);
    if(!Number.isSafeInteger(row.createTime)||row.createTime<1_500_000_000)throw fail('TIME',`${where}: 게시 시각(createTime, 초)을 확인해 주세요.`);
    if(typeof row.deleted!=='boolean')throw fail('ROW',`${where}: 지운 작품 표시(deleted)는 true·false여야 해요.`);
    const publishedAt=new Date(row.createTime*1000).toISOString();
    if(row.deleted){deleted++;return;}
    if(Date.parse(publishedAt)>Date.parse(observedAt)){scheduled++;return;}
    known(row.stats,['play','like','comment','share','collect'],`${where} 수치`);
    const metrics={views:count(row.stats.play,`${where} 播放`),likes:count(row.stats.like,`${where} 点赞`),comments:count(row.stats.comment,`${where} 评论`),
      shares:count(row.stats.share,`${where} 分享`),saves:count(row.stats.collect,`${where} 收藏`)};
    const url=`https://www.douyin.com/${row.awemeType===68?'note':'video'}/${row.awemeId}`;
    observations.push({kind:'post-lifetime',post:{externalId:row.awemeId,url,publishedAt,title:optionalText(row.desc,120,`${where} 글`,true)},metrics});
  });
  if(!observations.length)throw fail('NO_ROWS','게시된 작품이 없어 보낼 관측이 없어요.');
  capped(observations,'예약 · 지운 작품');
  return {envelope:{sourceType:'creator-screen',sourceUrl:DOUYIN_SOURCE,observedAt,evidenceSha256:null,identity:{accountId,handle},
    labels:{screenTitle:'抖音创作者中心 · 内容管理',timeZone:'Asia/Shanghai'},observations},summary:{rows:rows.length,published:observations.length,scheduled,deleted}};
}

const THREADS_SOURCE='https://www.threads.com/insights/';
// 스레드 인사이트 화면 「최신 게시물」 목록의 게시물별 조회수다(11-19). 조회수 말고는 목록에 정확한 수가 없어 조회만 넣는다.
// 게시 시각은 같은 회차에 로그인한 프로필 화면의 time[datetime]에서 읽는다. 목록의 모든 게시물에 시각이 있어야 한다.
function parseThreadsInsights(evidence,identity){
  const accountId=accountIdOf(identity),handle=handleOf(identity);
  if(!accountId||!/^[A-Za-z0-9_.]{1,40}$/.test(handle))throw fail('IDENTITY','스레드 설정에 accountId와 계정 이름(handle)이 있어야 해요.');
  known(evidence,['observedAt','sourceUrl','handle','rows','times'],'스레드 증거');
  const observedAt=instant(evidence.observedAt,'관측 시각(observedAt)');
  if(evidence.sourceUrl!==THREADS_SOURCE)throw fail('SOURCE',`인사이트 화면 주소는 ${THREADS_SOURCE} 이어야 해요.`);
  if(evidence.handle!==handle)throw fail('IDENTITY','화면의 계정 이름이 설정과 정확히 같지 않아요. 다른 계정 화면일 수 있어요.');
  if(!plain(evidence.times))throw fail('SHAPE','게시 시각 목록(times)이 없어요.');
  const rows=rowsOf(evidence.rows),seen=new Set(),observations=[];
  rows.forEach((row,i)=>{
    const where=`${i+1}번째 게시물`;
    known(row,['path','lines'],where);
    const m=typeof row.path==='string'?/^\/insights\/post\/([A-Za-z0-9_-]{5,40})\/?$/.exec(row.path):null;
    if(!m)throw fail('ROW',`${where}: 게시물 인사이트 주소(/insights/post/<번호>)가 아니에요.`);
    const id=m[1];
    if(seen.has(id))throw fail('DUPLICATE',`${where}: 같은 게시물이 두 번 있어요.`);
    seen.add(id);
    if(!Array.isArray(row.lines)||row.lines.length<2||row.lines.at(-1)!=='조회수')throw fail('ROW',`${where}: 마지막 줄이 「조회수」이고 그 앞 줄이 수여야 해요.`);
    const views=count(row.lines.at(-2),`${where} 조회수`);
    if(blank(evidence.times[id]))throw fail('INCOMPLETE',`${where}: 프로필 화면에서 게시 시각을 찾지 못했어요.`);
    const publishedAt=instant(evidence.times[id],`${where} 게시 시각`);
    if(Date.parse(publishedAt)>Date.parse(observedAt))throw fail('ROW',`${where}: 게시 시각이 관측 시각보다 뒤예요.`);
    observations.push({kind:'post-lifetime',post:{externalId:id,url:`https://www.threads.com/@${handle}/post/${id}`,publishedAt},metrics:{views}});
  });
  if(!observations.length)throw fail('NO_ROWS','조회수가 있는 게시물이 없어 보낼 관측이 없어요.');
  capped(observations,'없음');
  return {envelope:{sourceType:'creator-screen',sourceUrl:THREADS_SOURCE,observedAt,evidenceSha256:null,identity:{accountId,handle},
    labels:{screenTitle:'Threads 인사이트 · 최신 게시물'},observations},summary:{rows:rows.length,posts:observations.length}};
}

// 링크드인 개인 프로필 게시물 분석 화면(/analytics/post-summary/urn:li:activity:<번호>/)의 게시물별 누적값이다(11-19).
// 동영상 조회를 조회 칸에, 회원 도달을 도달 칸에 넣고 화면 이름을 metricLabels로 남긴다. 노출수는 조회가 아니라서 넣지 않는다(11-19 GPT 검수 P1).
// 퍼감(재게시)은 공유에 넣지 않고 「LinkedIn에서 보내기」만 공유로 센다. 동영상이 없는 글은 조회 칸을 비운다.
// 게시 시각은 활동 번호의 앞 41비트(밀리초)다. 화면은 「9시간」 같은 상대 시각만 보여 준다. 게시물마다 출처 주소가 달라 게시물 하나가 봉투 하나다.
const LINKEDIN_LABELS=Object.freeze({views:'동영상 조회',reach:'회원 도달',likes:'반응',comments:'댓글',saves:'저장수',shares:'LinkedIn에서 보내기'});
function parseLinkedInPosts(evidence,identity){
  const accountId=accountIdOf(identity),handle=handleOf(identity);
  if(!accountId||!/^[A-Za-z0-9_-]{3,100}$/.test(handle))throw fail('IDENTITY','링크드인 설정에 accountId와 프로필 주소 이름(handle)이 있어야 해요.');
  known(evidence,['handle','posts'],'링크드인 증거');
  if(evidence.handle!==handle)throw fail('IDENTITY','화면의 프로필 이름이 설정과 정확히 같지 않아요. 다른 계정 화면일 수 있어요.');
  const posts=rowsOf(evidence.posts),seen=new Set(),batches=[];
  posts.forEach((post,i)=>{
    const where=`${i+1}번째 게시물`;
    known(post,['activityId','observedAt','sourceUrl','lines'],where);
    if(typeof post.activityId!=='string'||!/^[0-9]{15,25}$/.test(post.activityId))throw fail('ROW',`${where}: 활동 번호(activityId)를 확인해 주세요.`);
    if(seen.has(post.activityId))throw fail('DUPLICATE',`${where}: 같은 게시물이 두 번 있어요.`);
    seen.add(post.activityId);
    const sourceUrl=`https://www.linkedin.com/analytics/post-summary/urn:li:activity:${post.activityId}/`;
    if(post.sourceUrl!==sourceUrl)throw fail('SOURCE',`${where}: 게시물 분석 화면 주소는 ${sourceUrl} 이어야 해요.`);
    const observedAt=instant(post.observedAt,`${where} 관측 시각`);
    const lines=Array.isArray(post.lines)?post.lines.map(cell):[];
    // 회원 도달 칸은 게시물에 따라 화면에 없다(11-19 실측). 없으면 0이 아니라 칸을 뺀다.
    // 화면 줄은 「노출수」 수 칸에서 시작한다(post-lifetime.cjs). 그 뒤에서만 칸 이름을 찾는다.
    const startAt=lines.indexOf('노출수'),likesAt=startAt<1?-1:lines.indexOf(LINKEDIN_LABELS.likes,startAt+1);
    if(startAt<1||likesAt<0)throw fail('ROW',`${where}: 「노출수」와 「반응」 칸을 찾지 못했어요.`);
    const before=label=>{const at=lines.indexOf(label,startAt+1);return at>startAt+1&&at<likesAt?lines[at-1]:null;};
    const after=label=>{const at=lines.indexOf(label,startAt+1);if(at<0||at+1>=lines.length)throw fail('ROW',`${where}: 「${label}」 칸을 찾지 못했어요.`);return lines[at+1];};
    const metrics={};
    for(const key of ['views','reach']){const value=before(LINKEDIN_LABELS[key]);if(value!==null)metrics[key]=count(value,`${where} ${LINKEDIN_LABELS[key]}`);}
    for(const key of ['likes','comments','saves','shares'])metrics[key]=count(after(LINKEDIN_LABELS[key]),`${where} ${LINKEDIN_LABELS[key]}`);
    const ms=Number(BigInt(post.activityId)>>22n),publishedAt=new Date(ms).toISOString();
    if(ms<Date.parse('2016-01-01T00:00:00Z')||ms>Date.parse(observedAt))throw fail('TIME',`${where}: 활동 번호에서 읽은 게시 시각(${publishedAt})이 관측 시각과 맞지 않아요.`);
    const urn=`urn:li:activity:${post.activityId}`;
    batches.push({name:'linkedin-post-'+post.activityId,evidence:{handle,...post},envelope:{sourceType:'creator-screen',sourceUrl,observedAt,evidenceSha256:null,identity:{accountId,handle},
      labels:{screenTitle:'LinkedIn 게시물 분석'},
      observations:[{kind:'post-lifetime',post:{externalId:urn,url:`https://www.linkedin.com/feed/update/${urn}/`,publishedAt},metrics,
        labels:{metricLabels:Object.fromEntries(Object.entries(LINKEDIN_LABELS).filter(([key])=>key in metrics))}}]}});
  });
  if(!batches.length)throw fail('NO_ROWS','분석 화면을 읽은 게시물이 없어 보낼 관측이 없어요.');
  if(batches.length>50)throw fail('ROWS','게시물은 한 회차에 50개까지예요.');
  return {batches,summary:{posts:batches.length}};
}

function sheetOf(input){
  const sheet=Array.isArray(input)?{rows:input}:plain(input)&&Array.isArray(input.sheets)?input.sheets[0]:null;
  if(!plain(sheet)||!Array.isArray(sheet.rows)||!sheet.rows.length||sheet.rows.length>MAX_ROWS+40)throw fail('SHAPE',`디코딩한 첫 장(sheets[0].rows)이 1~${MAX_ROWS+40}행 배열이어야 해요.`);
  const rows=Array.from(sheet.rows,(row,i)=>{
    if(row===undefined||row===null)return [];
    if(Array.isArray(row))return Array.from(row,cell);
    const keys=plain(row)?Object.keys(row):null;
    if(keys&&!keys.length)return [];
    // 칸 주소 열쇠(A8·C8)는 모두 같은 행 번호이고 그 번호가 배열 순서+1이어야 한다. 섞인 행 주소를 한 행으로 합치지 않는다.
    const addresses=keys&&keys.map(key=>/^([A-Z]{1,2})([1-9][0-9]{0,5})$/.exec(key));
    if(addresses&&addresses.every(Boolean)){
      if(addresses.some(m=>Number(m[2])!==i+1))throw fail('SHAPE',`${i+1}번째 행의 칸 주소(${keys.slice(0,4).join(', ')})가 ${i+1}행이 아니거나 여러 행을 섞었어요.`);
      const out=[];
      for(const m of addresses)out[column(m[1])]=row[m[0]];
      return Array.from(out,cell);
    }
    // 숫자 열 열쇠는 앞에 0이 없는 표준 꼴만 받는다(「1」과 「01」이 같은 칸을 덮어쓰지 않게).
    const letters=keys&&keys.every(key=>/^[A-Z]{1,2}$/.test(key)),numbers=keys&&keys.every(key=>/^(?:0|[1-9][0-9]{0,2})$/.test(key));
    if(!letters&&!numbers)throw fail('SHAPE',`${i+1}번째 행을 칸 배열로 읽을 수 없어요(머리글 이름 열쇠·섞인 열쇠 객체는 받지 않아요).`);
    const out=[];
    for(const key of keys)out[numbers?Number(key):column(key)]=row[key];
    return Array.from(out,cell);
  });
  return {rows,name:cell(sheet.name)};
}
function dayOfMatch(m,at){
  const y=Number(m[at]),month=Number(m[at+1]),d=Number(m[at+2]);
  if(!realDay(y,month,d))throw fail('DATE',`실제 달력에 없는 날짜예요(${m[0]}).`);
  return `${y}-${pad(month)}-${pad(d)}`;
}
function dateCell(value,where){
  const m=DATE_CELL.exec(value);
  if(!m)throw fail('DATE',`${where}: 날짜 칸이 YYYY.MM.DD 글자가 아니에요(${String(value).slice(0,20)}). 엑셀 일련번호는 받지 않아요.`);
  const date=dayOfMatch(m,1);
  if(m[4]&&'일월화수목금토'[new Date(date+'T00:00:00Z').getUTCDay()]!==m[4])throw fail('DATE',`${where}: 요일이 날짜와 맞지 않아요.`);
  return date;
}
function parseNaverDaily(input,identity,observedAt){
  const accountId=accountIdOf(identity),handle=handleOf(identity);
  if(!accountId||!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(handle))throw fail('IDENTITY','네이버 설정에 accountId와 블로그 ID(handle)가 있어야 해요. 내보내기 파일에는 계정이 없어 설정으로만 묶어요.');
  const observed=instant(observedAt,'내보낸 시각(observedAt)'),today=kstDay(Date.parse(observed)),{rows,name}=sheetOf(input);
  const heads=rows.flatMap((row,i)=>row.includes('전체')?[i]:[]);
  if(heads.length!==1||rows[heads[0]].filter(value=>value==='전체').length!==1)throw fail('HEADER','「전체」 칸이 있는 머리 행이 꼭 하나여야 해요.');
  const h=heads[0],header=rows[h],totalCol=header.indexOf('전체'),dateCols=header.flatMap((value,i)=>DATE_HEADS.includes(value)?[i]:[]);
  const dateCol=dateCols.length===1?dateCols[0]:(!dateCols.length&&header[0]===''&&totalCol!==0?0:-1);
  if(dateCol<0)throw fail('HEADER','날짜 열을 하나로 정할 수 없어요.');
  // 통계 종류는 장 이름과 머리 행 위 보고서 머리글을 함께 읽어 조회수·일간을 확인한다(공식 파일은 장 이름에만 적기도 한다).
  // 장 이름·보고서 머리글 어디든 다른 수치(방문·공감 등)·주간·월간이 적혀 있으면 띄어쓰기와 상관없이 거절한다.
  const heading=cell(rows.slice(0,h).map(row=>row.join(' ')).join(' ')),title=cell(`${name} ${heading}`);
  const flat=text=>text.replace(/\s+/g,''),flatTitle=flat(title);
  if(!flatTitle.includes('조회수')||!flatTitle.includes('일간')||/주간|월간/.test(flatTitle)||OTHER_METRICS.some(word=>flatTitle.includes(flat(word))))
    throw fail('METRIC','조회수·일간 내보내기만 받아요(다른 수치·주간·월간은 거절).');
  const ranges=[...title.matchAll(RANGE)];
  if(ranges.length!==1)throw fail('RANGE','머리글에 기간(YYYY.MM.DD ~ YYYY.MM.DD)이 꼭 하나 있어야 해요.');
  // 「요일」 열은 날짜의 실제 요일과 맞는지만 보고 수치(이웃 열)로 읽지 않는다.
  const weekdayCols=header.flatMap((value,i)=>value==='요일'?[i]:[]);
  if(weekdayCols.length>1)throw fail('HEADER','「요일」 열이 둘 이상이에요.');
  const weekdayCol=weekdayCols.length?weekdayCols[0]:-1;
  const range=[dayOfMatch(ranges[0],1),dayOfMatch(ranges[0],4)],segments=header.flatMap((value,i)=>value&&i!==dateCol&&i!==totalCol&&i!==weekdayCol?[i]:[]);
  let body=rows.slice(h+1),summary=null;
  while(body.length&&body.at(-1).every(value=>value===''))body=body.slice(0,-1);
  if(body.length&&SUMMARY_LABELS.includes(body[0][dateCol])){summary=body[0];body=body.slice(1);}
  else if(body.length&&SUMMARY_LABELS.includes(body.at(-1)[dateCol])){summary=body.at(-1);body=body.slice(0,-1);}
  if(!body.length||body.length>MAX_ROWS)throw fail('ROWS',`날짜 행은 1~${MAX_ROWS}개여야 해요.`);
  // 날짜 열 밖 칸은 머리글이 있어야 하고 모두 정확한 수, 이웃 열은 「전체」를 넘을 수 없다. 값으로는 「전체」만 쓴다.
  const total=(row,where)=>{
    if(row.some((value,k)=>value!==''&&k!==dateCol&&(k>=header.length||header[k]==='')))throw fail('CELL',`${where}: 머리글 없는 칸에 값이 있어요.`);
    const views=count(row[totalCol],`${where} 전체`);
    for(const k of segments)if(count(row[k],`${where} ${header[k]}`)>views)throw fail('TOTAL',`${where}: 「${header[k]}」이 「전체」보다 커요. 전체 열을 잘못 읽었을 수 있어요.`);
    return views;
  };
  const days=body.map((row,i)=>{
    const where=`${i+1}번째 날짜 행`,date=dateCell(row[dateCol],where);
    if(weekdayCol>=0&&row[weekdayCol]!==WEEKDAYS[new Date(date+'T00:00:00Z').getUTCDay()])throw fail('DATE',`${where}: 요일 칸(${row[weekdayCol]||'빈칸'})이 ${date}의 요일과 달라요.`);
    return {date,views:total(row,where)};
  });
  const seen=new Set();
  for(const d of days){if(seen.has(d.date))throw fail('DUPLICATE',`${d.date}가 두 번 있어요.`);seen.add(d.date);}
  if(days.length>1&&days[0].date>days[1].date)days.reverse();
  for(let i=1;i<days.length;i++)if(shiftDay(days[i-1].date,1)!==days[i].date)throw fail('GAP',`${days[i-1].date} 다음이 ${days[i].date}예요. 빠진 날·뒤섞인 날 없이 이어져야 해요.`);
  if(days[0].date!==range[0]||days.at(-1).date!==range[1])throw fail('RANGE',`머리글 기간(${range.join(' ~ ')})과 날짜 행(${days[0].date} ~ ${days.at(-1).date})이 달라요.`);
  if(summary&&total(summary,'합계 행')!==days.reduce((sum,d)=>sum+d.views,0))throw fail('TOTAL','합계 행의 「전체」가 날짜 행 「전체」의 합과 달라요.');
  if(days.at(-1).date>today)throw fail('FUTURE',`내보낸 날(${today}, 한국 날짜)보다 뒤 날짜가 있어요.`);
  const complete=days.filter(d=>d.date<today);
  if(!complete.length)throw fail('NO_ROWS','끝난 날이 없어 보낼 관측이 없어요(내보낸 날의 값은 아직 바뀌어요).');
  return {envelope:{sourceType:'official-export',sourceUrl:`https://admin.blog.naver.com/${handle}/stat/download`,observedAt:observed,evidenceSha256:null,identity:{accountId,handle},exportFormat:'xlsx',
      labels:{screenTitle:'조회수',periodLabel:'일간',selectedRange:ranges[0][0],timeZone:'Asia/Seoul'},
      observations:complete.map(d=>({kind:'account-period',period:{start:d.date,end:d.date},metrics:{views:d.views}}))},
    days:complete,excludedPartialDays:days.filter(d=>d.date===today).map(d=>d.date),summary:{dates:days.length,segments:segments.map(k=>header[k]),summaryRowChecked:!!summary}};
}

function dayNumber(value,label){
  if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)||!realDay(Number(value.slice(0,4)),Number(value.slice(5,7)),Number(value.slice(8,10))))throw fail('DATE',`${label}: YYYY-MM-DD 날짜여야 해요.`);
  return Date.parse(value+'T00:00:00Z')/86400000;
}
const dayText=number=>new Date(number*86400000).toISOString().slice(0,10);
function periodSummaries(dailyRows,endDay,durations=[7,30,60,90]){
  if(!Array.isArray(dailyRows)||dailyRows.length>3700)throw fail('SHAPE','일별 값(dailyRows)은 배열이어야 해요.');
  if(!Array.isArray(durations)||!durations.length||durations.some(days=>!Number.isInteger(days)||days<1||days>366)||new Set(durations).size!==durations.length)
    throw fail('SHAPE','기간 길이는 1~366일 정수를 겹치지 않게 넣어 주세요.');
  const end=dayNumber(endDay,'끝날(endDay)'),values=new Map();
  dailyRows.forEach((row,i)=>{
    known(row,['date','views'],`${i+1}번째 날`);
    const at=dayNumber(row.date,`${i+1}번째 날`);
    if(values.has(at))throw fail('DUPLICATE',`${row.date}가 두 번 있어요.`);
    values.set(at,blank(row.views)?null:count(row.views,`${row.date} 조회수`));
  });
  // 합계는 정확한 정수(BigInt)로 더하고, 끝난 기간의 합이 안전 정수를 넘으면 반올림된 수 대신 거절한다.
  const span=(from,days)=>{
    let sum=0n,coverage=0;
    for(let at=from;at<from+days;at++){const value=values.get(at);if(value!==undefined&&value!==null){coverage++;sum+=BigInt(value);}}
    if(coverage===days&&sum>BigInt(Number.MAX_SAFE_INTEGER))throw fail('TOTAL',`${dayText(from)}부터 ${days}일 합계가 정확히 나타낼 수 있는 수를 넘어요.`);
    return {start:dayText(from),end:dayText(from+days-1),coverage,complete:coverage===days,sum:coverage===days?Number(sum):null};
  };
  return {endDay,basis:'끝난 날의 일별 값만 · 현재와 바로 앞 같은 길이 기간 · 빈 날이 있으면 합계 없음(0으로 채우지 않음)',windows:durations.map(days=>{
    const current=span(end-days+1,days),previous=span(end-2*days+1,days),both=current.complete&&previous.complete;
    return {days,current,previous,change:both?current.sum-previous.sum:null,growth:both&&previous.sum>0?(current.sum-previous.sum)/previous.sum:null,newActivity:both&&previous.sum===0?current.sum>0:null};
  })};
}

module.exports={parseXhs,parseTelegram,parseDouyinWorks,parseThreadsInsights,parseLinkedInPosts,parseNaverDaily,periodSummaries,MAX_ROWS,MAX_INPUT_ROWS};
