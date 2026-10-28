import test from 'node:test';import assert from 'node:assert/strict';
import {정책만들기,다시검수자들,대신할검수자,대체순서} from '../tools/lib/검수증명.mjs';
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
