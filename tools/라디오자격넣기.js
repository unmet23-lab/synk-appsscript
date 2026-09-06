#!/usr/bin/env node
/**
 * 라디오 서버에 «환경»을 채운다 — talk 저장소의 `.env` 에 있는 것을 서버로 옮긴다.
 *
 * 🔴 자격증명 규율:
 *   · 값을 **화면에 안 찍는다**(이름과 «있다/없다»만).
 *   · 통로는 ssh 하나. 파일로 남기지 않고 표준입력으로 흘려 넣는다.
 *   · 이 저장소 안에 값을 쓰지 않는다(git 눈 밖).
 *   🔑 이 일이 AI 몫인 근거 = talk `bots/송출/README.md` 「그날의 순서 (VPS 개설 뒤 — 전부 AI 가 원격으로)」.
 *
 * 🔑 `.env` 가 **둘**이다(talk README):
 *   `/opt/synk-radio/.env`      — 봇이 읽는다(systemd EnvironmentFile)
 *   `/opt/synk-radio/송출/.env` — 송출이 읽는다. 스트림 키는 여기에만.
 *
 * 쓰는 법:
 *   node tools/라디오자격넣기.js          # 무엇이 차고 무엇이 비었나만 본다
 *   node tools/라디오자격넣기.js --넣기    # 서버에 채운다
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const talk환경 = path.join(os.homedir(), 'Documents', 'SYNK-talk', '.env');
const 열쇠 = path.join(os.homedir(), '.ssh', 'synk_radio');
const 서버 = 'synk@34.71.111.97';

/** 봇이 읽는 칸 ← talk `.env` 의 어느 이름에서 오나. 이름이 다른 자리가 있다. */
const 봇칸 = {
  RADIO_CHANNEL_ID: ['RADIO_CHANNEL_ID'],
  RADIO_YT_CLIENT_ID: ['RADIO_YT_CLIENT_ID', 'YOUTUBE_OAUTH_CLIENT_ID'],
  RADIO_YT_CLIENT_SECRET: ['RADIO_YT_CLIENT_SECRET', 'YOUTUBE_OAUTH_CLIENT_SECRET'],
  RADIO_YT_REFRESH_TOKEN: ['RADIO_YT_REFRESH_TOKEN'],
  SUPABASE_URL: ['SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL'],
  SUPABASE_ANON_KEY: ['SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'],
  /* 🔴 09-06 실측: `_PROD` 판을 먼저 쓰면 Supabase 인제스트가 **401 unauthorized** 를 낸다.
   *   배포된 함수가 쥔 값은 «접미사 없는» 쪽이다. 이름이 `_PROD` 라고 «운영용»으로 읽으면 틀린다.
   *   자 = 봇 로그의 「인제스트 실패 HTTP 401」 한 줄. 바꿔 넣고 재시작하니 그 줄이 사라졌다. */
  RADIO_INGEST_SECRET: ['RADIO_INGEST_SECRET'],
  RADIO_ROUND_SECRET: ['RADIO_ROUND_SECRET'],
};

function 환경읽기(경로) {
  if (!fs.existsSync(경로)) throw new Error(`talk 의 .env 를 못 찾았다: ${경로}`);
  const 표 = {};
  for (const 줄 of fs.readFileSync(경로, 'utf8').split(/\r?\n/)) {
    const m = 줄.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v) 표[m[1]] = v;
  }
  return 표;
}

function ssh(명령, 넣을것) {
  return execFileSync('ssh', ['-i', 열쇠, '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=20', 서버, 명령],
    { input: 넣을것 || '', encoding: 'utf8' });
}

(async () => {
  const talk = 환경읽기(talk환경);
  const 넣기 = process.argv.includes('--넣기');

  const 채울것 = {};
  const 빈것 = [];
  for (const [칸, 후보들] of Object.entries(봇칸)) {
    const 찾음 = 후보들.find((n) => talk[n]);
    if (찾음) 채울것[칸] = talk[찾음];
    else 빈것.push(칸);
  }

  console.log('\n🔑 서버에 채울 환경 — 값은 안 찍는다\n' + '─'.repeat(50));
  for (const 칸 of Object.keys(봇칸)) {
    console.log(`  ${채울것[칸] ? '✅' : '❌'} ${칸}${채울것[칸] ? ` (${채울것[칸].length}글자)` : ' — talk .env 에도 없다'}`);
  }
  console.log(`  ❌ YOUTUBE_STREAM_KEY — 유튜브에서 라이브를 만들어야 나온다(송출 쪽 .env)`);
  console.log('─'.repeat(50));

  if (!넣기) { console.log('\n채우려면: node tools/라디오자격넣기.js --넣기\n'); return; }

  // 서버에 방을 만들고 표준입력으로 흘려 넣는다(값이 명령줄·로그에 안 남는다)
  const 몸 = Object.entries(채울것).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  ssh('sudo mkdir -p /opt/synk-radio/팩 /opt/synk-radio/송출 && sudo chown -R synk:synk /opt/synk-radio');
  ssh('cat > /opt/synk-radio/.env && chmod 600 /opt/synk-radio/.env', 몸);
  ssh('touch /opt/synk-radio/송출/.env && chmod 600 /opt/synk-radio/송출/.env');

  // 되읽기 — 「들어갔다」를 이름으로만 확인한다(값은 안 본다)
  const 확인 = ssh("grep -oE '^[A-Z_]+' /opt/synk-radio/.env | sort");
  console.log('\n✅ 서버에 들어간 칸:');
  확인.trim().split(/\r?\n/).forEach((n) => console.log(`   · ${n}`));
  const 권한 = ssh("ls -l /opt/synk-radio/.env /opt/synk-radio/송출/.env").trim();
  console.log('\n파일 권한(600 이라야 한다):');
  권한.split(/\r?\n/).forEach((l) => console.log('   ' + l));
  console.log('\n⏳ 남은 것 = 팩(곡) · YOUTUBE_STREAM_KEY\n');
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
