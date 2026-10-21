// WORLD 시험 계획(2026-10-20 결정 「시험·자격 준비 · 목표 급·시험일 · 시험 계획」, 최종 제안 §2-2 #11·§3).
// Core 교육 경로의 한 부분이다(새 엔진이 아니다): 학생이 밝힌 시험(종류·목표 급·시험일·방식·주당 시간)과 Core가 이미 읽은
// 항목 상태, 이번 주에 실제로 한 연습(Trail 기록·생활 진도)을 읽어 이번 주 연습 빈도와 영역 배분, 숙제 묶음(약한 항목의 새 문항),
// 다시 확인 일정, 도달 파악(혼자 해낸 항목 수·근거 수)을 낸다.
// - 순위는 Core가 정한다. 이 모듈은 Core recommendActivities에 넘길 목표 토큰(plan.*)만 만든다 — 목표는 같은 급한 정도 안의
//   순서만 바꾸고 관측된 필요·돌아온 복습을 가리지 않는다(atlas/learning.js). Core 문턱은 건드리지 않는다.
// - 급수 환산·합격 판정·점수 예측을 하지 않는다. 목표 급은 학생이 밝힌 값을 그대로 보이고 계획의 범위(TOPIK I·II)만 정한다.
// - 쉬거나 빠진 날을 빚으로 쌓지 않는다: 이번 주(월~일, 한국 시각)에 한 것만 세고 지난주 남은 것을 넘기지 않는다.
//   남은 날 수로 다그치지 않고, 「D-n」·연속 기록을 만들지 않는다.
// - 계획은 따로 저장하지 않는다. 같은 선언값·기록·날짜면 늘 같은 계획이다(두 번째 기록을 만들지 않는다). 실행은 Trail 그대로다.
// 지금은 WORLD 한 제품만 쓰므로 제품 폴더에 둔다(docs/아틀라스_설계.md#common-capability-promotion). 화면 글은 없다(코드만 돌려준다).

const DAY=86400000,KST=9*3600000;
export const EXAM_PLAN_POLICY=Object.freeze({version:'world-exam-plan-1',
 // 주당 쓸 수 있는 시간(계약 r2 시험정보 주당시간) → 이번 주 연습 횟수와 한 번 길이(분). 고르지 않으면 3번 · 15분.
 weekly:Object.freeze({30:Object.freeze({sessions:2,minutes:15}),60:Object.freeze({sessions:3,minutes:20}),120:Object.freeze({sessions:5,minutes:24}),180:Object.freeze({sessions:6,minutes:30})}),
 fallback:Object.freeze({sessions:3,minutes:15}),
 // 시험까지 남은 주 → 단계. 가까울수록 시험형 문항 연습(읽기 짧은 연습·짧은 진단·쓰기 과제)의 비중이 커지고 생활 레슨이 빠진다.
 phases:Object.freeze([['final',1],['near',4],['mid',12]]),
 // 다시 확인(짧은 진단의 새 문항): final·near 매주, mid 2주마다, far·날짜 없음 4주마다.
 recheckEvery:Object.freeze({final:1,near:1,mid:2,far:4,none:4}),
 // 생활 레슨을 몇 번째 연습부터 남길지(그 수 이상일 때 한 번): 시험이 멀면 생활과 섞고, 가까우면 빼고 시험형 연습만.
 lifeFrom:Object.freeze({none:4,far:4,mid:6,near:Infinity,final:Infinity,past:4}),
 // 한 연습으로 셀 간격: 같은 연습(경험)에서 이 시간 넘게 쉬면 다른 번으로 센다.
 sessionGapMs:20*60000});
const EXAM_TYPES=['topik1','topik2','unknown'],EXAM_MODES=['pbt','ibt','unknown'];
export const EXAM_GRADES=Object.freeze({topik1:Object.freeze([1,2]),topik2:Object.freeze([3,4,5,6])});
const planRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const planTime=value=>typeof value==='number'&&Number.isFinite(value);

