// PULSE 고객 앱 「마케팅 성과」 서버(2026-11-16, docs/마케팅/PULSE_마케팅성과_20261116/서버_설계.md 8절).
// 꼴 검사, 실제 꼴, 서버가 다시 세는 요약, 저장, 고객 경로, 고객 방 자료, 직원 경로의 일곱 묶음을 본다.
// 견본은 모두 이 파일에서 지은 합성 자료다. 보관함의 실제 자료를 옮기지 않는다. node_modules 없이 돈다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {request as httpRequest} from 'node:http';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createPulseFeatures} from './pulse-features.mjs';
import {createCompanyApp} from './server.mjs';
import {normalizeReport,summaryLineOf,createPulseMarketing,MARKETING_KINDS,MARKETING_LIMITS,PULSE_MARKETING_INDEX,PULSE_MARKETING_REPORTS} from './pulse-marketing.mjs';
import {createPulseMarketingRoutes} from './pulse-marketing-routes.mjs';

// 막는 문자와 폭 없는 문자는 코드 번호로 만든다(편집 도구가 이스케이프를 실제 글자로 풀어 소스를 깨지 않게).
const ch=code=>String.fromCharCode(code);
const LINE=ch(10),TAB=ch(9),RLO=ch(0x202e),LS=ch(0x2028),ZWSP=ch(0x200b),LONE=ch(0xd800);
const clone=value=>structuredClone(value);
const edit=(report,change)=>{const copy=clone(report);change(copy);return copy;};

// ── 합성 견본 ──
const base=(kind,extra)=>({kind,version:1,runId:'20261116-1',title:'합성 1회차',measuredAt:{from:'2026-11-15T20:29:11Z',to:'2026-11-15T21:33:06.250Z'},notes:['읽는 법을 적은 합성 문장'],...extra});
const cell=(q,s,extra={})=>({q,s,answered:true,mentioned:false,cited:false,sources:[],aiBriefing:null,excerpt:'',ms:1000,...extra});
function aiSearch(){
  return base('ai-search',{subject:{brand:'합성브랜드',site:'pulse-synthetic.test'},
    services:[{id:'engine_a',name:'검색 가',condition:'로그아웃'},{id:'engine-b',name:'검색 나',condition:''}],
    questions:[{id:'Q01',group:'일반',lang:'ko',text:'합성 질문 하나',branded:false},{id:'Q02',group:'일반',lang:'ko',text:'합성 질문 둘',branded:false},{id:'B01',group:'브랜드',lang:'ko',text:'합성브랜드는 무엇인가',branded:true}],
    cells:[
      cell('Q01','engine_a',{mentioned:true,cited:true,sources:['video.example','blog.example'],excerpt:'답의 앞머리',ms:1000}),
      cell('Q02','engine_a',{answered:false,excerpt:'가입해야 볼 수 있어요',ms:5002}),
      cell('B01','engine_a',{mentioned:true,sources:['brand.example'],ms:3000}),
      cell('Q01','engine-b',{sources:['video.example','zeta.example','alpha.example'],aiBriefing:true,ms:500}),
      cell('Q02','engine-b',{sources:['blog.example','video.example'],aiBriefing:false,ms:700}),
    ],
    // 올린 쪽이 틀리게 센 요약이다. 서버는 읽지 않는다.
    summary:{general:{total:999,answered:999,mentioned:999,cited:999},branded:{total:0},byService:[],topSources:[{host:'fake.example',count:99}]}});
}
const ad=(id,extra={})=>({id,startedAt:'2026-11-02',advertiser:'합성 광고주',text:'합성 광고 본문',multiVariant:false,...extra});
function competitorAds(){
  return base('competitor-ads',{method:'광고 라이브러리, 모든 나라, 켜진 광고',
    competitors:[{name:'합성 경쟁사',query:'synthetic rival',resultLabel:'약 65',read:57,own:54,reliable:true,note:'',ads:[ad('1234567890'),ad('98765',{startedAt:null,advertiser:'',text:'',multiVariant:true})]},
      {name:'흔한 낱말 경쟁사',query:'common word',resultLabel:'',read:3,own:0,reliable:false,note:'다른 광고주가 섞였다',ads:[]}],
    changes:null});
}
function labelReview(){
  return base('label-review',{checklist:[{id:1,title:'플랫폼 AI 표시'},{id:2,title:'광고 표시'},{id:3,title:'원고 기록'}],
    items:[{title:'합성 영상 하나',venue:'합성 채널',publishedAt:'11-08 공개, 11-10 진열',verdicts:['hit','check','norecord'],findings:[{check:1,verdict:'hit',quote:'근거 문장',why:'까닭'}]},
      {title:'합성 영상 둘',venue:'',publishedAt:'',verdicts:['check','check','unread'],findings:[]}],
    summary:{items:0,hit:9,check:9,norecord:9,unread:9}});
}
const memo=(extra={})=>base('memo',{headline:'한 문장 합성 결론',body:['첫 문단','둘째 문단'],nextActions:['다음 달 할 일'],...extra});
const SAMPLES={'ai-search':aiSearch,'competitor-ads':competitorAds,'label-review':labelReview,memo};
const refuse=(input,field,status=400)=>assert.throws(()=>normalizeReport(input),error=>error.status===status&&(field===undefined||error.field===field),`${field} 칸이 ${status}로 막혀야 한다`);

