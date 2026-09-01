#!/usr/bin/env node
'use strict';
/* AI 스택 점검 — 「세 벤더에 나눠 준 역할이 **실제로 도는가**」를 세는 한 장.
 *
 * ■ 왜 있나 (2026-09-01 · 유호님 「역할이 배치된 대로 잘 굴러가게 시스템화되어 있는지 점검해줘」)
 *   그날 처음 세어 보고 알았다 — 자가 셋 다 있는데 **자를 재는 자가 없었다**:
 *     · ①배포 검수(Codex)  = 훅까지 박혀 매 배포에 돈다(런 81건 / 08-20~08-31)
 *     · ②설계 심문(Codex)  = **정본 중 심문받은 것 1벌.** 트리거가 「동결 직전」이라는 사람의 기억
 *     · 몽골어 검문(Gemini) = **장부 0줄 · 도장에 지문 0.** 「돌렸나」를 셀 방법이 없었다
 *     · ㉠밖의 사실(DR 둘) = 장부 0줄. 「안 물어봤다」와 「물어봐서 통과」가 같은 모양
 *   검수는 코드를, 심문은 설계를, 정찰은 모델을 재는데 **배치 자체의 커버리지**는 아무도 안 쟀다.
 *   그래서 「1/35」가 두 주 동안 조용했다. 이 파일이 그 넷째 자다.
 *
 * ■ 하지 «않는» 것 — 자가 둘이면 반드시 갈린다(one-ruler-per-judgment)
 *   🚫 **심문 드리프트를 여기서 안 낸다** — 「심문 뒤 문서가 자랐다」는 `review-runs.js` 몫이다.
 *      여기는 그 자가 **원리상 못 보는 것**만 센다: ㉮한 번도 안 받은 것 ㉯장부가 가리키는데
 *      파일이 없는 것(그쪽은 `continue` 로 침묵한다 · :206).
 *   🚫 **목록을 짓지 않는다.** 「어느 문서가 소급 불가인가」는 판정이고, 여기 적으면 그게 둘째
 *      정본이 된다. 그래서 **문서가 자기 머리에 선언**하고(아래 표식) 이 자는 세기만 한다 —
 *      `doc-graph` 의 「엣지는 항상 파생이 선언한다」와 같은 정신이다.
 *   🚫 **막지 않는다.** 알림이다. 배포 게이트는 `clasp-guard` 하나면 족하다.
 *
 * ■ 표식 규약 — 문서 아무 곳에 한 줄
 *     <!-- 심문: 소급불가 -->            ← ②설계 심문 대상이다(안 받았으면 여기서 운다)
 *     <!-- 심문: 면제 · 왜 면제인지 -->   ← 대상이 아니다. **사유를 적어야** 면제가 된다
 *   면제에 사유를 강제하는 이유: 사유 없는 면제는 다음 사람에게 「검토했다」로 보이는데
 *   실제로는 「귀찮아서 껐다」와 같은 모양이다.
 *
 * 사용:
 *   node tools/ai스택점검.js            # 한 장 전부
 *   node tools/ai스택점검.js --훅        # 적색만 · 하루 1회(SessionStart 용)
 *   node tools/ai스택점검.js --훅 --force # 스로틀 무시
 *   node tools/ai스택점검.js --json
 * 종료코드: 0=정상(적색이 있어도 0 — 알림이다) · 1=자 자신이 못 돈 것(«확인 불가»이지 「정상」이 아니다)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

/* 뿌리를 env 로 갈아끼울 수 있게 둔다 — **회귀가 픽스처 저장소를 세워 탐지력을 재기 위해서다.**
 * 실저장소에서는 대개 「걸린 것 0」이라 여기서 초록은 「깨끗하다」와 「자가 죽었다」를 못 가른다
 * (그 함정을 이 파일이 첫 실행에 정면으로 밟았다 — SKIP 머리말). 장부 경로 env 와 같은 관행이다. */
