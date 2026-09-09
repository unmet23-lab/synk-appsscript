'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'../../..');
const load = file=>JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8'));
const candidates = load('출처교정후보.json').sort((a,b)=>a.locations[0].line-b.locations[0].line);
const review = new Map(load('출처독립결과.json').reviews.map(row=>[row.id,row]));
const previous = load('교정확정.json').filter(row=>!candidates.some(candidate=>candidate.id===row.id));
assert.equal(previous.length,40,'기존 교정 40개를 보존해야 함');
const patches=['*** Begin Patch','*** Update File: 엔진_콘텐츠AI.js'];
const lines=fs.readFileSync(path.join(root,'엔진_콘텐츠AI.js'),'utf8').split(/\r?\n/);
const extras=[];
for(const row of candidates){
  const verdict=review.get(row.id);
  assert(verdict&&['accept','revise'].includes(verdict.decision),`미확정 ${row.id}`);
  const finalText=verdict.decision==='revise'?verdict.newText:row.newText;
  assert.deepEqual(finalText.match(/[가-힣ㄱ-ㅣ]+/g),row.oldText.match(/[가-힣ㄱ-ㅣ]+/g),`한국어 예문 ${row.id}`);
  assert.deepEqual(finalText.match(/\d+/g),row.oldText.match(/\d+/g),`숫자 ${row.id}`);
  assert.deepEqual(finalText.match(/\\./g),row.oldText.match(/\\./g),`이스케이프 ${row.id}`);
  assert.deepEqual(finalText.match(/<[^>]+>/g),row.oldText.match(/<[^>]+>/g),`태그 ${row.id}`);
  assert(!/["\r\n]/.test(finalText),'이 묶음에 새 인용부호/줄바꿈 금지');
  assert.equal(row.locations.length,1);
  const loc=row.locations[0]; assert.equal(loc.file,'엔진_콘텐츠AI.js');
  const line=lines[loc.line-1];
  assert(line.includes('"'+row.oldText+'"'),`원문 드리프트 ${row.id}`);
  patches.push('@@','-'+line,'+'+line.replace('"'+row.oldText+'"','"'+finalText+'"'));
  extras.push({...row,finalText,finalReview:{...verdict,evidence:'출처독립결과.json'}});
}
patches.push('*** End Patch');
if(process.argv.includes('--patch'))process.stdout.write(patches.join('\n')+'\n');
else {
  fs.writeFileSync(path.join(__dirname,'출처반영차이.patch'),patches.join('\n')+'\n');
  fs.writeFileSync(path.join(__dirname,'교정확정.json'),JSON.stringify([...previous,...extras],null,2)+'\n');
  console.log(JSON.stringify({previous:previous.length,extra:extras.length,total:previous.length+extras.length}));
}
