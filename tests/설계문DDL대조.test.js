'use strict';
/* 설계문 DDL 사본 ↔ 실물 스키마 대조 회귀 — 2026-09-02
 *
 * 무엇을 지키나: **자가 다시 조용히 걷히지 않게.**
 *   이 자의 앞판(`tests/설계문값대조.test.js`)이 08-19 대청소(e75fc7fc)로 걷혔고, 그 뒤
 *   설계문 §3-5-b 의 DDL 사본이 실물과 «실제로» 갈렸다(09-02 실측 — 표 열 둘 · freeze 허용 칸 둘).
 *   같은 일이 코어엔진의 `SCHEMA_VER` 손사본에도 났고 그쪽은 08-27 에 기계 둘로 닫혔다.
 *   ⇒ 이 파일이 그 둘째 기계다.
 *
 * ⚠ 여기서 재는 것은 **자의 뼈대**이지 「지금 갈렸나」가 아니다 — 그건 도구가 답한다
 *   (형제 저장소가 없는 환경에서 회귀가 빨개지면 안 된다 · CI 는 저장소 하나만 받는다).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 자 = path.join(ROOT, 'tools', '설계문DDL대조.js');
const 소스 = () => fs.readFileSync(자, 'utf8').replace(/\r\n/g, '\n');

test('자가 실재한다 — 앞판은 대청소에 걷혔고 그 사이 사본이 갈렸다', () => {
  assert.ok(fs.existsSync(자), 'tools/설계문DDL대조.js 가 없다 — 걷혔으면 이 시험부터 그 사실을 말한다');
});

test('🔴 «못 쟀다»가 «통과»로 접히지 않는다 — 형제 저장소가 없을 때가 그 자리다', () => {
  const s = 소스();
  assert.match(s, /process\.exit\(2\)/, '못 쟀다 갈래의 종료코드 2 가 없다');
  assert.match(s, /못 쟀다.*갈린 것 0.*아니다|「못 쟀다」는 「갈린 것 0」이 아니다/,
    '「못 쟀다 ≠ 통과」를 사람이 읽을 자리에 안 적었다');
  assert.ok(!/실물후보[\s\S]{0,400}?return\s*\{\s*잼:\s*true/.test(s),
    '형제 저장소를 못 찾고도 «쟀다»로 넘어가는 길이 있다');
});

test('🔑 표 본문을 «괄호 짝»으로 끊는다 — 길이로 자르면 다음 표까지 긁는다', () => {
  const s = 소스();
  assert.match(s, /깊이/, '괄호 깊이 세기가 없다');
  assert.ok(!/slice\(시작,\s*시작\s*\+\s*\d{4}\)/.test(s.split('function 열들')[0].split('function 표본문')[1] || ''),
    '표 본문을 고정 길이로 자르고 있다 — 09-02 에 그래서 15열 vs 32열이 나왔다');
});

test('🔑 «마지막 정의가 이긴다» — L0 는 마이그레이션 이력이 한 파일에 눌린 것이다', () => {
  const s = 소스();
  for (const 조각 of ['function 표본문', 'function 함수본문']) {
    const 몸 = s.split(조각)[1].slice(0, 900);
    assert.match(몸, /while \(\(m = re\.exec/, `${조각} 가 첫 정의만 집는다 — 낡은 판을 실물이라 우긴다`);
  }
});

test('제약의 이어지는 줄이 «열»로 잡히지 않는다 — and·or 가 열 이름으로 보고된 적이 있다', () => {
  const s = 소스();
  assert.match(s, /열아님/, '예약어 걸름망이 없다');
  for (const w of ['and', 'or', 'constraint', 'check']) {
    assert.ok(new RegExp(`'${w}'`).test(s.split('const 열아님')[1].slice(0, 400)),
      `걸름망에 ${w} 가 없다`);
  }
});

test('절을 «절 머리»로 찾는다 — 줄번호를 박으면 문서가 자랄 때마다 자가 어긋난다', () => {
  const s = 소스();
  assert.match(s, /\/\^### 3-5-b\\\./, '§3-5-b 를 절 머리 정규식으로 안 찾는다');
  assert.ok(!/slice\(1004,\s*2843\)/.test(s), '줄번호를 박아 뒀다 — 문서가 한 줄만 자라도 거짓이 된다');
});

test('줄끝을 먼저 고른다 — 두 저장소의 eol 규약이 다르다', () => {
  assert.match(소스(), /replace\(\/\\r\\n\/g, '\\n'\)/, 'CRLF 정규화가 없다 — 형제 정본 함정이다');
});

test('실제로 돌려도 죽지 않는다(종료코드 0·1·2 중 하나)', () => {
  let code = 0;
  try {
    execFileSync(process.execPath, [자], { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    code = typeof e.status === 'number' ? e.status : -1;
  }
  assert.ok([0, 1, 2].includes(code), `종료코드가 ${code} 다 — 자가 죽었다`);
});
