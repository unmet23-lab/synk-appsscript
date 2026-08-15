#!/usr/bin/env node
'use strict';
/**
 * 게이트 — GitHub 서버측 잠금(Ruleset)을 «내가» 세우고 풀고 다시 거는 통로.
 *
 * ■ 왜 도구가 먼저인가 (문보다 열쇠를 먼저 짓는다)
 *   서버측 잠금은 로컬 훅과 달리 `--no-verify` 로 못 뚫는다. 그게 값이지만, 동시에
 *   **막혔을 때 스스로 못 풀면 유호님 손이 필요해진다** — 유호님은 이 조작을 모르시고,
 *   「누가 해 주면 된다」는 철학 ㉡ 이 금지한 해법이다. 그래서 잠그기 «전에» 여는 법을 짓는다.
 *   실측 2026-08-15: `gh` 토큰(repo 스코프)으로 ruleset 생성·삭제가 된다(무해 시험 후 원상복구).
 *
 * ■ 🔴 이 도구가 바꾼 «값의 성격» — 정직하게
 *   내가 풀 수 있으므로 이 잠금은 **「우회 불가」가 아니라 「우회가 기록되는」** 층이다.
 *   로컬 훅은 `--no-verify` 한 글자로 **흔적 없이** 뚫린다. 여기서는 해제가 API 호출이고
 *   장부에 남고 다음 세션이 그것을 본다. 값이 사라진 게 아니라 종류가 다르다.
 *
 * ■ 최대 위험은 「풀어놓고 잊는 것」이다
 *   그래서 장치와 발동 조건을 한 벌로 둔다 — `--풀기` 는 사유를 강제하고 장부에 적고,
 *   `--훅` 이 세션 시작마다 그 장부를 읽어 **풀린 채면 소리친다.**
 *   ⚠ 훅은 **네트워크를 쓰지 않는다**(장부만 읽는다) — 세션 시작에 왕복을 넣으면 그 비용이
 *     세션 수만큼 곱해진다(#Q95 가 이미 그 자리를 재고 있다). 대신 장부는 실측과 갈릴 수 있어
 *     `--상태` 가 둘을 대조한다. 훅 출력에 「장부 기준」임을 밝힌다.
 *
 * ■ 대가 (틀릴 때의 모습)
 *   - 누군가 GitHub 웹에서 직접 규칙을 바꾸면 장부가 낡는다 → 훅이 «걸려 있다»고 말하는데
 *     실제로는 풀려 있을 수 있다. 그 거짓 초록은 `--상태` 로만 깨진다.
 *   - `gh` 인증이 끊기면 모든 하위 명령이 죽는다. 그때 **잠금은 그대로 살아 있다** —
 *     즉 «도구가 죽으면 막힌 채로 남는다». 그래서 죽을 때 웹 화면 경로를 함께 찍는다.
 *   ▶ 닫을 것 1개: 없다(새 층). 다만 이 도구가 서면 「저장소 설정을 유호님이 만진다」는
 *     경로가 설계에서 빠진다 — 그것이 이 도구가 지우는 것이다.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const 장부경로 = path.join(ROOT, 'docs', '_ops', '게이트장부.jsonl');

/* 🔑 규칙 정의는 **여기 한 곳**에서만 산다. 같은 판정을 두 곳에 적으면 갈라지고,
   갈라지는 방향은 언제나 「통과」다(지침 신뢰성 ④). 테스트도 이 상수를 읽는다. */
const 저장소들 = ['unmet23-lab/synk-appsscript', 'unmet23-lab/SYNK-talk'];
const 규칙이름 = 'SYNK-기본잠금';
const 규칙정의 = Object.freeze({
  name: 규칙이름,
  target: 'branch',
  enforcement: 'active',
  /* `~DEFAULT_BRANCH` = 그 저장소의 기본 가지(master). 이름을 박으면 나중에 갈릴 때 조용히 빗나간다. */
  conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
  rules: [
    /* 기본 가지를 지우는 것을 막는다 */
    { type: 'deletion' },
    /* 이력을 덮어쓰는 push 를 막는다 — 남의 커밋이 «없던 일»이 되는 유일한 경로다 */
    { type: 'non_fast_forward' },
  ],
});

