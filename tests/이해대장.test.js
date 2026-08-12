/**
 * 이해대장 회귀 — 「부록 A 를 그린 화면이 정본과 갈라지지 않는가」
 *
 * 왜 있나 (2026-08-12 · 유호님 「색상으로 한눈에 파악」 아이디어의 실물):
 *   이 화면의 값어치는 **「어디가 비었나」를 정확히 말하는 것** 하나뿐이다. 정본이 개정됐는데
 *   화면이 안 따라오면, 이미 채운 칸을 계속 「비었다」고 말하거나(가짜 빨강) 아직 빈 칸을
 *   「찼다」고 말한다(가짜 초록). 후자가 훨씬 비싸다 — 우리가 채워야 할 자리를 못 보게 한다.
 *
 * ⚠ 탐지력은 픽스처가 진다. 실저장소에는 거짓양성(=드리프트)만 검사하고,
 *   정본이 없는 환경(워크트리·부분 체크아웃)은 fail 이 아니라 skip(F207).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TOOL = path.join(ROOT, 'tools', '이해대장.js');
const 정본 = path.join(ROOT, 'docs', 'SYNK_철학.md');
const 산출 = path.join(ROOT, 'docs', '이해대장.html');
const { 표뽑기, 비었나, 킷 } = require(TOOL);

/* ── ① 탐지력 = 픽스처 ─────────────────────────────────────────── */

const 픽스처 = [
  '### A-1. 이해 대장 — 설명 줄',
  '',
  '> 설명문은 표가 아니다 — 건너뛰어야 한다.',
  '',
  '| 이해 층 | **돈다** | **짓고 있다** | 🔴 **아직 없다** |',
  '|---|---|---|---|',
  '| **㉠ 실력** | 오류 태그 23종 | 도달 배선 | — |',
  '| **㉡ 사람** | 🔴 **없다.** 원시 신호뿐 | 미니게임 | 🔴 자동 수집 배선 |',
  '',
  '### A-2. 실물 대장',
  '',
  '| 층 | 돈다 | 짓는다 | 연다 |',
  '|---|---|---|---|',
  '| 학습·앱 | 게임화 | 학생 앱 | — |',
  '',
].join('\n');

test('픽스처 — 표를 뽑고, 앞의 설명문·구분선은 안 먹는다', () => {
  const t = 표뽑기(픽스처, /^###\s*A-1\./);
  assert.strictEqual(t.length, 3, '머리 1 + 몸 2 여야 한다');
  assert.strictEqual(t[0][0], '이해 층');
  assert.strictEqual(t[1][1], '오류 태그 23종', '굵게 표식이 안 걷혔거나 칸이 밀렸다');
  assert.ok(!JSON.stringify(t).includes('설명문은 표가 아니다'), '표 앞 설명문을 먹었다');
  assert.ok(!JSON.stringify(t).includes('---'), '구분선을 행으로 셌다');
});

test('픽스처 — A-2 를 A-1 과 섞지 않는다(표 두 벌이 붙어 있어도)', () => {
  const a1 = 표뽑기(픽스처, /^###\s*A-1\./);
  const a2 = 표뽑기(픽스처, /^###\s*A-2\./);
  assert.ok(!JSON.stringify(a1).includes('게임화'), 'A-1 이 A-2 까지 먹었다');
  assert.strictEqual(a2.length, 2);
});

test('픽스처 — 앵커가 낡으면 null(빈 화면을 조용히 내지 않는다)', () => {
  assert.strictEqual(표뽑기(픽스처, /^###\s*A-9\./), null);
});

test('빔 판정 — 「—」·「없다」는 내용이 아니라 «빈 것»이다', () => {
  assert.ok(비었나('—'), '대시는 빈 칸이다');
  assert.ok(비었나('🔴 **없다.** 원시 신호뿐'), '「없다」로 시작하면 표식·꼬리가 붙어도 빈 칸이다');
  assert.ok(비었나(''), '');
  assert.ok(!비었나('오류 태그 23종'), '내용이 있는데 빈 칸으로 셌다 — 가짜 빨강');
  assert.ok(!비었나('🔴 자동 수집 배선'), '「아직 없다」 칸의 내용은 «알고 있는 구멍»이라 내용이다');
});

/* ── ② 킷 — 색은 브랜드 킷에서만 (유호님 확정) ────────────────────── */

test('색은 브랜드 킷에서만 뽑는다 — 임의 색이 섞이면 대외에 못 쓴다', () => {
  const 허용 = new Set(Object.values(킷).map((v) => v.toLowerCase()));
  const src = fs.readFileSync(TOOL, 'utf8');
  // 킷 정의 블록을 뺀 나머지에 하드코딩된 hex 가 있으면 그건 킷 밖 색이다.
  const 나머지 = src.replace(/const 킷 = \{[\s\S]*?\};/, '');
  for (const hex of 나머지.match(/#[0-9A-Fa-f]{6}/g) || []) {
    assert.ok(허용.has(hex.toLowerCase()), `킷에 없는 색이 하드코딩됐다: ${hex}`);
  }
});

/* ── ③ 실저장소 — 드리프트만 검사(정본 없으면 skip) ─────────────────── */

test('실저장소 — 커밋된 화면이 지금 정본과 같다(안 갈라졌다)', (t) => {
  if (!fs.existsSync(정본) || !fs.existsSync(산출)) {
    return t.skip('정본 또는 산출물 없음 — 이 환경에선 못 잰다(미실행을 통과로 세지 않는다)');
  }
  const 커밋된 = fs.readFileSync(산출, 'utf8');
  execFileSync(process.execPath, [TOOL], { cwd: ROOT, stdio: 'pipe' });
  const 다시그린 = fs.readFileSync(산출, 'utf8');
  assert.strictEqual(다시그린, 커밋된,
    'docs/이해대장.html 이 정본보다 낡았다 — `node tools/이해대장.js` 를 돌려 다시 커밋하라');
});

test('실저장소 — 화면이 「몇 칸이 비었나」를 스스로 센다(분모 없는 초록 금지)', (t) => {
  if (!fs.existsSync(정본)) return t.skip('정본 없음');
  const out = execFileSync(process.execPath, [TOOL], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /이해 \d+칸 중 \d+칸이 비었다/, '몇 칸 중 몇 칸인지 안 말한다');
  const html = fs.readFileSync(산출, 'utf8');
  assert.ok(html.includes('비었다'), '빈 칸 표시가 화면에 없다');
  assert.ok(/<title>[^<]*v\d+\.\d+/.test(html), '정본 판 번호가 화면에 없다 — 낡은 화면을 못 알아본다');
});
