/*
 * 밤굽기 — 긴 배치를 «주무실 때» 한 프로세스로 돌린다 (유호 방침 08-25 결정.md
 *   「다른 작업 하고 잘 때만 굽는 게 제일 효율적일 것 같아」 — 낮에는 GPU 를 비운다).
 *
 * 🔑 **세션에서 떼어 띄운다.** 08-24 밤 실측: 세션이 죽으면 그 세션이 띄운 굽기가 전부 같이
 *   죽는다(밤샘 222장이 그렇게 사라졌다). 띄우는 법 — PowerShell 에서:
 *     $p = Start-Process -FilePath (Get-Command node).Source `
 *            -ArgumentList "<이 파일>", "<대기분>" -WindowStyle Hidden `
 *            -RedirectStandardOutput "<out>" -RedirectStandardError "<err>" -PassThru
 *   그리고 **부모가 죽었는지 확인**한다(ParentProcessId 가 이미 없으면 고아화 성공 = claude 와 무관).
 * 🔑 그리고 «한 프로세스»로 끝까지 간다 — 감시가 감시를 기다리는 사슬을 안 만든다.
 * 🔑 **띄운 직후 트랙.md 에 「돌고 있음 + 로그 절대경로 + 내 소유 경로」를 적고 산 옆 세션에 알린다.**
 *   안 하면 옆 세션이 「주인 없는 미커밋」으로 읽고 진행 중인 것을 걷어 간다(08-25 실물).
 *
 * ■ 08-26 «이어굽기» — 이 판이 무엇의 뒷부분인가 (유호 지시 「① 굽기 작업 이어서 해」)
 *   07:27 에 띄운 밤 배치가 **13:20 에 끊겼다.** 버그가 아니라 **재부팅**이다 —
 *   시스템 이벤트 1074 「13:21:55 · 시작 메뉴에서 다시 시작」. 그때까지 난 것:
 *     ⓪까몽 누끼 3(38.9분 · 종료 0) · ⓪a누끼 검사(성한것 3/3) · ⓪a2워프 지면 · ⓪b감정 시안 3(3.2분)
 *     · ⓪c까몽 확정 3(100.3분) · ①화면 14+덧씌움 14(14.8분 · 지면은 `b90a3cc2a` 로 고친 뒤 10:06 에 났다)
 *     · ②NPC 몸색 재료 8 + 판정 지면(73.6분 · 종료 0)
 *   끊긴 자리 = **③ 요소 라이브러리 52 의 23장째**(퍼프로브+글자 22 완주 · 오브 26 은 미착수).
 *   ⇒ 이 판은 **그 뒤부터만** 돈다. 위 여덟 단계를 여기 남겨 두면 다시 부를 때 ≈4시간을 헛돈다
 *     (이 머리말이 「그때의 우선순위다 — 다음에 쓸 때 다시 판단해서 고친다」고 적어 둔 그 자리다).
 *     지운 단계의 전문은 git 이력이 쥔다(`556c2fed4` 이전 판).
 *
 * ■ 이 판의 순서
 *   ③요소 라이브러리 **남은 30**(퍼프로브·글자 4 + 오브 26) → ④NPC 20 → ⑤NPC 시트 → ⑥검사
 *   🔑 ③은 `--이어` 로 «시각»을 기준 삼아 남은 것만 굽는다. 안 좁히면 `--라이브러리만` 이 언제나
 *      `--다시` 를 넘겨 **이미 난 22장을 통째로 또 굽는다**(≈2.5시간). 옛 판도 이미 1800px 이라
 *      «가로폭»으로는 못 가른다 — 판정 축은 시각이다(트랙 §0).
 *   ⏱ 실측 근거: 오브 26 = 08-24 판에서 18:27→21:43 ≈3.3시간 · NPC 20 = 799초/장 ≈4.4시간.
 *      퍼프로브 잔여 4 는 십수 분. 합계 ≈8시간.
 *   ⚠NPC 20 은 **현행 정본(몸색 Oat)** 으로 굽는다. 처방 ①(역마다 유채 몸)은 유호 미판정이라
 *     역형상 표를 안 움직인다 — 미확정을 전량에 박으면 반려 때 20장이 통째로 버려진다.
 *     그 판정 재료(몸색 8장)는 ②에서 이미 났다.
 *   ⚠**배치 도는 중에 `tools/요소굽기.py` 를 고치지 않는다** — 세트굽기가 항목마다 이 파일을
 *     새로 읽어, 고치면 앞 렌더와 뒤 렌더가 갈리고 갈린 세트는 나중에 못 알아본다.
 *
 * 쓰기: node tools/밤굽기.js [대기분]      (대기분 없으면 즉시 시작)
 */
'use strict';
const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 대기분 = Number(process.argv[2] || 0);

/* ③ 이어굽기의 기준 시각 — «이것보다 옛 파일만 다시 굽는다».
 * 끊긴 배치가 ③에 들어간 순간(11:18:30)을 쓴다: 그 앞에 난 22장은 이 기준 뒤라 건너뛰고,
 * 08-24 에 난 30장만 걸린다. 손으로 목록을 적지 않는다 — 목록을 적으면 그 줄이 다음 낡은 참조가 된다. */
const 이어기준 = '2026-08-26 11:18';

