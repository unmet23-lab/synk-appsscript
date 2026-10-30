'use strict';
// Atlas 압축 기준(docs/아틀라스_설계.md#atlas-size-budget, 2026-10-08). atlas/에는 두 번째 제품이 실제로 쓰는
// 공통 능력만 두고 크기는 아래 상한을 넘기지 않는다. 늘려야 하면 같은 커밋에서 그 절의 숫자와 이유를 함께 고치고,
// 줄이면 상한도 함께 내린다. 공통능력 문서에는 지금 상태만 두고 날짜별 기록은 qa 이력으로 옮긴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// 2026-10-29: Core 확인 시점·재확인 질문, Vellum 표본 검사, Temper 중복 검사와 Trail 출처 탐색.
// 최초 순증 15줄 + LAB·WORLD 제외 전파·오디오 자격·대기 이력 49줄 + 완료·ID·명시적 철회·질문 계산과 판 검사 정리 10줄.
// 2026-10-30: LAB 게임·WORLD 공용 저장 복구·자동 전송·동시 쓰기 페이지 보호 +29줄.
// 2026-10-30: paused writers protect their own base/staging pages; later garbage collection continues (+23 lines including quota fallback).
// 2026-10-31: LAB games and WORLD share an exclusive browser writer; sync lease fencing, missing-history refusal and witnessed restoration (+64 lines, no new file).
const BUDGET = Object.freeze({ atlasFiles: 36, atlasLines: 7317, capabilityDocLines: 150 });
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
