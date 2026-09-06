#!/usr/bin/env node
/**
 * 밤샘 0907 — 릴 여덟 편을 «자리(장소)가 깔린» 새 판으로 다시 굽는다
 *   (유호 지시 09-07 「굽는 작업은 전부 밤샘 굽기 작업에 올려줘」).
 *
 * ■ 무엇을 굽나 — 9월 캘린더가 정한 여덟 편, 몽글판만
 *   `docs/9월_발행캘린더.md` §1 이 IG·YT 에 걸 편을 여덟으로 못 박았다:
 *     01-1 · 01-2 · 01-3 · 01-4 · 09-1 · 09-3 · 09-4 · 09-5
 *   🚫 **01-5 와 09-2 는 안 굽는다** — 훅 몽골어가 검문에 걸려 캘린더가 이미 뺐고(09-05),
 *      감수 뒤에 글이 바뀔 자리라 지금 구우면 버리는 굽기가 된다.
 *   🚫 **까몽판도 안 굽는다** — 「몽글판으로 통일」(유호 확정 09-05).
 *
 * ■ 왜 다시 굽나
 *   09-07 에 훅 첫 2초에 «자리»(펠트 장소 사진)가 들어갔다(유호 확정 · `리드크루클립.tsx` 의 `훅바탕`).
 *   01편 다섯 화는 학교 자리(교실·복도·창가 책상·운동장·우편함 앞), 09편 다섯 화는 「카페 안」이다.
 *   지금 `영상/out/` 에 서 있는 여덟은 그 층이 «없는» 판이다.
 *
 * ■ 돈 0원 · 이 기계의 일이다
 *   제미나이 밤굽기(`tools/밤굽기.js`)와 다르다 — 그림을 사 오는 게 아니라 Remotion 이
 *   이 기계에서 화면을 그려 낸다. 그래서 **상한을 돈이 아니라 «시간»으로 둔다**(편당 25분).
 *   ⚠ 램 16GB 가 병목이다([[laptop-specs-and-ram-price-crisis]]) — 한 번에 한 편만 굽는다.
 *   ⚠ 배터리로 두면 잠들어 몇 시간에 한 장이 된다([[night-bake-needs-wall-power]]).
 *      띄우기 «전»에 콘센트를 확인한다(`Win32_Battery.BatteryStatus` 가 2 라야 꽂힘).
 *
 * ■ 한 편이 실패해도 다음으로 간다
 *   여덟이 서로 독립이라, 하나가 죽어 밤을 통째로 버리는 쪽이 더 비싸다.
 *   성패는 파일이 말한다 — 아침에 `영상/out/*.mp4` 의 «시각»과 길이를 본다.
 *
 * ■ 아침에 볼 것
 *   ① `영상/out/clip-{01-1,01-2,01-3,01-4,09-1,09-3,09-4,09-5}.mp4` 여덟의 시각이 오늘인가
 *   ② `영상/out/clip-*_프레임.png` — 첫 화면에 자리가 깔렸는가(사람 눈이 판정한다)
 *   ③ `docs/_ops/밤굽기도장.json` — 완주했나. 완주 ≠ 합격이다.
 *   🔴 산출물은 커밋하지 않는다 — `영상/out/` 은 .gitignore 163줄이 막는다(유호 확인 09-07).
 *
 * 띄우는 법(PowerShell · 콘솔에서 완전히 뗀다 · CreateFlags=520 · `.claude/rules/bake-tools.md`):
 *   $si = ([WMIClass]'Win32_ProcessStartup').CreateInstance()
 *   $si.CreateFlags = 520; $si.ShowWindow = 0
 *   ([WMIClass]'Win32_Process').Create('"C:\Program Files\nodejs\node.exe" "C:\Users\q1212\Documents\SYNK-appsscript\tools\밤샘_0907.js"', 'C:\Users\q1212\Documents\SYNK-appsscript', $si)
 */
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* stdout·stderr 을 파일로 직접 돌린다 — 떼어낸 프로세스는 리디렉션이 안 닿는다(밤샘_0901 규약). */
const 로그경로 = process.env.SYNK_LOG_PATH
  || path.join(process.env.TEMP || process.env.TMP || os.tmpdir(), '밤샘0907.log');
const 로그fd = fs.openSync(로그경로, 'a');
const 쓰기 = (s) => { try { fs.writeSync(로그fd, s); } catch (_) { /* 로그가 굽기를 막지 않는다 */ } return true; };
process.stdout.write = 쓰기;
process.stderr.write = 쓰기;

const 루트 = path.resolve(__dirname, '..');
const 노드 = process.execPath;
const 시각 = () => new Date().toLocaleTimeString('ko-KR');
const 말 = (s) => { console.log(s); };