/** 블렌더 찾기 — NPC굽기.js·오브굽기.js 와 같은 순서(환경변수 → 설치 폴더 최신). */
function 블렌더() {
  for (const k of ['BLENDER_EXE', 'BLENDER']) {
    if (process.env[k] && fs.existsSync(process.env[k])) return process.env[k];
  }
  for (const b of ['C:\\Program Files\\Blender Foundation', 'C:\\Program Files (x86)\\Blender Foundation']) {
    if (!fs.existsSync(b)) continue;
    for (const d of fs.readdirSync(b).sort().reverse()) {
      const p = path.join(b, d, 'blender.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/* 로그는 저장소 밖(임시 폴더)에 쓴다 — 굽기 로그를 git 이 쥐면 커밋마다 딸려 들어간다.
 * 대신 «어디에 쓰는지»를 첫 줄에 찍는다: 경로를 모르면 로그는 없는 것과 같다(08-25 배움). */
const 로그길 = path.join(os.tmpdir(), '밤굽기.log');
const 말 = (s) => {
  const 줄 = `[${new Date().toTimeString().slice(0, 8)}] ${s}`;
  console.log(줄);
  try { fs.appendFileSync(로그길, 줄 + '\n'); } catch (_) { /* 로그 실패로 굽기를 멈추지 않는다 */ }
};
const 분 = (ms) => (ms / 60000).toFixed(1);
const 잔다 = (초) => { try { execFileSync('powershell', ['-NoProfile', '-Command', `Start-Sleep -Seconds ${초}`]); } catch (_) { /* */ } };

/* 🔴 프로세스를 셀 때 `tasklist /FI` 를 쓰지 않는다 — 한글 로케일·MSYS 경로 변환 때문에 늘 0건이다
 *   (트랙 §0 이 금지한 통로 · 08-25 에 옆 세션이 그것으로 「굽기가 멈췄다」를 오진했다). */
function 블렌더수() {
  try {
    return parseInt(String(execFileSync('powershell', ['-NoProfile', '-Command',
      '@(Get-Process blender -ErrorAction SilentlyContinue).Count'], { encoding: 'utf8' })).trim(), 10) || 0;
  } catch (_) { return 0; }
}

function 단계(이름, 실행) {
  말(`■ ${이름}`);
  const t0 = Date.now();
  const 코드 = 실행();
  말(`■ ${이름} 끝 · ${분(Date.now() - t0)}분 · 종료코드 ${코드}`);
  return 코드;
}
const 노드 = (도구, 인자들) => spawnSync(process.execPath, [path.join(루트, 'tools', 도구), ...인자들],
  { cwd: 루트, stdio: 'inherit' }).status;

const BL = 블렌더();
if (!BL) { console.error('🔴 blender.exe 를 못 찾았다 — BLENDER_EXE 로 경로를 준다.'); process.exit(1); }

말(`■ 밤굽기(08-26 이어굽기) 착수 — ${대기분 ? `${대기분}분 뒤 시작` : '즉시 시작'} · 로그 ${로그길}`);
for (let i = 0; i < 대기분; i += 1) {
  잔다(60);
  if ((i + 1) % 15 === 0) 말(`  … 대기 ${i + 1}/${대기분}분`);
}
/* GPU 양보 — 옆 세션이 굽는 중이면 최대 20분 기다렸다 들어간다.
 * 무한 대기는 안 한다: 아침에 「아무것도 안 됨」이 「좀 느림」보다 훨씬 나쁘다.
 * (GPU 는 Arc iGPU 하나뿐이라 두 벌이 물면 서로 절반 속도가 된다 — 08-25 실측 88초 → 285초.) */
for (let i = 0; i < 40; i += 1) {
  const n = 블렌더수();
  if (n === 0) break;
  if (i === 0) 말(`  ⏸ 블렌더 ${n}벌이 돈다 — 최대 20분 양보`);
  잔다(30);
}
말(`■ 시작 — 블렌더 ${블렌더수()}벌`);

/* ③ 요소 라이브러리 — 남은 것만(퍼프로브·글자 4 + 오브 26).
 *   08-24 에 기계로 세니 3D 자산 중 52장이 옛 자(AgX)에 남아 있던 그 자리다(§2-F).
 *   `--이어` 가 그중 «아직 옛 것»만 골라 낸다 — 22장을 또 굽지 않는다. */
단계(`③ 요소 라이브러리 — ${이어기준} 보다 옛 것만(남은 30 = 퍼프로브·글자 4 + 오브 26)`,
  () => 노드('명품재굽기.js', ['--라이브러리만', '--이어', 이어기준]));

/* ④ NPC 20장 — 실측 799초/장(1800px·256 · GPU ONEAPI 생존 · 08-25) ⇒ 20장 ≈ 4.4시간.
 *   ⚠이 통로에는 이어굽기가 없다(20장을 언제나 처음부터). 또 끊기면 `--것 "a,b"` 로 좁혀 부른다 —
 *   무엇이 남았는지는 `docs/캐릭터/NPC공방_0824` 의 **시각**이 답한다(수로는 못 잡는다 · 트랙 §0). */
단계('④ NPC 20장 — 1800px · 샘플 256 · 현행 정본(몸색 Oat)', () => 노드('NPC굽기.js', []));
단계('⑤ NPC 시안 시트', () => 노드('NPC시트.js', []));

단계('⑥ 기계 검사 — 전량이 새 자로 났나', () => 노드('명품재굽기.js', ['--검사', '2026-08-25 07:33']));

말('■ 밤굽기 끝 — 아침에 낼 것: 오브 시안 + NPC_시안.html');
