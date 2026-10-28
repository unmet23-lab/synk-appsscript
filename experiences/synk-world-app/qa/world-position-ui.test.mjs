import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildPositionMap,selectDiagnostic,createDiagnosticSession,estimateGate} from '../world-position.mjs';
import {createPositionView} from '../world-position-ui.mjs';
import STRINGS from '../../brand-opening/world-strings.mjs';
import {t,hasString,formatDate} from '../../brand-opening/world-lang.mjs';

const require=createRequire(import.meta.url);
const worldLearning=require('../../../atlas/game-browser.js');
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
let tick=Date.parse('2026-10-19T01:00:00Z');
const coach=()=>worldLearning.engine.createGame({gameId:'world-home',storage:memory(),clock:()=>new Date(tick+=1000).toISOString()});
const count=(html,pattern)=>(html.match(pattern)||[]).length;
// 화면은 world-lang.mjs의 t·has·formatDate를 넘긴다. 시험의 기본 언어는 한국어(원문)다.
const view=createPositionView({t,has:hasString,formatDate});
const english=createPositionView({t:(key,vars)=>t(key,vars,'en'),has:hasString,formatDate:(at,options)=>formatDate(at,options,'en')});
const mongolian=createPositionView({t:(key,vars)=>t(key,vars,'mn'),has:hasString,formatDate:(at,options)=>formatDate(at,options,'mn')});
const HANGUL=/[가-힣]/;

test('지연 확인 한 문항의 완료는 전체 새 문항 소진이나 일반 연습 더 하기로 표시하지 않는다',()=>{
 const result={skill:{id:'ko.reading.detail'},results:[{itemId:'fresh',verdict:'correct',independent:true}],followup:true,count:1};
 for(const [renderer,language]of [[view,'ko'],[english,'en'],[mongolian,'mn']])for(const more of [0,8]){
  const html=renderer.renderPracticeDone({...result,more});
  assert.ok(html.includes(STRINGS['followup.finished'][language]));
  assert.doesNotMatch(html,/data-practice-shortage|data-practice-again/);
  assert.match(html,/data-practice-position/);assert.match(html,/data-practice-home/);
 }
 assert.match(view.renderPracticeDone({...result,followup:false,more:0}),/data-practice-shortage/);
 assert.match(view.renderPracticeDone({...result,followup:false,more:8}),/data-practice-again/);
});

test('화면 글은 화면 언어 표(position.*)에서 읽고 {이름}을 채운다',()=>{
 assert.equal(t('position.summary',{independent:1,practicing:2,notyet:12,total:15}),'TOPIK I 15개 항목: 혼자 해냄 1 · 연습 중 2 · 아직 12');
 assert.equal(t('position.row',{total:16}),'TOPIK I 16개 항목과 짧은 진단','항목 수는 지도에서 온다(항목이 늘면 글도 따라간다)');
 for(const cell of ['independent','practicing','notyet'])assert.ok(STRINGS[`position.cell.${cell}`]);
 for(const status of ['recent-independent','practice','checking','supported','review','unseen'])assert.ok(STRINGS[`position.status.${status}`],status);
 assert.equal(view.itemSource('korean-runner.listening-check.check-star-middle.v1'),'바람길 듣기 확인');
 assert.equal(view.itemSource('korean-rhythm:t0q0:v1:claim0'),'말의 리듬','리듬 문항 열쇠는 쌍점으로 나뉜다');
 assert.equal(view.itemSource('synk-town.reading-check.town-reading-place.v1'),'싱크타운 읽기');
 assert.equal(view.itemSource('blank-slice.p01.v1','world-home'),'짧은 진단','진단에서 푼 답은 진단에서 왔다고 쓴다');
 assert.equal(view.itemSource('blank-slice.p01.v1','world-practice'),'짧은 연습','짧은 연습(읽기·듣기)에서 푼 답은 그 연습에서 왔다고 쓴다');
 assert.equal(view.itemSource('topik-items.ti-r-a-001.v1','world-mock'),'시험 형식 연습','시험 형식 연습(미니 모의)에서 푼 답은 그 연습에서 왔다고 쓴다');
 assert.equal(view.itemSource('unknown.thing'),'다른 연습');
 assert.throws(()=>createPositionView({}),TypeError,'t 없이는 그리지 않는다');
});