// ── 공용 ────────────────────────────────────────────────────────────────────
function gh(인자, 옵션 = {}) {
  const r = spawnSync('gh', 인자, { encoding: 'utf8', shell: false, ...옵션 });
  return { 성공: r.status === 0, 출력: (r.stdout || '').trim(), 오류: (r.stderr || '').trim() };
}

function 죽기(사유, 처방) {
  console.error(`\n🔴 ${사유}`);
  if (처방) console.error(`   ▶ ${처방}`);
  console.error('   ⚠ 도구가 못 돌아도 **잠금은 살아 있다** — 급하면 웹에서:');
  console.error(`      https://github.com/${저장소들[0]}/settings/rules\n`);
  process.exit(1);
}

function 장부쓰기(줄) {
  const 기록 = { 때: new Date().toISOString(), 지문: (process.env.CLAUDE_CODE_HOST_SESSION_ID || '').replace(/^local_/, '').slice(0, 8) || null, ...줄 };
  fs.mkdirSync(path.dirname(장부경로), { recursive: true });
  fs.appendFileSync(장부경로, `${JSON.stringify(기록)}\n`, 'utf8');
  return 기록;
}

/**
 * 장부에서 저장소별 «마지막 상태»를 접는다. append-only 라 마지막 줄이 현재다.
 * @param {string} [경로] 테스트가 실장부를 안 건드리게 주입한다(픽스처).
 */
function 장부의현재상태(경로 = 장부경로) {
  if (!fs.existsSync(경로)) return {};
  const 상태 = {};
  for (const 줄 of fs.readFileSync(경로, 'utf8').split('\n')) {
    if (!줄.trim()) continue;
    let r;
    try { r = JSON.parse(줄); } catch { continue; } // 깨진 줄이 전체를 죽이지 않게
    if (!r.저장소) continue;
    if (r.무엇 === '세우기' || r.무엇 === '걸기') 상태[r.저장소] = { 걸림: true, 기록: r };
    else if (r.무엇 === '풀기') 상태[r.저장소] = { 걸림: false, 기록: r };
    else if (r.무엇 === '거두기') delete 상태[r.저장소];
  }
  return 상태;
}

/**
 * GitHub 에 보낼 요청 몸통. **여기서만 조립한다.**
 *
 * 🔴 2026-08-15 실측 — 이 함수가 없어서 난 사고: `세우기` 는 `규칙정의` 를 통째로 보냈는데
 *   `바꾸기`(PUT)는 gh 인자(`-F 'conditions[ref_name][include][]=…'`)로 몸통을 **손으로 다시**
 *   조립하면서 `exclude` 를 빠뜨렸다 → `422 Missing required parameter \`exclude\``.
 *   증상이 지독한 것은 **세우는 길은 멀쩡하고 «푸는 길»만 죽었다**는 점이다 — 잠금은 서고
 *   장부도 초록인데, 막혔을 때 여는 열쇠만 없다. 그건 이 도구가 존재하는 이유 자체이고
 *   (「문보다 열쇠를 먼저 짓는다」) 그게 죽으면 유호님 손이 필요해진다 = 철학 ㉡ 위반.
 *   새는 방향이 「못 연다」였다 — 조용히 통과하는 대신 죽어 준 것만이 다행이다.
 */
function 요청몸통(목표 = 규칙정의.enforcement) {
  return { ...규칙정의, enforcement: 목표 };
}

/** 몸통을 임시 파일로 떨군다 — gh 는 `--input` 으로만 중첩 JSON 을 온전히 받는다. */
function 몸통파일(목표) {
  const p = path.join(os.tmpdir(), `synk-ruleset-${process.pid}-${목표 || 'new'}.json`);
  fs.writeFileSync(p, JSON.stringify(요청몸통(목표)), 'utf8');
  return p;
}

