'use strict';
/* 심사위원 셋의 표시 확인(사업계획서 설계 14.3 · 14.5 단계 3 시험): 빠진 항목, 범위 밖 표시, 없는 인용, 근거 없는 숫자, 다시 심사, ○ △ ✕와 강점 */
const test=require('node:test');
const assert=require('node:assert/strict');
const sc=require('../src/office-bizplan-score.cjs');
const ck=require('../src/office-bizplan-check.cjs');

const P=['## 01 문제 인식','바쁜 직장인 열 명 가운데 여섯이 아침을 거릅니다.','## 02 해결책','설탕을 절반으로 줄인 그래놀라를 굽습니다.','## 05 비즈니스 모델','한 봉지 9,800원에 팝니다. 단골 300명이 매달 다시 삽니다.'];
const paragraphs=P.map(text=>({text,level:text.startsWith('#')?1:null,toc:false,inTable:false}));
const secs=[{id:1,title:'01 문제 인식',head:0,paras:[1]},{id:2,title:'02 해결책',head:2,paras:[3]},{id:3,title:'05 비즈니스 모델',head:4,paras:[5]}];
const criteria=sc.CRITERIA;
const planNumbers=ck.numbers(paragraphs.map(p=>ck.ordinalFree(p.text,p.level!=null)).join('\n')).set;
const ctx={criteria,paragraphs,secs,planNumbers};
// 표시: 1 ✕ 빠짐 · 2 △ 보완 · 3 ○ 갖춤. 기본 답은 모두 △
const full=(o={})=>({scores:criteria.map((crit,i)=>({crit,score:2,strong:false,why:'근거가 있습니다.',para:0,quote:'',...(o[crit]||{})})),line:'설탕을 줄인 점이 좋습니다.',reacts:[{sec:2,kind:'oh',say:'설탕 절반, 좋네요'}],...(o._||{})});
const one=(crit,s)=>({scores:[{crit,strong:false,para:0,quote:'',why:'좋습니다.',...s}],line:'좋습니다.',reacts:[]});

test('앉는 심사위원: 업무 줄에서 부를 수 있는 회사만, 차례는 Opus · Sol · Sonnet', () => {
  assert.deepEqual(sc.seated(['claude']).map(j=>j.id),['opus','sonnet']);
  assert.deepEqual(sc.seated(['codex']).map(j=>j.id),['sol']);
  assert.deepEqual(sc.seated(['claude','codex']).map(j=>j.id),['opus','sol','sonnet']);
  assert.deepEqual(sc.seated([]),[]);
});

test('칸 꼴: 모든 칸이 필수이고 항목은 고른 평가 항목만, 표시는 1~3과 강점', () => {
  const s=sc.schemaFor(['문제 인식','시장성']);
  assert.deepEqual(s.required,['scores','line','reacts']);
  const it=s.properties.scores.items;
  assert.deepEqual(it.properties.crit.enum,['문제 인식','시장성']);
  assert.equal(it.additionalProperties,false);
  assert.deepEqual(it.required,['crit','score','strong','why','para','quote']);
  assert.deepEqual([it.properties.score.minimum,it.properties.score.maximum],[1,3]);
  assert.equal(it.properties.strong.type,'boolean');
});

test('확인: 빠진 항목 · 겹친 항목 · 범위 밖 표시 · 소수 표시는 그 심사위원 답을 버린다', () => {
  const a=full();
  assert.ok(sc.checkScore(a,ctx));
  assert.equal(sc.checkScore({...a,scores:a.scores.slice(1)},ctx),null,'빠진 항목');
  assert.equal(sc.checkScore({...a,scores:[...a.scores.slice(1),a.scores[1]]},ctx),null,'겹친 항목');
  assert.equal(sc.checkScore(full({'현실성':{score:4}}),ctx),null,'예전 1~5점의 4');
  assert.equal(sc.checkScore(full({'현실성':{score:0}}),ctx),null);
  assert.equal(sc.checkScore(full({'현실성':{score:2.5}}),ctx),null);
  assert.equal(sc.checkScore(full({'현실성':{crit:'성장 전략'}}),ctx),null,'목록 밖 항목');
  assert.equal(sc.checkScore(null,ctx),null);
});

