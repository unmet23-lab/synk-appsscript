import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkWriting,checkCount,writingLength,endingOf,sentencesOf,blankContext} from '../world-writing-check.mjs';
import {homeworkLength} from '../classroom-homework.mjs';
import {bankHash} from '../../../tools/build-world-writing-items.mjs';
import STRINGS from '../../brand-opening/world-strings.mjs';

// 쓰기 연습(TOPIK II 51~54): 문항 은행·규칙 점검·화면 글·연결 목록. 화면 동작은 world-writing-browser.test.mjs.
const root=fileURLToPath(new URL('../../../',import.meta.url));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const bank=JSON.parse(read('experiences/synk-world-app/world-writing-items.json'));
const by=id=>bank.items.find(i=>i.id===id);
const ids=result=>result.items.filter(i=>i.level==='check').map(i=>(i.blank?`${i.blank}:`:'')+i.id);
const modelAnswer=item=>item.type<=52?Object.fromEntries(item.blanks.map(b=>[b.id,b.model])):item.model;

test('문항 은행: 과제별 모양, 예시답 글자 수 검산, 판 지문, 검수 상태', ()=>{
 assert.equal(bank.basis,'PBT');
 assert.equal(bank.contentHash,bankHash(bank.items),'node tools/build-world-writing-items.mjs --write 뒤 --talk로 서버 사본도 다시 만든다');
 assert.equal(new Set(bank.items.map(i=>i.id)).size,bank.items.length);
 for(const type of [51,52,53,54])assert.ok(bank.items.filter(i=>i.type===type).length>=2,`${type}번 문항 2개 이상`);
 for(const item of bank.items){
  assert.match(item.id,/^w5[1-4]-[a-z0-9-]+$/);assert.equal(item.id.slice(1,3),String(item.type));
  assert.ok(['draft','held','passed'].includes(item.review?.status),item.id);
  assert.ok(item.instruction&&item.points&&item.label,item.id);
  assert.ok(['formal','polite','plain'].includes(item.style),item.id);
  if(item.type<=52){
   assert.deepEqual(item.blanks.map(b=>[b.id,b.mark]),[['a','㉠'],['b','㉡']]);
   const used=item.passage.flat().filter(p=>typeof p==='object').map(p=>p.blank);assert.deepEqual(used,['a','b'],item.id);
   for(const b of item.blanks)assert.ok(b.model&&b.accept,`${item.id} ${b.id}`);
   if(item.type===52)assert.equal(item.style,'plain');
  }else{
   assert.equal(item.style,'plain');
   assert.deepEqual([item.min,item.max],item.type===53?[200,300]:[600,700]);
   const n=writingLength(item.model);assert.equal(item.modelLength,n,`${item.id} 예시답 글자 수`);assert.ok(n>=item.min&&n<=item.max,`${item.id} ${n}자`);
   if(item.type===53){assert.ok(item.data?.tables?.length);assert.ok(item.facts?.length);assert.match(item.data.source,/가상/);}
   else{assert.equal(item.questions.length,3);assert.ok(item.prompt);}
  }
  // 공식 기출을 옮기지 않는다(자체 창작). 문항 글에 회차·기출 표시가 없다.
  assert.doesNotMatch(JSON.stringify(item),/기출|제\s?\d+\s?회|TOPIK\s?\d+회/);
 }
});

test('예시답은 규칙 점검에서 확인할 곳이 하나도 없다(규칙이 좋은 답을 탓하지 않는다)', ()=>{
 for(const item of bank.items){const result=checkWriting(item,modelAnswer(item));assert.equal(checkCount(result),0,`${item.id}: ${JSON.stringify(result.items)}`);}
});

test('글자 수는 온라인 반 과제와 같은 규칙(NFC · 공백 포함 · 줄바꿈 뺌)', ()=>{
 for(const text of ['한빛 2024년\n63%.','ㅎㅏㄴ','  가\r\n나 ','👍🏽 됐다'])assert.equal(writingLength(text),homeworkLength(text),text);
 assert.equal(writingLength('가 나\n다'),4);
});

