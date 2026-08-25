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
 * ■ 08-25 밤의 순서 (이 순서는 «그때의 우선순위»다 — 다음에 쓸 때 다시 판단해서 고친다)
 *   ①화면 14(옛 AgX 자)+덧씌움 → ②NPC 몸색 재료 8 → ③NPC 20 → ④시트 → ⑤라이브러리 52 → ⑥검사
 *   ① 화면 14 가 아직 **반려된 PBR 중립 판**이다(`2f928ba4` · 오늘판만 예외) — 유호님이 보시는
 *      시연 지면이 반려 상태로 남는 것이 가장 나쁘다.
 *   ② NPC 는 **유호님 몸색 판정이 걸린 자리**라 재료가 나와야 판정이 선다.
 *   ③ 라이브러리 52 는 **이미 색이 새것**(`02bf7523`)이고 털만 옛것이라 가장 덜 급하다.
 *      밤이 모자라 여기서 끊겨도 앞의 판정 재료는 다 나와 있다 — 그러라고 맨 뒤에 뒀다.
 *   ⏱ 화면 ≈1.5시간(미실측) · NPC 28 = 6.2시간(실측 799초/장) · 라이브러리 ≈6시간(미실측)
 *
 * ⚠NPC 20 은 **현행 정본(몸색 Oat)** 으로 굽는다. 처방 ①(역마다 유채 몸)은 유호 미판정이라
 *   역형상 표를 안 움직인다 — 미확정을 전량에 박으면 반려 때 20장이 통째로 버려진다. ②가 그 재료다.
 *
 * 쓰기: node tools/밤굽기.js [대기분]      (대기분 없으면 즉시 시작)
 */
'use strict';
const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 몸색밖 = path.join(루트, 'docs', '캐릭터', 'NPC공방_0824', '_몸색시안');
const 대기분 = Number(process.argv[2] || 0);

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

말(`■ 밤굽기 착수 — ${대기분 ? `${대기분}분 뒤 시작` : '즉시 시작'} · 로그 ${로그길}`);
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

/* ① 화면 14 + 덧씌움 14 — `--화면만` 이 굽기·빠진것·덧씌움·지면을 한 벌로 돈다. */
단계('① 화면 열넷(옛 AgX 자) + 덧씌움 + 지면', () => 노드('명품재굽기.js', ['--화면만']));

/* ② NPC 몸색 판정 재료 8장 — A안 넷 × (가드 켬 · 섬유 강제).
 *   두 벌을 굽는 까닭: A안 색 넷은 크로마 0.165~0.31 로 **전부 섬유 문턱(0.16) 밖**이다.
 *   한 벌만 구우면 「섬유가 빠진 줄 모르고」 몸색을 고르시게 된다. */
단계('② NPC 몸색 판정 재료 8장', () => {
  fs.mkdirSync(몸색밖, { recursive: true });
  const A안 = [['boss', 'Butter Soft'], ['prof', 'Lapis Soft'], ['lead', 'Meadow Soft'], ['insp', 'Pop Soft']];
  const 판들 = [
    ...A안.map(([역, 색]) => [`${역}_${색.replace(' ', '')}_정본`, [`역=${역}`, `몸색=${색}`]]),
    ...A안.map(([역, 색]) => [`${역}_${색.replace(' ', '')}_섬유강제`, [`역=${역}`, `몸색=${색}`, '섬유문턱=1.0']]),
  ];
  let 실패 = 0;
  for (const [이름, 옵션] of 판들) {
    const 파일 = path.join(몸색밖, `${이름}.png`);
    const t0 = Date.now();
    spawnSync(BL, ['-b', '-P', path.join(루트, 'tools', 'NPC세트굽기.py'), '--',
      '안=배지', '상태=calm', ...옵션, '샘플=256', '너비=1800', '장치=GPU',
      `저장소=${루트}`, `출력=${파일}`], { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    /* 성공 판정은 «이 굽기가 새로 썼나»(mtime) — 「있나」로 물으면 옛 판이 늘 그 자리에 있어
     * 죽은 굽기도 ✅ 로 찍힌다(`644716a4` 실사고). */
    let 새로 = false;
    try { 새로 = fs.statSync(파일).mtimeMs >= t0 - 1000; } catch (_) { 새로 = false; }
    말(`   ${새로 ? '✅' : '🔴'} ${이름} · ${분(Date.now() - t0)}분`);
    if (!새로) 실패 += 1;
  }
  말(`   지면 종료코드 ${spawnSync('python', [path.join(루트, 'tools', 'NPC몸색지면.py')],
    { cwd: 루트, stdio: 'inherit' }).status}`);
  return 실패;
});

/* ③ NPC 20장 — 실측 799초/장(1800px·256 · GPU ONEAPI 생존 · 08-25) ⇒ 20장 ≈ 4.4시간 */
단계('③ NPC 20장 — 1800px · 샘플 256 · 현행 정본(몸색 Oat)', () => 노드('NPC굽기.js', []));
단계('④ NPC 시안 시트', () => 노드('NPC시트.js', []));

단계('⑤ 라이브러리 52 + 오브 지면', () => 노드('명품재굽기.js', ['--라이브러리만']));

단계('⑥ 기계 검사 — 전량이 새 자로 났나', () => 노드('명품재굽기.js', ['--검사', '2026-08-25 07:33']));

말('■ 밤굽기 끝 — 아침에 낼 것: 화면·오브 시안 + NPC_시안.html + 몸색 판정 8장');
