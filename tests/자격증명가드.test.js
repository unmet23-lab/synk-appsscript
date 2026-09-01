/* credential-guard 회귀 — 자격증명 화면에서 손을 떼게 하는가 (F084)
 *
 * 실사고: Apps Script 스크립트 속성 화면에서 `form_input` 을 썼다. `find` 가 「빈 텍스트박스」라고
 *   답한 ref 가 실제로는 CLAUDE_API_KEY 의 **값 칸**이었고, 덮어쓰기가 이전 값을 응답으로 돌려줘
 *   API 키가 트랜스크립트에 평문으로 남았다. 오타 1개 막으려다 키를 태웠다.
 *
 * ⚠ 이 훅은 「막는 목록」보다 **「통과 목록」이 더 위험하다.** 브라우저 조작은 매 세션 쓰는 통로라
 *   과잉 차단은 곧 BYPASS 손버릇이 되고(F076·F088), 그 손버릇은 진짜 자격증명 화면도 통과시킨다.
 *   그래서 아래 두 묶음을 같은 무게로 검사한다.
 *
 * ⚠ 이 파일은 **진짜처럼 생긴 가짜 키**를 쓴다. 실키는 절대 넣지 않는다 —
 *   회귀가 비밀 저장소가 되면 이 훅이 막으려던 사고를 회귀가 대신 낸다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { 훅띄우기 } = require('./lib/훅띄우기');

const HOOK = process.env.SYNK_TEST_CRED_HOOK
  || path.resolve(__dirname, '..', '.claude', 'hooks', 'credential-guard.js');
const 설정 = path.resolve(__dirname, '..', '.claude', 'settings.json');

// 실환경 상태와 섞이지 않게 검사 전용 폴더를 준다(로직은 그대로 — 어디에 적을지만 바꾼다).
const 상태들 = [];
function 새상태() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'credguard-'));
  상태들.push(d);
  return d;
}
test.after(() => { for (const d of 상태들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 결과가 아니다 */ } } });

function 가드(tool_name, tool_input, dir, session_id = 'sess-1') {
  /* 🔴 **훅이 안 돈 것과 훅이 통과시킨 것이 같은 모양이었다.** 아래 `조용:true` 는 「훅이 보고
   *   그냥 뒀다」는 뜻인데, 프로세스를 아예 못 띄웠을 때도 stdout 이 비어 같은 값이 나왔다.
   *   그래서 부하가 걸린 전량 실행에서 spawn 이 밀리면 「비밀이 페이지로 나갔다」로 빨개졌다
   *   (파일 하나만 돌리면 초록 — 그 초록이 이 구멍을 덮고 있었다). 미실행은 결과가 아니다.
   *   같은 형태가 훅 회귀 전반에 복제돼 있어 판정을 `tests/lib/훅띄우기.js` 로 뗐다. */
  const r = 훅띄우기(HOOK, {
    input: JSON.stringify({ tool_name, tool_input, session_id }),
    encoding: 'utf8',
    env: { ...process.env, SYNK_CRED_DIR: dir },
  });
  const out = (r.stdout || '').trim();
  if (!out) return { 차단: false, 조용: true, 사유: '' };
  const h = JSON.parse(out).hookSpecificOutput || {};
  return { 차단: h.permissionDecision === 'deny', 조용: false, 사유: String(h.permissionDecisionReason || '') };
}

/** 그 세션이 자격증명 화면에 가 있었다고 기록시킨다(훅의 이동 도구 경로를 그대로 태운다). */
function 이동(url, dir, session_id = 'sess-1') {
  return 가드('mcp__claude-in-chrome__navigate', { url }, dir, session_id);
}

test('훅 파일이 있고 실행된다 (없으면 아래 검사가 전부 무의미해진다)', () => {
  assert.ok(fs.existsSync(HOOK), 'credential-guard.js 가 없다');
  const d = 새상태();
  assert.equal(가드('mcp__claude-in-chrome__read_page', {}, d).조용, true, '무관한 도구에 반응했다');
});

// ── 규칙① 자격증명 화면에서의 쓰기 ─────────────────────────────────────────

