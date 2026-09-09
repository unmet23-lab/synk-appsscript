'use strict';
const fs=require('node:fs'); const path=require('node:path'); const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const load=file=>JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8'));
const finals=load('교정확정.json'); const inventory=load('조각과문맥.json');
const korean=new Map(load('한국어짝.json').map(row=>[row.id,row.koreanRows]));
const file='엔진_콘텐츠AI.js'; const lines=fs.readFileSync(path.join(root,file),'utf8').split(/\r?\n/);
const rules=[['эмхлэнэ','эмхэлнэ','https://toli.gov.mn/w/1Eo8hKF6v5nufkFi (эмхэл, II.11.4, мэндэлнэ와 같은 활용)'],['сольвол','соливол','https://toli.gov.mn/r §32 직접 예시 соль-соливол'],['Сольвол','Соливол','https://toli.gov.mn/r §32 직접 예시 соль-соливол'],['секундыг','секундийг','https://toli.gov.mn/w/WemSH8MkpxYBhUFZ 대격 직접 등재']];
const patches=['*** Begin Patch','*** Update File: '+file]; const evidence=[];
for(let i=0;i<lines.length;i++){
  const line=lines[i]; const matching=rules.filter(rule=>line.includes(rule[0])); if(!matching.length)continue;
  const texts=require('../../../tools/몽골어출구.js').조각뽑기(line);
  const oldText=texts.find(text=>matching.some(rule=>text.includes(rule[0]))); assert(oldText);
  let finalText=oldText; let newLine=line;
  for(const [from,to] of matching){finalText=finalText.replaceAll(from,to);newLine=newLine.replaceAll(from,to);}
  let row=finals.find(row=>row.finalText===oldText);
  if(!row){const original=inventory.find(row=>row.text===oldText);assert(original);row={id:original.id,oldText:oldText,newText:finalText,locations:original.locations,koreanRows:korean.get(original.id)||[],parallelKorean:[],reasons:['표준 활용형 교정'],evidence:['활용형최종근거.json']};finals.push(row);}
  row.finalText=finalText; row.orthographicFinal={source:'공식 국가 표준사전 + spellcheck.mn 제안 실제 대조',changes:matching};
  row.finalReview=row.finalReview||{id:row.id,decision:'accept',reasonKo:'기존 전수 문맥 대조 + 새 활용형 공식 사전 대조; 새 최종문 Claude 호출은 하지 않음.',evidence:'활용형최종근거.json'};
  assert.deepEqual(finalText.match(/\d+/g),oldText.match(/\d+/g));assert.deepEqual(finalText.match(/[가-힣ㄱ-ㅣ]+/g),oldText.match(/[가-힣ㄱ-ㅣ]+/g));
  patches.push('@@','-'+line,'+'+newLine);evidence.push({id:row.id,line:i+1,oldFinal:oldText,newFinal:finalText,rules:matching});
}
assert.equal(evidence.length,5);assert.equal(finals.length,71);
patches.push('*** End Patch');
fs.writeFileSync(path.join(__dirname,'활용형반영차이.patch'),patches.join('\n')+'\n');
fs.writeFileSync(path.join(__dirname,'활용형최종근거.json'),JSON.stringify({checkedAt:new Date().toISOString(),changedLiterals:5,newLiteralsBeyondPrevious:2,evidence},null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'교정확정.json'),JSON.stringify(finals,null,2)+'\n');
console.log(JSON.stringify({total:finals.length,adjusted:5,new:2}));