test('항목 이름 16개는 표의 한국어가 Strata 이름과 같고, 표에 없으면 Strata 이름 그대로',()=>{
 const strata=require('../../../strata/topik-i.skills.json').skills.filter(([id])=>/^ko\.(listening|reading)\./.test(id));
 assert.equal(strata.length,16);
 for(const [id,,label] of strata)assert.equal(STRINGS[`position.skill.${id}`]?.ko,label,id);
 assert.equal(view.skillName({id:'ko.reading.unknown',label:'새 항목'}),'새 항목');
 assert.equal(english.skillName({id:'ko.listening.detail',label:'듣고 세부 정보 찾기'}),'Listening for details');
});

test('판에는 16개 항목이 듣기 8·읽기 8로, 세 칸 수와 함께 그려진다',()=>{
 const c=coach(),map=buildPositionMap({summary:c.summary(),events:c.events()});
 const html=view.renderPositionBoard({map});
 assert.equal(count(html,/<details class="wpos-skill"/g),16);
 assert.equal(count(html,/data-cell="notyet"/g),16+1,'항목 16 + 세 칸 수의 「아직」');
 assert.match(html,/TOPIK I 16개 항목: 혼자 해냄 0 · 연습 중 0 · 아직 16/);
 assert.match(html,/<section class="wpos-group" data-domain="listening"><h3>듣기 <span>8<\/span>/);
 assert.match(html,/data-skill="ko.listening.response"[^>]*><summary><span class="wpos-skill-name">듣고 알맞게 대답하기/);
 assert.match(html,/<section class="wpos-group" data-domain="reading"><h3>읽기 <span>8<\/span>/);
 assert.doesNotMatch(html,/data-position-incomplete/);
 assert.doesNotMatch(html,/급수[는은] [0-9]|합격입니다|grade/i);
});

test('칸을 열면 근거(맞음·틀림·도움 받음, 날짜)가 보이고, 연습 이름 뒤의 문항 첫머리는 한국어 원문이며 글은 이스케이프된다',()=>{
 const c=coach();
 const ask=(id,correct,help)=>{const pid=c.present({id,itemKey:id,familyKey:id,skillId:'ko.reading.detail',modality:'reading',difficulty:1,responseFormat:'single-choice'});if(help)c.help(pid,help);c.answer(pid,{correct,assessable:true});};
 ask('entry-check.qa.1',true,'hint');
 const map=buildPositionMap({summary:c.summary(),events:c.events()});
 assert.equal(map.skills.find(skill=>skill.id==='ko.reading.detail').evidence[0].experienceId,'world-home');
 const catalog=key=>key==='entry-check.qa.1'?'"안내문" <첫 손님>':null;
 const html=view.renderPositionBoard({map,catalog});
 assert.match(html,/data-skill="ko\.reading\.detail" data-cell="practicing" data-status="supported"/);
 assert.match(html,/맞음 · 도움 받음/);
 assert.match(html,/짧은 진단 · <span lang="ko">&quot;안내문&quot; &lt;첫 손님&gt;<\/span>/);
 assert.doesNotMatch(html,/<첫 손님>/);
 assert.match(html,/<time datetime="2026-10-19T[0-9:.]+Z">10월 19일<\/time>/);
 // 화면 언어를 바꾸면 날짜·칸·근거 글이 그 언어로, 문항 첫머리는 한국어 그대로.
 const en=english.renderPositionBoard({map,catalog});
 assert.match(en,/>Oct 19<\/time>/);assert.match(en,/Right · With help/);assert.match(en,/Quick check · <span lang="ko">&quot;안내문&quot;/);
});