test('🔴 자격증명 화면에서 form_input 을 막는다 — F084 실사고 그대로', () => {
  const d = 새상태();
  이동('https://script.google.com/home/projects/abc123/settings', d);
  const r = 가드('mcp__claude-in-chrome__form_input', { ref: 'ref_7', value: 'x' }, d);
  assert.equal(r.차단, true, 'F084 와 같은 형태가 통과했다');
  assert.match(r.사유, /F084/, '왜 막는지 근거가 없다');
  assert.match(r.사유, /접근성 라벨/, 'find 의 설명이 값이 아니라는 핵심 교훈이 안 실렸다');
  assert.match(r.사유, /유호님/, '대안(사람에게 넘긴다)을 안 알려준다 — 막기만 하면 BYPASS 를 배운다');
});

test('자격증명 화면 목록 — 저장소가 실제로 쓰는 주소들이 전부 걸린다', () => {
  for (const url of [
    'https://script.google.com/home/projects/abc/settings',
    'https://github.com/yuho/SYNK-appsscript/settings/secrets/actions',
    'https://console.anthropic.com/settings/keys',
    'https://console.cloud.google.com/apis/credentials?project=x',
    'https://accounts.google.com/signin/v2/identifier',
  ]) {
    const d = 새상태();
    이동(url, d);
    assert.equal(가드('mcp__claude-in-chrome__form_input', { ref: 'r', value: 'x' }, d).차단, true,
      `자격증명 화면인데 통과했다: ${url}`);
  }
});

test('타이핑·키 입력·클립보드·페이지 스크립트도 같은 통로다 (form_input 만 막으면 우회가 된다)', () => {
  const d = 새상태();
  이동('https://console.anthropic.com/settings/keys', d);
  for (const [tool, ti] of [
    ['mcp__claude-in-chrome__computer', { action: 'type', text: 'x' }],
    ['mcp__claude-in-chrome__computer', { action: 'key', text: 'Enter' }],
    ['mcp__computer-use__type', { text: 'x' }],
    ['mcp__computer-use__write_clipboard', { text: 'x' }],
    ['mcp__claude-in-chrome__javascript_tool', { action: 'javascript_exec', text: 'document.querySelector("input").value' }],
    ['mcp__claude-in-chrome__file_upload', { ref: 'r', paths: ['a.txt'] }],
  ]) {
    assert.equal(가드(tool, ti, d).차단, true, `${tool} 이 자격증명 화면에서 통과했다`);
  }
});

test('🔑 화면을 여는 것과 보는 것은 막지 않는다 — 열어주고 손을 떼는 게 처방이다', () => {
  const d = 새상태();
  이동('https://console.anthropic.com/settings/keys', d);
  for (const [tool, ti] of [
    ['mcp__claude-in-chrome__computer', { action: 'left_click', ref: 'ref_1' }],
    ['mcp__claude-in-chrome__computer', { action: 'scroll_to', ref: 'ref_2' }],
    ['mcp__claude-in-chrome__read_page', {}],
    ['mcp__claude-in-chrome__find', { query: '키 목록' }],
  ]) {
    assert.equal(가드(tool, ti, d).조용, true, `${tool} 까지 막으면 화면을 열어 드릴 수가 없다`);
  }
});

test('자격증명 화면이 아니면 쓰기는 통과한다 (거짓양성이 BYPASS 를 가르친다)', () => {
  const d = 새상태();
  이동('https://www.glideapps.com/app/abc/edit', d);
  assert.equal(가드('mcp__claude-in-chrome__form_input', { ref: 'r', value: '학생 로스터' }, d).조용, true,
    '평범한 화면의 입력을 막았다');
  assert.equal(가드('mcp__claude-in-chrome__computer', { action: 'type', text: '안녕하세요' }, d).조용, true,
    '평범한 화면의 타이핑을 막았다');
});

test('어디인지 모르면 규칙①은 발동하지 않는다 — 그리고 그 사실은 훅 머리말에 적혀 있다', () => {
  const d = 새상태(); // 이동 기록 없음 = 클릭으로 도달했거나 이미 열려 있던 화면
  assert.equal(가드('mcp__claude-in-chrome__form_input', { ref: 'r', value: 'x' }, d).조용, true,
    '주소를 모르는데 막으면 브라우저 작업이 통째로 멈춘다');
  const src = fs.readFileSync(HOOK, 'utf8');
  assert.match(src, /못 보는 것/, '못 보는 구간을 머리말에 안 적었다 — 통과와 미실행이 같은 모양이 된다');
});

