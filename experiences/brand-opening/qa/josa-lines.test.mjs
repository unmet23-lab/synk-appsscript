// 10-19 고장 묶음 7번: 튜터 말·한글 도움말의 받침 조사. 한국어를 가르치는 앱이라 「「안녕하세요.」을」·「‘빈’와」 같은 말이 나오면 안 된다.
// 조사는 키트의 josa()(play-common/kit/josa.mjs의 사본 kit/josa.mjs)로 고른다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hangulSupport,firstSupport} from '../game-tutor-support.mjs';
import {homeTutorMemoryLine} from '../home-tutor-days.mjs';

test('the Hangul hint picks 과/와 and 을/를 by the final consonant of each letter',()=>{
 const hint=(selected,target)=>hangulSupport({id:'josa-hg',target,selected,options:[selected,target],heard:true})[0].hint;
 assert.equal(hint('빈','빌'),'고른 ‘빈’과 알맞은 ‘빌’을 다시 비교해 보세요.');
 assert.equal(hint('가','나'),'고른 ‘가’와 알맞은 ‘나’를 다시 비교해 보세요.');
 assert.equal(hint('ㄱ','ㅏ'),'고른 ‘ㄱ’과 알맞은 ‘ㅏ’를 다시 비교해 보세요.','a consonant letter is read by its name (기역), a vowel letter has no final');
});

test('the first sentence play hint ends with 이에요 or 예요 by the expression',()=>{
 const q=(text)=>({questionId:'q-josa',prompt:'상황',options:[{optionId:'a',text},{optionId:'b',text:'다른 말'}]});
 assert.equal(firstSupport(q('안녕하세요.'),{correctOptionId:'a'},'b')[0].hint,'이 상황에 어울리는 표현은 ‘안녕하세요.’예요.');
 assert.equal(firstSupport(q('따뜻한 물'),{correctOptionId:'a'},'b')[0].hint,'이 상황에 어울리는 표현은 ‘따뜻한 물’이에요.');
});

test('Marin remembers an expression with 을/를 that fits its last syllable',()=>{
 const memory=(title,kind,tryAlone=false)=>({when:'어제',title,kind,tryAlone,tutorId:'marin'});
 for(const kind of ['guided','assisted','independent','retry']){
  assert.ok(homeTutorMemoryLine('marin',memory('안녕하세요.',kind)).includes('「안녕하세요.」를'),kind);
  assert.ok(homeTutorMemoryLine('marin',memory('따뜻한 물',kind)).includes('「따뜻한 물」을'),kind);
  assert.doesNotMatch(homeTutorMemoryLine('marin',memory('안녕하세요.',kind)),/」을/);
 }
 assert.ok(homeTutorMemoryLine('marin',memory('감사합니다.','guided',true)).includes('「감사합니다.」를'));
});

test('Hangul stage feedback lines no longer glue 를/와 after a letter variable',()=>{
 const source=fs.readFileSync(new URL('../../hangul-stage/app.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\}’(를|을|와|과) /,'every particle after a letter comes from josa()');
});
