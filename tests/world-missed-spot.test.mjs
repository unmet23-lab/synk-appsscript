// 「놓친 곳 카드」(experiences/synk-world-app/world-missed-spot.mjs) — 시연 녹화 응답으로 숫자를 고정하고, 기록이 받쳐 주지 않는 말을 하지 않는지 본다.
// 녹화 응답(11-14 03시대, 입장 검사 캠퍼스 판 · 목소리 켬): synk-vendor modoo-plan-video-20261116/entry_world_voice/marks.json의 results1 · results2 —
// 1분 판 도표의 원천 스크립트(편집/아틀라스_재생.mjs)와 같은 순서 · 시각으로 저장소의 실제 코드(game-learning → Core → world-position)에 넣는다.
// 다른 점 하나: 게임(app.mjs decide)처럼 고른 답(choice)을 함께 남긴다 — 그 스크립트는 정오만 넣었다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildMissedSpot,missDirection,missedEntryRule as entryRule,MISSED_SPOT_POLICY,renderMissedSpot,placeMissedSpot} from '../experiences/synk-world-app/world-missed-spot.mjs';
import {buildPositionMap} from '../experiences/synk-world-app/world-position.mjs';
import * as plan from '../experiences/synk-world-app/world-exam-plan.mjs';
import {caseMetadata} from '../experiences/entry-check/learning.mjs';
import {VENUES} from '../experiences/entry-check/content.mjs';
import {choiceCorrection} from '../experiences/entry-check/correction.mjs';

const require=createRequire(import.meta.url);
const {createGame}=require('../atlas/game-learning.js');
const {createMap}=require('../strata');
const {worldMapData}=require('../strata/world-map.js');

const RECORDED={
 first:['pool-01 pass true 혼자','pool-02 pass false 혼자','pool-10 pass false 혼자','pool-13 pass true 혼자','pool-04 cap true 도움','pool-05 kid true 혼자'],
 second:['library-01 pass true 혼자','library-02 card true 도움','library-10 pass true 혼자','library-03 pass true 혼자','library-06 food true 혼자'],
};
const CASES=new Map(VENUES.flatMap(venue=>venue.cases.map(item=>[item.id,item])));
const option=value=>value==='pass'?'pass':`reject-${value}`;
const NEG='ko.reading.negation';

// parts: [[응답 줄…], …] — 부마다 6분을 띄운다(녹화와 같다). choice:false면 고른 답을 남기지 않는다(옛 · 접힌 기록 흉내).
// practice: 입장 검사 뒤 짧은 연습(world-practice — 같은 기기 기록)에서 같은 항목 새 문항에 낸 답 ['<번호> <true|false> [도움]', …].
const practiceItem=n=>({id:`neg-${n}`,itemKey:`world-practice.neg.${n}`,familyKey:`world-practice.neg.${n}`,skillId:NEG,modality:'reading',difficulty:1,responseFormat:'single-choice'});
function play(parts,{choice=true,start='2026-11-14T03:18:00+09:00',gap=6*60000,practice=[]}={}){
 let at=Date.parse(start);const memory=new Map();
 const storage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)};
 const map=createMap(worldMapData()),clock=()=>new Date(at).toISOString();
 const game=createGame({gameId:'entry-check',map,storage,clock});
 parts.forEach((lines,part)=>{
  if(part)at+=gap;
  for(const line of lines){
   const [id,picked,ok,how]=line.split(' '),item=CASES.get(id);
   at+=4000;const pid=game.present(caseMetadata(item));
   if(how==='도움')game.help(pid,'replay');
   at+=3000;
   game.answer(pid,{correct:ok==='true',assessable:true,...(choice?{choice:{selectedId:option(picked),correctId:option(item.answer)}}:{})});
  }
 });
 let coach=null;
 if(practice.length){
  at+=gap;coach=createGame({gameId:'world-practice',map,storage,clock});
  for(const line of practice){const [n,ok,how]=line.split(' ');at+=4000;const pid=coach.present(practiceItem(n));if(how==='도움')coach.help(pid,'hint');at+=3000;coach.answer(pid,{correct:ok==='true',assessable:true});}
 }
 const last=coach||game;
 return {game:last,summary:last.summary(),events:last.events(),now:at};
}
// 그 손님(원고 id)의 첫 답 사건.
const attemptOf=(events,caseId)=>{const key=caseMetadata(CASES.get(caseId)).itemKey,p=events.find(e=>e.type==='practice.presented'&&e.itemKey===key);return events.find(e=>e.type==='practice.attempted'&&e.presentationId===p?.id&&e.attemptNo===1);};
// 같은 기기 기록에서 한 일을 뺀 뒤 다시 읽는다(record.excluded).
const without=(run,...ids)=>{for(const id of ids)run.game.exclude(id);return {...run,summary:run.game.summary(),events:run.game.events()};};
const cardOf=(run,extra={})=>{
 const map=buildPositionMap({summary:run.summary,events:run.events,exam:'topik1'});
 return {map,card:buildMissedSpot({map,summary:run.summary,events:run.events,now:run.now,...extra})};
};
const step=(card,name)=>card.again.find(row=>row.step===name)||null;
const layer=(card,name)=>card.narrow.find(row=>row.layer===name)||null;