// ── 1. 꼴 검사 ──
test('꼴 검사: 종류마다 맞는 견본은 통과하고, 모르는 칸 · 막는 문자 · 길이 · 꼴 · 겹침 · 어긋난 값은 400이다',()=>{
  for(const kind of MARKETING_KINDS){const report=normalizeReport(SAMPLES[kind]());assert.equal(report.kind,kind);assert.equal(report.version,1);}
  assert.deepEqual(MARKETING_KINDS,['ai-search','competitor-ads','label-review','memo']);
  // 모르는 칸(맨 위와 안쪽), 빠진 칸
  refuse({...memo(),extra:1},'extra');
  refuse(edit(aiSearch(),r=>{r.cells[0].rank=1;}),'cells[0].rank');
  refuse(edit(competitorAds(),r=>{r.competitors[0].ads[0].url='https://ads.example';}),'competitors[0].ads[0].url');
  refuse(edit(memo(),r=>{delete r.title;}),'title');
  refuse(edit(memo(),r=>{delete r.notes;}),'notes');
  refuse(edit(memo(),r=>{r.summary={};r.kind='nope';}),'kind');
  refuse(edit(memo(),r=>{r.version=2;}),'version');
  refuse(edit(memo(),r=>{r.version='1';}),'version');
  assert.throws(()=>normalizeReport(null),error=>error.status===400);assert.throws(()=>normalizeReport([memo()]),error=>error.status===400);
  // 막는 문자: 줄바꿈 · 탭 · U+202E · U+2028 · 짝 잃은 서러게이트
  refuse(memo({title:'합성'+LINE+'제목'}),'title');
  refuse(memo({title:'합성'+TAB+'제목'}),'title');
  refuse(memo({title:'합성'+RLO+'제목'}),'title');
  refuse(memo({headline:'합성'+LS+'결론'}),'headline');
  refuse(memo({headline:'합성'+LONE}),'headline');
  refuse(edit(aiSearch(),r=>{r.cells[1].excerpt='줄'+LINE+'바꿈';}),'cells[1].excerpt');
  // 길이: 제목 80자, 빈 글, 줄 수
  assert.equal(normalizeReport(memo({title:'가'.repeat(80)})).title.length,80);
  refuse(memo({title:'가'.repeat(81)}),'title');
  refuse(memo({title:'   '}),'title');
  refuse(memo({notes:Array.from({length:9},()=>'줄')}),'notes');
  refuse(memo({notes:['가'.repeat(301)]}),'notes[0]');
  refuse(memo({body:[]}),'body');
  refuse(memo({nextActions:['하나','둘','셋','넷']}),'nextActions');
  refuse(edit(competitorAds(),r=>{r.competitors[0].ads[0].text='가'.repeat(221);}),'competitors[0].ads[0].text');
  // 꼴: 숫자가 아닌 광고 id, 없는 날짜, 시각, 회차 이름, 호스트
  refuse(edit(competitorAds(),r=>{r.competitors[0].ads[0].id='12345abc';}),'competitors[0].ads[0].id');
  refuse(edit(competitorAds(),r=>{r.competitors[0].ads[0].id=1234567890;}),'competitors[0].ads[0].id');
  refuse(edit(competitorAds(),r=>{r.competitors[0].ads[0].startedAt='2026-02-30';}),'competitors[0].ads[0].startedAt');
  refuse(memo({measuredAt:{from:'2026-11-15T20:29:11',to:'2026-11-15T21:33:06Z'}}),'measuredAt.from');
  refuse(memo({measuredAt:{from:'2026-11-15T20:29:11+09:00',to:'2026-11-15T21:33:06Z'}}),'measuredAt.from');
  refuse(memo({measuredAt:{from:'2026-02-30T20:29:11Z',to:'2026-11-15T21:33:06Z'}}),'measuredAt.from');
  refuse(memo({measuredAt:{from:'2026-11-15T22:00:00Z',to:'2026-11-15T21:33:06Z'}}),'measuredAt');
  refuse(memo({runId:'2026:1'}),'runId');refuse(memo({runId:'-1'}),'runId');refuse(memo({runId:'a_b'}),'runId');
  refuse(edit(aiSearch(),r=>{r.subject.site='https://pulse-synthetic.test';}),'subject.site');
  refuse(edit(aiSearch(),r=>{r.cells[0].sources=['Video.Example'];}),'cells[0].sources[0]');
  // 목록에 없는 질문 id, 겹친 칸, 겹친 id, 겹친 출처
  refuse(edit(aiSearch(),r=>{r.cells[0].q='Q99';}),'cells[0].q');
  refuse(edit(aiSearch(),r=>{r.cells[0].s='engine_c';}),'cells[0].s');
  refuse(edit(aiSearch(),r=>{r.cells.push(clone(r.cells[0]));}),'cells[5]');
  refuse(edit(aiSearch(),r=>{r.services[1].id='engine_a';}),'services[1]');
  refuse(edit(aiSearch(),r=>{r.questions[2].id='Q01';}),'questions[2]');
  refuse(edit(aiSearch(),r=>{r.cells[0].sources=['video.example','video.example'];}),'cells[0].sources[1]');
  refuse(edit(labelReview(),r=>{r.checklist[1].id=1;}),'checklist[1]');
  // 길이가 어긋난 verdicts, 모르는 판정, 목록에 없는 점검 항목
  refuse(edit(labelReview(),r=>{r.items[0].verdicts.pop();}),'items[0].verdicts');
  refuse(edit(labelReview(),r=>{r.items[0].verdicts[0]='pass';}),'items[0].verdicts[0]');
  refuse(edit(labelReview(),r=>{r.items[0].findings[0].check=7;}),'items[0].findings[0].check');
  refuse(edit(labelReview(),r=>{r.items[0].findings[0].verdict='ok';}),'items[0].findings[0].verdict');
  // 숫자: own이 read보다 큰 값, 1e999(JSON에서 Infinity), 범위, 정수가 아닌 값
  refuse(edit(competitorAds(),r=>{r.competitors[0].own=58;}),'competitors[0].own');
  refuse(JSON.parse(JSON.stringify(aiSearch()).replace('"ms":1000','"ms":1e999')),'cells[0].ms');
  refuse(edit(aiSearch(),r=>{r.cells[0].ms=600001;}),'cells[0].ms');
  refuse(edit(aiSearch(),r=>{r.cells[0].ms=1.5;}),'cells[0].ms');
  refuse(edit(competitorAds(),r=>{r.competitors[0].read=-1;}),'competitors[0].read');
  // 답 없음인데 언급 · 인용 · 출처가 있는 칸
  refuse(edit(aiSearch(),r=>{r.cells[1].mentioned=true;}),'cells[1].answered');
  refuse(edit(aiSearch(),r=>{r.cells[1].cited=true;}),'cells[1].answered');
  refuse(edit(aiSearch(),r=>{r.cells[1].sources=['blog.example'];}),'cells[1].answered');
  refuse(edit(aiSearch(),r=>{r.cells[0].aiBriefing='yes';}),'cells[0].aiBriefing');
  // 건수 상한: 칸 400개, 곳마다 광고 60건, 경쟁사 12곳
  const many=(questions,services)=>edit(aiSearch(),r=>{r.questions=Array.from({length:questions},(_,i)=>({id:'Q'+i,group:'일반',lang:'ko',text:'합성 질문',branded:false}));r.services=Array.from({length:services},(_,i)=>({id:'s'+i,name:'검색',condition:''}));r.cells=r.questions.flatMap(q=>r.services.map(s=>cell(q.id,s.id)));});
  assert.equal(normalizeReport(edit(many(40,10),r=>{r.cells=r.cells.slice(0,400);})).cells.length,400);
  refuse(edit(many(41,10),r=>{r.cells=r.cells.slice(0,401);}),'cells');
  refuse(edit(competitorAds(),r=>{r.competitors[0].ads=Array.from({length:61},(_,i)=>ad(String(10000+i)));}),'competitors[0].ads');
  refuse(edit(competitorAds(),r=>{r.competitors=Array.from({length:13},()=>clone(r.competitors[1]));}),'competitors');
  // 바뀐 광고(둘째 회차부터): since는 회차 이름 꼴, 목록은 광고 꼴
  const changed=normalizeReport(edit(competitorAds(),r=>{r.changes={since:'20261016-1',started:[ad('11111')],stopped:[],longRunning:[ad('22222',{startedAt:null})]};}));
  assert.equal(changed.changes.since,'20261016-1');assert.deepEqual(changed.changes.started.map(item=>item.id),['11111']);
  refuse(edit(competitorAds(),r=>{r.changes={since:'a:b',started:[],stopped:[],longRunning:[]};}),'changes.since');
  refuse(edit(competitorAds(),r=>{r.changes={since:'r1',started:[],stopped:[]};}),'changes.longRunning');
  // 정규화한 리포트가 JSON으로 30만 자를 넘으면 413이다(칸 400개 × 긴 출처 12곳).
  const host=(i,j)=>`${'h'.repeat(80)}-${i}-${j}.example`;
  refuse(edit(many(40,10),r=>{r.cells=r.cells.slice(0,400).map((item,i)=>({...item,sources:Array.from({length:12},(_,j)=>host(i,j))}));}),undefined,413);
});

