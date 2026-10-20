// WORLD TOPIK 맞춤 재설계(2026-10-20 결정 「재설계 진행」 · 최종 제안 §2-1): 「약점이 보이고, 맞는 연습이 오고, 나아진 것이 보이게」.
// 완료 기준 다섯 시나리오(최종 제안 §2-1 표)와 시험 계획(10-20 결정 「시험·자격 준비 · 목표 급·시험일 · 시험 계획」)의 합성 학생을
// 실제 Core(atlas/learning.js)·Trail 코치·진단 문항·생활 진도로 돌린다. 화면·서버는 쓰지 않는다.
// 문항 검수 판정은 ② 세션의 허용 목록(experiences/topik-items/review/existing-verdicts.json)이 채우기 전이라, 여기서는 읽기 문항이
// 모두 통과했다고 둔 대역을 쓴다(목록이 비면 읽기 짧은 연습이 닫히는 것은 아래 「검수 목록」 시험이 본다).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createWorldLearningPlan,worldLearningSettings,REASON_BROAD_GOAL} from '../world-learning-plan.mjs';
import {DIAGNOSTIC_ITEMS} from '../world-diagnostic-items.mjs';
import * as position from '../world-position.mjs';
import * as practice from '../world-reading-practice.mjs';
import * as exam from '../world-exam-plan.mjs';
import {createPositionView} from '../world-position-ui.mjs';
import {createLifeProgress} from '../life-progress.mjs';
import {PACKS,LESSONS} from '../life-content.mjs';
import {t,hasString,formatDate} from '../../brand-opening/world-lang.mjs';
import verdicts from '../../topik-items/review/existing-verdicts.json' with {type:'json'};
const require=createRequire(import.meta.url);
const browser=require('../../../atlas/game-browser.js');
const Learning=require('../../../atlas/learning.js');
const Personalization=require('../../../atlas/personalization.js');

