/* master맞추기 — 2026-10-20 공용 작업본 로컬 master 꼬리 정리 뒤 은퇴한 도구. 안내만 찍고 아무것도 바꾸지 않는다.
 * 병합 트리를 셈하던 옛 판과 그 시험 36개는 이력에 있다(git show 855e68eaa:tests/master맞추기.test.js). */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 도구경로 = path.join(REPO, 'tools', 'master맞추기.js');

test('은퇴한 master맞추기는 따라가기·바로올리기·꼬리 정리 절차를 안내하고 실패 코드로 끝난다(인자와 상관없이)', () => {
  for (const 인자 of [[], ['--실행', 'abc123'], ['--json']]) {
    const r = spawnSync(process.execPath, [도구경로, ...인자], { cwd: REPO, encoding: 'utf8' });
    assert.equal(r.status, 2, `인자 ${인자.join(' ')}`);
    assert.equal(r.stdout, '', '표준 출력에는 아무것도 없다(JSON을 기다리는 쪽이 성공으로 읽지 않게)');
    assert.match(r.stderr, /은퇴/);
    assert.match(r.stderr, /바로올리기\.js 따라가기/);
    assert.match(r.stderr, /공용 작업본 꼬리 정리/);
    assert.match(r.stderr, /855e68eaa/);
  }
});
