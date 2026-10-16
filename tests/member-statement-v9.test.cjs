'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{performance}=require('node:perf_hooks');
const C=require('../experiences/synk-account/src/member-statement-contract.cjs'),V8=require('../experiences/synk-account/src/member-statement-v8.cjs');
const tuple=m=>[m.field,m.value,m.polarity,m.condition],canonical=xs=>xs.map(JSON.stringify).sort();
function exact(text,expected){const p=C.parseMemberStatement(text);assert.deepEqual(canonical(p.meanings.map(tuple)),canonical(expected),text);assert.equal(p.question,null,text);for(const m of p.meanings)assert.equal(text.slice(m.evidence.start,m.evidence.end),m.evidence.quote,text);return p;}
const actions=[['글로 소통하는 걸','communication','written'],['짧은 설명을','explanation','brief'],['계획을 먼저 세우는 걸','work-style','plan-first'],['음악을','topic','music']];

test('ko8 is byte-frozen and every old parser, selected answer and saved row replays unchanged',()=>{
 assert.equal(C.PARSER_VERSION,'member-statement-ko-9');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(require.resolve('../experiences/synk-account/src/member-statement-v8.cjs'))).digest('hex'),'1c796568b36cb57f77a3143857b0389541aff036979a95f7fe44d77577ee5b69');
 for(let v=1;v<=8;v++)for(const [i,text]of ['혼자 시도하는 게 좋아요','설명을 들으면 이해하기 좋아요','상황에 따라 다르게 하고 싶어요','회의에서는 말로 소통하는 게 좋은 것 같아요','처음에는 예시를 먼저 보고 싶고 그 예시를 본 다음에는 혼자 시도하고 싶어요'].entries()){
  const old=require(`../experiences/synk-account/src/member-statement-v${v}.cjs`),clarifications=[];let p=old.parseMemberStatement(text);assert.deepEqual(C.parseMemberStatement(text,{parserVersion:old.PARSER_VERSION}),p);
  while(p.question){const option=p.question.options.find(o=>!['unsure','skip'].includes(o.id))||p.question.options.at(-1);clarifications.push({questionId:p.question.id,optionId:option.id});p=old.parseMemberStatement(text,{clarifications});assert.deepEqual(C.parseMemberStatement(text,{parserVersion:old.PARSER_VERSION,clarifications}),p);}
  if(p.meanings.length){const row={id:`00000000-0000-4000-8000-${String(v*10+i+1).padStart(12,'0')}`,parserVersion:old.PARSER_VERSION,text,at:'2026-10-16T08:00:00.000Z',confirmedAt:'2026-10-16T08:00:00.000Z',meanings:p.meanings};if(v>1)row.clarifications=clarifications;assert.deepEqual(C.validateMemberStatement(row),old.validateMemberStatement(row));}
 }
});

test('disclosed60 preserves first scores and gold while all supported declarations avoid extra questions',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(require.resolve('./fixtures/member-statement-v9-disclosed-evaluation.json'))).digest('hex'),'4fced32e9516a13681d0c51682a56788e8c46af6ea41ce7c650e5f5f5626624d');
 const f=require('./fixtures/member-statement-v9-disclosed-evaluation.json');assert.equal(f.originalFirstPass.direct,22);assert.equal(f.originalFirstPass.denominator,40);assert.equal(f.originalFirstPass.questions,17);assert.equal(f.corpus.cases.length,60);let direct=0,withheld=0;
 for(const row of f.corpus.cases){if(row.mode==='direct'){exact(row.text,row.expect);direct++;}else{const p=C.parseMemberStatement(row.text);assert.deepEqual(p.meanings,[],row.id);withheld++;}}
 assert.equal(direct,40);assert.equal(withheld,20);
});

