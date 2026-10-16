'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{performance}=require('node:perf_hooks');
const C=require('../experiences/synk-account/src/member-statement-contract.cjs');
const V7=require('../experiences/synk-account/src/member-statement-v7.cjs');
const tuple=m=>[m.field,m.value,m.polarity,m.condition];
const canonical=xs=>xs.map(JSON.stringify).sort();
function exact(text,want){const p=C.parseMemberStatement(text);assert.deepEqual(canonical(p.meanings.map(tuple)),canonical(want),text);assert.equal(p.question,null,text);for(const m of p.meanings)assert.equal(text.slice(m.evidence.start,m.evidence.end),m.evidence.quote,text);return p;}
const actions=[
 ['혼자 손대 보며 시도하는','support','independent'], ['누군가와 함께 해보는','support','together'],
 ['예시부터 확인하는 도움','support','example'], ['한 단계씩 도움을 받는','support','step'],
 ['필요한 도움을 직접 선택하는','support','choose'], ['짧은 분량의 설명','explanation','brief'],
 ['보통 길이로 받는 설명','explanation','standard'], ['자세하게 설명을 받는','explanation','detailed'],
 ['듣는 연습','practice-mode','listening'], ['읽는 연습','practice-mode','reading'],
 ['듣기와 읽기를 한데 묶은 연습','practice-mode','mixed'], ['글로 의견을 주고받는 소통','communication','written'],
 ['말로 하는 소통','communication','spoken'], ['남의 생각을 듣고 정리하는','communication','listen-organize'],
 ['제 의견부터 말하는','communication','share-first'], ['계획부터 세워 일하는','work-style','plan-first'],
 ['업무를 해보며 조정하는','work-style','try-adjust'], ['일의 우선순위를 매기는','work-style','prioritize'],
 ['한 번에 한 가지를 처리하는','work-style','single-task'], ['판단에 쓸 자료와 근거를 확인하는','decision','evidence'],
 ['판단할 선택지를 여러 개 놓고 비교하는','decision','compare-options'], ['남과 의논해서 판단하는','decision','consult'],
 ['직접 겪은 내용을 참고하는','decision','experience'], ['전체 개요부터 보는','explanation-detail','overview-first'],
 ['핵심 근거를 자세히 알아보는','explanation-detail','reasons-detail'], ['길게 이어지는 설명','explanation-detail','long-flow']
];

test('ko7 bytes, old parse, answer replay and confirmed rows remain immutable',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(require.resolve('../experiences/synk-account/src/member-statement-v7.cjs'))).digest('hex'),'9289ce1899c8fe0b847391a75c661628c898d862309344f60d8c71699b15aa5e');
 const texts=['혼자 시도하는 게 좋아요','설명을 들으면 이해하기 좋아요','상황에 따라 다르게 하고 싶어요','회의에서는 말로 소통하는 게 좋은 것 같아요','처음에는 예시를 먼저 보고 싶고 그 예시를 본 다음에는 혼자 시도하고 싶어요'];
 for(let v=1;v<=7;v++)for(const [i,text]of texts.entries()){
  const old=require(`../experiences/synk-account/src/member-statement-v${v}.cjs`),clarifications=[];let p=old.parseMemberStatement(text);
  assert.deepEqual(C.parseMemberStatement(text,{parserVersion:old.PARSER_VERSION}),p,text);
  while(p.question){const o=p.question.options.find(x=>!['unsure','skip'].includes(x.id))||p.question.options.at(-1);clarifications.push({questionId:p.question.id,optionId:o.id});p=old.parseMemberStatement(text,{clarifications});assert.deepEqual(C.parseMemberStatement(text,{parserVersion:old.PARSER_VERSION,clarifications}),p,text);}
  if(p.meanings.length){const row={id:`00000000-0000-4000-8000-${String(v*10+i+1).padStart(12,'0')}`,parserVersion:old.PARSER_VERSION,text,at:'2026-10-16T06:00:00.000Z',confirmedAt:'2026-10-16T06:00:00.000Z',meanings:p.meanings};if(v>1)row.clarifications=clarifications;assert.deepEqual(C.validateMemberStatement(row),old.validateMemberStatement(row),text);}
 }
});