// ── 2. 실제 꼴 ──
test('실제 꼴: 자유 글 publishedAt, 밑줄 든 서비스 id, 밀리초가 있고 없는 시각, U+200B 든 광고 본문, excerpt가 있는 답 없음 칸이 통과한다',()=>{
  const search=normalizeReport(aiSearch());
  assert.equal(search.services[0].id,'engine_a');
  assert.deepEqual(search.measuredAt,{from:'2026-11-15T20:29:11Z',to:'2026-11-15T21:33:06.250Z'},'시각은 받은 글 그대로 둔다');
  const unanswered=search.cells[1];assert.equal(unanswered.answered,false);assert.equal(unanswered.excerpt,'가입해야 볼 수 있어요');
  const ads=normalizeReport(edit(competitorAds(),r=>{r.competitors[0].ads[0].text='합성'+ZWSP+'광고'+ch(0x200d)+'본문';}));
  assert.equal(ads.competitors[0].ads[0].text,'합성'+ZWSP+'광고'+ch(0x200d)+'본문','폭 없는 문자는 받고 그대로 둔다');
  assert.equal(ads.competitors[0].ads[1].startedAt,null);
  assert.equal(normalizeReport(labelReview()).items[0].publishedAt,'11-08 공개, 11-10 진열');
  // 앞뒤 공백은 떼고, 받은 요약은 버리고, 아는 칸만 새 객체로 짓는다.
  const trimmed=normalizeReport(memo({title:'  합성 1회차  ',notes:['  앞뒤 공백  ']}));
  assert.equal(trimmed.title,'합성 1회차');assert.deepEqual(trimmed.notes,['앞뒤 공백']);
  assert.equal(Object.hasOwn(normalizeReport(memo({summary:{anything:true}})),'summary'),false,'memo의 몸통에 summary가 있어도 읽지 않는다');
  const input=aiSearch(),out=normalizeReport(input);assert.notEqual(out.cells[0],input.cells[0]);
  assert.deepEqual(Object.keys(out),['kind','version','runId','title','measuredAt','notes','subject','services','questions','cells','summary']);
  // 글자 수는 코드 포인트로 센다(이모지 80개는 80자).
  assert.equal([...normalizeReport(memo({title:'😀'.repeat(80)})).title].length,80);
});

// ── 3. 요약 ──
test('요약: 받은 summary가 틀려도 cells와 items에서 다시 센다 — topSources는 일반 칸만, avgMs는 답 없음 칸까지 넣은 평균, label-review는 판정 칸',()=>{
  const report=normalizeReport(aiSearch());
  assert.deepEqual(report.summary.general,{total:4,answered:3,mentioned:1,cited:1});
  assert.deepEqual(report.summary.branded,{total:1,answered:1,mentioned:1,cited:0});
  assert.deepEqual(report.summary.byService,[
    {s:'engine_a',generalTotal:2,generalAnswered:1,generalMentioned:1,generalCited:1,brandedTotal:1,brandedAnswered:1,brandedCited:0,avgMs:3001},
    {s:'engine-b',generalTotal:2,generalAnswered:2,generalMentioned:0,generalCited:0,brandedTotal:0,brandedAnswered:0,brandedCited:0,avgMs:600},
  ],'engine_a의 avgMs는 (1000+5002+3000)/3을 반올림한 값이다(답 없음 칸을 빼면 2000)');
  assert.deepEqual(report.summary.topSources,[{host:'video.example',count:3},{host:'blog.example',count:2},{host:'alpha.example',count:1},{host:'zeta.example',count:1}],'브랜드 칸의 brand.example은 세지 않는다. 같은 수면 호스트 이름순');
  assert.equal(summaryLineOf(report),'일반 질문에 받은 답 3건 가운데 합성브랜드 언급 1건');
  // topSources는 15곳까지, 칸이 없는 서비스의 avgMs는 0이다.
  const wide=normalizeReport(edit(aiSearch(),r=>{r.services.push({id:'idle',name:'안 쓴 검색',condition:''});r.cells[3].sources=Array.from({length:12},(_,i)=>`a${String(i).padStart(2,'0')}.example`);r.cells[4].sources=Array.from({length:10},(_,i)=>`b${String(i).padStart(2,'0')}.example`);}));
  const expected=[...Array.from({length:12},(_,i)=>`a${String(i).padStart(2,'0')}.example`),'b00.example','b01.example','b02.example'];
  assert.deepEqual(wide.summary.topSources,expected.map(host=>({host,count:1})),'모두 한 건이면 호스트 이름순으로 15곳까지만');
  assert.equal(wide.summary.byService.at(-1).avgMs,0);assert.equal(wide.summary.byService.at(-1).generalTotal,0);
  assert.ok(wide.summary.topSources.every((row,i,all)=>i===0||all[i-1].count>row.count||all[i-1].count===row.count&&all[i-1].host<row.host),'건수가 많은 순, 같으면 호스트 이름순');
  const label=normalizeReport(labelReview());
  assert.deepEqual(label.summary,{items:2,hit:1,check:3,norecord:1,unread:1},'확인 필요는 편 수(2)가 아니라 판정 칸 수(3)다');
  assert.equal(summaryLineOf(label),'2편을 봤습니다. 걸림 1건, 확인 필요 3건');
  assert.equal(summaryLineOf(normalizeReport(competitorAds())),'경쟁사 2곳의 켜진 광고를 읽었습니다');
  assert.equal(summaryLineOf(normalizeReport(memo())),'한 문장 합성 결론');
  assert.equal(Object.hasOwn(normalizeReport(competitorAds()),'summary'),false);
});

