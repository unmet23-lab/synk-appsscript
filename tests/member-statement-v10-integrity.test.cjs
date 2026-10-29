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
