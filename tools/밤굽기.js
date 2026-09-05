#!/usr/bin/env node
/*
 * 밤굽기 — 펠트 요소를 «주무실 때» 한 프로세스로 길게 굽는다 (유호 확정 2026-09-05).
 *
 * ■ 09-05 에 통로가 갈아탔다
 *   그 전 밤굽기는 «블렌더 렌더»였다(한 장 2~3분 · 램 16GB 한 대 · 전량이면 8시간).
 *   유호님이 손 도구 여섯을 보시고 「이렇게보니 재미나이가 더 나은것같은데?」로 판정을 뒤집으셨고,
 *   이어 「밤굽기를 이제 제미나이로 대체하려고해」라 못 박으셨다. 옛 판(블렌더 순서표)은 git 이력이 쥔다.
 *   🔑 그래서 **이 배치는 이 기계의 CPU·램을 거의 안 쓴다** — 그림은 구글 기계에서 나고,
 *      여기서는 요청을 던지고 파일을 받아 적을 뿐이다. 다듬는 일(배경 걷기)만 이 기계가 한다.
 *
 * ■ 무엇을 굽나
 *   `docs/공방/계획.json` 에서 상태가 «아직»이고 `지시` 가 적힌 것 전부. 순서는 계획에 적힌 순서다.
 *   🔑 **수를 이 파일에 적지 않는다** — 계획이 늘어도 이 도구를 안 고친다(`공방굽기.js` 와 같은 규율).
 *
 * ■ 밤에만 다른 것 셋
 *   ① **돈 상한**을 먼저 못 박는다(`--돈 50000`). 넘으면 그 자리에서 선다.
 *      $1,000 배정이라 하룻밤에 다 태울 수 있는 구조다 — 상한이 유일한 브레이크다.
 *   ② **몫 벽(429)에 오래 기다린다.** 낮 배치는 90초 한 번이지만 밤은 2분 → 5분 → 10분 세 번.
 *      ⚠ 그래도 «무한»은 아니다 — 실패한 요청도 몫을 먹어 벽이 길어진다
 *      (기억 retry-into-429-holds-the-wall). **세 장 잇달아 실패하면 30분 쉬고, 두 번째면 그만둔다.**
 *   ③ **다듬기까지 자동으로 한다.** 아침에 유호님이 여시는 것은 «쓸 수 있는 자산»이어야 한다.
 *      묶음 하나가 끝날 때마다 `공방뒤처리.py` 를 돌려, 밤이 끊겨도 난 것까지는 자산이 되게 한다.
 *
 * ■ 🔑 세션에서 떼어 띄운다 — 안 그러면 세션이 죽을 때 같이 죽는다
 *   09-05 저녁에 실제로 밟았다: 22장 배치가 14장에서 세션과 함께 끊겼다(exit 4).
 *   🔴 **`Start-Process` 는 못 뗀다**(규칙 `.claude/rules/bake-tools.md`). 이 머리말이 09-05 낮까지
 *      그것을 권했고, 같은 날 배치 «둘»이 그대로 끊겼다 — 40장이 4장에서(12:15), 36장이 21장에서(13:18).
 *      둘 다 예외 한 줄 없이 사라졌다. 아래 uncaughtException 그물에 안 걸린 것이 그 증거다.
 *      떼어졌는지 재는 자 = **부모가 `WmiPrvSE.exe` 인가**(`Get-CimInstance Win32_Process`).
 *   PowerShell 에서 (WMI `CreateFlags=520` = 콘솔에서 완전히 뗌 · 밤샘_0902 와 같은 규약):
 *     $로그 = "$env:TEMP\synk-밤굽기\밤굽기-$(Get-Date -Format 'yyyyMMdd-HHmm').log"
 *     $si = ([WMIClass]'Win32_ProcessStartup').CreateInstance()
 *     $si.CreateFlags = 520; $si.ShowWindow = 0
 *     ([WMIClass]'Win32_Process').Create(
 *       '"C:\Program Files\nodejs\node.exe" "C:\...\tools\밤굽기.js" --돈 50000 --로그 "' + $로그 + '"',
 *       'C:\Users\q1212\Documents\SYNK-appsscript', $si)
 *   ⚠ WMI 는 출력을 파일로 돌려주지 못한다 — 그래서 `--로그` 를 «반드시» 준다(안 주면 기본 경로로 간다).
 *   띄운 «직후» `docs/_ops/트랙.md` 에 「돌고 있음 + 로그 절대경로」를 적는다 —
 *   안 적으면 옆 세션이 주인 없는 미커밋으로 읽고 걷어 간다(08-25 실물).
 *
 * 쓰기:
 *   node tools/밤굽기.js --돈 50000              # 5만 원어치까지
 *   node tools/밤굽기.js --돈 30000 --묶음 "숫자"
 *   node tools/밤굽기.js --돈 20000 --크기 4K    # 큰 그림처럼 크게 쓸 것
 *   node tools/밤굽기.js --재본다                 # 0원. 무엇을 얼마에 굽는지만 본다
 *   node tools/밤굽기.js --로그 <경로>            # 기본은 임시 폴더의 밤굽기-<날짜시각>.log
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const 루트 = path.resolve(__dirname, '..');
const 계획경로 = path.join(루트, 'docs/공방/계획.json');
const 저장방 = path.join(루트, 'docs/Loom_자산/구움');

const 인자 = (() => {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (!v[i].startsWith('--')) continue;
    const k = v[i].slice(2);
    a[k] = (v[i + 1] && !v[i + 1].startsWith('--')) ? v[++i] : true;
  }
  return a;
})();

/* 🔴 기본이 4K 다(유호 확정 09-05) — 자세한 까닭은 `공방굽기.js` 의 같은 줄. */
const 크기 = String(인자.크기 || '4K');
const 돈상한 = Number(인자.돈 || 0);
const 재본다 = !!인자.재본다;
const 사이초 = Number(인자.사이 || 40);          // 장과 장 사이 (분당 몫 피하기)
const 기다림 = [120, 300, 600];                   // 몫 벽에 걸렸을 때 (초)

