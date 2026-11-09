// 다국어 판 1(2026-11-09, 기획 12-2) — 화면 쪽: 번역 틀(복수형 · 언어 고르기), 화면 빈 답과 서버 답 칸, 오류 코드. 영어 사전 대조는 pulse-i18n-dictionary.test.mjs(저장소 전용 — acorn)에 있다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyRequestAnswers,normalizeRequestAnswers} from './pulse-requests.mjs';
import {tl,pickLocale,registerLocale} from './public/pulse-app/i18n.mjs';
import en from './public/pulse-app/i18n/en.mjs';

test('새 답 칸의 값 꼴(서버 허용 목록 · 기본값 · 화면 빈 답이 같은 이름)',async()=>{
  const {emptyAnswers,answersForServer}=await import('./public/pulse-app/request-data.mjs');
  const server=Object.keys(emptyRequestAnswers()).sort(),screen=Object.keys(emptyAnswers()).sort();
  assert.deepEqual(screen,server,'화면 빈 답과 서버 기본값의 칸이 같다');
  const sent=answersForServer(emptyAnswers());
  for(const key of ['hair','contactLocale','outputLocales','targetMarket','quoteCurrency'])assert.equal(Object.hasOwn(sent,key),false,key+' — 비어 있으면 보내지 않는다(옛 서버 호환)');
  assert.doesNotThrow(()=>normalizeRequestAnswers(sent));
  const filled=answersForServer({...emptyAnswers(),hair:'look-3',targetMarket:['US'],contactLocale:'en'});
  assert.equal(filled.hair,'look-3');assert.deepEqual(filled.targetMarket,['US']);
  const clean=normalizeRequestAnswers({...sent,...filled,outputLocales:['ko','ko','en'],targetMarket:['US','US']});
  assert.deepEqual(clean.outputLocales,['ko','en']);assert.deepEqual(clean.targetMarket,['US']);
  assert.throws(()=>normalizeRequestAnswers({targetMarket:['U1']}),/고른 값/);
  assert.throws(()=>normalizeRequestAnswers({targetMarket:Array(9).fill('US')}),/고른 값/);
});

test('번역 틀: 한국어는 받은 문장 그대로, 복수형은 그 언어의 꼴로, 언어 고르기는 서버가 허락한 목록 안에서',()=>{
  registerLocale('en',{...en,'파일 {count}개':{one:'{count} file',other:'{count} files'}});
  assert.equal(tl('ko','파일 {count}개',{count:1}),'파일 1개');
  assert.equal(tl('en','파일 {count}개',{count:1}),'1 file');assert.equal(tl('en','파일 {count}개',{count:3}),'3 files');
  assert.equal(tl('en','사전에 없는 문장'),'사전에 없는 문장');
  const allowed=['ko','en'];
  assert.equal(pickLocale({browser:['en-US','ko-KR'],allowed:['ko']}),'ko','허락 전에는 늘 한국어');
  assert.equal(pickLocale({browser:['fr-FR','de'],allowed}),'en','한국어가 없는 브라우저는 영어로');
  assert.equal(pickLocale({browser:['fr-FR','ko'],allowed}),'ko');
  assert.equal(pickLocale({browser:[],allowed}),'ko');
  assert.equal(pickLocale({chosen:'ko',browser:['en'],allowed}),'ko','손님이 고른 것이 먼저');
  assert.equal(pickLocale({project:'en',browser:['ko'],allowed}),'en','프로젝트 소통 언어가 브라우저보다 먼저');
  assert.equal(pickLocale({chosen:'ja',project:'ja',browser:['ja'],allowed:['ko','en','ja']}),'en','사전 없는 일본어는 고르지 않는다(한국어 없는 브라우저 → 영어)');
});

const APP=new URL('./public/pulse-app/',import.meta.url);
test('서버 오류 코드: 서버가 붙이는 SYNK_PULSE_ 코드마다 화면 문장이 있고, 한국어 화면은 받은 문장 그대로다',async()=>{
  const {ERROR_CODE_TEXT,errorText}=await import('./public/pulse-app/api.mjs');
  const {setLocale}=await import('./public/pulse-app/i18n.mjs');
  const server=['pulse-requests.mjs','pulse-studio.mjs','client-projects.mjs'].map(name=>readFileSync(new URL(name,import.meta.url),'utf8')).join('\n');
  const codes=[...new Set([...server.matchAll(/'(SYNK_PULSE_[A-Z0-9_]+)'/g)].map(m=>m[1]))];
  assert.ok(codes.includes('SYNK_PULSE_FILE_MISSING'));
  for(const code of codes){assert.ok(Object.hasOwn(ERROR_CODE_TEXT,code),code);assert.ok(Object.hasOwn(en,ERROR_CODE_TEXT[code]),code+' 영어');}
  const message='「사진.png」 파일을 찾지 못했어요. 지우고 다시 올려 주세요.';
  assert.equal(errorText(message,'SYNK_PULSE_FILE_MISSING'),message,'한국어는 파일 이름이 든 서버 문장 그대로');
  await setLocale('en');
  try{
    assert.equal(errorText(message,'SYNK_PULSE_FILE_MISSING'),en[ERROR_CODE_TEXT.SYNK_PULSE_FILE_MISSING]);
    assert.equal(errorText('사전에 없는 서버 문장'),'사전에 없는 서버 문장','없는 문장은 원문(판 2에서 사전을 채운다)');
  }finally{await setLocale('ko');}
});
// 서버 오류 문장의 영어(손님 길 fail · httpError 리터럴과 사전 대조)는 pulse-i18n-server-errors.test.mjs가 본다(판 2).

// 기기 알림 대신 글(Fable 판 2 F1): 한국어 손님은 등록 주소도 글도 판 2 전과 같고, 영어 화면에서 등록할 때만 lang=en으로 영어 한 문장이다.
test('기기 알림 대신 글은 한 언어만: 한국어 손님 글에 영어가 섞이지 않는다',()=>{
  const worker=readFileSync(new URL('push-sw.js',APP),'utf8');
  assert.match(worker,/'프로젝트에 확인할 새 소식이 있어요\.'/);
  assert.match(worker,/params\.get\('lang'\)==='en'\?'There’s a new update on your project\.'/);
  assert.doesNotMatch(worker,/소식이 있어요\. · There/);
  assert.match(readFileSync(new URL('app.mjs',APP),'utf8'),/push-sw\.js\?mode='\+mode\+\(mode==='customer'&&locale\(\)==='en'\?'&lang=en':''\)/);
});
