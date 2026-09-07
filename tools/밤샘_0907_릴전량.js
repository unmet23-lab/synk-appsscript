#!/usr/bin/env node
/**
 * 밤샘 0907 릴 전량 — 릴 92편(몽글 46 · 까몽 46 · 표지 92장)을 새 곡·가운데 자막으로 다시 굽는다
 *   (유호 지시 09-07 「웅 지금 밤굽기 해줘」 · 방아쇠는 열이었다 — 「노트북이 너무 뜨거워」로 낮 굽기를 멈췄다).
 *
 * ■ 왜 다시 굽나 — 둘이 90편 «전부»에 걸린다
 *   ⓐ 곡이 Suno 판으로 갈렸다(몽글 따뜻_118 · 까몽 밝은_052 · 커밋 1fdfa601b · 볼륨은 다시 잰 값).
 *   ⓑ 몽골어 자막이 왼쪽으로 치우쳐 있던 것을 고쳤다(258d4af08 · 새 판 +0.5px 대 옛 판 −152px).
 *   아침에 8편(01편 다섯 · 02편 1~3 몽글)만 새로 났고 84편이 남았다. `--전량` 은 그 8편도 다시 굽는데
 *   14분쯤이라 목록을 가르는 코드보다 싸다.
 *
 * ■ 통로 = `node 영상/굽기.js --전량` 두 벌 (몽글 기본 → `--가이드 까몽`)
 *   09-07 에 `--전량` 이 준비 세 단계(대본읽기·자산모으기·발행검사)를 벌마다 한 번만 하게 고쳤다
 *   (58e3293fc · 편당 157초 → 102초). 표지도 같은 벌 안에서 난다. 그래서 여기서 대본읽기를 따로 안 부른다.
 *   🔴 두 벌을 «동시에» 돌리지 않는다 — 굽기는 `src/클립/생성/*.ts` 와 `public/` 을 다시 쓰므로 서로를 덮는다.
 *
 * ■ 성패의 자는 종료코드가 아니라 «새로 난 파일 수»다
 *   굽기 도구가 0 을 내고도 옛 파일을 그대로 두는 길이 있으면 종료코드는 거짓 초록이다(밤샘_0907 규약).
 *   벌이 끝나면 `영상/out/` 에서 시작 시각 뒤에 난 mp4·png 를 센다. 기대 = 영상 46 + 표지 46 (벌마다).
 *
 * ■ 돈 0원 · 이 기계의 일 · 상한은 시간
 *   Remotion 이 이 기계에서 화면을 그린다. 벌마다 상한 5시간(편당 102초 × 46 + 표지 ≈ 1시간 40분의 세 배).
 *   ⚠ 배터리로 두면 잠들어 몇 시간에 한 장이 된다 — 띄우기 «전»에 콘센트를 재고, 안 꽂혔으면 굽지 않고 선다.
 *
 * ■ 아침에 볼 것
 *   ① `docs/_ops/밤굽기도장.json` — 완주했나(단계 둘의 새영상·새표지 수). 완주 ≠ 합격이다.
 *   ② `영상/out/clip-*_프레임.png` — 첫 화면(자리·자막 가운데)은 사람 눈이 판정한다.
 *   ③ 로그 = %TEMP%\밤샘0907_릴전량.log (굽기 도구의 줄이 그대로 흐른다).
 *   🔴 산출물은 커밋하지 않는다 — `영상/out/` 은 .gitignore 가 막는다.
 *
 * 띄우는 법(PowerShell · 콘솔에서 완전히 뗀다 · CreateFlags=520 · `.claude/rules/bake-tools.md`):
 *   $si = ([WMIClass]'Win32_ProcessStartup').CreateInstance()
 *   $si.CreateFlags = 520; $si.ShowWindow = 0
 *   ([WMIClass]'Win32_Process').Create('"C:\Program Files\nodejs\node.exe" "C:\Users\q1212\Documents\SYNK-appsscript\tools\밤샘_0907_릴전량.js"', 'C:\Users\q1212\Documents\SYNK-appsscript', $si)
 */
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* stdout·stderr 을 파일로 직접 돌린다 — 떼어낸 프로세스는 리디렉션이 안 닿는다(밤샘_0901 규약). */
const 로그경로 = process.env.SYNK_LOG_PATH
  || path.join(process.env.TEMP || process.env.TMP || os.tmpdir(), '밤샘0907_릴전량.log');