test('진단 칸: 준비된 문항 수, 모자란 항목, 소리 끈 날을 알리고 흰 알약은 하나',()=>{
 const c=coach(),summary=c.summary(),map=buildPositionMap({summary,events:c.events()});
 const items=[{id:'qa.r',itemKey:'qa.r',familyKey:'qa.r',skillId:'ko.reading.grammar',modality:'reading',difficulty:1,responseFormat:'single-choice'},
  {id:'qa.l',itemKey:'qa.l',familyKey:'qa.l',skillId:'ko.listening.detail',modality:'listening',difficulty:1,responseFormat:'single-choice',audioRequired:true}];
 const plan=selectDiagnostic({summary,items,seen:item=>c.exposure(item).seen,audioAvailable:false});
 const html=view.renderPositionBoard({map,plan});
 assert.match(html,/data-diagnostic="ready"/);assert.match(html,/처음 보는 문항 1개로 시작점을 정해요/);
 assert.match(html,/진단 문항이 아직 없는 항목 14개: 낱말 듣기 · /);
 assert.match(html,/소리를 끈 날이라 듣기 항목 1개는 빼요/);
 assert.equal(count(html,/class="felt-button"/g),1,'흰 알약은 한 화면에 하나');
 assert.match(english.renderPositionBoard({map,plan}),/1 question you haven’t seen before sets your starting point/,'영어 단수');
 const none=view.renderPositionBoard({map,plan:selectDiagnostic({summary,items:[],seen:()=>false})});
 assert.match(none,/data-diagnostic="unavailable"/);assert.doesNotMatch(none,/data-position-diagnostic/);
});

// 10-20 검수 #4: 지금 WORLD에는 TOPIK 형식 연습이 없어 근거가 쌓일 길이 없다 — 「0 / 30」 막대로 쌓이면 열린다고 약속하지 않는다.
test('예상 급수는 문턱 전에는 범위 없이 「아직 판단하기 일러요」만, 근거가 없으면 막대·「0 / 30」 없이 지금 할 수 있는 말만',()=>{
 const c=coach(),map=buildPositionMap({summary:c.summary(),events:c.events()});
 const gate=estimateGate({evidence:[],asOf:'2026-10-19T09:00:00.000Z'});
 const html=view.renderPositionBoard({map,gate}),estimate=html.slice(html.indexOf('data-estimate='));
 assert.match(html,/data-estimate="too-early"/);assert.match(html,/아직 판단하기 일러요/);assert.doesNotMatch(estimate,/0 \/ 30|wpos-estimate-count|class="wpos-bar"/,'예상 급수 칸에 막대·문턱 수가 없다');
 assert.match(html,/시험 형식 연습\(처음 보는 문항·실제 순서를 줄인 판·시간 제한\)에서 혼자 낸 첫 답만 모아요\. 범위를 읽는 방법을 검증하기 전에는 급수를 보이지 않아요/);
 assert.doesNotMatch(html,/쌓이면|곧 |준비 중/,'일정·출시를 약속하지 않는다');
 // 10-21 ④: 시험 형식 연습의 근거가 생기면 모은 수만(문턱 30 없이 — 수를 채우면 곧 급수가 나온다는 인상을 주지 않게, 3차 검수).
 const counted=view.renderPositionBoard({map,gate:{...gate,evidence:4,perDomain:{listening:1,reading:3}}});
 assert.match(counted,/모은 답 4개 · 듣기 1 · 읽기 3/);assert.doesNotMatch(counted,/\/ 30/);
 assert.match(view.renderPositionBoard({map,gate:estimateGate({evidence:[],asOf:'2026-10-19T09:00:00.000Z',mode:'ibt'})}),/data-estimate="mode-unsupported"[\s\S]*IBT는 문항 수·시간·점수 척도가 달라 PBT 형식 연습의 답으로 범위를 읽지 않아요/);
 assert.match(view.renderPositionBoard({map,gate,mock:{status:'ready',minutes:27}}),/data-position-mock>시험 형식 연습 · 27분/,'시험 형식 연습을 열 수 있으면 그 단추');
 assert.doesNotMatch(html,/[1-6]급(?! 근처)|합격입니다|grade/i,'급수·합격 판정 글이 없다(설명의 예시 「1급 근처」만)');
 assert.doesNotMatch(view.renderPositionBoard({map}),/data-estimate/,'문턱 결과가 없으면 칸이 없다');
});