test('시연 기록: 부정·변경 손님 4명 중 2명 · 음식 줄 2번 모두 · 들여보냄 2번 모두',()=>{
 const {map,card}=cardOf(play([RECORDED.first,RECORDED.second]));
 assert.deepEqual(map.attention,[NEG]);
 assert.equal(card.kind,'topik');
 assert.equal(card.target.skillId,NEG);
 assert.deepEqual(layer(card,'skill'),{layer:'skill',skillId:NEG,label:'읽고 부정·변경 이해하기',domain:'reading',exam:'topik1',status:'practice',count:2,of:4,unit:'guest'});
 // 판 칸 아래 줄과 같은 수(world-position posNote)
 assert.deepEqual(map.skills.find(row=>row.id===NEG).note,{kind:'practice',n:4,wrong:2});
 assert.deepEqual(layer(card,'line'),{layer:'line',venueId:'pool',venue:'하늘 수영장',ruleId:'food',text:'음식은 가지고 들어갈 수 없습니다. 물은 괜찮습니다.',count:2,of:2});
 assert.deepEqual(layer(card,'direction'),{layer:'direction',direction:'let-in',count:2,of:2});
 assert.equal(card.grade,null);assert.equal(card.abilityClaim,false);
});

test('시연 기록: 그 자리 바로 다음 같은 규칙 손님 2명(1명 혼자 맞힘) → 나중에 다시 같은 종류 새 손님을 혼자 막음',()=>{
 const {card}=cardOf(play([RECORDED.first,RECORDED.second]));
 const spot=step(card,'spot');
 assert.equal(spot.state,'done');assert.equal(spot.guests,2);assert.equal(spot.right,1);assert.equal(spot.sameRule,true);
 const again=step(card,'again');
 assert.equal(again.state,'done');assert.equal(again.result,'correct');assert.equal(again.answer,'reject');
 // 기록에 없는 말(앱이 알렸다 · 넣었다)을 칸에 두지 않는다.
 for(const row of card.again)assert.ok(!('told' in row)&&!('promised' in row));
});

test('시연 기록 + 예시 시험 목표: 이번 주 숙제 ○ · 짧은 연습을 열 수 있으면 1 · 7 · 30일 ○',()=>{
 const run=play([RECORDED.first,RECORDED.second]);
 const now=Date.parse('2026-11-16T09:00:00+09:00');
 const exam=plan.examInfo({primaryReason:'exam',examType:'topik1',targetGrade:2,examDate:'2027-04',weeklyMinutes:60});
 const week=plan.examWeek(now);
 const p=plan.buildExamPlan({exam,summary:{...run.summary,asOf:new Date(now).toISOString()},now,done:plan.weekActivity({events:run.events,week}),
  examSkills:plan.examEvidenceSkills(run.events),available:{practice:{[NEG]:5},listening:{},recheck:16,life:true}});
 assert.ok(p.homework.some(row=>row.skillId===NEG&&!row.shortage));
 const {card}=cardOf(run,{homework:p.homework,practiceOpen:id=>id===NEG,now});
 assert.deepEqual(card.again.map(row=>[row.step,row.state]),[['spot','done'],['again','done'],['homework','planned'],['delayed','planned']]);
 // 시험 목표가 없으면(homework null) 숙제 줄은 없다 — 조건 안내 줄도 내지 않는다.
 const plain=cardOf(run,{homework:null,practiceOpen:()=>true,now}).card;
 assert.deepEqual(plain.again.map(row=>row.step),['spot','again','delayed']);
 // 짧은 연습을 열 수 없으면 1 · 7 · 30일 줄도 없다.
 assert.deepEqual(cardOf(run,{now}).card.again.map(row=>row.step),['spot','again']);
});

test('1부만(놓친 직후): 나중에 다시는 한 일이 아니라 원고에 남은 같은 종류 새 손님 수',()=>{
 const {card}=cardOf(play([RECORDED.first]));
 const again=step(card,'again');
 assert.equal(again.state,'planned');
 const seen=new Set(RECORDED.first.map(line=>line.split(' ')[0]));
 const left=VENUES.flatMap(venue=>venue.cases).filter(item=>!item.followupOnly&&item.skill===NEG&&!seen.has(item.id)).length;
 assert.equal(again.left,left);assert.ok(left>0);
});

