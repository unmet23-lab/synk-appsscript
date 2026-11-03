import test from 'node:test';
import assert from 'node:assert/strict';
import {채우기,명세꼴,이에요,아야,이가,받침,부름,바뀌는줄,정문,빈칸} from '../experiences/drama/s1/ep01-나.mjs';
import ep01 from '../experiences/drama/s1/ep01.mjs';
import {checkSpec,judgeLine} from '../tools/lib/드라마판정.mjs';
// 1화에 들어갈 「제2의 나」 새 줄(2026-11-03 초안): 이름 받침 규칙 · 틀을 채운 명세가 판정기 점검을 통과하는지 · 흔한 실수가 바라는 노트를 받는지.
// 네트워크 · 모델을 부르지 않는다.

const 학생들=[['바트에르덴','mn','형누나'],['마이','vn','오빠언니'],['자수르','uz','선배'],['엥흐진','other','형누나'],['아이게림','kz','오빠언니'],['응우옌 티 마이','vn','선배']];

test('이름 끝 받침으로 「이에요/예요」 · 「아/야」 · 「이/가」를 고른다',()=>{
 assert.deepEqual(['바트에르덴','엥흐진','투안'].map(이에요),['이에요','이에요','이에요']);
 assert.deepEqual(['마이','자수르','응우옌 티 마이'].map(이에요),['예요','예요','예요']);
 assert.equal(아야('바트에르덴'),'아');assert.equal(아야('마이'),'야');
 assert.equal(이가('엥흐진'),'이');assert.equal(이가('자수르'),'가');
 assert.equal(받침('Maria'),false,'한글이 아닌 표기는 받침 없음으로 본다');
});

test('틀을 채운 새 학생 줄이 모두 자기 명세를 확실히 통과한다(이름 · 나라 · 갈래 여러 조합)',()=>{
 for(const [이름,나라,갈래이름] of 학생들){
  const {줄}=채우기({이름,나라,갈래이름});
  const 학생=줄.filter(l=>l.누가==='학생');
  assert.equal(학생.length,나라==='other'?2:3,`${이름} 학생 줄 수`);
  for(const l of 학생){
   assert.deepEqual(checkSpec(명세꼴(l)),[],`${이름} ${l.id} ${l.말}`);
   assert.ok(![l.말,l.뜻,...(l.어휘||[]),...l.명세.variants,...l.명세.keys.map(k=>k.word)].some(빈칸),`${l.id} 채우지 못한 칸`);
   assert.ok(l.명세.names.includes(이름),'학생 이름은 판정에서 뺀다');
  }
 }
});

test('흔한 실수: 반말 끝은 끝맺음 노트, 한 낱말은 길이 노트, 예요 · 이에요 고름은 판정하지 않는다',()=>{
 const {줄}=채우기({이름:'바트에르덴',나라:'mn',갈래이름:'형누나'});
 const 판=(id,t)=>judgeLine(명세꼴(줄.find(l=>l.id===id)),{transcript:t});
 assert.equal(판('s1e01-n1','저는 바트에르덴이에요').sure,true);
 assert.equal(판('s1e01-n1','저는 바트에르덴예요').verdict,'pass','받아 적기는 들은 대로 적어 고름을 판정할 수 없다 — 카드가 가르친다');
 assert.equal(판('s1e01-n1','저는 바트에르덴이야').note?.kind,'ending');
 assert.equal(판('s1e01-n2','몽골 사람이에요').sure,true,'「○○ 사람이에요」도 맞는 답');
 assert.equal(판('s1e01-n2','몽골에서 왔어').note?.kind,'ending');
 assert.equal(판('s1e01-n3','잘 부탁해요 누나').sure,true,'호칭이 뒤에 와도 끝맺음은 그 앞 말로 본다');
 assert.equal(판('s1e01-n3','잘 부탁해 누나').note?.kind,'ending');
 assert.equal(판('s1e01-n3','누나').note?.kind,'length');
});

test('이름을 말하지 않으면 이름 줄을 건너뛰고, 부름은 이름 없는 판 · 단톡방은 「신입생」',()=>{
 const {줄,단톡방}=채우기({이름:null,나라:'kz',갈래이름:'선배'});
 assert.ok(!줄.some(l=>l.id==='s1e01-n1'));
 assert.equal(줄.find(l=>l.부름==='정문-A').말,'반가워요!');
 assert.ok(단톡방.every(m=>!m.말.includes('{')&&m.말.startsWith('신입생')));
});

test('부름 줄은 어른만 「○○ 씨」, 선배 · 또래는 이름만 — 「아/야」를 소리로 굽지 않는다(설계 6절)',()=>{
 for(const b of 부름){
  if(b.누가==='교수')assert.match(b.틀,/\{이름\} 씨/);
  else assert.doesNotMatch(b.틀,/\{이름\}\{?(아야|아|야)\}?/);
 }
});

test('바뀌는 1화 줄은 지금 대본의 인물 줄과 글자 그대로 같다 — 학생 줄은 건드리지 않는다',()=>{
 const 인물줄=ep01.촬영일.flatMap(d=>d.줄||[]).filter(l=>l.누가!=='학생').map(l=>l.말);
 for(const b of 바뀌는줄)assert.ok(인물줄.includes(b.지금),b.지금);
 assert.ok(정문.줄.filter(l=>l.누가==='학생').every(l=>l.id.startsWith('s1e01-n')),'새 학생 줄 id');
});
