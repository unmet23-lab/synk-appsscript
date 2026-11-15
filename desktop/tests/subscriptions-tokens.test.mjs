// 모델별 토큰(11-15) 화면 모듈 시험: 모델 이름, 한국어 단위, 기간 묶음, 칸의 세 상태(꺼짐 · 처음 세는 중 · 다 셈).
import test from 'node:test';
import assert from 'node:assert/strict';
import { modelLabel, tokenText, tokenSummary, tokensSection, tokenDay } from '../renderer/subscriptions-tokens.mjs';

const NOW = new Date(2026, 10, 15, 21, 30).getTime();
const day = k => tokenDay(new Date(2026, 10, 15 - k, 12).getTime());

test('모델 이름은 사람이 읽는 이름으로, 모르는 모양은 그대로', () => {
  assert.deepEqual(
    ['claude-opus-5-5', 'claude-fable-5-2', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514', 'claude-3-5-sonnet-20241022', 'gpt-6-astra', 'gpt-6.1-sol', 'gpt-5-codex', 'gemini-3.5-flash', 'grok-4.7-build', 'o4-mini', '?', ''].map(modelLabel),
    ['Opus 5.5', 'Fable 5.2', 'Haiku 4.5', 'Opus 4', 'Sonnet 3.5', 'GPT-6 Astra', 'GPT-6.1 Sol', 'GPT-5 Codex', 'Gemini 3.5 Flash', 'Grok 4.7 Build', 'o4-mini', '모델 기록 없음', '모델 기록 없음'],
  );
});

test('토큰 수는 한국어 단위로', () => {
  assert.deepEqual([0, 9876, 12345, 648562, 4561234, 12345678, 123456789, 98765432100, 99996000, 999999].map(tokenText), ['0', '9,876', '1.2만', '64.9만', '456만', '1,235만', '1.23억', '988억', '1억', '100만']);
});

const state = {
  ok: true, enabled: true, scanning: false, scannedAt: NOW - 3 * 60e3, since: day(20), sinceBy: { claude: day(20), gpt: day(2), grok: day(12) }, tools: { claude: 10, gpt: 2, grok: 1, gemini: 0, agy: true }, failed: 3,
  cells: [
    [day(0), 'claude', 'claude-opus-5-5', 10, 1000, 5000, 100, 300, 4],
    [day(0), 'gpt', 'gpt-6-astra', 20, 500, 900, 0, 50, 2],
    [day(3), 'claude', 'claude-opus-5-5', 10, 2000, 0, 0, 0, 3],
    [day(3), 'claude', 'claude-fable-5-2', 1, 4000, 0, 0, 0, 1],
    [day(12), 'grok', 'grok-4.7-build', 5, 800, 0, 0, 0, 1],
    [day(40), 'claude', 'claude-opus-5-5', 1, 99999, 0, 0, 0, 1],
  ],
};

test('기간 묶음: 오늘 · 7일 · 30일, 출력 많은 순, 몫과 날마다 출력', () => {
  const today = tokenSummary(state, 'today', NOW);
  assert.deepEqual(today.models.map(m => [m.label, m.out, m.n]), [['Opus 5.5', 1000, 4], ['GPT-6 Astra', 500, 2]]);
  assert.equal(today.total.out, 1500);
  const week = tokenSummary(state, 'week', NOW);
  assert.deepEqual(week.models.map(m => [m.key, m.out]), [['claude|claude-fable-5-2', 4000], ['claude|claude-opus-5-5', 3000], ['gpt|gpt-6-astra', 500]]);
  assert.equal(Math.round(week.models[0].share * 1000), 533);
  assert.equal(week.chartDays.length, 7);
  assert.equal(week.models[1].daily[day(3)], 2000);
  const month = tokenSummary(state, 'month', NOW);
  assert.deepEqual([month.chartDays.length, month.models.length, month.total.out], [30, 4, 8300]);
  // 도구마다 시작 날로 앞이 비었는지 말한다: 30일은 셋 다, 7일은 이틀 전부터인 GPT만(Fable 설계 검토 2).
  assert.deepEqual(month.late.map(l => l.tool).sort(), ['Claude', 'GPT', 'Grok']);
  assert.deepEqual(week.late.map(l => [l.tool, l.since]), [['GPT', day(2)]]);
  assert.equal(tokenSummary(state, 'today', NOW).late.length, 0);
  // 40일 전 칸은 어느 기간에도 들지 않는다.
  assert.equal(month.models.find(m => m.label === 'Opus 5.5').out, 3000);
});

test('칸: 꺼짐 · 처음 세는 중 · 다 셈, 끄기는 두 번, 모델 이름은 글자로만', () => {
  const off = tokensSection({ state: { ok: true, enabled: false }, now: NOW });
  assert.match(off, /모델별 토큰 켜기/);
  assert.match(off, /토큰은 AI가 읽고 쓴 글의 양을 세는 단위예요/);
  assert.match(off, /대화 기록 파일을 훑어, 응답마다 모델 이름과 토큰 수만 꺼내 더해요/);
  assert.match(off, /어느 기록 파일을 어디까지 읽었는지예요/);
  assert.equal(tokensSection({ state: null, now: NOW }), '');
  const first = tokensSection({ state: { ok: true, enabled: true, scanning: true, scannedAt: null, progress: { done: 1234, total: 8330 }, cells: [] }, now: NOW });
  assert.match(first, /1,234\/8,330/);
  assert.match(first, /aria-valuenow="15"/);
  const ready = tokensSection({ state, view: { range: 'week', open: new Set(['claude|claude-opus-5-5']) }, now: NOW, number: '04' });
  assert.match(ready, /data-section="04"/);
  assert.match(ready, /7일 출력<\/span><b class="ms-num">7,500<\/b>/);
  assert.match(ready, /aria-pressed="true">7일/);
  assert.match(ready, /Fable 5\.2/);
  // 펼친 줄만 날마다 막대와 기록의 모델 이름을 보인다.
  assert.equal((ready.match(/class="mt-detail"/g) || []).length, 1);
  assert.match(ready, /<code>claude-opus-5-5<\/code>/);
  assert.match(ready, /Antigravity CLI\(Gemini\)는/);
  assert.match(ready, /data-subs="tokens-off"/);
  // 기간 단추는 다시 그린 뒤에도 초점을 찾을 수 있게 data-id, 날마다 막대는 화면 낭독 글, 읽지 못한 파일 수, 도구별 시작 날.
  assert.match(ready, /data-subs="tokens-range" data-id="range-month"/);
  assert.match(ready, /<span class="ms-sr">날마다 출력: [^<]*오늘|<span class="ms-sr">날마다 출력: \d+\/\d+ /);
  assert.match(ready, /읽지 못한 파일 3개/);
  assert.match(ready, /GPT 기록은 \d+\/\d+부터 있어요/);
  assert.match(ready, /캐시 읽기는 앞에서 읽어 둔 글을 다시 쓴 양/);
  const armed = tokensSection({ state, view: { range: 'week', offArmed: true }, now: NOW });
  assert.match(armed, /끄고 지우기/);
  // 기록의 모델 이름이 이상한 글자여도 HTML로 풀리지 않는다.
  const evil = tokensSection({ state: { ...state, cells: [[day(0), 'claude', '<img src=x onerror=alert(1)>', 1, 10, 0, 0, 0, 1]] }, view: { range: 'today', open: new Set(['claude|<img src=x onerror=alert(1)>']) }, now: NOW });
  assert.equal(evil.includes('<img'), false);
  assert.match(evil, /&lt;img src=x/);
  // 이 기간에 센 응답이 없으면 그렇게 말한다.
  assert.match(tokensSection({ state: { ...state, cells: [] }, view: { range: 'today' }, now: NOW }), /오늘은 센 응답이 없어요/);
  assert.match(tokensSection({ state: { ...state, cells: [] }, view: { range: 'week' }, now: NOW }), /7일 동안 센 응답이 없어요/);
});

test('칸: 처음 세는 중에는 「찾지 못했어요」를 말하지 않고, 바닥 줄에 점이 홀로 남거나 단추가 겹치지 않고, 지난해 날은 해를 붙인다(카본 지적)', () => {
  // 처음 세는 중: 아직 센 파일이 없어도(도구 수가 비어도) 「찾지 못했어요」는 다 센 뒤에만.
  const first = tokensSection({ state: { ok: true, enabled: true, scanning: true, scannedAt: null, progress: { done: 3, total: 8330 }, tools: {}, cells: [] }, now: NOW });
  assert.equal(first.includes('찾지 못했어요'), false);
  assert.equal(/mt-foot-line">\s*·/.test(first), false);
  assert.match(first, /mt-foot-line"><button[^>]*data-subs="tokens-off"/);
  // 다 셌는데 정말 없으면 그때 말한다.
  assert.match(tokensSection({ state: { ...state, tools: {}, cells: [] }, now: NOW }), /기록을 아직 찾지 못했어요/);
  // 처음 세다 멈춘 판: 「다시 세기」는 위 칸에 하나만.
  const stopped = tokensSection({ state: { ok: true, enabled: true, scanning: false, scannedAt: null, error: 'SCAN_FAILED', tools: { claude: 3 }, cells: [] }, now: NOW });
  assert.equal((stopped.match(/data-subs="tokens-scan"/g) || []).length, 1);
  assert.match(stopped, /세다가 멈췄어요/);
  // 다 센 판의 바닥 줄은 조각을 가운뎃점 하나씩으로 잇는다.
  const ready = tokensSection({ state, view: { range: 'week' }, now: NOW });
  assert.match(ready, /기록 \d+\/\d+부터 · 마지막으로 센 때 \d\d:\d\d · 읽지 못한 파일 3개 · <button[^>]*>다시 세기<\/button> · <button[^>]*>끄기<\/button>/);
  // 기록은 400일까지 남는다 — 지난해 날은 해를 붙인다(올해 날은 그대로).
  const old = tokensSection({ state: { ...state, since: '2025-11-05', sinceBy: { claude: '2025-11-05', gpt: day(2) } }, view: { range: 'week' }, now: NOW });
  assert.match(old, /기록 2025\/11\/5부터/);
});