// ── 4. 저장 ──
async function service(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-marketing-'));const store=new Store(directory);
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  let seconds=0;const clock=()=>new Date(Date.parse('2026-11-16T01:00:00.000Z')+1000*seconds++).toISOString();
  const projects=createClientProjectsService({store,clock}),features=createPulseFeatures({store,clock});
  const marketing=createPulseMarketing({store,clientProjects:projects,features,clock});
  const admin=store.createUser({name:'관리자',email:'admin@pulse-synthetic.test',role:'admin'});
  const make=title=>projects.save(admin,{title,customerName:title+' 고객',dueDate:'2026-12-01'}).project;
  const a=make('합성 프로젝트 가'),b=make('합성 프로젝트 나');
  const customerOf=id=>{const row=store.get('clientProjects',id);return projects.open(projects.invite(admin,id,{revision:row.revision}).invite).session;};
  return {store,projects,features,marketing,admin,a,b,customerOf,on:value=>features.configure(admin,{marketing:value})};
}

test('저장: 올리면 목록에 뜨고, 같은 회차는 한 건으로 덮이고, 지우면 사라진다. 마지막을 지우면 색인 문서도 없다. 프로젝트 판 번호는 그대로다',async t=>{
  const f=await service(t),{marketing,admin,a,store}=f;
  const before=store.get('clientProjects',a.id);
  const first=marketing.save(admin,a.id,{report:memo({runId:'r1'})});
  assert.equal(first.replaced,false);assert.deepEqual(first.project,{name:'합성 프로젝트 가',client:'합성 프로젝트 가 고객'});assert.equal(first.visible,false,'스위치가 꺼져 있으면 올려도 보이지 않는다');
  assert.equal(first.head.uploadedBy,admin.id);assert.equal(typeof first.head.uploadedAt,'string');assert.equal(first.head.summaryLine,'한 문장 합성 결론');
  assert.deepEqual(marketing.staffList(admin,a.id).reports.map(head=>head.runId),['r1']);
  const again=marketing.save(admin,a.id,{report:memo({runId:'r1',headline:'고쳐 올린 결론'})});
  assert.equal(again.replaced,true);
  const list=marketing.staffList(admin,a.id);assert.equal(list.reports.length,1);assert.equal(list.reports[0].summaryLine,'고쳐 올린 결론');
  assert.equal(store.get(PULSE_MARKETING_REPORTS,`${a.id}:memo:r1`).report.headline,'고쳐 올린 결론');
  marketing.save(admin,a.id,{report:aiSearch()});
  const after=store.get('clientProjects',a.id);assert.equal(after.revision,before.revision,'올리기는 프로젝트 판 번호를 올리지 않는다');assert.equal(after.updatedAt,before.updatedAt);
  // 정렬: measuredAt.to가 늦은 것이 앞, 같으면 uploadedAt이 늦은 것이 앞. 시각은 Date.parse 값으로 견준다(글자로 견주면 「06Z」가 「06.500Z」보다 뒤로 간다).
  marketing.save(admin,a.id,{report:memo({runId:'late',measuredAt:{from:'2026-11-15T20:00:00Z',to:'2026-11-15T21:33:06.500Z'}})});
  marketing.save(admin,a.id,{report:memo({runId:'early',measuredAt:{from:'2026-11-15T20:00:00Z',to:'2026-11-15T21:33:06Z'}})});
  marketing.save(admin,a.id,{report:memo({runId:'early-2',measuredAt:{from:'2026-11-15T20:00:00Z',to:'2026-11-15T21:33:06.000Z'}})});
  assert.deepEqual(marketing.staffList(admin,a.id).reports.map(head=>head.runId),['late','20261116-1','r1','early-2','early'],'같은 measuredAt.to면 늦게 올린 것이 앞');
  // 지우기
  assert.throws(()=>marketing.remove(admin,a.id,{kind:'memo',runId:'none'}),error=>error.status===404);
  for(const bad of [{kind:'memo'},{kind:'memo',runId:'r1',extra:1},{kind:'nope',runId:'r1'},{kind:'memo',runId:'a:b'},null,[]])assert.throws(()=>marketing.remove(admin,a.id,bad),error=>error.status===400,JSON.stringify(bad));
  for(const bad of [{},{report:memo(),extra:1},null,{report:memo({title:''})}])assert.throws(()=>marketing.save(admin,a.id,bad),error=>error.status===400,JSON.stringify(bad));
  for(const head of marketing.staffList(admin,a.id).reports)assert.deepEqual(marketing.remove(admin,a.id,{kind:head.kind,runId:head.runId}),{ok:true,visible:false});
  assert.equal(store.get(PULSE_MARKETING_INDEX,a.id),null,'마지막 리포트를 지우면 색인 문서도 지운다');
  assert.equal(store.get(PULSE_MARKETING_REPORTS,`${a.id}:memo:r1`),null);
  assert.deepEqual(marketing.staffList(admin,a.id).reports,[]);
});

