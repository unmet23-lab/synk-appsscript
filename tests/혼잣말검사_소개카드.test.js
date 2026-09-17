'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),original=path.join(root,'docs/캐릭터/소개글_정본.json');
function run(mutate){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-card-'));const file=path.join(dir,'cards.json');try{const j=JSON.parse(fs.readFileSync(original,'utf8'));mutate?.(j);fs.writeFileSync(file,JSON.stringify(j));return spawnSync(process.execPath,['tools/혼잣말검사.js'],{cwd:root,encoding:'utf8',env:{...process.env,SYNK_소개글_정본:file}});}finally{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});}}
test('원본 카드의 구조를 읽는다',()=>{const r=run();assert.equal(r.status,0,r.stderr);});
test('부정어·숫자·문장부호만으로 문안을 거절하지 않는다',()=>{const r=run(j=>{j.카드[0].한마디='실패했지만 2번 더 시도했어요. 다음에는 무엇을 해 볼까요?';j.카드[2].잘했을때='멋져요!';});assert.equal(r.status,0,r.stderr);});
test('카드 누락은 여전히 실패다',()=>{const r=run(j=>{j.카드.pop();});assert.equal(r.status,1);assert.match(r.stderr,/셋이 한 장씩/);});
test('필수 문구 누락은 여전히 실패다',()=>{const r=run(j=>{j.카드[0].한마디='';});assert.equal(r.status,1);assert.match(r.stderr,/한마디 비었다/);});