test('lexical particles in objects and nominalized processes do not masquerade as actors in reasons',()=>{
 const prefixes=['새로운 이야기를 만날 수 있어서','다양한 자료를 확인할 수 있어서','선택의 이유를 설명할 수 있어야 해서','집중이 끊기지 않게','동선을 상상하는 과정이 재미있어서'];
 for(const prefix of prefixes)for(const [action,field,value]of actions)for(const [ending,polarity]of [['좋아해요','prefer'],['선호하지 않아요','avoid']])exact(`${prefix} ${action} ${ending}`,[[field,value,polarity,null]]);
 for(const actor of ['연구원은','새로운 연구원이','최나래는','박시윤이','수강생께서','서하는','제작자는'])for(const [action]of actions){const text=`${actor} 자료를 확인할 수 있어서 ${action} 좋아해요`;assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);}
 for(const text of ['친구가 좋아한다고 상상하는 과정이 재미있어서 음악을 좋아해요','만약 돈이 생긴다면 글로 소통하는 게 좋아요','비가 올 때 집중이 끊기지 않게 글로 소통하는 게 좋아요','월요일에만 새로운 이야기를 만날 수 있어서 음악이 좋아요','연구원은 집중이 끊기지 않게 음악을 좋아해요'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('neutral commentary after a declaration does not ask for a second personality claim',()=>{
 const asides=['잘해야만 즐길 수 있다고 생각하지는 않아요','세 가지를 한꺼번에 시작하려는 뜻은 아니에요','빨리 정답을 내야 한다는 부담은 없어요','특정 강좌를 결제해 달라는 뜻은 아니에요'];
 for(const [action,field,value]of actions)for(const aside of asides)exact(`저는 ${action} 좋아해요. ${aside}`,[[field,value,'prefer',null]]);
 exact('저는 읽기 연습은 좋아하지만 듣기 연습은 좋아하지 않아요. 두 방식을 같은 선호로 묶고 싶지 않아요',[['practice-mode','reading','prefer',null],['practice-mode','listening','avoid',null]]);
 exact('저는 글로 소통하기와 말로 소통하기를 모두 좋아해요. 어느 한쪽만 편하다고 말하는 건 아니에요',[['communication','written','prefer',null],['communication','spoken','prefer',null]]);
 for(const text of ['저는 음악을 좋아해요. 음악을 좋아한다는 뜻은 아니에요','저는 글로 소통하는 걸 좋아해요. 글로 소통하는 걸 선호한다는 뜻은 아니에요','저는 사진 촬영을 좋아해요. 그 취향을 취소하려는 뜻은 아니에요'])assert.ok(C.parseMemberStatement(text).question,text);
 exact('저는 자세한 설명이 좋아요. 그렇다고 전체 개요를 먼저 보는 걸 싫어한다는 뜻은 아니고, 전체 개요를 먼저 보는 것도 좋아해요',[['explanation','detailed','prefer',null],['explanation-detail','overview-first','prefer',null]]);
 const denied=C.parseMemberStatement('저는 자세한 설명이 좋아요. 그렇다고 전체 개요를 먼저 보는 걸 싫어한다는 뜻은 아니에요');assert.deepEqual(denied.meanings.map(tuple),[['explanation','detailed','prefer',null]]);
});

test('subject-safe insets and parentheses preserve the actual main condition and polarity',()=>{
 const scopes=[['바쁠 때는','busy'],['회의할 때는','meeting'],['처음 하는 일에서는','first-try'],['익숙한 일에서는','familiar']];
 const insets=['모든 답을 바로 알 수는 없더라도','혼자 생각한 답이 이미 있어도','설명의 가치를 낮게 보는 건 아니지만','다른 사람이 옆에 있다는 사실과 별개로'];
 for(const [scope,condition]of scopes)for(const inset of insets)for(const [action,field,value]of actions)for(const [ending,polarity]of [['좋아해요','prefer'],['선호하지 않아요','avoid']])exact(`${scope}, ${inset}, ${action} ${ending}`,[[field,value,polarity,condition]]);
 for(const [scope,condition]of scopes)for(const [action,field,value]of actions)exact(`${scope} (속도를 겨루려는 목적은 아니에요) ${action} 좋아해요`,[[field,value,'prefer',condition]]);
 for(const inset of ['저는 음악을 좋아해요','비 오는 날에만 좋아요','“혼자 하세요”라는 말을 들었어요','그 취향을 취소하려는 뜻은 아니에요']){const text=`바쁠 때는 (${inset}) 짧은 설명이 좋아요`;assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);}
 for(const text of ['바쁠 때는, “천천히 하세요. 급하지 않아요”라는 말과는 별개로, 저는 짧은 설명이 좋아요','처음에는, 모든 답을 바로 알 수는 없더라도, 바쁠 때는 짧은 설명이 좋아요'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('relative actor facts are excluded without questioning their traits or copying them to the writer',()=>{
 for(const role of ['팀장','연구원','나그네','개발자','사진작가']){
  const text=`계획부터 세우는 걸 좋아하는 ${role}이 제게 질문했지만, 저는 평소에 일단 시도하면서 조정하는 게 좋아요`,p=exact(text,[['work-style','try-adjust','prefer',null]]);assert.ok(p.unresolved.some(u=>u.reason==='other'),text);
  assert.deepEqual(C.parseMemberStatement(`계획부터 세우는 걸 좋아하는 ${role}이 제게 질문했어요`).meanings,[],role);
 }
});

test('current confirmation binds complete condition evidence and skip never invents a value',()=>{
 const text='바쁠 때는, 모든 답을 바로 알 수는 없더라도, 짧은 설명이 좋아요',p=C.parseMemberStatement(text),row={id:'00000000-0000-4000-8000-000000000999',parserVersion:C.PARSER_VERSION,text,at:'2026-10-16T08:00:00.000Z',confirmedAt:'2026-10-16T08:00:00.000Z',meanings:p.meanings,clarifications:[]};assert.equal(p.meanings[0].evidence.start,0);assert.deepEqual(C.validateMemberStatement(row),row);for(const mutate of [r=>r.meanings[0].condition=null,r=>r.meanings[0].evidence.start++,r=>r.parserVersion=V8.PARSER_VERSION]){const bad=structuredClone(row);mutate(bad);assert.throws(()=>C.validateMemberStatement(bad));}
 const f=require('./fixtures/member-statement-v9-disclosed-evaluation.json');for(const r of f.corpus.cases.filter(r=>r.mode==='withhold')){const answers=[];let parsed=C.parseMemberStatement(r.text);while(parsed.question){answers.push({questionId:parsed.question.id,optionId:'skip'});assert.ok(answers.length<=12);parsed=C.parseMemberStatement(r.text,{clarifications:answers});assert.deepEqual(parsed.meanings,[],r.id);}}
});

test('all new role paths remain bounded at 500 code points',()=>{
 const inputs=['새로운 이야기를 만날 수 있어서 '.repeat(35),'바쁠 때는, 모든 답을 바로 알 수는 없더라도, '.repeat(25),'(속도를 겨루려는 목적은 아니에요) '.repeat(30),'바쁠 때는, “'+'.;!?\n'.repeat(100),'동선을 상상하는 과정이 재미있어서 '.repeat(30),'그렇다고 핵심 개요를 먼저 보는 걸 싫어한다는 뜻은 아니고 '.repeat(15)].map(x=>Array.from(x).slice(0,500).join(''));let maxMs=0;
 for(const text of inputs)for(let i=0;i<20;i++){const start=performance.now(),p=C.parseMemberStatement(text);maxMs=Math.max(maxMs,performance.now()-start);for(const m of p.meanings)assert.equal(text.slice(m.evidence.start,m.evidence.end),m.evidence.quote);}
 assert.ok(maxMs<150,`bounded sample exceeded 150ms: ${maxMs}`);assert.throws(()=>C.parseMemberStatement('가'.repeat(501)));
});

test('newly disclosed120 remains a development set with immutable first scores and no false proposals',()=>{
 const f=require('./fixtures/member-statement-v9-disclosed-followup.json');assert.equal(f.provenance.sha256,'0ac490f52d83817513fcc5e419a17734ba5e93431bfe9780a8ed7d1992a50447');assert.equal(f.originalFirstPass.baseline.directExact,33);assert.equal(f.originalFirstPass.candidate.directExact,34);assert.equal(f.originalFirstPass.candidate.unnecessaryQuestions,45);
 let direct=0,questions=0,withheld=0;for(const row of f.corpus.cases){const p=C.parseMemberStatement(row.text),a=p.meanings.map(tuple),want=canonical(row.expect);for(const m of a)assert.ok(want.includes(JSON.stringify(m)),row.id+': '+JSON.stringify(m));for(const m of p.meanings)assert.equal(row.text.slice(m.evidence.start,m.evidence.end),m.evidence.quote,row.id);
 if(row.mode==='direct'){if(JSON.stringify(canonical(a))===JSON.stringify(want)&&!p.question)direct++;if(p.question)questions++;}else{assert.deepEqual(p.meanings,[],row.id);withheld++;}}
 assert.equal(direct,79);assert.equal(questions,1);assert.equal(withheld,40);
});

test('object-first adjuncts still inspect every subsequent actor and never borrow a third-person preference',()=>{
 for(const object of ['책을','업무를','자료를','제 생각을'])for(const actor of ['민수는','철수가','연구원이','새로운 개발자가','최나래께서는','서하는'])for(const [action]of actions){
  for(const text of [`${object} ${actor} 확인할 수 있어서 ${action} 좋아해요`,`바쁠 때는, ${object} ${actor} 확인할 수 있어서, ${action} 좋아해요`,`저는 ${action}, ${object} ${actor} 확인할 수 있어서, 좋아해요`])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
 }
 for(const text of ['책을 민수는 집중해서 읽으니까 혼자 하는 게 좋아요.','업무를 철수는 빠르게 끝내니까 짧은 설명이 좋아요.','바쁠 때는, 책을 민수가 읽으니까, 혼자 하는 게 좋아요.'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('interrupted nominal main clauses preserve full evidence, scope and polarity across independently combined inserts',()=>{
 const scopes=[['',null],['바쁠 때는 ','busy'],['처음 시도할 때는 ','first-try'],['회의할 때는 ','meeting']];
 const heads=[['글로 소통하는 게','communication','written'],['계획을 먼저 세우는 쪽이','work-style','plan-first'],['근거를 확인하는 방식이','decision','evidence']];
 for(const [scope,condition]of scopes)for(const [head,field,value]of heads)for(const inset of ['내용을 다시 확인할 수 있어서','차이가 분명히 보이니까','생각을 정리하기 위해'])for(const [ending,polarity]of [['좋아요','prefer'],['싫어요','avoid']]){
  for(const text of [`${scope}저는 ${head}, ${inset}, ${ending}`,`${scope}저는 ${head} (${inset}) ${ending}`]){const p=exact(text,[[field,value,polarity,condition]]);assert.equal(p.meanings[0].evidence.quote,text);}
 }
 for(const inset of ['비 오는 날에만','친구가 좋아해서','“천천히 하세요”라는 말을 들어서','민수가 마음을 정했으니까','제가 원한다고 가정해서'])assert.deepEqual(C.parseMemberStatement(`바쁠 때는 저는 글로 소통하는 게, ${inset}, 좋아요`).meanings,[],inset);
});

test('subject contractions use original token boundaries and explicit current resets stay outside quotations',()=>{
 for(const self of ['전','난','저는','나는'])for(const [action,field,value]of actions)exact(`${self} ${action} 좋아해요`,[[field,value,'prefer',null]]);
 for(const text of ['전문가는 음악을 좋아해요','난영은 음악을 좋아해요','난이도는 음악을 좋아해요','난이도도 음악도 좋아해요','제도는 음악을 좋아해요','제도도 음악도 좋아해요','의도는 음악을 좋아해요','의도도 음악도 좋아해요','전기 음악을 좋아해요','일을 시작하기 전 음악을 좋아해요','책에는 “전 음악을 좋아해요”라고 적혀 있어요','전 음악을 좋아한다고 가정해요'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
 exact('친구는 음악을 즐기지만 저는 자연을 구경하는 게 좋아요',[['topic','nature','prefer',null]]);
 exact('예전에는 운동을 즐겼지만 요즘 저는 글로 설명하는 게 편해요',[['communication','written','prefer',null]]);
});

test('shared nominal coordination composes independently recognized activities under the same final polarity',()=>{
 const activities=[['자연 구경하기','nature'],['음악 듣기','music'],['진로 계획 세우기','career-planning'],['AI 도구 쓰기','ai-tools'],['숙소 알아보기','travel-stay']];
 for(let i=0;i<activities.length;i++)for(let j=i+1;j<activities.length;j++)for(const conjunction of ['와 ', ', '])for(const [ending,polarity]of [['둘 다 좋아해요','prefer'],['둘 다 관심이 없어요','avoid']])exact(`저는 ${activities[i][0]}${conjunction}${activities[j][0]} ${ending}`,[['topic',activities[i][1],polarity,null],['topic',activities[j][1],polarity,null]]);
 for(const text of ['친구는 음악도 요리도 좋아해요','음악과 이름 모를 활동을 좋아해요','음악과 요리를 좋아하는 연구원은 제 친구예요','음악도 요리도 좋아하는 것 같아요'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('reason and reformulation add no claim while contradictions, new conditions and unsupported referents still ask',()=>{
 for(const [action,field,value]of actions)for(const reason of ['내용을 확인하기 쉬워서요','그래야 납득이 되거든요','소리를 느낄 수 있다는 점 때문이에요'])exact(`저는 ${action} 좋아해요. ${reason}`,[[field,value,'prefer',null]]);
 exact('저는 근거를 확인하는 게 좋아요. 근거를 살펴보는 방식을 말하는 거예요',[['decision','evidence','prefer',null]]);
 exact('저는 글로 소통하는 게 좋아요. 글로 의견을 남기는 걸 선호한다는 뜻이에요',[['communication','written','prefer',null]]);
 for(const text of ['저는 음악을 좋아해요. 책 읽는 방식을 말하는 거예요','저는 근거를 확인하는 게 좋아요. 음악을 선호한다는 뜻이에요','저는 짧은 설명이 좋아요. 바쁠 때만 그렇다는 뜻이에요','저는 글로 소통하는 걸 좋아해요. 그 취향을 철회한다는 뜻이에요'])assert.ok(C.parseMemberStatement(text).question,text);
});

test('a coordinating predicate cannot become a preference before its governing wish, denial or quotation',()=>{
 const topics=['음악을','운동을','요리를','자연 구경하기를'];
 const tails=['즐기고 싶지 않아요','즐기고 싶다는 말은 하지 않았어요','즐기며 살고 싶다는 말을 하지 않았어요','즐기며 저는 살아가고 싶다는 말을 하지 않았어요','즐기고 지내고 싶다는 이야기는 제 이야기가 아니에요'];
 for(const topic of topics)for(const tail of tails)for(const prefix of ['저는 ','바쁠 때는 저는 ']){
  const text=prefix+topic+' '+tail,p=C.parseMemberStatement(text);assert.deepEqual(p.meanings,[],text);let skipped=p,answers=[];while(skipped.question){answers.push({questionId:skipped.question.id,optionId:'skip'});assert.ok(answers.length<=12);skipped=C.parseMemberStatement(text,{clarifications:answers});assert.deepEqual(skipped.meanings,[],text);}
 }
 exact('저는 음악을 즐기고 자연 구경하기에도 관심이 있어요',[['topic','music','prefer',null],['topic','nature','prefer',null]]);
 exact('저는 운동을 즐기며 글로 소통하는 게 좋아요',[['topic','exercise','prefer',null],['communication','written','prefer',null]]);
});

test('a scope prefix retains the self owner needed by an existing nominal desire declaration',()=>{
 exact('바쁠 때 제가 원하는 설명은 간단한 거예요. 처음 접하는 내용일 때 제가 원하는 건 자세한 설명입니다.',[['explanation','brief','prefer','busy'],['explanation','detailed','prefer','first-try']]);
 for(const [scope,condition]of [['바쁠 때','busy'],['처음 시도할 때','first-try'],['익숙한 내용일 때','familiar'],['회의할 때','meeting']])for(const self of ['제가','내가'])exact(`${scope} ${self} 원하는 건 자세한 설명입니다`,[['explanation','detailed','prefer',condition]]);
});

test('an unresolved scoped request cannot make its following explanation unconditional',()=>{
 const text='제가 바쁠 때 바라는 건 간단한 설명이에요. 핵심만 듣는 게 좋습니다.';
 for(const [scope,condition]of [['바쁠 때','busy'],['처음 시도할 때','first-try'],['회의할 때','meeting']]){
  const prefix=`제가 ${scope} 바라는 건 간단한 설명이에요. `;
  const p=C.parseMemberStatement(prefix+'핵심만 듣는 게 좋습니다.');assert.deepEqual(p.meanings,[]);assert.ok(p.question);
  assert.deepEqual(C.parseMemberStatement(prefix+'평소에는 핵심만 듣는 게 좋습니다.').meanings.map(tuple),[['explanation','brief','prefer',null]]);
  assert.deepEqual(C.parseMemberStatement(prefix+'익숙한 내용일 때는 자세한 설명이 좋아요.').meanings.map(tuple),[['explanation','detailed','prefer','familiar']]);
 }
 let p=C.parseMemberStatement(text),answers=[];while(p.question){answers.push({questionId:p.question.id,optionId:'skip'});assert.ok(answers.length<=12);p=C.parseMemberStatement(text,{clarifications:answers});assert.deepEqual(p.meanings,[]);}
 for(const text of ['저는 음악을 싫어하고 싶지 않아요.','저는 음악에 흥미가 있고 없고를 아직 모르겠어요.','저는 음악에 관심이 있고 없고를 아직 모르겠어요.'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});


// Previously reviewed probes are an explicit regression set, not new accuracy
// evidence. F29 owner correction, F38 scope-particle recovery and SEP8 reported
// denial expectations are the only amended conclusions, all approved in review.
const reviewedBoundaryProbes=[
  {
    "id": "T01",
    "text": "책을 철수가 읽으니까 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "T02",
    "text": "설명을 동료가 해 주니까 함께 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "T03",
    "text": "결과를 상대가 기다리니까 짧은 설명이 좋아요.",
    "expected": [
      [
        "explanation",
        "brief",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "T04",
    "text": "책을 민수가 찾으려고 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "T05",
    "text": "자료를 선생님이 확인해서 자세한 설명이 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "T06",
    "text": "그림을 아이가 그리기 위해 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "T07",
    "text": "자료를 찾으려고 친구는 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "T08",
    "text": "상상하는 과정에서만 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "T09",
    "text": "상상하는 과정이라면 음악 듣기가 좋아요.",
    "expected": [],
    "question": false
  },
  {
    "id": "T10",
    "text": "상상하는 과정에서는 친구가 음악 듣기를 좋아해요.",
    "expected": [],
    "question": false
  },
  {
    "id": "T11",
    "text": "바쁠 때는, 책을 민수가 읽으니까, 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "T12",
    "text": "바쁠 때는, 요리는 철수가 잘하니까, 같이 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "T13",
    "text": "바쁠 때는, 동료가 시간이 있다는 사실과 별개로, 혼자 하는 게 좋아요.",
    "expected": [
      [
        "support",
        "independent",
        "prefer",
        "busy"
      ]
    ],
    "question": false
  },
  {
    "id": "T14",
    "text": "저는 혼자 하는 게 좋아요. 혼자 하려는 뜻은 아니에요.",
    "expected": [
      [
        "support",
        "independent",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "T15",
    "text": "저는 혼자 하는 게 좋아요. 혼자 하겠다는 뜻은 아니에요.",
    "expected": [
      [
        "support",
        "independent",
        "prefer",
        null
      ]
    ],
    "question": true
  },
  {
    "id": "T16",
    "text": "저는 자세한 설명이 좋아요. 길게 해달라는 뜻은 아니에요.",
    "expected": [
      [
        "explanation",
        "detailed",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "T17",
    "text": "저는 음악을 좋아해요. 음악을 좋아한다는 뜻은 아니에요.",
    "expected": [
      [
        "topic",
        "music",
        "prefer",
        null
      ]
    ],
    "question": true
  },
  {
    "id": "T18",
    "text": "저는 음악을 좋아해요. 사진을 좋아한다는 뜻은 아니에요.",
    "expected": [
      [
        "topic",
        "music",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "T19",
    "text": "저는 혼자 하는 게 좋아요. 남의 도움을 받아야 한다는 부담은 없어요.",
    "expected": [
      [
        "support",
        "independent",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "T20",
    "text": "저는 짧은 설명이 좋아요. 길게 해야만 이해할 수 있다고 생각하지는 않아요.",
    "expected": [
      [
        "explanation",
        "brief",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "T21",
    "text": "저는 (길게 해달라는 뜻은 아니에요) 자세한 설명이 좋아요.",
    "expected": [
      [
        "explanation",
        "detailed",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "T22",
    "text": "처음 할 때는 (함께 하려는 뜻은 아니에요) 예시를 보고 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "T23",
    "text": "동료는 (혼자 하려는 뜻은 아니에요) 예시를 좋아해요.",
    "expected": [],
    "question": false
  },
  {
    "id": "T24",
    "text": "작년에는 (자랑하려는 뜻은 아니에요) 혼자 하는 게 좋았어요.",
    "expected": [],
    "question": false
  },
  {
    "id": "T25",
    "text": "만약 다시 해본다면 (자랑하려는 뜻은 아니에요) 혼자 하는 게 좋겠어요.",
    "expected": [],
    "question": false
  },
  {
    "id": "T26",
    "text": "음악을 좋아하는 로봇이 제게 사진을 찍으라고 했어요.",
    "expected": [],
    "question": false
  },
  {
    "id": "T27",
    "text": "계획을 좋아하는 사람이 제게 짧은 설명을 해줬어요.",
    "expected": [],
    "question": false
  },
  {
    "id": "T28",
    "text": "책을 읽는 과정이 편해서 혼자 하는 게 좋아요.",
    "expected": [
      [
        "support",
        "independent",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "T29",
    "text": "독서하는 과정이 즐거워서 음악 듣기도 좋아요.",
    "expected": [
      [
        "topic",
        "music",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "T30",
    "text": "별을 상상하는 과정이 재밌어서 그림을 좋아해요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F01",
    "text": "책을 민수는 집중해서 읽으니까 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F02",
    "text": "업무를 철수는 빠르게 끝내니까 짧은 설명이 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F03",
    "text": "바쁠 때는, 책을 민수가 읽으니까, 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F04",
    "text": "난이도가 높을 때는 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F05",
    "text": "난방이 켜져 있으니까 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F06",
    "text": "전기 요금을 아끼려고 혼자 하는 게 좋아요.",
    "expected": [
      [
        "support",
        "independent",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "F07",
    "text": "전에는 음악 감상을 좋아했어요.",
    "expected": [],
    "question": false
  },
  {
    "id": "F08",
    "text": "난도 높은 문제에서만 짧은 설명이 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F09",
    "text": "전 음악을 좋아해요.",
    "expected": [
      [
        "topic",
        "music",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "F10",
    "text": "난혼자하는게좋아요.",
    "expected": [
      [
        "support",
        "independent",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "F11",
    "text": "난이도상승이좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F12",
    "text": "다른 분은 음악 감상을 좋아해요.",
    "expected": [],
    "question": false
  },
  {
    "id": "F13",
    "text": "다른 분은 혼자 하는 게 편하고 음악 감상을 좋아해요.",
    "expected": [],
    "question": false
  },
  {
    "id": "F14",
    "text": "혼자 하는 걸 선호하더라도 자세한 설명이 좋아요.",
    "expected": [
      [
        "explanation",
        "detailed",
        "prefer",
        null
      ]
    ],
    "question": true
  },
  {
    "id": "F15",
    "text": "친구가 혼자 하는 걸 선호하더라도 저는 자세한 설명이 좋아요.",
    "expected": [
      [
        "explanation",
        "detailed",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "F16",
    "text": "만약 혼자 하는 걸 선호하더라도 저는 자세한 설명이 좋아요.",
    "expected": [],
    "question": false
  },
  {
    "id": "F17",
    "text": "저는 음악을 좋아하더라도 혼자 하는 건 싫어요.",
    "expected": [
      [
        "support",
        "independent",
        "avoid",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "F18",
    "text": "저는 음악을 즐기고 싶어요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F19",
    "text": "저는 음악을 즐기고 싶지 않아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F20",
    "text": "저는 음악을 즐기며 살고 싶다는 말을 하지 않았어요.",
    "expected": [],
    "question": false
  },
  {
    "id": "F21",
    "text": "저는 음악을 즐기고 싶어하는 친구가 있어요.",
    "expected": [],
    "question": false
  },
  {
    "id": "F22",
    "text": "제가 원하는 건 숙소 앱의 파란색 버튼이에요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F23",
    "text": "저는 숙소에서 운동하는 것을 좋아해요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F24",
    "text": "저는 숙소 근처의 식당을 찾아보는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F25",
    "text": "저는 듣고 정리하는 게 좋아요.",
    "expected": [
      [
        "communication",
        "listen-organize",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "F26",
    "text": "저는 음악을 듣고 정리하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F27",
    "text": "저는 상대의 말을 듣고 제 생각을 정리하는 게 좋아요.",
    "expected": [
      [
        "communication",
        "listen-organize",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "F28",
    "text": "저는 음악을 좋아해요. 제가 좋아한다는 뜻이에요.",
    "expected": [
      [
        "topic",
        "music",
        "prefer",
        null
      ]
    ],
    "question": true
  },
  {
    "id": "F29",
    "text": "저는 음악을 좋아해요. 다른 분이 좋아한다는 뜻이에요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F30",
    "text": "저는 음악을 좋아해요. 금요일에만 좋아한다는 뜻이에요.",
    "expected": [
      [
        "topic",
        "music",
        "prefer",
        null
      ]
    ],
    "question": true
  },
  {
    "id": "F31",
    "text": "저는 요리가 좋아요. 그래야 친구가 음악을 들을 수 있으니까요.",
    "expected": [
      [
        "topic",
        "cooking",
        "prefer",
        null
      ]
    ],
    "question": true
  },
  {
    "id": "F32",
    "text": "저는 요리가 좋아요. 친구가 음악을 좋아해서요.",
    "expected": [
      [
        "topic",
        "cooking",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "F33",
    "text": "저는 (민수가 직접 했으니까) 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F34",
    "text": "저는 (책을 민수가 읽으니까) 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F35",
    "text": "바쁠 때는 저는 (시간을 아끼려고) 짧은 설명이 좋아요.",
    "expected": [
      [
        "explanation",
        "brief",
        "prefer",
        "busy"
      ]
    ],
    "question": false
  },
  {
    "id": "F36",
    "text": "익숙한 일은 저는 혼자 하는 게 좋아요.",
    "expected": [
      [
        "support",
        "independent",
        "prefer",
        "familiar"
      ]
    ],
    "question": false
  },
  {
    "id": "F37",
    "text": "친구가 바쁠 때는 저는 혼자 하는 게 좋아요.",
    "expected": [],
    "question": false
  },
  {
    "id": "F38",
    "text": "바쁠 때도 제가 할 수 있는 과정이 있어서 혼자 하는 게 좋아요.",
    "expected": [
      [
        "support",
        "independent",
        "prefer",
        "busy"
      ]
    ],
    "question": false
  },
  {
    "id": "F39",
    "text": "책을 민수는 읽는 과정이 있어서 혼자 하는 게 좋아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "F40",
    "text": "저는, 책을 민수가 읽으니까, 혼자 하는 게 좋아요.",
    "expected": [
      [
        "support",
        "independent",
        "prefer",
        null
      ]
    ],
    "question": true
  },
  {
    "id": "SEP1",
    "text": "저는 음악을 즐기며 살고 싶다는 말을 하지 않았어요.",
    "expected": [],
    "question": false
  },
  {
    "id": "SEP2",
    "text": "저는 음악을 즐기고 싶지 않아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "SEP3",
    "text": "저는 음악을 즐기고 싶어요.",
    "expected": [],
    "question": true
  },
  {
    "id": "SEP4",
    "text": "저는 음악을 싫어하고 싶지 않아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "SEP5",
    "text": "저는 음악을 싫어하고 싶어요.",
    "expected": [],
    "question": true
  },
  {
    "id": "SEP6",
    "text": "저는 음악에 흥미가 있고 없고를 아직 모르겠어요.",
    "expected": [],
    "question": true
  },
  {
    "id": "SEP7",
    "text": "저는 음악을 즐기고 말고는 중요하지 않아요.",
    "expected": [],
    "question": true
  },
  {
    "id": "SEP8",
    "text": "저는 음악을 즐기며 지낸다고 말하지 않았어요.",
    "expected": [],
    "question": true
  },
  {
    "id": "SEP9",
    "text": "저는 음악을 싫어하고 요리를 좋아해요.",
    "expected": [
      [
        "topic",
        "music",
        "avoid",
        null
      ],
      [
        "topic",
        "cooking",
        "prefer",
        null
      ]
    ],
    "question": false
  },
  {
    "id": "SEP10",
    "text": "저는 음악을 즐기고 요리를 좋아해요.",
    "expected": [
      [
        "topic",
        "music",
        "prefer",
        null
      ],
      [
        "topic",
        "cooking",
        "prefer",
        null
      ]
    ],
    "question": false
  }
];
test('all 30 targeted, 40 final and 10 separator review probes remain covered',()=>{
 assert.equal(reviewedBoundaryProbes.length,80);
 for(const row of reviewedBoundaryProbes){const p=C.parseMemberStatement(row.text);assert.deepEqual(canonical(p.meanings.map(tuple)),canonical(row.expected),row.id+': '+row.text);assert.equal(!!p.question,row.question,row.id);for(const m of p.meanings)assert.equal(row.text.slice(m.evidence.start,m.evidence.end),m.evidence.quote,row.id);let skipped=p,answers=[];while(skipped.question){answers.push({questionId:skipped.question.id,optionId:'skip'});assert.ok(answers.length<=12);skipped=C.parseMemberStatement(row.text,{clarifications:answers});assert.deepEqual(canonical(skipped.meanings.map(tuple)),canonical(row.expected),row.id+' after skip');}}
});