test('저장 상한: 120건째는 되고 121건째 새 회차는 409, 찬 뒤에도 덮어 올리기는 된다',async t=>{
  const {marketing,admin,a}=await service(t);
  for(let i=0;i<MARKETING_LIMITS.reports;i++)marketing.save(admin,a.id,{report:memo({runId:'r'+i})});
  assert.equal(MARKETING_LIMITS.reports,120);assert.equal(marketing.staffList(admin,a.id).reports.length,120);
  assert.throws(()=>marketing.save(admin,a.id,{report:memo({runId:'r120'})}),error=>error.status===409&&error.message.includes('오래된 회차를 지운 뒤 올려 주세요'));
  const replaced=marketing.save(admin,a.id,{report:memo({runId:'r7',headline:'덮어 올린 결론'})});
  assert.equal(replaced.replaced,true);assert.equal(marketing.staffList(admin,a.id).reports.length,120);
  marketing.remove(admin,a.id,{kind:'memo',runId:'r0'});
  assert.equal(marketing.save(admin,a.id,{report:memo({runId:'r120'})}).replaced,false,'하나를 지우면 다시 올릴 수 있다');
});

test('깨진 색인 문서는 빈 목록과 visible:false로 읽히고, 그 위에 덮어쓰지 않는다. 다른 프로젝트의 리포트는 섞이지 않는다',async t=>{
  const f=await service(t),{marketing,admin,a,b,store}=f;f.on(true);
  marketing.save(admin,b.id,{report:memo({runId:'b1'})});
  for(const broken of [[1,2],'글',{projectId:a.id,heads:'nope'},{projectId:b.id,heads:[]},{projectId:a.id,heads:[{kind:'memo'}]}]){
    store.put(PULSE_MARKETING_INDEX,a.id,broken);
    assert.deepEqual(marketing.staffList(admin,a.id).reports,[],JSON.stringify(broken));assert.equal(marketing.staffList(admin,a.id).visible,false);assert.equal(marketing.visible(a.id),false);
    assert.equal(marketing.staffList(admin,a.id).broken,true,'직원 목록은 읽지 못한 목록을 빈 목록과 구별한다');
    assert.throws(()=>marketing.save(admin,a.id,{report:memo()}),error=>error.status===409);
    assert.throws(()=>marketing.remove(admin,a.id,{kind:'memo',runId:'r1'}),error=>error.status===409);
    assert.deepEqual(store.get(PULSE_MARKETING_INDEX,a.id),broken,'읽지 못한 목록을 덮지 않는다');
  }
  assert.deepEqual(marketing.customerList(f.customerOf(a.id),'').reports,[]);
  store.remove(PULSE_MARKETING_INDEX,a.id);
  assert.equal(marketing.staffList(admin,a.id).broken,false,'목록 문서가 없는 것은 깨진 것이 아니다');assert.equal(marketing.staffList(admin,b.id).broken,false);
  assert.equal(marketing.visible(b.id),true);assert.equal(marketing.visible(a.id),false);assert.equal(marketing.visible(undefined),false);
  // 고객 함수: 세션의 프로젝트만 본다. 다른 프로젝트의 kind와 run으로 물어도 404다.
  const token=f.customerOf(a.id),params=query=>new URLSearchParams(query);
  assert.deepEqual(marketing.customerList(token,''),{reports:[]});
  assert.throws(()=>marketing.customerReport(token,params('kind=memo&run=b1')),error=>error.status===404&&error.message==='고객 요청을 찾을 수 없습니다.');
  assert.equal(marketing.customerReport(f.customerOf(b.id),params('kind=memo&run=b1')).headline,'한 문장 합성 결론');
  for(const query of ['kind=memo','kind=memo&run=b1&run=b1','kind=memo&run=b1&kind=memo','kind=memo&run=b1&x=1','kind=nope&run=b1','kind=memo&run=a:b','run=b1&x=memo'])assert.throws(()=>marketing.customerReport(token,params(query)),error=>error.status===400&&error.message==='주소를 확인해 주세요.',query);
  assert.throws(()=>marketing.customerList(token,'?x=1'),error=>error.status===400&&error.message==='주소를 확인해 주세요.');
  assert.throws(()=>marketing.customerList('no-such-session',''),error=>error.status===401);
  f.on(false);
  assert.throws(()=>marketing.customerList(token,''),error=>error.status===404&&error.message==='고객 요청을 찾을 수 없습니다.');
  assert.throws(()=>marketing.customerReport(f.customerOf(b.id),params('kind=memo&run=b1')),error=>error.status===404);
});

// ── 서버를 띄우는 묶음(5 · 6 · 7) ──
async function server(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-marketing-app-'));
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const person=(name,email,role,teamId,csrf)=>{const row=app.store.createUser({name,email,role,teamId});return {row,id:row.id,csrf,token:app.store.mint('session',row.id,{csrfToken:csrf},120)};};
  const admin=person('관리자','admin@pulse-synthetic.test','admin',null,'csrf-admin');
  const owner=person('담당자','owner@pulse-synthetic.test','member','team-a','csrf-owner');
  const reviewer=person('검토자','reviewer@pulse-synthetic.test','member','team-a','csrf-reviewer');
  const viewer=person('보기 전용','viewer@pulse-synthetic.test','viewer','team-a','csrf-viewer');
  const outsider=person('다른 팀','outsider@pulse-synthetic.test','member','team-b','csrf-outsider');
  const parse=async response=>{const text=await response.text();let data=null;try{data=JSON.parse(text);}catch{}return {status:response.status,data,text,headers:response.headers};};
  async function staff(who,path,{body,raw,method=body===undefined&&raw===undefined?'GET':'POST',origin=app.origin,csrf=who?.csrf,headers={}}={}){
    const response=await fetch(base+path,{method,headers:{...(who?{Cookie:'synk_company_session='+who.token}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...(origin?{Origin:origin}:{}),...(body!==undefined||raw!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))});
    return parse(response);
  }
  function customer(){
    const jar=new Map();
    async function call(path,{body}={}){
      const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
      for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}
      return parse(response);
    }
    return {call,jar};
  }
  const make=(title,who,extra={})=>app.clientProjects.save(admin.row,{title,customerName:title+' 고객',ownerId:who.id,dueDate:'2026-12-01',...extra}).project;
  const a=make('합성 프로젝트 가',owner,{reviewerId:reviewer.id}),b=make('합성 프로젝트 나',outsider);
  async function open(id){const row=app.store.get('clientProjects',id),invite=app.clientProjects.invite(admin.row,id,{revision:row.revision}).invite,c=customer(),opened=await c.call('/pulse/api/open',{body:{invite}});assert.equal(opened.status,200,opened.text);return {...c,opened};}
  const features=value=>staff(admin,'/api/settings/pulse-features',{body:{marketing:value}});
  const upload=(who,id,report,extra={})=>staff(who,`/api/client-projects/${id}/marketing/report`,{body:{report},...extra});
  const remove=(who,id,kind,runId,extra={})=>staff(who,`/api/client-projects/${id}/marketing/report/remove`,{body:{kind,runId},...extra});
  const audits=action=>app.store.all('audit').filter(row=>row.action===action);
  return {app,base,admin,owner,reviewer,viewer,outsider,staff,customer,open,a,b,features,upload,remove,audits};
}