const 로그fd = fs.openSync(로그경로, 'a');
const 쓰기 = (s) => { try { fs.writeSync(로그fd, s); } catch (_) { /* 로그가 굽기를 막지 않는다 */ } return true; };
process.stdout.write = 쓰기;
process.stderr.write = 쓰기;

const 루트 = path.resolve(__dirname, '..');
const 노드 = process.execPath;
const 산출방 = path.join(루트, '영상', 'out');
const 시각 = () => new Date().toLocaleTimeString('ko-KR');
const 말 = (s) => { console.log(s); };

/** 두 벌. 이 목록을 다른 파일에 다시 적지 않는다 — 편 목록은 굽기.js --전량 이 대본에서 읽는다. */
const 벌들 = [
  { 이름: '몽글 46 + 표지 46', 인자: ['--전량'] },
  { 이름: '까몽 46 + 표지 46', 인자: ['--전량', '--가이드', '까몽'] },
];
const 기대영상 = 46;

/* 완주 도장 — 밤굽기.js·밤샘_0907.js 와 같은 원장을 쓴다(새 원장을 안 만든다). 완주 ≠ 합격이다. */
const 도장길 = path.join(루트, 'docs', '_ops', '밤굽기도장.json');
const 단계기록 = [];
function 도장(상태, 사유) {
  try {
    const 임시 = `${도장길}.${process.pid}.tmp`;
    fs.mkdirSync(path.dirname(도장길), { recursive: true });
    const 벌 = {
      시각: new Date().toISOString(),
      무엇: '밤샘_0907_릴전량.js',
      상태,
      완주: 상태 === '완주',
      사유,
      로그: 로그경로,
      pid: process.pid,
      단계: 단계기록,
    };
    fs.writeFileSync(임시, `${JSON.stringify(벌, null, 2)}\n`, 'utf8');
    fs.renameSync(임시, 도장길);
  } catch (_) { /* 도장이 굽기를 막지 않는다 */ }
}

process.on('uncaughtException', (e) => {
  말(`🔴 ${시각()} 잡히지 않은 예외 — ${e && e.stack ? e.stack : e}`);
  도장('죽음', String((e && e.message) || e).slice(0, 200));
  process.exit(1);
});

/** 콘센트가 꽂혔나 — Win32_Battery.BatteryStatus 가 2 라야 꽂힘. 못 재면 «모름»이지 «꽂힘»이 아니다. */
function 콘센트() {
  const r = spawnSync('powershell', ['-NoProfile', '-Command', '(Get-CimInstance Win32_Battery).BatteryStatus'],
    { encoding: 'utf8', windowsHide: true, timeout: 30 * 1000 });
  return String(r.stdout || '').trim();
}

/** 시작 시각 뒤에 새로 난 산출물을 센다 — 이것이 성패의 자다. */
function 새로난수(since, 꼴) {
  try {
    return fs.readdirSync(산출방).filter((f) => 꼴.test(f) && fs.statSync(path.join(산출방, f)).mtimeMs >= since).length;
  } catch (_) { return 0; }
}

/** 굽기 도구가 마지막에 찍는 요약줄을 로그에서 되읽는다(사람이 아침에 볼 한 줄). */
function 요약줄(since바이트) {
  try {
    const 글 = fs.readFileSync(로그경로, 'utf8').slice(since바이트);
    const 줄들 = 글.split('\n').filter((l) => l.includes('전량 굽기 끝'));
    return (줄들[줄들.length - 1] || '').trim().slice(0, 240);
  } catch (_) { return ''; }
}

