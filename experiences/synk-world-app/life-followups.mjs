// 생활 한국어 재확인 투영(Atlas × WORLD 2단계 D, 2026-11-08 · 설계 docs/_ops/qa/atlas-world-engine-20261108/D_생활한국어.md §4-4).
// Temper 줄 가운데 경험 world-life. 둘째 일정 · 성적 · 사건 기록을 두지 않는다 — Temper가 정한 창을 제품 길로 열 수 있는지만 본다.
// world-learning-followups.mjs와 따로 둔 까닭: 이 함수를 그 파일의 새 이름으로 부르면, 공개 때 옛 판이 캐시에 남은 사람의 화면이 그 이름을 못 찾아 깨진다.
// 확인할 수 있는 문항(공급)은 같은 칸이고, 문항 · 계열 모두 처음 보고(앵커는 이미 보였으니 앵커와 같은 계열 · 문항은 여기서 빠진다), 판정 자격이 있고
// (검수 pass · 메타 일치 · 장면 아님), 제품 이력으로도 처음인(productMet) 생활 문항 가운데 제품 길로 열 수 있는 것 — 지금 돌아온 새 상황 복습,
// 없으면 팩 순서상 다음에 할 레슨의 본문항. 제품 일정을 앞당기거나 문항을 만들지 않는다. route: {route:'review',lessonId,reviewIds} | {route:'lesson',lessonId}.
// life: 문항 정체 · 판정 자격 · 제품 이력 대조 부품(worldLearning.life) — 이 모듈은 브라우저가 묶지 않고 읽어 Strata · 판정 목록을 직접 부르지 않는다.
// taskVersion: 지금 코치의 지도판. 줄에 current가 없는 옛 Temper 투영이면 연습 투영(followupRows)처럼 그 줄의 지도판과 견준다(row.current ?? 옛 비교).
export function lifeFollowupRows({projection,seen,snapshot=null,now=Date.now(),life=null,assessable=life?.lifeAssessable,taskVersion}={}){
 const items=typeof life?.lifeItems==='function'?life.lifeItems():null,productMet=life?.productMet;
 if(!projection||!Array.isArray(projection.items)||typeof seen!=='function'||!Array.isArray(items)||typeof productMet!=='function'||typeof assessable!=='function')return {available:false,limited:true,rows:[]};
 // 칸 상한은 줄 없는 칸을 남길 뿐 다른 칸을 거짓으로 만들지 않는다(temper-followup-3).
 const limited=projection.evidenceComplete!==true||projection.coverage?.retentionLimited===true;
 const progress=snapshot&&typeof snapshot==='object'?snapshot:{};
 const lessons=progress.lessons||{},reviews=progress.reviews||{};
 const fresh=item=>{try{return seen({itemKey:item.itemKey,familyKey:item.familyKey})===false&&productMet(item,progress)===false;}catch{return false;}};
 // 제품 길: 돌아온 새 상황 복습(제품 일정 그대로) · 팩마다 아직 마치지 않은 첫 레슨(장면 레슨은 근거가 없어 빠진다).
 const due=new Set(Object.values(reviews).filter(review=>Number.isFinite(review?.dueAt)&&review.dueAt<=now).map(review=>review.id));
 // 제품은 끝내지 않은 복습 회차가 있으면 고른 복습 대신 그 회차를 연다(life-progress startReview). 그동안 복습 길은 그 회차의 남은 문항뿐이다
 // — 다른 복습을 약속하면 「확인」이 다른 문항을 연다.
 const active=progress.activeReview&&Array.isArray(progress.activeReview.ids)?progress.activeReview:null;
 const pending=active?active.ids.filter(id=>!active.answers?.[id]):[];
 const reviewOpens=id=>pending.length?pending.includes(id):due.has(id);
 // 팩마다 아직 마치지 않은 첫 레슨(문항 차례가 팩 → 레슨 → 문항이라 처음 만나는 미완료 레슨이 그 팩의 다음 레슨이다).
 const next=new Map();for(const item of items)if(!item.review&&!next.has(item.packId)&&lessons[item.lessonId]?.completedAt==null)next.set(item.packId,item.lessonId);
 const routeOf=item=>item.review?reviewOpens(`${item.questionId}-transfer`)?{route:'review',lessonId:item.lessonId,reviewIds:[`${item.questionId}-transfer`]}:null
  :next.get(item.packId)===item.lessonId&&!lessons[item.lessonId]?.answers?.[item.questionId]?{route:'lesson',lessonId:item.lessonId}:null;
 const rows=projection.items.filter(row=>row.gameId==='world-life').map(row=>{
  const m=row.measure||{};
  const supply=!limited&&row.status==='due'&&(row.current??m.taskVersion===taskVersion)?items.filter(item=>!item.confounded&&item.skillId===m.skillId&&item.difficulty===m.difficulty
   &&item.responseFormat===m.responseFormat&&item.modality===m.modality&&item.audioRequired===(m.audioRequired===true)&&assessable(item)&&fresh(item))
   .map(item=>({item,route:routeOf(item)})).filter(row=>row.route):[];
  // 돌아온 복습을 먼저(제품이 이미 약속한 자리), 그다음 원고 차례.
  supply.sort((a,b)=>Number(b.route.route==='review')-Number(a.route.route==='review'));
  return {...row,item:supply[0]?.item||null,route:supply[0]?.route||null,available:supply.length>0};
 });
 // 지금 열 수 있는 줄을 먼저 — 문항 없는 줄이 12줄을 채워 열 수 있는 줄이 밀려나지 않게.
 const rank=row=>row.status==='due'?row.available?2:1:0;
 return {available:true,limited,rows:rows.sort((a,b)=>rank(b)-rank(a)||Date.parse(a.dueAt)-Date.parse(b.dueAt)).slice(0,12)};
}
