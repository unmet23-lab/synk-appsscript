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
function play(parts,{choice=true,start='2026-11-14T03:18:00+09:00',gap=6*60000}={}){
 let at=Date.parse(start);const memory=new Map();
 const storage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)};
 const game=createGame({gameId:'entry-check',map:createMap(worldMapData()),storage,clock:()=>new Date(at).toISOString()});
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
 return {game,summary:game.summary(),events:game.events(),now:at};
}
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