test('강점: ○에만 있고, ○가 아니거나 참이 아닌 값이면 끈다', () => {
  const r=sc.checkScore(full({'문제 인식':{score:3,strong:true},'현실성':{score:2,strong:true},'신뢰성':{score:3,strong:'yes'},'시장성':{score:3}}),ctx);
  const by=Object.fromEntries(r.scores.map(s=>[s.crit,s]));
  assert.equal(by['문제 인식'].strong,true);
  assert.equal(by['현실성'].strong,false,'△의 강점은 끈다');
  assert.equal(by['신뢰성'].strong,false,'참 말고는 끈다');
  assert.equal(by['시장성'].strong,false);
  assert.deepEqual(r.scores.map(sc.markOf),['v','t','o','o','t','t']);
});

test('확인: 없는 인용은 비우고, 근거 없는 숫자의 까닭 · 한 줄은 정해진 글로, 혼잣말은 뺀다', () => {
  const r=sc.checkScore(full({
    '문제 인식':{why:'열 명 가운데 여섯이 거릅니다.',para:2,quote:'열 명 가운데 여섯이 아침을'},
    '시장성':{why:'시장 규모가 500억입니다.',para:6,quote:'단골 300명이 매달'},
    '수익 구조':{para:6,quote:'단골 30명이'},
    '팀 역량':{para:9,quote:'대표가'},
    _:{line:'매출 12억이 기대됩니다.',reacts:[{sec:3,kind:'hmm',say:'9,800원은 비싸요'},{sec:3,kind:'oh',say:'1,000명 가능'},{sec:9,kind:'oh',say:'좋아요'}]},
  }),ctx);
  const by=Object.fromEntries(r.scores.map(s=>[s.crit,s]));
  assert.equal(by['문제 인식'].quote,'열 명 가운데 여섯이 아침을');
  assert.equal(by['시장성'].why,sc.FIXED.why('시장성'),'500억은 계획서에 없다');
  assert.equal(by['시장성'].quote,'단골 300명이 매달');
  assert.equal(by['수익 구조'].quote,'','계획서에 없는 인용');
  assert.equal(by['수익 구조'].para,0);
  assert.equal(by['팀 역량'].para,0,'범위 밖 문단');
  assert.equal(r.line,sc.FIXED.line);
  assert.deepEqual(r.reacts,[{sec:3,kind:'hmm',say:'9,800원은 비싸요'}]);
});

test('다시 심사: 바뀐 문장에 닿는 인용을 찾은 항목만 표시가 바뀐다(설계 14.3)', () => {
  const previous=criteria.map(crit=>({crit,score:2}));
  // 여섯째 문단(index 5)의 둘째 문장만 바뀌었다
  const t=P[5],from=t.indexOf('단골');
  const changed=new Map([['5:0',[[from,t.length]]]]);
  const r=sc.checkScore(full({
    '수익 구조':{score:3,why:'단골이 매달 다시 삽니다.',para:6,quote:'단골 300명이 매달 다시 삽니다'},
    '시장성':{score:3,why:'좋습니다.',para:2,quote:'열 명 가운데 여섯이'},
    '팀 역량':{score:1,why:'없습니다.'},
  }),{...ctx,previous,changed});
  const by=Object.fromEntries(r.scores.map(s=>[s.crit,s]));
  assert.equal(by['수익 구조'].score,3,'바뀐 문단(6)에서 근거');
  assert.equal(by['시장성'].score,2,'안 바뀐 문단 근거는 앞 표시');
  assert.equal(by['시장성'].held,true);
  assert.equal(by['시장성'].why,sc.FIXED.held,'옛 까닭도 새 까닭도 아닌 정해진 글');
  assert.equal(by['팀 역량'].score,2,'근거 없이 바꾼 표시도 앞 표시');
  assert.equal(r.dropped.held,2);
  // 같은 문단의 바뀌지 않은 첫 문장 인용으로는 바뀌지 않는다(설계 검토 D2)
  const same=sc.checkScore(full({'수익 구조':{score:3,why:'값이 있습니다.',para:6,quote:'한 봉지 9,800원에 팝니다'}}),{...ctx,previous,changed});
  assert.equal(same.scores.find(x=>x.crit==='수익 구조').score,2);
});