// 시험일: 「2027-01」(월까지만) 또는 「2027-01-11」. 실제 달력 날짜인지 본다.
export function parseExamDate(value){
 const match=typeof value==='string'&&/^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.exec(value);
 if(!match)return null;
 const [year,month,day]=[Number(match[1]),Number(match[2]),match[3]?Number(match[3]):null];
 const start=Date.UTC(year,month-1,day||1)-KST;
 if(day&&new Date(start+KST).getUTCDate()!==day)return null;
 const end=day?start+DAY:Date.UTC(year,month,1)-KST;
 return {value,year,month,day,start,end,exact:!!day};
}
// 학생이 밝힌 시험 정보(배우는 이유가 「시험·자격 준비」일 때만, 모두 선택). 틀린 값은 그 칸만 버린다.
export function examInfo(values){
 const source=planRecord(values)?values:{};
 const reasons=Array.isArray(source.reasons)?source.reasons:[];
 if(source.primaryReason!=='exam'&&!reasons.includes('exam'))return null;
 const type=EXAM_TYPES.includes(source.examType)?source.examType:null;
 const grade=type&&EXAM_GRADES[type]?.includes(source.targetGrade)?source.targetGrade:null;
 const date=parseExamDate(source.examDate);
 const mode=EXAM_MODES.includes(source.examMode)?source.examMode:null;
 const weekly=Object.hasOwn(EXAM_PLAN_POLICY.weekly,source.weeklyMinutes)?Number(source.weeklyMinutes):null;
 return {type,grade,date:date?date.value:null,mode,weeklyMinutes:weekly};
}
// 한국 시각 월요일 0시부터 일주일.
export function examWeek(now){
 if(!planTime(now))throw TypeError('WORLD exam plan needs a time');
 const local=now+KST,day=new Date(local).getUTCDay(),midnight=Math.floor(local/DAY)*DAY;
 const start=midnight-((day+6)%7)*DAY-KST;
 return {start,end:start+7*DAY};
}
// 시험까지 남은 주로 단계. 시험일을 모르면 'none', 지났으면 'past'. 월만 아는 시험은 그 달 1일을 기준으로(일찍 준비하는 쪽).
export function examPhase(date,now){
 const parsed=typeof date==='string'?parseExamDate(date):date;
 if(!parsed)return {phase:'none',weeks:null};
 if(now>=parsed.end)return {phase:'past',weeks:0};
 const weeks=Math.max(0,Math.ceil((parsed.start-now)/(7*DAY)));
 for(const [phase,limit]of EXAM_PLAN_POLICY.phases)if(weeks<=limit)return {phase,weeks};
 return {phase:'far',weeks};
}
// 그 주(월요일 0시 weekStart)가 다시 확인할 주인가: 시험까지 남은 주 수가 그 단계 주기로 나누어떨어질 때(시험이 가까우면 매주).
// 시험일을 모르면 달력 주 번호로 4주마다. 시험이 지났으면 아니다.
export function recheckWeek(date,weekStart){
 const {phase,weeks}=examPhase(date,weekStart);
 if(phase==='past')return false;
 const index=weeks===null?Math.floor((weekStart+KST)/(7*DAY)):weeks;
 return index%(EXAM_PLAN_POLICY.recheckEvery[phase]||4)===0;
}

// 처음 낸 답: 첫 시도가 정답·오답으로 채점된 것. 건너뛴 문항·듣지 못해 채점하지 않은 시도(진단을 열자마자 그만둔 것 포함)는 세지 않는다.
const planAnswered=event=>event?.type==='practice.attempted'&&event.attemptNo===1&&(event.verdict==='correct'||event.verdict==='incorrect');

