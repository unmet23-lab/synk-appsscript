// SNS·마케팅 간편판(2026-10-24 유호님 승인) — 오늘·성과·계정 세 장이 읽는 자료 한 벌(GET /api/social/simple)과
// 저장소 편 요약 받기(POST /api/social/repo-digest). 서버가 아는 사실(작업실 예약 · 수집 게시물과 숫자 · 게시 성과 관측 · 댓글 · 연결)과
// 저장소만 아는 사실(편 묶음 · Meta·직접 예약 · 보류 · 예약 전 · 평소 대비 배수 — tools/편요약.js가 30분마다 보냄)을 합친다.
// 시각은 화면용 한국 시각 'YYYY-MM-DD HH:MM'으로 낸다. 댓글 본문·작성자·토큰·검토 링크는 내보내지 않는다.
// 무거운 성과 보고서(report — 수집 기록 전부)는 쓰지 않는다: 최근 31일 게시물과 그 게시물의 마지막 숫자만 열쇠로 읽는다.

export const DIGEST_KIND='socialRepoDigest',DIGEST_ID='current';
const KST=9*3600000,DAY=86400000,HOUR=3600000;
export const DIGEST_LIMITS=Object.freeze({bytes:262144,episodes:200,plates:24,judgments:500,accounts:120,excludedUrls:200,text:300,url:2000});
const STATES=new Set(['승인 대기','예약됨','게시됨','실패','보류']);
const METHODS=new Set(['작업실','Meta 예약','API 예약','직접 예약','유호님 직접']);
const BRANDS=new Set(['유호','브리핑','LAB','회사']);
const PLATFORMS=new Set(['youtube','instagram','facebook','tiktok']);
// 손이 필요한 예약 — 서버 주의 묶음(social-workspace-query attention)과 같다. 만료(expired)는 할 일이 없어 넣지 않는다.
const NEED_HAND={failed:'실패',unknown:'결과 확인 필요',manual:'앱에서 마무리',missed:'시각 지남'};
// 메타·직접 예약 판은 주소가 비어 있다 — 같은 채널 수집 게시물이 판 시각 앞뒤 60분 안이면 그 판으로 본다. 2시간이 지나도 없으면 「확인 필요」.
const PAIR_WINDOW=60*60000,CONFIRM_AFTER=2*HOUR;
const STALE_DIGEST=60000;
const GENERIC_PATH=new Set(['watch','shorts','reel','reels','p','tv','video','videos','posts','story','photo','photos','permalink','share','home']);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});

