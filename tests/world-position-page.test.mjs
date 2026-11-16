// 「내 위치」 2판(experiences/synk-world-app/world-position-page.mjs, 11-16) — 볼로르 시연 기록으로 이야기 · 지도 · 접힌 묶음을 고정하고,
// 옛 판(계정 묶음 world-position-ui.mjs)이 그린 묶음과 단추 자리(data-position-*)를 잃지 않는지, 세 언어 글이 빠짐없이 서는지 본다.
// 판단은 하지 않는 모듈이라 여기서도 엔진 사실(world-position · world-missed-spot)은 바꾸지 않고 그림만 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {renderPositionPage,legacyParts} from '../experiences/synk-world-app/world-position-page.mjs';
import {buildMissedSpot} from '../experiences/synk-world-app/world-missed-spot.mjs';
import {buildPositionMap,selectDiagnostic,estimateGate} from '../experiences/synk-world-app/world-position.mjs';
import {createPositionView} from '../experiences/synk-world-app/world-position-ui.mjs';
import STRINGS from '../experiences/brand-opening/world-strings.mjs';
import {t,hasString,formatDate} from '../experiences/brand-opening/world-lang.mjs';
import {caseMetadata} from '../experiences/entry-check/learning.mjs';
import {VENUES} from '../experiences/entry-check/content.mjs';

const require=createRequire(import.meta.url);
const {createGame}=require('../atlas/game-learning.js');
const {createMap}=require('../strata');
const {worldMapData}=require('../strata/world-map.js');

// 볼로르(시험용 가상 학생) — 입장 검사 응답 11개(tests/world-missed-spot.test.mjs RECORDED와 같다).
const RECORDED=[['pool-01 pass true 혼자','pool-02 pass false 혼자','pool-10 pass false 혼자','pool-13 pass true 혼자','pool-04 cap true 도움','pool-05 kid true 혼자'],
 ['library-01 pass true 혼자','library-02 card true 도움','library-10 pass true 혼자','library-03 pass true 혼자','library-06 food true 혼자']];
const CASES=new Map(VENUES.flatMap(venue=>venue.cases.map(item=>[item.id,item])));
const option=value=>value==='pass'?'pass':`reject-${value}`;
const NEG='ko.reading.negation';
function bolor(parts=RECORDED){
 let at=Date.parse('2026-11-14T03:18:00+09:00');const memory=new Map();
 const storage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)};
 const game=createGame({gameId:'entry-check',map:createMap(worldMapData()),storage,clock:()=>new Date(at).toISOString()});
 parts.forEach((lines,part)=>{if(part)at+=6*60000;for(const line of lines){const [id,picked,ok,how]=line.split(' '),item=CASES.get(id);
  at+=4000;const pid=game.present(caseMetadata(item));if(how==='도움')game.help(pid,'replay');at+=3000;
  game.answer(pid,{correct:ok==='true',assessable:true,choice:{selectedId:option(picked),correctId:option(item.answer)}});}});
 const summary=game.summary(),events=game.events(),map=buildPositionMap({summary,events,exam:'topik1'});
 return {summary,events,map,card:buildMissedSpot({map,summary,events,now:at+86400000,practiceOpen:()=>true})};
}
const langs={ko:{t,has:hasString,formatDate},en:{t:(k,v)=>t(k,v,'en'),has:hasString,formatDate:(a,o)=>formatDate(a,o,'en')},mn:{t:(k,v)=>t(k,v,'mn'),has:hasString,formatDate:(a,o)=>formatDate(a,o,'mn')}};
const legacyOf=(run,lang='ko',extra={})=>createPositionView(langs[lang]).renderPositionBoard({map:run.map,practice:()=>({route:'practice'}),scope:'device',...extra});
const practice=id=>id===NEG?{route:'practice'}:null;
const page=(run,lang='ko',extra={})=>renderPositionPage({map:run.map,legacy:legacyOf(run,lang,extra.legacyExtra),card:run.card,practice,...langs[lang],...extra});
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();