const ROOT = process.env.SYNK_AISTACK_ROOT || path.resolve(__dirname, '..');
const 심문장부 = () => path.join(ROOT, 'docs', '_ops', '심문기록.jsonl');
const 몽골장부 = () => process.env.SYNK_MN_LEDGER || path.join(ROOT, 'docs', '_ops', '몽골어검문.jsonl');
const 검수장부 = () => path.join(ROOT, 'docs', '_ops', '검수기록.jsonl');
const 정찰장부 = () => path.join(ROOT, 'docs', '_ops', '모델정찰.jsonl');
/* 도장은 git «디렉터리» 안에 둔다 — 작업본에 넣으면 세션마다 커밋 소음이 되고, `os.tmpdir()` 은
 * 재부팅으로 조용히 리셋된다(그럼 스로틀이 있는 척만 한다).
 *
 * 🔴 **`ROOT/.git` 을 폴더로 단정하면 안 된다** — 워크트리에서는 그게 `gitdir: …` 한 줄짜리
 *   **파일**이다. 09-01 이 자를 워크트리에서 처음 돌렸을 때 `mkdirSync` 가 ENOTDIR 로 죽고
 *   `도장쓰기` 의 catch 가 그걸 삼켜, 스로틀이 **있는 척만 하는 상태**로 매번 울 뻔했다
 *   (조용한 실패는 언제나 「통과」 쪽으로 샌다). 그래서 포인터를 따라간다. */
function git방() {
  const g = path.join(ROOT, '.git');
  try {
    if (fs.statSync(g).isDirectory()) return g;
    const m = /gitdir:\s*(.+)/.exec(fs.readFileSync(g, 'utf8'));
    if (m) {
      const 실제 = path.resolve(ROOT, m[1].trim());
      if (fs.statSync(실제).isDirectory()) return 실제;
    }
  } catch (_) { /* 아래 폴백 */ }
  return null;
}
const 도장경로 = () => process.env.SYNK_AISTACK_STAMP
  || path.join(git방() || os.tmpdir(), 'synk-ai스택도장.json');

const 표식꼴 = /<!--\s*심문\s*:\s*([^>]*?)\s*-->/;
const 소급꼴 = /소급\s*불가|소급불가/;
const 후보이름꼴 = /설계|계약|규격/;
/* 🔴 **ROOT 기준 상대경로에 댄다 — 절대경로에 대면 저장소가 어디 놓였느냐로 답이 갈린다.**
 *   2026-09-01 이 자를 짓던 워크트리(`.claude/worktrees/…`)에서 첫 실행이 **후보 0**을 냈다.
 *   절대경로에 `worktrees` 가 들어 있어 자기 문서 229벌을 통째로 걸러낸 것이다 — 그런데 출력은
 *   「후보 0 · 걸린 것 없음」이라 **성공 얼굴**이었다(zero-is-a-success-face). 자를 먼저 의심하라는
 *   그 원칙이 자기 자신에게 먼저 걸렸다. ⚠ 같은 꼴의 SKIP 이 `tools/doc-graph.js` 에도 있다 —
 *   거긴 이 세션이 안 만졌으니 그쪽에서 재는 값은 워크트리에서 따로 의심해야 한다. */