// 이번 주에 실제로 한 연습: Trail 기록(처음 낸 답이 있는 연습)과 생활 진도(레슨·복습에 답한 날). 영역은 그 문항의 측정 영역,
// 짧은 진단(코치 'world-home')은 다시 확인, 읽기 짧은 연습(코치 'world-practice')은 읽기, 쓰기 연습(③ 코치 'world-writing')은 쓰기다.
// 말하기 연습(10-21)은 Trail에 채점 없는 시도만 남거나(말하기 항목이 생긴 뒤) 기기에만 남으므로 기기 기록의 시각(extra {area:'speaking'})으로 센다.
export function weekActivity({events=[],progress=null,week,extra=[]}={}){
 if(!planRecord(week)||!planTime(week.start)||!planTime(week.end))throw TypeError('WORLD exam plan needs a week');
 const done={listening:0,reading:0,writing:0,recheck:0,life:0,speaking:0},decisions=new Map(),shown=new Map(),runs=new Map();
 for(const event of Array.isArray(events)?events:[]){
  if(event?.type==='decision.made')decisions.set(event.id,event.experienceId);
  else if(event?.type==='practice.presented')shown.set(event.id,event);
 }
 for(const event of Array.isArray(events)?events:[]){
  if(!planAnswered(event))continue;
  const at=Date.parse(event.at),presentation=shown.get(event.presentationId);
  if(!Number.isFinite(at)||at<week.start||at>=week.end||!presentation)continue;
  const experience=decisions.get(presentation.decisionId)||'unknown',modality=presentation.measure?.modality;
  const area=experience==='world-home'?'recheck':['reading','listening','writing'].includes(modality)?modality:null;
  if(!area)continue;
  const key=`${area}|${experience}`;if(!runs.has(key))runs.set(key,[]);runs.get(key).push(at);
 }
 // 기기에만 남는 연습 시각(쓰기 연습의 규칙 점검 · Trail에 쓰기 기록이 아직 없다): 같은 영역의 Trail 기록과 시각을 합쳐 같은 간격으로
 // 센다(나중에 Trail에도 남으면 같은 자리의 연습은 한 번으로 묶인다).
 for(const row of Array.isArray(extra)?extra:[]){
  if(!planRecord(row)||!Object.hasOwn(done,row.area)||row.area==='life'||!Array.isArray(row.times))continue;
  const times=row.times.map(value=>planTime(value)?value:Date.parse(value)).filter(at=>Number.isFinite(at)&&at>=week.start&&at<week.end);
  if(!times.length)continue;
  const key=[...runs.keys()].find(name=>name.startsWith(`${row.area}|`))||`${row.area}|device`;
  if(!runs.has(key))runs.set(key,[]);runs.get(key).push(...times);
 }
 for(const [key,times]of runs){
  times.sort((a,b)=>a-b);let count=0,last=-Infinity;
  for(const at of times){if(at-last>EXAM_PLAN_POLICY.sessionGapMs)count+=1;last=at;}
  done[key.split('|')[0]]+=count;
 }
 // 생활 레슨: 이번 주에 레슨이나 새 상황 복습에 답한 날마다 한 번.
 const days=new Set(),dayOf=at=>new Date(at+KST).toISOString().slice(0,10),inWeek=at=>planTime(at)&&at>=week.start&&at<week.end;
 for(const lesson of Object.values(planRecord(progress?.lessons)?progress.lessons:{}))for(const answer of Object.values(planRecord(lesson?.answers)?lesson.answers:{}))if(inWeek(answer?.at))days.add(dayOf(answer.at));
 for(const day of Object.values(planRecord(progress?.daily?.days)?progress.daily.days:{}))for(const item of Object.values(planRecord(day?.items)?day.items:{}))if(inWeek(item?.observedAt))days.add(dayOf(item.observedAt));
 done.life+=days.size;
 for(const row of Array.isArray(extra)?extra:[])if(planRecord(row)&&Object.hasOwn(done,row.area)&&Number.isInteger(row.count)&&row.count>0)done[row.area]+=row.count;
 return done;
}

