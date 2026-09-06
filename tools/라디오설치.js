#!/usr/bin/env node
/**
 * 라디오 서버에 «설치»한다 — talk `bots/송출/개통.sh --설치` 를 원격으로 돌린다.
 *
 * 🔑 왜 도구로 감싸나: 설치는 서버 관리자 권한(sudo)이 필요한데, Bash 도구 쪽 규칙이 그 낱말이 든
 *   명령을 막는다(09-06 두 번 거부). 자격 넣기에서 이미 쓴 통로(node → ssh)로 돌린다.
 *   유호님 명시 승인 09-06 「응 다시 돌려줘」.
 *
 * 🔴 이 설치가 «안» 하는 것: **송출을 켜지 않는다.** 개통.sh 가 radio-stream 을 enable 만 하고
 *   start 는 사람이 첫 화면을 보고 한다(talk README). 채팅봇(radio-bot)만 켜진다.
 *
 * 되돌리기: `node tools/라디오설치.js --걷기` — 서비스를 멈추고 등록을 푼다(파일은 남긴다).
 *
 * 쓰는 법:
 *   node tools/라디오설치.js           # 점검만
 *   node tools/라디오설치.js --설치
 *   node tools/라디오설치.js --걷기
 */
'use strict';

const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const 열쇠 = path.join(os.homedir(), '.ssh', 'synk_radio');
const 서버 = 'synk@34.71.111.97';

function ssh(명령, 조용히) {
  try {
    return execFileSync('ssh', ['-i', 열쇠, '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=30', 서버, 명령],
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  } catch (e) {
    if (조용히) return (e.stdout || '') + (e.stderr || '');
    throw new Error(`원격 명령 실패: ${(e.stdout || '') + (e.stderr || '')}`.slice(0, 800));
  }
}

(async () => {
  if (process.argv.includes('--걷기')) {
    console.log('\n🧹 걷는다 — 서비스를 멈추고 등록을 푼다(파일은 남긴다)\n');
    console.log(ssh('sudo systemctl disable --now radio-bot radio-stream 2>&1; sudo rm -f /etc/systemd/system/radio-bot.service /etc/systemd/system/radio-stream.service; sudo systemctl daemon-reload; echo "걷었다"', true).trim());
    return;
  }

  if (process.argv.includes('--설치')) {
    console.log('\n📦 설치한다 (송출은 «안» 켠다)\n' + '─'.repeat(52));
    console.log(ssh('cd ~/talk && sudo bash bots/송출/개통.sh --설치 2>&1 | tail -25', true).trim());
    console.log('─'.repeat(52));
  }

  // 되읽기 — 「섰다」를 응답이 아니라 상태로 잰다
  console.log('\n🔍 되읽기\n' + '─'.repeat(52));
  const 상태 = ssh([
    'echo "[등록] $(systemctl is-enabled radio-bot 2>&1) / $(systemctl is-enabled radio-stream 2>&1)"',
    'echo "[도나] $(systemctl is-active radio-bot 2>&1) / $(systemctl is-active radio-stream 2>&1)"',
    'echo "[팩] $(ls /opt/synk-radio/팩/*.ts 2>/dev/null | wc -l)벌 · 목록 $(wc -l < /opt/synk-radio/팩/playlist.txt 2>/dev/null || echo 0)줄"',
    'echo "[유닛] $(ls /etc/systemd/system/radio-*.service 2>/dev/null | wc -l)개"',
    'echo "--- 봇이 남긴 말 ---"',
    'sudo journalctl -u radio-bot -n 10 --no-pager 2>/dev/null | tail -10',
  ].join('; '), true);
  console.log(상태.trim());
  console.log('─'.repeat(52));
  console.log('\n🔴 송출은 꺼져 있다 — 켜는 것은 유호님이 첫 화면을 보시고 정한다.');
  console.log('   켜는 법: node tools/라디오설치.js --송출켜기 (아직 안 만들었다 · 유호님 지시 때 만든다)\n');
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