test('볼로르: 놓친 곳 이야기가 판 맨 위에 서고, 그 안내문을 두 번 놓친 뒤 다음에 만난 새 손님을 혼자 막은 줄이 읽힌다',()=>{
 const run=bolor(),html=page(run);
 assert.match(html,/^<div class="wpos wpv life-heading" data-position-board data-exam="topik1" tabindex="-1">/);
 const story=html.slice(html.indexOf('<section class="wpv-story"'),html.indexOf('</section>',html.indexOf('<section class="wpv-story"')));
 const said=text(story);
 for(const line of ['놓친 곳','TOPIK I · 읽기','읽고 부정·변경 이해하기','손님 4명 가운데 2명을 놓쳤어요','이 안내문 줄에서 2번 놓쳤어요','입장 검사 · 하늘 수영장','음식은 가지고 들어갈 수 없습니다. 물은 괜찮습니다.',
  '놓침 막아야 할 손님을 들여보냈어요','그 자리 바로 뒤에 같은 규칙 손님 2명이 이어서 왔어요. 1명은 또 놓쳤고, 1명은 혼자 맞혔어요','나중에 다시 다음에 만난 같은 종류의 새 손님은 혼자 막았어요',
  '1 · 7 · 30일 다음 차례 짧은 연습을 한 번 풀면, 그날부터 1일 · 7일 · 30일 뒤에 새 문항으로 다시 확인해요','이 항목 연습하기'])assert.ok(said.includes(line),line);
 // 줄 차례와 상태: 녹화 도구가 읽는 .wmis-again li[data-step][data-state]
 assert.deepEqual([...story.matchAll(/<li data-step="(\w+)" data-state="(\w+)"/g)].map(m=>`${m[1]}:${m[2]}`),['miss:done','spot:done','again:done','delayed:planned']);
 assert.match(story,/<ol class="wmis-again wpv-steps"/);
 // 그 항목 손님 4명을 시각 차례로: ✗ ✗ ✓ ✓ — 화면 읽기는 머리 수 문장
 assert.match(story,/<span class="wpv-marks" aria-hidden="true"><i data-verdict="incorrect"><\/i><i data-verdict="incorrect"><\/i><i data-verdict="correct"><\/i><i data-verdict="correct"><\/i><\/span>/);
 // 강조색 한 곳: 혼자 막은 「나중에 다시」만
 assert.equal((story.match(/data-win/g)||[]).length,1);assert.match(story,/data-step="again" data-state="done" data-win/);
 // 학습 내용(안내문 · 근무지)은 한국어 원문 표시
 assert.match(story,/<blockquote lang="ko">음식은 가지고 들어갈 수 없습니다\. 물은 괜찮습니다\.<\/blockquote>/);assert.match(story,/<span lang="ko">하늘 수영장<\/span>/);
 // 주 단추 하나(옛 판과 같은 자리 data-position-practice)
 assert.equal((html.match(/class="wpv-go"/g)||[]).length,1);assert.match(story,/<button class="wpv-go" type="button" data-position-practice="ko\.reading\.negation">/);
 // 흰 알약은 이야기 끝의 감싸는 칸 안에 있다 — 글이 긴 언어에서 그 칸이 화면 아래에 붙어 따라온다(다음 판 P3)
 assert.match(story,/<div class="wpv-go-bar"><button class="wpv-go"[^]*?<\/button><\/div>$/);
 // 급수 · 합격 · 「약점」 말 없음
 assert.doesNotMatch(text(html),/약점|합격|급 근처|점수/);
});

