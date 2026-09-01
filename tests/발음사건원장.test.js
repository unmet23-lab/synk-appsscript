'use strict';
/* 발음 사건 원장 회귀 — 2026-09-01 (심문 P0-⑧ 수리)
 *
 * 무엇을 지키나: **관찰 원본과 그 위 «사건»이 다시 한 행으로 합쳐지지 않는가.**
 *   그전엔 `발음태그`(AI 추론)와 `돌려준날`(전달 사건)이 `voice_log` 원본 행에 함께 있었다.
 *   그러면 계보가 끊긴다 — 라벨이 재판정돼도 옛 판이 안 남고, 두 번 실려도 한 번으로 보인다.
 *
 * 🔑 **칸을 «빼지» 않고 남긴 것도 계약이다.** 열을 빼면 시트 형상이 바뀌어 계약 판올림(c15→c16)이
 *   서고 형제 저장소 동행까지 부른다. 남기면 형상 무변이라 그 비용이 0이다.
 *   ⇒ 이 시험은 **둘 다** 지킨다: 칸은 남아 있고, 거기에 쓰는 코드는 없다.
 *
 * ⚠ 라이브 Sheets 는 안 부른다. 소스를 읽어 계약을 검사한다(GAS 함수 격리 실행이 어려운 층).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
/* ⚠ 줄끝을 먼저 고른다 — 작업본이 CRLF 라 LF 표식으로 자르면 플랫폼마다 갈리는 시험이 된다. */
const 읽기 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const 구간 = (s, 시작, 끝) => {
  const a = s.indexOf(시작);
  assert.ok(a > -1, `표식을 못 찾았다: ${시작}`);
  const b = s.indexOf(끝, a);
  return s.slice(a, b > a ? b : undefined);
};

test('🔑 voice_log 는 18칸 그대로다 — 칸을 빼면 계약 판올림이 서고 형제 저장소까지 동행한다', () => {
  const s = 읽기('엔진_셋업확장.js');
  const 줄 = 구간(s, 'const VOICE_LOG_HEADERS', '\n\n');
  for (const 칸 of ['발음태그', '돌려준날']) {
    assert.ok(줄.includes(`'${칸}'`), `${칸} 칸이 사라졌다 — 형상이 바뀌면 c15→c16 이 선다`);
  }
});

test('🪦 폐지한 두 칸에 **쓰는 코드가 없다** — 남긴 칸에 값을 넣으면 원장과 두 곳이 같은 것을 안다', () => {
  const 교재 = 읽기('교재연동.js');
  // 옛 도장: voiceCol_('돌려준날') 로 열을 집어 setValues 로 찍던 자리
  assert.ok(!/voiceCol_\('돌려준날'\)/.test(교재), '돌려준날 칸에 쓰는 옛 도장이 살아 있다');
  assert.ok(!/voiceCol_\('발음태그'\)/.test(교재), '발음태그 칸을 집는 코드가 생겼다 — 정본은 voice_labels 다');
});

test('사건 원장 둘이 골격에 등재되고 **수집 표식**을 단다 — 안 달면 도달 감시 눈 밖에서 조용히 0이 된다', () => {
  const s = 읽기('엔진_셋업확장.js');
  for (const 이름 of ['voice_labels', 'voice_delivery']) {
    const m = new RegExp(`\\['${이름}',\\s*\\w+,\\s*수집표식_\\]`).test(s);
    assert.ok(m, `${이름} 이 골격에 수집표식_ 과 함께 없다`);
  }
});

test('전달 원장 열에 **카드종류·카드판**이 있다 — 없으면 「돌려줬다」가 빈 껍데기가 된다(심문 P1-⑱)', () => {
  const s = 읽기('엔진_셋업확장.js');
  const 줄 = 구간(s, 'const VOICE_DELIVERY_HEADERS', '\n');
  for (const 칸 of ['delivery_id', 'student_id', 'file_id', '카드종류', '카드판', '실린날']) {
    assert.ok(줄.includes(`'${칸}'`), `전달 원장에 ${칸} 이 없다`);
  }
});

test('라벨 원장 열에 **태그판·판정자**가 있다 — 재판정되면 옛 판이 남아야 계보가 산다', () => {
  const s = 읽기('엔진_셋업확장.js');
  const 줄 = 구간(s, 'const VOICE_LABELS_HEADERS', '\n');
  for (const 칸 of ['label_id', 'file_id', '태그', '태그판', '판정자']) {
    assert.ok(줄.includes(`'${칸}'`), `라벨 원장에 ${칸} 이 없다`);
  }
});

test('🔑 카드가 실릴 때 전달 원장에 **append** 한다 — 그리고 같은 날 두 번 돌아도 안 늘어난다(멱등)', () => {
  const 본문 = 구간(읽기('교재연동.js'), 'function buildVoiceGrowthCards_(', '\nfunction ');
  assert.match(본문, /getSheetByName\('voice_delivery'\)/, '전달 원장을 안 연다');
  assert.match(본문, /setValues\(새줄\)|새줄\.length/, 'append 하는 자리가 없다');
  assert.match(본문, /이미\[id\]/, '멱등 검사가 없다 — 배치가 두 번 돌면 같은 사건이 두 줄이 된다');
  assert.match(본문, /fid \+ '\|목소리성장카드\|'/, '멱등키가 (녹음·카드종류·날짜) 조합이 아니다');
});

test('조인 키가 없으면 «안 남긴다» — 지어내면 원장이 거짓이 된다', () => {
  const 본문 = 구간(읽기('교재연동.js'), 'function buildVoiceGrowthCards_(', '\nfunction ');
  assert.match(본문, /if \(!sid \|\| !fid\) return;/, 'student_id·file_id 가 없을 때 거르는 자리가 없다');
});
