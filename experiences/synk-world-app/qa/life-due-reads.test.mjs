// 4-2 관문 L7(단계 4 계획 §19-1 ⑤): 새 길 모듈 · 생활 화면 · 홈 · 튜터 · 알림이 생활 진도의 간격(dueAt · intervalDays)과 다음 복습 시각(nextReviewAt)을
// 읽는 자리의 목록을 못박는다. 새 길은 진도에 넣은 판정(world-life-next lifeDue)만 읽고, 진도의 간격은 지금 판(넣은 판정이 없을 때) 갈래에서만
// 읽는다. 새 자리가 생기면 이 시험이 깨진다 — 그 자리가 지금 판 갈래 안인지(또는 다른 기록인지) 보고 수와 설명을 고친다.
// 뺀 곳: 생활 단독 묶음(brand-opening life-standalone — 지금 판 그대로) · 진도 안(life-progress.mjs) · 손님 → 계정 옮기기.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const TOKENS = ['dueAt', 'intervalDays', 'nextReviewAt'];
const count = (text, token) => (text.match(new RegExp(`\\b${token}\\b`, 'g')) ?? []).length;

// 파일 → 낱말마다 읽는 수(없으면 0)와 그 자리.
const PINNED = {
  // 엔진 기억 줄의 다음 돌아올 때(코치 요약 units[].dueAt — F)와 판정의 때만. 진도 기록의 간격은 읽지 않는다(아래 따로 확인).
  'synk-world-app/world-life-next.mjs': { why: '엔진 기억 줄 · 판정의 때', counts: null },
  // dueAt: 튜터 「이 표현 같이 연습」의 지금 판 갈래(1) · 「곧 돌아올 표현」의 지금 판 갈래(5). nextReviewAt: 진도 요약의 칸 — 새 길은 판정의 다음 때.
  'synk-world-app/life-ui.mjs': { counts: { dueAt: 6, nextReviewAt: 8 } },
  // isBack의 지금 판 갈래(1) · 주석(1).
  'brand-opening/home-tutor-lines.mjs': { counts: { dueAt: 2 } },
  // 기록 꼴 확인(verifiedReviews 1) · 주석(1) · 지금 판 갈래(거르기 · 차례 · reviewAt — 4).
  'synk-world-app/world-learning-plan.mjs': { counts: { dueAt: 6 } },
  // 알림 입력(reminderInputs)의 지금 판 갈래(1) · 주석(1).
  'synk-world-app/app-shell.mjs': { counts: { dueAt: 2 } },
  // 알림 계획의 입력 설명(주석 1) — 무엇을 넣을지는 셸이 정한다.
  'synk-world-app/world-reminders.mjs': { counts: { dueAt: 1 } },
  'synk-world-app/world-reminder-device.mjs': { counts: {} },
  'brand-opening/home-tutor.mjs': { counts: {} },
  'brand-opening/home.mjs': { counts: {} },
};

test('새 길 · 홈 · 튜터 · 알림이 진도의 간격을 읽는 자리는 못박은 수 그대로다(§19-1 ⑤ L7)', () => {
  for (const [file, { counts }] of Object.entries(PINNED)) {
    if (!counts) continue;
    const text = read(file);
    for (const token of TOKENS)
      assert.equal(count(text, token), counts[token] ?? 0, `${file}의 ${token} 읽기 수 — 새 자리면 지금 판 갈래인지 보고 고친다`);
  }
});

test('새 길 판정 모듈은 진도 기록의 간격(dueAt · intervalDays)을 읽지 않는다 — 엔진 기억 줄의 다음 때만', () => {
  const code = read('synk-world-app/world-life-next.mjs')
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
  assert.equal(count(code, 'intervalDays'), 0);
  assert.equal(count(code, 'nextReviewAt'), 0);
  const reads = [...code.matchAll(/([A-Za-z_$][\w$]*(?:\([^)]*\))?)\??\.dueAt\b/g)].map(match => match[1]);
  assert.ok(reads.length > 0);
  assert.deepEqual(
    [...new Set(reads)].sort(),
    ['get(row.unit)', 'line'].sort(),
    '읽는 것은 코치 요약의 기억 줄뿐',
  );
});