const kst=value=>{const ms=typeof value==='number'?value:Date.parse(value);return Number.isFinite(ms)?new Date(ms+KST).toISOString().slice(0,16).replace('T',' '):null;};
const kstDay=ms=>new Date(ms+KST).toISOString().slice(0,10);
const addDays=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
const norm=handle=>String(handle||'').trim().toLowerCase().replace(/^https?:\/\/(www\.)?facebook\.com\//,'').replace(/^@/,'').replace(/\/+$/,'');
const atHandle=(platform,handle)=>{const h=String(handle||'').trim();if(!h)return '';return ['facebook','linkedin'].includes(platform)?h.replace(/^@/,''):h.startsWith('@')?h:'@'+h;};
// 게시물 열쇠 — 플랫폼:게시물 번호(유튜브 v= · 페이스북 story_fbid·fbid · 그 밖은 주소 끝 칸). 저장소 기록·수집 게시물·성과 관측이 같은 열쇠로 만난다.
// tools/lib/편요약.js postKeyOf와 같은 규칙이다(둘을 같이 고친다).
export function postKey(platform,url){
  if(!platform||!url)return null;let u;try{u=new URL(String(url));}catch{return null;}
  const id=u.searchParams.get('v')||u.searchParams.get('story_fbid')||u.searchParams.get('fbid')||u.pathname.split('/').filter(Boolean).at(-1)||'';
  // 게시물 번호가 없는 주소(permalink.php?id=… · /reel/ 처럼 끝이 공통 이름)는 열쇠를 만들지 않는다 — 다른 게시물끼리 합쳐진다.
  if(/\.(php|html?|aspx?)$/i.test(id)||GENERIC_PATH.has(id.toLowerCase()))return null;
  return /^[\w.-]{3,}$/.test(id)?platform+':'+id:null;
}

// ── 편 요약 검사 ── 구조가 틀리면 거절하고, 칸 하나가 틀린 판·판정은 빼고 받는다(그 수는 dropped).
export function validateDigest(input,{now}){
  if(!input||typeof input!=='object'||Array.isArray(input)||input.v!==1)throw fail('편 요약 형식(v1)을 확인해 주세요.');
  if(Buffer.byteLength(JSON.stringify(input))>DIGEST_LIMITS.bytes)throw fail('편 요약이 너무 커요.',413);
  const nowMs=Date.parse(now),at=Date.parse(input.generatedAt);
  if(typeof input.generatedAt!=='string'||!Number.isFinite(at)||at>nowMs+5*60000||at<nowMs-2*DAY)throw fail('편 요약 시각을 확인해 주세요.');
  let dropped=0;
  const text=(v,max=DIGEST_LIMITS.text)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
  const iso=v=>{if(typeof v!=='string')return null;const ms=Date.parse(v);return Number.isFinite(ms)?new Date(ms).toISOString():null;};
  const url=v=>{if(typeof v!=='string'||v.length>DIGEST_LIMITS.url)return null;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
  const id=v=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v)?v:null;
  const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))?v:null;
  const list=(v,max,label)=>{if(v===undefined||v===null)return [];if(!Array.isArray(v))throw fail(`편 요약의 ${label} 형식을 확인해 주세요.`);if(v.length>max)throw fail(`편 요약의 ${label}이 너무 많아요.`,413);return v;};
  const keep=(rows,fn)=>rows.map(fn).filter(row=>row||(dropped++,false));
  const account=a=>{const key=a&&typeof a==='object'?text(a.key,80):'';return key&&PLATFORMS.has(a.platform)?{key,platform:a.platform,handle:text(a.handle,100),...(a.brand!==undefined?{brand:BRANDS.has(a.brand)?a.brand:'회사'}:{}),...(a.country!==undefined?{country:a.country===true}:{})}:null;};
  const accounts=keep(list(input.accounts,DIGEST_LIMITS.accounts,'계정'),a=>{const row=account(a);return row?{...row,brand:row.brand||'회사',country:row.country===true}:null;});
  const plate=p=>{const base=account({key:p?.account,platform:p?.platform,handle:p?.handle});if(!base)return null;return {account:base.key,platform:base.platform,handle:base.handle,at:iso(p.at),state:STATES.has(p.state)?p.state:null,method:METHODS.has(p.method)?p.method:null,url:url(p.url),jobId:id(p.jobId),postId:id(p.postId)};};
  const episodes=keep(list(input.episodes,DIGEST_LIMITS.episodes,'편'),e=>{
    const key=e&&typeof e==='object'?text(e.key,120):'';if(!key||/[\\/]/.test(key))return null;
    return {key,title:text(e.title)||key,titleFrom:['prep','readme','folder'].includes(e.titleFrom)?e.titleFrom:'folder',brand:BRANDS.has(e.brand)?e.brand:'회사',slot:day(e.slot),prepState:text(e.prepState,40)||null,
      planned:keep(list(e.planned,DIGEST_LIMITS.plates,'판'),p=>{const a=account({key:p?.account,platform:p?.platform,handle:p?.handle});return a?{account:a.key,platform:a.platform,handle:a.handle}:null;}),
      plates:keep(list(e.plates,DIGEST_LIMITS.plates,'판'),p=>{const row=plate(p);return row&&row.at?row:null;})};
  });
  const judgments=keep(list(input.judgments,DIGEST_LIMITS.judgments,'판정'),j=>{
    const link=url(j?.url);if(!link||!['24h','72h'].includes(j.point))return null;const m=j.multiple;
    return {url:link,point:j.point,platform:PLATFORMS.has(j.platform)?j.platform:null,account:text(j.account,80)||null,publishedAt:iso(j.publishedAt),
      multiple:m&&typeof m==='object'&&Number.isFinite(m.value)&&m.value>=0?{value:m.value,median:Number.isFinite(m.median)?m.median:null,n:Number.isInteger(m.n)&&m.n>=0&&m.n<=1000?m.n:0}:null,verdict:text(j.verdict,40)||null,observedAt:iso(j.observedAt)};
  });
  // 저장소 읽기가 깨지면 계정·편이 빈 요약이 나온다 — 그런 요약으로 지금 것을 덮지 않는다.
  if(!accounts.length)throw fail('편 요약에 계정이 없어요. 저장소 계정 장부를 읽지 못한 요약은 받지 않아요.');
  const count=v=>Number.isInteger(v)&&v>=0&&v<=100000?v:0;
  const source=input.source&&typeof input.source==='object'?input.source:{};
  const excludedUrls=list(input.excluded?.urls,DIGEST_LIMITS.excludedUrls,'뺀 주소').map(url).filter(Boolean);
  return {v:1,generatedAt:new Date(at).toISOString(),today:day(input.today),source:{tool:'편요약',commit:typeof source.commit==='string'&&/^[0-9a-f]{7,40}$/.test(source.commit)?source.commit:null,commitAt:iso(source.commitAt)},
    accounts,episodes,judgments,excluded:{운영시험:count(input.excluded?.운영시험),작품:count(input.excluded?.작품),urls:excludedUrls},dropped};
}

