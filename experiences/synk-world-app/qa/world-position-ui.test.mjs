import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildPositionMap,selectDiagnostic,createDiagnosticSession} from '../world-position.mjs';
import {POSITION_TEXT,say,itemSource,renderPositionBoard,renderHangulBoard,renderDiagnosticItem,renderDiagnosticDone} from '../world-position-ui.mjs';

const require=createRequire(import.meta.url);
const worldLearning=require('../../../atlas/game-browser.js');
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
let tick=Date.parse('2026-10-19T01:00:00Z');
const coach=()=>worldLearning.engine.createGame({gameId:'world-home',storage:memory(),clock:()=>new Date(tick+=1000).toISOString()});
const count=(html,pattern)=>(html.match(pattern)||[]).length;

test('화면 글은 한곳의 표에 있고 {이름}을 채운다',()=>{
 assert.equal(say('position.summary',{independent:1,practicing:2,notyet:12}),'TOPIK I 15개 항목: 혼자 해냄 1 · 연습 중 2 · 아직 12');
 assert.equal(say('position.cell.notyet'),'아직');
 for(const cell of ['independent','practicing','notyet'])assert.ok(POSITION_TEXT[`position.cell.${cell}`]);
 for(const status of ['recent-independent','practice','checking','supported','review','unseen'])assert.ok(POSITION_TEXT[`position.status.${status}`],status);
 assert.equal(itemSource('korean-runner.listening-check.check-star-middle.v1'),'바람길 듣기 확인');
 assert.equal(itemSource('unknown.thing'),'다른 연습');
 assert.ok(Object.isFrozen(POSITION_TEXT));
});

test('판에는 15개 항목이 듣기 7·읽기 8로, 세 칸 수와 함께 그려진다',()=>{
 const c=coach(),map=buildPositionMap({summary:c.summary(),events:c.events()});
 const html=renderPositionBoard({map});
 assert.equal(count(html,/<details class="wpos-skill"/g),15);
 assert.equal(count(html,/data-cell="notyet"/g),15+1,'항목 15 + 세 칸 수의 「아직」');
 assert.match(html,/TOPIK I 15개 항목: 혼자 해냄 0 · 연습 중 0 · 아직 15/);
 assert.match(html,/<section class="wpos-group" data-domain="listening"><h3>듣기 <span>7<\/span>/);
 assert.match(html,/<section class="wpos-group" data-domain="reading"><h3>읽기 <span>8<\/span>/);
 assert.doesNotMatch(html,/data-position-incomplete/);
 assert.doesNotMatch(html,/급수[는은] [0-9]|합격입니다|grade/i);
});

test('칸을 열면 근거(맞음·틀림·도움 받음, 날짜)가 보이고, 글은 이스케이프된다',()=>{
 const c=coach();
 const ask=(id,correct,help)=>{const pid=c.present({id,itemKey:id,familyKey:id,skillId:'ko.reading.detail',modality:'reading',difficulty:1,responseFormat:'single-choice'});if(help)c.help(pid,help);c.answer(pid,{correct,assessable:true});};
 ask('entry-check.qa.1',true,'hint');
 const map=buildPositionMap({summary:c.summary(),events:c.events()});
 map.skills.find(skill=>skill.id==='ko.reading.detail').label='<script>읽고</script>';
 const html=renderPositionBoard({map,catalog:key=>key==='entry-check.qa.1'?'입장 검사 · "안내문" <첫 손님>':null});
 assert.match(html,/data-skill="ko\.reading\.detail" data-cell="practicing" data-status="supported"/);
 assert.match(html,/맞음 · 도움 받음/);
 assert.match(html,/입장 검사 · &quot;안내문&quot; &lt;첫 손님&gt;/);
 assert.match(html,/&lt;script&gt;읽고&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);
 assert.match(html,/<time datetime="2026-10-19T[0-9:.]+Z">10월 19일<\/time>/);
});