const DAY=86400000,START=Date.UTC(2026,9,19,0);
const memory=()=>{const values=new Map();return {values,get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
const VERDICTS={version:'topik-existing-verdicts-1',items:DIAGNOSTIC_ITEMS.filter(item=>item.modality==='reading').map(item=>({itemKey:item.itemKey,verdict:'pass',
 skillId:item.skillId,difficulty:item.difficulty,responseFormat:item.responseFormat??'unknown',familyKey:item.familyKey||item.itemKey}))};
const POOL=practice.practicePool({items:DIAGNOSTIC_ITEMS,verdicts:VERDICTS});
const EXAM={reasons:['exam'],primaryReason:'exam'};
const view=createPositionView({t,has:hasString,formatDate});

// 합성 학생 한 명: 같은 기기 기록장(storage)을 홈 코치(짧은 진단 'world-home')와 읽기 짧은 연습 코치('world-practice')가 함께 쓴다.
function student({storage=memory(),start=START,owner='synthetic'}={}){
 let clock=start,n=0;
 const at=()=>new Date(clock).toISOString();
 const coach=browser.engine.createGame({gameId:'world-home',storage,clock:at});
 const drill=browser.engine.createGame({gameId:'world-practice',storage,clock:at});
 const life=createLifeProgress({storage,owner,now:()=>clock,uuid:()=>`${owner}-${++n}`});life.summary(PACKS,LESSONS);
 return {storage,coach,drill,life,now:()=>clock,advance(ms){clock+=ms;},tick(){clock+=1000;}};
}
// 짧은 진단 한 바퀴: wrong(item)이 참인 문항은 틀리게 답한다. 듣기는 끝까지 들은 뒤에.
function diagnose(s,{wrong=()=>false,audio=true}={}){
 const plan=position.selectDiagnostic({summary:s.coach.summary(),items:DIAGNOSTIC_ITEMS,seen:item=>s.coach.exposure(item).seen,audioAvailable:audio});
 const session=position.createDiagnosticSession({coach:s.coach,items:plan.items});
 for(let current=session.next();current;current=session.next()){
  s.tick();if(current.audio==='pending')session.delivery('completed');
  const item=current.item;session.answer(wrong(item)?item.choices.find(choice=>choice.id!==item.correctId).id:item.correctId);
 }
 return session.results();
}
// 홈의 추천 한 번(world-learning-ui.mjs planWith와 같은 순서): 읽기 짧은 연습 후보 + (시험이면) 계획 → Core.
function recommend(s,{settings=EXAM,examPlan=null,extra=null}={}){
 const summary=s.coach.summary(),seen=item=>s.coach.exposure(item).seen;
 return createWorldLearningPlan({summary,progress:s.life.exportSnapshot(),settings,now:s.now(),examPlan,
  extra:extra??practice.practiceCandidates({pool:POOL,seen,summary}),
  recommendActivities:input=>s.coach.recommendActivities(input.candidates,{settings:input.settings,at:input.at})});
}
// 추천된 활동이 실제로 처음 내는 문항: 읽기 짧은 연습이면 그 항목의 새 문항, 게임이면 그 후보에서 Core가 고른 문항.
function firstItem(s,selected){
 if(selected.route==='practice'){const pick=practice.selectPractice({summary:s.drill.summary(),pool:POOL,seen:item=>s.drill.exposure(item).seen,skillId:selected.skillId});return pick.items[0];}
 if(selected.route==='game'){const ranked=Learning.recommend({profile:s.coach.summary(),candidates:selected.targets});return ranked.selected;}
 return null;
}

// ── 완료 기준 ① 같은 조건의 두 학생: 듣기 강·읽기 약 / 읽기 강·듣기 약 ──
test('완료 ①: 듣기 강·읽기 약과 읽기 강·듣기 약은 첫 실제 출제 영역·항목이 다르고, 이유가 그 근거 항목을 가리킨다',()=>{
 const readingWeak=student(),listeningWeak=student();
 diagnose(readingWeak,{wrong:item=>item.modality==='reading'});diagnose(listeningWeak,{wrong:item=>item.modality==='listening'});
 const a=recommend(readingWeak),b=recommend(listeningWeak);
 assert.equal(a.selected.route,'practice','읽기가 약한 학생은 읽기 짧은 연습');assert.equal(a.selected.modality,'reading');
 assert.equal(b.selected.route,'game','듣기가 약한 학생은 듣기 게임');assert.equal(b.selected.modality,'listening');
 const itemA=firstItem(readingWeak,a.selected),itemB=firstItem(listeningWeak,b.selected);
 assert.equal(itemA.modality,'reading');assert.equal(itemA.skillId,a.focusSkillId,'첫 문항이 이유가 가리킨 그 항목이다');
 assert.ok(/^ko\.listening\./.test(itemB.skillIds[0]));
 // 이유 한 줄은 그 학생이 틀린 항목의 이름을 말한다(Vellum 문장).
 const label=id=>readingWeak.coach.summary().skills.find(skill=>skill.id===id).label;
 assert.match(a.reason,new RegExp(label(a.focusSkillId)));assert.equal(readingWeak.coach.summary().skills.find(skill=>skill.id===a.focusSkillId).incorrect,1);
 assert.match(b.reason,new RegExp(listeningWeak.coach.summary().skills.find(skill=>skill.id===b.focusSkillId).label));
 assert.notEqual(a.focusSkillId.split('.')[1],b.focusSkillId.split('.')[1]);
});

// ── 완료 기준 ② 첫 진단의 정답 하나 / 오답 하나 ──
test('완료 ②: 첫 진단의 정답 하나와 오답 하나는 부제와 다음 행동이 다르고, 둘 다 「확인 중」(표본 부족)이다',()=>{
 const s=student(),skill='ko.reading.reason';
 const [right,wrong]=DIAGNOSTIC_ITEMS.filter(item=>item.skillId===skill).slice(0,2);
 for(const [item,correct]of [[right,true],[wrong,false]]){s.tick();const pid=s.coach.present(item);s.coach.answer(pid,{correct,assessable:true});}
 // 한 사람이 두 문항을 풀면 같은 칸이라 섞인다 — 두 사람으로 나눠 본다.
 const one=student(),two=student();
 for(const [who,correct]of [[one,true],[two,false]]){who.tick();const pid=who.coach.present(right);who.coach.answer(pid,{correct,assessable:true});}
 const mapOne=position.buildPositionMap({summary:one.coach.summary(),events:one.coach.events()}),mapTwo=position.buildPositionMap({summary:two.coach.summary(),events:two.coach.events()});
 const rowOne=mapOne.skills.find(row=>row.id===skill),rowTwo=mapTwo.skills.find(row=>row.id===skill);
 assert.equal(rowOne.cell,'practicing');assert.equal(rowTwo.cell,'practicing','칸은 둘 다 「연습 중」(Core 상태 checking 그대로)');
 assert.equal(rowOne.status,'checking');assert.equal(rowTwo.status,'checking');
 assert.equal(view.noteText(rowOne.note),'한 번 맞음 · 확인 중');assert.equal(view.noteText(rowTwo.note),'한 번 틀림 · 확인 중');
 assert.deepEqual(mapOne.attention,[],'맞힌 사람에게는 「먼저 볼 항목」이 없다');assert.deepEqual(mapTwo.attention,[skill],'틀린 사람에게는 그 항목이 먼저 볼 항목');
 assert.ok(rowTwo.priority>rowOne.priority,'Core 우선순위도 다르다(.85 > .55)');
 const boardTwo=view.renderPositionBoard({map:mapTwo,practice:id=>id===skill});
 assert.match(boardTwo,/LOOK FIRST[\s\S]*읽고 이유 이해하기[\s\S]*data-position-practice="ko.reading.reason"/);
 assert.doesNotMatch(view.renderPositionBoard({map:mapOne,practice:()=>false}),/data-position-practice/);
});

// ── 완료 기준 ③ 도움·반복 재생·소리 실패 ──
test('완료 ③: 도움·다시 듣기·소리 실패는 「혼자 해냄」으로 오르지 않고, 시도한 사실과 이유는 펼쳐 보인다',()=>{
 const s=student(),listen=DIAGNOSTIC_ITEMS.filter(item=>item.skillId==='ko.listening.detail'&&item.audioRequired!==false);
 // 다 들은 뒤 다시 듣기(도움) → 오답 · 소리가 나지 않음 → 평가할 수 없음.
 const replayed=position.createDiagnosticSession({coach:s.coach,items:[listen[0]]});replayed.next();replayed.delivery('completed');replayed.replay();
 s.tick();const helpedRow=replayed.answer(listen[0].choices.find(choice=>choice.id!==listen[0].correctId).id);
 assert.equal(helpedRow.independent,false);assert.equal(helpedRow.assisted,true);
 const silent=position.createDiagnosticSession({coach:s.coach,items:[listen[1]]});silent.next();silent.delivery('failed');s.tick();silent.skip();
 const map=position.buildPositionMap({summary:s.coach.summary(),events:s.coach.events()}),row=map.skills.find(skill=>skill.id==='ko.listening.detail');
 assert.equal(row.cell,'notyet','도움 받은 오답과 소리 실패는 칸을 만들지 않는다');assert.equal(row.n,0);
 assert.equal(row.helped.length,1,'도움과 함께 낸 첫 답은 따로 남는다(N1)');assert.equal(row.helped[0].verdict,'incorrect');
 assert.equal(row.note.kind,'helped');assert.match(view.noteText(row.note),/^도움과 함께 시도 · /);
 assert.ok(row.unassessed>=1,'소리가 나지 않은 답은 세지 않은 답으로 남는다');
 const board=view.renderPositionBoard({map});
 assert.match(board,/도움과 함께 한 시도[\s\S]*틀림 · 도움 받음/);assert.match(board,/소리가 안 났거나 건너뛴 답 \d+개는 세지 않았어요/);
 assert.equal(row.helped[0].experienceId,'world-home');assert.match(board,/data-helped>[\s\S]*짧은 진단/,'도움과 함께 낸 진단 답의 출처는 짧은 진단(10-21 검수)');
 // 읽기 짧은 연습: 답한 뒤 정답·해설을 보는 것은 첫 답 뒤라 그 답은 혼자 낸 첫 시도 그대로다.
 const item=POOL.find(row=>row.skillId==='ko.reading.detail'),run=practice.createPracticeSession({coach:s.drill,items:[item]});run.next();s.tick();
 const answered=run.answer(item.correctId);assert.equal(answered.independent,true);assert.equal(answered.verdict,'correct');
 assert.ok(s.drill.events().some(event=>event.type==='practice.helped'&&event.level==='answer'),'정답을 보인 사실은 도움(정답)으로 남는다');
});

// ── 완료 기준 ④ 그 항목의 새 문항 소진 ──
test('완료 ④: 그 항목의 새 문항이 다 떨어지면 다른 항목 문항을 그 약점 연습인 척 내지 않고, 모자람을 알리며 대안을 낸다',()=>{
 const s=student(),skill='ko.reading.main',mine=POOL.filter(item=>item.skillId===skill);
 assert.ok(mine.length>0);
 for(const item of mine){s.tick();const pid=s.drill.present(item);s.drill.answer(pid,{correct:false,assessable:true});}
 const pick=practice.selectPractice({summary:s.drill.summary(),pool:POOL,seen:item=>s.drill.exposure(item).seen,skillId:skill});
 assert.equal(pick.status,'none');assert.equal(pick.reason,'all-seen');assert.deepEqual(pick.items,[]);
 const candidates=practice.practiceCandidates({pool:POOL,seen:item=>s.drill.exposure(item).seen,summary:s.drill.summary()});
 assert.ok(!candidates.some(candidate=>candidate.skillId===skill),'새 문항이 없는 항목의 연습 후보는 Core에 넘기지 않는다');
 assert.ok(candidates.length>0,'다른 항목의 연습은 그 항목 이름으로 남아 있다(대안)');
 for(const candidate of candidates)assert.ok(candidate.targets.every(target=>target.skillIds[0]===candidate.skillId),'후보마다 자기 항목의 문항만');
 const plan=exam.buildExamPlan({exam:exam.examInfo({...EXAM,examType:'topik1'}),summary:s.drill.summary(),now:s.now(),
  available:{reading:practice.practiceSupply({pool:POOL,seen:item=>s.drill.exposure(item).seen}),listening:{},recheck:15,life:true}});
 const row=plan.homework.find(entry=>entry.skillId===skill);
 assert.ok(row,'보충할 항목은 숙제 묶음에 남는다');assert.equal(row.shortage,true,'새 문항이 모자라다고 알린다');
 assert.ok(plan.notes.includes('shortage'));
 assert.match(view.renderExamPlan({plan}),/새 문항이 모자라요 · 다른 항목이나 다시 확인으로 이어 가요/);
});

// ── 완료 기준 ⑤ 새로고침·재시작·계정 전환 ──
test('완료 ⑤: 학습 뒤 새로고침·재시작은 같은 기록과 다음 추천으로 돌아오고, 다른 기록장(다른 학생)에는 섞이지 않는다',()=>{
 const s=student();diagnose(s,{wrong:item=>item.modality==='reading'});
 const before=recommend(s);
 // 새로고침: 같은 기록장으로 코치를 새로 연다.
 const again=student({storage:s.storage,start:s.now()});
 const after=recommend(again);
 assert.equal(after.selected.id,before.selected.id);assert.equal(after.focusSkillId,before.focusSkillId);
 assert.deepEqual(again.coach.summary().skills.map(skill=>[skill.id,skill.status,skill.n]),s.coach.summary().skills.map(skill=>[skill.id,skill.status,skill.n]));
 // 다른 학생(다른 기록장)은 이 학생의 기록을 보지 않는다.
 const other=student({owner:'another'});
 assert.equal(other.coach.summary().independent,0);assert.notEqual(recommend(other).focusSkillId,before.focusSkillId);
});

// ── 이중 가산 · 이유문 · 검수 목록 ──
test('「시험·자격 준비」의 두 표현(exam·prepare)은 목표를 한 번만 맞추고, 넓은 목표 표는 Core와 같다',()=>{
 assert.deepEqual({...REASON_BROAD_GOAL},{...Personalization.REASON_GOAL});
 assert.deepEqual(worldLearningSettings({...EXAM,goal:'prepare'}).goals,['exam'],'이유로 정해진 넓은 목표는 다시 더하지 않는다');
 assert.deepEqual(worldLearningSettings({reasons:['travel'],primaryReason:'travel',goal:'prepare'}).goals,['travel','prepare'],'다른 뜻의 넓은 목표는 그대로');
 const s=student(),plan=recommend(s,{settings:{...EXAM,goal:'prepare'}});
 for(const row of plan.assessments||[])assert.ok(row.matchedGoals.length<=1||row.matchedGoals.every(goal=>goal!=='prepare'),`${row.id}: ${row.matchedGoals}`);
});
test('기록이 쌓인 사람에게 「아직 연습 기록이 적어요」라고 하지 않는다(이유문 #17) · 이유는 화면 언어 표에 있다',async()=>{
 const s=student();diagnose(s);
 // 진단을 모두 맞혀 급한 연습이 없고, 생활 레슨이 이어 할 다음이다.
 const lesson=LESSONS.find(row=>row.id==='greetings-expressions');s.life.startLesson(lesson);
 for(const q of lesson.questions){s.tick();s.life.recordAnswer({lessonId:lesson.id,questionId:q.id,correct:true,choiceId:q.answerId});}
 s.life.finishLesson(lesson.id);
 const plan=recommend(s,{settings:{},extra:[]});
 assert.notEqual(plan.reason,'아직 연습 기록이 적어요. 짧게 해 보며 맞춰 갈게요.');
 const {default:STRINGS}=await import('../../brand-opening/world-strings.mjs');
 const table=new Set(Object.entries(STRINGS).filter(([key])=>key.startsWith('msg.')).map(([,entry])=>entry.ko));
 for(const reason of ['시험 목표에 맞춰 짧은 진단으로 시작점을 먼저 확인해요.','이번 주 계획의 다시 확인이에요. 처음 보는 문항으로 지금 위치를 확인해요.','생활 팩의 다음 레슨이에요. 진도 순서대로 이어서 배워요.'])assert.ok(table.has(reason),reason);
 if(plan.selected.route==='lesson'&&!(plan.selected.targets||[]).length)assert.equal(plan.reason,'생활 팩의 다음 레슨이에요. 진도 순서대로 이어서 배워요.');
});
test('검수 목록: 통과(pass)이고 검수가 확인한 메타가 같은 문항만 연습에 낸다 — 목록이 비면 읽기 짧은 연습은 닫힌다',()=>{
 assert.equal(verdicts.version,'topik-existing-verdicts-1');
 const real=practice.practicePool({items:DIAGNOSTIC_ITEMS,verdicts});
 assert.ok(real.length<=verdicts.items.filter(row=>row.verdict==='pass').length,'실제 목록에서 통과한 문항보다 많이 내지 않는다');
 assert.deepEqual(practice.practicePool({items:DIAGNOSTIC_ITEMS,verdicts:{version:'topik-existing-verdicts-1',items:[]}}),[]);
 assert.deepEqual(practice.practicePool({items:DIAGNOSTIC_ITEMS,verdicts:null}),[],'판정 목록을 읽지 못하면 하나도 내지 않는다');
 const one=DIAGNOSTIC_ITEMS.find(item=>item.modality==='reading'),base={itemKey:one.itemKey,verdict:'pass',skillId:one.skillId,difficulty:one.difficulty,responseFormat:one.responseFormat,familyKey:one.familyKey};
 const pool=rows=>practice.practicePool({items:DIAGNOSTIC_ITEMS,verdicts:{version:'topik-existing-verdicts-1',items:rows}}).map(item=>item.itemKey);
 assert.deepEqual(pool([base]),[one.itemKey]);
 assert.deepEqual(pool([{...base,verdict:'fix'}]),[],'고칠 문항은 내지 않는다');
 assert.deepEqual(pool([{...base,skillId:'ko.reading.main'}]),[],'검수가 본 항목과 문항 메타가 다르면 내지 않는다');
 assert.deepEqual(pool([base,{...base,verdict:'drop'}]),[],'같은 문항의 판정이 둘이면 내지 않는다');
 assert.deepEqual(pool([{...base,itemKey:DIAGNOSTIC_ITEMS.find(item=>item.modality==='listening').itemKey}]),[],'듣기 문항은 읽기 연습에 넣지 않는다');
});

// ── 시험 계획: 합성 학생(시험 4주 전·12주 전 × 듣기 약·읽기 약 × 주 30분·2시간) ──
// 같은 코치 기록 위에서 시험 정보만 바꿔 계획과 숙제가 실제로 달라지는지 본다.
const KST_MONDAY=Date.UTC(2026,9,19,0)-9*3600000; // 2026-10-19(월) 0시 한국 시각
function examStudent(weak){const s=student({start:KST_MONDAY+DAY});diagnose(s,{wrong:item=>item.modality===weak});diagnose(s,{wrong:item=>item.modality===weak});return s;}
function planFor(s,{weeks,weekly}){
 const date=new Date(KST_MONDAY+weeks*7*DAY+9*3600000).toISOString().slice(0,10);
 const info=exam.examInfo({...EXAM,examType:'topik1',targetGrade:2,examDate:date,examMode:'pbt',weeklyMinutes:weekly});
 const summary=s.coach.summary(),seen=item=>s.coach.exposure(item).seen;
 const listening={'ko.listening.detail':['world.play.runner'],'ko.listening.negation':['world.play.runner'],'ko.listening.sequence':['world.play.runner'],'ko.listening.reason':['world.play.rhythm'],'ko.listening.condition':['world.play.rhythm'],'ko.listening.main':['world.play.rhythm']};
 return exam.buildExamPlan({exam:info,summary,now:s.now(),done:exam.weekActivity({events:s.coach.events(),progress:s.life.exportSnapshot(),week:exam.examWeek(s.now())}),
  available:{reading:practice.practiceSupply({pool:POOL,seen}),listening,recheck:15,life:true}});
}
const planned=(plan,area)=>plan.areas.find(row=>row.area===area)?.planned||0;
test('시험 계획: 4주 전·12주 전 × 듣기 약·읽기 약 × 주 30분·2시간 — 횟수·영역 배분·숙제·다시 확인이 달라진다',()=>{
 const listeningWeak=examStudent('listening'),readingWeak=examStudent('reading'),rows=[];
 for(const [who,s]of [['듣기 약',listeningWeak],['읽기 약',readingWeak]])for(const weeks of [4,12])for(const weekly of [30,120]){
  const plan=planFor(s,{weeks,weekly});rows.push({who,weeks,weekly,plan});
  assert.equal(plan.grade,null);assert.equal(plan.passClaim,false);assert.equal(plan.abilityClaim,false);
 }
 const find=(who,weeks,weekly)=>rows.find(row=>row.who===who&&row.weeks===weeks&&row.weekly===weekly).plan;
 // 주당 시간: 30분이면 2번, 2시간이면 5번.
 assert.equal(find('듣기 약',4,30).sessions.total,2);assert.equal(find('듣기 약',4,120).sessions.total,5);
 // 약한 영역에 더 배분한다.
 assert.ok(planned(find('듣기 약',12,120),'listening')>planned(find('듣기 약',12,120),'reading'),'듣기가 약하면 듣기를 더');
 assert.ok(planned(find('읽기 약',12,120),'reading')>planned(find('읽기 약',12,120),'listening'),'읽기가 약하면 읽기를 더');
 // 숙제 묶음은 그 학생의 약한 영역 항목이다.
 assert.ok(find('듣기 약',12,120).homework.every(row=>row.domain==='listening'));assert.ok(find('읽기 약',12,120).homework.every(row=>row.domain==='reading'));
 // 시험이 가까우면(4주 전 = near) 매주 다시 확인하고 생활 레슨을 빼며, 12주 전(mid)은 두 주에 한 번이다.
 const near=find('읽기 약',4,120),mid=find('읽기 약',12,120);
 assert.equal(near.phase,'near');assert.equal(mid.phase,'mid');
 assert.equal(planned(near,'recheck'),1);assert.equal(planned(near,'life'),0,'시험이 가까우면 생활 레슨 대신 시험형 문항');
 assert.equal(near.checks.length,3);assert.ok(near.checks.every((row,index)=>index===0||row.weekStart-near.checks[index-1].weekStart===7*DAY),'매주');
 assert.ok(mid.checks.every((row,index)=>index===0||row.weekStart-mid.checks[index-1].weekStart===14*DAY),'두 주에 한 번');
 // 도달 파악은 혼자 해낸 항목 수와 근거 수만(급수 환산 없음).
 assert.deepEqual(Object.keys(near.reach).sort(),['basis','confirmed','evidence','observed','total']);assert.equal(near.reach.basis,'topik1','어느 항목 지도로 셌는지만(급수 칸이 아니다)');
 // 계획 토큰: 다음 연습의 초점 영역(Core가 같은 급한 정도 안에서만 쓴다).
 assert.equal(find('읽기 약',12,120).goals[0],'plan.area.reading');assert.equal(find('듣기 약',12,120).goals[0],'plan.area.listening');
});
test('시험 계획: 쉬거나 빠진 주는 빚으로 쌓지 않고, 날짜·남은 날 세기·죄책감 말이 없다',()=>{
 const s=examStudent('reading'),week1=planFor(s,{weeks:8,weekly:60});
 s.advance(7*DAY);const week2=planFor(s,{weeks:7,weekly:60}); // 한 주 동안 아무것도 안 했다
 assert.equal(week2.sessions.total,week1.sessions.total,'지난주에 못 한 것이 이번 주로 넘어오지 않는다');
 assert.ok(week2.areas.every(row=>row.done===0));
 const html=view.renderExamPlan({plan:week2});
 assert.doesNotMatch(html,/D-\d|남은 날|며칠 남|밀린|놓쳤|못 했어요|연속/,'D-n·밀린 연습·연속 기록 말이 없다');
 assert.match(html,/쉬는 날이 있어도 괜찮아요/);assert.doesNotMatch(html,/[1-6]급(?! 목표)|합격(?! 가능성은 판단하지 않아요)/,'목표 급 말고 급수·합격 판정이 없다(판단하지 않는다는 안내만)');
});
test('시험 계획: 기록이 없으면 짧은 진단부터, 시험일이 지나면 다음 목표를 묻고, 반 과제는 그 주의 연습으로 먼저 센다',()=>{
 const fresh=student({start:KST_MONDAY+DAY}),info=exam.examInfo({...EXAM,examType:'topik2',targetGrade:4,examDate:'2026-12'});
 const start=exam.buildExamPlan({exam:info,summary:fresh.coach.summary(),now:fresh.now(),available:{reading:{'ko.reading.detail':3},listening:{},recheck:15,life:true}});
 assert.ok(start.notes.includes('start'));assert.equal(start.next.area,'recheck','처음은 짧은 진단(시작점)');
 // 홈 추천: 시험을 고른 처음 학생은 계획 토큰으로 짧은 진단이 먼저(같은 급한 정도 안에서만).
 const check={id:'world.position.check',label:'짧은 진단',route:'position',minutes:5,targets:[],goals:['exam','prepare'],audioRequired:false,modality:'reading'};
 const home=recommend(fresh,{settings:{...EXAM,examType:'topik2'},examPlan:start,extra:[check,...practice.practiceCandidates({pool:POOL,seen:item=>fresh.coach.exposure(item).seen,summary:fresh.coach.summary()})]});
 assert.equal(home.selected.id,'world.position.check');assert.equal(home.reason,'시험 목표에 맞춰 짧은 진단으로 시작점을 먼저 확인해요.');
 // 지금 할 것이 짧은 진단이면 다시 확인 칸에 같은 시작 단추를 또 두지 않는다(다른 것을 할 때만 따로 보인다).
 const board=view.renderExamPlan({plan:start,next:home.selected,reason:home.reason});
 assert.match(board,/data-plan-next/);assert.doesNotMatch(board,/data-plan-recheck/);
 assert.match(view.renderExamPlan({plan:start,next:{route:'practice',skillId:'ko.reading.detail'}}),/data-plan-recheck/);
 const past=exam.buildExamPlan({exam:{...info,date:'2026-09'},summary:fresh.coach.summary(),now:fresh.now(),available:{recheck:15,life:true}});
 assert.equal(past.phase,'past');assert.ok(past.notes.includes('past'));assert.deepEqual(past.checks,[]);
 assert.match(view.renderExamPlan({plan:past}),/시험은 어땠어요\? 다음 목표를 정해 볼까요\?/);
 // 온라인 반 「이번 주 과제」 두 갈래: 계획이 그 주의 읽기·쓰기 횟수로 먼저 센다(따로 하나 더 내지 않는다).
 const s=examStudent('reading');
 const classwork=[{kind:'reading',done:true},{kind:'writing',done:false}];
 const withClass=exam.buildExamPlan({exam:info,summary:s.coach.summary(),now:s.now(),classwork,
  available:{reading:practice.practiceSupply({pool:POOL,seen:item=>s.coach.exposure(item).seen}),listening:{},recheck:15,life:true,writing:[{id:'topik2-writing-51',route:'writing:51',minutes:8}]}});
 const reading=withClass.areas.find(row=>row.area==='reading'),writing=withClass.areas.find(row=>row.area==='writing');
 assert.ok(reading.planned>=1&&reading.done>=1,'낸 반 읽기 과제는 이번 주 읽기 한 번으로 센다');
 assert.ok(writing.planned>=1&&writing.classwork.length===1&&writing.classwork[0].done===false);
 assert.ok(withClass.notes.includes('classwork'));
 assert.match(view.renderExamPlan({plan:withClass}),/반 과제 · 읽기 냄[\s\S]*반 과제 · 쓰기/);
});
// 쓰기 연습은 아직 Trail에 남지 않아(③ 세션 메모) 기기 기록의 규칙 점검 시각으로 이번 주 쓰기 횟수를 센다.
test('시험 계획: 쓰기 연습의 규칙 점검 시각을 같은 간격 규칙으로 이번 주 쓰기 횟수로 세고, 지난주 것은 세지 않는다',()=>{
 const week=exam.examWeek(KST_MONDAY+2*DAY),at=minutes=>new Date(week.start+DAY+minutes*60000).toISOString();
 const times=[at(0),at(5),at(12),at(180),new Date(week.start-DAY).toISOString()];
 assert.equal(exam.weekActivity({events:[],week,extra:[{area:'writing',times}]}).writing,2,'한 자리의 점검 세 번은 한 번, 세 시간 뒤는 또 한 번, 지난주는 빼고');
 assert.equal(exam.weekActivity({events:[],week,extra:[{area:'life',times}]}).life,0,'생활은 시각으로 세지 않는다(답한 날로만)');
 const info=exam.examInfo({...EXAM,examType:'topik2',targetGrade:4,examDate:'2027-04',weeklyMinutes:120});
 const plan=exam.buildExamPlan({exam:info,summary:student({start:KST_MONDAY+DAY}).coach.summary(),now:KST_MONDAY+2*DAY,done:exam.weekActivity({events:[],week,extra:[{area:'writing',times}]}),
  available:{reading:{'ko.reading.detail':3},listening:{'ko.listening.detail':['world.play.runner']},recheck:15,life:true,writing:[{id:'topik2-writing-51',route:'writing:51',minutes:8}]}});
 assert.equal(plan.areas.find(row=>row.area==='writing').done,2);
});
// 10-21 화면 확인: 시작점 진단을 마치면 「기록 없음」이 풀려 이번 주(주기상 확인 주가 아님) 다시 확인이 「1/0」으로 바뀌고 홈 숫자가 0에 머물렀다.
test('시험 계획: 시작점 짧은 진단을 마친 그 주에도 다시 확인 한 번이 계획에 남고 「한 것」으로 세어진다',()=>{
 const s=student({start:KST_MONDAY+DAY}),before=planFor(s,{weeks:11,weekly:120});
 assert.ok(before.notes.includes('start'));assert.equal(planned(before,'recheck'),1);
 assert.equal(exam.recheckWeek(before.exam.date,before.week.start),false,'이번 주는 주기로는 확인 주가 아니다');
 diagnose(s,{wrong:item=>item.modality==='reading'});
 const after=planFor(s,{weeks:11,weekly:120}),row=after.areas.find(area=>area.area==='recheck');
 assert.ok(!after.notes.includes('start'));
 assert.deepEqual([row.planned,row.done],[1,1],'「1/0」이 아니라 「1/1」');
 assert.equal(after.areas.reduce((n,area)=>n+area.planned,0),after.sessions.total,'영역 횟수의 합이 이번 주 횟수와 같다');
 assert.ok(after.checks[0].weekStart===after.week.start&&after.checks[0].done,'이번 주 확인은 한 것으로');
 assert.ok(after.checks.slice(1).every(check=>exam.recheckWeek(after.exam.date,check.weekStart)),'다음 확인은 주기대로');
 assert.doesNotMatch(view.renderExamPlan({plan:after}),/data-plan-recheck/,'한 확인을 또 하라는 단추가 없다');
 // 10-21 검수: 확인끼리는 그 단계의 주기(12주 안 = 두 주)보다 가깝지 않다 — 시작점 진단 바로 다음 주에 또 확인하지 않는다.
 assert.ok(after.checks.every((check,index)=>index===0||check.weekStart-after.checks[index-1].weekStart>=14*DAY),'두 주 이상 간격');
 const last=exam.lastRecheck({events:s.coach.events(),before:Infinity});assert.ok(Number.isFinite(last));
 s.advance(7*DAY);
 const nextWeek=planFor(s,{weeks:10,weekly:120}),date=new Date(KST_MONDAY+11*7*DAY+9*3600000).toISOString().slice(0,10);
 const withLast=exam.buildExamPlan({exam:nextWeek.exam,summary:s.coach.summary(),now:s.now(),lastCheckAt:exam.lastRecheck({events:s.coach.events(),before:exam.examWeek(s.now()).start}),
  available:{reading:practice.practiceSupply({pool:POOL,seen:item=>s.coach.exposure(item).seen}),listening:{'ko.listening.detail':['world.play.runner']},recheck:15,life:true}});
 assert.equal(exam.recheckWeek(date,withLast.week.start),true,'다음 주는 주기로는 확인 주다');
 assert.equal(planned(withLast,'recheck'),0,'그래도 지난주에 확인했으면 이번 주에는 다시 확인을 넣지 않는다');
});
test('시험 정보: 달만 아는 시험일·없는 날·종류에 맞지 않는 급은 거르고, 시험을 고르지 않았으면 계획이 없다',()=>{
 assert.equal(exam.examInfo({reasons:['travel']}),null);
 assert.deepEqual(exam.examInfo({...EXAM,examType:'topik1',targetGrade:4,examDate:'2027-02-30',examMode:'cbt',weeklyMinutes:45}),{type:'topik1',grade:null,date:null,mode:null,weeklyMinutes:null});
 assert.deepEqual(exam.examInfo({...EXAM,examType:'topik2',targetGrade:4,examDate:'2027-01',examMode:'ibt',weeklyMinutes:60}),{type:'topik2',grade:4,date:'2027-01',mode:'ibt',weeklyMinutes:60});
 assert.equal(exam.examPhase('2026-10',Date.UTC(2026,9,20)).phase,'final','이번 달 시험');
 assert.equal(exam.examPhase(null,0).phase,'none');
});

// ── 위치판이 이력을 지키게(10-20 검수 N2·C): 난도별 「혼자 해냄」, 7일 지난 「다시 확인할 때 · 날짜 혼자 해냄」 ──
const answerAs=(s,{skill='ko.reading.detail',difficulty=1,key,correct=true})=>{s.tick();const id=`qa.${key}`;const pid=s.coach.present({id,itemKey:id,familyKey:id,skillId:skill,modality:skill.split('.')[1],difficulty,responseFormat:'single-choice'});s.coach.answer(pid,{correct,assessable:true});};
test('위치판: 높은 난도의 첫 정답 뒤에도 앞 난도의 「혼자 해냄」을 함께 보이고(N2), 7일이 지나면 그날 혼자 해낸 것을 남긴다(C)',()=>{
 assert.equal(position.POSITION_CORE_POLICY.sample,Learning.POLICY.sample);assert.equal(position.POSITION_CORE_POLICY.stableRatio,Learning.POLICY.stableRatio);
 const s=student();
 for(const n of [1,2,3,4])answerAs(s,{key:`d1-${n}`});
 let row=position.buildPositionMap({summary:s.coach.summary(),events:s.coach.events(),policy:Learning.POLICY}).skills.find(skill=>skill.id==='ko.reading.detail');
 assert.equal(row.status,'recent-independent');assert.match(view.noteText(row.note),/^혼자 해냄 · /);
 answerAs(s,{key:'d2-1',difficulty:2});
 row=position.buildPositionMap({summary:s.coach.summary(),events:s.coach.events(),policy:Learning.POLICY}).skills.find(skill=>skill.id==='ko.reading.detail');
 assert.equal(row.status,'checking','Core의 대표 초점은 난도 2의 확인 중 그대로(판정을 바꾸지 않는다)');
 assert.equal(row.cell,'practicing');
 assert.deepEqual(row.note.levels,[{difficulty:1,status:'recent-independent'},{difficulty:2,status:'checking'}]);
 assert.equal(view.noteText(row.note),'한 번 맞음 · 확인 중 · 난도 1 혼자 해냄 · 난도 2 확인 중');
 // 8일 쉬면 Core는 「다시 확인할 때」(review)로 본다. 판은 그 앞의 혼자 해낸 날을 함께 적는다.
 const t=student();for(const n of [1,2,3,4])answerAs(t,{key:`r-${n}`});
 t.advance(8*DAY);
 const stale=position.buildPositionMap({summary:t.coach.summary(),events:t.coach.events(),policy:Learning.POLICY}).skills.find(skill=>skill.id==='ko.reading.detail');
 assert.equal(stale.status,'review');assert.equal(stale.note.kind,'review');assert.equal(stale.note.done,true);
 assert.match(view.noteText(stale.note),/^다시 확인할 때 · .+ 혼자 해냄$/);
 const missed=student();for(const [n,correct]of [[1,false],[2,false],[3,true]])answerAs(missed,{key:`m-${n}`,correct});missed.advance(8*DAY);
 const old=position.buildPositionMap({summary:missed.coach.summary(),events:missed.coach.events(),policy:Learning.POLICY}).skills.find(skill=>skill.id==='ko.reading.detail');
 assert.equal(old.note.done,false);assert.match(view.noteText(old.note),/^다시 확인할 때 · 마지막 기록 /,'혼자 해낸 적이 없으면 마지막 기록 날짜만');
});

// 계획이 숙제 항목을 앞세울 때 이유 한 줄도 그 숙제 항목(= 실제로 먼저 낼 문항의 항목)을 말한다.
test('시험 계획과 함께: 홈 추천의 이유가 이번 주 숙제 항목을 말하고, 그 항목이 실제로 처음 나오는 문항의 항목이다',()=>{
 for(const weak of ['reading','listening']){
  const s=examStudent(weak),plan=planFor(s,{weeks:8,weekly:120});
  const pick=recommend(s,{examPlan:plan});
  assert.ok(pick.reasons.includes('plan.homework'),`${weak}: ${pick.reason}`);
  const first=firstItem(s,pick.selected),skill=first.skillId||first.skillIds[0];
  assert.equal(pick.planSkillId,skill,'이유가 말한 항목과 첫 문항의 항목이 같다');
  assert.ok(plan.homework.some(row=>row.skillId===skill));
  const label=s.coach.summary().skills.find(row=>row.id===skill).label;
  assert.match(pick.reason,new RegExp(`^이번 주 숙제예요\\. ${label}(에서 놓친 답이 있어| 기록이 오래돼) 새 문항으로 다시 확인해요\\.$`));
  assert.equal(skill.split('.')[1],weak,'약한 영역의 항목');
 }
});

// 10-21 아르곤 검수 반영(화면·계획).
test('계획 판: 지금 할 것의 제목은 화면 언어로, 레슨 제목 같은 한국어 학습 내용은 lang="ko" 칸에만 둔다',()=>{
 const en=createPositionView({t:(key,values)=>t(key,values,'en'),has:hasString,formatDate:(at,options)=>formatDate(at,options,'en')});
 const plan=exam.buildExamPlan({exam:exam.examInfo({...EXAM,examType:'topik2',targetGrade:4,examDate:'2027-04'}),summary:student().coach.summary(),now:KST_MONDAY+DAY,available:{recheck:15,life:true,writing:[{id:'topik2-writing-54',routeId:'writing:54',skillIds:['ko2.writing.argument']}]}});
 const title=html=>(html.match(/<section class="wplan-next">[\s\S]*?<h3>([\s\S]*?)<\/h3>/)||[])[1]||'';
 const outsideKo=html=>html.replace(/<span lang="ko">[^<]*<\/span>/g,'');
 const writing=title(en.renderExamPlan({plan,next:{route:'writing',routeId:'writing:54',label:'쓰기 연습 · 54 · 의견 글'}}));
 assert.match(writing,/^Writing practice · /);assert.doesNotMatch(writing,/[가-힣]/);
 const lesson=title(en.renderExamPlan({plan,next:{route:'lesson',lessonId:'cafe-1',label:'첫 인사 세 마디 · 이어 하기'}}));
 assert.match(lesson,/<span lang="ko">첫 인사 세 마디<\/span> · continue/);assert.doesNotMatch(outsideKo(lesson),/[가-힣]/);
 assert.match(title(en.renderExamPlan({plan,next:{route:'lesson',lessonId:'x',label:'인사하기'}})),/^<span lang="ko">인사하기<\/span>$/);
});
test('계획: 반 과제로 영역 횟수가 늘면 이번 주 횟수도 같이 늘고(머리 줄과 영역 합이 같다), TOPIK II 쓰기 숙제는 그 항목을 겨누는 과제만 낸다',()=>{
 const info=exam.examInfo({...EXAM,examType:'topik2',targetGrade:4,examDate:'2027-04',weeklyMinutes:30});
 const summary={evidenceComplete:true,asOf:new Date(KST_MONDAY+DAY).toISOString(),skills:[{id:'ko2.writing.argument',domain:'writing',status:'practice',n:3,incorrect:2,priority:1},{id:'ko2.writing.sentence',domain:'writing',status:'unseen',n:0,priority:.65},{id:'ko2.reading.detail',domain:'reading',status:'unseen',n:0,priority:.65}]};
 const writing=[{id:'topik2-writing-51',routeId:'writing:51',skillIds:['ko2.writing.sentence']},{id:'topik2-writing-54',routeId:'writing:54',skillIds:['ko2.writing.argument']}];
 const plan=exam.buildExamPlan({exam:info,summary,now:KST_MONDAY+DAY,classwork:[{kind:'reading',done:false},{kind:'reading',done:false},{kind:'writing',done:false}],available:{reading:{'ko2.reading.detail':2},listening:{},recheck:15,life:true,writing}});
 assert.equal(plan.sessions.total,plan.areas.reduce((n,row)=>n+row.planned,0),'머리 줄의 이번 주 횟수 = 영역 합');
 assert.ok(plan.sessions.total>2,'주 30분(2번)보다 반 과제가 많으면 그만큼');
 const row=plan.homework.find(item=>item.skillId==='ko2.writing.argument');
 assert.deepEqual(row.activities,['writing:54'],'의견 글 항목에는 54번만(51번을 그 항목 연습인 척 내지 않는다)');assert.equal(row.shortage,false);
 assert.match(view.renderExamPlan({plan}),/data-plan-writing="writing:54"/);
});
test('내 위치: 「먼저 볼 항목」은 같은 우선순위면 지금 연습할 수 있는 항목을 먼저 둔다(계획의 숙제와 같은 규칙) — 판정은 그대로',()=>{
 const s=student();diagnose(s,{wrong:()=>true});
 const summary=s.coach.summary(),events=s.coach.events();
 const plain=position.buildPositionMap({summary,events}),ready=new Set(['ko.listening.sequence','ko.listening.negation','ko.listening.detail']);
 const preferred=position.buildPositionMap({summary,events,prefer:id=>ready.has(id)});
 assert.ok(preferred.attention.every(id=>ready.has(id)),'같은 우선순위면 연결된 항목부터');
 assert.deepEqual(preferred.skills.map(skill=>[skill.id,skill.cell,skill.status]),plain.skills.map(skill=>[skill.id,skill.cell,skill.status]),'칸·상태는 바뀌지 않는다');
});
test('읽기 짧은 연습: 답한 뒤 초점이 갈 맞음·틀림 칸이 있다(화면 읽기가 결과를 먼저 읽게)',()=>{
 const s=student(),item=POOL.find(row=>row.skillId==='ko.reading.detail'),run=practice.createPracticeSession({coach:s.drill,items:[item]});
 run.next();s.tick();run.answer(item.choices.find(choice=>choice.id!==item.correctId).id);
 assert.match(view.renderPracticeItem({view:run.current,skill:{id:'ko.reading.detail'},feedback:run.current.feedback}),/<div class="wpos-feedback" data-practice-feedback tabindex="-1"/);
});

// 10-21 Fable 검수 반영.
test('내 위치: 듣기 게임으로 가는 단추는 게임 이름으로, 읽기 짧은 연습만 「이 항목 연습하기」 · 계획 판은 읽기가 닫힌 까닭과 TOPIK II 도달 파악의 기준을 말한다',()=>{
 const s=student();diagnose(s,{wrong:()=>true});
 const map=position.buildPositionMap({summary:s.coach.summary(),events:s.coach.events()});
 const routes=new Map([['ko.listening.sequence',{route:'game',gameId:'runner'}],['ko.reading.detail',{route:'practice',skillId:'ko.reading.detail'}]]);
 const board=view.renderPositionBoard({map,practice:id=>routes.get(id)||null});
 assert.match(board,/data-position-practice="ko.listening.sequence">바람길 · 짧은 지시 듣기 /);
 assert.match(board,/data-position-practice="ko.reading.detail">이 항목 연습하기 /);
 const closed=exam.buildExamPlan({exam:exam.examInfo({...EXAM,examType:'topik1',examDate:'2027-01'}),summary:s.coach.summary(),now:s.now(),available:{reading:{},listening:{'ko.listening.sequence':['world.play.runner']},recheck:15,life:true}});
 assert.ok(closed.notes.includes('reading-unavailable'));
 assert.match(view.renderExamPlan({plan:closed}),/data-plan-reading-later>읽기 짧은 연습은 문항을 준비하고 있어서 이번 주 계획에 아직 없어요\./);
 const topik2=exam.buildExamPlan({exam:exam.examInfo({...EXAM,examType:'topik2',targetGrade:4,examDate:'2027-04'}),summary:s.coach.summary(),now:s.now(),available:{recheck:15,life:true}});
 assert.equal(topik2.reach.basis,'topik1');assert.match(view.renderExamPlan({plan:topik2}),/data-plan-reach-basis>TOPIK II 항목 지도가 열리기 전이라/);
 assert.doesNotMatch(view.renderExamPlan({plan:closed}),/data-plan-reach-basis/,'TOPIK I 학생에게는 말하지 않는다');
});