const SKIP = [/\/_archive\//, /\/worktrees\//, /\/_구본\//, /\/_ops\//];

function 지문(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

function jsonl(경로) {
  let raw;
  try { raw = fs.readFileSync(경로, 'utf8'); }
  catch (_) { return null; }              // null = 장부가 없다(0줄과 갈린다)
  const 행 = [];
  for (const l of raw.split('\n')) {
    if (!l.trim()) continue;
    try { 행.push(JSON.parse(l)); } catch (_) { /* 못 읽은 줄은 셈에서 빠진다 — 아래가 분모로 말한다 */ }
  }
  return 행;
}

function 문서들() {
  const 것 = [];
  (function 걷기(디) {
    let 목록;
    try { 목록 = fs.readdirSync(디, { withFileTypes: true }); } catch (_) { return; }
    for (const e of 목록) {
      const p = path.join(디, e.name);
      // 앞에 '/' 를 붙여 첫 칸(`docs/`)도 `/…/` 꼴로 걸리게 한다.
      const 상대 = '/' + path.relative(ROOT, p).replace(/\\/g, '/');
      if (SKIP.some((r) => r.test(상대))) continue;
      if (e.isDirectory()) 걷기(p);
      else if (/\.md$/.test(e.name)) 것.push(p);
    }
  })(path.join(ROOT, 'docs'));
  return 것;
}

/* 🔴 **규약을 «설명»하는 것과 «선언»하는 것을 가른다** (2026-09-01 · 병합 직후 실측).
 *   표식 규약을 적어 둔 `docs/AI_스택_가이드.md` 가 스스로 「심문 대상」으로 잡혔다 — 그 문서는
 *   백틱 안에 표식을 **예시로** 실었을 뿐인데 파서가 raw 로 읽은 것이다. 코드 표기 안의 것은
 *   문서가 «말하는» 것이지 «선언하는» 것이 아니다. 예외 목록을 짓는 대신(그건 둘째 정본이 된다)
 *   표기법으로 가른다: 펜스 블록과 인라인 코드를 지운 뒤에 표식을 찾는다.
 *   ⇒ 진짜 선언은 백틱 없이 raw 로 놓는다. */
function 코드지운(본문) {
  return String(본문)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
}

/* ── ㉠ ②설계 심문 커버리지 ─────────────────────────────────────────────── */
function 심문커버리지() {
  const 적색 = [], 알림 = [];
  const 행들 = jsonl(심문장부());
  const 심문됨 = new Set();
  const 가리킨것 = new Set();
  if (행들) for (const r of 행들) {
    if (r && r.종류 === '심문' && r.대상) { 가리킨것.add(r.대상); if (r.상태 === '완료' || !r.상태) 심문됨.add(r.대상); }
  }

  const 선언 = [], 면제 = [], 후보 = [];
  for (const abs of 문서들()) {
    let 본문;
    try { 본문 = fs.readFileSync(abs, 'utf8'); } catch (_) { continue; }
    const 상대 = path.relative(ROOT, abs).replace(/\\/g, '/');
    const 산문 = 코드지운(본문);
    const m = 표식꼴.exec(산문);
    if (m) {
      const 값 = m[1];
      if (/^면제/.test(값)) {
        const 사유 = 값.replace(/^면제\s*[·:\-]?\s*/, '').trim();
        면제.push({ 상대, 사유 });
        // 사유 없는 면제는 「검토했다」와 「껐다」가 같은 모양이 된다.
        if (!사유) 적색.push(`   · ${상대} — 면제인데 **사유가 없다**(표식: \`<!-- 심문: 면제 · 왜 -->\`)`);
      } else {
        선언.push(상대);
      }
      continue;
    }
    if (후보이름꼴.test(path.basename(상대)) && 소급꼴.test(본문)) 후보.push(상대);
  }

  const 미심문 = 선언.filter((p) => !심문됨.has(p));
  // 장부가 가리키는데 파일이 없다 = 개명·삭제. review-runs 는 여기서 `continue` 로 침묵한다(:206).
  const 끊김 = [...가리킨것].filter((p) => !fs.existsSync(path.join(ROOT, p)));

  if (미심문.length) {
    적색.push(`🔴 **심문 대상으로 선언됐는데 ②설계 심문을 안 받은 정본 ${미심문.length}벌** — 계약·스키마는 동결 뒤 못 고친다:`);
    for (const p of 미심문) 적색.push(`   · ${p}`);
    적색.push('   심문: node tools/codex-review.js --심문 <문서> --던지기');
  }
  if (끊김.length) {
    적색.push(`🔴 **심문 장부가 가리키는 파일이 없다 ${끊김.length}벌** — 개명이거나 지워졌다. 「드리프트 없음」이 아니라 «추적 끊김»이다:`);
    for (const p of 끊김) 적색.push(`   · ${p} (장부에는 있는데 디스크에 없다)`);
    적색.push('   개명이면 새 이름으로 다시 심문한다 — 장부는 이력이라 고쳐 쓰지 않는다.');
  }
  if (후보.length) {
    알림.push(`🟠 **표식이 없는 심문 후보 ${후보.length}벌** — 본문이 스스로 「소급 불가」를 말하는 설계·계약·규격 문서다.`);
    알림.push('   대상이면 `<!-- 심문: 소급불가 -->` · 아니면 `<!-- 심문: 면제 · 왜 -->` 를 그 문서에 심는다(판정은 사람이 한다).');
    for (const p of 후보) 알림.push(`   · ${p}`);
  }

  return {
    적색, 알림,
    셈: { 선언: 선언.length, 면제: 면제.length, 미심문: 미심문.length, 후보: 후보.length, 끊김: 끊김.length, 장부: 행들 ? 행들.length : null },
  };
}

/* ── ㉡ 몽골어 검문 드리프트 ────────────────────────────────────────────── */
function 몽골어검문() {
  const 적색 = [], 알림 = [];
  const 행들 = jsonl(몽골장부());
  if (행들 === null || !행들.length) {
    알림.push('🟠 **몽골어 검문 장부가 비어 있다** — 「검문을 다 지났다」가 아니라 **안 재봤다**이다.');
    알림.push('   문안을 검문할 때: node tools/몽골어대조.js --파일 <경로>  (그 실행이 장부를 남긴다)');
    return { 적색, 알림, 셈: { 줄: 행들 ? 0 : null, 바뀜: 0, 끊김: 0 } };
  }
  // 파일 대상만 드리프트를 잰다 — 인자 모드는 잴 파일이 없다(안 잰 것이지 통과가 아니다).
  const 최신 = new Map();
  for (const r of 행들) if (r && r.대상 && r.대상 !== '(인자)' && r.대상지문) 최신.set(r.대상, r);
  const 바뀜 = [], 끊김 = [];
  for (const [상대, r] of 최신) {
    const abs = path.join(ROOT, 상대);
    let 지금;
    try { 지금 = 지문(fs.readFileSync(abs)); } catch (_) { 끊김.push(상대); continue; }
    if (지금 !== r.대상지문) 바뀜.push({ 상대, 그때: r.대상지문, 지금, 통과: r.통과 });
  }
  if (바뀜.length) {
    적색.push(`🔴 **검문 뒤 문안이 바뀐 것 ${바뀜.length}벌** — 옛 도장은 이 바이트에 안 찍혔다:`);
    for (const b of 바뀜) 적색.push(`   · ${b.상대} (검문 때 ${b.그때} → 지금 ${b.지금}${b.통과 ? '' : ' · 그때도 불통과였다'})`);
    적색.push('   다시: node tools/몽골어대조.js --파일 <경로>');
  }
  if (끊김.length) {
    알림.push(`🟠 검문 장부가 가리키는 파일이 없다 ${끊김.length}벌 — ${끊김.join(' · ')}`);
  }
  const 인자만 = 행들.filter((r) => r && r.대상 === '(인자)').length;
  if (인자만 && !최신.size) {
    알림.push(`🟠 검문 ${인자만}건이 전부 인자 모드다 — **드리프트를 원리상 못 잰다**(파일이 없다). 문안은 \`--파일\` 로 검문한다.`);
  }
  return { 적색, 알림, 셈: { 줄: 행들.length, 파일대상: 최신.size, 인자: 인자만, 바뀜: 바뀜.length, 끊김: 끊김.length } };
}

/* ── ㉢ 밖의 사실 ───────────────────────────────────────────────────────── */
function 밖의사실축() {
  const 적색 = [], 알림 = [];
  let 요약;
  // 모듈은 **언제나 이 도구 옆**에서 읽는다(ROOT 는 픽스처로 갈릴 수 있다) — 장부만 env 로 갈린다.
  try { ({ 요약 } = require(path.join(__dirname, '밖의사실.js'))); }
  catch (e) { return { 적색: [`🔴 밖의 사실 자를 못 읽었다(${e.message}) — «확인 불가»다.`], 알림, 셈: {} }; }
  const s = 요약();
  if (!s.목록.length) {
    알림.push('🟠 **밖의 사실 장부가 비어 있다** — 법령·업종코드·FDI·상표·시세에 반박 패스가 **0건**이다.');
    알림.push('   세우기: node tools/밖의사실.js --세움 "명제" --걸린것 "무엇이 걸렸나" --내답 "지금 믿는 답"');
    return { 적색, 알림, 셈: { 합: 0, 열림: 0, 반박받음: 0, 판정완료: 0 } };
  }
  const 오늘 = new Date().toISOString().slice(0, 10);
  if (s.열림.length) {
    적색.push(`🔴 **반박을 안 받은 명제 ${s.열림.length}건** — 「통과」가 아니라 «안 물어봤다»다:`);
    for (const b of s.열림) 적색.push(`   · [${b.키}] ${b.명제}${b.기한 ? ` (기한 ${b.기한}${b.기한 < 오늘 ? ' · **지났다**' : ''})` : ''}`);
    적색.push('   발주문: node tools/밖의사실.js --발주문 <키>');
  }
  if (s.반박받음.length) {
    알림.push(`🟠 답은 왔는데 판정이 없는 것 ${s.반박받음.length}건 — DR 답은 자료지 판정이 아니다:`);
    for (const b of s.반박받음) 알림.push(`   · [${b.키}] ${b.명제}`);
  }
  return { 적색, 알림, 셈: { 합: s.목록.length, 열림: s.열림.length, 반박받음: s.반박받음.length, 판정완료: s.판정완료.length } };
}

/* ── ㉣ 이미 도는 것들의 「마지막이 언제였나」 — 판정하지 않는다. 사실만. ── */
function 신선도() {
  const 줄 = [];
  const 잰다 = (이름, 경로, 꺼내기) => {
    const 행들 = jsonl(경로);
    if (!행들 || !행들.length) { 줄.push(`   ${이름}: 장부 없음/0줄 — «안 재봤다»`); return null; }
    const 마지막 = 꺼내기(행들[행들.length - 1]);
    const 일 = 마지막 ? Math.floor((Date.now() - new Date(마지막)) / 86400000) : null;
    줄.push(`   ${이름}: ${행들.length}건 · 마지막 ${마지막 ? String(마지막).slice(0, 16).replace('T', ' ') : '(시각 못 읽음)'}${일 == null ? '' : ` (${일}일 전)`}`);
    return 일;
  };
  잰다('①배포 검수(Codex)', 검수장부(), (r) => r.시각);
  잰다('모델 정찰(전 벤더)', 정찰장부(), (r) => r.때 || r.시각);
  return 줄;
}

/* ── 스로틀: 같은 적색은 하루 한 번(rot-check 원칙 4 — 우는 검사는 꺼진다) ── */
function 도장읽기() {
  try { return JSON.parse(fs.readFileSync(도장경로(), 'utf8')); } catch (_) { return {}; }
}
/** @returns {string|null} 실패 사유 — **삼키지 않는다.** 조용히 실패하면 스로틀이 「있는 척」이 된다. */
function 도장쓰기(v) {
  try {
    fs.mkdirSync(path.dirname(도장경로()), { recursive: true });
    fs.writeFileSync(도장경로(), JSON.stringify(v), 'utf8');
    return null;
  } catch (e) { return e.message; }
}

function main() {
  const argv = process.argv.slice(2);
  const 훅 = argv.includes('--훅') || argv.includes('--hook');
  const 강제 = argv.includes('--force');

  const 축 = [
    ['②설계 심문 (Codex)', 심문커버리지()],
    ['몽골어 검문 (Gemini)', 몽골어검문()],
    ['㉠밖의 사실 (DR 둘)', 밖의사실축()],
  ];
  const 적색 = 축.flatMap(([, a]) => a.적색);
  const 알림 = 축.flatMap(([, a]) => a.알림);

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ 축: Object.fromEntries(축.map(([n, a]) => [n, a.셈])), 적색, 알림 }, null, 2));
    return 0;
  }

  if (훅) {
    if (!적색.length) return 0;                         // 알림만 있으면 훅에서는 침묵한다(상시 소음 금지)
    const 오늘 = new Date().toISOString().slice(0, 10);
    const 옛 = 도장읽기();
    const 새것 = {};
    const 낼것 = [];
    for (const 줄 of 적색) {
      // 열쇠 = 줄의 앞머리(경로·문면). 흔들리는 값(건수)이 뒤에 오도록 위에서 문면을 짰다.
      const 키 = 줄.trim().slice(0, 80);
      새것[키] = 오늘;
      if (강제 || 옛[키] !== 오늘) 낼것.push(줄);
    }
    const 도장실패 = 도장쓰기(새것);
    if (!낼것.length) return 0;                         // 오늘 이미 말했다
    console.log('🧭 [AI 스택 점검] 역할은 배치돼 있는데 **안 돌고 있는** 자리다(알림 · 막지 않는다):');
    console.log(낼것.join('\n'));
    if (도장실패) console.log(`   ⚠ 스로틀 도장을 못 썼다(${도장실패}) — 하루 1회가 아니라 **매 세션** 다시 운다.`);
    console.log('   전부 보기: node tools/ai스택점검.js');
    return 0;
  }

  console.log('🧭 AI 스택 점검 — 세 벤더에 나눠 준 역할이 실제로 도는가\n');
  for (const [이름, a] of 축) {
    const 셈 = Object.entries(a.셈).map(([k, v]) => `${k} ${v === null ? '(안 재봤다)' : v}`).join(' · ');
    console.log(`■ ${이름}${셈 ? ` — ${셈}` : ''}`);
    if (!a.적색.length && !a.알림.length) console.log('   ✅ 걸린 것 없음');
    for (const 줄 of a.적색) console.log(줄.startsWith('   ') ? 줄 : '  ' + 줄);
    for (const 줄 of a.알림) console.log(줄.startsWith('   ') ? 줄 : '  ' + 줄);
    console.log('');
  }
  console.log('■ 이미 도는 것 — 마지막이 언제였나(판정 아님)');
  for (const 줄 of 신선도()) console.log(줄);
  console.log(`\n합계: 적색 ${적색.length}줄 · 알림 ${알림.length}줄`);
  console.log('🚫 심문 «드리프트»(심문 뒤 문서가 자란 것)는 여기서 안 센다 — 그 자는 .claude/hooks/review-runs.js 하나다.');
  return 0;
}

module.exports = { 심문커버리지, 몽골어검문, 밖의사실축, 표식꼴, 도장경로 };

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) {
    // 자가 죽은 것은 「정상」이 아니라 «확인 불가»다 — 종료코드로 갈라 말한다.
    console.error('🔴 AI 스택 점검이 못 돌았다:', e.message);
    process.exit(1);
  }
}