/* 🔴 **잠든 노트북이 밤을 먹는다**(09-06 00:56 실측 · 이 배치가 두 시간에 한 장 구웠다).
 *   콘센트를 안 꽂으면 윈도가 「모던 대기」로 들어가고, 그 순간 열려 있던 요청이 `fetch failed` 로 죽는다.
 *   실물 = 22:49 한 장 → 23:06 잠 → 00:54 깸(잠든 108분이 통째로 날아갔다).
 *   ⚠ 이건 「몫이 찼다」도 「돈이 없다」도 아니다 — 다시 던지면 그냥 된다. 그런데 옛 코드는
 *     이것을 «실패»로 세어 세 번이면 30분 쉬고 두 번이면 밤을 끝냈다. 그물이 잠깐 끊겼다고
 *     열두 시간짜리 밤을 접으면 안 된다. 그래서 그물 끊김은 «따로» 세고, 참을성 있게 다시 던진다.
 *   🔑 잠든 동안에는 이 기다림도 같이 멈춘다 — 그래서 「깬 시간으로 한 시간」이 된다. */
const 그물기다림 = 300;                            // 그물이 끊겼을 때 한 번 쉬는 초
const 그물판수 = 12;                               // 그 짓을 몇 번까지 (깬 시간으로 약 한 시간)
const 그물무늬 = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network|getaddrinfo/i;
const 그물인가 = (e) => !e?.돈벽 && !e?.몫벽 && 그물무늬.test(String(e?.message || e));

const 잔다 = (초) => new Promise((r) => setTimeout(r, 초 * 1000));
const 이제 = () => new Date().toTimeString().slice(0, 8);

/* 🔴 **로그는 파일에 «즉시» 쓴다**(09-05 실물).
 *   그 전에는 화면 출력을 `cmd > 파일` 로 돌렸는데, 프로그램이 끝날 때까지 한 글자도 안 쌓였다.
 *   그래서 114장 배치가 스무 장을 남기고 멈췄을 때 **왜 멈췄는지 못 봤다.**
 *   긴 배치는 「도는 동안 볼 수 있어야」 자다 — appendFileSync 로 그 자리에서 적는다. */
const 로그경로 = 인자.로그 || path.join(require('os').tmpdir(), 'synk-밤굽기',
  `밤굽기-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.log`);