test('볼로르: 항목 지도는 칸 16개 — 빈 칸 13 · 반 칸 3 · 찬 칸 0, 놓친 곳 항목에 테, 칸마다 이름과 상태를 읽어 준다',()=>{
 const run=bolor(),html=page(run);
 const map=html.slice(html.indexOf('<section class="wpv-map"'),html.indexOf('</section>',html.indexOf('<section class="wpv-map"')));
 assert.match(map,/<h3 id="wpv-map-title">TOPIK I 항목 16개<\/h3>/);
 assert.match(map,/<li data-cell="independent"><i aria-hidden="true"><\/i><b>0<\/b><span>혼자 해냄<\/span><\/li><li data-cell="practicing"><i aria-hidden="true"><\/i><b>3<\/b><span>연습 중<\/span><\/li><li data-cell="notyet"><i aria-hidden="true"><\/i><b>13<\/b><span>아직<\/span><\/li>/);
 const cells=[...map.matchAll(/<li data-skill="([^"]+)" data-cell="(\w+)"/g)];
 assert.equal(cells.length,16);
 assert.deepEqual(cells.filter(m=>m[2]==='practicing').map(m=>m[1]),['ko.reading.detail',NEG,'ko.reading.condition']);
 assert.equal((map.match(/data-cell="\w+" data-missed/g)||[]).length,1);assert.match(map,/<li data-skill="ko\.reading\.negation" data-cell="practicing" data-missed><span class="wpv-sr">읽고 부정·변경 이해하기 · 연습 중 · 놓친 곳<\/span><\/li>/);
 assert.doesNotMatch(map,/role="img"/);
 assert.match(map,/<div class="wpv-row" data-domain="listening"><span>듣기<\/span><ol style="--n:8">/);
 // 이야기 → 지도 차례(카본 맹검이 두 쌍 모두 고른 판), 범례 끝에 놓친 곳 테
 assert.ok(html.indexOf('wpv-story')<html.indexOf('wpv-map'));
 assert.match(map,/<li data-missed><i aria-hidden="true"><\/i><span>놓친 곳<\/span><\/li><\/ul>/);
});

test('옛 판 묶음을 잃지 않는다: 항목별 근거 16줄은 접힌 목록에, 짧은 진단 · 예상 급수 · 기록 범위 · 단추 자리는 그대로, 영문 머리 라벨은 뺀다',()=>{
 const run=bolor(),plan=selectDiagnostic({summary:run.summary,items:[],seen:()=>false,audioAvailable:true,exam:'topik1'});
 const gate=estimateGate({evidence:[],asOf:new Date().toISOString(),form:'topik1-pbt',mode:null});
 const legacy=legacyOf(run,'ko',{plan,gate}),parts=legacyParts(legacy);
 assert.equal(parts.groups.length,2);assert.ok(parts.estimate);assert.ok(parts.scope);assert.ok(parts.diagnostic);assert.equal(parts.incomplete,'');
 const html=renderPositionPage({map:run.map,legacy,card:run.card,practice,...langs.ko});
 assert.equal((html.match(/<details class="wpos-skill"/g)||[]).length,16);
 assert.match(html,/<details class="wpv-fold" data-position-list><summary><span>항목별로 자세히 보기<\/span><small>16개<\/small><\/summary>/);
 assert.ok(html.indexOf('data-position-list')>html.indexOf('wpv-map'),'목록은 지도 아래');
 // 예상 급수는 한 줄 접힘: 머리에 제목과 지금 상태, 근거 설명은 펼치면
 assert.match(html,/<details class="wpv-fold wpv-estimate"><summary><span>예상 급수<\/span><small>아직 판단하기 일러요<\/small><\/summary><div class="wpv-fold-body"><section class="wpos-estimate"/);
 assert.equal((html.match(/예상 급수/g)||[]).length,1);
 assert.match(html,/<p class="wpos-scope">이 기기의 학습 기록으로 보여요/);
 assert.ok(html.indexOf('wpos-scope')>html.indexOf('wpos-estimate'),'기록 범위는 판 끝');
 assert.match(html,/<div data-position-followups><\/div>/);
 assert.doesNotMatch(html,/MISSED SPOT|LOOK FIRST|QUICK CHECK|ESTIMATE|MY POSITION/);
 // 놓친 곳이 짚은 항목은 「먼저 볼 항목」에서 뺀다(그 항목뿐이면 묶음째)
 assert.doesNotMatch(html,/data-position-attention/);
});

