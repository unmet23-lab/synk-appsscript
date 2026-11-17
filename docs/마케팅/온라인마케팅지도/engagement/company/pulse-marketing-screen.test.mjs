import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers} from './public/pulse-app/request-data.mjs';
import {roomTab,marketingHeads,marketingLine} from './public/pulse-app/room-view.mjs';
import {projectView,headerCrumb} from './public/pulse-app/views.mjs';
import {roomRail} from './public/pulse-app/film-views.mjs';
import {MARKETING_KINDS,marketingRunOk,marketingReport,marketingList} from './public/pulse-app/api.mjs';
import {marketingScreen,aiSearchModel,competitorModel,labelModel,memoModel} from './public/pulse-app/marketing-view.mjs';

// PULSE 고객 앱 「마케팅 성과」 칸(2026-11-16). 계약: docs/마케팅/PULSE_마케팅성과_20261116/계약.md.
// 아래 견본은 계약 꼴에 맞춰 이 시험에서 지은 합성 자료다(실제 잰 자료는 비공개 보관함에만 있고 여기에 옮기지 않는다).
globalThis.location??=new URL('http://localhost/pulse-app/');
const read=name=>readFileSync(new URL('./public/pulse-app/'+name,import.meta.url),'utf8');
const at={from:'2026-11-15T20:00:00Z',to:'2026-11-15T21:00:00Z'};
const heads=[
  {kind:'ai-search',runId:'20261116-1',title:'AI 검색 노출 1회차',measuredAt:at,summaryLine:'일반 질문 6건 가운데 언급 1건'},
  {kind:'competitor-ads',runId:'20261116-1',title:'경쟁사 광고 첫날 기록',measuredAt:at,summaryLine:'경쟁사 3곳을 읽었습니다'},
  {kind:'label-review',runId:'20261116-1',title:'표기와 규제 검수 1차',measuredAt:at,summaryLine:'3편 가운데 확인 필요 1건'},
  {kind:'memo',runId:'2026-11',title:'11월 한 장',measuredAt:at,summaryLine:'합성 브랜드는 이름 없는 질문에서 한 번 나왔습니다.'},
];
const memo={kind:'memo',version:1,runId:'2026-11',title:'11월 한 장',measuredAt:at,notes:[],headline:'합성 브랜드는 이름 없는 질문에서 한 번 나왔습니다.',body:['첫 문단입니다.','둘째 문단입니다.'],nextActions:['하나','둘','셋','넷은 보이지 않는다']};
const ai={kind:'ai-search',version:1,runId:'20261116-1',title:'AI 검색 노출 1회차',measuredAt:at,notes:['순위는 재지 않습니다.'],
  subject:{brand:'합성상회',site:'example-brand.test'},
  services:[{id:'svc-a',name:'서비스 가',condition:'로그아웃'},{id:'svc-b',name:'서비스 나',condition:'평소 상태'}],
  questions:[{id:'Q1',group:'묶음1',lang:'ko',text:'광고 영상 업체 추천해 줘',branded:false},{id:'Q2',group:'묶음1',lang:'en',text:'Who makes AI ads?',branded:false},{id:'Q3',group:'묶음2',lang:'ko',text:'세 번째 일반 질문',branded:false},{id:'B1',group:'브랜드',lang:'ko',text:'합성상회는 어떤 곳이야?',branded:true}],
  cells:[
    {q:'Q1',s:'svc-a',answered:true,mentioned:true,cited:true,sources:['example-brand.test','video.test'],aiBriefing:null,excerpt:'<img src=x onerror=alert(1)> 합성상회를 추천합니다',ms:9000},
    {q:'Q1',s:'svc-b',answered:true,mentioned:false,cited:false,sources:['video.test'],aiBriefing:true,excerpt:'다른 곳을 추천합니다',ms:9000},
    {q:'Q2',s:'svc-a',answered:false,mentioned:true,cited:true,sources:['ignored.test'],aiBriefing:null,excerpt:'가입한 뒤 다시 보내 주세요',ms:3000},
    {q:'Q2',s:'svc-b',answered:true,mentioned:false,cited:false,sources:['https://not-a-host/path'],aiBriefing:false,excerpt:'답',ms:9000},
    {q:'Q3',s:'svc-a',answered:true,mentioned:false,cited:false,sources:[],aiBriefing:null,excerpt:'답',ms:9000},
    {q:'Q3',s:'svc-b',answered:true,mentioned:false,cited:false,sources:['video.test'],aiBriefing:false,excerpt:'답',ms:9000},
    {q:'B1',s:'svc-a',answered:true,mentioned:true,cited:true,sources:['example-brand.test'],aiBriefing:null,excerpt:'답',ms:9000},
    {q:'B1',s:'svc-b',answered:true,mentioned:true,cited:false,sources:[],aiBriefing:true,excerpt:'답',ms:9000},
  ],
  summary:{general:{total:6,answered:5,mentioned:1,cited:1},branded:{total:2,answered:2,mentioned:2,cited:1},byService:[],topSources:[]}};