// ── 세 장 조합(순수 함수) ──
// 입력은 이미 보는 사람에게 보이는 것만 거른 값이다. channels:[{id,platform,handle,displayName,status}], collection: collectionHealth 결과,
// jobs: publishing.summary 예약 작업, postTitles: {postId:title}, thumbs: {postId:{src,kind}}, recent: 최근 31일 수집 게시물(+views),
// performance: 게시 성과 관측 항목, inbox: 줄인 댓글({channelId,open,remoteCreatedAt,collectorPostId}), commentPosts: {postId:{title,url}},
// providerRows·healthRows: 자동 게시 연결, digest: 받은 편 요약(없으면 null), isAdmin: 서버 채널이 없는 계정의 판을 보일지.
export function buildSocialSimple({now,isAdmin=false,channels=[],collection={},jobs=[],postTitles={},thumbs={},recent=[],performance=[],inbox=[],commentPosts={},providerRows=[],healthRows=[],digest=null}){
  const nowMs=Date.parse(now),today=kstDay(nowMs),yesterday=addDays(today,-1),since=addDays(today,-7);
  const channelById=new Map(channels.map(c=>[c.id,c]));
  const channelOf=(platform,handle)=>channels.find(c=>c.platform===platform&&norm(c.handle)&&norm(c.handle)===norm(handle))||null;
  const accounts=digest?.accounts||[];
  const accountOf=channel=>accounts.find(a=>a.platform===channel.platform&&norm(a.handle)&&norm(a.handle)===norm(channel.handle))||null;
  const brandOf=channel=>{const a=accountOf(channel);if(a)return a.brand;const h=norm(channel.handle);return /yuhobuilds/.test(h)?'유호':/synkbrief/.test(h)?'브리핑':/^SYNK LAB/.test(channel.displayName||'')||/^synk(lab|korean|\.mn|world)/.test(h)?'LAB':'회사';};
  // 나라별 LAB 부계정 = 채널 이름이 「SYNK LAB <나라>」인 것(본 계정 「SYNK LAB | Learn Korean」은 빼고) — 시안 규칙 그대로.
  const countryOf=channel=>/^SYNK LAB [A-Z]/.test(channel.displayName||'')&&!/Learn Korean/.test(channel.displayName||'');
  const plateFace=(channel,fallback={})=>({platform:channel?.platform||fallback.platform,handle:channel?atHandle(channel.platform,channel.handle):atHandle(fallback.platform,fallback.handle)});
  const recentByKey=new Map(),recentByChannel=new Map();
  for(const p of recent){const k=postKey(channelById.get(p.channelId)?.platform,p.url);if(k)recentByKey.set(k,p);if(!recentByChannel.has(p.channelId))recentByChannel.set(p.channelId,[]);recentByChannel.get(p.channelId).push(p);}
  const perfByKey=new Map();for(const e of performance){const k=postKey(e.platform,e.url);if(k)perfByKey.set(k,e);}
  const judgeByKey=new Map();for(const j of digest?.judgments||[]){const k=postKey(j.platform||guessPlatform(j.url),j.url);if(k)judgeByKey.set(k+'|'+j.point,j);}

  // 1) 판 하나로 펴기 — 서버 예약 작업이 진실이고, 편 요약은 묶음·제목·브랜드와 서버 밖 예약을 더한다.
  const jobById=new Map(jobs.map(j=>[j.id,j]));
  const usedJobs=new Set(),usedRecent=new Set(),plates=[];
  const jobState=j=>j.status==='scheduled'?(j.reviewWaiting?'검토 대기':'예약됨'):j.status==='published'?'게시됨':NEED_HAND[j.status]?'실패':null;
  const fromJob=(j,episode)=>{const channel=channelById.get(j.channelId);usedJobs.add(j.id);return {episode,channelId:j.channelId,...plateFace(channel),at:j.status==='published'&&j.publishedAt?j.publishedAt:j.scheduledAt,state:jobState(j),method:'작업실',url:j.publicationUrl||null,jobId:j.id,postId:j.postId,thumb:thumbs[j.postId]||null};};
  for(const e of digest?.episodes||[]){
    const episode={key:e.key,title:e.title,titleFrom:e.titleFrom,brand:e.brand};
    for(const p of e.plates){
      let job=p.jobId?jobById.get(p.jobId):null;
      // 작업 ID가 없는 옛 작업실 판만 같은 채널 ∧ ±10분으로 짝(10-21 이전 기록)
      const channel=channelOf(p.platform,p.handle);
      if(!job&&p.method==='작업실'&&!p.jobId&&channel)job=jobs.find(j=>!usedJobs.has(j.id)&&j.channelId===channel.id&&Math.abs(Date.parse(j.scheduledAt)-Date.parse(p.at))<=10*60000)||null;
      if(job&&!usedJobs.has(job.id)){plates.push(fromJob(job,episode));continue;}
      if(job)continue;
      if(!channel&&!isAdmin)continue; // 서버 채널이 없는 계정(나라별 등)의 판은 관리자에게만
      plates.push({episode,channelId:channel?.id||null,...plateFace(channel,p),at:p.at,state:p.state,method:p.method,url:p.url,jobId:null,postId:p.postId||null,thumb:null});
    }
  }
  // 편 요약에 없는 서버 예약(아직 push 전인 편 · 편 밖 원고)도 보이되, 시험·출품작으로 가른 게시물은 뺀다.
  const excludedKeys=new Set((digest?.excluded?.urls||[]).map(u=>postKey(guessPlatform(u),u)).filter(Boolean));
  for(const j of jobs){
    if(usedJobs.has(j.id)||!jobState(j))continue;
    const c=channelById.get(j.channelId);if(j.publicationUrl&&excludedKeys.has(postKey(c?.platform,j.publicationUrl)))continue;
    plates.push(fromJob(j,{key:'post:'+j.postId,title:postTitles[j.postId]||j.contentSummary?.title||'제목 없는 원고',titleFrom:'post',brand:brandOf(c||{})}));
  }
  // 2) 주소 없는 서버 밖 판 ↔ 수집 게시물(같은 채널 · 판 시각 ±60분). 짝이 있으면 게시됨, 2시간 지나도 없으면 「확인 필요」.
  //    서버 예약 작업 판(jobId)은 서버 상태가 진실이라 추정하지 않는다. 주소를 이미 가진 판의 게시물은 다른 판이 빌리지 못하게 먼저 묶는다.
  for(const p of plates){const r=p.url?recentByKey.get(postKey(p.platform,p.url)):null;if(r)usedRecent.add(r.id);}
  for(const p of plates){
    if(p.jobId)continue;
    // 주소가 이미 있고 수집기가 그 게시물을 봤으면 게시됨(게시결과를 아직 고치지 않은 판)
    const seenPost=p.url&&['예약됨','승인 대기'].includes(p.state)?recentByKey.get(postKey(p.platform,p.url)):null;
    if(seenPost&&Date.parse(seenPost.publishedAt)<=nowMs){p.state='게시됨';continue;}
    if(p.url||!['예약됨','승인 대기'].includes(p.state)||Date.parse(p.at)>nowMs)continue;
    const candidates=(recentByChannel.get(p.channelId)||[]).filter(r=>!usedRecent.has(r.id)&&Math.abs(Date.parse(r.publishedAt)-Date.parse(p.at))<=PAIR_WINDOW).sort((a,b)=>Math.abs(Date.parse(a.publishedAt)-Date.parse(p.at))-Math.abs(Date.parse(b.publishedAt)-Date.parse(p.at)));
    if(candidates[0]){usedRecent.add(candidates[0].id);Object.assign(p,{state:'게시됨',url:candidates[0].url,at:candidates[0].publishedAt});}
    else if(nowMs-Date.parse(p.at)>CONFIRM_AFTER)p.state='확인 필요';
  }
  for(const p of plates){const k=postKey(p.platform,p.url);p.key=k;const r=k?recentByKey.get(k):null;p.views=r?.views??null;if(!p.thumb&&r?.thumbnailUrl)p.thumb={src:r.thumbnailUrl,kind:'image'};}
  // 한 편 안에서 같은 게시물(열쇠)은 한 판으로 — 짝 맞춤으로 주소를 빌린 판과 원래 주소가 있던 판이 겹칠 수 있다.
  {const seen=new Set();for(let i=0;i<plates.length;i++){const p=plates[i];if(!p.key)continue;const id=p.episode.key+'|'+p.key;if(seen.has(id)){plates.splice(i,1);i--;continue;}seen.add(id);}}

  // 3) 편 · 날짜로 묶기
  const dayOf=p=>kstDay(Date.parse(p.at));
  const RANK={'실패':0,'확인 필요':1,'검토 대기':2,'승인 대기':3,'예약됨':4,'게시됨':5,'보류':6};
  const group=rows=>{const map=new Map();for(const p of rows){const id=p.episode.key+'|'+dayOf(p);const g=map.get(id)||{key:p.episode.key,title:p.episode.title,brand:p.episode.brand,date:dayOf(p),time:kst(p.at).slice(11),method:null,state:null,thumb:null,plates:[]};if(kst(p.at).slice(11)<g.time)g.time=kst(p.at).slice(11);g.method=g.method||p.method;g.thumb=g.thumb||p.thumb;g.plates.push(p);map.set(id,g);}
    return [...map.values()].map(g=>{const states=g.plates.map(p=>p.state);const worst=states.slice().sort((a,b)=>(RANK[a]??9)-(RANK[b]??9))[0];return {...g,state:worst==='승인 대기'?'예약됨':worst,plates:g.plates.map(platePublic)};}).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));};
  const platePublic=p=>({platform:p.platform,handle:p.handle,state:p.state,url:p.url,views:p.views,due24:p.due24||null});
  const live=plates.filter(p=>p.at&&PLATFORMS.has(p.platform));
  const tonight=group(live.filter(p=>dayOf(p)===today&&['예약됨','승인 대기','게시됨','검토 대기','확인 필요','실패'].includes(p.state)));
  // 슬롯은 잡혔는데 판이 아직 없는 편 = 예약 전. 슬롯이 오늘이면 「오늘 나가는 것」에, 사흘 안이면 「다음 사흘」에. 서버 채널이 없는 계정 판은 관리자에게만.
  const notYet=day=>(digest?.episodes||[]).filter(e=>!e.plates.length&&e.slot===day&&e.planned.length).map(e=>{
    const faces=e.planned.filter(a=>isAdmin||channelOf(a.platform,a.handle)).map(a=>plateFace(channelOf(a.platform,a.handle),a));
    return faces.length?{key:e.key,title:e.title,brand:e.brand,date:e.slot,time:null,method:null,state:'예약 전',thumb:null,plates:faces.map(f=>({...f,state:'예약 전',url:null,views:null,due24:null}))}:null;
  }).filter(Boolean);
  tonight.push(...notYet(today));
  const held=group(live.filter(p=>dayOf(p)>=today&&p.state==='보류'));
  const ahead=[1,2,3].map(n=>addDays(today,n));
  const upcoming=group(live.filter(p=>ahead.includes(dayOf(p))&&p.state!=='보류'));
  for(const d of ahead)upcoming.push(...notYet(d));
  upcoming.sort((a,b)=>(a.date+(a.time||'99')).localeCompare(b.date+(b.time||'99')));
  for(const p of live){const k=p.key,e=k?perfByKey.get(k):null,c24=e?.checkpoints?.find(c=>c.hours===24);p.due24=c24&&!['recorded','missed'].includes(c24.status)?kst(c24.dueAt):null;}
  const yesterdayRows=group(live.filter(p=>dayOf(p)===yesterday&&['게시됨','확인 필요'].includes(p.state)));

  // 4) 내 차례 — 검토 링크 대기(원고별) · 손이 필요한 예약
  const reviewMap=new Map();
  for(const p of plates.filter(p=>p.state==='검토 대기'&&p.jobId)){const g=reviewMap.get(p.postId)||{postId:p.postId,title:p.episode.title,at:kst(p.at),thumb:p.thumb,plates:[]};if(kst(p.at)<g.at)g.at=kst(p.at);g.plates.push({platform:p.platform,handle:p.handle});reviewMap.set(p.postId,g);}
  const review=[...reviewMap.values()].sort((a,b)=>a.at.localeCompare(b.at));
  const problems=jobs.filter(j=>NEED_HAND[j.status]).sort((a,b)=>String(b.scheduledAt||'').localeCompare(String(a.scheduledAt||''))).map(j=>{const c=channelById.get(j.channelId);return {id:j.id,state:NEED_HAND[j.status],title:postTitles[j.postId]||j.contentSummary?.title||'',...plateFace(c),at:kst(j.scheduledAt),message:String(j.message||'').slice(0,300)};});

  // 5) 알아 둘 것 — 답 안 한 댓글(Claude 몫이라 내 차례에 안 넣음)
  const open=inbox.filter(i=>i.open);
  const byChannel=new Map();for(const i of open)byChannel.set(i.channelId,(byChannel.get(i.channelId)||0)+1);
  const byPost=new Map();for(const i of open)if(i.collectorPostId&&commentPosts[i.collectorPostId])byPost.set(i.collectorPostId,(byPost.get(i.collectorPostId)||0)+1);
  const topId=[...byPost.entries()].sort((a,b)=>b[1]-a[1])[0];
  const comments={total:open.length,recent7d:open.filter(i=>Date.parse(i.remoteCreatedAt)>=nowMs-7*DAY).length,
    channels:[...byChannel.entries()].sort((a,b)=>b[1]-a[1]).map(([id,n])=>({...plateFace(channelById.get(id)||{}),n})).filter(c=>c.platform),
    top:topId?{title:String(commentPosts[topId[0]].title||'').split(/\n/)[0].slice(0,80),n:topId[1],url:commentPosts[topId[0]].url||null}:null};

  // 6) 수집 한 줄
  const offPlatforms=[...new Set((collection.items||[]).filter(i=>i.status==='unsupported').map(i=>channelById.get(i.channelId)?.platform).filter(Boolean))];
  const numbersAt=recent.map(r=>r.lastSeenAt).filter(Boolean).sort().at(-1)||null;
  const health={collectOk:collection.successToday??0,collectTotal:collection.total??channels.length,failed:collection.failed??0,needsReconnect:collection.needsReconnect??0,overdue:collection.overdue??0,collectedAt:collection.lastSuccessAt?kst(collection.lastSuccessAt):null,offPlatforms,numbersAt:numbersAt?kst(numbersAt):null};

  // 7) 성과 — 최근 7일 게시된 판, 판마다 24·72시간 관측과 장부 배수(견줄 편 4개부터)
  const pointOf=(p,point,hours)=>{
    const e=p.key?perfByKey.get(p.key):null,c=e?.checkpoints?.find(x=>x.hours===hours),j=p.key?judgeByKey.get(p.key+'|'+point):null;
    const m=c&&c.status==='recorded'?c.metrics||{}:null;if(!m&&!j)return null;
    return {views:m?.views??null,likes:m?.likes??null,comments:m?.comments??null,shares:m?.shares??null,saves:m?.saves??null,retention3s:m?.earlyRetention3sPct??null,avgWatch:m?.averageWatchSeconds??null,
      multiple:j?.multiple&&j.multiple.n>=4?j.multiple:null,sampleN:j?.multiple?.n??0,verdict:j?.verdict||null};
  };
  // 성과는 편 기록에 있는 편만 견준다(편 밖 서버 예약은 시험 원고일 수 있다 — 오늘·어제 목록에는 보인다).
  const published=live.filter(p=>p.state==='게시됨'&&p.url&&!p.episode.key.startsWith('post:')&&dayOf(p)>=since&&p.at<=new Date(nowMs).toISOString());
  const resultMap=new Map();
  for(const p of published){
    const e=p.key?perfByKey.get(p.key):null,points={};
    for(const [point,hours] of [['24h',24],['72h',72]]){const pt=pointOf(p,point,hours);if(pt&&(pt.views!==null||pt.multiple||pt.verdict))points[point]=pt;}
    const pending=(e?.checkpoints||[]).filter(c=>['pending','retry','collecting'].includes(c.status)).map(c=>({hours:c.hours,dueAt:kst(c.dueAt)}));
    const r=p.key?recentByKey.get(p.key):null;
    const g=resultMap.get(p.episode.key)||{key:p.episode.key,title:p.episode.title,titleFrom:p.episode.titleFrom,brand:p.episode.brand,firstAt:p.at,thumb:null,plates:[]};
    if(p.at<g.firstAt)g.firstAt=p.at;g.thumb=g.thumb||p.thumb;
    if(g.titleFrom!=='prep'&&p.platform==='youtube'&&r?.title)g.title=String(r.title).split(/\n/)[0].replace(/\s*#(?!\d+(?:\s|$))[^\s#]+/g,'').trim()||g.title; // 해시태그만 뺀다(「#5」 같은 회차 번호는 둔다)
    g.plates.push({platform:p.platform,handle:p.handle,url:p.url,points,now:r?{views:r.views??null,likes:r.likes??null,comments:r.comments??null}:null,pending});
    resultMap.set(p.episode.key,g);
  }
  const ORDER=['youtube','instagram','facebook','tiktok'];
  const list=[...resultMap.values()].map(g=>({key:g.key,title:g.title,brand:g.brand,firstAt:kst(g.firstAt),thumb:g.thumb,plates:g.plates.sort((a,b)=>ORDER.indexOf(a.platform)-ORDER.indexOf(b.platform))})).sort((a,b)=>b.firstAt.localeCompare(a.firstAt));

  // 8) 계정 — 자동 게시 · 수집 · 30일 편수·조회 · 마지막 게시 · 고칠 연결
  const from30=Date.parse(addDays(today,-29)+'T00:00:00+09:00');
  const providerBy=new Map(providerRows.map(r=>[r.channelId,r])),healthBy=new Map(healthRows.map(r=>[r.channelId,r])),itemBy=new Map((collection.items||[]).map(i=>[i.channelId,i]));
  const accountsOut=channels.map(c=>{
    const mine=(recentByChannel.get(c.id)||[]).filter(p=>Date.parse(p.publishedAt)>=from30&&Date.parse(p.publishedAt)<=nowMs);
    const last=mine.map(p=>p.publishedAt).sort().at(-1);
    const row=providerBy.get(c.id),state=healthBy.get(c.id)?.state,item=itemBy.get(c.id);
    const publish=state==='connected'||row?.supported&&row.enabled&&row.connected?'자동 게시':row?.supported===false||state==='unsupported'?'앱에서 직접':'안 켬';
    // 지금 수집 건강(collectionHealth)을 먼저 본다 — 채널 status는 마지막 수집 결과라 연결이 끊긴 뒤에도 success로 남는다.
    const now=item?.status||c.status;
    const collect=['success','partial'].includes(now)?'수집 중':now==='unsupported'||(!item&&c.status==='not-connected')?'수집 안 함':'수집 멈춤';
    let connectUrl=null;try{const u=new URL(row?.connectUrl||'','https://workspace.invalid');if(u.origin==='https://workspace.invalid'&&u.pathname==='/api/oauth/'+c.platform+'/start'&&u.searchParams.get('channelId')===c.id&&u.searchParams.get('publishing')==='1')connectUrl=u.pathname+u.search;}catch{}
    const fix=item&&['reconnect','connect'].includes(item.action)?{kind:'collect',message:item.label||'수집 연결을 다시 해야 해요'}:row?.supported&&row.enabled&&!row.connected?{kind:'publish',message:'게시 권한을 다시 연결해야 해요',connectUrl}:null;
    const brand=brandOf(c),name=String(c.displayName||'');
    return {channelId:c.id,platform:c.platform,handle:atHandle(c.platform,c.handle),name:name==='유호'&&brand!=='유호'?'':name,brand,country:countryOf(c),publish,collect,posts30:mine.length,views30:mine.reduce((s,p)=>s+(Number(p.views)||0),0),lastPost:last?kstDay(Date.parse(last)):null,fix};
  });

  const digestAge=digest?Math.max(0,Math.round((nowMs-Date.parse(digest.generatedAt))/60000)):null;
  return {generatedAt:new Date(nowMs).toISOString(),today,digest:digest?{generatedAt:digest.generatedAt,ageMinutes:digestAge,commitAt:digest.source?.commitAt||null}:null,
    review,problems,tonight,held,upcoming,yesterday:yesterdayRows,comments,health,
    results:{since,list,excluded:{운영시험:digest?.excluded?.운영시험||0,작품:digest?.excluded?.작품||0}},accounts:accountsOut};
}
function guessPlatform(url){try{const h=new URL(url).hostname.replace(/^www\./,'');return /youtube|youtu\.be/.test(h)?'youtube':/instagram/.test(h)?'instagram':/facebook/.test(h)?'facebook':/tiktok/.test(h)?'tiktok':null;}catch{return null;}}

