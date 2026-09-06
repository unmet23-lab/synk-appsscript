#!/usr/bin/env node
/**
 * 유튜브 «방송 열쇠»(스트림 키)를 받아 서버에 넣는다.
 *
 * 🔴 자격증명 규율: 열쇠 값을 **화면에 안 찍는다**. 받아서 곧바로 서버 `.env` 로 흘려 넣고,
 *   확인은 「몇 글자인가」와 「들어갔나」로만 한다.
 *
 * 🔑 무엇을 만드나(유호 승인 09-06 「비공개로 만들어서 열쇠 받아줘」):
 *   ① `liveStream` — 열쇠가 사는 그릇. **재사용된다**(한 번 만들면 계속 쓴다).
 *   ② `liveBroadcast` — 방송 한 자리. **`private`(비공개)** 로 만든다 — 아무에게도 안 보인다.
 *   ③ 둘을 잇는다(bind).
 *
 * ⚠ 쿼터: list 1 + insert 50×2 + bind 50 = **151유닛**(하루 한도 10,000). 반복해 부르지 않는다.
 * ⚠ 이미 만들어 둔 것이 있으면 새로 만들지 않고 그것을 쓴다.
 *
 * 쓰는 법:
 *   node tools/라디오방송열쇠.js          # 지금 무엇이 있나만 본다(1유닛)
 *   node tools/라디오방송열쇠.js --받기    # 없으면 만들고, 열쇠를 서버에 넣는다
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const talk환경 = path.join(os.homedir(), 'Documents', 'SYNK-talk', '.env');
const ssh열쇠 = path.join(os.homedir(), '.ssh', 'synk_radio');
const 서버 = 'synk@34.71.111.97';
const 스트림이름 = 'SYNK 라디오24 상시';
const 방송제목 = 'SYNK 라디오24';

function 환경읽기() {
  const 표 = {};
  for (const 줄 of fs.readFileSync(talk환경, 'utf8').split(/\r?\n/)) {
    const m = 줄.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v) 표[m[1]] = v;
  }
  return 표;
}

async function 토큰(env) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.RADIO_YT_CLIENT_ID, client_secret: env.RADIO_YT_CLIENT_SECRET,
      refresh_token: env.RADIO_YT_REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error(`유튜브 토큰 갱신 실패 ${r.status}: ${j.error_description || j.error || ''}`);
  return j.access_token;
}

async function yt(tok, 방법, 길, 몸) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${길}`, {
    method: 방법,
    headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: 몸 ? JSON.stringify(몸) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`유튜브 ${방법} ${길.split('?')[0]} → ${r.status}: ${JSON.stringify(j.error?.message || j).slice(0, 300)}`);
  return j;
}

function ssh(명령, 넣을것) {
  return execFileSync('ssh', ['-i', ssh열쇠, '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=20', 서버, 명령],
    { input: 넣을것 || '', encoding: 'utf8' });
}

(async () => {
  const env = 환경읽기();
  const tok = await 토큰(env);
  const 받기 = process.argv.includes('--받기');

  // ① 이미 있는 스트림을 먼저 본다(1유닛) — 겹쳐 만들지 않는다
  const 있는것 = await yt(tok, 'GET', 'liveStreams?part=id,snippet,cdn,status&mine=true&maxResults=25');
  const 목록 = 있는것.items || [];
  console.log(`\n📡 이미 있는 스트림 ${목록.length}개`);
  for (const s of 목록) console.log(`   · ${s.snippet?.title} · ${s.status?.streamStatus} · ${s.cdn?.resolution}/${s.cdn?.frameRate}`);

  if (!받기) { console.log('\n받으려면: node tools/라디오방송열쇠.js --받기\n'); return; }

  // ② 스트림 — 있으면 쓰고 없으면 만든다
  let 스트림 = 목록.find((s) => s.snippet?.title === 스트림이름) || 목록[0];
  if (스트림) console.log(`\n① 스트림을 이미 갖고 있다: ${스트림.snippet?.title}`);
  else {
    console.log(`\n① 스트림을 만든다: ${스트림이름}`);
    스트림 = await yt(tok, 'POST', 'liveStreams?part=snippet,cdn,status', {
      snippet: { title: 스트림이름 },
      cdn: { frameRate: '30fps', ingestionType: 'rtmp', resolution: '720p' },
    });
  }
  const 열쇠 = 스트림.cdn?.ingestionInfo?.streamName;
  const 밀어넣는곳 = 스트림.cdn?.ingestionInfo?.ingestionAddress;
  if (!열쇠) throw new Error('스트림은 있는데 열쇠가 안 왔다 — 권한(youtube.force-ssl)을 의심한다');
  console.log(`   열쇠 받았다 (${열쇠.length}글자 · 값은 안 찍는다)`);
  console.log(`   밀어 넣는 곳 = ${밀어넣는곳}`);

  // ③ 비공개 방송 — 있으면 쓰고 없으면 만든다
  const 방송들 = await yt(tok, 'GET', 'liveBroadcasts?part=id,snippet,status&mine=true&maxResults=25');
  let 방송 = (방송들.items || []).find((b) => b.snippet?.title === 방송제목 && b.status?.lifeCycleStatus !== 'complete');
  if (방송) console.log(`② 방송 자리가 이미 있다: ${방송.snippet?.title} · ${방송.status?.privacyStatus} · ${방송.status?.lifeCycleStatus}`);
  else {
    console.log(`② 비공개 방송 자리를 만든다: ${방송제목}`);
    const 시작 = new Date(Date.now() + 3600 * 1000).toISOString();
    방송 = await yt(tok, 'POST', 'liveBroadcasts?part=snippet,status,contentDetails', {
      snippet: { title: 방송제목, description: 'SYNK LAB 자습 라디오. 아직 준비 중입니다.', scheduledStartTime: 시작 },
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
      contentDetails: { enableAutoStart: false, enableAutoStop: false, latencyPreference: 'normal' },
    });
    console.log(`   만들었다 · ${방송.status?.privacyStatus} · id ${방송.id}`);
  }

  // ④ 잇기
  console.log('③ 방송과 스트림을 잇는다');
  await yt(tok, 'POST', `liveBroadcasts/bind?id=${방송.id}&part=id,contentDetails&streamId=${스트림.id}`);
  console.log('   이었다');

  // ⑤ 서버에 넣기 — 값은 표준입력으로만 흐른다
  const 몸 = `YOUTUBE_STREAM_KEY=${열쇠}\nYOUTUBE_INGEST_URL=${밀어넣는곳}\n`;
  ssh('cat > /opt/synk-radio/송출/.env && chmod 600 /opt/synk-radio/송출/.env', 몸);
  const 확인 = ssh("grep -oE '^[A-Z_]+' /opt/synk-radio/송출/.env | sort").trim();
  console.log('\n④ 서버 송출 환경에 들어간 칸:');
  확인.split(/\r?\n/).forEach((n) => console.log(`   · ${n}`));

  console.log(`\n✅ 방송 자리는 **비공개**다 — 아무에게도 안 보인다.`);
  console.log(`   공개로 바꾸는 것은 유호님이 정하실 때 따로 한다(이 도구는 안 바꾼다).\n`);
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