test('세션이 다르면 남의 이동 기록을 쓰지 않는다', () => {
  const d = 새상태();
  이동('https://console.anthropic.com/settings/keys', d, 'sess-A');
  assert.equal(가드('mcp__claude-in-chrome__form_input', { ref: 'r', value: 'x' }, d, 'sess-B').조용, true,
    '남의 세션 주소로 내 입력을 판정했다');
});

// ── 규칙② 값이 자격증명이면 URL 을 몰라도 막는다 ────────────────────────────

test('🔴 비밀처럼 생긴 값은 어느 화면이든 막는다 (반대 방향의 같은 사고)', () => {
  const 가짜 = [
    ['sk-ant-' + 'A1b2C3d4E5f6G7h8I9j0K1l2', 'Anthropic'],
    ['ghp_' + 'aB3dE5gH7jK9mN1pQ3rS5tU7wX9yZ1', 'GitHub'],
    ['AIza' + 'SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6', 'Google'],
    ['AKIA' + 'IOSFODNN7EXAMPLE', 'AWS'],
    ['-----BEGIN RSA PRIVATE KEY-----', '개인키'],
  ];
  for (const [값, 뭔지] of 가짜) {
    const d = 새상태();
    이동('https://example.com/hello', d); // 자격증명 화면이 **아니다** — 그래도 막아야 한다
    const r = 가드('mcp__claude-in-chrome__form_input', { ref: 'r', value: 값 }, d);
    assert.equal(r.차단, true, `${뭔지} 형태의 값이 페이지로 나갔다`);
    assert.ok(!r.사유.includes(값), '차단 사유에 값을 그대로 옮겨 적었다 — 그게 또 트랜스크립트에 남는다');
  }
});

test('평범한 문장·짧은 값은 비밀로 오인하지 않는다', () => {
  const d = 새상태();
  이동('https://example.com/hello', d);
  for (const v of ['안녕하세요', 'SYNK-001', 'sk-123', '2026-08-04', 'https://synk.im/apply']) {
    assert.equal(가드('mcp__claude-in-chrome__form_input', { ref: 'r', value: v }, d).조용, true,
      `평범한 값을 비밀로 봤다: ${v}`);
  }
});

// ── 규칙③ 내장 브라우저로 로그인 벽 화면을 열지 않는다 (F467) ───────────────

test('🔴 내장 브라우저로 로그인 벽 화면을 열면 막는다 — F467 실교정 그대로', () => {
  const d = 새상태();
  const r = 가드('mcp__Claude_Browser__navigate', { url: 'https://www.instagram.com/synklab/' }, d);
  assert.equal(r.차단, true, 'F467 과 같은 형태가 통과했다');
  assert.match(r.사유, /F467/, '왜 막는지 근거가 없다');
  assert.match(r.사유, /브라우저열기\.js/, '작업 계정 크롬 통로를 안 알려준다');
  assert.match(r.사유, /claude-in-chrome/,
    '직접 조작해야 할 때의 통로를 안 알려준다 — 갈 길을 안 주면 BYPASS 가 정상 통로가 된다(F103)');
});

test('🔑 «진짜 크롬»은 같은 주소라도 막지 않는다 — 거기엔 로그인 세션이 산다', () => {
  const d = 새상태();
  assert.equal(가드('mcp__claude-in-chrome__navigate', { url: 'https://www.instagram.com/synklab/' }, d).조용, true,
    '정당한 통로까지 막으면 남는 길이 없다 — 그 가드는 자기 처방을 자기가 막는다(F103)');
});

test('로그인 벽 목록 — 저장소가 실제로 쓰는 곳이 전부 걸린다', () => {
  for (const url of [
    'https://www.instagram.com/x',
    'https://business.facebook.com/latest/home',
    'https://gemini.google.com/app',
    'https://docs.google.com/spreadsheets/d/abc/edit',
    'https://script.google.com/home',
    'https://supabase.com/dashboard/project/abc',
  ]) {
    const d = 새상태();
    assert.equal(가드('mcp__Claude_Browser__navigate', { url }, d).차단, true, `로그인 벽인데 통과했다: ${url}`);
  }
});