// ── 서버에 붙이기 ──
export function createSocialSimple({store,publishing,marketing,provider,clock=()=>new Date().toISOString()}){
  const current=(user,write=false)=>{const live=store.get('users',user?.id);if(!live?.active||!['admin','manager','member','viewer'].includes(live.role))throw fail('먼저 로그인해 주세요.',401);if(write&&live.role==='viewer')throw fail('열람 계정에서는 바꿀 수 없어요.',403);return live;};
  const statements=new Map(),sql=text=>{if(!statements.has(text))statements.set(text,store.db.prepare(text));return statements.get(text);};
  // 최근 31일 수집 게시물(보관 기한 안 · 사라지지 않은 것)
  function recentPosts(channelIds,now){
    if(!channelIds.length)return [];
    const fromIso=new Date(Date.parse(now)-31*DAY).toISOString();
    return sql("SELECT body FROM documents WHERE kind='posts' AND json_extract(body,'$.channelId') IN (SELECT value FROM json_each(?)) AND json_extract(body,'$.unavailableAt') IS NULL AND (json_extract(body,'$.expiresAt') IS NULL OR julianday(json_extract(body,'$.expiresAt'))>julianday(?)) AND julianday(json_extract(body,'$.publishedAt')) BETWEEN julianday(?) AND julianday(?)")
      .all(JSON.stringify(channelIds),now,fromIso,now).map(row=>JSON.parse(row.body)).map(p=>({id:p.id,channelId:p.channelId,url:p.url,title:p.title,publishedAt:p.publishedAt,thumbnailUrl:typeof p.thumbnailUrl==='string'&&/^https:\/\//.test(p.thumbnailUrl)?p.thumbnailUrl:null,lastSeenAt:p.lastSeenAt||null}));
  }
  // 게시물마다 마지막 숫자 — 하루 숫자(snapshots, id 「게시물:날짜」)와 최근 7일 관측(hypeObservations, id 「게시물:시각」)을 열쇠 범위로 읽는다.
  function latestNumbers(posts,now){
    const out=new Map();
    for(const kind of ['snapshots','hypeObservations']){
      const read=sql(`SELECT body FROM documents WHERE kind='${kind}' AND id>=? AND id<? ORDER BY id DESC LIMIT 4`);
      for(const p of posts){
        for(const row of read.all(p.id+':',p.id+';')){const s=JSON.parse(row.body);if(s.expiresAt&&Date.parse(s.expiresAt)<=Date.parse(now))continue;if(s.views===null||s.views===undefined)continue;const old=out.get(p.id);if(!old||String(s.checkedAt)>String(old.checkedAt))out.set(p.id,{views:s.views,likes:s.likes??null,comments:s.comments??null,checkedAt:s.checkedAt});break;}
      }
    }
    return out;
  }
  function saveDigest(user,input){
    user=current(user,true);const now=clock(),digest=validateDigest(input,{now});
    return store.transaction(()=>{
      const old=store.get(DIGEST_KIND,DIGEST_ID);
      if(old&&Date.parse(digest.generatedAt)<Date.parse(old.generatedAt)-STALE_DIGEST)throw fail('이미 더 새 편 요약이 있어요.',409);
      store.put(DIGEST_KIND,DIGEST_ID,{id:DIGEST_ID,...digest,receivedAt:now,byUserId:user.id});
      return {ok:true,generatedAt:digest.generatedAt,episodes:digest.episodes.length,judgments:digest.judgments.length,dropped:digest.dropped};
    });
  }
  function workspace(user,{channels=[],collection={},performance=[]}={}){
    user=current(user);const now=clock();
    const visible=channels.filter(c=>c.active!==false&&c.hidden!==true),ids=visible.map(c=>c.id);
    const summary=publishing.summary(user),allowed=new Set(ids);
    const jobs=(summary.jobs||[]).filter(j=>allowed.has(j.channelId));
    const postTitles=Object.fromEntries((summary.posts||[]).map(p=>[p.id,p.title||'']));
    // 썸네일은 예약 판의 원고 첫 미디어만(몇 건) — 원고 본문 전체를 읽지 않는다.
    const thumbs={};
    for(const postId of new Set(jobs.filter(j=>['scheduled','published'].includes(j.status)).map(j=>j.postId))){
      const post=store.get('socialPosts',postId),m=(post?.media||[])[0]||(post?.variants||[]).flatMap(v=>v.media||[])[0];
      const id=m?.assetId||m?.id;if(id&&/^[\w-]{1,100}$/.test(id))thumbs[postId]={src:'/api/social/media/'+id,kind:String(m.type||m.mimeType||'').startsWith('video')?'video':'image'};
    }
    const recent=recentPosts(ids,now),numbers=latestNumbers(recent,now);
    for(const p of recent)Object.assign(p,numbers.get(p.id)||{views:null,likes:null,comments:null});
    // 댓글은 개수·채널·많은 글만 — 본문·작성자는 여기서 버린다.
    const inbox=(marketing.inbox?.(user)||[]).filter(i=>allowed.has(i.channelId)).map(i=>({channelId:i.channelId,open:i.effectiveStatus==='open'&&!i.alreadyAnswered&&!i.isAccountReply,remoteCreatedAt:i.remoteCreatedAt||i.createdAt||null,collectorPostId:i.collectorPostId||null}));
    const commentPosts={};
    for(const postId of new Set(inbox.filter(i=>i.open&&i.collectorPostId).map(i=>i.collectorPostId))){const p=store.get('posts',postId);if(p&&allowed.has(p.channelId))commentPosts[postId]={title:p.title||'',url:/^https:\/\//.test(p.url||'')?p.url:null};}
    const providerRows=(provider?.settings?.(user)?.channels||[]).filter(r=>allowed.has(r.channelId));
    const healthRows=(provider?.health?.(user)?.channels||[]).filter(r=>allowed.has(r.channelId));
    const digest=store.get(DIGEST_KIND,DIGEST_ID)||null;
    return buildSocialSimple({now,isAdmin:user.role==='admin',channels:visible,collection,jobs,postTitles,thumbs,recent,performance:performance.filter(e=>allowed.has(e.channelId)),inbox,commentPosts,providerRows,healthRows,digest});
  }
  return {workspace,saveDigest};
}
