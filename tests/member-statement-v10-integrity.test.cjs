'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const C=require('../experiences/synk-account/src/member-statement-contract.cjs');
const root=path.resolve(__dirname,'..'),pins=require('./fixtures/member-parser-compatibility-20261029.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('an outer self prefix never claims another actor\'s subordinate behaviour',()=>{
 for(const prefix of ['저는 요즘','저는 주로','저는 대체로','평소 저는']){
  const text=prefix+' 동료가 의견을 듣고 정리하는 걸 좋아해요.';
  assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
 }
 for(const text of ['저는 동료의 의견을 듣고 정리하는 걸 좋아해요.','저는 요즘 동료와 의견을 듣고 정리하는 걸 좋아해요.'])
  assert.ok(C.parseMemberStatement(text).meanings.some(m=>m.field==='communication'&&m.value==='listen-organize'),text);
});
test('another person liking a topic never proposes that topic as the member interest',()=>{
 for(const text of ['요즘 동료는 협업을 좋아해요.','사람들은 협업을 좋아해요.','남들은 협업을 좋아해요.','상대방은 협업을 좋아해요.','요즘 동료가 협업에 관심이 있어요.','저는 요즘 동료가 협업을 좋아해요.','동료는 협업하는 방식에 관심이 있어요.','요즘 동료도 협업을 좋아해요.','사람들도 협업을 좋아해요.','동료가 우리가 함께 일하는 협업 방식에 관심을 두고 있어요.','요즘 동료가 우리가 함께 일하는 협업 방식에 관심을 두고 있어요.','요즘 팀원들이 동료가 함께 일하는 협업 방식에 관심을 두고 있어요.'])
  assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
 for(const text of ['저는 팀원들이 함께 일하는 협업 방식에 관심을 두고 있어요.','저는 팀원들이 협업하는 방식에 관심을 두고 있어요.','저는 동료와 협업하는 방식에 관심을 두고 있어요.'])
  assert.ok(C.parseMemberStatement(text).meanings.some(m=>m.field==='topic'&&m.value==='work-collaboration'),text);
});