test('내장 브라우저의 «정당한 자리»는 그대로 둔다 — 프리뷰·공개 페이지', () => {
  for (const url of [
    'http://localhost:5173/',
    'https://developer.mozilla.org/en-US/docs/Web/CSS',
    'https://synk.im/privacy/',
  ]) {
    const d = 새상태();
    assert.equal(가드('mcp__Claude_Browser__navigate', { url }, d).조용, true,
      `내장으로 열어도 되는 곳을 막았다 — 거짓양성이 BYPASS 를 가르친다: ${url}`);
  }
});

test('🔑 막은 이동은 «간 곳»으로 적지 않는다 — 안 간 화면으로 규칙①을 판정하면 안 된다', () => {
  const d = 새상태();
  이동('https://www.glideapps.com/app/abc/edit', d);                                        // 실제로 간 곳
  가드('mcp__Claude_Browser__navigate', { url: 'https://script.google.com/home/p/settings' }, d); // 막힌 이동
  assert.equal(가드('mcp__claude-in-chrome__form_input', { ref: 'r', value: '학생 로스터' }, d).조용, true,
    '막아 놓고 그 주소를 기록해, 가지도 않은 자격증명 화면에 있다고 판정했다');
});

// ── 1회용 예외 ─────────────────────────────────────────────────────────────

test('예외는 한 번만 통한다 — 상시 해제 스위치가 아니다', () => {
  const d = 새상태();
  이동('https://console.anthropic.com/settings/keys', d);
  assert.equal(가드('mcp__claude-in-chrome__form_input', { ref: 'r', value: 'x' }, d).차단, true, '기준선이 차단이 아니다');

  훅띄우기([HOOK, '--allow-next'], {   // 0 아닌 코드 = 예외를 못 적었다 → 통로가 던진다
    encoding: 'utf8', env: { ...process.env, SYNK_CRED_DIR: d },
  });

  assert.equal(가드('mcp__claude-in-chrome__form_input', { ref: 'r', value: 'x' }, d).조용, true, '예외가 안 통했다');
  assert.equal(가드('mcp__claude-in-chrome__form_input', { ref: 'r', value: 'x' }, d).차단, true,
    '예외가 두 번째도 통했다 — 그건 상시 해제와 같다');
});

// ── 등록층 (훅이 정확해도 안 불리면 통과가 된다 · F053) ─────────────────────

test('🔴 settings.json 라우팅이 이 훅보다 넓다 — 매처를 훅에서 파생시켜 되센다', () => {
  const src = fs.readFileSync(HOOK, 'utf8');
  const 뽑기 = (이름) => {
    const m = src.match(new RegExp(`const ${이름} = \\[([\\s\\S]*?)\\];`));
    assert.ok(m, `${이름} 목록을 훅에서 못 찾았다 — 이 검사가 무력화됐다`);
    return (m[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
  };
  const 판정대상 = [...뽑기('이동도구'), ...뽑기('쓰기도구')];
  assert.ok(판정대상.length >= 10, '판정 대상이 비었다 — 파생이 죽으면 이 검사는 조용히 통과한다');

  const j = JSON.parse(fs.readFileSync(설정, 'utf8'));
  const 그룹 = (j.hooks.PreToolUse || []).filter((g) => /credential-guard/.test(JSON.stringify(g)));
  assert.equal(그룹.length, 1, 'credential-guard 가 PreToolUse 에 정확히 한 번 등록돼 있지 않다');
  const re = new RegExp(그룹[0].matcher);

  /* 🔑 라우팅은 훅보다 **넓어야** 한다. 훅이 아무리 정확해도 안 불리면 통과가 된다(F053).
   *   서버 3종 × 훅이 판정하는 도구 전부가 매처에 걸리는지 실제로 물어본다. */
  for (const 서버 of ['mcp__claude-in-chrome__', 'mcp__Claude_Browser__', 'mcp__computer-use__']) {
    for (const t of 판정대상) {
      assert.ok(re.test(서버 + t), `매처가 ${서버}${t} 를 안 넘긴다 — 훅에 닿지도 못한다`);
    }
  }

  // 실행 불가는 통과가 아니라 deny 로 드러낸다(F044) + 로컬 절대경로 금지(F053)
  const cmd = 그룹[0].hooks[0].command;
  assert.match(cmd, /CLAUDE_PROJECT_DIR/, '등록이 이 기계에서만 유효한 경로를 쓴다');
  assert.match(cmd, /"permissionDecision":"deny"/, '훅을 못 찾았을 때 조용히 통과한다 — 그게 F044 다');
});
