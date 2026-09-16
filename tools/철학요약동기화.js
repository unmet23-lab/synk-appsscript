'use strict';

// 대표 문장은 정본에서 읽고, 해설·경계는 요약 지면에서 검토한다.
// 자동 훅이 아니다. 정본 수정 뒤 실행하고 요약의 나머지 문단도 함께 읽는다.
const fs = require('node:fs');
const path = require('node:path');
const { 철학구획 } = require('../.claude/hooks/philosophy-card.js');
const ROOT = path.resolve(__dirname, '..');
const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = value => value.replace(/\*\*/g, '').trim();

function renderSummary(html, md) {
  const sections = 철학구획(md);
  if (!sections.완전한가) throw new Error(`철학 구획 누락: ${sections.빠진것.join(', ')}`);
  const values = new Map(sections.자리);
  const purpose = values.get('목적').split(/\r?\n\s*\r?\n/);
  if (!/^## 1\. /.test(purpose[0]) || !purpose[1]) throw new Error('철학 목적 문장을 찾지 못했습니다.');
  const purposeHtml = `<p><b>${escapeHtml(purpose[0].replace(/^## 1\. /, ''))}</b><br>\n${escapeHtml(purpose[1])}</p>`;
  const brandsHtml = ['LAB', 'SHIFT', 'PULSE'].map(brand => {
    // 절 끝은 다음 브랜드 제목 또는 전체 본문 끝이다.
    const normalized = values.get('적용 대상').replace(/\r\n/g, '\n');
    const body = normalized.split(`### SYNK ${brand}\n`);
    if (body.length !== 2) throw new Error(`철학 브랜드 구획 오류: ${brand}`);
    const paragraphs = body[1].split(/\n### /)[0].trim().split(/\n\s*\n/);
    if (!/^\*\*.+\*\*$/.test(paragraphs[0]) || !paragraphs[1]) throw new Error(`철학 브랜드 문장 누락: ${brand}`);
    return `<tr><th scope="row">${brand}</th><td><b>${escapeHtml(plain(paragraphs[0]))}</b><br>${escapeHtml(paragraphs[1])}</td></tr>`;
  }).join('\n');
  let result = html;
  for (const [id, value] of [['purpose', purposeHtml], ['brands', brandsHtml]]) {
    for (const edge of ['시작', '끝']) {
      if (result.split(`<!-- 철학요약:${id} ${edge} -->`).length !== 2) throw new Error(`요약 출력 구획 오류: ${id}`);
    }
    const pattern = new RegExp(`(<!-- 철학요약:${id} 시작 -->)[\\s\\S]*?(<!-- 철학요약:${id} 끝 -->)`, 'g');
    if ([...result.matchAll(pattern)].length !== 1) throw new Error(`요약 출력 구획 오류: ${id}`);
    result = result.replace(pattern, (_, start, end) => `${start}\n${value}\n${end}`);
  }
  return result;
}

function sync({check = false} = {}) {
  const target = path.join(ROOT, 'docs/SYNK_철학_요약.html');
  const before = fs.readFileSync(target, 'utf8');
  const after = renderSummary(before, fs.readFileSync(path.join(ROOT, 'docs/SYNK_철학.md'), 'utf8'));
  const changed = before !== after;
  if (!check && changed) fs.writeFileSync(target, after);
  return {changed, written: changed && !check};
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const result = sync({check});
  console.log(JSON.stringify(result));
  if (check && result.changed) process.exitCode = 1;
}
module.exports = {renderSummary, sync};
