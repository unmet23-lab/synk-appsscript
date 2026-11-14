#!/usr/bin/env node
/* agy(Gemini 명령줄 도구)를 하루 한 번 창 없이 최신으로 올린다.
 *
 * agy는 켜질 때 15분에 한 번 스스로 업데이트를 확인하는데, 그 확인이 콘솔 없이 `agy --version`을 띄워
 * 유호님 화면에 Windows Terminal 창이 떴다(11-15, 현장 노트 윈도우 #terminal-popup). 그래서 사용자 환경
 * 변수 AGY_CLI_DISABLE_AUTO_UPDATE=true로 자동 확인을 끄고('1'은 agy가 무시한다), 업데이트는 이 도구가
 * 예약 「SYNK agy 업데이트」로 한다. 손으로 `agy update`를 쳐도 같다(변수가 켜져 있어도 된다).
 *
 *   node tools/agy업데이트.js          업데이트를 확인하고 결과 한 줄을 찍는다(종료 코드는 agy의 것)
 *
 * 예약은 pythonw로 tools/숨김실행.py를 거쳐 이 파일을 부르므로 창이 생기지 않는다.
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

function 실행파일() {
  if (process.env.SYNK_AGY_BIN) return process.env.SYNK_AGY_BIN;
  const 깐곳 = path.join(os.homedir(), 'AppData', 'Local', 'agy', 'bin', 'agy.exe');
  return fs.existsSync(깐곳) ? 깐곳 : 'agy';
}

function main() {
  const r = spawnSync(실행파일(), ['update'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 240_000,
    env: { ...process.env, AGY_CLI_DISABLE_AUTO_UPDATE: 'true' },
  });
  const 글 = `${r.stdout || ''}${r.stderr || ''}`.trim();
  const 때 = new Date().toISOString();
  if (r.error) {
    console.log(`${때} agy update 실행 실패: ${r.error.code || r.error.message}`);
    return 1;
  }
  console.log(`${때} agy update 종료 ${r.status}\n${글}`);
  return r.status ?? 1;
}

process.exitCode = main();