// ── 5. 고객 경로 ──
test('고객 경로: 스위치가 꺼져 있으면 404, 켜져 있으면 자기 프로젝트 것만 보이고 올린 사람 · 때 · 프로젝트 id가 없다. 세션이 끝나면 401, 어긋난 질의는 400',async t=>{
  const f=await server(t);
  assert.equal((await f.upload(f.owner,f.a.id,memo({runId:'a1'}))).status,200);
  assert.equal((await f.upload(f.owner,f.a.id,aiSearch())).status,200);
  assert.equal((await f.upload(f.outsider,f.b.id,memo({runId:'b1',headline:'나 프로젝트 결론'}))).status,200);
  const ga=await f.open(f.a.id),gb=await f.open(f.b.id);
  for(const path of ['/pulse/api/marketing','/pulse/api/marketing/report?kind=memo&run=a1']){const off=await ga.call(path);assert.equal(off.status,404,path);assert.equal(off.data.error,'고객 요청을 찾을 수 없습니다.');}
  assert.equal((await f.features(true)).status,200);
  const list=await ga.call('/pulse/api/marketing');assert.equal(list.status,200,list.text);
  assert.deepEqual(list.data.reports.map(head=>head.runId).sort(),['20261116-1','a1']);
  for(const head of list.data.reports)assert.deepEqual(Object.keys(head),['kind','runId','title','measuredAt','summaryLine']);
  assert.equal(list.data.reports.find(head=>head.kind==='ai-search').summaryLine,'일반 질문에 받은 답 3건 가운데 합성브랜드 언급 1건');
  const report=await ga.call('/pulse/api/marketing/report?kind=ai-search&run=20261116-1');assert.equal(report.status,200,report.text);
  assert.deepEqual(report.data.summary.general,{total:4,answered:3,mentioned:1,cited:1},'저장된 요약은 서버가 센 값이다');
  assert.equal(report.data.title,'합성 1회차');
  for(const word of ['uploadedBy','uploadedAt','projectId',f.a.id,f.owner.id])assert.equal(list.text.includes(word)||report.text.includes(word),false,word+'는 고객에게 가지 않는다');
  // 다른 프로젝트의 kind와 run으로 물어도 404다.
  const foreign=await ga.call('/pulse/api/marketing/report?kind=memo&run=b1');assert.equal(foreign.status,404);assert.equal(foreign.data.error,'고객 요청을 찾을 수 없습니다.');
  assert.deepEqual((await gb.call('/pulse/api/marketing')).data.reports.map(head=>head.runId),['b1']);
  assert.equal((await gb.call('/pulse/api/marketing/report?kind=memo&run=b1')).data.headline,'나 프로젝트 결론');
  assert.equal((await ga.call('/pulse/api/marketing/report?kind=memo&run=zz')).status,404);
  // 질의
  for(const path of ['/pulse/api/marketing?x=1','/pulse/api/marketing/report?kind=memo&run=a1&run=a1','/pulse/api/marketing/report?kind=memo&run=a1&x=1','/pulse/api/marketing/report?kind=memo','/pulse/api/marketing/report','/pulse/api/marketing/report?kind=nope&run=a1','/pulse/api/marketing/report?kind=memo&run=a%3A1']){
    const result=await ga.call(path);assert.equal(result.status,400,path);assert.equal(result.data.error,'주소를 확인해 주세요.',path);
  }
  // 세션이 없으면 401, 다른 주소는 404
  const anonymous=f.customer();assert.equal((await anonymous.call('/pulse/api/marketing')).status,401);assert.equal((await anonymous.call('/pulse/api/marketing/report?kind=memo&run=a1')).status,401);
  assert.equal((await ga.call('/pulse/api/marketing/other')).status,404);
  // 초대를 새로 내면 옛 세션은 401이다.
  const row=f.app.store.get('clientProjects',f.a.id);f.app.clientProjects.invite(f.admin.row,f.a.id,{revision:row.revision});
  assert.equal((await ga.call('/pulse/api/marketing')).status,401);
  // 프로젝트를 보관하면 401이다.
  f.app.store.put('clientProjects',f.b.id,{...f.app.store.get('clientProjects',f.b.id),stage:'archived'});
  assert.equal((await gb.call('/pulse/api/marketing')).status,401);assert.equal((await gb.call('/pulse/api/marketing/report?kind=memo&run=b1')).status,401);
});