const ads={kind:'competitor-ads',version:1,runId:'20261116-1',title:'경쟁사 광고 첫날 기록',measuredAt:{from:'2026-11-16T03:00:00Z',to:'2026-11-16T03:00:00Z'},notes:['읽은 카드만 셌습니다.'],method:'메타 광고 라이브러리, 켜진 광고',
  competitors:[
    {name:'가나학습',query:'Gana',resultLabel:'약 40',read:38,own:30,reliable:true,note:'',ads:[{id:'2002',startedAt:'2026-11-01',advertiser:'Gana',text:'둘째로 시작한 광고',multiVariant:false},{id:'1001',startedAt:'2026-10-01',advertiser:'Gana',text:'먼저 시작한 광고',multiVariant:true},{id:'javascript:alert(1)',startedAt:'2026-10-15',advertiser:'Other Co',text:'링크가 없어야 하는 광고',multiVariant:false}]},
    {name:'다라앱',query:'Dara',resultLabel:'약 500',read:120,own:90,reliable:true,note:'',ads:[]},
    {name:'흔한낱말',query:'Speak',resultLabel:'50,000',read:200,own:7,reliable:false,note:'낱말이 흔해 다른 광고주가 섞였습니다.',ads:[]},
  ],changes:null};
const label={kind:'label-review',version:1,runId:'20261116-1',title:'표기와 규제 검수 1차',measuredAt:at,notes:['법 판정이 아닙니다.'],
  checklist:[{id:1,title:'플랫폼 AI 표시'},{id:2,title:'가상 인물의 추천과 표시'},{id:3,title:'대가와 광고 표기'}],
  items:[
    {title:'첫 영상',venue:'사이트',publishedAt:'11-09 진열',verdicts:['ok','na','unread'],findings:[]},
    {title:'둘째 영상',venue:'사이트',publishedAt:'11-10',verdicts:['check','hit','norecord'],findings:[{check:2,verdict:'hit',quote:'「둘째 근거」',why:'둘째 까닭'},{check:1,verdict:'check',quote:'「첫째 근거」',why:'첫째 까닭'}]},
    {title:'셋째 영상',venue:'',publishedAt:'',verdicts:['ok','bogus'],findings:[]},
    {title:'넷째 영상',venue:'사이트',publishedAt:'11-08 공개, 11-10 진열, 11-12 다시 진열하고 설명 글을 한 번 더 고쳐 올렸어요. 끝',verdicts:['ok','ok','ok'],findings:[]},
  ],summary:{items:3,hit:1,check:1,norecord:1,unread:1}};
const REPORTS={memo,'ai-search':ai,'competitor-ads':ads,'label-review':label};
const ready=(list=heads)=>{const h=marketingHeads(list),picks={},reports={};for(const head of h)picks[head.kind]??=head.runId;for(const head of h)reports[head.kind+'\u0001'+head.runId]={status:'ready',report:REPORTS[head.kind]};return {projectId:'p1',on:true,status:'ready',heads:h,picks,reports};};
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');