fs.mkdirSync(path.dirname(로그경로), { recursive: true });
const 말 = (s) => {
  const 줄 = `[${이제()}] ${s}`;
  console.log(줄);
  try { fs.appendFileSync(로그경로, 줄 + String.fromCharCode(10), 'utf8'); } catch { /* 로그가 막혀도 굽기는 계속한다 */ }
};

/* 🔴 **죽는 이유를 로그에 남긴다**(09-05 실물).
 *   40장 배치가 넷째 장 뒤에 «조용히» 죽었다. 로그에는 오류가 없었는데, 그건 예외 문면이
 *   stderr 로 가고 나는 stdout 만 파일로 돌렸기 때문이다 — 즉 «없어서 안 보인 것»이 아니라
 *   «다른 곳으로 가서 안 보인 것»이다. 여기서 붙잡아 같은 로그에 적는다. */
for (const 갈래 of ['uncaughtException', 'unhandledRejection']) {
  process.on(갈래, (e) => {
    말(`🔴 ${갈래} — ${(e && e.stack) || e}`);
    process.exit(1);
  });
}
process.on('exit', (코드) => { if (코드 !== 0) 말(`■ 프로세스가 코드 ${코드} 로 끝났다`); });

function 계획읽기() { return JSON.parse(fs.readFileSync(계획경로, 'utf8')); }

/** 굽을 것을 «한 번» 고른다 — 이 목록은 시작 시점의 사진이다.
 *  🔴 그 뒤 장부에서 걷힌 것은 여기 그대로 남는다. 그래서 던지기 직전에 `살아있나()` 로 다시 본다. */
function 고른다(계획) {
  const 담을것 = [];
  for (const [통로, 묶음들] of Object.entries(계획)) {
    if (통로.startsWith('_') || !묶음들 || !묶음들.묶음) continue;
    for (const 묶 of 묶음들.묶음) {
      /* 🔑 묶음은 «쉼표로 여럿» 줄 수 있다(09-05 밤 · 공방굽기.js 와 같은 규율).
       *   계획에는 여러 트랙이 각자 구울 것을 넣어 두므로, 이름 없이 던지면 남의 몫까지 나간다. */
      if (인자.묶음 && !String(인자.묶음).split(',').map((s) => s.trim()).includes(묶.이름)) continue;
      for (const 것 of 묶.것들 || []) {
        if (것.상태 !== '아직' || !것.지시) continue;
        담을것.push({ 묶음: 묶, 것 });
      }
    }
  }
  return 담을것;
}

/** 그 항목이 «지금도» 장부에 있고 아직 안 구운 상태인가.
 *  🔴 09-05 밤 실사고 — 22:09 에 535장으로 뜬 밤이 «22:2x 에 걷힌 47장»을 그대로 들고 있었다.
 *     밤은 열두 시간이고 그 사이에 유호님이 「이건 버려」 하시는 일이 반드시 생긴다.
 *     한 장이 336원이라 47장 = 15,792원이 그냥 나갈 뻔했다(우연히 눈에 띄어 막았다). */
function 살아있나(계획, 묶이름, 것이름) {
  for (const 묶음들 of Object.values(계획)) {
    if (!묶음들 || !묶음들.묶음) continue;
    for (const 묶 of 묶음들.묶음) {
      if (묶.이름 !== 묶이름) continue;
      for (const 것 of 묶.것들 || []) {
        if (것.이름 === 것이름) return 것.상태 === '아직';
      }
    }
  }
  return false;
}

function 상태옮김(계획, 묶이름, 것이름, 파일) {
  for (const 묶음들 of Object.values(계획)) {
    if (!묶음들 || !묶음들.묶음) continue;
    for (const 묶 of 묶음들.묶음) {
      if (묶.이름 !== 묶이름) continue;
      for (const 것 of 묶.것들 || []) {
        if (것.이름 !== 것이름) continue;
        것.상태 = '구웠다';
        것.파일 = 파일;
      }
      묶.상태 = `${(묶.것들 || []).filter((x) => x.상태 === '구웠다').length}/${(묶.것들 || []).length}`;
    }
  }
  /* 🔴 **장부는 «옆에 다 쓰고 나서» 바꿔 낀다**(09-05 실사고 · 같은 처방이 `공방뒤처리.py` 에도).
   *   그날 뒤처리가 도중에 죽으며 계획.json 을 0바이트로 남겼고, 그것을 다시 읽으려던
   *   이 도구가 따라 죽어 배치가 통째로 끊겼다. 임시 파일에 적고 rename 으로 한 번에 바꾼다. */
  const 임시 = 계획경로 + '.tmp';
  fs.writeFileSync(임시, JSON.stringify(계획, null, 2) + '\n', 'utf8');
  fs.renameSync(임시, 계획경로);
}

