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
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CHECKER = path.join(__dirname, '..', 'docs', 'tools', '인쇄물_키트검사.py');

/* 2026-08-07: 검사기가 킷을 **손 목록 19색**으로 들고 있는 사이 킷이 23색이 됐고(Slate 2색·
 * Lime 2·Emerald), 새 회색으로 조판한 PDF 가 「키트 밖 색 2종」으로 거짓 FAIL 이 났다.
 * 아래 두 건은 python 없이도 도는 층이다 — 손 목록으로 되돌리는 커밋을 잡는 게 목적이라
 * 탐지 대상이 파이썬 런타임이 아니라 **소스의 통로**다. */
test('킷 색은 손 목록이 아니라 토큰에서 파생한다', () => {
  const src = fs.readFileSync(CHECKER, 'utf8');
  const KIT정의 = src.match(/^KIT = .*$/m);
  assert.ok(KIT정의, 'KIT 정의를 못 찾았다 — 이름이 바뀌었으면 이 검사도 함께 옮겨라');
  assert.match(KIT정의[0], /_토큰/, 'KIT 이 토큰 파생이 아니다 — 사본은 반드시 갈라진다');
  assert.match(src, /디자인_토큰\.json/);
});

test('전용 구역(GROUPS) 손 목록은 킷 안의 색만 가리킨다', () => {
  const src = fs.readFileSync(CHECKER, 'utf8');
  const 킷 = new Set(require('../docs/디자인_토큰.json').색.킷.map((c) => c.hex.toUpperCase()));
  const 블록 = src.match(/^GROUPS = \{[\s\S]*?^\}/m);
  assert.ok(블록, 'GROUPS 정의를 못 찾았다');
  const 손hex = 블록[0].match(/#[0-9A-Fa-f]{6}/g) || [];
  assert.ok(손hex.length, 'GROUPS 가 비었다 — 금지색 판정이 통째로 꺼진다');
  for (const h of 손hex) assert.ok(킷.has(h.toUpperCase()), `GROUPS 의 ${h} 가 킷에 없다`);
});

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
