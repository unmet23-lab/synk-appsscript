#!/usr/bin/env node
'use strict';
/* 코덱스러너 — codex 호출에 **진짜 상한**을 세우는 심부름꾼 (신설 2026-09-05 · 유호 지시 「진짜 상한 세워줘」).
 *
 * ■ 왜 있나 — 09-05 실측: `--timeout 60` 인데 **91초**를 기다렸다
 *   `codex-review.js` 의 `codex()` 는 동기 호출(`execFileSync`)이고, 윈도에서 우리가 «직접» 낳는 것은
 *   `cmd.exe` 다. 코덱스는 그 **손자**다. 시간이 다 되면 Node 는 자식(cmd.exe)에게만 신호를 보내는데,
 *   손자는 살아서 출력 통로를 붙들고 있고 동기 호출은 그 통로가 닫혀야 끝난다 — 그래서 상한이 아니라
 *   «하한»으로 굴렀다(90초 사는 가짜를 걸면 91초 뒤에 돌아온다). 문면은 「60초 소진」 하나뿐이라
 *   그 사실이 어디에도 안 남았다.
 *
 * ■ 어떻게 세우나 — 두 가지를 한꺼번에 바꾼다
 *   ① **손자의 번호를 아는 자**가 끊는다. 이 러너가 codex 를 낳으므로 그 pid 를 안다.
 *      시간이 다 되면 `taskkill /T /F`(윈도) · 프로세스 무리 죽이기(그 밖)로 **나무째** 끊는다.
 *      ⇒ 고아가 남아 한도·CPU 를 계속 먹는 일이 없다.
 *   ② **자식의 출력을 파이프가 아니라 «파일»로 받는다.** 파이프가 없으니 부모(러너)가 그 통로에
 *      붙들리지 않는다. 부모의 부모(`codex()`)는 이 러너의 종료만 기다리면 된다.
 *
 * ■ 부르는 법 — 명세 파일 하나만 준다(인자에 긴 경로·따옴표를 안 싣는다)
 *   node tools/lib/코덱스러너.js <명세.json>
 *   명세 = { bin, args, cwd, 입력파일, 나감파일, 새는곳파일, 상한ms }
 *
 * ■ 종료코드 — 「못 잰 것」과 「재서 실패한 것」을 가른다
 *   0     자식이 0 으로 끝났다
 *   124   **상한에 걸려 우리가 끊었다**(자식이 실패한 것이 아니다 — 부르는 쪽이 이 값을 타임아웃으로 읽는다)
 *   125   자식을 낳지도 못했다(실행 파일 없음 등) — 까닭은 새는곳 파일에 적힌다
 *   그 밖  자식의 종료코드 그대로
 *
 * ⚠ 이 파일의 자식 호출부도 창을 숨긴다 — 던지기가 `detached` 로 뜨면 그 아래 사슬 전체가
 *   콘솔 없는 상태가 되고, 한 자리만 빠져도 유호님 화면에 검은 창이 뜬다(F361).
 *   회귀(`tests/이종검수.test.js`)가 이 파일도 같이 센다. */

const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

/* `codex-review.js` 의 같은 이름 통로와 «같은 일»을 한다. 여기서 그 모듈을 require 하지 않는 것은
 * 러너가 매 호출마다 새로 뜨는 자라 무거운 모듈을 끌고 오면 그만큼 늦어지기 때문이다. */
function 자식옵션(opts) {
  return Object.assign({ windowsHide: true }, opts);
}

/** 프로세스를 **나무째** 끊는다 — 자식만 죽이면 손자가 살아 통로를 붙든다(이 파일이 있는 까닭). */
function 나무죽이기(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], 자식옵션({ stdio: 'ignore' }));
    return;
  }
  /* 그 밖에서는 `detached` 로 낳아 두었으므로 무리(pid 의 음수)에 한 번에 보낸다. */
  try { process.kill(-pid, 'SIGKILL'); } catch (_) { try { process.kill(pid, 'SIGKILL'); } catch (__) { /* 이미 죽었다 */ } }
}

function main() {
  const 명세경로 = process.argv[2];
  if (!명세경로) { process.stderr.write('코덱스러너: 명세 파일 경로가 없다\n'); return 125; }
  const 명세 = JSON.parse(fs.readFileSync(명세경로, 'utf8'));

  let 들머리 = null, 나감 = null, 새는곳 = null;
  try {
    들머리 = fs.openSync(명세.입력파일, 'r');
    나감 = fs.openSync(명세.나감파일, 'w');
    새는곳 = fs.openSync(명세.새는곳파일, 'w');
  } catch (e) {
    process.stderr.write('코덱스러너: 통로 파일을 못 열었다 — ' + (e && e.message) + '\n');
    return 125;
  }

  const isWin = process.platform === 'win32';
  let 아이;
  try {
    아이 = spawn(
      isWin ? (process.env.ComSpec || 'cmd.exe') : 명세.bin,
      isWin ? ['/c', 명세.bin, ...명세.args] : 명세.args,
      자식옵션({ cwd: 명세.cwd, stdio: [들머리, 나감, 새는곳], detached: !isWin })
    );
  } catch (e) {
    try { fs.writeSync(새는곳, 'ERROR: 코덱스를 낳지 못했다 — ' + (e && e.message) + '\n'); } catch (_) { /* */ }
    return 125;
  }

  let 끊었나 = false;
  const 시계 = setTimeout(() => {
    끊었나 = true;
    나무죽이기(아이.pid);
    /* 끊은 뒤 아주 잠깐 준다 — 자식이 마지막 몇 글자를 파일에 흘리고 나갈 틈이다.
     * 그래도 안 끝나면 그냥 나간다: **여기서 더 기다리면 상한이 또 상한이 아니게 된다.** */
    setTimeout(() => process.exit(124), 1500).unref();
  }, Math.max(1000, Number(명세.상한ms) || 60000));

  아이.on('error', (e) => {
    clearTimeout(시계);
    try { fs.writeSync(새는곳, 'ERROR: 코덱스 실행 실패 — ' + (e && e.message) + '\n'); } catch (_) { /* */ }
    process.exit(125);
  });
  아이.on('exit', (코드, 신호) => {
    clearTimeout(시계);
    if (끊었나) process.exit(124);
    process.exit(신호 ? 1 : (코드 == null ? 1 : 코드));
  });
  return null;   // 이벤트가 끝을 낸다
}

const 즉답 = main();
if (즉답 !== null && 즉답 !== undefined) process.exit(즉답);

module.exports = { 나무죽이기, 자식옵션 };