test('고른 답이 없는 기록: 놓친 방향 층만 빠지고 나머지는 그대로',()=>{
 const {card}=cardOf(play([RECORDED.first,RECORDED.second],{choice:false}));
 assert.equal(layer(card,'direction'),null);
 assert.equal(layer(card,'line').count,2);
 assert.equal(step(card,'spot').guests,2);
});

test('한 번만 놓침: 항목 층만(안내문 줄 · 방향으로 좁히지 않는다)',()=>{
 const {card}=cardOf(play([['pool-01 pass true 혼자','pool-02 pass false 혼자','pool-13 pass true 혼자']]));
 assert.equal(card.target.skillId,NEG);
 assert.deepEqual(card.narrow.map(row=>row.layer),['skill']);
 assert.equal(layer(card,'skill').count,1);
});

test('도움 받고 놓친 답 · 맞힌 답만 있으면 카드가 없다',()=>{
 assert.equal(cardOf(play([['pool-01 pass true 혼자','pool-04 cap true 도움']])).card,null);
 assert.equal(cardOf(play([['pool-02 pass false 도움']])).card,null);
});

test('기록을 다 받지 못한 판에는 카드를 세우지 않는다',()=>{
 const run=play([RECORDED.first]);
 const map={...buildPositionMap({summary:run.summary,events:run.events}),evidenceComplete:false};
 assert.equal(buildMissedSpot({map,summary:run.summary,events:run.events}),null);
});

test('자리 가르기: 30분 넘게 뒤에 이어진 같은 종류 손님은 「그 자리」가 아니다',()=>{
 // pool-02를 놓치고 31분 뒤 같은 근무지의 다음 손님(pool-10)이 와도 바로잡기 자리로 세지 않는다.
 const run=play([['pool-01 pass true 혼자','pool-02 pass false 혼자'],['pool-10 pass false 혼자','pool-13 pass true 혼자']],{gap:31*60000});
 const {card}=cardOf(run);
 const spot=step(card,'spot');
 // 둘째 묶음 안에서 pool-10을 놓친 뒤 바로 온 pool-13만 그 자리다.
 assert.equal(spot.guests,1);assert.equal(spot.right,1);
});

test('놓친 방향은 바로잡기 문장과 같은 가름이다(correction.mjs choiceCorrection)',()=>{
 const pool=VENUES.find(venue=>venue.id==='pool'),item=CASES.get('pool-02'),pass=CASES.get('pool-01');
 assert.equal(missDirection({selectedId:'pass',correctId:'reject-food'}),'let-in');
 assert.match(choiceCorrection(pool,item,'pass'),/^통과를 골랐지만/);
 assert.equal(missDirection({selectedId:'reject-cap',correctId:'pass'}),'turned-away');
 assert.match(choiceCorrection(pool,pass,'cap'),/규칙으로 거절했지만, 이 손님은 들어갈 수 있어요/);
 assert.equal(missDirection({selectedId:'reject-cap',correctId:'reject-food'}),'wrong-rule');
 assert.match(choiceCorrection(pool,item,'cap'),/이유가 달라요/);
 for(const bad of [null,{},{selectedId:'pass',correctId:'pass'},{selectedId:'option-1',correctId:'option-2'}])assert.equal(missDirection(bad),null);
});

test('안내문 줄은 그 시각에 적용되는 줄이다(알림으로 더해진 줄 포함)',()=>{
 for(const venue of VENUES)for(const item of venue.cases){
  const rule=entryRule(venue,item);
  assert.ok(rule&&rule.text,`${item.id}: 안내문 줄을 찾지 못함`);
  if(item.answer!=='pass')assert.equal(rule.ruleId,item.answer);
 }
 assert.equal(MISSED_SPOT_POLICY.narrowMin,2);
});

// ── 화면(world-position-ui.mjs) ──
import {createPositionView} from '../experiences/synk-world-app/world-position-ui.mjs';
import STRINGS from '../experiences/brand-opening/world-strings.mjs';
import {t as tr,hasString,formatDate} from '../experiences/brand-opening/world-lang.mjs';
const helpers=lang=>({t:(key,vars)=>tr(key,vars,lang),has:hasString,formatDate:(at,options)=>formatDate(at,options,lang)});
const views=Object.fromEntries(['ko','en','mn'].map(lang=>[lang,createPositionView(helpers(lang))]));
// showBoard와 같은 길: 판 HTML(계정 묶음의 renderPositionBoard)에 카드를 끼운다.
const boardWith=(lang,{map,card,practice=null})=>placeMissedSpot(views[lang].renderPositionBoard({map,practice}),renderMissedSpot(card,{...helpers(lang),practice}),card?.target?.skillId);

