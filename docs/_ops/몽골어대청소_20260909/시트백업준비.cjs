'use strict';
// UI에서 읽은 정확한 ID/행/이전 문자열 일치 결과를 출처 정본과 결합한 복구용 백업. 시트 쓰기 없음.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8'));
const facts = read(process.argv[2] || '시트읽기검증.json');
const candidates = read('시트교정후보.json');
const updates = facts.rows.map(fact=>{
  assert(fact.oldTextMatched === true && fact.idMatched === true);
  const candidate = candidates.find(row=>row.contentId===fact.contentId);
  assert(candidate && /^M[1-9]\d*$/.test(fact.cell));
  return {...candidate, cell:fact.cell, oldTextMatched:true, idMatched:true};
});
const backup = {createdAt:new Date().toISOString(),sheetName:'contents',gid:1573768478,spreadsheetId:'1sv6cim9BET2oQqJFXQU9xgyEMlhxDAu0lrojQJwDx1M',header:'몽골어',column:'M',forbiddenColumns:['D','G'],source:'기존 로그인 브라우저 UI에서 A열 ID와 M열 원문 정확 일치 확인',written:false,updates};
fs.writeFileSync(path.join(__dirname,facts.backupName),JSON.stringify(backup,null,2)+'\n');
console.log(JSON.stringify({backup:facts.backupName,count:updates.length}));