test('다시 심사: ○ 안에서 강점만 바뀌는 것도 바뀐 문장의 근거가 있어야 하고, 근거로 든 글이 빠졌으면 강점이 내려갈 수 있다', () => {
  const t=P[5],from=t.indexOf('단골');
  const changed=new Map([['5:0',[[from,t.length]]]]);
  const previous=[{crit:'수익 구조',score:3,strong:false},{crit:'시장성',score:3,strong:false},{crit:'팀 역량',score:3,strong:true}];
  const c={criteria:['수익 구조','시장성','팀 역량'],paragraphs,secs,planNumbers,previous,changed};
  const ans={scores:[
    {crit:'수익 구조',score:3,strong:true,why:'단골이 매달 다시 삽니다.',para:6,quote:'단골 300명이 매달 다시 삽니다'},
    {crit:'시장성',score:3,strong:true,why:'좋습니다.',para:2,quote:'열 명 가운데 여섯이'},
    {crit:'팀 역량',score:3,strong:false,why:'좋습니다.',para:2,quote:'열 명 가운데 여섯이'},
  ],line:'좋습니다.',reacts:[]};
  const r=sc.checkScore(ans,c);
  const by=Object.fromEntries(r.scores.map(s=>[s.crit,s]));
  assert.equal(by['수익 구조'].strong,true,'바뀐 문장의 인용으로 강점이 된다');
  assert.equal(by['시장성'].strong,false,'바뀌지 않은 문장으로는 강점이 되지 않는다');
  assert.equal(by['팀 역량'].strong,true,'근거 없이 강점을 내리지 않는다');
  assert.equal(r.dropped.held,2);
  // 표시가 바뀐 때처럼 보류한다. 새 한마디 · 인용을 남기지 않아 기준 지문도 앞 것을 잇는다(GPT 검수 GA1)
  for(const crit of ['시장성','팀 역량'])assert.deepEqual([by[crit].held,by[crit].why,by[crit].quote,by[crit].para],[true,sc.FIXED.held,'',0],crit);
  assert.equal(by['수익 구조'].held,undefined);
  // 근거로 든 글이 빠진 항목은 강점을 내릴 수 있고, 바뀌지 않은 문장의 인용은 남기지 않는다
  const gone=sc.checkScore(ans,{...c,removed:crit=>crit==='팀 역량'});
  const m=gone.scores.find(s=>s.crit==='팀 역량');
  assert.deepEqual([m.score,m.strong,m.para,m.quote],[3,false,0,'']);
  // 보류한 항목은 앞 강점을 그대로 둔다
  const held=sc.checkScore({...ans,scores:[{crit:'팀 역량',score:2,strong:false,why:'모자랍니다.',para:0,quote:''}]},{...c,criteria:['팀 역량'],previous:[{crit:'팀 역량',score:3,strong:true}]});
  assert.deepEqual([held.scores[0].score,held.scores[0].strong,held.scores[0].held],[3,true,true]);
});

