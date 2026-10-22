#!/usr/bin/env node
'use strict';
/* 서버 아르곤 예약의 agy 로그인 창을 이 터미널에 띄운다 (2026-10-22, unmet25 예비 로그인).
 *
 *   node tools/argon-schedules/agy-login.cjs unmet25     (또는 77yuhbs)
 *
 * standby의 지금 주소를 GCE API로 읽고(scan-read.cjs와 같은 길·같은 호스트 키), ssh -tt로 붙어
 * 서버의 `agy-account.py login <계정>`을 띄운다. 그 계정 HOME에서만 도는 대화형 agy 로그인 화면이다(다른 계정 HOME은 가림).
 * 사람이 할 일: 「1. Google OAuth」에서 Enter → 뜬 주소를 브라우저에서 열고 그 계정으로 허용 → 브라우저에 나온 코드를 붙여 넣고 Enter.
 * 끝나면 Ctrl+D 두 번(또는 /exit)으로 나온다. 확인은 서버에서 `sudo python3 /opt/synk-argon-77yuhbs/agy-account.py status --usage`.
 * 비밀번호·토큰은 이 도구를 지나가지 않는다.
 */
const { spawn } = require('node:child_process');
const { currentAddress, KEY, KNOWN, ALIAS } = require('./scan-read.cjs');

const ACCOUNTS = new Set(['77yuhbs', 'unmet25']);

async function main() {
  const account = process.argv[2];
  if (!ACCOUNTS.has(account)) {
    console.error('사용: node tools/argon-schedules/agy-login.cjs unmet25|77yuhbs');
    process.exitCode = 2;
    return;
  }
  const address = await currentAddress();
  console.log(`[${account} 로그인] 「1. Google OAuth」에서 Enter → 뜬 주소를 브라우저에서 열고 ${account}@gmail.com으로 허용 → 나온 코드를 여기 붙여 넣고 Enter.`);
  const remote = `sudo python3 /opt/synk-argon-77yuhbs/agy-account.py login ${account} "$SSH_CONNECTION"`;
  const child = spawn('ssh', ['-tt', '-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
    '-o', 'UserKnownHostsFile=' + KNOWN.replaceAll('\\', '/'), '-o', 'HostKeyAlias=' + ALIAS, '-o', 'CheckHostIP=no',
    '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', 'synk@' + address, remote], { stdio: 'inherit', windowsHide: false });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
  child.on('error', (e) => { console.error('ssh를 띄우지 못했다: ' + e.message); process.exitCode = 1; });
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
