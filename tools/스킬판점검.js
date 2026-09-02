#!/usr/bin/env node
'use strict';
/* 스킬 판 점검 — 「밖에서 들여온 스킬이 뒤졌나」를 스스로 세는 자.
 *
 * ■ 왜 있나 (2026-09-03 · 유호님 「자동화가 확실히 적용돼서 앞으로 그냥 하면 알아서 되는지 확인해줘」)
 *   그날 실측하고 알았다 — 스킬 9벌 중 셋은 **두 번의 점검에서 「안 재봤다」로 남아 있었다.**
 *   판번호도 출처도 파일에 없어 «비교할 상대»를 못 찾았기 때문이다. 그리고 나머지도
 *   **사람이 물어봐야만** 재졌다. 상류가 움직여도 아무도 안 알려준다.
 *
 * ■ 무엇을 재나 — 「상류의 그 폴더가 마지막으로 바뀐 커밋」
 *   판번호를 안 믿는다. 09-03 실측: 우리 last30days 는 3.18.4 라 적혀 있었지만 상류 태그
 *   v3.18.4 와 22벌이 달랐고(태그가 아니라 그때의 main 을 떴다), 반대로 remotion 은
 *   「번호만 뒤짐」으로 판정됐지만 자막 코드의 버그 수정이 들어 있었다.
 *   👉 번호가 아니라 **폴더의 마지막 커밋**을 견준다. 경로별로 재니 모노레포에서
 *      우리와 무관한 커밋에는 안 운다.
 *
 * ■ 하지 «않는» 것
 *   🚫 **자동으로 받아 갈아끼우지 않는다.** 9벌 중 넷은 우리 개조본이다(한국어 이름표,
 *      지운 색·폰트). 통째로 덮으면 그 고침이 사라진다 — 알리기만 하고 판단은 사람이 한다.
 *   🚫 **막지 않는다.** 알림이다. 네트워크가 안 되면 조용히 넘어간다.
 *   🚫 **목록을 여기에 짓지 않는다.** 어느 스킬이 어디서 왔나는 `.claude/skills/외부반입_출처.md`
 *      의 표 하나가 쥔다. 이 파일은 그 표를 «읽어서» 센다 — 값이 두 곳에 살면 갈린다.
 *
 * ■ 쓰는 법
 *     node tools/스킬판점검.js          ← 지금 전량 대조(네트워크를 쓴다)
 *     node tools/스킬판점검.js --훅      ← 세션 시작용. 7일 안에 쟀으면 조용, 아니면 대조
 *     node tools/스킬판점검.js --도장    ← 「봤고 처리했다」 — 지금 상류를 기준선으로 새로 적는다
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const 저장소뿌리 = path.resolve(__dirname, '..');
const 표경로 = path.join(저장소뿌리, '.claude', 'skills', '외부반입_출처.md');
const 장부경로 = path.join(저장소뿌리, 'docs', '_ops', '스킬판장부.json');
/* 「마지막으로 재본 때」는 저장소 «밖»에 둔다. 장부(기준선)에 같이 적으면 훅이 돌 때마다
 * 그 파일이 미커밋으로 떠서, 다음 세션이 배포 1단계에서 「남의 변경인가」를 헛세게 된다.
 * 기준선은 세션 사이에 «공유»돼야 하니 저장소에 남고, 잰 때는 이 기계의 사정이라 밖이다.
 * ⚠ 지워지면 한 번 더 재기만 한다(네트워크 9회 · 무해한 실패). */
const 잰때경로 = path.join(os.tmpdir(), 'synk-스킬판-잰때');
const 조용한날 = 7;

/* ── 표 읽기 — 정본은 외부반입_출처.md 하나다 ───────────────────────── */

// 표의 「원본이 있는 곳」 칸에서 owner/repo 와 폴더 경로를 뽑는다.
// 적는 꼴은 줄마다 `owner/repo` → `폴더경로` 하나뿐이다. 「〃」 상속을 일부러 안 받는다 —
// 상속은 줄을 옮기거나 지울 때 조용히 엉뚱한 저장소를 가리킨다.
function 표읽기() {
  if (!fs.existsSync(표경로)) {
    return { 오류: `표가 없다: ${path.relative(저장소뿌리, 표경로)}` };
  }
  const 줄들 = fs.readFileSync(표경로, 'utf8').split(/\r?\n/);
  const 항목 = [];
  const 성한줄 = [];

  for (const 줄 of 줄들) {
    if (!줄.startsWith('|')) continue;
    const 칸 = 줄.split('|').slice(1, -1).map((s) => s.trim());
    if (칸.length < 3) continue;
    if (/^-+$/.test(칸[0].replace(/[:\s]/g, ''))) continue; // 표 구분선
    const 이름 = (칸[0].match(/`([^`]+)`/) || [])[1];
    if (!이름) continue; // 머리줄

    const 원본칸 = 칸[1];
    const 저장소 = (원본칸.match(/`([\w.-]+\/[\w.-]+)`/) || [])[1] || null;
    const 경로 = ((원본칸.split('→')[1] || '').match(/`([^`]+)`/) || [])[1] || null;
    if (!저장소 || !경로) {
      성한줄.push(이름); // 꼴이 깨진 줄은 「없다」가 아니라 「못 읽었다」로 알린다
      continue;
    }
    항목.push({ 이름, 저장소, 경로: 경로.replace(/\/+$/, '') });
  }
  return { 항목, 못읽은줄: 성한줄 };
}

