'use strict';
// 읽기 검증과 로컬 증거/최소 장부 패치 생성만 한다. 소스·원격·계정 쓰기 없음.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const original = path.resolve(__dirname, '../../..');
const clone = 'C:/Users/q1212/Documents/SYNK-deploy-mn-20260909';
const acorn = require(path.join(original, '영상/node_modules/acorn'));
const sourceCommit = '8e62344a2';
const files = ['Code.js', '엔진_운영배치.js', '엔진_콘텐츠AI.js'];
const git = (args, cwd = original) => {const r = spawnSync('git', ['--no-optional-locks', ...args], {cwd, encoding:'utf8', windowsHide:true, maxBuffer:20*1024*1024}); assert.equal(r.status,0,r.stderr); return r.stdout;};
const load = name => JSON.parse(fs.readFileSync(path.join(original,'docs/_ops/몽골어대청소_20260909',name),'utf8'));
const finalRows = load('교정확정.json');
const records = load('신규지문검토.json');
assert.equal(finalRows.length,71); assert.equal(records.length,71);
const normalize = text => text.replace(/\r\n/g,'\n');
const literalText = text => text.replace(/\\n/g,' ').trim();
const checks = [];
for (const file of files) {
  const before = git(['show',`184fe8c5:${file}`]);
  const after = fs.readFileSync(path.join(clone,file),'utf8');
  assert.equal(normalize(after), normalize(git(['show',`${sourceCommit}:${file}`])), `교정 정본과 다름: ${file}`);
  let changed = 0;
  function walk(a,b) {
    if(Array.isArray(a)){assert.equal(a.length,b.length);a.forEach((v,i)=>walk(v,b[i]));return;}
    if(a&&typeof a==='object'){
      assert.deepEqual(Object.keys(a),Object.keys(b));
      if(a.type==='Literal'&&!a.regex&&a.value!==b.value){
        const oldText=literalText(before.slice(a.start+1,a.end-1));
        const newText=literalText(after.slice(b.start+1,b.end-1));
        assert(finalRows.some(r=>r.oldText===oldText&&r.finalText===newText),'확정 교정 밖 문자열');changed++;
      }
      for(const key of Object.keys(a)) if(!['start','end','raw'].includes(key)&&!(a.type==='Literal'&&key==='value'))walk(a[key],b[key]);
      return;
    }
    assert.deepEqual(a,b);
  }
  walk(acorn.parse(before,{ecmaVersion:'latest'}),acorn.parse(after,{ecmaVersion:'latest'}));
  checks.push({file,changedLiterals:changed,sourceCommitMatch:true,unchangedCodeStructure:true});
}
assert.equal(checks.reduce((sum,r)=>sum+r.changedLiterals,0),71);
const {모으기,지문,잰것들}=require(path.join(clone,'tools/몽골어출구.js'));
const current=모으기();const seen=잰것들();
for(const record of records){assert(current.has(record.번역지문));assert.equal(record.통과,false);assert.equal(record.층.역번역,null);}
const minimal=records.filter(r=>!seen.has(r.번역지문)).map(r=>({시각:r.시각,대상:r.대상,대상지문:r.대상지문,번역지문:r.번역지문,모델:r.모델,사고:r.사고,통과:r.통과,사유:r.사유,층:r.층,근거:{교정ID:r.근거.교정ID,이전지문:r.근거.이전지문,검토기록:'2026-09-09 교정 원본의 실제 검토·사전 결과를 대조하여 이관. 원응답·다른 업무 기록은 공개 이관에서 제외.'}}));
assert.equal(new Set(records.map(r=>r.번역지문)).size,71);
const target=path.join(clone,'docs/_ops/몽골어검문.jsonl');
const ledger=fs.readFileSync(target,'utf8');
if(minimal.length){
  assert.equal(minimal.length,71);
  const tail=ledger.trimEnd().split(/\r?\n/).at(-1);
  const patch=['*** Begin Patch','*** Update File: '+target.replace(/\\/g,'/'),'@@',' '+tail,...minimal.map(r=>'+'+JSON.stringify(r)),'*** End Patch',''].join('\n');
  fs.writeFileSync(path.join(__dirname,'최소검문71.patch'),patch);
}
const check={checkedAt:new Date().toISOString(),clone,base:'184fe8c5d6d30795fd479293e743f1a1f066d7e8',sourceCommit,sourceChecks:checks,totalUnique:current.size,correctedFingerprints:records.length,missingCorrectedEvidence:records.filter(r=>!seen.has(r.번역지문)).length,ledgerRecordsPrepared:minimal.length,dictionarySuspectStrings:records.filter(r=>r.층.맞춤법>0).length,nativeReview:false,reverseTranslation:false};
fs.writeFileSync(path.join(__dirname,'사본대조.json'),JSON.stringify(check,null,2)+'\n');
console.log(JSON.stringify(check));