test('api: the two contract GETs go through request() with a checked kind and run, and refuse anything else without calling the server',async()=>{
  assert.deepEqual([...MARKETING_KINDS],['memo','ai-search','competitor-ads','label-review']);
  for(const ok of ['20261116-1','2026-11','r_1.2'])assert.equal(marketingRunOk(ok),true,ok);
  for(const bad of ['','../x','a b','x'.repeat(41),'-lead',null,7])assert.equal(marketingRunOk(bad),false,String(bad));
  const calls=[],real=globalThis.fetch;
  globalThis.fetch=async(path,init)=>{calls.push({path,init});return new Response(JSON.stringify({reports:[]}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    await marketingList();await marketingReport('ai-search','20261116-1');
    assert.deepEqual(calls.map(call=>call.path),['/pulse/api/marketing','/pulse/api/marketing/report?kind=ai-search&run=20261116-1']);
    for(const call of calls){assert.equal(call.init.method,'GET');assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.cache,'no-store');}
    await assert.rejects(marketingReport('ads','20261116-1'));await assert.rejects(marketingReport('memo','../../etc'));
    assert.equal(calls.length,2,'a bad kind or run never reaches the network');
  }finally{globalThis.fetch=real;}
});

test('report heads keep only well-formed rows in server order, and the room line prefers this month\'s conclusion',()=>{
  const list=marketingHeads([...heads,{kind:'memo',runId:'2026-11',title:'겹침'},{kind:'sales',runId:'x'},{kind:'memo',runId:'bad id'},null,{kind:'ai-search',runId:'20261109-1',title:'앞 회차',summaryLine:'옛 줄'}]);
  assert.deepEqual(list.map(item=>item.kind+':'+item.runId),['ai-search:20261116-1','competitor-ads:20261116-1','label-review:20261116-1','memo:2026-11','ai-search:20261109-1']);
  assert.equal(marketingLine(list),'합성 브랜드는 이름 없는 질문에서 한 번 나왔습니다.');
  assert.equal(marketingLine(list.filter(item=>item.kind!=='memo')),'일반 질문 6건 가운데 언급 1건');
  assert.equal(marketingLine([]),'');
  assert.equal(roomTab('marketing'),'marketing');
});

test('ai search counts come from the cells: unanswered answers leave the denominator and read 「답 없음」, and the briefing shows only where the service reports it',()=>{
  const a=aiSearchModel(ai);
  assert.deepEqual(a.general,{asked:6,answered:5,mentioned:1,cited:1});
  assert.deepEqual(a.branded,{asked:2,answered:2,mentioned:2,cited:1});
  assert.deepEqual(a.byService.map(s=>[s.id,s.none,s.briefing]),[['svc-a',1,null],['svc-b',0,{shown:2,of:4}]]);
  assert.deepEqual(a.topSources,[{host:'video.test',count:3},{host:'example-brand.test',count:1}],'general cells only (the branded answer citing the brand is left out), host names only, unanswered cells and non-hosts are dropped');
  // 계약의 summary.topSources와 같은 정의: 건수가 많은 순, 같으면 호스트 이름순, 15곳까지.
  const many=aiSearchModel({...ai,cells:ai.cells.map(cell=>cell.q==='Q3'&&cell.s==='svc-a'?{...cell,sources:Array.from({length:12},(_,i)=>`h${String(i).padStart(2,'0')}.test`)}:cell.q==='Q1'&&cell.s==='svc-b'?{...cell,sources:['video.test','zz.test','aa.test','b-b.test','b.b.test']}:cell)});
  assert.equal(many.topSources.length,15);
  assert.deepEqual(many.topSources.slice(0,6).map(item=>item.host),['video.test','aa.test','b-b.test','b.b.test','example-brand.test','h00.test'],'ties sort by host name in code-point order');
  const html=marketingScreen(ready());
  assert.match(html,/<p class="sx-mk-big" aria-hidden="true">1<\/p>/,'the general-question mention count is the largest figure');
  assert.match(text(html),/받은 답 5건 가운데 합성상회 이름이 나온 답이에요\./);
  assert.match(text(html),/답을 받지 못한 1건은 세지 않았어요\./);
  assert.match(html,/답을 받지 못했어요/);assert.doesNotMatch(html,/ignored\.test/,'an answer that never came lists no sources either');assert.match(html,/답 없음 1/);
  assert.match(html,/AI 브리핑이 뜬 답 2 \/ 4/);assert.match(html,/AI 브리핑이 떴어요/);
  assert.doesNotMatch(html,/<a [^>]*href="[^"]*(video\.test|example-brand\.test)/,'sources are never links');
  assert.doesNotMatch(html,/<img src=x/,'answer excerpts are escaped text');
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  // 순위 낱말은 리포트 자신의 읽는 법(「순위는 재지 않습니다.」)에만 있다.
  // \b는 한글 뒤에서 듣지 않는다(「1위」를 놓쳤다 — 카본 검수 11-16). 뒤에 오는 낱말만 몇 개 빼고 숫자 + 위를 잡는다.
  const RANK=/순위|\d+\s*위(?!치|원|험|기|반|해)|랭킹/;
  for(const sample of ['1위','2 위','1위입니다','3위를'])assert.match(sample,RANK,'the rank check itself catches '+sample);
  assert.doesNotMatch(text(html).replace('순위는 재지 않습니다.',''),RANK,'no rank is shown');
  assert.match(html,/<details class="sx-mk-q" data-mk-key="ai-search\|20261116-1\|q\|Q1"><summary/,'each question opens to the answers, keyed by kind, run and question');
  // 펼침은 열쇠로 기억한다(최종 검수 11-16): 위 칸이 줄거나 늦게 와도 연 목록이 그대로 열린다.
  const kept=marketingScreen({...ready(),open:new Set(['ai-search|20261116-1|q|Q3','competitor-ads|20261116-1|co|1'])});
  assert.match(kept,/data-mk-key="ai-search\|20261116-1\|q\|Q3" open><summary/);
  assert.doesNotMatch(kept,/data-mk-key="ai-search\|20261116-1\|q\|Q1" open/);
  assert.match(kept,/<details class="sx-mk-ads" data-mk-key="competitor-ads\|20261116-1\|co\|1" open><summary/,'the second company\'s ad list stays open');
  assert.match(html,/<svg class="sx-mk-bar is-on" aria-hidden="true" focusable="false">[^]*?width="50\.00%"/,'service bar: named in 1 of the 2 answers that service gave');
  // 이름 없이 출처 링크만 단 칸(mentioned false · cited true): 큰 수 · 서비스 표와 같이 「이름이 나온 곳」에 넣지 않고, 글로 링크를 밝힌다(카본 검수 11-16).
  const linkOnly={...ai,cells:ai.cells.map(cell=>cell.q==='Q3'&&cell.s==='svc-a'?{...cell,cited:true,sources:['example-brand.test']}:cell)};
  const lo=marketingScreen({...ready(),reports:{...ready().reports,['ai-search\u000120261116-1']:{status:'ready',report:linkOnly}}});
  const q3=lo.slice(lo.indexOf('<span class="sx-no">Q3</span>'));
  assert.match(q3.slice(0,q3.indexOf('</summary>')),/이름이 나온 곳 0/);
  assert.match(q3,/<i class="sx-mk-m is-no" aria-hidden="true"><\/i><b>서비스 가<\/b><span class="sx-small">이름은 나오지 않았고 출처로 링크만 달았어요/);
  assert.match(html,/<span class="sx-small sx-mk-q-tally" aria-hidden="true">/,'the visible tally is not read twice next to its screen-reader copy');
});