function 규칙찾기(저장소) {
  const r = gh(['api', `repos/${저장소}/rulesets`]);
  if (!r.성공) return { 실패: r.오류 || 'gh api 실패' };
  let 목록;
  try { 목록 = JSON.parse(r.출력 || '[]'); } catch { return { 실패: '응답을 못 읽었다' }; }
  return { 찾음: 목록.find((x) => x.name === 규칙이름) || null };
}

// ── 하위 명령 ───────────────────────────────────────────────────────────────
function 상태보기() {
  const 장부 = 장부의현재상태();
  let 어긋남 = 0;
  console.log('■ 게이트 상태 — **실측**(GitHub)과 장부를 대조한다\n');

  for (const 저장소 of 저장소들) {
    const { 찾음, 실패 } = 규칙찾기(저장소);
    const 장부쪽 = 장부[저장소];
    if (실패) {
      console.log(`  ${저장소}\n    실측: ❔ 못 읽었다 (${실패})`);
      continue;
    }
    const 실측 = 찾음 ? (찾음.enforcement === 'active' ? '🔒 걸림' : '🔓 풀림') : '— 없음';
    const 장부표시 = 장부쪽 ? (장부쪽.걸림 ? '🔒 걸림' : `🔓 풀림 — ${장부쪽.기록.사유 || '(사유 없음)'}`) : '— 없음';
    console.log(`  ${저장소}\n    실측: ${실측}${찾음 ? ` (id ${찾음.id})` : ''}\n    장부: ${장부표시}`);

    const 실측걸림 = Boolean(찾음 && 찾음.enforcement === 'active');
    const 장부걸림 = Boolean(장부쪽 && 장부쪽.걸림);
    const 실측있음 = Boolean(찾음);
    const 장부있음 = Boolean(장부쪽);
    if (실측있음 !== 장부있음 || (실측있음 && 실측걸림 !== 장부걸림)) {
      어긋남 += 1;
      console.log('    🔴 **어긋났다** — 누가 웹에서 직접 바꿨거나 장부가 낡았다. 실측이 진실이다.');
    }
    console.log('');
  }

  if (어긋남) {
    console.log(`🔴 어긋남 ${어긋남}건 — 훅은 장부를 믿으므로 그동안 **틀린 안심**을 준다.`);
    console.log('   ▶ 실측에 맞춰 다시 걸거나 풀어 장부를 갱신한다.\n');
    process.exit(2);
  }
  console.log('✅ 실측과 장부가 같다.\n');
}

function 세우기() {
  const 본문 = 몸통파일();
  try {
    for (const 저장소 of 저장소들) {
      const { 찾음, 실패 } = 규칙찾기(저장소);
      if (실패) 죽기(`${저장소} 의 규칙을 못 읽었다 — ${실패}`, 'gh auth status 로 인증을 본다.');
      if (찾음) {
        console.log(`  · ${저장소} — 이미 있다(id ${찾음.id} · ${찾음.enforcement}). 건너뛴다.`);
        continue;
      }
      const r = gh(['api', '--method', 'POST', `repos/${저장소}/rulesets`, '--input', 본문]);
      if (!r.성공) 죽기(`${저장소} 에 규칙을 못 세웠다 — ${r.오류}`, '토큰에 저장소 관리 권한이 있는지 본다.');
      const id = (() => { try { return JSON.parse(r.출력).id; } catch { return null; } })();
      장부쓰기({ 무엇: '세우기', 저장소, 규칙: 규칙이름, id, 사유: '1단계 기본 잠금(가지 삭제·이력 덮어쓰기 금지)' });
      console.log(`  ✅ ${저장소} — 세웠다 (id ${id})`);
    }
  } finally {
    fs.rmSync(본문, { force: true });
  }
  console.log('\n🔒 기본 잠금이 섰다 — 막는 것은 **가지 삭제**와 **이력 덮어쓰기** 둘뿐이다.');
  console.log('   평소 커밋·push 는 그대로 지난다(사고가 나야 발동하는 층).\n');
}