test('지시문: 계획서를 JSON으로 싸고, 채점표를 건네며, 다시 심사면 앞 표시와 바뀐 문단 번호를 건넨다. 4만 자를 넘으면 묶음마다 앞부분만', () => {
  const judge=sc.JUDGES[0];
  const p=sc.scorePrompt({judge,paragraphs,secs,criteria});
  assert.match(p,/심사위원 Opus/);
  assert.match(p,/"n":2,"text":"바쁜 직장인/);
  assert.match(p,/score 3은 ○ 갖춤/);
  assert.match(p,/"crit":"신뢰성","x":"숫자와 주장에 근거가 없다","t":"근거가 일부에만 있다","o":"모든 숫자에 출처나 셈이 있다","v":"출처가 공공 자료나 직접 잰 기록이다"/);
  assert.match(p,/✕면 무엇을 계획서 어디에 써야 하는지/);
  assert.doesNotMatch(p,/다시 심사/);
  const again=sc.scorePrompt({judge,paragraphs,secs,criteria,previous:[{crit:'시장성',score:2,strong:false,why:'옛 까닭'}],changed:new Map([['5:0',[[0,3]]],['5:1',[[0,3]]]])});
  assert.match(again,/앞 심사의 표시: \[\{"crit":"시장성","score":2,"strong":false\}\]/);
  assert.match(again,/바뀐 문단 번호: \[6\]/);
  assert.doesNotMatch(again,/옛 까닭/,'앞 까닭은 건네지 않는다(설계 검토 D9)');
  // 붙여 넣은 공고 기준에는 공통 뜻을 쓴다. 기본 항목과 이름이 같아도 기본 여섯 그대로가 아니면 공통 뜻(GPT 검수 GA2)
  assert.match(sc.scorePrompt({judge,paragraphs,secs,criteria:['기술성']}),/"crit":"기술성","x":"심사에 꼭 필요한 것이 없다","t":"있지만 모자라다","o":"이 항목은 됐다"/);
  assert.deepEqual(sc.rubricFor(['문제 인식','기술성']).map(r=>r.o),['이 항목은 됐다','이 항목은 됐다']);
  assert.equal(sc.rubricFor(criteria)[0].o,'누가, 언제, 얼마나 불편한지 숫자로 보인다');
  assert.equal(sc.rubricFor(criteria,true)[0].o,'이 항목은 됐다','붙여 넣은 기준은 기본 여섯과 같아도 공통 뜻(2회차 GA1)');
  assert.match(sc.scorePrompt({judge,paragraphs,secs,criteria,rubric:sc.rubricFor(criteria,true)}),/"crit":"문제 인식","x":"심사에 꼭 필요한 것이 없다"/);
  const long=Array.from({length:30},(_,i)=>({text:'가'.repeat(2000)+i,level:null,toc:false,inTable:false}));
  const body=sc.planBody(long,[{id:1,title:'a',head:null,paras:[...Array(15).keys()]},{id:2,title:'b',head:null,paras:[...Array(15).keys()].map(i=>i+15)}]);
  assert.ok(body.reduce((n,r)=>n+r.text.length,0)<=6000);
  assert.deepEqual(body.map(r=>r.n),[1,2,16,17]);
});

test('표시 수와 가장 약한 항목: 답한 심사위원만 세고, ✕는 2 · △는 1로 친 합이 가장 큰 항목', () => {
  const j=s=>({status:'ok',scores:criteria.map(crit=>({crit,score:3,strong:false,...(s[crit]||{})}))});
  const r=sc.summary([j({'팀 역량':{score:1},'시장성':{score:2},'신뢰성':{score:3,strong:true}}),j({'팀 역량':{score:2},'시장성':{score:2}}),{status:'failed',reason:'LIMIT'}],criteria);
  assert.deepEqual(r.tally,{v:1,o:7,t:3,x:1});
  assert.deepEqual(r.weakest,{crit:'팀 역량',sev:3});
  // 합이 같으면 평가 기준 차례에서 앞선 항목
  assert.equal(sc.summary([j({'시장성':{score:2},'현실성':{score:2}})],criteria).weakest.crit,'현실성');
  // 모두 ○면 가장 약한 항목이 없다
  assert.equal(sc.summary([j({})],criteria).weakest,null);
  assert.equal(sc.summary([{status:'failed'}],criteria),null);
});

test('표시 수 한 줄: 세 단계는 ✓를 ○에 합치고, 네 단계는 나눠 쓴다', () => {
  const t={v:3,o:5,t:6,x:4};
  assert.equal(sc.tallyText(t),'○ 8 · △ 6 · ✕ 4');
  assert.equal(sc.tallyText(t,4),'✓ 3 · ○ 5 · △ 6 · ✕ 4');
});

test('GPT 검수 GA7 · GA8 · 2회차 GA3 · GA4 · GA12: 그대로 둔 표시에는 옛 까닭을 남기지 않고, 조각을 걸치거나 두 번 나오는 인용은 받지 않으며, 부호는 견주지 않는다', () => {
  // GA7: 300만 원 문장을 500만 원으로 고친 판. 앞 까닭의 300만 원은 남기지 않는다
  const now=[{text:'연매출은 500만 원입니다.',level:null,toc:false,inTable:false}];
  const nowNums=ck.numbers(now[0].text).set;
  const previous=[{crit:'시장성',score:2,why:'연매출 300만 원이 작습니다.',para:1,quote:'연매출은 300만 원입니다'}];
  const r=sc.checkScore(one('시장성',{score:3}),
    {criteria:['시장성'],paragraphs:now,secs:[{id:1,title:'a',head:null,paras:[0]}],planNumbers:nowNums,previous,changed:new Set()});
  assert.equal(r.scores[0].score,2);
  assert.equal(r.scores[0].held,true);
  assert.equal(r.scores[0].why,sc.FIXED.held,'사라진 300만 원을 남기지 않는다');
  assert.equal(r.scores[0].quote,'','사라진 문장의 인용을 남기지 않는다');
  // GA8: 넣은 초안은 줄로 갈라 앞 문단과 걸친 인용을 받지 않는다
  const joined=[{text:'We sell software.\nNew distribution starts in May.',parts:['We sell software.','New distribution starts in May.'],level:null,toc:false,inTable:false}];
  const g=sc.checkScore(one('시장성',{score:3,para:1,quote:'software. New distribution'}),
    {criteria:['시장성'],paragraphs:joined,secs:[{id:1,title:'a',head:null,paras:[0]}],planNumbers:new Set()});
  assert.equal(g.scores[0].quote,'');
  // 2회차 GA12: 넣은 초안의 두 줄을 걸친 인용은 받지 않는다
  const lines=[{text:'We sell software.\nNew distribution starts in May.\nPartners handle orders.',parts:['We sell software.','New distribution starts in May.','Partners handle orders.'],level:null,toc:false,inTable:false}];
  const ctx1={criteria:['시장성'],paragraphs:lines,secs:[{id:1,title:'a',head:null,paras:[0]}],planNumbers:new Set()};
  assert.equal(sc.checkScore(one('시장성',{score:3,para:1,quote:'May. Partners handle'}),ctx1).scores[0].quote,'');
  // 2회차 GA3: 원래 글과 넣은 초안에 같은 문장이 있으면 어느 쪽인지 모르므로 받지 않는다
  const dup=[{text:'We sell software.\nWe sell software.',parts:['We sell software.','We sell software.'],level:null,toc:false,inTable:false}];
  const d=sc.checkScore(one('시장성',{score:3,para:1,quote:'We sell software'}),
    {criteria:['시장성'],paragraphs:dup,secs:[{id:1,title:'a',head:null,paras:[0]}],planNumbers:new Set(),previous:[{crit:'시장성',score:2}],changed:new Map([['0:1',[[0,17]]]])});
  assert.equal(d.scores[0].score,2,'두 번 나오는 인용으로는 표시가 바뀌지 않는다');
  // 2회차 GA4: 날짜의 「-」와 같은 값의 다른 적기는 맞는 글이다. 부호는 견주지 않는다(받아들인 한계)
  const plan=[{text:'2026년 11월 27일에 엽니다. 순손실은 -300만 원입니다.',level:null,toc:false,inTable:false}];
  const nums=ck.numbers(plan[0].text).set;
  const n=sc.checkScore({...one('수익 구조',{score:2,why:'2026-11-27에 열고 순손실이 -3,000,000원입니다.'}),line:'2026-11-27에 엽니다.'},
    {criteria:['수익 구조'],paragraphs:plan,secs:[{id:1,title:'a',head:null,paras:[0]}],planNumbers:nums});
  assert.equal(n.scores[0].why,'2026-11-27에 열고 순손실이 -3,000,000원입니다.');
  assert.equal(n.line,'2026-11-27에 엽니다.');
  // 계획서에 없는 숫자는 여전히 막는다
  const x=sc.checkScore(one('수익 구조',{score:2,why:'순손실이 500만 원입니다.'}),
    {criteria:['수익 구조'],paragraphs:plan,secs:[{id:1,title:'a',head:null,paras:[0]}],planNumbers:nums});
  assert.equal(x.scores[0].why,sc.FIXED.why('수익 구조'));
});

test('문장 나누기: 마침표 · 물음표 · 줄바꿈에서 끊고, 숫자 안의 점에서는 끊지 않는다', () => {
  const t='첫 문장입니다. 둘째 문장? 셋째\n넷째 2.5억 원입니다.';
  assert.deepEqual(sc.sentencesOf(t).map(x=>t.slice(x.from,x.to).trim()),['첫 문장입니다.','둘째 문장?','셋째','넷째 2.5억 원입니다.']);
  assert.deepEqual(sc.sentencesOf(''),[]);
});

test('3회차 GA2: 인용이 몇 번 나오는지는 조각마다 센다. 조각을 이은 자리를 숫자 중간으로 보지 않는다', () => {
  const ps=['첫해 예상 주문 수는 100','5만 원 이상 구매에는 배송비가 없습니다.'];
  const paras=[{text:ps.join('\n'),parts:ps,level:null,toc:false,inTable:false}];
  const r=sc.checkScore(one('시장성',{score:3,why:'근거가 있습니다.',para:1,quote:'예상 주문 수는 100'}),
    {criteria:['시장성'],paragraphs:paras,secs:[{id:1,title:'a',head:null,paras:[0]}],planNumbers:ck.numbers(ps.join('\n')).set,previous:[{crit:'시장성',score:2}],changed:new Map([['0:0',[[0,ps[0].length]]]])});
  assert.equal(r.scores[0].quote,'예상 주문 수는 100');
  assert.equal(r.scores[0].score,3);
});

test('3회차 GA4: 기준 뒤로 지운 문장이 있으면 인용 없이 내려간 표시는 받고, 오른 표시는 여전히 바뀐 문장이 있어야 한다', () => {
  const previous=criteria.map(crit=>({crit,score:2}));
  const r=sc.checkScore(full({'시장성':{score:1,why:'근거가 빠졌습니다.'},'수익 구조':{score:3,why:'좋아졌습니다.'}}),{...ctx,previous,changed:new Map(),removed:()=>true});
  const by=Object.fromEntries(r.scores.map(s=>[s.crit,s]));
  assert.equal(by['시장성'].score,1);
  assert.equal(by['수익 구조'].score,2);
  const kept=sc.checkScore(full({'시장성':{score:1,why:'근거가 빠졌습니다.'}}),{...ctx,previous,changed:new Map(),removed:()=>false});
  assert.equal(kept.scores.find(s=>s.crit==='시장성').score,2,'지운 문장이 없으면 그대로');
});

test('4회차 GA2 · GA3: 지운 글이 있으면 지시문이 내리라고 알리고, 지운 글 때문에 내린 표시에는 바뀌지 않은 문장의 인용을 남기지 않는다', () => {
  const p=sc.scorePrompt({judge:sc.JUDGES[0],paragraphs,secs,criteria,previous:[{crit:'시장성',score:3}],changed:new Map(),removed:['시장성']});
  assert.match(p,/근거로 든 글이 빠진 항목: \["시장성"\]/);
  assert.match(p,/그 밖의 항목은 앞 표시\(score와 strong\)를 그대로 둔다/);
  assert.doesNotMatch(sc.scorePrompt({judge:sc.JUDGES[0],paragraphs,secs,criteria,previous:[{crit:'시장성',score:3}],changed:new Map()}),/빠진 글/);
  const previous=criteria.map(crit=>({crit,score:3}));
  const r=sc.checkScore(full({'시장성':{score:2,why:'근거가 빠졌습니다.',para:6,quote:'단골 300명이 매달 다시 삽니다'}}),{...ctx,previous,changed:new Map(),removed:()=>true});
  const m=r.scores.find(s=>s.crit==='시장성');
  assert.deepEqual([m.score,m.para,m.quote],[2,0,'']);
});

test('6회차 GA3: 지운 근거의 예외는 「그 밖의 항목은 앞 표시를 그대로 둔다」와 한 지시 안에서 말한다', () => {
  const p=sc.scorePrompt({judge:sc.JUDGES[0],paragraphs,secs,criteria,previous:[{crit:'시장성',score:3}],changed:new Map(),removed:['시장성']});
  assert.match(p,/근거로 든 글이 빠진 항목: \["시장성"\]\. 이 항목은 지금 계획서로 다시 고른다\. 남은 근거가 약하거나 없으면 인용 없이 표시를 내려도 된다\. 그 밖의 항목은 앞 표시\(score와 strong\)를 그대로 둔다\./);
});