test('competitor ads: unreliable counts are not charted and carry their note, the first record says so, and only numeric ids become library links',()=>{
  const c=competitorModel(ads);
  assert.deepEqual(c.competitors.map(item=>item.name),['다라앱','가나학습','흔한낱말'],'reliable rows by count, then the rest');
  assert.equal(c.max,90);
  assert.deepEqual(c.competitors[1].ads.map(ad=>ad.startedAt),['2026-10-01','2026-10-15','2026-11-01'],'longest-running first');
  assert.equal(c.competitors[1].ads[0].days,47,'day count runs to the measured day');
  const html=marketingScreen(ready()),section=html.slice(html.indexOf('id="mk-competitor-ads"'),html.indexOf('id="mk-label-review"'));
  assert.match(section,/첫 기록/);
  assert.equal((section.match(/https:\/\/www\.facebook\.com\/ads\/library\/\?id=/g)||[]).length,2);
  assert.match(section,/href="https:\/\/www\.facebook\.com\/ads\/library\/\?id=1001" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(section,/javascript:/);
  const unsure=section.slice(section.indexOf('흔한낱말'));
  assert.doesNotMatch(unsure.slice(0,unsure.indexOf('</li>')),/sx-mk-bar|sx-mk-co-no/,'no bar and no big count for an unreliable row');
  assert.match(unsure,/낱말이 흔해 다른 광고주가 섞였습니다\./);
  assert.match(section,/광고주 Other Co/,'an ad from another advertiser says whose it is');
  // 둘째 회차: 앞 회차는 목록의 제목으로 부르고(회차 번호는 보이지 않는다), 끈 광고는 며칠째인지 세지 않는다(카본 검수 11-16).
  const second={...ads,changes:{since:'20261109-1',started:[{id:'3003',startedAt:'2026-11-12',advertiser:'Gana',text:'새 광고'}],stopped:[{id:'4004',startedAt:'2026-10-16',advertiser:'Gana',text:'끈 광고 본문'}],longRunning:[]}};
  const base=ready(),reports={...base.reports,['competitor-ads\u000120261116-1']:{status:'ready',report:second}};
  const withPrev=marketingScreen({...base,heads:[...base.heads,{kind:'competitor-ads',runId:'20261109-1',title:'경쟁사 광고 11월 둘째 주',summaryLine:'',from:'',to:''}],reports});
  assert.doesNotMatch(withPrev,/첫 기록/);assert.match(withPrev,/「경쟁사 광고 11월 둘째 주」 뒤에 달라진 것/);assert.match(withPrev,/새 광고/);
  assert.doesNotMatch(withPrev,/20261109-1 회차|>20261109-1</,'the internal run id is never shown as a name');
  const stopped=withPrev.slice(withPrev.indexOf('끈 광고 <'));
  assert.match(stopped,/10월 16일에 시작/);assert.doesNotMatch(stopped.slice(0,stopped.indexOf('끈 광고 본문')),/일째/,'a stopped ad has no running-day count');
  assert.equal(competitorModel(second).changes.stopped[0].days,0);
  assert.match(competitorModel(second).changes.started[0].days?'ok':'',/ok/,'a newly started ad still counts its days');
  const gone=marketingScreen({...base,reports});
  assert.match(gone,/앞 회차 뒤에 달라진 것/,'when that run is no longer listed it reads 「the last round」');
});

test('label review: eight-or-fewer checklist columns, six verdicts with counts, findings under their video in checklist order',()=>{
  const l=labelModel(label);
  assert.deepEqual(l.counts,{hit:1,check:1,ok:5,na:1,norecord:1,unread:1});
  assert.equal(l.items[3].publishedAt,'11-08 공개, 11-10 진열, 11-12 다시 진열하고 설명 글을 한 번 더 고쳐 올렸어요. 끝'.slice(0,60),'publishedAt is plain text up to 60 characters, shown as it came');
  assert.equal(l.flagged,1);
  assert.deepEqual(l.items[2].verdicts,['ok','',''],'unknown verdicts render blank, missing ones too');
  assert.deepEqual(l.items[1].findings.map(f=>f.check),[1,2]);
  // 겹친 id(둘째 줄)가 걸러져도 셋째 칸은 원래 셋째 판정을 읽는다(최종 검수 11-16 — 한 칸씩 밀렸다).
  const dup=labelModel({...label,checklist:[{id:1,title:'하나'},{id:1,title:'겹침'},{id:3,title:'셋'}],items:[{title:'영상',venue:'',publishedAt:'',verdicts:['ok','check','hit'],findings:[]}]});
  assert.deepEqual(dup.checklist.map(c=>c.id),[1,3]);
  assert.deepEqual(dup.items[0].verdicts,['ok','hit']);
  const html=marketingScreen(ready()),section=html.slice(html.indexOf('id="mk-label-review"'));
  assert.equal((section.match(/<th scope="col" class="sx-mk-col">/g)||[]).length,3);
  for(const word of ['걸림','확인 필요','문제없음','해당 없음','기록 없음','원고를 읽지 못함'])assert.ok(text(section).includes(word),word);
  assert.match(section,/「첫째 근거」[^]*「둘째 근거」/);
  assert.match(section,/첫째 까닭/);
});

test('this month\'s page leads, with at most three next steps and a jump list to the three reports',()=>{
  const m=memoModel(memo);assert.equal(m.next.length,3);
  const html=marketingScreen(ready());
  assert.ok(html.indexOf('id="mk-memo"')<html.indexOf('id="mk-ai-search"')&&html.indexOf('id="mk-ai-search"')<html.indexOf('id="mk-competitor-ads"')&&html.indexOf('id="mk-competitor-ads"')<html.indexOf('id="mk-label-review"'),'memo, then ai-search, competitor-ads, label-review');
  assert.match(html,/<h1 class="sx-display sx-mk-headline" data-room-title>합성 브랜드는 이름 없는 질문에서 한 번 나왔습니다\.<\/h1>/);
  assert.doesNotMatch(html,/넷은 보이지 않는다/);
  assert.deepEqual([...html.matchAll(/data-mk-jump="([a-z-]+)"/g)].map(m=>m[1]),['ai-search','competitor-ads','label-review']);
  assert.doesNotMatch(html,/<select/,'one run per kind: no run picker');
  const two=ready([...heads,{kind:'ai-search',runId:'20261109-1',title:'AI 검색 노출 0회차',measuredAt:at,summaryLine:''}]);
  assert.match(marketingScreen(two),/<select data-mk-run="ai-search"><option value="20261116-1" selected>/);
});

test('waiting, failing, empty and half-loaded states each say what is happening',()=>{
  assert.match(marketingScreen({status:'loading',heads:[],picks:{},reports:{}}),/리포트를 불러오고 있어요\./);
  const failed=marketingScreen({status:'error',heads:[],picks:{},reports:{}});
  assert.match(failed,/리포트를 불러오지 못했어요/);assert.match(failed,/data-mk-do="retry"/);
  const empty=text(marketingScreen({status:'ready',heads:[],picks:{},reports:{}}));
  assert.match(empty,/아직 잰 것이 없어요/);assert.match(empty,/AI 검색 노출, 경쟁사 광고, 표기와 규제 검수 리포트가 여기에 올라와요/);
  const partial=ready();
  partial.reports['ai-search\u000120261116-1']={status:'error'};partial.reports['label-review\u000120261116-1']={status:'missing'};partial.reports['competitor-ads\u000120261116-1']={status:'loading'};
  const html=marketingScreen(partial);
  assert.match(html,/이 리포트를 불러오지 못했어요\. <button type="button" class="sx-link" data-mk-do="retry" data-kind="ai-search">/);
  assert.match(html,/이 회차의 리포트를 찾지 못했어요\./);
  assert.match(html,/id="mk-competitor-ads"[^]*리포트를 불러오고 있어요\./);
  assert.match(html,/합성 브랜드는/,'the memo still reads while the others wait');
});

test('the room shows the entry only while the switch is on, and the tab replaces the room with the reports',()=>{
  const p={id:'p1',title:'합성 음료',ownerName:'김하늘',stage:'received',revision:1,versions:[],messages:[],requestFlow:true,studio:{assets:[],scenes:[],comments:[],sceneReviews:[],strategy:{revision:1,data:{},request:null,confirmation:null},feedbackRounds:{drafts:[],rounds:[],canDraft:true,maxItems:20,nextNumber:1},request:{status:'submitted',number:'P-2026-ABCD',submittedAt:at.from,answers:{...emptyAnswers(),name:'합성 음료',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],notes:[],rounds:[]}}};
  const s=(extra={})=>({mode:'customer',tab:'overview',live:{},versionId:'',project:p,...extra});
  const off=projectView(s()),offHead=headerCrumb(s());
  assert.doesNotMatch(off,/data-room-go="marketing"/);assert.doesNotMatch(offHead,/마케팅 성과/);
  const on={marketing:{...ready(),projectId:'p1'}};
  const room=projectView(s(on));
  assert.match(room,/<section class="sx-extra sx-mk-entry" data-room-in><div><h2>마케팅 성과<\/h2><p class="sx-small">합성 브랜드는 이름 없는 질문에서 한 번 나왔습니다\.<\/p><\/div><button type="button" class="sx-go" data-room-go="marketing">/);
  assert.match(headerCrumb(s(on)),/data-room-go="marketing">마케팅 성과<\/button>/);
  assert.doesNotMatch(projectView(s({marketing:{...ready(),projectId:'other'}})),/sx-mk-entry/,'another project\'s state is ignored');
  const loading=projectView(s({...on,tab:'marketing'}));
  assert.match(loading,/class="sx-shell sx-room sx-mk"/);assert.match(loading,/리포트를 불러오고 있어요\./);assert.match(loading,/id="room-journal"/);
  const drawn=projectView(s({...on,tab:'marketing',marketingView:marketingScreen}));
  assert.match(drawn,/id="mk-ai-search"/);
  assert.match(headerCrumb(s({...on,tab:'marketing'})),/class="is-now" aria-current="page" data-room-go="marketing"/);
  assert.match(projectView(s({marketing:{projectId:'p1',on:false,status:'off',heads:[],picks:{},reports:{}},tab:'marketing'})),/sx-room-hero/,'switch off: the room, not the tab');
  assert.match(roomRail({stage:'check',films:true,marketing:false},{tab:'overview'}),/<div class="sx-steps-foot sx-small"><button type="button" class=""  data-room-go="films">완성 광고<\/button><\/div>/,'films-only foot is byte-for-byte what it was');
});

test('the tab stays inside the screen rules: no style attributes, no service names or promises in the code, the shell does not store reports',()=>{
  const src=read('marketing-view.mjs'),body=src.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(src,/\bstyle=["']|<style|setAttribute\('style'|\son[a-z]+=["']|javascript:/);
  assert.doesNotMatch(body,/Perplexity|퍼플렉시티|ChatGPT|Gemini|Claude|GPT|네이버|구글|Copilot/,'service names arrive in the report, not the code');
  assert.doesNotMatch(body,/매출|순위|노출을 (?:늘|올)|보장|1위|최고|최초/,'no sales, rank or exposure promises');
  assert.deepEqual([...new Set(body.match(/https?:\/\/[^'"`\s]+/g))],['https://www.facebook.com/ads/library/?id='],'the only outside link is the ad library');
  const sw=read('sw.js');
  assert.match(sw,/const CACHE = 'synk-pulse-shell-v70-request-clock-20261118';/);
  assert.match(sw,/RUNTIME\.push\(BASE\+'marketing-view\.mjs'\);/);
  assert.doesNotMatch(sw.slice(sw.indexOf('const BASE'),sw.indexOf('const RUNTIME')),/marketing-view/,'not precached for every customer');
  // 서버의 /pulse-app/ 정적 허용 목록에는 있다(없으면 칸을 열 때 모듈이 404라 「불러오지 못했어요」만 선다).
  const server=readFileSync(new URL('./server.mjs',import.meta.url),'utf8');
  assert.match(server,/for\(const file of \[[^\]]*'marketing-view\.mjs'[^\]]*\]\)/,'the static allowlist serves the module');
  assert.doesNotMatch(sw,/pulse\/api\/marketing/);
  const app=read('app.mjs');
  assert.match(app,/import\('\.\/marketing-view\.mjs'\)/,'the module loads on first open');
  assert.match(app,/const want=projectFeatures\?\.marketing===true/,'drawn only when the room data (GET \/pulse\/api\/project) says marketing is on');
  assert.match(app,/if\(error\?\.status===404&&s\.marketing===m\)\{if\(!m\.relisted\.has\(key\)\)\{m\.relisted\.add\(key\);if\(m\.status!=='loading'\)void loadMarketingHeads\(m\);return;\}m\.reports\[key\]=\{status:'missing'\};return;\}/,'a report 404 re-reads the list once for that run, then reads 「not found」');
  assert.match(app,/if\(s\.marketingView\|\|marketingViewLoading\|\|s\.marketingViewFailed\|\|/,'a failed module load waits for the retry button instead of re-importing on every redraw');
  assert.match(app,/if\(picking\|\|canApplyRemote\(\)&&!\(entering\(\)&&Date\.now\(\)-since<3000\)\)\{if\(picking\)marketingFocus=picking;render/,'a report arriving after a run pick redraws and hands focus back to that picker; other redraws wait for the entrance motion (3 s at most)');
  // 그리기 안에서 다시 그리지 않는다(최종 검수 11-16): 스위치는 render 머리에서 보고, 처음 목록 읽기는 그리지 않고 시작한다.
  assert.match(app,/followLocale\(\);loadDesk\(\);checkMarketing\(\);loadMarketingView\(\);/);
  assert.doesNotMatch(app.slice(app.indexOf('function mountScreens(){'),app.indexOf('function modelsEntry(')),/checkMarketing\(\)/,'mountScreens no longer starts a nested render');
  assert.match(app,/\{draw:false\}\);\r?\n\}/,'the first list read does not redraw inside the render that started it');
  // render의 순번 복원은 열쇠 달린 칸의 펼침을 건드리지 않고, 펼침은 toggle 듣개가 s.marketing.open에 적는다.
  const renderLine=app.slice(app.indexOf('function render({remote=false}={}){'));
  assert.equal((renderLine.slice(0,renderLine.indexOf('\n')).match(/main\.querySelectorAll\('details:not\(\[data-mk-key\]\)'\)/g)||[]).length,2);
  assert.match(app,/main\.addEventListener\('toggle',event=>\{[^]*?details\[data-mk-key\][^]*?m\.open\.add\(key\);else m\.open\.delete\(key\);\r?\n\},true\);/);
  assert.match(app,/if\(m\.reports\[key\]\)continue;/,'a failed report is not re-requested on every redraw — only the retry button asks again');
  const css=read('film-legacy.css');
  assert.match(css,/\.sx-mk-run>span\{flex:none;white-space:nowrap\}/,'the run picker label never breaks into two lines');
  assert.match(css,/\.sx-mk-bar-fill\{fill:url\(#sx-mk-hatch\)\}/,'hatched bars, not filled ones');
  assert.doesNotMatch(css.slice(css.indexOf('마케팅 성과(11-16')),/border-radius:(?!0)|box-shadow/,'no rounding or shadows');
  // 휴대폰 규칙이 넓은 화면 규칙을 명시도로 이긴다(카본 검수 11-16: 첫 칸이 30%로 찌그러지고, 소견 줄 여백이 덮였다).
  const phone=css.slice(css.lastIndexOf('@media',css.indexOf('.sx-mk-services tbody :is(')));
  assert.match(phone,/\.sx-mk-services tbody :is\(th,td,td:nth-of-type\(1\)\)\{display:block;width:auto/);
  assert.match(phone,/\.sx-mk-review :is\(th\.sx-mk-col,td\)\{[^}]*\}\r?\n  \.sx-mk-review \.sx-mk-findings td\{padding:0 0 14px\}/);
});