/* ── 상류에 묻기 — 「그 폴더가 마지막으로 바뀐 커밋」 ────────────────── */

async function 상류마지막커밋(저장소, 경로) {
  const 주소 = 경로
    ? `https://api.github.com/repos/${저장소}/commits?path=${encodeURIComponent(경로)}&per_page=1`
    : `https://api.github.com/repos/${저장소}/commits?per_page=1`;
  const 답 = await fetch(주소, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'synk-skill-audit' },
  });
  if (!답.ok) throw new Error(`GitHub 응답 ${답.status}`);
  const 목록 = await 답.json();
  if (!Array.isArray(목록) || !목록.length) throw new Error('커밋 0건');
  return { sha: 목록[0].sha, 날짜: (목록[0].commit?.committer?.date || '').slice(0, 10) };
}

/* ── 장부 ─────────────────────────────────────────────────────────── */

function 장부읽기() {
  try {
    return JSON.parse(fs.readFileSync(장부경로, 'utf8'));
  } catch {
    return { 마지막대조: null, 스킬: {} };
  }
}

function 장부쓰기(장부) {
  fs.mkdirSync(path.dirname(장부경로), { recursive: true });
  fs.writeFileSync(장부경로, JSON.stringify(장부, null, 2) + '\n', 'utf8');
}

function 지난날(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return Infinity;   // 쓰레기 값이면 「안 재봤다」로 읽는다(조용히 건너뛰지 않는다)
  return (Date.now() - t) / 86400000;
}

function 잰때읽기() {
  try { return fs.readFileSync(잰때경로, 'utf8').trim() || null; } catch { return null; }
}
function 잰때쓰기() {
  try { fs.writeFileSync(잰때경로, new Date().toISOString(), 'utf8'); } catch { /* 못 적어도 다음에 한 번 더 잴 뿐 */ }
}

/* ── 본체 ─────────────────────────────────────────────────────────── */

async function 재기() {
  const { 항목, 오류, 못읽은줄 } = 표읽기();
  if (오류) return { 오류 };
  const 장부 = 장부읽기();
  const 결과 = [];

  for (const 것 of 항목) {
    const 적힌것 = 장부.스킬[것.이름] || {};
    try {
      const 지금 = await 상류마지막커밋(것.저장소, 것.경로);
      결과.push({
        ...것,
        상류sha: 지금.sha,
        상류날짜: 지금.날짜,
        기준선: 적힌것.기준선 || null,
        움직였나: Boolean(적힌것.기준선) && 적힌것.기준선 !== 지금.sha,
        처음: !적힌것.기준선,
      });
    } catch (e) {
      결과.push({ ...것, 못쟀다: e.message });
    }
  }
  return { 결과, 장부, 못읽은줄 };
}

function 도장찍기(결과, 장부) {
  const 이제 = new Date().toISOString();
  for (const r of 결과) {
    if (r.못쟀다) continue;
    장부.스킬[r.이름] = { 저장소: r.저장소, 경로: r.경로, 기준선: r.상류sha, 상류날짜: r.상류날짜, 잰때: 이제 };
  }
  장부.마지막대조 = 이제;
  장부쓰기(장부);
}