test('놓친 곳이 없으면: 기록이 하나도 없는 학생은 짧은 진단이 맨 위, 기록은 있는데 놓친 곳이 없으면 먼저 볼 항목이 맨 위',()=>{
 const empty={exam:'topik1',total:2,counts:{independent:0,practicing:0,notyet:2},evidenceComplete:true,attention:[],skills:[{id:'ko.listening.word',label:'낱말 듣기',domain:'listening',cell:'notyet'},{id:'ko.reading.detail',label:'읽고 세부 정보 찾기',domain:'reading',cell:'notyet'}]};
 const legacy='<div class="wpos"><section class="wpos-diagnostic" data-diagnostic="ready"><p class="life-section-label">QUICK CHECK</p><h3>짧은 진단</h3><button class="felt-button" type="button" data-position-diagnostic>짧은 진단 시작하기</button></section><section class="wpos-group" data-domain="listening"><h3>듣기</h3></section></div>';
 const first=renderPositionPage({map:empty,legacy,...langs.ko});
 assert.doesNotMatch(first,/wpv-story/);assert.match(first,/<div class="wpv-lead"><section class="wpos-diagnostic" data-diagnostic="ready"><h3>짧은 진단<\/h3><button class="felt-button" type="button" data-position-diagnostic>/);
 assert.equal((first.match(/data-position-diagnostic/g)||[]).length,1,'짧은 진단은 한 번만');
 assert.ok(first.indexOf('wpv-lead')<first.indexOf('wpv-map'));
 const seen={...empty,attention:['ko.reading.detail'],counts:{independent:0,practicing:1,notyet:1},skills:[empty.skills[0],{...empty.skills[1],cell:'practicing'}]};
 const att='<section class="wpos-attention" data-position-attention><p class="life-section-label">LOOK FIRST</p><h3>먼저 볼 항목</h3><ul><li data-skill="ko.reading.detail"><span>x</span></li></ul></section>';
 const second=renderPositionPage({map:seen,legacy:legacy.replace('<section class="wpos-group"',att+'<section class="wpos-group"'),...langs.ko});
 assert.match(second,/<div class="wpv-lead"><section class="wpos-attention" data-position-attention><h3>먼저 볼 항목<\/h3>/);
 assert.ok(second.indexOf('wpv-lead')<second.indexOf('wpv-map'));assert.ok(second.indexOf('wpv-map')<second.indexOf('wpos-diagnostic'));
 assert.equal((second.match(/data-position-attention/g)||[]).length,1);
});