// 이번 주 앞에서 가장 늦은 다시 확인(짧은 진단, 코치 'world-home'에서 처음 낸 답) 시각. 없으면 null.
export function lastRecheck({events=[],before=Infinity}={}){
 const decisions=new Map(),shown=new Map();let last=null;
 for(const event of Array.isArray(events)?events:[]){if(event?.type==='decision.made')decisions.set(event.id,event.experienceId);else if(event?.type==='practice.presented')shown.set(event.id,event);}
 for(const event of Array.isArray(events)?events:[]){
  if(!planAnswered(event))continue;
  const at=Date.parse(event.at),presentation=shown.get(event.presentationId);
  if(!Number.isFinite(at)||at>=before||!presentation||decisions.get(presentation.decisionId)!=='world-home')continue;
  if(last===null||at>last)last=at;
 }
 return last;
}

const WEAK=new Set(['practice','supported','review']);
const weakOf=skill=>WEAK.has(skill.status)||skill.status==='checking'&&skill.incorrect>0;
// Core 상태에서 영역마다 필요한 정도: 그 영역에서 다시 볼 항목(보충·도움으로만·다시 확인·틀린 답이 있는 확인 중)의 수.
// 처음 온 사람은 모든 영역이 0이라 고르게 나뉜다. 기록이 불완전하면 필요를 만들지 않는다(학습기준 §7-4 「불완전 기록의 모름」).
// prefix: 모든 영역에 같은 항목 이름 꼴 하나, 또는 영역마다 읽을 지도의 꼴({listening:/…/, reading:/…/, writing:/…/}).
function domainNeeds(summary,domains,prefix){
 const match=skill=>{const rule=prefix instanceof RegExp?prefix:prefix?.[skill?.domain];return rule instanceof RegExp&&rule.test(skill?.id||'');};
 const skills=(planRecord(summary)&&Array.isArray(summary.skills)?summary.skills:[]).filter(match);
 const complete=summary?.evidenceComplete===true,needs={};
 for(const domain of domains)needs[domain]=complete?skills.filter(skill=>skill.domain===domain&&weakOf(skill)).length:0;
 return {needs,skills,complete};
}
// 남은 횟수 나누기: 연습할 거리가 있는 영역마다 먼저 한 번씩(잘하는 영역도 아주 빼지 않는다 · 학습기준 §7-3), 남는 횟수는 다시 볼
// 항목이 많은 영역에 더 준다(큰 나머지 순). 횟수가 영역 수보다 적으면 더 필요한 영역부터 한 번씩. needs[영역]이 null이면 닫힌 영역이다.
function split(total,needs,boost={}){
 const open=Object.keys(needs).filter(key=>needs[key]!=null),out=Object.fromEntries(Object.keys(needs).map(key=>[key,0]));
 if(total<=0||!open.length)return out;
 const weight=key=>(needs[key]+.5)*(boost[key]||1);
 const order=[...open].sort((a,b)=>weight(b)-weight(a)||a.localeCompare(b));
 if(total<open.length){for(const key of order.slice(0,total))out[key]=1;return out;}
 for(const key of open)out[key]=1;
 let left=total-open.length;
 const sum=open.reduce((n,key)=>n+weight(key),0),rows=open.map(key=>({key,exact:left*weight(key)/sum}));
 for(const row of rows)out[row.key]+=Math.floor(row.exact);
 left-=rows.reduce((n,row)=>n+Math.floor(row.exact),0);
 rows.sort((a,b)=>(b.exact-Math.floor(b.exact))-(a.exact-Math.floor(a.exact))||weight(b.key)-weight(a.key)||a.key.localeCompare(b.key));
 for(const row of rows){if(left<=0)break;out[row.key]+=1;left-=1;}
 return out;
}