function 한벌({ 이름, 인자 }) {
  const t0 = Date.now();
  const 로그시작 = (() => { try { return fs.statSync(로그경로).size; } catch (_) { return 0; } })();
  말(`\n■ ${시각()} ${이름} — node 영상/굽기.js ${인자.join(' ')}`);
  /* 자식의 출력은 이 로그 파일로 «직접» 흐른다 — 2시간짜리 벌을 아침까지 눈으로 따라갈 수 있어야 한다. */
  const r = spawnSync(노드, [path.join(루트, '영상', '굽기.js'), ...인자], {
    cwd: 루트,
    stdio: ['ignore', 로그fd, 로그fd],
    timeout: 5 * 60 * 60 * 1000, // 벌 상한 5시간 — 넘으면 그 벌만 버리고 다음으로 간다
    windowsHide: true,
  });
  const 분 = Number(((Date.now() - t0) / 60000).toFixed(1));
  const 새영상 = 새로난수(t0, /^(clip|count)-.*\.mp4$/);
  const 새표지 = 새로난수(t0, /-cover\.png$/);
  const 됨 = r.status === 0 && 새영상 >= 기대영상;
  const 요약 = 요약줄(로그시작);
  단계기록.push({ 벌: 이름, 됨, 분, 종료코드: r.status, 새영상, 새표지, 기대영상, 요약 });
  말(됨
    ? `   ✅ ${이름} — ${분}분 · 새 영상 ${새영상} · 새 표지 ${새표지}`
    : `   🔴 ${이름} — ${분}분 · 종료코드 ${r.status} · 새 영상 ${새영상}/${기대영상} · 새 표지 ${새표지}${r.error ? ` · ${r.error.message}` : ''}`);
  if (요약) 말(`   ${요약}`);
  도장('돌는중', `${단계기록.filter((x) => x.됨).length}/${벌들.length} 벌`);
  return 됨;
}

(function 밤() {
  말(`\n══ 밤샘 0907 릴 전량 — 92편 다시 굽기 · 시작 ${new Date().toLocaleString('ko-KR')} · pid ${process.pid} ══`);
  도장('돌는중', '시작');

  const 전원 = 콘센트();
  if (전원 !== '2') {
    말(`🔴 ${시각()} 콘센트가 안 꽂혔다(BatteryStatus=${전원 || '?'}) — 배터리로 구우면 몇 시간에 한 장이라 굽지 않는다.`);
    도장('죽음', `콘센트 안 꽂힘(BatteryStatus=${전원 || '?'})`);
    process.exit(1);
  }
  말(`   ✅ 콘센트 꽂힘(BatteryStatus=2)`);

  const t시작 = Date.now();
  for (const 벌 of 벌들) 한벌(벌);

  /* 프레임 띠 — 「첫 화면에 자리가 깔리고 자막이 가운데인가」는 사람 눈이 판정한다. 그 눈에 줄 것을 밤이 만든다. */
  말(`\n■ ${시각()} 프레임 뽑기`);
  let 띠 = 0;
  for (const f of fs.readdirSync(산출방).filter((x) => /^clip-.*\.mp4$/.test(x)).sort()) {
    const r = spawnSync(노드, [path.join(루트, '영상', '프레임뽑기.js'), f], {
      cwd: 루트, stdio: ['ignore', 로그fd, 로그fd], timeout: 5 * 60 * 1000, windowsHide: true,
    });
    if (r.status === 0) 띠 += 1;
  }
  말(`   프레임 띠 ${띠}장`);

  const 성공벌 = 단계기록.filter((x) => x.됨).length;
  const 새영상 = 새로난수(t시작, /^(clip|count)-.*\.mp4$/);
  const 새표지 = 새로난수(t시작, /-cover\.png$/);
  말(`\n══ 끝 ${new Date().toLocaleString('ko-KR')} — 벌 ${성공벌}/${벌들.length} · 새 영상 ${새영상}/92 · 새 표지 ${새표지}/92 ══`);
  말('   아침에 볼 것: docs/_ops/밤굽기도장.json · 영상/out/clip-*_프레임.png');
  도장(성공벌 === 벌들.length ? '완주' : (성공벌 ? '일부' : '죽음'), `새 영상 ${새영상}/92 · 새 표지 ${새표지}/92`);
  process.exit(성공벌 === 벌들.length ? 0 : 1);
})();