test('좁혀 짚기가 일부일 때와 없을 때: 「놓친 n번 가운데 m번」, 안내문 줄이 없으면 머리 수가 큰 한 줄이고 종이 · 놓침 줄을 두지 않는다',()=>{
 const run=bolor(),card=structuredClone(run.card);
 card.narrow=card.narrow.map(row=>row.layer==='line'?{...row,count:2,of:3}:row.layer==='direction'?{...row,count:2,of:3}:row);
 const some=text(renderPositionPage({map:run.map,legacy:'',card,practice,...langs.ko}));
 assert.ok(some.includes('놓친 3번 가운데 2번이 이 안내문 줄이에요'));assert.ok(some.includes('막아야 할 손님을 2번 들여보냈어요 (놓친 3번 중 2번)'));
 const bare={...card,narrow:card.narrow.filter(row=>row.layer==='skill')};
 const plain=renderPositionPage({map:run.map,legacy:'',card:bare,practice:()=>null,...langs.ko});
 assert.match(plain,/<h3 class="wpv-headline" id="wpv-story-title">손님 4명 가운데 2명을 놓쳤어요<\/h3>/);
 assert.doesNotMatch(plain,/wpv-notice|data-step="miss"|wpv-go/);
 // 근거 일부가 접혔으면 표식 줄 끝에 「+n」
 const run2=bolor(),folded={...run2.map,skills:run2.map.skills.map(skill=>skill.id===NEG?{...skill,folded:2}:skill)};
 assert.match(renderPositionPage({map:folded,legacy:'',card:run2.card,...langs.ko}),/<span class="wpv-marks" aria-hidden="true"><b>\+2<\/b><i data-verdict="incorrect">/);
 // 열 개를 넘으면 최근 열 개만 찍고 잘라 낸 수를 「+n」에 더한다(카본 A3)
 const many={...run2.map,skills:run2.map.skills.map(skill=>skill.id===NEG?{...skill,folded:0,evidence:Array.from({length:12},(_,i)=>({verdict:i<2?'incorrect':'correct',at:new Date(Date.UTC(2026,10,1,0,i)).toISOString()}))}:skill)};
 const cut=renderPositionPage({map:many,legacy:'',card:run2.card,...langs.ko});
 assert.match(cut,/<span class="wpv-marks" aria-hidden="true"><b>\+2<\/b>(<i data-verdict="correct"><\/i>){10}<\/span>/);
 const once={...bare,narrow:[{...bare.narrow[0],count:1,of:1}],again:[]};
 assert.match(renderPositionPage({map:run.map,legacy:'',card:once,...langs.ko}),/>한 번 놓쳤어요\. 아직 확인하는 중이에요<\/h3>/);
});

test('세 언어: 이야기 · 지도 글이 열쇠 그대로 새지 않고, 영어는 하나일 때 단수, 안내문은 어느 언어에서도 한국어 원문',()=>{
 const run=bolor();
 for(const lang of ['ko','en','mn']){
  const html=page(run,lang);
  assert.doesNotMatch(html,/position\.(story|map|list|missed|cell|domain)\./,lang);
  assert.match(html,/<blockquote lang="ko">음식은 가지고 들어갈 수 없습니다\. 물은 괜찮습니다\.<\/blockquote>/,lang);
 }
 const en=text(page(run,'en'));
 for(const line of ['You missed this notice line 2 times','You let in a guest who should have been stopped','Right after, 2 guests came in a row under the same rule. You missed 1 again and got 1 right on your own','The next new guest of the same kind, you stopped on your own','TOPIK I · 16 skills'])assert.ok(en.includes(line),line);
 assert.equal(t('position.story.lineAll',{n:1},'en'),'You missed this notice line once');
 const mn=text(page(run,'mn'));assert.ok(mn.includes('Зарын энэ мөрөнд 2 удаа алдсан байна'));
 // 새 열쇠는 세 언어가 다 있다
 for(const [key,row] of Object.entries(STRINGS).filter(([key])=>/^position\.(story|map|list)\./.test(key)))for(const lang of ['ko','en','mn'])assert.ok(row[lang],`${key} ${lang}`);
});