test('문장 끝 꼴과 문장 나누기', ()=>{
 assert.deepEqual(['있습니다.','안녕하십니까?','찾아가십시오.','좋아요.','그렇죠?','증가했다.','어떻게 해야 할까?','증가함.','있음','고장 나서','함께 합시다.','규칙을 지킵시다','모입시다','내놓읍시다'].map(endingOf),
  ['formal','formal','formal','polite','polite','plain','plain','noun','noun','other','formal','formal','formal','formal']);
 assert.equal(endingOf('다시 생각해 보시다'),'plain');
 assert.deepEqual(ids(checkWriting(by('w51-recycle'),{a:'수요일에만 내놓읍시다',b:'함께 지킵시다'})),[]);
 assert.deepEqual(sentencesOf('수거하지 않습니다.그러니 보관하세요. 3.5%다.').map(s=>s.text),['수거하지 않습니다.','그러니 보관하세요.','3.5%다.']);
 assert.deepEqual(sentencesOf('수요일에 내놓습니다.2026년부터 바뀝니다.').map(s=>s.text),['수요일에 내놓습니다.','2026년부터 바뀝니다.']);
 // 같은 문장에 빈칸이 둘이면 다른 빈칸 자리를 띄어 앞뒤 어절이 붙지 않는다.
 assert.equal(blankContext({passage:[['그는 ',{blank:'a'},'고 ',{blank:'b'},'.']],blanks:[{id:'a',mark:'㉠'},{id:'b',mark:'㉡'}]},'b').before,'그는  고');
 assert.deepEqual(blankContext(by('w51-recycle'),'a'),{before:'지금은 화요일과 금요일 두 번 내놓고 있지만 다음 달부터는',after:'',next:'그 대신 수거 시간은 저녁 6시부터 밤 10시까지로 늘어납니다.',endsSentence:true});
});

test('51·52: 문체·앞말 되풀이·한 문장 넘기기·뒤 문장 옮기기·끝맺음·말하는 낱말을 「확인해 보세요」로', ()=>{
 assert.deepEqual(ids(checkWriting(by('w51-recycle'),{a:'다음 달부터는 수요일에만 내놓으세요',b:'수거하지 않습니다. 그러니 다음 수거일까지 보관해 주세요.'})),
  ['a:beforeWords','a:style','b:oneSentence','b:nextSentence','b:style']);
 assert.deepEqual(ids(checkWriting(by('w51-repair'),{a:'보일러가 고장 나서',b:'기다릴게요'})),['a:unfinished','b:style']);
 assert.deepEqual(ids(checkWriting(by('w51-study'),{a:'이번 주에는 문을 닫습니다',b:'몇 명이 오는지 알아야 해요'})),['a:style']);
 assert.deepEqual(ids(checkWriting(by('w52-crowd'),{a:'맛있기 때문이에요',b:'진짜 스스로 생각해야 한다'})),['a:style','b:spoken']);
 // 비운 빈칸은 메모(note)일 뿐 확인할 곳으로 세지 않는다.
 const empty=checkWriting(by('w52-card'),{a:'',b:'현금을 쓰는 것이 좋다'});assert.equal(checkCount(empty),0);assert.equal(empty.items[0].id,'empty');
});

test('53·54: 분량·제목·문체·개조식·자료 숫자·문제 베끼기·문단·맞춤법', ()=>{
 const r53=checkWriting(by('w53-resale'),'중고 거래 앱 이용자 수의 변화\n이용자는 2020년 300만 명에서 늘었습니다. 근데 2024년에는 1200만 명이 됬다.\n- 물가 상승\n- 동네 거래');
 assert.deepEqual(ids(r53),['short','title','style','list','facts','spoken','spelling']);
 assert.deepEqual(r53.items.find(i=>i.id==='facts').labels,['2022년 780만 명','2026년 1,500만 명(전망)']);
 assert.equal(r53.items.find(i=>i.id==='short').far,true);
 const prompt=by('w54-translation');
 const r54=checkWriting(prompt,`${prompt.prompt} 외국어를 배울 때 어려운 점은 무엇인가? 나는 공부할수있다고 생각한다. `.repeat(1));
 assert.deepEqual(ids(r54),['short','copy','spelling']);
 const long=checkWriting(prompt,'가나다라마바사아자차. '.repeat(70));
 assert.deepEqual(ids(long).slice(0,1),['long']);
 assert.ok(long.items.some(i=>i.id==='paragraphs'&&i.level==='note'));
});