// 이번 주 계획. available: 지금 열 수 있는 연습 — {practice:{skillId:짧은 연습 새 문항 수(읽기·듣기)}, listening:{skillId:[듣기 게임 후보 id]},
// recheck:새 문항 수, life:bool, writing:[쓰기 연습 후보], topik2:{listening:bool, reading:bool}(그 영역에 TOPIK II 문항이 있는지)}.
// 10-20 판의 reading:{skillId:수}도 받는다 — practice가 없으면 그것을 짧은 연습 수로 쓴다. classwork: 온라인 반 「이번 주 과제」(교사 배정) [{kind:'reading'|'writing', done}] —
// 반 과제가 있으면 그 갈래의 횟수를 반 과제로 먼저 채우고 나머지만 자기 연습으로 둔다(같은 주에 두 번 내지 않게).
// lastCheckAt: 이번 주 앞의 가장 늦은 다시 확인(lastRecheck) — 다음 확인을 그 단계의 주기보다 가깝게 잡지 않는다(10-21 검수).
// 말하기(10-21): 시험 정보에서 「말하기 평가도 준비해요」를 고른 TOPIK I·II 학생(exam.speaking===true)만 영역 speaking이 생긴다.
// 말하기는 TOPIK I·II에 더해 따로 고른 시험이라 다른 영역(다시 확인·듣기·읽기·쓰기·생활)의 자리를 빼앗지 않고, 열린 주에 한 번을 더한다
// (나누기 밖 — 다른 영역의 배분은 고르지 않은 학생과 같다). 이번 주에 한 번 이상 했으면 남은 횟수는 0이다.
// available.speaking: 지금 열 수 있는 말하기 연습 후보(시험 유형) · speakingNeeds: 이번 주에 아직 안 해 본 유형 수 — 「다음 연습」을 고를 때
// 남은 횟수가 같은 영역끼리의 순서에만 쓴다. 채점하지 않으므로 숙제 묶음·진행·도달 파악에 넣지 않는다. 고르지 않은 학생의 계획은 이 칸들이 없던 때와 같다.
export function buildExamPlan({exam,summary=null,now=Date.now(),done=null,available={},classwork=[],audioAvailable=true,lastCheckAt=null,speakingNeeds=null}={}){
 if(!planRecord(exam))return null;
 const week=examWeek(now),{phase,weeks}=examPhase(exam.date,now),policy=EXAM_PLAN_POLICY;
 const pace=exam.weeklyMinutes&&policy.weekly[exam.weeklyMinutes]||policy.fallback;
 const topik2=exam.type==='topik2',domains=topik2?['listening','reading','writing']:['listening','reading'];
 // TOPIK II: 영역마다 TOPIK II 문항(검수 통과 은행 문항)이 있으면 그 지도(ko2.*)의 항목을, 아직 없으면 TOPIK I 항목을 읽는다
 // (듣기·읽기 필요는 같은 뜻 — 문항이 생기기 전까지의 다리, 10-21 ④). Core 요약에 TOPIK II 지도가 없으면 모두 TOPIK I. 쓰기는 늘 TOPIK II.
 const ko2=planRecord(summary)&&Array.isArray(summary.skills)&&summary.skills.some(skill=>/^ko2\./.test(skill?.id||''));
 const two=domain=>topik2&&ko2&&(domain==='writing'||available.topik2?.[domain]===true);
 const MAPS={topik1:{listening:/^ko\.listening\.[a-z]+$/,reading:/^ko\.reading\.[a-z]+$/,writing:/^$/},topik2:{listening:/^ko2\.listening\.[a-z]+$/,reading:/^ko2\.reading\.[a-z]+$/,writing:/^ko2\.writing\.[a-z]+$/}};
 const prefix=Object.fromEntries(domains.map(domain=>[domain,MAPS[two(domain)?'topik2':'topik1'][domain]]));
 const {needs,skills,complete}=domainNeeds(summary,domains,prefix);
 // 도달 파악의 바탕: 듣기·읽기 모두 TOPIK II면 'topik2', 하나라도 TOPIK I로 세면 'topik1'(화면이 「TOPIK II 문항이 생기기 전까지 TOPIK I로 세요」).
 const basis=topik2&&ko2&&two('listening')&&two('reading')?'topik2':'topik1';
 const observed=skills.filter(skill=>(skill.n||0)>0||skill.status!=='unseen');
 const practice=planRecord(available.practice)?available.practice:planRecord(available.reading)?available.reading:{};
 const supply={practice,listening:planRecord(available.listening)?available.listening:{}};
 const domainOf=id=>String(id||'').split('.')[1];
 const has={listening:audioAvailable&&(Object.values(supply.listening).some(list=>Array.isArray(list)&&list.length)||Object.entries(practice).some(([id,n])=>domainOf(id)==='listening'&&n>0)),
  reading:Object.entries(practice).some(([id,n])=>domainOf(id)==='reading'&&n>0),writing:Array.isArray(available.writing)&&available.writing.length>0};
 const recheckFresh=Number.isInteger(available.recheck)?available.recheck:0,lifeOpen=available.life===true;
 const notes=[],total=pace.sessions;
 // 반 과제(교사 배정, 서버의 반 과제 기록)는 그 주의 연습으로 먼저 센다. 학습 기록(Trail)에는 없으니 제출을 여기서 더한다.
 const tasks=(Array.isArray(classwork)?classwork:[]).filter(row=>planRecord(row)&&['reading','writing'].includes(row.kind));
 if(tasks.length)notes.push('classwork');
 const classCount=kind=>tasks.filter(row=>row.kind===kind).length,classDone=kind=>tasks.filter(row=>row.kind===kind&&row.done).length;
 const did={listening:0,reading:0,writing:0,recheck:0,life:0,...(planRecord(done)?done:{})};
 for(const kind of ['reading','writing'])did[kind]=(did[kind]||0)+classDone(kind);
 // 다시 확인: 기록이 하나도 없으면 짧은 진단부터(시작점), 아니면 단계마다 정한 주기. 이번 주에 이미 했으면 그 한 번을 이번 주
 // 계획에 그대로 둔다(시작점 진단을 마치면 「기록 없음」이 풀려 계획이 「1/0」으로 바뀌고 한 것이 세어지지 않던 것을 막는다).
 // 시작점 진단 뒤 바로 다음 주에 또 확인하지 않게, 지난 확인과의 간격이 그 주 단계의 주기 이상일 때만 주기 주로 친다.
 const start=complete&&!observed.length;
 const cycle=at=>policy.recheckEvery[examPhase(exam.date,at).phase]||4,lastWeek=planTime(lastCheckAt)?examWeek(lastCheckAt).start:null;
 const spaced=(at,prev)=>prev===null||at-prev>=cycle(at)*7*DAY;
 const recheck=did.recheck>0||recheckFresh>0&&(start||recheckWeek(exam.date,week.start)&&spaced(week.start,lastWeek))?1:0;
 if(start)notes.push('start');
 const life=lifeOpen&&total>=(policy.lifeFrom[phase]??Infinity)?1:0;
 const open={};
 for(const domain of domains){
  open[domain]=has[domain]?needs[domain]:null;
  if(!has[domain])notes.push(domain==='listening'&&!audioAvailable?'audio-off':`${domain}-unavailable`);
 }
 // 말하기: 고른 학생만. 소리를 끈 날은 듣기처럼 닫고(까닭을 notes에), 열 수 있는 연습이 없어도 닫는다. 열리면 나누기 밖에서 한 번을 더한다.
 // 필요(이번 주에 아직 안 해 본 유형 수)는 「다음 연습」의 순서에만 쓴다(열 수 있는 유형 수를 넘지 않는다).
 const speakingChosen=exam.speaking===true&&['topik1','topik2'].includes(exam.type);
 const speakingList=speakingChosen&&Array.isArray(available.speaking)?available.speaking.filter(row=>planRecord(row)&&typeof row.id==='string'):[];
 const speakingOpen=speakingChosen&&audioAvailable&&speakingList.length>0;
 const speakingNeed=speakingOpen?Math.min(speakingList.length,Number.isInteger(speakingNeeds)&&speakingNeeds>0?speakingNeeds:0):null;
 if(speakingChosen&&!speakingOpen)notes.push(audioAvailable?'speaking-unavailable':'speaking-audio-off');
 // 시험이 가까우면 시험형 문항이 있는 읽기·쓰기를 조금 더(듣기는 지금 게임 연습이라 비중을 키우지 않는다).
 const boost=['near','final'].includes(phase)?{reading:1.25,writing:1.25}:{};
 const planned={...split(Math.max(0,total-recheck-life),open,boost),recheck,life,...(speakingOpen?{speaking:1}:{})};
 // 반 과제가 있는 갈래: 계획 횟수를 반 과제 수 이상으로 두고 반 과제로 먼저 채운다(반 과제를 빼거나 따로 하나 더 내지 않는다).
 for(const kind of ['reading','writing'])planned[kind]=Math.max(planned[kind]||0,classCount(kind));
 const areas=['recheck',...domains,...(speakingChosen?['speaking']:[]),'life'].map(area=>({area,planned:planned[area]||0,done:did[area]||0,
  remaining:Math.max(0,(planned[area]||0)-(did[area]||0)),classwork:tasks.filter(row=>row.kind===area).map(row=>({kind:row.kind,done:!!row.done,...(row.title?{title:String(row.title)}:{})}))}))
  .filter(row=>row.planned>0||row.done>0);
 // 숙제 묶음: 다시 볼 항목(보충·도움으로만·다시 확인·틀린 답이 있는 확인 중)마다 그 항목의 새 문항 연습. 없으면 모자람을 알린다.
 // 쓰기(TOPIK II)는 그 항목을 겨누는 쓰기 과제(available.writing의 skillIds)만 — 다른 과제를 그 항목 연습인 척 내지 않는다.
 // 같은 우선순위면 지금 낼 새 문항이 있는 항목을 먼저 둔다(모자란 항목은 뒤에서 모자람을 알린다).
 const writingFor=id=>(Array.isArray(available.writing)?available.writing:[]).filter(row=>Array.isArray(row?.skillIds)&&row.skillIds.includes(id)&&typeof row.routeId==='string').map(row=>row.routeId);
 const homework=skills.filter(weakOf).map(skill=>{
  // fresh: 그 항목의 짧은 연습 새 문항 수(읽기·듣기) · activities: 듣기 게임 후보 또는 그 항목을 겨누는 쓰기 과제.
  const fresh=skill.domain==='writing'?0:practice[skill.id]||0,games=skill.domain==='listening'?supply.listening[skill.id]||[]:skill.domain==='writing'?writingFor(skill.id):[];
  return {skillId:skill.id,domain:skill.domain,status:skill.status,priority:skill.priority??0,fresh,activities:[...games],
   shortage:skill.domain==='reading'?fresh===0:skill.domain==='writing'?games.length===0:fresh===0&&games.length===0||!audioAvailable,
   // 듣기 숙제가 막힌 까닭: 소리를 끈 날(audio)이면 문항이 남아 있어도 못 하는 것이라 「모자라요」가 아니다(화면이 까닭대로 쓴다).
   ...(skill.domain==='listening'&&!audioAvailable?{blocked:'audio'}:{})};
 }).sort((a,b)=>b.priority-a.priority||Number(a.shortage)-Number(b.shortage)||a.skillId.localeCompare(b.skillId)).slice(0,3).map(({priority,...row})=>row);
 // 다음 연습의 초점: 기록이 없으면 짧은 진단(시작점)부터, 아니면 남은 횟수가 가장 많은 영역(같으면 더 필요한 영역).
 // 그 영역의 첫 숙제 항목도 함께 넘긴다.
 const rank=row=>start&&row.area==='recheck'?1:0,needOf=area=>area==='speaking'?speakingNeed??0:needs[area]??0;
 const next=areas.filter(row=>row.remaining>0).sort((a,b)=>rank(b)-rank(a)||b.remaining-a.remaining||needOf(b.area)-needOf(a.area)||a.area.localeCompare(b.area))[0]||null;
 const focus=next?homework.find(row=>row.domain===next.area&&!row.shortage)||null:null;
 const goals=next?[`plan.area.${next.area}`,...(focus?[`plan.skill.${focus.skillId}`]:[])]:[];
 // 다시 확인 일정: 이번 주부터 다음 세 번. 시험이 지났으면 없고, 낼 새 문항이 없으면 이번 주에 이미 한 것만 남는다.
 // 확인끼리는 그 단계의 주기보다 가깝지 않다(이번 주에 했으면 이번 주부터, 아니면 지난 확인부터 잰다).
 const checks=[];
 if(phase!=='past'){
  let prev=recheck>0?week.start:lastWeek;
  for(let offset=0;checks.length<3&&offset<52;offset++){
   const at=week.start+offset*7*DAY;
   if(exam.date&&at>=parseExamDate(exam.date).end)break;
   if(offset===0){if(recheck>0)checks.push({weekStart:at,done:did.recheck>0});continue;}
   if(recheckFresh>0&&recheckWeek(exam.date,at)&&spaced(at,prev)){checks.push({weekStart:at,done:false});prev=at;}
  }
 }
 if(phase==='past')notes.push('past');
 if(!exam.date)notes.push('no-date');
 if(homework.some(row=>row.shortage))notes.push('shortage');
 const confirmed=skills.filter(skill=>skill.status==='recent-independent').length;
 const evidence=skills.reduce((n,skill)=>n+(skill.n||0),0);
 // 영역별 진행(10-21 ④): 「확인한 학습 항목 수」만 — 기록으로 칸이 정해진 항목 / 그 영역의 항목. 점수·합격 준비도가 아니다.
 // 쓰기는 자동 판정이 없어(평가할 수 없는 답만 남는다) 세지 않는다.
 const progress=Object.fromEntries(domains.filter(domain=>domain!=='writing').map(domain=>{const rows=skills.filter(skill=>skill.domain===domain);
  return [domain,{total:rows.length,checked:rows.filter(skill=>skill.status!=='unseen').length,basis:two(domain)?'topik2':'topik1'}];}));
 const sessions=Math.max(total,areas.reduce((n,row)=>n+row.planned,0));
 // 말하기가 열렸으면 그 한 줄(계획 판의 말하기 칸): 이번 주에 아직 안 해 본 유형 수 / 열 수 있는 유형 수. 점수·숙달이 아니다.
 const speaking=speakingOpen?{speaking:{untried:speakingNeed,total:speakingList.length}}:{};
 return {policy:policy.version,exam:{...exam},week,phase,weeksLeft:weeks,sessions:{total:sessions,minutes:pace.minutes},areas,homework,next:next?{area:next.area,skillId:focus?.skillId||null}:null,goals,checks,
  reach:{confirmed,observed:observed.length,total:skills.filter(skill=>skill.domain!=='writing').length,evidence,basis},progress,...speaking,notes:[...new Set(notes)],
  learningEffectClaim:false,abilityClaim:false,grade:null,passClaim:false};
}
// 후보에 붙일 계획 토큰: 영역(읽기 짧은 연습=읽기, 듣기 게임=듣기, 짧은 진단=다시 확인, 생활 레슨=생활, 말하기 연습=말하기)과 그 후보가 다루는 항목.
// 말하기 후보는 route가 'speaking'(추천 후보 — 유형은 routeId) 또는 'speaking:N'(말하기 모듈의 후보 그대로)이다.
export function planTokens(candidate){
 const area=candidate?.route==='practice'?'reading':candidate?.route==='position'?'recheck':candidate?.route==='writing'?'writing'
  :candidate?.route==='game'?candidate.modality==='reading'?'reading':'listening':['lesson','review'].includes(candidate?.route)?'life'
  :typeof candidate?.route==='string'&&candidate.route.split(':')[0]==='speaking'?'speaking':null;
 if(!area)return [];
 const skills=new Set((Array.isArray(candidate.targets)?candidate.targets:[]).flatMap(target=>Array.isArray(target?.skillIds)?target.skillIds:[]));
 return [`plan.area.${area}`,...[...skills].sort().map(id=>`plan.skill.${id}`)];
}