test('existing semantic scopes accept noun and verbal condition variants across fields and polarity',()=>{
 const scopes=[['처음 시도하는 때에는','first-try'],['내용이 익숙할 때에는','familiar'],['같은 익숙한 상황이라면','familiar'],['바쁠 때라면','busy'],['회의를 할 때는','meeting'],['함께 일할 때는','teamwork'],['일을 계획하는 상황에서는','planning'],['결정하는 때에는','decision']];
 for(const [scope,condition]of scopes)for(const [action,field,value]of actions)for(const [ending,polarity]of [['걸 좋아해요','prefer'],['걸 원치 않아요','avoid']])exact(`${scope} ${action} ${ending}`,[[field,value,polarity,condition]]);
});

test('new finite endings retain both independent clauses and their own polarities',()=>{
 for(const [left,lf,lv]of actions.slice(0,8))for(const [right,rf,rv]of actions.slice(8,12))for(const [join,polarity]of [['걸 원치 않고','avoid'],['게 마음에 들고','prefer'],['게 좋으며','prefer'],['게 제게 잘 맞지만','prefer']]){
  exact(`${left} ${join} ${right} 것도 좋아요`,[[lf,lv,polarity,null],[rf,rv,'prefer',null]]);
 }
 exact('회의를 할 때는 글로 하는 소통을 원치 않고 판단할 대안을 비교하는 것도 좋아요',[['communication','written','avoid','meeting'],['decision','compare-options','prefer','meeting']]);
});