test('카본 A1 · A2 · A6: 바로 다음 손님을 다 맞히면 「모두」 꼴, 다시 확인 줄도 완결된 문장, 다음 차례는 한 번만 읽힌다',()=>{
 const run=bolor(),card=structuredClone(run.card),spot=card.again.find(row=>row.step==='spot');
 Object.assign(spot,{guests:1,right:1,eventIds:['next-1']});
 const one=text(renderPositionPage({map:run.map,legacy:'',card,practice,...langs.ko}));
 assert.ok(one.includes('바로 다음에 같은 규칙 손님 1명이 왔고, 혼자 맞혔어요'),one);
 // 바로 뒤 손님이 놓친 근거와 겹치지 않으면 놓침 줄은 수를 그대로 말한다(겹치면 첫 놓침만 — 볼로르)
 assert.ok(one.includes('막아야 할 손님을 2번 들여보냈어요'),one);
 assert.ok(text(renderPositionPage({map:run.map,legacy:'',card,practice,...langs.en})).includes('Right after, 1 guest came under the same rule, and you got it right on your own'));
 Object.assign(spot,{guests:3,right:3,eventIds:['next-1','next-2','next-3']});
 assert.ok(text(renderPositionPage({map:run.map,legacy:'',card,practice,...langs.ko})).includes('바로 다음에 같은 규칙 손님 3명이 왔고, 모두 혼자 맞혔어요'));
 const delayed=card.again.find(row=>row.step==='delayed');
 Object.assign(delayed,{observed:1,due:false,dueAt:'2026-11-21T00:00:00Z'});
 const later=text(renderPositionPage({map:run.map,legacy:'',card,practice,...langs.ko}));
 assert.match(later,/1번 다시 확인했어요\. 11월 21일에 새 문항으로 다시 확인해요\. 아래 「시간을 두고 다시 확인」에 있어요/);
 const html=page(run);
 assert.match(html,/<li data-step="delayed" data-state="planned"><i class="wpv-dot" aria-hidden="true"><\/i>/);
 assert.equal((html.match(/다음 차례/g)||[]).length,1);
});

test('놓침이 두 자리로 나뉘면 「첫 놓침만」 · 「이어서」 꼴을 쓰지 않고 놓침 줄이 수를 그대로 말한다(다시 검수 A1)',()=>{
 // 놓침 a, 바로 뒤 b(또 놓침) · c(맞힘), 나중에 따로 놓침 d, 바로 뒤 e(맞힘)
 const run=bolor(),card=structuredClone(run.card);
 card.evidence=['a','b','d'];
 card.narrow=card.narrow.map(row=>row.layer==='skill'?{...row,count:3,of:5}:{...row,count:3,of:3});
 Object.assign(card.again.find(row=>row.step==='spot'),{guests:3,right:2,eventIds:['b','c','e']});
 const said=text(renderPositionPage({map:run.map,legacy:'',card,practice,...langs.ko}));
 assert.ok(said.includes('놓침 막아야 할 손님을 3번 들여보냈어요'),said);
 // 그 자리 줄은 또 놓친 b를 빼고 센다 — 놓침 3 + 바로 뒤 새 손님 2 = 머리 수 5(최종 검수 F1)
 assert.ok(said.includes('바로 다음에 같은 규칙 손님 2명이 왔고, 모두 혼자 맞혔어요'),said);
 assert.doesNotMatch(said,/이어서 왔어요|또 놓쳤고|손님 3명이 왔고/);
 // 바로 뒤 손님이 모두 또 놓친 손님이면 그 자리 줄을 두지 않는다
 const all=structuredClone(card);Object.assign(all.again.find(row=>row.step==='spot'),{guests:1,right:0,eventIds:['b']});
 const html=renderPositionPage({map:run.map,legacy:'',card:all,practice,...langs.ko});
 assert.doesNotMatch(html,/data-step="spot"/);assert.match(html,/data-step="again"/);
});

test('글 안전: 근무지 이름 · 안내문 줄 · 항목 이름의 꺾쇠와 따옴표는 글로만 들어간다',()=>{
 const run=bolor(),card=structuredClone(run.card);
 card.narrow=card.narrow.map(row=>row.layer==='line'?{...row,venue:'<img src=x onerror=1>',text:'"a" & <b>'}:row);
 const html=renderPositionPage({map:run.map,legacy:'',card,practice,...langs.ko});
 assert.doesNotMatch(html,/<img|"a" & <b>/);assert.match(html,/&lt;img src=x onerror=1&gt;/);assert.match(html,/&quot;a&quot; &amp; &lt;b&gt;/);
 assert.throws(()=>renderPositionPage({map:run.map}),/t\(\)/);
});
