'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {renderSummary} = require('../tools/철학요약동기화.js');
const root = path.resolve(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'docs/SYNK_철학.md'), 'utf8');
const html = fs.readFileSync(path.join(root, 'docs/SYNK_철학_요약.html'), 'utf8');

test('현재 요약이 정본의 대표 문장과 같고 재생성이 안정적이다', () => {
  assert.equal(renderSummary(html, md), html);
});
test('목적·세 브랜드의 실제 원문 변경이 출력에 전달된다', () => {
  for (const phrase of ['한 사람을 깊이 이해한 개인화 시스템을 만듭니다', '삶의 방향을 구체화하며', '올바른 가치관과 탄탄한 역량이', '감정의 폭과 깊이를']) {
    assert.ok(md.includes(phrase));
    const after = renderSummary(html, md.replaceAll(phrase, '확인용 <변경> & 문장'));
    assert.ok(after.includes('확인용 &lt;변경&gt; &amp; 문장'));
    assert.equal(after.slice(0, after.indexOf('<body')), html.slice(0, html.indexOf('<body')));
  }
});
test('필수 원문이나 출력 구획이 사라지면 조용히 낡은 결과를 남기지 않는다', () => {
  assert.throws(() => renderSummary(html, md.replace('철학: purpose 끝', '철학: purpose 누락')));
  assert.throws(() => renderSummary(html, md.replace('### SYNK SHIFT', '### 삭제')));
  assert.throws(() => renderSummary(html.replace('철학요약:brands 끝', '삭제'), md));
  assert.throws(() => renderSummary(html + '<!-- 철학요약:brands 끝 -->', md));
});
