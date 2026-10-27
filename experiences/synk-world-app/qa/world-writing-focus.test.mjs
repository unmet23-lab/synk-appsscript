import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {checkWriting,endingOf,sentencesOf} from '../world-writing-check.mjs';
import {FOCUS_ID,drillPool,drillDeck,drillWeights,readFocus,focusState,focusOutcome,recordFocusOutcome,recordDrillPick,focusNeed,retryItem,mySentences,endsPlain,sameBefore,NEED_DAYS} from '../world-writing-focus.mjs';
import {writingCandidates,WRITING_CANDIDATES,readWritingSummary} from '../world-writing-practice.mjs';

// 쓰기 「한 가지 고치기」(53번 글의 끝맺음 · qa/writing-focus-20261027/설계.md): 판정·연습 카드·다음 학습 신호와 계획 경로. 화면 흐름은 world-writing-browser.test.mjs.
const bank=JSON.parse(fs.readFileSync(fileURLToPath(new URL('../world-writing-items.json',import.meta.url)),'utf8'));
const open=bank.items.filter(item=>item.review?.status==='passed');
const by=id=>bank.items.find(item=>item.id===id);
const HOUR=3600000,DAY=24*HOUR,NOW=Date.parse('2026-10-27T03:00:00.000Z');
const iso=ms=>new Date(ms).toISOString();
const memory=()=>{const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const focusOf=events=>({id:FOCUS_ID,events,drill:null});
const run=(item,text,state,assisted=false)=>focusOutcome({item,text,result:checkWriting(item,text),state,assisted});
const formal='2020년에는 300만 명이었습니다. 2022년에는 780만 명으로 늘었습니다. 앞으로도 늘 것으로 보입니다.';
const plain='2020년에는 300만 명이었다. 2022년에는 780만 명으로 늘었다. 그러나 모두가 만족하는 것은 아니다. 앞으로도 늘 것으로 보인다.';

test('문장 끝: 「아니다」·「그러니까」는 「-습니다」가 아니다(Fable 설계 검토 P1-1) — 53번 글에 거짓 문체 지적이 없다',()=>{
 assert.deepEqual(['늘 좋은 것은 아니다.','그러니까.','증가합니다.','아닙니다.','합니까?','있습니까?','찾아가십시오.','함께 합시다.'].map(endingOf),['plain','plain','formal','formal','formal','formal','formal','formal']);
 assert.equal(checkWriting(by('w53-resale'),by('w53-resale').model+'\n그러나 모두가 만족하는 것은 아니다.').items.some(entry=>entry.id==='style'),false);
 assert.ok(checkWriting(by('w53-resale'),formal).items.some(entry=>entry.id==='style'));
});

test('연습 카드: 검수 통과 51·52 지문의 완성 문장만, 바구니 = 그 글의 문체 = 문장 끝 꼴 · 예시답·53·54·보류 문항 문장은 없다',()=>{
 const pool=drillPool(open),answers=bank.items.flatMap(item=>item.type<=52?item.blanks.map(b=>b.model):[item.model]).join('\n');
 const count=bin=>pool.filter(card=>card.bin===bin).length;
 assert.ok(count('formal')>=2&&count('polite')>=2&&count('plain')>=2,JSON.stringify({formal:count('formal'),polite:count('polite'),plain:count('plain')}));
 for(const card of pool){
  const item=by(card.itemId);
  assert.ok([51,52].includes(item.type)&&item.review.status==='passed',card.itemId);
  assert.equal(card.bin,item.style);assert.equal(endingOf(card.text),card.bin,card.text);
  assert.ok(JSON.stringify(item.passage).includes(card.text.slice(0,12)),'지문 글 그대로');
  assert.ok(!answers.includes(card.text),'예시답 문장이 아니다');
 }
 assert.ok(!pool.some(card=>/올림$/.test(card.text)),'「올림」 줄은 문장이 아니다');
 const held=open.map(item=>item.type===51?{...item,review:{status:'held'}}:item);
 assert.equal(drillPool(held).filter(card=>card.bin!=='plain').length,0,'보류 문항은 카드에 없다');
 const deck=drillDeck(pool,{seed:7});
 assert.equal(deck.length,6);assert.deepEqual(['formal','polite','plain'].map(bin=>deck.filter(card=>card.bin===bin).length),[2,2,2]);
 assert.deepEqual(drillDeck(pool,{seed:7}),deck,'같은 씨앗 = 같은 판');
 assert.equal(new Set(deck.map(card=>card.text)).size,6);
 assert.deepEqual(drillDeck([],{seed:1}),[]);
});

test('결과 분류: 찾음 → 같은 글 고침은 도움, 다른 글 도움 없이 3문장↑은 혼자, 예시답·자동 피드백 본 글은 도움, 다시 잡히면 다시, 2문장은 판정 안 함',()=>{
 const resale=by('w53-resale'),ways=by('w53-study-ways');
 let state=focusState(null,{now:NOW});assert.equal(state.open,false);
 assert.equal(run(resale,plain,state),null,'고치는 중이 아니면 맞은 글은 기록하지 않는다');
 const found=run(resale,formal,state);assert.deepEqual(found,{kind:'found',plain:0,off:3,total:3,errors:{formal:3,polite:0}});
 const events=[{at:iso(NOW-3*HOUR),itemId:resale.id,...found}];state=focusState(focusOf(events),{now:NOW});
 assert.equal(state.open,true);assert.ok(state.found.has(resale.id));
 assert.equal(run(resale,plain,state).kind,'helped','카드를 본 뒤 같은 글을 고친 것은 도움 받고 고침');
 assert.equal(run(ways,plain,state).kind,'independent');
 assert.equal(run(ways,plain,state,true).kind,'helped','예시답·자동 피드백을 본 문항');
 assert.equal(run(ways,formal,state).kind,'retry');
 assert.equal(run(ways,'2020년에는 300만 명이었다. 2022년에는 늘었다.',state),null,'「-다」 문장 둘은 판정하지 않는다');
 assert.equal(run(by('w54-advice'),formal,state),null,'54번은 이번 흐름 밖');
 // 혼자 해내면 닫히고, 다른 53번에서 다시 잡히면 새 차례로 열린다.
 const closed=[...events,{at:iso(NOW-2*HOUR),itemId:ways.id,kind:'independent',plain:4,off:0,total:4}];
 assert.equal(focusState(focusOf(closed),{now:NOW}).open,false);
 const again=[...closed,{at:iso(NOW-HOUR),itemId:by('w53-clinic').id,kind:'found',plain:0,off:3,total:3}];
 const reopened=focusState(focusOf(again),{now:NOW});assert.equal(reopened.open,true);assert.deepEqual([...reopened.found],['w53-clinic']);
 // 원래 글을 고치지 않고 혼자 해낸 뒤 원래 글을 고치면 닫힌 차례에 「도움 받고 고침」으로 붙고(한 번), 차례를 다시 열지 않는다(Fable F2).
 const closedState=focusState(focusOf(closed),{now:NOW});assert.deepEqual([...closedState.closedFound],['w53-resale']);
 assert.equal(run(resale,plain,closedState).kind,'helped');assert.equal(run(ways,plain,closedState),null,'닫힌 차례의 다른 글은 기록하지 않는다');
 const late=[...closed,{at:iso(NOW-HOUR),itemId:resale.id,kind:'helped',plain:4,off:0,total:4}],lateState=focusState(focusOf(late),{now:NOW});
 assert.equal(lateState.open,false);assert.equal(lateState.helped.kind,'helped');assert.equal(run(resale,plain,lateState),null,'한 번만');
 assert.equal(focusNeed(focusOf(late),{now:NOW}),null);
 // 그 뒤 다른 53번에서 다시 잡히면 새 차례에는 지난 차례의 늦은 helped가 섞이지 않는다.
 const next=focusState(focusOf([...late,{at:iso(NOW-30*60000),itemId:'w53-clinic',kind:'found',plain:0,off:3,total:3}]),{now:NOW});
 assert.equal(next.open,true);assert.deepEqual(next.round.map(e=>e.kind),['found']);assert.equal(next.helped,null);
 assert.deepEqual(next.closedRound.map(e=>e.kind),['found','independent','helped']);
 // 기록 상한으로 맨 앞이 「혼자 해냄」이어도 닫힌 차례는 그 하나뿐이다(lastIndexOf 음수 함정).
 const head=focusState(focusOf([{at:iso(NOW-2*HOUR),itemId:'w53-study-ways',kind:'independent',plain:4,off:0,total:4},{at:iso(NOW-HOUR),itemId:'w53-resale',kind:'helped',plain:4,off:0,total:4}]),{now:NOW});
 assert.equal(head.open,false);assert.deepEqual(head.closedRound.map(e=>e.kind),['independent','helped']);
 // 지난 차례에 잡혔던 글(resale)을 새 차례에 고쳐도 「혼자」가 아니다.
 assert.equal(run(resale,plain,next).kind,'helped');
 // 다른 문항 혼자는 그대로 혼자.
 assert.equal(run(by('w53-living-cost'),plain,next).kind,'independent');
});

test('다음 학습 신호(practiceNeed): 찾음·다시 → retry, 도움 받고 고침 → assisted, 혼자 해냄 → 없음 · 7일 창 · 미래 사건은 보지 않음 · 토큰 꼴',()=>{
 const at=iso(NOW-HOUR),first={at:iso(NOW-2*HOUR),itemId:'w53-resale',kind:'found',plain:0,off:3,total:3};
 const need=kind=>focusNeed(focusOf(kind==='found'?[{...first,at}]:[first,{at,itemId:kind==='independent'?'w53-study-ways':'w53-resale',kind,plain:4,off:0,total:4}]),{now:NOW});
 assert.deepEqual(need('found'),{kind:'retry',at,evidenceRefs:['writing.ending-53.w53-resale']});
 assert.equal(need('retry').kind,'retry');assert.equal(need('helped').kind,'assisted');assert.equal(need('helped').at,at);assert.equal(need('independent'),null);
 for(const kind of ['found','helped'])assert.match(need(kind).evidenceRefs[0],/^[a-zA-Z0-9_.:-]{1,120}$/);
 const old=focusOf([{at:iso(NOW-(NEED_DAYS*DAY+1)),itemId:'w53-resale',kind:'found',plain:0,off:3,total:3}]);
 assert.equal(focusNeed(old,{now:NOW}),null,'7일이 지나면 Core에 넘기지 않는다');
 assert.equal(focusState(old,{now:NOW}).open,true,'목록 카드는 남는다');
 const future=focusOf([{at:iso(NOW+DAY),itemId:'w53-resale',kind:'found',plain:0,off:3,total:3}]);
 assert.equal(focusNeed(future,{now:NOW}),null);assert.equal(focusState(future,{now:NOW}).open,false);
 // 기록 읽기: 모르는 꼴은 버리고 최근 20개만.
 const many=Array.from({length:25},(_,i)=>({at:iso(NOW-(25-i)*HOUR),itemId:'w53-resale',kind:i===24?'helped':'found',plain:0,off:1,total:1}));
 const read=readFocus({id:FOCUS_ID,events:[...many,{at:'x',itemId:'w53-resale',kind:'found'},{at,itemId:3,kind:'found'},{at,itemId:'w53-resale',kind:'pass'}],drill:{at,right:'5',total:6}});
 assert.equal(read.events.length,20);assert.equal(read.drill,null);assert.equal(focusNeed(read,{now:NOW}).kind,'assisted');
 assert.deepEqual(readFocus({id:'other'}),{id:FOCUS_ID,events:[],drill:null,exposed:{},practice:{formal:[],polite:[],plain:[]},recentCards:[]});
});

test('재현 1: 의문·청유·미완성·무의미한 반복은 설명문을 혼자 쓴 근거가 아니다',()=>{
 const state=focusState(focusOf([{at:iso(NOW-HOUR),itemId:'w53-resale',kind:'found'}]),{now:NOW});
 for(const text of ['왜 증가할까? 무엇인가? 무엇을 하자.','다. 다. 다.','이용자는 늘었다. 그래서 많다. 여전히 증가하니까.','이용자는 늘었다. 이용자는 늘었다. 이용자는 늘었다.','이용자는 늘었다? 그래서 많다. 앞으로도 늘 것이다.']){
  assert.equal(run(by('w53-study-ways'),text,state),null,text);
 }
 for(const text of ['왜 증가할까?','무엇인가?','무엇을 하자.','증가하니까.','다.','이용자는 늘었다?','이용자는 늘었다. 왜 증가할까?'])assert.equal(endsPlain(text),false,text);
 assert.equal(run(by('w53-study-ways'),plain,state).kind,'independent');
 for(const text of ['이용자는 늘었다.','수치가 높다.','이유는 가격이다.','모두가 만족하는 것은 아니다.'])assert.equal(endsPlain(text),true,text);
});

test('재현 2: 고침 → 다시 틀림 → 다시 고침을 저장하고 다음 추천과 일치시킨다',()=>{
 let f=readFocus(null),time=NOW-HOUR;
 for(const [text,kind,need] of [[formal,'found','retry'],[plain,'helped','assisted'],[formal,'retry','retry'],[plain,'helped','assisted']]){
  const out=run(by('w53-resale'),text,focusState(f,{now:NOW}));assert.equal(out.kind,kind);
  f=recordFocusOutcome(f,{at:iso(time++),itemId:'w53-resale',...out});
  f=readFocus(JSON.parse(JSON.stringify(f)));
  assert.equal(f.events.at(-1).kind,kind);assert.equal(focusNeed(f,{now:NOW}).kind,need);
 }
 assert.deepEqual(f.events.map(e=>e.kind),['found','helped','retry','helped']);
 const count=f.events.length;f=recordFocusOutcome(f,{...f.events.at(-1),at:iso(time++)});
 assert.equal(f.events.length,count,'동일 결과를 연속 확인할 때만 합친다');
 // 기록 수를 줄여도 방금 다시 확인했다는 시각은 갱신해야 7일 창에서 사라지지 않는다.
 const old=readFocus(focusOf([{at:iso(NOW-10*DAY),itemId:'w53-resale',kind:'found',plain:0,off:3,total:3},{at:iso(NOW-9*DAY),itemId:'w53-resale',kind:'retry',plain:0,off:3,total:3}]));
 assert.equal(focusNeed(old,{now:NOW}),null);
 const fresh=recordFocusOutcome(old,{...old.events.at(-1),at:iso(NOW)});
 assert.equal(fresh.events.length,old.events.length);assert.equal(focusNeed(fresh,{now:NOW}).at,iso(NOW));
 assert.equal(fresh.exposed['w53-resale'],iso(NOW-10*DAY),'처음 도움을 받은 시각은 보존');
});

test('재현 3: 사건 상한·새로 고침·새 차례 뒤에도 예전에 피드백을 본 문항은 도움 받은 문항이다',()=>{
 let f=readFocus(focusOf([{at:iso(NOW-3*HOUR),itemId:'w53-resale',kind:'found'},{at:iso(NOW-2*HOUR),itemId:'w53-study-ways',kind:'independent'}]));
 for(let i=0;i<45;i++)f=recordFocusOutcome(f,{at:iso(NOW-HOUR+i),itemId:'w53-clinic',kind:'retry',plain:i,off:3,total:i+3});
 f=readFocus(JSON.parse(JSON.stringify(f)));assert.equal(f.events.length,20);
 const state=focusState(f,{now:NOW});assert.equal(state.open,true);assert.ok(state.everFound.has('w53-resale'));
 assert.equal(run(by('w53-resale'),plain,state).kind,'helped');
 assert.notEqual(retryItem(open,{state}).id,'w53-resale');
 // 20개 이전에 잘린 구 버전 사건은 남아 있는 일반 점검 이력에서 이관한다.
 const migrated=readFocus(focusOf([{at:iso(NOW-HOUR),itemId:'w53-clinic',kind:'found'}]),{history:[{at:iso(NOW-DAY),source:'rule-check',type:53,itemId:'w53-resale',checks:['style'],answer:'이 원문은 옮기지 않는다'}]});
 assert.equal(run(by('w53-resale'),plain,focusState(migrated,{now:NOW})).kind,'helped');
 assert.ok(!JSON.stringify(migrated).includes('원문'));
 // 여러 문항을 번갈아 고쳐 20개가 차도 진행 중인 차례가 사라지지 않는다.
 let active=readFocus(focusOf([{at:iso(NOW-HOUR),itemId:'w53-clinic',kind:'found'}]));
 for(let i=0;i<45;i++)active=recordFocusOutcome(active,{at:iso(NOW-HOUR+i+1),itemId:i%2?'w53-clinic':'w53-resale',kind:'helped',plain:3,off:0,total:3});
 assert.equal(active.events.length,20);assert.equal(focusState(active,{now:NOW}).open,true);
 assert.equal(focusNeed(active,{now:NOW}).kind,'assisted');
});

test('개인화: 같은 씨앗도 글에서 헷갈린 문체에 따라 4·1·1로 달라지고 최근 정답에 따라 비중이 줄어든다',()=>{
 const pool=drillPool(open),make=errors=>readFocus(focusOf([{at:iso(NOW-HOUR),itemId:'w53-resale',kind:'found',plain:0,off:3,total:3,errors}]));
 const counts=deck=>['formal','polite','plain'].map(bin=>deck.filter(c=>c.bin===bin).length);
 let f=make({formal:3,polite:0});
 const formalDeck=drillDeck(pool,{seed:7,focus:f,now:NOW}),politeDeck=drillDeck(pool,{seed:7,focus:make({formal:0,polite:3}),now:NOW});
 assert.deepEqual(counts(formalDeck),[4,1,1]);assert.deepEqual(counts(politeDeck),[1,4,1]);
 assert.equal(formalDeck[0].bin,'formal');assert.equal(politeDeck[0].bin,'polite');
 for(const card of formalDeck)f=recordDrillPick(f,card,card.bin==='polite'?'plain':card.bin,{now:NOW-100});
 const after=drillDeck(pool,{seed:7,focus:readFocus(JSON.parse(JSON.stringify(f))),now:NOW});
 assert.deepEqual(counts(after),[1,4,1],'방금 맞힌 -습니다보다 틀린 -아요를 먼저');
 assert.equal(after[0].bin,'polite');assert.equal(new Set(after.map(c=>c.text)).size,6);
 assert.ok(!after.some(c=>formalDeck.some(prev=>prev.key===c.key)),'다른 검수 문장이 충분하면 최근 문장을 반복하지 않는다');
 assert.ok(after.every(c=>pool.some(approved=>approved.key===c.key)));
 const card=pool.find(c=>c.bin==='polite');
 for(let i=0;i<6;i++)f=recordDrillPick(f,card,'polite',{now:NOW-50+i});
 assert.deepEqual(drillWeights(f,{now:NOW}),{formal:0,polite:0,plain:0});
 assert.deepEqual(counts(drillDeck(pool,{seed:7,focus:f,now:NOW})),[2,2,2],'최근에 모두 맞힌 뒤에는 균형 있게');
 assert.ok(!JSON.stringify(f).includes(card.text),'문장 원문은 개인화 기록에 없다');
 assert.ok(f.practice.polite.length<=6&&f.recentCards.length<=12);
 const scarce=pool.filter(c=>c.bin==='plain').slice(0,2);
 assert.equal(drillDeck(scarce,{focus:f,size:6}).length,2,'보충할 콘텐츠가 없으면 중복으로 채우지 않는다');
});

test('혼자 다시 쓸 53번: 잡힌 문항·도움 본 문항을 빼고, 안 쓴 것 → 가장 오래전 것 · 없으면 null',()=>{
 const state=focusState(focusOf([{at:iso(NOW-HOUR),itemId:'w53-resale',kind:'found',plain:0,off:3,total:3}]),{now:NOW});
 const fifty3=open.filter(item=>item.type===53).map(item=>item.id);
 assert.equal(retryItem(open,{state}).id,fifty3.find(id=>id!=='w53-resale'));
 const drafts=Object.fromEntries(fifty3.map((id,i)=>[id,{checkedAt:iso(NOW-DAY),updatedAt:iso(NOW-(10-i)*HOUR)}]));
 assert.equal(retryItem(open,{state,drafts}).id,fifty3.filter(id=>id!=='w53-resale')[0],'모두 썼으면 가장 오래전에 쓴 것');
 const helped=Object.fromEntries(fifty3.map(id=>[id,{answer:iso(NOW-DAY)}]));
 assert.equal(retryItem(open,{state,drafts,helped}),null);
 assert.deepEqual(mySentences(formal+' 다음 해에는 더 많아요. 이 앱은 편리합니다.'),['2020년에는 300만 명이었습니다.','2022년에는 780만 명으로 늘었습니다.','앞으로도 늘 것으로 보입니다.']);
 assert.equal(endsPlain('2022년에는 780만 명으로 늘었다.'),true);assert.equal(endsPlain('늘었어요.'),false);assert.equal(endsPlain(''),false);
 assert.equal(sameBefore([{source:'rule-check',type:53,itemId:'w53-clinic',checks:['style']}],'w53-resale'),true);
 assert.equal(sameBefore([{source:'rule-check',type:53,itemId:'w53-resale',checks:['style']},{source:'rule-check',type:54,itemId:'w54-advice',checks:['style']}],'w53-resale'),false);
});

test('계획 경로: 고치는 중이면 Core가 53번 쓰기를 「처음에 놓친 부분」으로 먼저 고르고, 도움 받고 고치면 「도움과 함께」, 혼자 해내면 신호가 없다',async()=>{
 const [{createWorldEducation},{worldLearning},{createWorldLearningPlan},{worldPosition},{createLifeProgress},{PACKS,LESSONS}]=await Promise.all(['../world-learning-ui.mjs','../world-learning-map.mjs','../world-learning-plan.mjs','../world-position-kit.mjs','../life-progress.mjs','../life-content.mjs'].map(file=>import(file)));
 function fixture(events,helped={}){
  const storage=memory(),life=createLifeProgress({storage,owner:'guest'}),opened=[];life.summary(PACKS,LESSONS);
  life.updateLearningProfile({consent:true,expectedRevision:life.learningProfile().profile.revision,values:{reasons:['exam'],primaryReason:'exam',examType:'topik2',targetGrade:4,examDate:'2027-04',weeklyMinutes:120},today:{audio:'available'}});
  if(events)storage.setItem('synk.world.writing.v1:guest',JSON.stringify({drafts:{},log:[],mock:null,helped,focus:focusOf(events)}));
  const writingPractice={candidates:()=>writingCandidates({storage,owner:'guest'}),open:route=>opened.push(route),attempts:()=>readWritingSummary({storage,owner:'guest'}).times};
  const education=createWorldEducation({home:{updateStudy(){},toast(){},showPanel(){},closePanel(){}},getProgress:()=>life,engine:worldLearning,createPlan:createWorldLearningPlan,
   launchGame(){},startLesson(){},startReview(){},position:worldPosition,writingPractice,target:{localStorage:storage,addEventListener(){},removeEventListener(){},document:{querySelector:()=>null}}});
  return {education,opened};
 }
 const recent=iso(Date.now()-HOUR),ev=kind=>kind==='found'?[{at:recent,itemId:'w53-resale',kind,plain:0,off:3,total:3}]:[{at:iso(Date.now()-2*HOUR),itemId:'w53-resale',kind:'found',plain:0,off:3,total:3},{at:recent,itemId:'w53-resale',kind,plain:4,off:0,total:4}];
 const plain0=fixture(null).education.refresh();
 assert.ok(!(plain0.reasons||[]).some(reason=>reason.startsWith('activity.')),'기록이 없으면 지금과 같다');
 assert.equal(plain0.candidates.find(c=>c.routeId==='writing:53')?.practiceNeed,undefined);
 const found=fixture(ev('found')),plan=found.education.refresh();
 assert.equal(plan.selected.route,'writing');assert.equal(plan.selected.routeId,'writing:53');
 assert.ok(plan.reasons.includes('activity.retry'));assert.match(plan.reason,/처음에 놓친 부분을 다시 연습해 봐요/);
 assert.equal(plan.selected.minutes,5,'연습 전 단계의 어림 분');
 assert.equal(plan.examPlan.areas.find(row=>row.area==='writing').done,0,'연습 화면은 이번 주 쓰기 횟수가 아니다');
 await found.education.next();assert.deepEqual(found.opened,['writing:53'],'다음 활동이 53번 경로를 연다');
 const helped=fixture(ev('helped')).education.refresh();
 assert.ok(helped.reasons.includes('activity.assisted'));assert.match(helped.reason,/도움과 함께 해낸 부분이에요/);
 const alone=fixture([...ev('found'),{at:iso(Date.now()-60000),itemId:'w53-study-ways',kind:'independent',plain:4,off:0,total:4}]).education.refresh();
 // 혼자 다시 쓸 53번이 없으면(나머지 넷 모두 예시답을 봄) 도움 받고 고친 뒤로는 Core에 넘기지 않는다(Fable F3) — 은행을 읽은 앱에서.
 {const {loadWritingBank}=await import('../world-writing-practice.mjs');await loadWritingBank(async()=>({ok:true,json:async()=>bank}));
  const seen=Object.fromEntries(open.filter(i=>i.type===53&&i.id!=='w53-resale').map(i=>[i.id,{answer:iso(Date.now()-DAY)}]));
  const stuck=fixture(ev('helped'),seen).education.refresh();
  assert.ok(!(stuck.reasons||[]).some(reason=>reason.startsWith('activity.')),'혼자 다시 쓸 문항이 없으면 「도움과 함께」로 밀지 않는다');
  const stillFound=fixture(ev('found'),seen).education.refresh();
  assert.ok(stillFound.reasons.includes('activity.retry'),'원래 글을 고치는 일은 남아 있다');}
 assert.ok(!(alone.reasons||[]).some(reason=>reason.startsWith('activity.')));
 assert.equal(alone.candidates.find(c=>c.routeId==='writing:53').minutes,18);
 // 미래 시각 사건(기기 시계가 뒤로 간 경우)은 Core를 깨지 않는다.
 const skew=fixture([{at:iso(Date.now()+DAY),itemId:'w53-resale',kind:'found',plain:0,off:3,total:3}]).education.refresh();
 assert.ok(skew&&skew.selected,'추천이 그대로 선다');assert.ok(!(skew.reasons||[]).includes('activity.retry'));
 assert.deepEqual(WRITING_CANDIDATES.map(c=>c.minutes),[8,8,18,35,55],'고정 후보는 그대로');
});
