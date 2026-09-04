#!/usr/bin/env node
/* 엔진7종 상향 v2 → v3 — 절 하나씩 아스트라에게 «한 단계 더» 올리게 한다 (2026-09-05 신설).
 *
 * ■ 왜 도구인가 — 세션이 끊겨도 이어받아야 한다
 *   절이 열일곱이고 한 절에 8분 안팎이라(§7 실측) 한 세션에 다 안 든다. 스크래치패드 스크립트는
 *   세션과 함께 사라지므로, 「어디까지 했나」를 아는 장부와 함께 저장소에 세운다.
 *   ⇒ 새 세션은 `--상태` 하나로 이어받는다.
 *
 * ■ 이 판을 여는 근거 (09-05 §7 시험 · 자를 «결과 보기 전»에 못박고 쟀다)
 *   지어낸 이름 0곳(09-03 기준선은 절당 2.7~2.9곳) · 새로 더할 것 7 · 틀림 지적 7(검증한 것 전부 참)
 *   · 「안 재봤다」 5. 넷 다 통과라 통짜로 간다.
 *
 * ■ 🔴 읽는 사람이 절마다 다르다 (유호 09-05 「내가 읽는건 지금 이 작업엔 상관없어 너랑 GPT가 읽으면 돼」)
 *   · §0(한 장 요약)·§12(유호님이 정할 것) = **유호님이 읽는다** → 쉬운 말 규칙을 건다
 *   · 나머지 = 나와 GPT 가 읽는다 → 실물 이름·줄 번호를 그대로 쓰게 한다(그 제약이 깊이를 깎았다)
 *
 * 사용:
 *   node tools/엔진7종_절올리기.js --상태            어디까지 했나
 *   node tools/엔진7종_절올리기.js --절 7            그 절 하나를 올린다
 *   node tools/엔진7종_절올리기.js --다음            장부가 가리키는 다음 절
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const 원본 = path.join(ROOT, 'docs', '엔진7종_상향설계_v2.md');
const 낼곳 = path.join(ROOT, 'docs', '_ops', '엔진7종_v3');
const 장부경로 = path.join(낼곳, '_진행.json');
const 유호절 = new Set(['0', '12']);              // 이 둘만 쉬운 말 규칙을 건다

function 절들() {
  const 글 = fs.readFileSync(원본, 'utf8');
  const 머리 = [...글.matchAll(/^## §(\d+)\.\s*(.*)$/gm)];
  return 머리.map((m, i) => {
    const 시작 = m.index;
    const 끝 = i + 1 < 머리.length ? 머리[i + 1].index : 글.length;
    return { 번호: m[1], 제목: m[2].trim(), 본문: 글.slice(시작, 끝) };
  });
}

function 장부읽기() {
  try { return JSON.parse(fs.readFileSync(장부경로, 'utf8')); } catch (_) { return { 절: {} }; }
}
function 장부쓰기(j) {
  fs.mkdirSync(낼곳, { recursive: true });
  fs.writeFileSync(장부경로, JSON.stringify(j, null, 2), 'utf8');
}

/* 🔑 지시문은 «한 벌»이다 — 절마다 갈면 절끼리 견줄 수 없다(09-03 F045 조건 통제). */
function 지시문(절) {
  const 유호가읽나 = 유호절.has(절.번호);
  return `너는 SYNK LAB(몽골에서 여는 한국어 학원)의 설계자다.
아래는 「엔진 7종 상향 설계 v2」의 §${절.번호} — ${절.제목} 절 전문이다.

이 절을 **한 단계 더** 올려라.

## 지켜야 하는 것
- **실물 이름을 지어내지 마라.** 파일·함수·표·열 이름은 이 저장소에서 실제로 확인한 것만 써라.
  확인 못 한 것은 「안 재봤다」 절에 적어라. (저장소 루트에서 돌고 있으니 파일을 직접 열어도 된다.)
- 이미 절에 있는 것을 다시 쓰지 마라. **새로 더할 것**과 **지금 판이 틀린 것**만 내라.
- 한국어로 써라.
${유호가읽나
    ? '- 🔴 **이 절은 비개발자(원장)가 읽는다.** 결론 줄에 기술 낱말을 쓰지 말고, 낯선 낱말은 그 자리에 괄호로 뜻을 달아라.'
    : '- 이 절은 AI 가 읽는다. **실물 이름·줄 번호·계약 필드명을 그대로** 써라(쉽게 풀어쓰지 마라 — 정확도가 먼저다).'}

## 출력 형식 (이 셋만)
## 새로 더할 것
(항목마다 — 무엇 · 왜 · 이 절의 어디에 붙나)

## 지금 판이 틀린 것
(항목마다 — 어디 · 무엇이 틀렸나 · 무엇을 보고 그렇게 판단했나)

## 안 재봤다
(확신이 안 서는 것 · 재려면 무엇이 필요한가)

---
${절.본문}`;
}