// ── 6. 고객 방 자료 ──
test('고객 방 자료: 리포트가 없으면 features.marketing이 false, 한 건 올리면 true, 스위치를 끄면 false. 다른 프로젝트는 false, 공개 features에는 marketing이 없다',async t=>{
  const f=await server(t);
  const ga=await f.open(f.a.id),gb=await f.open(f.b.id);
  assert.equal(ga.opened.data.features.marketing,false,'초대로 처음 열 때도 같은 값이 온다');
  assert.equal((await f.features(true)).status,200);
  const room=async c=>{const result=await c.call('/pulse/api/project');assert.equal(result.status,200,result.text);return result.data.features;};
  assert.equal((await room(ga)).marketing,false,'스위치만 켜고 리포트가 없으면 칸은 보이지 않는다');
  const saved=await f.upload(f.owner,f.a.id,memo({runId:'a1'}));assert.equal(saved.status,200,saved.text);assert.equal(saved.data.visible,true);
  assert.equal((await room(ga)).marketing,true);
  assert.equal((await room(gb)).marketing,false,'가 프로젝트에 올려도 나 프로젝트는 그대로다');
  const features=await room(ga);assert.deepEqual(Object.keys(features).sort(),['locale','locales','marketing','myModels','personaReal','personaRequest']);
  assert.equal((await f.features(false)).status,200);
  assert.equal((await room(ga)).marketing,false);
  assert.equal((await f.features(true)).status,200);
  assert.equal((await f.remove(f.owner,f.a.id,'memo','a1')).status,200);
  assert.equal((await room(ga)).marketing,false,'마지막 리포트를 지우면 칸도 사라진다');
  assert.equal((await ga.call('/pulse/api/marketing/report?kind=memo&run=a1')).status,404,'열려 있던 칸의 다음 읽기는 404다');
  const open=await f.customer().call('/pulse/api/features');assert.equal(open.status,200);assert.equal(Object.hasOwn(open.data.features,'marketing'),false);
  const draft=await f.customer().call('/pulse/api/request');assert.equal(Object.hasOwn(draft.data.features||{},'marketing'),false);
  // 스위치 감사 기록에도 marketing 값이 실린다.
  assert.deepEqual(f.audits('pulse-features-settings').map(row=>row.marketing),[true,false,true]);
  const settings=await f.staff(f.admin,'/api/settings/pulse-features');assert.equal(settings.data.marketing,true);
});

// ── 7. 직원 경로 ──
test('직원 경로: 로그인 · 권한 · CSRF · 출처 · 보관 · 시범 · 방법 · 몸통 한도를 보고, 올리기와 지우기에 감사 기록이 남는다',async t=>{
  const f=await server(t),{a,b}=f,list=id=>`/api/client-projects/${id}/marketing`;
  // 로그인 없이 401
  assert.equal((await f.staff(null,list(a.id))).status,401);
  assert.equal((await f.upload(null,a.id,memo())).status,401);
  assert.equal((await f.remove(null,a.id,'memo','r1')).status,401);
  // 스위치가 꺼진 채로 올리기는 200이고, 응답에 프로젝트 이름과 고객 이름이 있다.
  const saved=await f.upload(f.owner,a.id,memo({runId:'r1'}));assert.equal(saved.status,200,saved.text);
  assert.deepEqual(saved.data.project,{name:'합성 프로젝트 가',client:'합성 프로젝트 가 고객'});
  assert.equal(saved.data.replaced,false);assert.equal(saved.data.visible,false);
  assert.deepEqual(Object.keys(saved.data.head),['kind','runId','title','measuredAt','summaryLine','uploadedAt','uploadedBy']);assert.equal(saved.data.head.uploadedBy,f.owner.id);
  const replaced=await f.upload(f.owner,a.id,memo({runId:'r1',headline:'다시 올린 결론'}));assert.equal(replaced.data.replaced,true);
  const savedAudit=f.audits('pulse-marketing-report-saved');
  assert.deepEqual(savedAudit.map(row=>[row.subject,row.replaced,row.userId]),[[`${a.id}:memo:r1`,false,f.owner.id],[`${a.id}:memo:r1`,true,f.owner.id]]);
  assert.equal(f.app.store.get('clientProjects',a.id).revision,f.a.revision,'올리기는 프로젝트 판 번호를 올리지 않는다');
  // 목록: 담당자 · 검토자 · 같은 팀 보기 전용 계정 · 관리자는 읽는다. 다른 팀은 404다.
  for(const who of [f.owner,f.reviewer,f.viewer,f.admin]){
    const seen=await f.staff(who,list(a.id));assert.equal(seen.status,200,seen.text);
    assert.equal(seen.data.projectId,a.id);assert.deepEqual(seen.data.project,{name:'합성 프로젝트 가',client:'합성 프로젝트 가 고객'});assert.equal(seen.data.visible,false);
    assert.deepEqual(seen.data.reports.map(head=>[head.runId,head.summaryLine,head.uploadedBy]),[['r1','다시 올린 결론',f.owner.id]]);
  }
  assert.equal((await f.staff(f.outsider,list(a.id))).status,404);
  assert.equal((await f.upload(f.outsider,a.id,memo())).status,404);
  assert.equal((await f.staff(f.owner,list(b.id))).status,404);
  // 읽기 전용 계정과 검토자의 쓰기는 403이다.
  for(const who of [f.viewer,f.reviewer]){assert.equal((await f.upload(who,a.id,memo({runId:'x1'}))).status,403);assert.equal((await f.remove(who,a.id,'memo','r1')).status,403);}
  // CSRF가 없거나 틀리거나 출처가 다르면 403이다.
  assert.equal((await f.upload(f.owner,a.id,memo(),{csrf:''})).status,403);
  assert.equal((await f.upload(f.owner,a.id,memo(),{csrf:'csrf-admin'})).status,403);
  assert.equal((await f.upload(f.owner,a.id,memo(),{origin:'https://evil.example'})).status,403);
  assert.equal((await f.upload(f.owner,a.id,memo(),{origin:''})).status,403);
  assert.equal((await f.remove(f.owner,a.id,'memo','r1',{csrf:''})).status,403);
  // 스위치를 켜면 목록의 visible이 참이다.
  assert.equal((await f.features(true)).status,200);
  assert.equal((await f.staff(f.owner,list(a.id))).data.visible,true);
  // 꼴이 틀린 리포트와 몸통은 400이다. 오류 문장에 걸린 칸이 있다.
  const wrong=await f.upload(f.owner,a.id,edit(aiSearch(),r=>{r.cells[0].q='Q99';}));assert.equal(wrong.status,400);assert.equal(wrong.data.error,'리포트의 cells[0].q 칸을 확인해 주세요.');
  assert.equal((await f.staff(f.owner,list(a.id)+'/report',{body:{report:memo(),extra:1}})).status,400);
  assert.equal((await f.staff(f.owner,list(a.id)+'/report',{raw:'not json'})).status,400);
  // 시범 요청은 받지 않는다. 다른 방법은 405다. 질의 · 모르는 주소 · 잘못된 id도 막는다.
  assert.equal((await f.staff(f.owner,list(a.id),{headers:{'X-Synk-Demo':'1'}})).status,403);
  assert.equal((await f.staff(f.owner,list(a.id)+'?demo=1')).status,403);
  assert.equal((await f.upload(f.owner,a.id,memo(),{headers:{'X-Synk-Demo':'1'}})).status,403);
  assert.equal((await f.staff(f.owner,list(a.id)+'?x=1')).status,400);
  for(const method of ['PUT','DELETE','PATCH'])assert.equal((await f.staff(f.owner,list(a.id),{method})).status,405,method);
  assert.equal((await f.staff(f.owner,list(a.id)+'/report',{method:'GET'})).status,405);
  assert.equal((await f.staff(f.owner,list(a.id)+'/report/remove',{method:'DELETE'})).status,405);
  assert.equal((await f.staff(f.owner,list(a.id)+'/other')).status,404);
  assert.equal((await f.staff(f.owner,'/api/client-projects/not-a-project/marketing')).status,404);
  // 몸통이 있는 GET은 400이다.
  const getWithBody=await new Promise((done,reject)=>{const url=new URL(f.base+list(a.id));const req=httpRequest({host:url.hostname,port:url.port,path:url.pathname,method:'GET',headers:{Cookie:'synk_company_session='+f.owner.token,'Content-Type':'application/json','Content-Length':'2'}},res=>{res.resume();res.on('end',()=>done(res.statusCode));});req.on('error',reject);req.end('{}');});
  assert.equal(getWithBody,400);
  // 한도를 넘는 몸통은 413이다(올리기 30만 자, 지우기 1천 자).
  const big=JSON.stringify({report:memo({headline:'가'.repeat(300000)})});
  assert.equal((await f.staff(f.owner,list(a.id)+'/report',{raw:big})).status,413);
  assert.equal((await f.staff(f.owner,list(a.id)+'/report/remove',{raw:JSON.stringify({kind:'memo',runId:'r1',pad:'x'.repeat(1200)})})).status,413);
  // 지우기: 감사 기록이 남고, 없는 회차는 404다.
  assert.equal((await f.remove(f.owner,a.id,'memo','none')).status,404);
  const removed=await f.remove(f.owner,a.id,'memo','r1');assert.equal(removed.status,200,removed.text);assert.deepEqual(removed.data,{ok:true,visible:false});
  assert.deepEqual(f.audits('pulse-marketing-report-removed').map(row=>[row.subject,row.userId]),[[`${a.id}:memo:r1`,f.owner.id]]);
  // 보관한 프로젝트: 읽기는 200, 쓰기는 409다.
  assert.equal((await f.upload(f.owner,a.id,memo({runId:'r2'}))).status,200);
  f.app.store.put('clientProjects',a.id,{...f.app.store.get('clientProjects',a.id),stage:'archived'});
  const archived=await f.staff(f.owner,list(a.id));assert.equal(archived.status,200);assert.deepEqual(archived.data.reports.map(head=>head.runId),['r2']);
  assert.equal((await f.upload(f.owner,a.id,memo({runId:'r3'}))).status,409);
  assert.equal((await f.remove(f.owner,a.id,'memo','r2')).status,409);
  assert.equal(f.audits('pulse-marketing-report-saved').length,3,'거절된 올리기는 기록하지 않는다');
});