test('a helper inside a consumed before-help context is distinct from the preference owner',()=>{
 for(const text of ['저는 다른 사람이 알려주기 전에 혼자 시도해보는 게 좋아요.','저는 누군가 도와주기 전에 혼자 시도해보는 게 좋아요.']){
  const p=C.parseMemberStatement(text);assert.equal(p.question,null,text);assert.ok(p.meanings.some(m=>m.field==='support'&&m.value==='independent'),text);
 }
 for(const text of ['저는 다른 사람이 알려주기 전에 동료가 혼자 시도해보는 게 좋아요.','다른 사람이 알려주기 전에 동료가 혼자 시도해보는 게 좋아요.'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('a relative topic with no explicit owner asks whose interest it is before proposing it',()=>{
 for(const text of ['팀원들이 함께 일하는 협업 방식에 관심을 두고 있어요.','요즘 팀원들이 함께 일하는 협업 방식에 관심을 두고 있어요.']){
  const p=C.parseMemberStatement(text);assert.deepEqual(p.meanings,[]);assert.match(p.question.label,/본인/);
  for(const optionId of ['not-current','skip'])assert.deepEqual(C.parseMemberStatement(text,{clarifications:[{questionId:p.question.id,optionId}]}).meanings,[]);
  const clarifications=[{questionId:p.question.id,optionId:'confirm'}],resolved=C.parseMemberStatement(text,{clarifications});
  assert.equal(resolved.question,null);assert.equal(resolved.meanings[0].value,'work-collaboration');
  assert.doesNotThrow(()=>C.validateMemberStatement({id:'00000000-0000-4000-8000-000000000003',parserVersion:C.PARSER_VERSION,text,at:'2026-10-29T00:00:00.000Z',confirmedAt:'2026-10-29T00:00:00.000Z',meanings:resolved.meanings,clarifications}));
 }
});

test('supported own nominal declarations reset an earlier other-person subject',()=>{
 for(const text of ['제 친구는 음악을 좋아해요. 제 취미는 요리예요.','친구는 운동을 좋아해요. 요즘 제 취미는 요리예요.','친구는 음악을 좋아해요. 내 관심사는 요리예요.'])
  assert.deepEqual(C.parseMemberStatement(text).meanings.map(m=>m.value),['cooking'],text);
 for(const text of ['친구는 음악을 좋아해요. 제도는 요리예요.','친구는 음악을 좋아해요. 내일은 요리를 좋아해요.'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
});

test('person roles and ownership use the same noun vocabulary without claiming companions',()=>{
 for(const text of ['요즘 누군가는 협업에 관심이 있어요.','요즘 다른 이들은 협업에 관심이 있어요.','요즘 여러 사람들은 협업에 관심이 있어요.'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
 for(const text of ['저는 누군가와 협업하는 방식에 관심을 두고 있어요.','저는 다른 이들과 협업하는 방식에 관심을 두고 있어요.'])assert.ok(C.parseMemberStatement(text).meanings.some(m=>m.value==='work-collaboration'),text);
});

test('each explanation in a sequence retains its explicitly stated condition',()=>{
 const text='처음에는 전체 개요를 먼저 보고 익숙할 때는 핵심 근거를 자세히 듣고 싶어요',p=C.parseMemberStatement(text);
 assert.equal(p.question,null);
 assert.deepEqual(p.meanings.map(m=>[m.value,m.condition]),[['overview-first','first-try'],['reasons-detail','familiar']]);
 const inherited=C.parseMemberStatement('처음에는 전체 개요를 먼저 보고 핵심 근거를 자세히 듣고 싶어요');
 assert.deepEqual(inherited.meanings.map(m=>m.condition),['first-try','first-try']);
});

test('a negative preference in a reason is never silently discarded as background',()=>{
 for(const text of ['요리가 싫어서 저는 음악을 좋아해요','요리를 좋아하지 않아서 저는 음악을 좋아해요']){
  const p=C.parseMemberStatement(text);
  assert.ok(p.meanings.some(m=>m.value==='cooking'&&m.polarity==='avoid')||p.unresolved.some(e=>e.quote===text));
  assert.ok(p.question,'an unsupported reason remains visible for clarification');
  assert.deepEqual(C.parseMemberStatement(text,{clarifications:[{questionId:p.question.id,optionId:'skip'}]}).meanings,[]);
 }
});

test('legacy parsing changed only an equivalent nonempty suffix regex; original bytes remain provable',()=>{
 for(const row of pins.rows){const source=fs.readFileSync(path.join(root,row.path),'utf8');assert.equal(sha(source),row.sha256);assert.equal(sha(source.replace(row.newRegex,row.oldRegex)),row.beforeSha256);}
 const pin9=pins.rows.at(-1),source=fs.readFileSync(path.join(root,pin9.path),'utf8').replace(pin9.newRegex,pin9.oldRegex);assert.equal(sha(source),pin9.beforeSha256);
 const module={exports:{}};const localRequire=require('node:module').createRequire(require.resolve('../experiences/synk-account/src/member-statement-v9.cjs'));
 new Function('require','module','exports',source)(localRequire,module,module.exports);
 const old=module.exports,legacy=require('../experiences/synk-account/src/member-statement-v9.cjs');
 const rows=[...require('./fixtures/member-statement-v9-disclosed-evaluation.json').corpus.cases.map(r=>r.text),'예시가 좋아요','혼자 하는 게 좋을 수도 있어요'];
 for(const text of rows){let before=old.parseMemberStatement(text),answers=[];assert.deepEqual(legacy.parseMemberStatement(text),before);for(let i=0;before.question&&i<12;i++){const q=before.question,choice=q.options.find(o=>!['skip','unsure'].includes(o.id))||q.options.at(-1);answers.push({questionId:q.id,optionId:choice.id});before=old.parseMemberStatement(text,{clarifications:answers});assert.deepEqual(legacy.parseMemberStatement(text,{clarifications:answers}),before);}
  if(!before.question&&before.meanings.length){const row={id:'00000000-0000-4000-8000-000000000001',parserVersion:old.PARSER_VERSION,text,at:'2026-10-29T00:00:00.000Z',confirmedAt:'2026-10-29T00:00:00.000Z',meanings:before.meanings,clarifications:answers};assert.deepEqual(C.validateMemberStatement(row),old.validateMemberStatement(row));}
 }
});
test('a question applies to every coordinated clause and another actor never becomes the writer',()=>{
 assert.equal(C.PARSER_VERSION,'member-statement-ko-10');
 for(const text of ['저는 음악을 좋아하고 요리를 좋아해요?','음악가가 피곤해서 혼자 하는 걸 좋아해요.','음악가가피곤해서혼자하는걸좋아해요','음악가는피곤해서혼자하는걸좋아해요','음악가들이피곤해서혼자하는걸좋아해요','음악가님들이피곤해서혼자하는걸좋아해요','혼자 하는 게 좋아요. 그 방식이 좋아요. 친구가 좋아한다는 뜻이에요.','음악이 좋아요. 그게 취미예요. 친구가 좋아한다는 뜻이에요.','음악이 좋아요. 그게 취미예요. 그 방식이 좋아요. 친구가 좋아한다는 뜻이에요.','음악이 좋아요. 요리가 좋아요. 둘 다 좋아요. 친구가 좋아한다는 뜻이에요.'])assert.deepEqual(C.parseMemberStatement(text).meanings,[],text);
 const text='저는 음악을 좋아해요. 요리를 좋아해요?';assert.equal(C.parseMemberStatement(text).meanings[0].value,'music');
 for(const text of ['음악이 가끔 생각나요. 요리를 좋아해요.','음악이 이제 생각나요. 요리를 좋아해요.','음악이가끔생각나요. 요리를좋아해요.','음악이이제생각나요. 요리를좋아해요.'])assert.ok(C.parseMemberStatement(text).meanings.some(m=>m.value==='cooking'),text);
});

test('owner corrections follow the actual referenced meanings, independently of clause grouping',()=>{
 for(const [text,values]of [
  ['음악이 좋아요. 요리가 좋아요. 음악을 좋아한다는 뜻이에요. 친구가 좋아한다는 뜻이에요.',['cooking']],
  ['음악이 좋아요. 요리가 좋아요. 두 분야가 좋아요. 친구가 좋아한다는 뜻이에요.',[]],
  ['운동이 좋아요. 음악이 좋아요. 요리가 좋아요. 두 분야가 좋아요. 친구가 좋아한다는 뜻이에요.',['exercise']],
  ['운동이 좋아요. 음악과 요리를 모두 좋아해요. 두 분야가 좋아요. 친구가 좋아한다는 뜻이에요.',['exercise']],
  ['음악과 요리를 모두 좋아해요. 음악을 좋아한다는 뜻이에요. 친구가 좋아한다는 뜻이에요.',['cooking']],
  ['음악과 요리를 모두 좋아해요. 음악을 좋아한다는 뜻이에요. 그 방식이 좋아요. 친구가 좋아한다는 뜻이에요.',['cooking']]
 ]){let p=C.parseMemberStatement(text);assert.deepEqual(p.meanings.map(m=>m.value).sort(),values,text);assert.ok(p.question,text);const answers=[];
  for(let i=0;p.question&&i<12;i++){answers.push({questionId:p.question.id,optionId:'skip'});p=C.parseMemberStatement(text,{clarifications:answers});}
  assert.equal(p.question,null);assert.deepEqual(p.meanings.map(m=>m.value).sort(),values,text);
  if(values.length)assert.doesNotThrow(()=>C.validateMemberStatement({id:'00000000-0000-4000-8000-000000000002',parserVersion:C.PARSER_VERSION,text,at:'2026-10-29T00:00:00.000Z',confirmedAt:'2026-10-29T00:00:00.000Z',meanings:p.meanings,clarifications:answers}));
 }
});
test('resolving overlapping conflicts cannot finish with an unpersistable pair',()=>{
 const text='예시가 싫어요. 혼자가 싫어요. 예시가 좋아요. 혼자가 좋아요.',answers=[];let p=C.parseMemberStatement(text);
 for(let i=0;p.question&&i<12;i++){const q=p.question,option=q.options.find(o=>o.id==='p2')||q.options.find(o=>o.id==='p3')||q.options.find(o=>/^p\d+$/u.test(o.id));answers.push({questionId:q.id,optionId:option.id});p=C.parseMemberStatement(text,{clarifications:answers});if(p.meanings.some((a,j)=>p.meanings.slice(j+1).some(b=>C.meaningsConflict(a,b))))assert.ok(p.question);}
 assert.equal(p.question,null);assert.ok(p.meanings.length);
 assert.doesNotThrow(()=>C.validateMemberStatement({id:'00000000-0000-4000-8000-000000000001',parserVersion:C.PARSER_VERSION,text,at:'2026-10-29T00:00:00.000Z',confirmedAt:'2026-10-29T00:00:00.000Z',meanings:p.meanings,clarifications:answers}));
});
test('bounded valid-size prefix input finishes for every affected parser',()=>{
 for(const version of [4,5,6,7,8,9,10]){const file=version===10?require.resolve('../experiences/synk-account/src/member-statement-contract.cjs'):require.resolve(`../experiences/synk-account/src/member-statement-v${version}.cjs`);const code="const C=require(process.argv[1]);C.parseMemberStatement('저는정말'.repeat(80)+'X좋아요');";const r=cp.spawnSync(process.execPath,['-e',code,file],{timeout:3000,encoding:'utf8',windowsHide:true});assert.equal(r.error?.code,undefined,`ko-${version}: ${r.error?.code}`);assert.equal(r.status,0,r.stderr);}
});