/** 캘린더가 정한 여덟. 이 목록을 다른 파일에 다시 적지 않는다. */
const 편들 = ['clip-01-1', 'clip-01-2', 'clip-01-3', 'clip-01-4', 'clip-09-1', 'clip-09-3', 'clip-09-4', 'clip-09-5'];

/* 완주 도장 — 밤굽기.js 와 같은 원장을 쓴다(새 원장을 안 만든다). 완주 ≠ 합격이다. */
const 도장길 = path.join(루트, 'docs', '_ops', '밤굽기도장.json');
const 단계기록 = [];
function 도장(상태, 사유) {
  try {
    const 임시 = `${도장길}.${process.pid}.tmp`;
    fs.mkdirSync(path.dirname(도장길), { recursive: true });
    const 벌 = {
      시각: new Date().toISOString(),
      무엇: '밤샘_0907.js',
      상태,
      완주: 상태 === '완주',
      사유,
      로그: 로그경로,
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

function 한편(id) {
  const t0 = Date.now();
  말(`■ ${시각()} ${id} 굽는 중 …`);
  const r = spawnSync(노드, [path.join(루트, '영상', '굽기.js'), id], {
    cwd: 루트,
    encoding: 'utf8',
    timeout: 25 * 60 * 1000, // 한 편 상한 25분 — 넘으면 그 편만 버리고 다음으로 간다
    windowsHide: true,
  });
  const 분 = ((Date.now() - t0) / 60000).toFixed(1);
  const 산출 = path.join(루트, '영상', 'out', `${id}.mp4`);
  /* 🔑 성패의 자는 «종료코드»가 아니라 **파일이 방금 다시 났는가**다.
     굽기 도구가 0 을 내고도 옛 파일을 그대로 두는 길이 있으면 종료코드는 거짓 초록이 된다. */
  let 새것 = false; let 크기 = 0;
  try {
    const st = fs.statSync(산출);
    크기 = st.size;
    새것 = st.mtimeMs >= t0;
  } catch (_) { /* 없다 = 실패 */ }
  const 됨 = r.status === 0 && 새것;
  단계기록.push({ 편: id, 됨, 분: Number(분), 크기, 종료코드: r.status });
  말(됨
    ? `   ✅ ${id} — ${분}분 · ${(크기 / 1e6).toFixed(1)}MB`
    : `   🔴 ${id} — ${분}분 · 종료코드 ${r.status} · 파일 갱신 ${새것 ? '됨' : '안 됨'}\n${String(r.stderr || '').slice(-600)}`);
  도장('돌는중', `${단계기록.filter((x) => x.됨).length}/${편들.length} 편`);
  return 됨;
}

(function 밤() {
  말(`\n══ 밤샘 0907 — 릴 여덟 편 다시 굽기 · 시작 ${new Date().toLocaleString('ko-KR')} ══`);
  도장('돌는중', '시작');

  /* 대본 → 생성 데이터를 먼저 다시 쓴다. 안 하면 «자리»가 안 들어간 옛 데이터로 굽는다
     ([[seed-code-vs-stored-rows]] — 대본이 새 것이라고 구운 것이 새 것은 아니다). */
  말(`■ ${시각()} 대본읽기 · 자산모으기`);
  for (const 앞일 of [['영상', '대본읽기.js'], ['영상', '자산모으기.js']]) {
    const r = spawnSync(노드, [path.join(루트, ...앞일)], { cwd: 루트, encoding: 'utf8', windowsHide: true });
    말(`   ${r.status === 0 ? '✅' : '🔴'} ${앞일.join('/')} — 종료코드 ${r.status}`);
    if (r.status !== 0) {
      말(String(r.stderr || '').slice(-800));
      도장('죽음', `${앞일.join('/')} 실패 — 굽기 전에 섰다`);
      process.exit(1);
    }
  }

  for (const id of 편들) 한편(id);

  /* 프레임 띠 — 「첫 화면에 자리가 깔렸나」는 사람 눈이 판정한다. 그 눈에 줄 것을 밤이 만든다. */
  말(`■ ${시각()} 프레임 뽑기`);
  for (const id of 편들) {
    const r = spawnSync(노드, [path.join(루트, '영상', '프레임뽑기.js'), `${id}.mp4`], {
      cwd: 루트, encoding: 'utf8', timeout: 5 * 60 * 1000, windowsHide: true,
    });
    말(`   ${r.status === 0 ? '✅' : '⚠'} ${id}`);
  }

  const 성공 = 단계기록.filter((x) => x.됨).length;
  말(`\n══ 끝 ${new Date().toLocaleString('ko-KR')} — 여덟 중 ${성공} 편 ══`);
  말('   아침에 볼 것: 영상/out/clip-*_프레임.png (첫 화면에 자리가 깔렸는가)');
  도장(성공 === 편들.length ? '완주' : '일부', `${성공}/${편들.length} 편`);
  process.exit(성공 === 편들.length ? 0 : 1);
})();