/** 묶음 하나가 끝나면 다듬는다 — 밤이 끊겨도 난 것까지는 «쓸 수 있는 자산»이 되게. */
function 다듬는다(묶이름) {
  말(`  ↳ 다듬는다 [${묶이름}]`);
  const r = spawnSync('python', [path.join(루트, 'tools/공방뒤처리.py'), '--묶음', 묶이름],
    { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  const 줄 = String(r.stdout || '').trim().split('\n').filter(Boolean);
  if (줄.length) 말(`     ${줄[줄.length - 1]}`);
  if (r.status !== 0) 말(`     ⚠ 뒤처리가 ${r.status} 로 끝났다 — 아침에 손으로 한 번 더 돌린다`);
}

(async () => {
  const 굽기 = require('./lib/이미지굽기.js');
  let 계획 = 계획읽기();
  const 굽을것 = 고른다(계획);
  const 장당 = 굽기.예상비용(1, 크기).원;

  if (굽을것.length === 0) { 말('🚫 구울 것이 없다(0원).'); return; }

  const 셀수 = 돈상한 > 0 ? Math.min(굽을것.length, Math.floor(돈상한 / 장당)) : 굽을것.length;
  const 값 = 굽기.예상비용(셀수, 크기);
  말(`■ 밤굽기 — 아직 ${굽을것.length}장 중 ${셀수}장 · ${크기} · 약 ${값.원.toLocaleString()}원`
    + (돈상한 ? ` (상한 ${돈상한.toLocaleString()}원 · 장당 ${장당}원)` : ' (상한 없음)'));
  const 묶음별 = {};
  for (const x of 굽을것.slice(0, 셀수)) 묶음별[x.묶음.이름] = (묶음별[x.묶음.이름] || 0) + 1;
  for (const [k, v] of Object.entries(묶음별)) 말(`   · ${k} ${v}장`);

  if (재본다) { 말('■ 재보기만 했다 — 한 장도 안 구웠다(0원).'); return; }
  if (셀수 === 0) { 말(`🚫 상한 ${돈상한}원으로는 한 장도 못 굽는다(장당 ${장당}원).`); return; }

  const ok = await 굽기.배치게이트(셀수, 크기);
  if (!ok) { 말('🚫 게이트가 막았다 — 한 장도 안 구웠다.'); return; }

  let 성공 = 0; let 실패 = 0; let 쓴돈 = 0;
  let 연속실패 = 0; let 긴쉼 = 0;
  let 이전묶음 = null;
  const { 규격표 } = require('./lib/공방규격.js');

  for (let i = 0; i < 셀수; i++) {
    const { 묶음, 것 } = 굽을것[i];

    /* 🔴 던지기 «직전»에 장부를 다시 본다 — 목록은 시작할 때의 사진이라 그 뒤 걷힌 것을 모른다. */
    if (!살아있나(계획읽기(), 묶음.이름, 것.이름)) {
      말(`⏭ ${i + 1}/${셀수} [${묶음.이름}] ${것.이름} — 장부에서 걷혔다 · 안 던진다(0원)`);
      continue;
    }

    if (이전묶음 && 묶음.이름 !== 이전묶음) { 다듬는다(이전묶음); }
    이전묶음 = 묶음.이름;

    const 쇠 = 것.쇠 || ('공방_' + 것.이름.replace(/\s+/g, ''));
    const 저장 = path.join(저장방, 쇠 + '.png');
    const 규격 = 규격표[것.규격 || '부품'];
    if (!규격) { 말(`🔴 ${것.이름} — 모르는 규격 「${것.규격}」`); 실패++; continue; }

    /* 🔑 계획 항목에 `참조` 가 있으면 그 그림을 같이 보낸다 — 낮 배치(`tools/공방굽기.js`)와 같은 줄이다.
     *   옷입히기처럼 «누구에게 입히는지»가 그림을 가르는 자리에 쓴다(규격 「입힘」).
     *   경로가 하나라도 없으면 `한컷` 이 굽기 «전»에 던진다(빈 참조로 구우면 딴 몸이 나온다).
     *   ⚠ 09-05 까지 이 줄이 «낮에만» 있었다 — 밤에 참조가 필요한 항목을 던지면 참조 없이 구워
     *     조용히 다른 그림이 나왔다(값은 그대로 나가고). 두 배치가 같은 계획을 읽으니 같은 줄을 든다. */
    const 참조 = (것.참조 || []).map((r) => (path.isAbsolute(r) ? r : path.join(루트, r)));

    let 났나 = false;
    let 그물판 = 0;
    for (let 판 = 0; 판 <= 기다림.length; 판++) {
      try {
        await 굽기.한컷({ 이름: 것.이름, 지시: 것.지시 + ' ' + 규격, 비율: 것.비율 || '1:1', 크기, 저장경로: 저장, 참조 });
        났나 = true;
        break;
      } catch (e) {
        /* 그물이 끊긴 것은 실패가 아니다 — 세지 않고, 이 장을 놓지도 않는다. */
        if (그물인가(e)) {
          if (그물판 >= 그물판수) {
            말(`🔴 ${것.이름} — 그물이 ${그물판수}번 내리 끊겼다. 이 장은 넘긴다(0원 · ${String(e.message).slice(0, 80)})`);
            break;
          }
          그물판++;
          말(`   🌐 그물이 끊겼다(${String(e.message).slice(0, 40)}) · ${그물기다림 / 60}분 쉬고 다시 (${그물판}/${그물판수})`
            + (그물판 === 1 ? ' — 노트북이 잠들었으면 콘센트를 꽂아야 밤이 돈다' : ''));
          await 잔다(그물기다림);
          판--;                                    // 몫 벽 판수를 그물 끊김으로 태우지 않는다
          continue;
        }
        if (e.돈벽) {
          말(`🔴 돈 벽이 섰다 — 남은 ${셀수 - i}장을 안 던진다.\n   ${String(e.사유 || e.message).slice(0, 200)}`);
          i = 셀수;
          break;
        }
        if (!e.몫벽 || 판 === 기다림.length) {
          말(`🔴 ${것.이름} — ${String(e.message).slice(0, 120)}`);
          break;
        }
        말(`   몫이 찼다 · ${기다림[판] / 60}분 쉬고 다시 (${판 + 1}/${기다림.length})`);
        await 잔다(기다림[판]);
      }
    }

    if (났나) {
      계획 = 계획읽기();
      상태옮김(계획, 묶음.이름, 것.이름, 쇠 + '.png');
      성공++; 쓴돈 += 장당; 연속실패 = 0;
      말(`✅ ${i + 1}/${셀수} [${묶음.이름}] ${것.이름} · 누적 ${쓴돈.toLocaleString()}원`);
    } else {
      실패++; 연속실패++;
      /* 🔑 세 장 잇달아 실패 = 벽이 길어지고 있다. 던지기를 멈추는 것이 회복을 앞당긴다. */
      if (연속실패 >= 3) {
        긴쉼++;
        if (긴쉼 >= 2) { 말('🔴 세 장 잇달아 막힌 것이 두 번째다 — 오늘 밤은 여기서 그만둔다.'); break; }
        말('🟠 세 장 잇달아 막혔다 — 30분 쉰다.');
        await 잔다(1800);
        연속실패 = 0;
      }
    }

    if (i < 셀수 - 1) await 잔다(사이초);
  }

  if (이전묶음) 다듬는다(이전묶음);
  말(`■ 밤이 끝났다 — ${성공 + 실패}장 시도 = 성공 ${성공} + 실패 ${실패} · 약 ${쓴돈.toLocaleString()}원`);
  말(`   다음: node tools/공방지면.js · git add -- docs/Loom_자산/구움/ docs/공방/`);
})();
