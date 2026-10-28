import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {정책만들기,다시검수자들,대신할검수자,대체순서,sha256} from '../tools/lib/검수증명.mjs';
const opts={종류:'화면',작성자:'GPT',담당예외:'topik-writing-semantic-20261028',끝:'작업본'};
const file={경로:'experiences/korean-study/src/app.mjs',상태:'M'};
test('직접 승인한 의미 튜터만 GPT 구현·아르곤 검수, 다시 검수도 아르곤이며 자동 대체 없다',()=>{
 for(const 종류 of ['화면','백엔드']){const p=정책만들기({...opts,종류},[file]);assert.deepEqual(p.필수,['아르곤']);assert.equal(p.예외,null);assert.equal(대체순서(p),null);assert.deepEqual(다시검수자들(p,[{출처:'아르곤'}]),['아르곤']);assert.deepEqual(대신할검수자(p,'아르곤'),['아르곤']);}
});
test('기존 GPT 화면 금지·백엔드 공동 검수는 유지, 범위·삭제·다른 예외 혼합은 거절',()=>{
 assert.throws(()=>정책만들기({종류:'화면',작성자:'GPT'},[file]));assert.deepEqual(정책만들기({종류:'백엔드',작성자:'GPT'},[file]).필수,['GPT','Claude']);
 for(const change of [{담당예외:'other'},{작성자:'Claude'},{예외:'내부'},{페이블생략:'skip'},{GPT구독:'종료'}])assert.throws(()=>정책만들기({...opts,...change},[file]));
 for(const 경로 of ['Code.js','lib/auth.js','supabase/migrations/delete.sql','experiences/other/app.js','../experiences/korean-study/src/app.mjs','experiences/korean-study/../../lib/auth.js','experiences/../atlas-learning.js'])assert.throws(()=>정책만들기(opts,[{...file,경로}]));
 assert.throws(()=>정책만들기(opts,[{...file,상태:'D'}]));assert.throws(()=>정책만들기(opts,[]));
});
test('의미 튜터 계정 묶음의 누락 CSS 보완은 허용하고 다른 공개 스타일·QA·삭제는 거절',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'study-css-review-'));
 t.after(()=>{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5});});
 const qa={경로:'experiences/synk-account/qa/study-town-style-20261028/patch-live.mjs',상태:'A'};
 const candidate=(경로,종류='바꿈')=>{
  const bytes='.town-records{display:grid}\n',file=path.join(dir,경로);
  assert.ok(path.resolve(file).startsWith(dir+path.sep));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
  if(종류==='지움')fs.unlinkSync(file);
  fs.writeFileSync(path.join(dir,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:[{경로,종류,모드:종류==='지움'?null:'100644',sha256:종류==='지움'?null:sha256(bytes)}]}));
  return {...opts,배포후보:dir};
 };
 assert.deepEqual(정책만들기(candidate('account/style.css'),[qa]).필수,['아르곤']);
 assert.deepEqual(정책만들기(candidate('account/style.css'),[{경로:'experiences/synk-account/style.css',상태:'M'}]).필수,['아르곤']);
 for(const 경로 of ['id/style.css','world/style.css','account/other.css','account/../style.css'])assert.throws(()=>정책만들기(candidate(경로),[qa]));
 for(const 경로 of ['experiences/synk-account/qa/other/patch-live.mjs','experiences/synk-account/src/portal.mjs'])assert.throws(()=>정책만들기(candidate('account/style.css'),[{...qa,경로}]));
 assert.throws(()=>정책만들기(candidate('account/style.css','지움'),[qa]),/직접 승인 범위/);
});