test('화면: 판 맨 위 카드 한 장 — 좁혀 보면 두 줄 · 다시 만나기 · 범례, 같은 항목은 「먼저 볼 항목」에서 뺀다',()=>{
 const run=play([RECORDED.first,RECORDED.second]);
 const {map,card}=cardOf(run,{homework:[{skillId:NEG,shortage:false}],practiceOpen:()=>true});
 const html=boardWith('ko',{map,card,practice:id=>id===NEG?{route:'practice',skillId:id}:null});
 assert.match(html,/data-position-missed="ko\.reading\.negation"/);
 assert.ok(html.indexOf('data-position-missed')<html.indexOf('wpos-group'),'카드는 항목 판보다 위');
 assert.ok(html.includes('손님 4명 중 2명 놓침'));
 assert.ok(html.includes('「음식은 가지고 들어갈 수 없습니다. 물은 괜찮습니다.」'));
 assert.ok(html.includes('막아야 할 손님을 들여보냄'));
 assert.equal((html.match(/놓친 2번 모두/g)||[]).length,2);
 assert.ok(html.includes('바로 다음 같은 규칙 손님 2명 · 1명 혼자 맞힘'));
 assert.ok(html.includes('같은 종류 새 손님을 혼자 막음'));
 assert.deepEqual([...html.matchAll(/data-step="([a-z]+)" data-state="([a-z]+)"/g)].map(m=>[m[1],m[2]]),[['spot','done'],['again','done'],['homework','planned'],['delayed','planned']]);
 assert.ok(html.includes('기록에 있는 일')&&html.includes('다음 차례'));
 // 고른 항목은 「먼저 볼 항목」에 다시 나오지 않는다(그 항목뿐이면 그 칸이 없다).
 assert.doesNotMatch(html,/data-position-attention/);
 // 카드 안 단추는 판의 「이 항목 연습하기」와 같은 단추다.
 assert.match(html.slice(html.indexOf('data-position-missed'),html.indexOf('</section>',html.indexOf('data-position-missed'))),/data-position-practice="ko\.reading\.negation"/);
 // 급수 · 합격 · 「약점」 말이 없다.
 assert.doesNotMatch(html,/약점|급수|합격/);
 // 카드가 없으면 판은 예전 그대로(먼저 볼 항목이 남는다).
 const plain=views.ko.renderPositionBoard({map});
 assert.doesNotMatch(plain,/data-position-missed/);assert.match(plain,/data-position-attention/);
});

test('화면: 영어 · 몽골어 판도 같은 줄을 그리고, 안내문 줄은 한국어 원문 그대로다',()=>{
 const run=play([RECORDED.first,RECORDED.second]);
 const {map,card}=cardOf(run,{homework:[{skillId:NEG,shortage:false}],practiceOpen:()=>true});
 for(const lang of ['en','mn']){
  const html=boardWith(lang,{map,card});
  assert.match(html,/<span class="wmis-line" lang="ko">「음식은 가지고 들어갈 수 없습니다\. 물은 괜찮습니다\.」<\/span>/);
  assert.ok(html.includes(tr('position.missed.direction.let-in',{},lang)));
  assert.ok(html.includes(tr('position.missed.count.guest',{n:4,wrong:2},lang)));
  for(const key of Object.keys(STRINGS).filter(key=>key.startsWith('position.missed.')))assert.ok(STRINGS[key][lang],`${key} ${lang}`);
 }
});

