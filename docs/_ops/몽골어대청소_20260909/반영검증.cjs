'use strict';
// 이번 교정 증거만 기록. 모델 호출/원격 쓰기/시트 접근 없음.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const acorn = require('../../../영상/node_modules/acorn');
const root = path.resolve(__dirname, '../../..');
const load = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const finals = load('교정확정.json');
const spell = load('사전결과.json');
const {모으기, 지문, 잰것들, 다잰것들} = require('../../../tools/몽골어출구.js');
const {장부쓰기} = require('../../../tools/몽골어대조.js');
const current = 모으기();
const normalize = text => text.replace(/\\n/g, ' ').trim();
const records = [];
const sourceChecks = [];
const sheetCandidates = [];
for (const file of [...new Set(finals.flatMap(row => row.locations.map(loc => loc.file)))]) {
  const beforeResult = spawnSync('git', ['show', `HEAD:${file}`], {cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, windowsHide: true});
  assert.equal(beforeResult.status, 0);
  const beforeText = beforeResult.stdout;
  const afterText = fs.readFileSync(path.join(root, file), 'utf8');
  const parse = text => acorn.parse(text, {ecmaVersion: 'latest'});
  let count = 0;
  function walk(a, b) {
    if (Array.isArray(a)) {assert.equal(a.length, b.length); a.forEach((item, i) => walk(item, b[i])); return;}
    if (a && typeof a === 'object') {
      assert.deepEqual(Object.keys(a), Object.keys(b));
      if (a.type === 'Literal' && !a.regex && a.value !== b.value) {
        const oldText = normalize(beforeText.slice(a.start + 1, a.end - 1));
        const finalText = normalize(afterText.slice(b.start + 1, b.end - 1));
        assert(finals.some(row => row.oldText === oldText && row.finalText === finalText), '승인 밖의 문자열 변경');
        count++;
      }
      if (a.type === 'VariableDeclarator' && a.id.name === 'MN_CONTENTS_G') {
        for (const property of a.init.properties) {
          const oldText = normalize(beforeText.slice(property.value.start + 1, property.value.end - 1));
          const row = finals.find(row => row.oldText === oldText);
          if (row) sheetCandidates.push({id: row.id, contentId: property.key.value, oldText: row.oldText, newText: row.finalText});
        }
      }
      for (const key of Object.keys(a)) if (!['start', 'end', 'raw'].includes(key) && !(a.type === 'Literal' && key === 'value')) walk(a[key], b[key]);
      return;
    }
    assert.deepEqual(a, b);
  }
  walk(parse(beforeText), parse(afterText));
  sourceChecks.push({file, changedLiterals: count, unchangedCodeStructure: true});
}
assert.equal(sourceChecks.reduce((sum, row) => sum + row.changedLiterals, 0), finals.length);
for (const row of finals) {
  const fingerprint = 지문(row.finalText);
  assert.equal(current.get(fingerprint)?.글, row.finalText, `소스 미반영 ${row.id}`);
  const input = spell.inputs.find(input => input.id === row.id);
  assert.equal(input?.text, row.finalText, `사전 입력 드리프트 ${row.id}`);
  const group = spell.groups.find(group => group.ids.includes(row.id));
  assert(group && group.result !== null, `사전 미실행 ${row.id}`);
  const tokens = new Set(row.finalText.match(/[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*/gu));
  const suspects = group.result.의심.filter(word => tokens.has(word));
  const paired = row.koreanRows.length > 0 || row.parallelKorean.length > 0;
  records.push({시각: new Date().toISOString(), 대상: row.locations.map(loc => `${loc.file}:${loc.line}`).join(', '), 대상지문: null, 번역지문: fingerprint,
    모델: row.finalReview.evidence === '활용형최종근거.json' ? 'Antigravity 문맥 검토 + 국가 표준사전 활용형 대조 (최종문 Claude 재호출 없음)' : 'Antigravity gemini-3.1-pro-high + Claude Opus subscription CLI', 사고: 'high', 통과: false,
    사유: `${row.orthographicFinal ? '완성문 문맥/원문 대조 후 최종 활용형은 국가 표준사전으로 재검증' : '완성문 문맥 교정 후 독립 검토 완료'}; ${paired ? '정확한 한국어 원문 짝 대조' : '인접 코드/알림 문맥 대조, 별도 한국어 짝 없음'}; 맞춤법 사전 실측 의심 ${suspects.length}개; 역번역·원어민 감수 미실행. 전체 5겹 PASS 아님.`,
    층: {문법: '정상', 역번역: null, 말투: null, 맞춤법: suspects.length, 뜻: paired ? {큰것: 0, 작은것: 0} : null},
    근거: {교정ID: row.id, 이전지문: 지문(row.oldText), 최종검토: 'docs/_ops/몽골어대청소_20260909/' + (['출처독립결과.json','활용형최종근거.json'].includes(row.finalReview.evidence) ? row.finalReview.evidence : '최종결과.json'), 최종조정: row.finalReview.evidence || null, 활용형최종: row.orthographicFinal || null, 쟁점대조: row.finalReview.evidence === '출처독립결과.json' ? null : 'docs/_ops/몽골어대청소_20260909/쟁점결과.json', 사전: 'docs/_ops/몽골어대청소_20260909/사전결과.json', 사전의심어: suspects}});
}
if (process.argv.includes('--장부')) {
  const seen = 잰것들();
  for (const record of records) {if(seen.has(record.번역지문)) continue; assert.equal(장부쓰기(record), null);}
}
const seen = 잰것들(); const measured = 다잰것들();
const result = {checkedAt: new Date().toISOString(), sourceChecks, corrected: records.length, totalUnique: current.size, notSeen: [...current.keys()].filter(fp => !seen.has(fp)).length, missingGrammarOrSpell: [...current.keys()].filter(fp => !measured.has(fp)).length, changedWithDictionarySuspects: records.filter(row => row.층.맞춤법 > 0).length, sheetCandidateCount: sheetCandidates.length};
fs.writeFileSync(path.join(__dirname, '반영검증.json'), JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, '신규지문검토.json'), JSON.stringify(records, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, '시트교정후보.json'), JSON.stringify(sheetCandidates, null, 2) + '\n');
console.log(JSON.stringify(result));