test('한글 0인 사람의 판은 항목 지도 대신 한글 진도를 보인다',()=>{
 const html=view.renderHangulBoard({stage:{started:true,met:12,total:49,mastered:5,unitsDone:1,units:7,graduated:false,skipped:false}});
 assert.match(html,/data-position-board="hangul"/);assert.match(html,/만난 글자 12 \/ 49/);assert.match(html,/다 익힌 단원 1 \/ 7/);assert.match(html,/aria-valuenow="12"/);
 assert.match(html,/한글 만나기 이어 하기/);assert.doesNotMatch(html,/wpos-skill/);assert.match(html,/data-print="hangul"/);
 assert.match(view.renderHangulBoard({stage:{started:false,met:0,total:49,mastered:0,unitsDone:0,units:7}}),/아직 한글 만나기를 시작하지 않았어요[\s\S]*한글 만나기 시작하기/);
 assert.match(view.renderHangulBoard(),/한글 진도를 아직 읽지 못했어요/);
 assert.equal(count(html,/class="felt-button"/g),1);
});

test('진단 문항 화면은 끝까지 듣기 전에 보기를 막고, 끝 화면은 푼 것만 정오로 보인다',()=>{
 const c=coach(),item={id:'qa.listen',itemKey:'qa.listen',familyKey:'qa.listen',skillId:'ko.listening.detail',modality:'listening',difficulty:1,responseFormat:'single-choice',audioRequired:true,
  choices:[{id:'qa.listen.a',label:'가운데 길로 가기'},{id:'qa.listen.b',label:'왼쪽 길로 가기'}],correctId:'qa.listen.a'};
 const session=createDiagnosticSession({coach:c,items:[item]});const shown=session.next();
 const before=view.renderDiagnosticItem({view:shown,skill:{id:'ko.listening.detail'}});
 assert.equal(count(before,/data-position-choice="[^"]+" disabled/g),2);assert.match(before,/1 \/ 1/);assert.match(before,/끝까지 들은 뒤에 고를 수 있어요/);
 assert.match(before,/듣기 · 듣고 세부 정보 찾기/);
 assert.match(view.renderDiagnosticItem({view:shown,playing:true}),/data-position-listen aria-busy="true"[\s\S]*소리를 들려주고 있어요/);
 session.delivery('completed');
 const after=view.renderDiagnosticItem({view:session.current});
 assert.equal(count(after,/ disabled>/g),0);assert.match(after,/다 들은 뒤 다시 들으면 도움을 받은 답으로 기록해요/);
 session.answer('qa.listen.b');
 const done=view.renderDiagnosticDone({map:buildPositionMap({summary:c.summary(),events:c.events()}),results:session.results()});
 assert.match(done,/짧은 진단, 끝!/);assert.match(done,/푼 문항 1개 · 건너뛴 문항 0개/);assert.match(done,/<li data-verdict="incorrect" data-skill="ko.listening.detail">/);
 assert.match(done,/틀림 · 확인 중/);assert.match(done,/틀린 건 다음에 볼 자리예요/);assert.doesNotMatch(done,/data-position-practice/,'연습할 길을 모르면 단추가 없다');
 // 틀린 문항에는 해설을 접어 두고, 그 항목에 낼 연습이 있을 때만 「이 항목 연습하기」를 단다(10-20 검수 #2·#7).
 const explained=view.renderDiagnosticDone({map:buildPositionMap({summary:c.summary(),events:c.events()}),results:session.results(),
  items:new Map([[item.id,{...item,explanation:'가운데 길로 가라고 했어요.'}]]),practice:id=>id==='ko.listening.detail'});
 assert.match(explained,/<details class="wpos-explain"><summary>해설 보기<\/summary><p lang="ko">가운데 길로 가라고 했어요.<\/p><\/details>/);
 assert.match(explained,/data-position-practice="ko.listening.detail">이 항목 연습하기/);
});

test('입장 검사 문항은 안내문·날짜와 시각·표·짐·손님 말을 글로 보이고, 보기는 「들여보내기」와 규칙들이다',async()=>{
 const {DIAGNOSTIC_ITEMS}=await import('../world-diagnostic-items.mjs');
 const c=coach(),item=DIAGNOSTIC_ITEMS.find(row=>row.itemKey==='entry-check.pool-09.v1');
 const session=createDiagnosticSession({coach:c,items:[item]}),shown=session.next();
 const html=view.renderDiagnosticItem({view:shown,skill:{id:'ko.reading.detail'}});
 assert.match(html,/하늘 수영장 이용 안내/);assert.match(html,/<li>수영 모자를 꼭 써야 합니다\.<\/li>/);
 // 날짜는 게임 화면처럼 그날의 한국어 날짜(읽을 글)다 — 음악회 안내문은 날짜가 바뀐 날이 오늘인지가 판단 근거다(10-21 문항 검수).
 assert.match(html,/<p class="wpos-guest-time"><span lang="ko">8월 6일 수요일<\/span> · 지금 <span lang="ko">오후 2시 4분<\/span><\/p>/);assert.match(html,/<dt>구분<\/dt><dd>학생 · 15살<\/dd>/);assert.match(html,/짐: <span lang="ko">수건, 물병<\/span>/);
 assert.match(html,/이단비<\/span>「수건과 물은 있어요\. 수영 모자는 없어요\.」/);
 // 짐이 빈 손님(museum-11)도 「짐: 없음」을 보인다 — 게임처럼 없다는 것을 글로 보여야 카메라 규칙을 가를 수 있다(10-21 재검수).
 const empty=DIAGNOSTIC_ITEMS.find(row=>row.itemKey==='entry-check.museum-11.v1');
 const emptyHtml=view.renderDiagnosticItem({view:createDiagnosticSession({coach:coach(),items:[empty]}).next(),skill:{id:'ko.reading.condition'}});
 assert.match(emptyHtml,/짐: <span lang="ko">없음<\/span>/);
 assert.match(html,/data-position-choice="pass">들여보내기</);assert.match(html,/data-position-choice="reject-cap">돌려보내기 · 수영 모자</);
 assert.doesNotMatch(html,/ disabled>/,'읽기 문항은 바로 고를 수 있다');
 assert.doesNotMatch(html,/data-position-listen/);
 // 영어 화면에서도 안내문·손님·보기는 한국어 원문, 화면 글만 영어다.
 const en=english.renderDiagnosticItem({view:shown,skill:{id:'ko.reading.detail'}});
 assert.match(en,/Now <span lang="ko">오후 2시 4분<\/span>/);assert.match(en,/Bag: <span lang="ko">수건, 물병<\/span>/);assert.match(en,/Skip this question/);assert.match(en,/>들여보내기</);
 // 할 일을 말하는 지시(손님 들이기·빈칸 고르기)는 화면 언어로, 싱크타운 읽기의 물음은 읽을 내용이라 한국어 그대로.
 assert.match(html,/<p class="wpos-question">이 손님을 들여보낼까요\?<\/p>/);assert.match(en,/<p class="wpos-question">Should this guest come in\?<\/p>/);
 const town=DIAGNOSTIC_ITEMS.find(row=>row.source==='synk-town'),townView=createDiagnosticSession({coach:coach(),items:[town]}).next();
 assert.match(english.renderDiagnosticItem({view:townView}),new RegExp(`<p class="wpos-question" lang="ko">${town.question.replace(/[?.]/g,'\\$&')}</p>`));
});

test('영어·몽골어 판에는 학습 내용 밖의 한국어 글자가 없다',()=>{
 const c=coach(),summary=c.summary(),map=buildPositionMap({summary,events:c.events()});
 const items=[{id:'qa.r',itemKey:'qa.r',familyKey:'qa.r',skillId:'ko.reading.grammar',modality:'reading',difficulty:1,responseFormat:'single-choice'}];
 const plan=selectDiagnostic({summary,items,seen:item=>c.exposure(item).seen});
 const gate=estimateGate({evidence:[],asOf:'2026-10-19T09:00:00.000Z'});
 for(const [name,current] of [['en',english],['mn',mongolian]]){
  const pages=[current.renderPositionBoard({map,plan,gate,scope:'device'}),current.renderHangulBoard({stage:{started:true,met:3,total:49,mastered:0,unitsDone:0,units:7}}),current.renderHangulBoard()];
  for(const html of pages){
   const visible=html.replace(/<[^>]+lang="ko"[^>]*>[\s\S]*?<\/[a-z]+>/g,'').replace(/<[^>]+>/g,' ');
   assert.doesNotMatch(visible,HANGUL,`${name}: ${visible.match(/[^ ]*[가-힣][^ ]*/)?.[0]}`);
  }
 }
});

// 10-21 아르곤 검수 반영(④ 시험 형식 연습).
test('시험 형식 연습 문항: 마치기 확인은 답하지 않은 문항이 남았을 때만 · 세트 문항은 같은 내용으로 푸는 번호를 알린다',()=>{
 const item={id:'qa.m',itemKey:'topik-items.qa-m.v1',skillId:'ko.listening.main',modality:'listening',audio:'topik-items/audio/qa.mp3',setId:'qa-set',
  question:'알맞은 것을 고르십시오.',choices:[{id:'a',label:'가'},{id:'b',label:'나'}],correctId:'a'};
 const now={section:'listening',partIndex:0,parts:2,index:0,total:2,item,heard:true,audio:'completed',plays:{allowed:2,completed:1},answered:false,choiceId:null,
  started:true,deadline:0,remainingMs:60000,set:{first:1,last:2},marks:['opened','answered'],sets:['qa-set','qa-set']};
 const open=view.renderMockItem({view:now,confirm:true});
 assert.match(open,/data-mock-confirm/);assert.match(open,/답하지 않은 문항이 1개/);
 const done=view.renderMockItem({view:{...now,answered:true,choiceId:'a',marks:['answered','answered']},confirm:true});
 assert.doesNotMatch(done,/data-mock-confirm/,'마지막 문항에 답하면 「0개 남았어요」 확인창을 남기지 않는다');assert.match(done,/data-mock-submit/);
 assert.match(open,/data-mock-set>1~2번은 같은 내용을 듣고 풀어요\. 들은 횟수도 함께 세요\./);
 assert.match(english.renderMockItem({view:now}),/data-mock-set>Questions 1–2 use the same recording/);
 const reading={...now,section:'reading',item:{...item,modality:'reading',audio:null,prompt:'지문입니다.'}};
 assert.match(view.renderMockItem({view:reading}),/data-mock-set>1~2번은 같은 글을 읽고 풀어요\./);
 assert.doesNotMatch(view.renderMockItem({view:{...now,set:null}}),/data-mock-set/,'세트가 아니면 알리지 않는다');
});

// 10-21 Fable 검수 반영(④ 시험 형식 연습 · 예상 급수).
test('IBT 학생: 예상 급수 칸에 모은 답 수를 보이지 않고, 시험 형식 연습 끝 안내도 예상 급수 근거를 말하지 않는다 · 모의 보기는 모두 눌림 상태를 가진다',()=>{
 const rows=n=>Array.from({length:n},(_,i)=>({eventId:`qa.e.${i}`,at:'2026-10-20T09:00:00.000Z',domain:i%2?'reading':'listening',firstExposure:true,independent:true,timed:true,verdict:'correct',form:'topik-i',composition:'mini-blueprint',mode:'pbt'}));
 const c=coach(),map=buildPositionMap({summary:c.summary(),events:c.events()});
 const ibt=view.renderPositionBoard({map,gate:estimateGate({evidence:rows(4),asOf:'2026-10-21T09:00:00.000Z',mode:'ibt'})});
 assert.match(ibt,/data-estimate="mode-unsupported"/);assert.doesNotMatch(ibt,/wpos-estimate-count/);
 assert.match(view.renderPositionBoard({map,gate:estimateGate({evidence:rows(4),asOf:'2026-10-21T09:00:00.000Z'})}),/wpos-estimate-count/,'PBT 학생에게는 모은 수를 보인다');
 assert.doesNotMatch(view.renderMockDone({results:[],exam:'topik1',mode:'ibt'}),/예상 급수/);
 assert.match(view.renderMockDone({results:[],exam:'topik1'}),/예상 급수 칸의 근거로도 모아요/);
 const item={id:'qa.m',itemKey:'topik-items.qa-m.v1',skillId:'ko.reading.main',modality:'reading',question:'알맞은 것을 고르십시오.',choices:[{id:'a',label:'가'},{id:'b',label:'나'}],correctId:'a'};
 const html=view.renderMockItem({view:{section:'reading',partIndex:0,parts:1,index:0,total:1,item,heard:true,audio:'none',plays:{allowed:null,completed:0},answered:true,choiceId:'a',started:true,deadline:0,remainingMs:60000,set:null,marks:['answered']}});
 assert.equal(count(html,/aria-pressed="true"/g),1);assert.equal(count(html,/aria-pressed="false"/g),1);
});