// ── 「내 위치」 입구까지(world-learning-ui.mjs showBoard → 묶음 → 판) — 같은 기기 기록에 입장 검사가 남긴 사건을 판이 읽어 카드를 그린다 ──
import {createWorldEducation} from '../experiences/synk-world-app/world-learning-ui.mjs';
import {worldPosition} from '../experiences/synk-world-app/world-position-kit.mjs';
import {worldLearning} from '../experiences/synk-world-app/world-learning-map.mjs';
import fs from 'node:fs';
test('입구: 손님 기기 기록에 시연 근무 둘이 있으면 「내 위치」 판 맨 위에 놓친 곳 카드가 선다',async()=>{
 worldPosition.topik.use(JSON.parse(fs.readFileSync(new URL('../experiences/synk-world-app/world-topik-items.json',import.meta.url),'utf8')));
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 // 입장 검사(WORLD 안 게임)가 같은 기기 기록 열쇠에 남긴 것처럼: 실제 코치로 녹화 응답을 넣는다(시각은 지금 기준 어제 — 판의 Core는 지금 시각으로 읽는다).
 let at=Date.now()-86400000;
 const game=worldLearning.engine.createGame({gameId:'entry-check',storage,clock:()=>new Date(at).toISOString()});
 [RECORDED.first,RECORDED.second].forEach((lines,part)=>{if(part)at+=6*60000;for(const line of lines){const [id,picked,ok,how]=line.split(' '),item=CASES.get(id);
  at+=4000;const pid=game.present(caseMetadata(item));if(how==='도움')game.help(pid,'replay');at+=3000;
  game.answer(pid,{correct:ok==='true',assessable:true,choice:{selectedId:option(picked),correctId:option(item.answer)}});}});
 game.dispose?.();
 const panels=[];
 const progress={owner:'guest',learningProfile:()=>({profile:{status:'active',revision:1,consent:true}}),learningProfileValues:()=>({audio:'available'}),
  status:()=>({phase:'synced',rejected:false,scoped:false,message:''}),exportSnapshot:()=>({}),flush:async()=>{},hangulReading:()=>null};
 const home={updateStudy(){},toast(){},closePanel(){},showPanel:(title,html,options)=>panels.push({title,html,options})};
 const education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:()=>({selected:null,reason:''}),
  launchGame(){},startLesson(){},startReview(){},position:worldPosition,target:{localStorage:storage,document:{querySelector:()=>null},addEventListener(){},removeEventListener(){}}});
 await education.position();
 const html=panels.at(-1).html;
 assert.match(html,/data-position-missed="ko\.reading\.negation"/);
 for(const text of ['손님 4명 중 2명 놓침','「음식은 가지고 들어갈 수 없습니다. 물은 괜찮습니다.」','막아야 할 손님을 들여보냄','바로 다음 같은 규칙 손님 2명 · 1명 혼자 맞힘','같은 종류 새 손님을 혼자 막음'])assert.ok(html.includes(text),text);
});

test('끼우기: 카드가 짚은 항목만 「먼저 볼 항목」에서 빼고 나머지 줄은 둔다 · 자리를 못 찾으면 판 그대로',()=>{
 const board='<div class="wpos"><p class="wpos-intro">x</p><section class="wpos-attention" data-position-attention><h3>먼저</h3><ul><li data-skill="a"><span>A</span></li><li data-skill="b"><span>B</span><button>연습</button></li></ul></section><section class="wpos-diagnostic" data-diagnostic="ready"></section><section class="wpos-group" data-domain="listening"></section></div>';
 const out=placeMissedSpot(board,'<section class="wpos-missed">CARD</section>','a');
 assert.ok(out.indexOf('CARD')<out.indexOf('data-position-attention'));
 assert.doesNotMatch(out,/data-skill="a"/);assert.match(out,/<li data-skill="b"><span>B<\/span><button>연습<\/button><\/li>/);
 const only=placeMissedSpot(board.replace(/<li data-skill="b">.*?<\/li>/,''),'<section class="wpos-missed">CARD</section>','a');
 assert.doesNotMatch(only,/data-position-attention/);assert.ok(only.indexOf('CARD')<only.indexOf('wpos-diagnostic'));
 assert.equal(placeMissedSpot('<div>no anchors</div>','<section>CARD</section>','a'),'<div>no anchors</div>');
 assert.equal(placeMissedSpot(board,'','a'),board);
});

test('뺀 답(「제가 한 말과 달라요」 · record.excluded)은 카드 어느 칸에도 세지 않는다 — 짧은 연습 답을 빼면 「짧은 연습」 줄에서 빠진다(Fable FA1)',()=>{
 // 시연 근무 둘 뒤 짧은 연습에서 같은 항목 새 문항 둘을 혼자 맞혔다.
 const run=play([RECORDED.first,RECORDED.second],{practice:['1 true','2 true']});
 const card=cardOf(run).card;
 assert.ok(card,'카드가 선다');
 assert.equal(card.target.skillId,NEG);
 assert.deepEqual([step(card,'practice').n,step(card,'practice').right],[2,2]);
 // 짧은 연습 답 하나를 빼면 n · right에서 빠진다(record.excluded를 읽는 길 — world-missed-spot.mjs msIndex).
 const second=run.events.filter(e=>e.type==='practice.attempted'&&run.events.find(p=>p.id===e.presentationId)?.itemKey==='world-practice.neg.2')[0];
 const before=run.summary,cut=without(run,second.id),after=cardOf(cut).card;
 assert.ok(after,'뺀 뒤에도 카드가 선다');
 assert.deepEqual([step(after,'practice').n,step(after,'practice').right],[1,1]);
 assert.deepEqual(step(after,'practice').eventIds.includes(second.id),false);
 // Core 요약이 그 답을 아직 셌더라도(빼기 전에 읽은 요약) 카드는 Trail의 뺀 기록을 직접 읽어 세지 않는다.
 const stale=cardOf({...cut,summary:before}).card;
 assert.deepEqual([step(stale,'practice').n,step(stale,'practice').right],[1,1]);
 // 입장 검사 오답 하나를 빼면 그 오답은 Core 근거에서 빠진다 — 카드는 남은 한 번만 짚고 안내문 줄로 좁히지 않는다.
 const fresh=play([RECORDED.first,RECORDED.second]),miss=attemptOf(fresh.events,'pool-02'),one=cardOf(without(fresh,miss.id)).card;
 assert.ok(one,'남은 오답 하나로 카드가 선다');
 assert.ok(!one.evidence.includes(miss.id));
 assert.deepEqual(one.narrow.map(row=>row.layer),['skill']);
});

