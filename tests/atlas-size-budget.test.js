'use strict';
// Atlas 압축 기준(docs/아틀라스_설계.md#atlas-size-budget, 2026-10-08). atlas/에는 두 번째 제품이 실제로 쓰는
// 공통 능력만 두고 크기는 아래 상한을 넘기지 않는다. 늘려야 하면 같은 커밋에서 그 절의 숫자와 이유를 함께 고치고,
// 줄이면 상한도 함께 내린다. 공통능력 문서에는 지금 상태만 두고 날짜별 기록은 qa 이력으로 옮긴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// 2026-10-28: WORLD·주문·리듬이 실제 호출하는 Temper 지연 관측과 보존, 형식별 prior 경계.
// 새 엔진/파일 없이 7,127줄. 설계의 소비처·실행 근거와 함께 정확한 증가분만 반영한다.
const BUDGET = Object.freeze({ atlasFiles: 36, atlasLines: 7127, capabilityDocLines: 150 });
const lineCount = text => (text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0));

test('atlas/ stays within the agreed file and line budget', () => {
  const dir = path.join(ROOT, 'atlas');
  const files = fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.js')).map(entry => entry.name);
  const lines = files.reduce((sum, name) => sum + lineCount(fs.readFileSync(path.join(dir, name), 'utf8')), 0);
  assert.ok(files.length <= BUDGET.atlasFiles,
    `atlas/ .js ${files.length}개 > 상한 ${BUDGET.atlasFiles}개 — 한 제품만 쓰는 기능은 그 제품 폴더에 둔다(docs/아틀라스_설계.md#common-capability-promotion)`);
  assert.ok(lines <= BUDGET.atlasLines,
    `atlas/ ${lines}줄 > 상한 ${BUDGET.atlasLines}줄 — 줄이거나, 두 번째 제품이 쓰는 공통 능력이면 상한과 이유를 함께 고친다(docs/아틀라스_설계.md#atlas-size-budget)`);
});

test('the capability document keeps only the current state', () => {
  const lines = lineCount(fs.readFileSync(path.join(ROOT, 'docs/아틀라스_공통능력_고도화_20261005.md'), 'utf8'));
  assert.ok(lines <= BUDGET.capabilityDocLines,
    `공통능력 문서 ${lines}줄 > 상한 ${BUDGET.capabilityDocLines}줄 — 날짜별 기록은 docs/_ops/qa/atlas-capability-history-20261005/README.md에 둔다`);
});
