// 첫 레슨들(인사 팩)의 화면 언어 글(10-19 1판): 원문이 바뀌면 이 표가 낡았다고 알리고, 학습 내용(한국어 인용·보기)은 그대로인지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PACKS,LESSONS} from '../life-content.mjs';
import {LIFE_QUESTION_TEXT,LIFE_EXPRESSION_TEXT,LIFE_CHOICE_MEANINGS,lifeQuestionText,lifeExpressionText,lifeChoiceMeanings} from '../life-content-lang.mjs';

const HANGUL=/[ᄀ-ᇿ㄰-㆏가-힣]/;
const greetings=PACKS.find(pack=>pack.id==='greetings');
const questions=greetings.lessons.flatMap(lesson=>lesson.questions.flatMap(q=>[q,q.review]));
const FIELDS=['prompt','context','explanation'];
// 문장 속 한국어 인용(‘…’ · “…” · 「…」)은 학습 내용이다.
const quotes=text=>[...String(text).matchAll(/[‘“「]([^’”」]*[가-힣][^’”」]*)[’”」]/g)].map(m=>m[1]);

test('인사 팩의 모든 문제(복습 포함)에 화면 언어 글이 있고, ko 사본이 지금 원문과 같다',()=>{
 assert.equal(questions.length,18);
 for(const q of questions){
  const entry=LIFE_QUESTION_TEXT[q.id];assert.ok(entry,`${q.id} 없음`);
  for(const field of FIELDS)assert.equal(entry.ko[field],q[field]??'',`${q.id}.${field}: 원문이 바뀌었으면 번역도 고친다`);
  for(const code of ['en','mn']){
   assert.ok(entry[code].prompt.trim()&&entry[code].explanation.trim(),`${q.id} ${code}`);
   assert.equal(Boolean(entry[code].context),Boolean(entry.ko.context),`${q.id} ${code} 상황 유무`);
  }
 }
 const known=new Set(questions.map(q=>q.id));
 assert.deepEqual(Object.keys(LIFE_QUESTION_TEXT).filter(id=>!known.has(id)),[],'없는 문제의 번역이 없다');
});

test('한국어 인용은 영어·몽골어에도 한국어 그대로 남고, 그 밖에는 한글이 없다',()=>{
 for(const [id,entry]of Object.entries(LIFE_QUESTION_TEXT))for(const field of FIELDS){
  const korean=quotes(entry.ko[field]);
  for(const code of ['en','mn']){
   const text=entry[code][field];
   for(const quote of korean)assert.ok(text.includes(quote),`${id}.${field} ${code}에 ‘${quote}’가 없다`);
   const rest=text.replace(/[‘“«「][^’”»」]*[’”»」]/g,'').replace(/\([^)]*\)/g,'');
   assert.ok(!HANGUL.test(rest),`${id}.${field} ${code}: 인용·괄호 밖 한글 «${rest}»`);
  }
 }
});

test('「뜻 보기」: 인사 팩 문제는 답한 뒤 보기마다 뜻이 있고, 한국어 화면과 1판 밖 문제에는 없다',()=>{
 for(const q of questions)for(const code of ['en','mn']){
  const rows=lifeChoiceMeanings(q,code);
  assert.ok(rows,`${q.id} ${code}`);assert.deepEqual(rows.map(r=>r.text),q.choices.map(c=>c.text));
  assert.ok(rows.every(r=>r.meaning&&!HANGUL.test(r.meaning.replace(/\([^)]*\)/g,''))),`${q.id} ${code} 뜻`);
 }
 assert.equal(lifeChoiceMeanings(questions[0],'ko'),null);
 const cafe=LESSONS.find(lesson=>lesson.packId==='cafe'&&lesson.questions?.length).questions[0];
 assert.equal(lifeChoiceMeanings(cafe,'en'),null);
 const used=new Set(questions.flatMap(q=>q.choices.map(c=>c.text)));
 assert.deepEqual(Object.keys(LIFE_CHOICE_MEANINGS).filter(text=>!used.has(text)),[],'쓰지 않는 뜻이 없다');
});

test('글 고르기: 한국어와 1판 밖 문제는 원문, 원문이 바뀐 문제도 원문으로 돌아간다',()=>{
 const q=questions[0];
 assert.equal(lifeQuestionText(q,'prompt','ko'),q.prompt);
 assert.equal(lifeQuestionText(q,'prompt','en'),LIFE_QUESTION_TEXT[q.id].en.prompt);
 assert.equal(lifeQuestionText(q,'prompt','mn'),LIFE_QUESTION_TEXT[q.id].mn.prompt);
 assert.equal(lifeQuestionText({...q,prompt:'바뀐 원문이에요.'},'prompt','en'),'바뀐 원문이에요.');
 const other=LESSONS.find(lesson=>lesson.packId==='store').questions[0];
 assert.equal(lifeQuestionText(other,'prompt','en'),other.prompt);
});

test('표현 설명: ko 사본이 원문과 같고 영어·몽골어가 있다',()=>{
 for(const lesson of greetings.lessons)for(const expression of lesson.expressions){
  const entry=LIFE_EXPRESSION_TEXT[expression.id];assert.ok(entry,expression.id);
  assert.equal(entry.ko,expression.meaning,expression.id);
  assert.equal(lifeExpressionText(expression,'ko'),expression.meaning);
  assert.equal(lifeExpressionText(expression,'mn'),entry.mn);
  assert.ok(entry.en&&entry.mn);
 }
});