test('뺀 답은 「그 자리」 · 「나중에 다시」에도 세지 않는다 — 그 자리는 거기서 멈추고, 나중 손님은 건너뛴다(Fable F1)',()=>{
 // 그 자리 손님(pool-13 · 혼자 맞힘)의 답을 빼면 바로 다음 손님은 pool-10 하나뿐이다.
 const base=play([RECORDED.first,RECORDED.second]);
 const spot=step(cardOf(without(base,attemptOf(base.events,'pool-13').id)).card,'spot');
 assert.deepEqual([spot.guests,spot.right],[1,0]);
 // 나중 손님(library-06)의 답을 빼면 「도움 받아 맞힘」이 아니라 아직 안 본 같은 종류 손님 수다.
 const later=play([RECORDED.first,RECORDED.second]);
 const again=step(cardOf(without(later,attemptOf(later.events,'library-06').id)).card,'again');
 assert.equal(again.state,'planned');assert.ok(again.left>0);
});

test('「도움 받아 맞힘」은 도움 사건(practice.helped)이 있을 때만 — 도움도 독립 근거도 없으면 「만남」(Fable F1)',()=>{
 // 나중 손님을 다시 듣기 도움을 받고 맞혔다.
 const helped=play([RECORDED.first,RECORDED.second.map(line=>line.startsWith('library-06 ')?'library-06 food true 도움':line)]);
 assert.equal(step(cardOf(helped).card,'again').result,'assisted');
 // 그 자리 손님이 도움을 받고 맞혔으면 「혼자 맞힘」에 세지 않는다.
 const spotHelped=play([RECORDED.first.map(line=>line.startsWith('pool-13 ')?'pool-13 pass true 도움':line),RECORDED.second]);
 assert.deepEqual([step(cardOf(spotHelped).card,'spot').guests,step(cardOf(spotHelped).card,'spot').right],[2,0]);
 // 도움 없이 맞혔는데 Core 근거에 그 답이 없으면(창 · 칸 한도 밖) 도움으로 짐작하지 않는다.
 const run=play([RECORDED.first,RECORDED.second]),id=attemptOf(run.events,'library-06').id;
 const strip=value=>Array.isArray(value)?value.filter(row=>row!==id).map(strip):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,row])=>[key,strip(row)])):value;
 const summary=strip(run.summary),map=buildPositionMap({summary,events:run.events,exam:'topik1'});
 const again=step(buildMissedSpot({map,summary,events:run.events,now:run.now}),'again');
 assert.equal(again.result,'other');
 assert.equal(renderMissedSpot(buildMissedSpot({map,summary,events:run.events,now:run.now}),helpers('ko')).includes('같은 종류 새 손님을 만남'),true);
});

test('접힌 기록이 있으면 좁혀 짚기 분모가 머리 줄의 놓친 수와 같다 — 「모두」라고 하지 않는다(Fable F2)',()=>{
 // 수영장 근무에서 음식 줄 손님 셋을 놓쳤다(pool-02 · pool-10 · pool-07).
 const run=play([['pool-01 pass true 혼자','pool-02 pass false 혼자','pool-10 pass false 혼자','pool-13 pass true 혼자','pool-07 pass false 혼자']]);
 const whole=cardOf(run).card;
 assert.deepEqual([layer(whole,'skill').count,layer(whole,'line').count,layer(whole,'line').of],[3,3,3]);
 // pool-02가 접혀 로그에 없다(기기 기록이 접은 옛 항목 흉내 — 제시 · 도움 · 답이 함께 빠진다). Core 요약은 그 답을 그대로 센다.
 const gone=attemptOf(run.events,'pool-02'),presentation=gone.presentationId;
 const decision=run.events.find(e=>e.id===presentation).decisionId;
 const events=run.events.filter(e=>![presentation,gone.id,decision].includes(e.id)&&e.presentationId!==presentation&&e.decisionId!==decision);
 const map=buildPositionMap({summary:run.summary,events,exam:'topik1'});
 assert.equal(map.skills.find(row=>row.id===NEG).folded,1);
 const card=buildMissedSpot({map,summary:run.summary,events,now:run.now});
 assert.deepEqual(layer(card,'skill'),{...layer(card,'skill'),count:3,unit:'try'});
 assert.deepEqual([layer(card,'line').count,layer(card,'line').of],[2,3]);
 const html=renderMissedSpot(card,helpers('ko'));
 assert.ok(html.includes('놓친 3번 중 2번'));assert.doesNotMatch(html,/모두/);
});