test('진단 칸: 준비된 문항 수, 모자란 항목, 소리 끈 날을 알린다',()=>{
 const c=coach(),summary=c.summary(),map=buildPositionMap({summary,events:c.events()});
 const items=[{id:'qa.r',itemKey:'qa.r',familyKey:'qa.r',skillId:'ko.reading.grammar',modality:'reading',difficulty:1,responseFormat:'single-choice'},
  {id:'qa.l',itemKey:'qa.l',familyKey:'qa.l',skillId:'ko.listening.detail',modality:'listening',difficulty:1,responseFormat:'single-choice',audioRequired:true}];
 const plan=selectDiagnostic({summary,items,seen:item=>c.exposure(item).seen,audioAvailable:false});
 const html=renderPositionBoard({map,plan});
 assert.match(html,/data-diagnostic="ready"/);assert.match(html,/처음 보는 문항 1개로 시작점을 정해요/);
 assert.match(html,/진단 문항이 아직 없는 항목 13개: /);
 assert.match(html,/소리를 끈 날이라 듣기 항목 1개는 빼요/);
 assert.equal(count(html,/class="felt-button"/g),1,'흰 알약은 한 화면에 하나');
 const none=renderPositionBoard({map,plan:selectDiagnostic({summary,items:[],seen:()=>false})});
 assert.match(none,/data-diagnostic="unavailable"/);assert.doesNotMatch(none,/data-position-diagnostic/);
});

test('한글 0인 사람의 판은 항목 지도 대신 한글 진도를 보인다',()=>{
 const html=renderHangulBoard({progress:{done:3,total:14}});
 assert.match(html,/data-position-board="hangul"/);assert.match(html,/한글 만나기 3 \/ 14/);assert.match(html,/aria-valuenow="3"/);
 assert.doesNotMatch(html,/wpos-skill/);
 assert.match(renderHangulBoard(),/한글 진도를 아직 읽지 못했어요/);
});

test('진단 문항 화면은 끝까지 듣기 전에 보기를 막고, 끝 화면은 푼 것만 정오로 보인다',()=>{
 const c=coach(),item={id:'qa.listen',itemKey:'qa.listen',familyKey:'qa.listen',skillId:'ko.listening.detail',modality:'listening',difficulty:1,responseFormat:'single-choice',audioRequired:true,
  choices:[{id:'qa.listen.a',label:'가운데 길로 가기'},{id:'qa.listen.b',label:'왼쪽 길로 가기'}],correctId:'qa.listen.a'};
 const session=createDiagnosticSession({coach:c,items:[item]});const view=session.next();
 const before=renderDiagnosticItem({view,skillLabel:'듣고 세부 정보 찾기'});
 assert.equal(count(before,/data-position-choice="[^"]+" disabled/g),2);assert.match(before,/1 \/ 1/);assert.match(before,/끝까지 들은 뒤에 고를 수 있어요/);
 session.delivery('completed');
 const after=renderDiagnosticItem({view:session.current,skillLabel:'듣고 세부 정보 찾기'});
 assert.equal(count(after,/ disabled>/g),0);assert.match(after,/다 들은 뒤 다시 들으면 도움을 받은 답으로 기록해요/);
 session.answer('qa.listen.b');
 const done=renderDiagnosticDone({map:buildPositionMap({summary:c.summary(),events:c.events()}),results:session.results()});
 assert.match(done,/짧은 진단, 끝!/);assert.match(done,/푼 문항 1개 · 건너뛴 문항 0개/);assert.match(done,/<li data-verdict="incorrect">/);
});

test('입장 검사 문항은 안내문·시각·표·짐·손님 말을 글로 보이고, 보기는 「들여보내기」와 규칙들이다',async()=>{
 const {DIAGNOSTIC_ITEMS}=await import('../world-diagnostic-items.mjs');
 const c=coach(),item=DIAGNOSTIC_ITEMS.find(row=>row.itemKey==='entry-check.pool-09.v1');
 const session=createDiagnosticSession({coach:c,items:[item]}),view=session.next();
 const html=renderDiagnosticItem({view,skillLabel:'읽고 세부 정보 찾기'});
 assert.match(html,/하늘 수영장 이용 안내/);assert.match(html,/<li>수영 모자를 꼭 써야 합니다\.<\/li>/);
 assert.match(html,/지금 14:04/);assert.match(html,/<dt>구분<\/dt><dd>학생 · 15살<\/dd>/);assert.match(html,/짐: 수건, 물병/);
 assert.match(html,/이단비<\/span>「수건과 물은 있어요\. 수영 모자는 없어요\.」/);
 assert.match(html,/data-position-choice="pass">들여보내기</);assert.match(html,/data-position-choice="reject-cap">돌려보내기 · 수영 모자</);
 assert.doesNotMatch(html,/ disabled>/,'읽기 문항은 바로 고를 수 있다');
 assert.doesNotMatch(html,/data-position-listen/);
});
