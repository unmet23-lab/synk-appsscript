'use strict';
// 옛 Atlas(atlas/)의 울타리. 2026-11-10 재설계 §14-3(유호님 「추천대로」)으로 줄 수 상한은 폐기했다 — 간결함은 새 엔진
// packages/atlas/에 건 포맷터 · 인지 복잡도 상한 15 · 묶음 압축 용량 상한이 지킨다(packages/atlas/README.md, docs/아틀라스_설계.md#atlas-size-budget).
// atlas/는 얼린 옛 엔진이라(결함 고침만, 새 판으로 전환한 뒤 지운다) 여기에는 「새 모듈을 더하지 않는다」는 파일 수 울타리만 남긴다.
// 공통능력 문서의 줄 수는 코드 상한이 아니라 「지금 상태만 둔다」는 문서 규칙이라 그대로 둔다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BUDGET = Object.freeze({ atlasFiles: 36, capabilityDocLines: 150 });
const lineCount = text => (text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0));

test('the frozen atlas/ takes no new modules — new engine code goes to packages/atlas/', () => {
  const dir = path.join(ROOT, 'atlas');
  const files = fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.js'));
  assert.ok(files.length <= BUDGET.atlasFiles,
    `atlas/ .js ${files.length}개 > ${BUDGET.atlasFiles}개 — 옛 엔진은 얼렸다. 새 엔진 코드는 packages/atlas/에, 한 제품만 쓰는 기능은 그 제품 폴더에 둔다(docs/아틀라스_설계.md#common-capability-promotion)`);
});

test('the capability document keeps only the current state', () => {
  const lines = lineCount(fs.readFileSync(path.join(ROOT, 'docs/아틀라스_공통능력_고도화_20261005.md'), 'utf8'));
  assert.ok(lines <= BUDGET.capabilityDocLines,
    `공통능력 문서 ${lines}줄 > 상한 ${BUDGET.capabilityDocLines}줄 — 날짜별 기록은 docs/_ops/qa/atlas-capability-history-20261005/README.md에 둔다`);
});