test('짧은 연습 안에서 놓쳤으면 마지막 놓침 뒤의 답만 「● 짧은 연습」에 센다(Fable F3)',()=>{
 // 짧은 연습에서 같은 항목 새 문항 넷: 틀림 · 맞음 · 틀림 · 맞음 → 머리 「4번 중 2번 놓침」, 다시 만나기는 넷째 하나뿐.
 const run=play([],{practice:['1 false','2 true','3 false','4 true']});
 const card=cardOf(run).card;
 assert.equal(card.target.skillId,NEG);
 assert.deepEqual([layer(card,'skill').count,layer(card,'skill').of,layer(card,'skill').unit],[2,4,'try']);
 const practice=step(card,'practice');
 assert.deepEqual([practice.n,practice.right],[1,1]);
 for(const id of card.evidence)assert.ok(!practice.eventIds.includes(id),'머리에 센 놓침을 다시 만난 일로 세지 않는다');
 // 마지막이 놓침이면 짧은 연습 줄이 없다(숙제도 없으면 그 칸째).
 assert.equal(step(cardOf(play([],{practice:['1 false','2 true','3 false']})).card,'practice'),null);
});

test('다른 기기에서 놓치기 전에 한 짧은 연습이 뒤늦게 받아 붙어도(importEvents) 「● 짧은 연습」에 세지 않는다(다음 판 검수 P2)',()=>{
 const memory=()=>{const m=new Map();return {getItem:key=>m.has(key)?m.get(key):null,setItem:(key,value)=>m.set(key,String(value)),removeItem:key=>m.delete(key)};};
 const map=createMap(worldMapData());
 // 기기 A: 09:00 짧은 연습에서 같은 항목 새 문항 둘을 혼자 맞힘.
 let a=Date.parse('2026-11-14T09:00:00+09:00');
 const phone=createGame({gameId:'world-practice',map,storage:memory(),clock:()=>new Date(a).toISOString()});
 for(const n of [1,2]){a+=4000;const pid=phone.present(practiceItem(n));a+=3000;phone.answer(pid,{correct:true,assessable:true});}
 // 기기 B: 10:00 입장 검사에서 음식 줄 손님 둘을 놓침 → 그 뒤 A의 기록을 받는다(받은 사건은 로그 끝에 붙는다).
 let b=Date.parse('2026-11-14T10:00:00+09:00');
 const laptop=createGame({gameId:'entry-check',map,storage:memory(),clock:()=>new Date(b).toISOString()});
 for(const line of RECORDED.first){const [id,picked,ok,how]=line.split(' '),item=CASES.get(id);b+=4000;const pid=laptop.present(caseMetadata(item));if(how==='도움')laptop.help(pid,'replay');b+=3000;
  laptop.answer(pid,{correct:ok==='true',assessable:true,choice:{selectedId:option(picked),correctId:option(item.answer)}});}
 const added=laptop.syncPort.importEvents(phone.events());
 assert.ok(added.added>0,'A의 기록을 받았다');
 const events=laptop.events(),card=cardOf({summary:laptop.summary(),events,now:b}).card;
 assert.equal(card.target.skillId,NEG);
 const practiceIds=new Set(events.filter(e=>e.type==='practice.attempted'&&events.find(p=>p.id===e.presentationId)?.itemKey?.startsWith('world-practice.')).map(e=>e.id));
 assert.equal(practiceIds.size,2);
 for(const id of practiceIds)assert.ok(events.findIndex(e=>e.id===id)>events.findIndex(e=>e.id===card.evidence.at(-1)),'받은 연습은 로그에서 놓침보다 뒤에 있다');
 assert.equal(step(card,'practice'),null,'놓치기 전에 한 연습은 다시 만난 일이 아니다');
});

