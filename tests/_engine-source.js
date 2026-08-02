/* 엔진 소스 정본 — 테스트를 「파일이 몇 개인가」에서 떼어낸다.
 *
 * 왜: 이 저장소의 테스트 상당수가 엔진 소스를 문자열로 읽어
 *     `code.indexOf('시작 표식')` ~ `code.indexOf('끝 표식')`으로 구간을 잘라 검사한다(실측 195건).
 *     엔진이 여러 파일로 쪼개지면 그 표식들이 파일 경계를 넘어 갈라지고,
 *     테스트는 「표식을 못 찾음」으로 죽거나 — 더 나쁘게 — 엉뚱한 구간을 자른 채 조용히 통과한다.
 *     그래서 분할보다 **먼저** 테스트가 엔진 전체를 하나의 문자열로 보게 만든다.
 *
 * 분할할 때: ENGINE_FILES에 새 파일을 **실제 로드 순서대로** 추가한다.
 *            순서는 `.clasp.json`의 filePushOrder와 반드시 일치해야 한다
 *            (Apps Script는 전역 스코프를 파일 순서대로 초기화하므로,
 *             순서가 어긋나면 테스트는 통과하는데 라이브만 죽는다).
 *            safety.test.js의 filePushOrder 검사가 그 정합을 잡는다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** 엔진 파일 — 로드 순서대로. 분할 시 여기에 추가한다. */
const ENGINE_FILES = ['Code.js'];

/** 엔진 전체를 한 문자열로. 파일 사이는 개행으로만 잇는다(표식 검색에 영향 없게). */
function engineSource() {
  return ENGINE_FILES
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .join('\n');
}

/** 파일별 원문이 필요한 검사용(구문 검사·톱레벨 스코프 검사 등). */
function engineParts() {
  return ENGINE_FILES.map((f) => ({
    file: f,
    path: path.join(ROOT, f),
    src: fs.readFileSync(path.join(ROOT, f), 'utf8'),
  }));
}

module.exports = { ROOT, ENGINE_FILES, engineSource, engineParts };