test('nominal and additive lists share a declared predicate without inventing an opposite',()=>{
 const nominal=['예시부터 보는 도움, 계획부터 세우는 업무 방식, 글로 하는 소통을 저는 모두','읽기 연습과 요리하는 활동은 둘 다 제가'];
 exact(nominal[0]+' 선호해요',[['support','example','prefer',null],['work-style','plan-first','prefer',null],['communication','written','prefer',null]]);
 exact(nominal[0]+' 선호하지 않아요',[['support','example','avoid',null],['work-style','plan-first','avoid',null],['communication','written','avoid',null]]);
 exact(nominal[1]+' 좋아하는 거예요',[['practice-mode','reading','prefer',null],['topic','cooking','prefer',null]]);
 exact('한 단계씩 도움을 받기도, 판단을 다른 사람과 의논하기도 좋아요',[['support','step','prefer',null],['decision','consult','prefer',null]]);
 for(const text of ['혼자 해보고 글로 소통하는 방식은 싫어요','글로 소통하고 계획을 세운다는 말을 좋아하지 않아요','읽기와 요리 중 하나가 좋아요','한 단계씩 도움을 받기도 하겠지만 아직 모르겠어요'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('typed adjacent references suppress only a redundant already understood claim',()=>{
 const rows=[
  ['영상 제작과 진로 탐색에 관심이 있어요. 두 분야를 알아보는 게 좋아요',[['topic','content-video','prefer',null],['topic','career-planning','prefer',null]]],
  ['사진 촬영에 관심이 있어요. 이 분야가 좋고 글로 소통하는 것도 좋아요',[['topic','photography','prefer',null],['communication','written','prefer',null]]],
  ['업무를 직접 해보며 조정하는 걸 좋아해요. 그런 업무 방식이 편하고 독서에 관심이 있어요',[['work-style','try-adjust','prefer',null],['topic','reading-books','prefer',null]]],
  ['단계별로 도움받는 방식을 원해요. 그렇게 도움받는 게 편하며 보통 길이의 설명이 좋아요',[['support','step','prefer',null],['explanation','standard','prefer',null]]]
 ];for(const [text,want]of rows)exact(text,want);
 for(const text of ['이 분야가 좋아요','그런 업무 방식이 편해요','두 분야를 알아보는 게 좋아요','그렇게 도움받는 게 편해요']){const p=C.parseMemberStatement(text);assert.deepEqual(p.meanings,[],text);assert.ok(p.question,text);}
 for(const suffix of ['그런 소통 방식이 좋아요','두 분야를 알아보는 게 좋아요','이 분야가 친구에게 좋아요','이 분야가 좋은 것 같아요','이 분야가 좋다는 뜻은 아니에요','이 분야가 좋아요?','이 분야를 강요하고 싶어요']){const p=C.parseMemberStatement('사진 촬영에 관심이 있어요. '+suffix);assert.ok(p.unresolved.length,suffix);assert.ok(p.meanings.every(m=>m.field==='topic'&&m.value==='photography'),suffix);}
});

test('an example followed by the explicit attempt scope retains the antecedent condition',()=>{
 for(const [scope,condition]of [['처음 시도하는 때에는','first-try'],['내용이 익숙할 때에는','familiar'],['바쁠 때라면','busy']])exact(`${scope} 예시부터 보는 방식을 원해요. 예시를 본 다음 시도할 때는 필요한 도움을 선택하고 싶고 설명도 짧게 받고 싶어요`,[['support','example','prefer',condition],['support','choose','prefer',condition+'-after-example'],['explanation','brief','prefer',condition+'-after-example']]);
 // A contrast without an explicit repeated condition remains a real question.
 const p=C.parseMemberStatement('결정하는 때에는 남과 의논하는 방식은 싫지만 제가 직접 경험한 것을 참고하는 방식은 좋아요');assert.deepEqual(p.meanings.map(tuple),[['decision','consult','avoid','decision']]);assert.ok(p.question);assert.ok(p.unresolved.some(x=>x.reason==='condition'));
});

test('new surface vocabulary cannot erase another actor, unsupported scope, obligation or reported speech',()=>{
 const prefixes=['동료는','도서관 사서는','우리 안내 담당자는','팀원들에게는','휴일에만','비 오는 날에는','이번 시험에서만','친구가 시켜서','운영 규정 때문에','만약 그렇게 해야 한다면','예전에는'];
 for(const [action]of actions)for(const prefix of prefixes){const text=prefix+' '+action+' 걸 좋아하고 글로 소통하는 것도 좋아해요';assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);}
 for(const text of ['음악을 즐기는 친구를 만났어요','운동하는 활동을 좋아하는 동료가 있어요','사진을 찍는 게 좋아서 카메라를 사는 사람을 알아요','저는 "내용이 익숙할 때에는 단계별로 도움받는 게 좋아요"라는 말을 받아 적었어요','원치 않는다는 말을 하지 않았어요','계획부터 세워 일하는 것을 선호하도록 강요받았어요'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('full lexical consumption and action order remain required',()=>{
 for(const text of ['일을 시작한 뒤 계획부터 세우는 걸 좋아해요','정리한 다음 남의 생각을 듣는 게 좋아요','조정하고 업무를 직접 해보는 걸 좋아해요','세부 설명부터 듣고 개요를 먼저 보는 게 좋아요','예시를 먼저 보지 않는 도움이 좋아요','보통 길이로 받는 빨간 설명이 좋아요','판단에 쓸 자료를 거짓으로 만드는 게 좋아요','필요한 도움을 다른 사람에게 강요하는 게 좋아요','그와 별개로 신발을 사는 분야에도 관심이 있어요'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('previous independent96 remains unchanged development data with the original first-pass score',()=>{
 const bytes=fs.readFileSync(require.resolve('./fixtures/member-statement-v8-disclosed-evaluation.json'));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'c984ac1659ff189e8491a2c63189beee050b0ea1eb5bded07507f9b56dbab2e2');const f=JSON.parse(bytes);assert.equal(f.rows.length,96);assert.equal(f.originalFirstPass.directSuccess,25);let direct=0,question=0;
 for(const row of f.rows){const p=C.parseMemberStatement(row.text),actual=canonical(p.meanings.map(tuple)),expected=canonical(row.expected);assert.ok(actual.every(x=>expected.includes(x)),row.id+' false meaning');for(const m of p.meanings)assert.equal(row.text.slice(m.evidence.start,m.evidence.end),m.evidence.quote,row.id);if(row.mode==='direct'){if(JSON.stringify(actual)===JSON.stringify(expected)&&!p.question)direct++;if(p.question)question++;}else assert.deepEqual(p.meanings,[],row.id);}
 assert.equal(direct,69);assert.equal(question,1);
});

test('confirmation remains bound to current parser, exact source span and replay',()=>{
 const text='바쁠 때라면 글로 의견을 주고받는 소통을 원치 않고 보통 길이로 받는 설명이 좋아요',p=C.parseMemberStatement(text);assert.equal(p.parserVersion,'member-statement-ko-8');assert.equal(p.question,null);
 const row={id:'00000000-0000-4000-8000-000000000888',parserVersion:p.parserVersion,text,at:'2026-10-16T06:00:00.000Z',confirmedAt:'2026-10-16T06:00:00.000Z',meanings:p.meanings,clarifications:[]};assert.deepEqual(C.validateMemberStatement(row),row);
 for(const mutate of [r=>r.meanings[0].condition=null,r=>r.meanings[0].polarity='prefer',r=>r.meanings[0].evidence.start++,r=>r.text+=' 음악이 좋아요',r=>r.parserVersion='member-statement-ko-7']){const bad=structuredClone(row);mutate(bad);assert.throws(()=>C.validateMemberStatement(bad));}
});

test('bounded complex parsing respects the 500-code-point input boundary',()=>{
 const samples=['그리고 '.repeat(167), '혼자 하며 '.repeat(100),'회의를 할 때는 '.repeat(60),'그런 업무 방식이 '.repeat(60),'자료와 근거, '.repeat(90),'좋고 싫고 원치 않고 '.repeat(50),'예시를 본 다음 시도할 때는 '.repeat(40),'낯선 문장💫 '.repeat(80)].map(x=>Array.from(x).slice(0,500).join(''));
 let max=0;for(const text of samples)for(let i=0;i<20;i++){const start=performance.now();const p=C.parseMemberStatement(text);max=Math.max(max,performance.now()-start);assert.ok(p.meanings.length<=C.MEMBER_STATEMENT_LIMITS.meanings);for(const m of p.meanings)assert.equal(text.slice(m.evidence.start,m.evidence.end),m.evidence.quote);}
 assert.ok(max<150,`bounded sample exceeded 150ms: ${max}`);assert.throws(()=>C.parseMemberStatement('가'.repeat(501)));
});

test('causal liking inside a relative object never becomes the writer preference for arbitrary roles',()=>{
 const roles=['연구원','운전사','기획자','우체부','개발자','수강생','나그네','건축가','낯선 방문객'];
 const predicates=['저는 알아요','만나요','저는 초대해요','존경해요','소개받았어요'];
 for(const role of roles)for(const predicate of predicates){
  const text=`음악을 좋아해서 공연을 찾아다니는 ${role}을 ${predicate}.`;
  assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
  assert.deepEqual(C.parseMemberStatement(text.replace(/\s/gu,'')).meanings,[],text+' compact');
 }
 for(const text of ['독서를 좋아해서 책을 고르던 사서를 저는 만나요','요리를 좋아해서 음식을 준비하는 방문자를 알아요','사진을 좋아해서 전시회를 보러 가는 낯선 손님을 저는 초대해요','글로 소통하는 게 편해서 메일을 쓰는 번역가를 저는 기억해요'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
 exact('음악을 좋아해서 공연을 찾아다녀요',[['topic','music','prefer',null]]);
 exact('사진 찍는 걸 좋아해서 카메라를 챙겨요',[['topic','photography','prefer',null]]);
});

test('syntactic reason, purpose and concession retain only independently declared main preferences',()=>{
 const adjuncts=['순서를 잊기 쉬워서','한 번에 받아들이는 정보가 많아서','보고 나서 다시 생각할 수 있어서','처리할 결과가 엇갈리니까','결정을 오래 기억하려고','처음 시작할 위치를 정하기 위해','참고할 흔적을 남기려고','마무리까지 오래 걸리더라도'];
 for(const adjunct of adjuncts)for(const [action,field,value]of actions.slice(0,6))for(const [ending,polarity]of [['걸 좋아해요','prefer'],['걸 선호하지 않아요','avoid']])exact(`${adjunct} 저는 ${action} ${ending}`,[[field,value,polarity,null]]);
 exact('준비가 오래 걸리더라도 저는 회의할 때 글로 소통하는 게 좋고 자료를 확인하며 판단하는 것도 좋아해요',[['communication','written','prefer','meeting'],['decision','evidence','prefer','meeting']]);
 for(const text of ['월요일에만 잊지 않으려고 혼자 시도하는 게 좋아요','친구가 하라고 시켜서 글로 소통하는 게 좋아요','만약 장비가 생겨도 글로 소통하는 게 좋아요','연구원은 집중하려고 글로 소통하는 게 좋아요','비가 올 때 집중이 잘돼서 글로 소통하는 게 좋아요','부장님이 바쁘더라도 혼자 시도하는 게 좋아요','규정 때문에 할 수밖에 없어서 글로 소통하는 게 좋아요'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('discourse asides cannot change the prior scope, withdraw a preference or open a quoted self',()=>{
 exact('회의할 때 저는 글로 소통하는 게 좋고, 말수가 적다는 뜻은 아니고, 자료를 확인해 판단하는 것도 좋아해요',[['communication','written','prefer','meeting'],['decision','evidence','prefer','meeting']]);
 exact('저는 독서를 좋아하고, 잘하는 것과는 별개로, 운동도 좋아해요',[['topic','reading-books','prefer',null],['topic','exercise','prefer',null]]);
 exact('팀장은 계획부터 세우는 게 좋다고 했고, 저는 글로 소통하는 게 좋아요',[['communication','written','prefer',null]]);
 exact('친구는 게임을 좋아하지만 제 취향은 짧은 설명이고 저는 글로 소통하는 게 좋아요',[['explanation','brief','prefer',null],['communication','written','prefer',null]]);
 for(const quote of [['"','"'],['“','”'],['「','」'],['‘','’']]){const text=quote[0]+'친구는 혼자 시도하는 게 좋고, 저는 지금 글로 소통하는 게 좋아요'+quote[1]+'라는 글을 읽었어요';assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);}
 for(const text of ['사진 촬영에 관심이 있어요. 사진이 좋다는 뜻은 아니지만, 글로 소통하는 건 좋아해요','회의할 때는 글로 소통하는 게 좋지만, 모든 상황이 그렇다는 뜻은 아니고, 말로 소통하는 것도 좋아요'])assert.ok(C.parseMemberStatement(text).question,text);
});

test('focus and denied implications do not assert the opposite of the denied implication',()=>{
 exact('저는 장황한 설명을 싫어하는 것이지 자세한 근거가 싫은 건 아니에요. 핵심 근거를 자세히 듣는 건 좋아해요',[['explanation-detail','long-flow','avoid',null],['explanation-detail','reasons-detail','prefer',null]]);
 const p=C.parseMemberStatement('저는 글로 소통하는 것을 좋아하는 것이지 말로 소통하는 게 싫다는 뜻은 아니에요');assert.ok(p.meanings.every(m=>m.value!=='spoken'));
 for(const text of ['선호한다고 말한 것이지 제가 좋아한다는 뜻은 아니에요','혼자 하는 걸 싫어한다는 말을 하지 않았어요','예전에는 장황한 설명을 싫어하는 것이지 자세한 근거가 싫은 건 아니었어요'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('first failed120 retains unchanged labels and first score as disclosed development coverage',()=>{
 const bytes=fs.readFileSync(require.resolve('./fixtures/member-statement-v8-disclosed-followup.json')),f=JSON.parse(bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'2ba168c783d96a8eb5521c0dcc1e89935d6711acc4805fc67f0bfcb74227f9f8');assert.equal(f.cases.length,120);
 // First sealed result was 36/90, with49 questions. This is development coverage.
 const policyQuestions=new Set(['D021','D039','D056','D081']);let direct=0,questions=0;
 for(const row of f.cases){const p=C.parseMemberStatement(row.text),actual=canonical(p.meanings.map(tuple)),expected=canonical(row.expect);assert.deepEqual(actual,expected,row.id+' '+row.text);for(const m of p.meanings)assert.equal(row.text.slice(m.evidence.start,m.evidence.end),m.evidence.quote,row.id);if(row.mode==='direct'){if(!p.question)direct++;if(p.question)questions++;assert.equal(!!p.question,policyQuestions.has(row.id),row.id);}}
 assert.equal(direct,86);assert.equal(questions,4);
});

test('a comma or harmless parenthesis cannot detach a condition before its own self subject',()=>{
 for(const [scope,condition]of [['바쁠 때는','busy'],['회의할 때는','meeting'],['익숙한 내용에서는','familiar'],['처음 하는 일에서는','first-try']]){
  for(const [action,field,value]of [['짧은 설명을 좋아해요','explanation','brief'],['사진 촬영에 관심이 있어요','topic','photography'],['글로 소통하는 게 좋아요','communication','written']])exact(`${scope}, 저는 ${action}`,[[field,value,'prefer',condition]]);
  exact(`${scope}, 분야가 무엇이든, 예시를 먼저 보고 싶고 저는 독서도 좋아해요`,[['support','example','prefer',condition],['topic','reading-books','prefer',null]]);
 }
 const text='익숙해지기 전의 부담을 줄이려고 처음 배우는 내용은 단계별 안내를 받고 싶고, 저는 음악도 좋아해요';exact(text,[['support','step','prefer','first-try'],['topic','music','prefer',null]]);
 const ambiguity=JSON.parse(fs.readFileSync(require.resolve('./fixtures/member-statement-v8-disclosed-condition-findings.json')));
 for(const row of ambiguity.findings){const p=C.parseMemberStatement(row.text);if(row.classification==='clear-condition-scope-error'||row.classification==='clear-condition-loss')assert.deepEqual(canonical(p.meanings.map(tuple)),canonical(row.expected),row.id);else assert.deepEqual(canonical(p.meanings.map(tuple)),canonical(row.candidateActual),row.id+' original gold has multiple readings; no unconditional preference is fabricated');}
});

test('a stated preference in the reason clause is never silently discarded as neutral background',()=>{
 for(const text of ['책 읽는 걸 좋아해서 음악이 관심사예요','책 읽는 걸 좋아해서 친구는 독서를 좋아해요','글로 소통하는 게 편해서 음악을 좋아해요','혼자 시도하는 게 좋아서 사진 촬영이 관심사예요'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
 exact('책에 푹 빠져 읽는 시간을 좋아해서 독서는 늘 제 관심사예요',[['topic','reading-books','prefer',null]]);
});

test('an open condition survives comma insets until its actual main clause, with source evidence',()=>{
 const scopes=[['바쁠 때는','busy'],['회의할 때는','meeting'],['익숙한 내용에서는','familiar'],['처음 하는 일에서는','first-try'],['결정할 때는','decision'],['함께 일할 때는','teamwork'],['일을 계획하는 때에는','planning'],['예시를 본 다음에는','after-example']];
 const insets=['사소한 누락을 줄일 수 있으니까','잘한다는 평가와는 별개로','답이 늦게 나와도','모두의 결론이 같지 않아도','완성된 답을 외우려는 게 아니라','결과가 완벽하지 않아도'];
 for(const [scope,condition]of scopes)for(const inset of insets)for(const [action,field,value]of [['짧은 설명을','explanation','brief'],['글로 소통하는 걸','communication','written'],['음악을','topic','music']])for(const [ending,polarity]of [['좋아해요','prefer'],['선호하지 않아요','avoid']])for(const self of ['','저는 ']){
  const text=`${scope}, ${inset}, ${self}${action} ${ending}`,p=C.parseMemberStatement(text);assert.deepEqual(p.meanings.map(tuple),[[field,value,polarity,condition]],text);assert.equal(p.question,null,text);assert.equal(p.meanings[0].evidence.start,0,text);assert.equal(text.slice(p.meanings[0].evidence.start,p.meanings[0].evidence.end),p.meanings[0].evidence.quote,text);
 }
 exact('바쁠 때는, 사소한 누락을 줄일 수 있으니까, 결과가 완벽하지 않아도, 저는 짧은 설명이 좋아요',[['explanation','brief','prefer','busy']]);
 const bytes=fs.readFileSync(require.resolve('./fixtures/member-statement-v8-disclosed-condition-insets.json')),f=JSON.parse(bytes);
 assert.equal(f.findings.length,6);assert.equal(f.firstGoldAndScoresPreserved,true);
 for(const row of f.findings)exact(row.text,row.expected);
});

test('open conditions end only at scope or ownership boundaries, never because of an inset alone',()=>{
 // Both prefixes restrict the still-unspoken main clause; meeting alone
 // would discard busy. This replaces candidate4's incorrect reset assumption.
 assert.deepEqual(C.parseMemberStatement('바쁠 때는, 결과가 완벽하지 않아도, 회의할 때는 글로 소통하는 게 좋아요').meanings,[]);
 exact('바쁠 때는, 결과가 완벽하지 않아도, 저는 평소에는 음악을 좋아해요',[['topic','music','prefer',null]]);
 for(const boundary of ['.','!','?',';','\n']){const p=C.parseMemberStatement(`바쁠 때는, 결과가 완벽하지 않아도${boundary} 저는 음악을 좋아해요`);assert.ok(p.meanings.every(m=>m.condition===null),boundary);}
 for(const quote of [['"','"'],['“','”'],['「','」'],['‘','’']]){
  const text='바쁠 때는, 결과가 완벽하지 않아도, '+quote[0]+'저는 짧은 설명이 좋아요'+quote[1]+'라고 친구가 말했어요. 저는 음악을 좋아해요',p=C.parseMemberStatement(text);assert.deepEqual(p.meanings.map(tuple),[['topic','music','prefer',null]],text);
 }
 for(const actor of ['친구는','연구원은','연구원이','한도윤이']){const text=`바쁠 때는, ${actor} 늦어도, 짧은 설명이 좋아요`,p=C.parseMemberStatement(text);assert.deepEqual(p.meanings,[],text);assert.ok(p.question||p.unresolved.length,text);}
});

test('unsupported scopes and ambiguous insets never broaden a conditional preference to general',()=>{
 for(const prefix of ['비 오는 날에는','월요일에만','작업실에서만','주말에는','퇴근 후'])for(const inset of ['결과가 완벽하지 않아도','사소한 누락을 줄일 수 있으니까'])for(const self of ['','저는 ']){
  const text=`${prefix}, ${inset}, ${self}짧은 설명이 좋아요`,p=C.parseMemberStatement(text);assert.deepEqual(p.meanings,[],text);assert.ok(p.question||p.unresolved.length,text);
 }
 for(const inset of ['상황에 따라 다르지만','정체를 알 수 없는 말','짧은 설명이 좋다는 말은 아니고','그 상황만 해당하는 것은 아니지만']){const text=`바쁠 때는, ${inset}, 짧은 설명이 좋아요`,p=C.parseMemberStatement(text);assert.deepEqual(p.meanings,[],text);assert.ok(p.question||p.unresolved.length,text);}
});

test('two open prefixes compose only supported scopes and never replace a restriction',()=>{
 const scopes=[['바쁠 때는','busy'],['회의할 때는','meeting'],['익숙한 내용에서는','familiar'],['처음에는','first-try'],['결정할 때는','decision'],['함께 일할 때는','teamwork'],['일을 계획하는 때에는','planning'],['예시를 본 다음에는','after-example']];
 for(const [outer,a]of scopes)for(const [inner,b]of scopes)for(const self of ['','저는 ']){
  const text=`${outer}, 답이 늦게 나와도, ${inner} ${self}짧은 설명이 좋아요`,p=C.parseMemberStatement(text);
  const combined=a===b?a:b==='after-example'&&['first-try','familiar','busy'].includes(a)?a+'-after-example':null;
  if(combined){assert.deepEqual(p.meanings.map(tuple),[['explanation','brief','prefer',combined]],text);assert.equal(p.question,null,text);assert.equal(p.meanings[0].evidence.start,0,text);}else{assert.deepEqual(p.meanings,[],text);assert.ok(p.question||p.unresolved.length,text);}
 }
 exact('처음에는, 답이 늦게 나와도, 예시를 본 다음에는, 결과가 완벽하지 않아도, 혼자 시도하는 게 좋아요',[['support','independent','prefer','first-try-after-example']]);
 exact('바쁠 때는 짧은 설명이 좋지만, 회의할 때는 글로 소통하는 게 좋아요',[['explanation','brief','prefer','busy'],['communication','written','prefer','meeting']]);
});

test('rejecting an inset cannot erase its still-open outer condition through a self reset',()=>{
 const scopes=['바쁠 때는','회의할 때는','익숙한 내용에서는','처음에는','결정할 때는','함께 일할 때는','일을 계획하는 때에는','예시를 본 다음에는'];
 for(const scope of scopes)for(const [open,close]of [['"','"'],['“','”'],['「','」'],['‘','’']])for(const self of ['저는 ','제가 ']){
  for(const inset of [`${open}천천히 하세요${close}라는 말과는 별개로`,`답이 늦게 나와도, ${open}천천히 하세요${close}라는 말과는 별개로`]){
   const text=`${scope}, ${inset}, ${self}짧은 설명이 좋아요`,p=C.parseMemberStatement(text);assert.deepEqual(p.meanings,[],text);assert.ok(p.question||p.unresolved.length,text);
  }
  for(const mark of ['.','!','?',';','\n']){
   const text=`${scope}, ${open}천천히 하세요${mark} 서두를 필요는 없어요${close}라는 말과는 별개로, ${self}짧은 설명이 좋아요`,p=C.parseMemberStatement(text);assert.deepEqual(p.meanings,[],text);assert.ok(p.question||p.unresolved.length,text);
  }
 }
 for(const scope of scopes)for(const actor of ['친구는','연구원은','연구원이','한도윤이'])for(const self of ['','저는 ']){
  const text=`${scope}, ${actor} 늦어도, ${self}짧은 설명이 좋아요`,p=C.parseMemberStatement(text);assert.deepEqual(p.meanings,[],text);assert.ok(p.question||p.unresolved.length,text);
 }
 exact('바쁠 때는, “천천히 하세요”라는 말과는 별개로, 저는 평소에는 음악을 좋아해요',[['topic','music','prefer',null]]);
});
