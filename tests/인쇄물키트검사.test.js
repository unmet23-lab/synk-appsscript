/**
 * 인쇄물 키트검사기 자기검증 발화 — Pattern 색공간 거짓양성(검사기 3번째 결함) 회귀.
 *
 * 08-04 실측: 크롬이 CSS radial-gradient 도트를 PDF 타일링 패턴으로 내는데, 검사기의
 * scn 처리기가 숫자 피연산자만 알아 `/P117 scn … re f` 를 「초기 상태 검정 페인트」로
 * 오인했다 — 발표물 6종 전부가 존재하지 않는 #000000 위반으로 빨개졌다.
 * 이번엔 「실패」 쪽으로 샜지만(안전한 방향) 가드가 실작업을 벌주면 사람이 가드를 끈다.
 *
 * 탐지력은 검사기 내장 픽스처(--selftest)가 지고, 이 파일은 그걸 CI 에서 발화시키는
 * 도화선이다. python+pypdf 는 repo 밖 환경이라 없으면 **skip 으로 드러낸다**
 * (통과와 미실행이 같은 모양이면 안 된다 — CLAUDE.md 신뢰성).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CHECKER = path.join(__dirname, '..', 'docs', 'tools', '인쇄물_키트검사.py');

test('인쇄물 검사기 selftest — Pattern 을 검정으로 오인하지 않고, 진짜 검정은 여전히 잡는다', (t) => {
  for (const py of ['python', 'python3']) {
    const probe = spawnSync(py, ['-c', 'import pypdf'], { encoding: 'utf8', timeout: 20000 });
    if (probe.status === 0) {
      const r = spawnSync(py, [CHECKER, '--selftest'], { encoding: 'utf8', timeout: 30000 });
      assert.strictEqual(r.status, 0, `selftest 실패:\n${r.stdout}\n${r.stderr}`);
      assert.match((r.stdout || '') + (r.stderr || ''), /selftest OK/);
      return;
    }
  }
  t.skip('python+pypdf 없음 — 검사기 selftest 는 로컬 전용(미실행을 skip 으로 드러낸다)');
});