// ── 8. 직원 경로 모듈만 따로: 서버가 멈추는 중과 몸통을 읽는 사이 세션이 바뀐 경우 ──
test('직원 경로 모듈: 다른 주소는 넘기고, 서버가 멈추는 중이면 503, 몸통을 읽는 사이 세션이 바뀌면 저장하지 않는다',async()=>{
  const id='00000000-0000-4000-8000-000000000001',calls=[],sent=[];
  const service={staffList:()=>{calls.push('list');return {};},save:()=>{calls.push('save');return {head:{kind:'memo',runId:'r1'},replaced:false};},remove:()=>{calls.push('remove');return {ok:true};}};
  const user={id:'u1'},first={hash:'h1',user,body:{csrfToken:'c1'}};
  const make=({stopped=()=>false,sessions=[first,first]}={})=>{let n=0;return createPulseMarketingRoutes({service,body:async()=>({report:{}}),send:(res,status,data)=>sent.push({status,data}),session:()=>sessions[Math.min(n++,sessions.length-1)],origin:'https://company.test',audit:()=>calls.push('audit'),isStopped:stopped});};
  const req=(method,extra={})=>({method,headers:{origin:'https://company.test','x-csrf-token':'c1',...extra}}),at=path=>({url:new URL('https://company.test'+path)});
  assert.equal(await make()(req('GET'),{},at('/api/client-projects/'+id+'/materials')),false,'마케팅 주소가 아니면 넘긴다');
  await assert.rejects(make({stopped:()=>true})(req('GET'),{},at('/api/client-projects/'+id+'/marketing')),error=>error.status===503);
  let flips=0;await assert.rejects(make({stopped:()=>flips++>0})(req('POST'),{},at('/api/client-projects/'+id+'/marketing/report')),error=>error.status===503,'몸통을 읽은 뒤에도 멈춤을 다시 본다');
  await assert.rejects(make({sessions:[first,null]})(req('POST'),{},at('/api/client-projects/'+id+'/marketing/report')),error=>error.status===401,'읽는 사이 로그아웃');
  await assert.rejects(make({sessions:[first,{hash:'h2',user,body:{csrfToken:'c1'}}]})(req('POST'),{},at('/api/client-projects/'+id+'/marketing/report')),error=>error.status===401,'읽는 사이 다른 세션');
  await assert.rejects(make({sessions:[first,{hash:'h1',user,body:{csrfToken:'c2'}}]})(req('POST'),{},at('/api/client-projects/'+id+'/marketing/report')),error=>error.status===403,'읽는 사이 CSRF 토큰이 바뀜');
  await assert.rejects(make({sessions:[{hash:'h1',user,body:{}}]})(req('POST',{'x-csrf-token':undefined}),{},at('/api/client-projects/'+id+'/marketing/report')),error=>error.status===403,'토큰이 둘 다 없어도 같다고 보지 않는다');
  assert.deepEqual(calls,[],'막힌 요청은 서비스와 감사 기록에 닿지 않는다');
  assert.equal(await make()(req('POST'),{},at('/api/client-projects/'+id+'/marketing/report')),true);assert.deepEqual(calls,['save','audit']);assert.equal(sent.at(-1).status,200);
});