function 한절올리기(절) {
  const bin = path.join(process.env.APPDATA || '', 'npm', 'codex.cmd');
  const 결과 = path.join(낼곳, `절${절.번호}.md`);
  fs.mkdirSync(낼곳, { recursive: true });

  const 장부 = 장부읽기();
  장부.절[절.번호] = { 상태: '도는중', 시작: new Date().toISOString(), 제목: 절.제목 };
  장부쓰기(장부);
  console.log(`[절올리기] §${절.번호} ${절.제목} — ${절.본문.length.toLocaleString()}자 · gpt-6-astra/xhigh`);

  const t0 = Date.now();
  try {
    /* 🔴 윈도에서 `.cmd` 는 execFileSync 로 직접 못 부른다(EINVAL) — cmd.exe 를 거친다. */
    execFileSync(process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : bin,
      process.platform === 'win32'
        ? ['/c', bin, 'exec', '-m', 'gpt-6-astra', '-c', 'model_reasoning_effort="xhigh"', '--ephemeral', '-o', 결과, '-']
        : ['exec', '-m', 'gpt-6-astra', '-c', 'model_reasoning_effort="xhigh"', '--ephemeral', '-o', 결과, '-'],
      { cwd: ROOT, input: 지시문(절), encoding: 'utf8', timeout: 45 * 60 * 1000,
        stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    const 분 = ((Date.now() - t0) / 60000).toFixed(1);
    const 크기 = fs.existsSync(결과) ? fs.statSync(결과).size : 0;
    장부.절[절.번호] = { 상태: '끝', 시작: 장부.절[절.번호].시작, 끝: new Date().toISOString(), 분: Number(분), 자: 크기, 제목: 절.제목 };
    장부쓰기(장부);
    console.log(`[절올리기] ✅ §${절.번호} — ${분}분 · ${크기.toLocaleString()}자 → ${path.relative(ROOT, 결과)}`);
    return 0;
  } catch (e) {
    const 분 = ((Date.now() - t0) / 60000).toFixed(1);
    const 문면 = String((e.stderr || '') + (e.stdout || '') || e.message).replace(/\s+/g, ' ').slice(0, 400);
    /* 🔴 실패를 「끝」으로 적지 않는다 — 다음 세션이 그 절을 «했다»로 읽으면 영영 빈다. */
    장부.절[절.번호] = { 상태: '실패', 시작: 장부.절[절.번호].시작, 분: Number(분), 문면, 제목: 절.제목 };
    장부쓰기(장부);
    console.error(`[절올리기] ❌ §${절.번호} — ${분}분 뒤 실패\n  ${문면}`);
    return 1;
  }
}

function 상태보기() {
  const 장부 = 장부읽기();
  const 전부 = 절들();
  let 끝 = 0; let 실패 = 0;
  console.log(`[절올리기] 절 ${전부.length}개 · 장부 ${path.relative(ROOT, 장부경로)}`);
  for (const s of 전부) {
    const r = 장부.절[s.번호];
    const 표 = !r ? '⬜ 아직' : r.상태 === '끝' ? `✅ ${r.분}분 · ${(r.자 || 0).toLocaleString()}자`
      : r.상태 === '실패' ? `❌ 실패 — ${(r.문면 || '').slice(0, 60)}` : '🔄 도는 중(끊겼을 수 있다)';
    if (r && r.상태 === '끝') 끝 += 1;
    if (r && r.상태 === '실패') 실패 += 1;
    console.log(`  §${s.번호.padStart(2)} ${표}  ${s.제목.slice(0, 40)}`);
  }
  console.log(`\n  끝 ${끝} / ${전부.length} · 실패 ${실패}`);
  const 다음 = 전부.find((s) => !장부.절[s.번호] || 장부.절[s.번호].상태 !== '끝');
  console.log(다음 ? `  다음 = §${다음.번호} (node tools/엔진7종_절올리기.js --다음)` : '  ✅ 전부 끝났다');
}

function main(argv) {
  if (argv.includes('--상태') || argv.length === 0) { 상태보기(); return 0; }
  const 전부 = 절들();
  let 과녁 = null;
  if (argv.includes('--절')) {
    const n = String(argv[argv.indexOf('--절') + 1] || '');
    과녁 = 전부.find((s) => s.번호 === n);
    if (!과녁) { console.error(`§${n} 을 못 찾았다 — 있는 절: ${전부.map((s) => s.번호).join(' · ')}`); return 2; }
  } else if (argv.includes('--다음')) {
    const 장부 = 장부읽기();
    과녁 = 전부.find((s) => !장부.절[s.번호] || 장부.절[s.번호].상태 !== '끝');
    if (!과녁) { console.log('✅ 전부 끝났다'); return 0; }
  } else { console.error('사용: --상태 | --절 <번호> | --다음'); return 2; }
  return 한절올리기(과녁);
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { 절들, 지시문, 장부읽기, 유호절 };