function 바꾸기(목표, 사유) {
  if (목표 === 'disabled' && !사유) {
    죽기('푸는 데는 사유가 필요하다', 'node tools/게이트.js --풀기 --사유 "무엇이 막혀서 푸는지"');
  }
  const 본문 = 몸통파일(목표);
  try {
    for (const 저장소 of 저장소들) {
      const { 찾음, 실패 } = 규칙찾기(저장소);
      if (실패) 죽기(`${저장소} 의 규칙을 못 읽었다 — ${실패}`);
      if (!찾음) { console.log(`  · ${저장소} — 규칙이 없다. 건너뛴다(먼저 --세우기).`); continue; }
      if (찾음.enforcement === 목표) { console.log(`  · ${저장소} — 이미 ${목표}. 건너뛴다.`); continue; }

      const r = gh(['api', '--method', 'PUT', `repos/${저장소}/rulesets/${찾음.id}`, '--input', 본문]);
      if (!r.성공) 죽기(`${저장소} 의 규칙을 못 바꿨다 — ${r.오류}`);
      장부쓰기({ 무엇: 목표 === 'active' ? '걸기' : '풀기', 저장소, 규칙: 규칙이름, id: 찾음.id, 사유: 사유 || null });
      console.log(`  ${목표 === 'active' ? '🔒' : '🔓'} ${저장소} — ${목표}`);
    }
  } finally {
    fs.rmSync(본문, { force: true });
  }
  if (목표 === 'disabled') {
    console.log('\n🔓 **풀렸다. 다시 거는 것을 잊지 않는다** — 세션 시작마다 훅이 이 상태를 소리친다.');
    console.log('   끝나면: node tools/게이트.js --걸기\n');
  } else {
    console.log('\n🔒 다시 걸었다.\n');
  }
}

/** 훅 모드 — **네트워크 0**. 장부만 읽는다(세션 시작 비용은 세션 수만큼 곱해진다). */
function 훅() {
  const 상태 = 장부의현재상태();
  const 풀린것 = Object.entries(상태).filter(([, v]) => !v.걸림);
  if (!풀린것.length) return;

  console.log('🔓 **게이트가 풀려 있다** — 잠금을 임시 해제한 채로 남았다(장부 기준 · 네트워크 미조회).');
  for (const [저장소, v] of 풀린것) {
    const 언제 = (v.기록.때 || '').slice(0, 16).replace('T', ' ');
    console.log(`   · ${저장소} — ${언제} · 사유: ${v.기록.사유 || '(없음)'}`);
  }
  console.log('   왜 뜨나: 푼 사람이 다시 거는 것을 잊으면 그 저장소는 **영구 무방비**가 된다.');
  console.log('   → 끝났으면: node tools/게이트.js --걸기   ·   실측 대조: node tools/게이트.js --상태');
}

// ── 진입 ────────────────────────────────────────────────────────────────────
/* 🔑 `require.main` 으로 감싼다 — 이게 없으면 테스트가 이 파일을 여는 순간 **실제 GitHub 을
   조작한다.** 회귀가 저장소 설정을 바꾸는 것은 사고지 검사가 아니다. */
function 진입() {
  const 인자 = process.argv.slice(2);
  const 있나 = (f) => 인자.includes(f);
  const 값 = (f) => { const i = 인자.indexOf(f); return i >= 0 ? 인자[i + 1] : undefined; };

  if (있나('--훅')) { 훅(); return; }

  /* 훅 말고는 전부 gh 가 필요하다 — 없으면 여기서 «명시적으로» 죽는다(조용한 통과 금지). */
  if (!gh(['--version']).성공) 죽기('gh CLI 를 못 불렀다', 'gh --version 을 직접 확인한다.');
  if (!gh(['auth', 'status']).성공) 죽기('gh 인증이 없다', 'gh auth status 로 확인한다.');

  if (있나('--세우기')) 세우기();
  else if (있나('--풀기')) 바꾸기('disabled', 값('--사유'));
  else if (있나('--걸기')) 바꾸기('active', 값('--사유'));
  else 상태보기();
}

if (require.main === module) 진입();

module.exports = { 저장소들, 규칙이름, 규칙정의, 요청몸통, 장부의현재상태, 장부경로 };
