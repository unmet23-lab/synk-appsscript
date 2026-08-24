/* 계약 동기 — 두 저장소의 계약 파일이 같은 바이트인지 «탐지»한다 (심문 S5·G4 부활 · 08-24)
 *
 * ■ 왜 다시 사나 — 08-19 철거(e75fc7fc)가 옛 tests/계약.test.js 와 함께 이 «탐지»를 걷었고,
 *   남은 것은 pre-commit 훅의 --check 뿐이었다(로컬 한정 · talk 커밋은 안 지남). 두 저장소가
 *   각자 초록으로 표류하면 「Lv3 에 1급 문항」이 무증상으로 재현된다 — 이것은 시스템 자기검사가
 *   아니라 **학생이 받는 검사지의 급수**를 지키는 제품 검사다(철거 취지와 안 부딪친다).
 *   유호 지시 08-24 「S5·G4 도 이어서 진행해」.
 *
 * ■ 층 — 탐지는 이 시험이, 수정은 tools/계약동기화.js 가 진다(탐지와 수정이 같은 손이면 둘 다
 *   못 믿는다 — 그 도구 머리말 그대로). 판정 재료(형제 자리·표기 접기)도 그 도구와 같은 원천이다.
 *
 * ■ 형제가 이 기계에 없으면(CI) — fail 도 조용한 초록도 아니고 **skip 으로 말한다**(F296:
 *   부재를 적색으로 위장 금지 · 통과와 미실행이 같은 모양이면 안 된다). 교차 대조가 CI 로
 *   올라가려면 두 repo 를 한 러너에 내리는 토큰(PAT)이 필요하다 — 그건 유호님 칸이다.
 *   그때까지 이 탐지의 실효 자리 = 이 기계(두 repo 가 같은 디스크 · 커밋 전 스위트·배포 게이트). */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { 표기접기 } = require('./lib/소스검사.js');
const 형제저장소 = require(path.join(ROOT, '.claude', 'hooks', 'lib', '형제저장소.js'));

const 계약폴더 = path.join(ROOT, '계약');
const 형제 = 형제저장소.형제경로(ROOT);
const 형제계약 = path.join(형제, '계약');

test('계약 파일이 형제(SYNK-talk)와 같은 바이트다 — 갈라지면 「Lv3 에 1급 문항」이 무증상 재현된다', (t) => {
  if (!fs.existsSync(path.join(형제, '.git'))) {
    t.skip(`형제 저장소가 이 기계에 없다(${형제}) — CI 자리. 교차 대조는 이 기계의 커밋·배포 게이트가 진다`);
    return;
  }
  const 파일들 = fs.readdirSync(계약폴더).filter((f) => f.endsWith('.json'));
  assert.ok(파일들.length >= 2, `계약 파일이 ${파일들.length}건 — 분모 소실은 통과가 아니다(F207)`);
  const 어긋남 = [];
  for (const f of 파일들) {
    const 저쪽길 = path.join(형제계약, f);
    if (!fs.existsSync(저쪽길)) { 어긋남.push(`${f}: 형제에 없다(새 계약이 동기화 밖 — 그 침묵이 이 도구가 막으려던 것)`); continue; }
    const 이쪽 = 표기접기(fs.readFileSync(path.join(계약폴더, f), 'utf8'));
    const 저쪽 = 표기접기(fs.readFileSync(저쪽길, 'utf8'));
    if (이쪽 !== 저쪽) 어긋남.push(`${f}: 바이트가 다르다`);
  }
  /* 반대 방향 — 형제에만 있는 계약(여기 정본이 없는 사본)은 유령이다. */
  if (fs.existsSync(형제계약)) {
    for (const f of fs.readdirSync(형제계약).filter((x) => x.endsWith('.json'))) {
      if (!fs.existsSync(path.join(계약폴더, f))) 어긋남.push(`${f}: 형제에만 있다(정본 없는 사본)`);
    }
  }
  assert.deepEqual(어긋남, [],
    `계약이 갈라졌다 — 수정은 node tools/계약동기화.js (정본 = 이 저장소):\n  ${어긋남.join('\n  ')}`);
});