test('화면 글: 쓰기 키는 ko·en·mn을 모두 갖고, en·mn에는 한글이 없다 · 동적으로 부르는 키도 표에 있다', ()=>{
 const keys=Object.keys(STRINGS).filter(k=>k.startsWith('writing.'));assert.ok(keys.length>=90);
 for(const key of keys){for(const code of ['ko','en','mn'])assert.ok(STRINGS[key][code],`${key} ${code}`);for(const code of ['en','mn'])assert.doesNotMatch(JSON.stringify(STRINGS[key][code]),/[가-힣]/,`${key} ${code}`);}
 const dynamic=[...[51,52,53,54].map(n=>`writing.type.${n}`),...['ok','partial','retry','empty'].map(f=>`writing.ai.fit.${f}`),...['content','structure','language'].map(c=>`writing.ai.cat.${c}`),
  ...['empty','oneSentence','beforeWords','afterWords','nextSentence','style.formal','style.polite','style.plain','unfinished','spoken','spelling','short','shortFar','long','titleLine','list','copy','facts','paragraphs'].map(c=>`writing.check.${c}`),
  ...['limit','budget','changed','doneBefore','busy','empty','unavailable'].map(s=>`writing.ai.${s}`)];
 for(const key of dynamic)assert.ok(STRINGS[key],key);
 // 화면 모듈이 부르는 점검 id는 규칙 점검이 내는 id와 같다.
 const source=read('experiences/synk-world-app/world-writing-check.mjs');
 for(const id of [...source.matchAll(/id:'([a-zA-Z]+)'/g)].map(m=>m[1]))assert.ok(STRINGS[`writing.check.${id}`]||id==='style'||id==='title',id);
});

test('연결: 개발 서버·공개 빌드 목록, 앱 셸 명령·배우기 줄, 계정 통로, 계획 후보', async ()=>{
 const server=read('experiences/synk-world-app/server.mjs'),build=read('tools/build-world-app-public.mjs');
 for(const name of ['world-writing-practice.mjs','world-writing-check.mjs','world-writing-items.json','world-writing.css']){assert.ok(server.includes(`'/${name}'`),name);assert.ok(build.includes(`'${name}'`),name);}
 const shell=read('experiences/synk-world-app/app-shell.mjs');
 assert.match(shell,/writing:openWriting/);assert.match(shell,/moreRows:print=>writingRow\(print\)/);assert.match(shell,/'world-writing':'WRITING'/);
 assert.match(read('experiences/brand-opening/home.mjs'),/hanger-list\|writing\|game-/);
 const account=read('experiences/synk-world-app/world-account.mjs');
 assert.match(account,/\['writing','POST'\]/);assert.match(account,/path==='writing'\?'world-writing'/);assert.match(account,/get supportsWriting\(\)\{return !native;\}/);
 assert.match(read('experiences/synk-world-app/world-account.bundle.mjs'),/\["writing", ?"POST"\][\s\S]*writingRequest/,'node tools/build-world-account.mjs');
 const {WRITING_CANDIDATES,WRITING_SKILLS}=await import('../world-writing-practice.mjs');
 const skills=JSON.parse(read('strata/topik-ii.skills.json')).skills.filter(s=>s[1]==='writing').map(s=>s[0]);
 for(const id of Object.values(WRITING_SKILLS))assert.ok(skills.includes(id),id);
 assert.deepEqual(WRITING_CANDIDATES.map(c=>[c.route,c.minutes]),[['writing:51',8],['writing:52',8],['writing:53',18],['writing:54',35],['writing:mock',55]]);
});