async function 본체() {
  const 인자 = process.argv.slice(2);
  const 훅모드 = 인자.includes('--훅');
  const 도장 = 인자.includes('--도장');

  if (훅모드) {
    // 아직 이르면 네트워크를 안 쓴다 — 보통 세션은 0초다. 「잰 때」는 저장소 밖(위 주석)
    if (지난날(잰때읽기()) < 조용한날) process.exit(0);
  }

  const { 결과, 장부, 오류, 못읽은줄 } = await 재기();
  if (오류) {
    if (!훅모드) console.error(`⚠ ${오류}`);
    process.exit(훅모드 ? 0 : 1);
  }

  const 움직인것 = 결과.filter((r) => r.움직였나);
  const 처음본것 = 결과.filter((r) => r.처음);
  const 못잰것 = 결과.filter((r) => r.못쟀다);

  if (도장) {
    도장찍기(결과, 장부);
    잰때쓰기();
    console.log(`✅ 지금 상류를 기준선으로 적었다 — ${결과.length - 못잰것.length}벌 (못 잰 것 ${못잰것.length})`);
    return;
  }

  if (훅모드) {
    // 네트워크가 통째로 죽었으면 조용히 넘어간다(막지 않는다)
    if (못잰것.length === 결과.length) process.exit(0);

    if (움직인것.length || 처음본것.length) {
      const 줄 = [];
      if (움직인것.length) {
        줄.push(`🔄 **밖에서 들여온 스킬 ${움직인것.length}벌의 원본이 움직였다** — 뒤졌을 수 있다(막지 않는다):`);
        for (const r of 움직인것) 줄.push(`   · ${r.이름} — 원본이 ${r.상류날짜} 에 바뀌었다`);
      }
      if (처음본것.length) {
        줄.push(`🆕 아직 기준선이 없는 스킬 ${처음본것.length}벌 — 한 번 도장을 찍어야 다음부터 「움직였나」를 잰다.`);
      }
      줄.push(`   무엇이 바뀌었나: 견주는 절차는 \`.claude/skills/외부반입_출처.md\` 에 있다`);
      줄.push(`   봤고 처리했으면 도장: node tools/스킬판점검.js --도장`);
      console.log(줄.join('\n'));
    } else if (못읽은줄 && 못읽은줄.length) {
      // 「0벌 뒤짐」이 표가 깨져서 나온 거짓 초록일 수 있다 — 그 자리를 알린다
      console.log(`⚠ 스킬 판 점검: 표에서 «세지 못한» 줄 ${못읽은줄.length}개(${못읽은줄.join(' · ')}) — 그만큼 「0벌 뒤짐」은 덜 센 값이다.`);
    }
    // 잰 때는 «어느 갈래로 끝나든» 적는다 — 울고 나서 안 적으면 매 세션 같은 소리를 낸다.
    // 장부(기준선)는 안 건드린다: 그건 사람이 `--도장` 을 찍을 때만 움직인다.
    잰때쓰기();
    process.exit(0);
  }

  // 사람이 직접 부른 경우 — 전량을 보여준다
  console.log(`\n밖에서 들여온 스킬 ${결과.length}벌 · 마지막 «도장» ${장부.마지막대조 ? 장부.마지막대조.slice(0, 10) : '(없다)'}\n`);
  for (const r of 결과) {
    if (r.못쟀다) { console.log(`  ⬜ ${r.이름} — 못 쟀다 (${r.못쟀다})`); continue; }
    const 표시 = r.처음 ? '🆕 기준선 없음' : r.움직였나 ? '🔄 원본이 움직였다' : '✅ 그대로';
    console.log(`  ${표시}  ${r.이름}  ·  ${r.저장소}${r.경로 ? '/' + r.경로 : ''}  ·  원본 마지막 변경 ${r.상류날짜}`);
  }
  console.log('');
  if (움직인것.length) {
    console.log(`🔴 ${움직인것.length}벌은 원본이 우리 기준선 뒤로 움직였다. 통째로 덮지 말 것 —`);
    console.log(`   넷은 우리 개조본이다(한국어 이름표·지운 색·폰트). 견주는 절차: .claude/skills/외부반입_출처.md`);
  }
  if (처음본것.length) console.log(`🆕 기준선이 없는 ${처음본것.length}벌 — \`--도장\` 으로 지금을 기준선으로 적는다.`);
  if (못잰것.length) console.log(`⬜ ${못잰것.length}벌은 못 쟀다 — 네트워크나 상류 응답 문제다. 「없다」가 아니라 「안 재봤다」다.`);
  if (못읽은줄 && 못읽은줄.length) {
    console.log(`⚠ 표에서 꼴이 깨져 «세지 못한» 줄 ${못읽은줄.length}개: ${못읽은줄.join(' · ')}`);
    console.log(`   그 줄의 「원본이 있는 곳」 칸을 \`owner/repo\` → \`폴더경로\` 꼴로 고친다.`);
  }
  console.log('');
}

/* 시험이 «순수 부분»을 직접 태울 수 있게 연다 — 표 읽기와 날짜 셈은 네트워크가 없어야 잰다.
 * `require.main` 가드가 없으면 require 하는 순간 본체가 돌아 시험이 바깥을 때린다. */
module.exports = { 표읽기, 지난날, 장부읽기, 잰때읽기, 잰때쓰기, 표경로, 장부경로, 잰때경로, 조용한날 };

if (require.main === module) {
  본체().catch((e) => {
    const 훅 = process.argv.includes('--훅');
    if (!훅) console.error(`⚠ 점검이 죽었다: ${e.message}`);
    process.exit(훅 ? 0 : 1);
  });
}