test('최근 창(30일)을 넘긴 옛 오답만 남으면 카드가 없다',()=>{
 // 시각이 앞으로 흐르는 시계로 근무 둘을 두고, 40일 뒤 시각으로 Core 요약을 다시 읽는다(창은 지금 시각으로 자른다).
 let at=Date.parse('2026-10-01T03:18:00+09:00');const memory=new Map();
 const storage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)};
 const game=createGame({gameId:'entry-check',map:createMap(worldMapData()),storage,clock:()=>new Date(at).toISOString()});
 for(const line of [...RECORDED.first,...RECORDED.second]){const [id,picked,ok,how]=line.split(' '),item=CASES.get(id);at+=7000;const pid=game.present(caseMetadata(item));if(how==='도움')game.help(pid,'replay');
  game.answer(pid,{correct:ok==='true',assessable:true,choice:{selectedId:option(picked),correctId:option(item.answer)}});}
 assert.ok(cardOf({summary:game.summary(),events:game.events(),now:at}).card,'그날은 카드가 선다');
 at+=40*86400000;
 const summary=game.summary(),events=game.events(),map=buildPositionMap({summary,events});
 assert.equal(buildMissedSpot({map,summary,events,now:at}),null);
});

test('1 · 7 · 30일 줄: 지금 · 다가올 창이 있으면 ○(확인한 수도 함께), 확인만 남으면 ●, 확인 없이 다 지났으면 줄 없음(카본 A1)',()=>{
 const run=play([RECORDED.first,RECORDED.second]),now=run.now,DAY=86400000;
 const item=(window,status,dueAt)=>({gameId:'world-practice',measure:{skillId:NEG},window,status,dueAt:new Date(dueAt).toISOString(),sourceAt:'2026-11-14T00:00:00.000Z'});
 const at=(...rows)=>step(cardOf(run,{projection:{items:rows},now}).card,'delayed');
 let row=at(item('d1','observed',now-DAY),item('d7','not_due',now+5*DAY),item('d30','not_due',now+28*DAY));
 assert.equal(row.state,'planned');assert.equal(row.observed,1);assert.equal(row.due,false);assert.ok(row.dueAt);
 const html=renderMissedSpot(cardOf(run,{projection:{items:[item('d1','observed',now-DAY),item('d7','not_due',now+5*DAY)]},now}).card,helpers('ko'));
 assert.match(html,/1번 다시 확인함 · .+ 다시 확인 · 아래 「시간을 두고 다시 확인」/);
 row=at(item('d1','observed',now-30*DAY),item('d7','observed',now-25*DAY),item('d30','observed',now-DAY));
 assert.equal(row.state,'done');assert.equal(row.observed,3);
 row=at(item('d1','observed',now-6*DAY),item('d7','due',now-DAY),item('d30','not_due',now+20*DAY));
 assert.equal(row.state,'planned');assert.equal(row.due,true);assert.equal(row.dueAt,null);
 assert.equal(at(item('d1','missed',now-30*DAY),item('d7','unavailable',now-25*DAY),item('d30','missed',now-DAY)),null);
});

test('화면: 다시 만나기 줄의 점은 상태를 읽어 준다 · 영어 새 문항 하나는 단수(카본 A3 · A4)',()=>{
 const {card}=cardOf(play([RECORDED.first,RECORDED.second]),{homework:[{skillId:NEG,shortage:false}]});
 const html=renderMissedSpot(card,helpers('ko'));
 assert.match(html,/<li data-step="spot" data-state="done"><i class="wmis-dot" role="img" aria-label="기록에 있는 일"><\/i>/);
 assert.match(html,/<li data-step="homework" data-state="planned"><i class="wmis-dot" role="img" aria-label="다음 차례"><\/i>/);
 assert.equal(tr('position.missed.practice.done',{n:1,right:1},'en'),'1 new question · 1 right on your own');
 assert.equal(tr('position.missed.practice.done',{n:3,right:2},'en'),'3 new questions · 2 right on your own');
});

test('지금 확인할 창이어도 맞는 새 문항이 없으면 「확인할 수 있어요」라고 하지 않는다(GPT GA2)',()=>{
 const run=play([RECORDED.first,RECORDED.second]),now=run.now,DAY=86400000;
 const items=[{id:'x:d1',gameId:'world-practice',measure:{skillId:NEG},window:'d1',status:'observed',dueAt:new Date(now-6*DAY).toISOString(),sourceAt:'2026-11-14T00:00:00.000Z'},
  {id:'x:d7',gameId:'world-practice',measure:{skillId:NEG},window:'d7',status:'due',dueAt:new Date(now-DAY).toISOString(),sourceAt:'2026-11-14T00:00:00.000Z'}];
 const without=cardOf(run,{projection:{items},now}).card,withItem=cardOf(run,{projection:{items},followupOpen:id=>id==='x:d7',now}).card;
 assert.equal(step(without,'delayed').open,false);assert.equal(step(withItem,'delayed').open,true);
 const a=renderMissedSpot(without,helpers('ko')),b=renderMissedSpot(withItem,helpers('ko'));
 assert.match(a,/1번 다시 확인함 · 확인할 때예요/);assert.doesNotMatch(a,/지금 확인할 수 있어요/);
 assert.match(b,/1번 다시 확인함 · 지금 확인할 수 있어요/);
});
