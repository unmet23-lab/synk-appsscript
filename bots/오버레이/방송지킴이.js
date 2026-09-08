#!/usr/bin/env node
/**
 * 「트는 자리」가 죽으면 스스로 다시 연다 — 서버에서 크론이 5분마다 부른다.
 *
 * ■ 왜 있나 (09-08 낮 실측)
 *   유튜브는 «받는 곳»(liveStream)과 «트는 곳»(liveBroadcast)이 따로다. 받는 곳은 트는 곳이 끝나도
 *   열쇠만 맞으면 계속 받아 준다. 그래서 09-08 새벽에 **트는 곳이 죽은 채 5시간 40분**을 밀었고,
 *   서버 쪽 수도 유튜브의 스트림 건강도 그 내내 초록이었다.
 *   되살리는 손이 유호님 노트북에만 있으면 노트북을 끄는 순간 그 구멍이 다시 열린다.
 *   그래서 되살리기를 **서버 안으로** 옮긴다.
 *
 * ■ 안 하는 것 · 스스로 막는 것
 *   · 🔴 받는 곳이 `active` 가 아니면 **아무것도 안 만든다.** 그림이 안 들어오는데 자리를 열면 그것도 죽는다.
 *     그때 고칠 것은 송출이지 방송 자리가 아니다.
 *   · 🔴 **하루 네 번까지만** 연다(`한도`). 뭔가 근본이 틀어졌을 때 자리를 수백 개 만들어 채널을 어지르지 않는다.
 *   · 열쇠(.env)는 읽기만 한다. 값은 어디에도 안 찍는다.
 *
 * ■ 여는 자리의 값
 *   공개로 연다 — 유호님이 09-08 에 「공개로 바꿔줘」로 정하셨고(결정 원장), 되살리기는 그 결정을
 *   이어 하는 것이지 새로 정하는 것이 아니다. 표지·분류·찾는 낱말도 같이 넣어 겉모습을 맞춘다.
 *   ⚠ 새 자리는 **주소가 바뀐다.** 안 바뀌는 주소는 https://www.youtube.com/@synkkorean/live 이고,
 *      그 주소가 늘 «지금 도는 자리»로 데려간다. 남에게 줄 때는 이쪽을 준다.
 *
 * 쓰는 법(서버):  node /opt/synk-radio/지면/bots/오버레이/방송지킴이.js
 *                 크론 = 5분마다 · 일지는 /opt/synk-radio/방송지킴이.log
 */
'use strict';
const fs = require('fs');
const path = require('path');

const 환경길 = process.env.RADIO_ENV || '/opt/synk-radio/송출/.env';
const 장부길 = process.env.RADIO_GUARD_STATE || '/opt/synk-radio/방송지킴이.json';
const 표지길 = process.env.RADIO_THUMB || '/opt/synk-radio/무대덮개/썸네일.png';
const 한도 = 4;

/* 간판(제목·소개·분류·꼬리표)은 `./라디오간판.js` 한 곳이 쥔다 — 09-08 에 세 곳에서 모았다.
 * 🔴 간판이 «이 폴더 안»에 사는 까닭 = 서버로 올라가는 것이 bots 뿐이다.
 *   09-08 실측 — /opt/synk-radio/지면/ 아래에는 bots 와 docs 뿐이고 tools 가 아예 없다.
 *   한때 tools/lib 에 두고 ../../ 로 읽게 했는데, 그대로 올렸으면 이 봇이 그 자리에서 죽었다. */
const { 방송제목, 방송소개, 분류, 꼬리표 } = require('./라디오간판.js');

const 이제 = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const 말 = (...것) => console.log(`[방송지킴이 ${이제()}]`, ...것);

function 환경읽기() {
  const 표 = {};
  for (const L of fs.readFileSync(환경길, 'utf8').split(/\r?\n/)) {
    const m = L.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) 표[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return 표;
}

/* 오늘 몇 번 열었나. 날짜가 바뀌면 0 부터 다시 센다. */
function 장부읽기() {
  try {
    const j = JSON.parse(fs.readFileSync(장부길, 'utf8'));
    if (j.날 === new Date().toISOString().slice(0, 10)) return j;
  } catch (e) { /* 없으면 새로 */ }
  return { 날: new Date().toISOString().slice(0, 10), 연것: 0, 자리들: [] };
}

(async () => {
  const env = 환경읽기();
  if (!env.RADIO_YT_REFRESH_TOKEN) { 말('🔴 유튜브 자격이 .env 에 없다 — 아무것도 안 한다'); return; }

  const t = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.RADIO_YT_CLIENT_ID, client_secret: env.RADIO_YT_CLIENT_SECRET, refresh_token: env.RADIO_YT_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  })).json();
  if (!t.access_token) { 말('🔴 유튜브 토큰 갱신 실패 — 아무것도 안 한다'); return; }

  const yt = async (방법, 길, 몸) => {
    const r = await fetch('https://www.googleapis.com/youtube/v3/' + 길, {
      method: 방법, headers: { authorization: 'Bearer ' + t.access_token, 'content-type': 'application/json' },
      body: 몸 ? JSON.stringify(몸) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${방법} ${길.split('?')[0]} → ${r.status}: ${(j.error && j.error.message) || ''}`);
    return j;
  };

  /* ① 트는 자리가 살아 있나 — 이것 하나가 이 도구의 존재 이유다. */
  const 도는것 = (await yt('GET', 'liveBroadcasts?part=id,status&broadcastStatus=active&broadcastType=all&maxResults=5')).items || [];
  if (도는것.length) { 말(`🟢 ${도는것[0].id} 가 돌고 있다`); return; }

  /* ② 아직 안 튼 자리(testing 등)가 있으면 새로 만들지 말고 그것을 올린다. */
  const 안끝난 = ((await yt('GET', 'liveBroadcasts?part=id,status&broadcastStatus=upcoming&broadcastType=all&maxResults=5')).items || [])
    .filter((b) => ['ready', 'created', 'testing', 'testStarting'].includes(b.status && b.status.lifeCycleStatus));

  /* ③ 받는 곳이 안 살아 있으면 자리를 열어도 또 죽는다 — 손대지 않는다. */
  const 스트림들 = (await yt('GET', 'liveStreams?part=id,snippet,status&mine=true&maxResults=25')).items || [];
  const 스트림 = 스트림들.find((x) => x.status && x.status.streamStatus === 'active');
  if (!스트림) {
    말(`🔴 트는 자리 0개 · 그런데 받는 곳도 안 산다(${스트림들.map((x) => x.status && x.status.streamStatus).join(',') || '스트림 없음'}) — 고칠 것은 송출이다. 자리는 안 연다`);
    return;
  }

  const 장부 = 장부읽기();
  if (장부.연것 >= 한도) { 말(`🔴 트는 자리 0개 · 그런데 오늘 이미 ${장부.연것}번 열었다(한도 ${한도}) — 더 안 연다. 사람이 볼 자리다`); return; }

  const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));
  const 단계보기 = async (id) => (await yt('GET', `liveBroadcasts?part=status&id=${id}`)).items?.[0]?.status?.lifeCycleStatus;

  let 자리 = 안끝난[0];
  if (자리) 말(`트는 자리 0개 · 아직 안 튼 자리 ${자리.id}(${자리.status.lifeCycleStatus}) 를 올린다`);
  else {
    말('🔴 트는 자리 0개 — 새로 연다');
    자리 = await yt('POST', 'liveBroadcasts?part=snippet,status,contentDetails', {
      snippet: { title: 방송제목, description: 방송소개, scheduledStartTime: new Date(Date.now() + 60000).toISOString() },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
      /* 🔴 «중단 시 자동 종료»를 켜면 잠깐 끊길 때마다 자리가 죽는다. */
      contentDetails: { enableAutoStart: false, enableAutoStop: false, enableDvr: true, latencyPreference: 'normal' },
    });
    말(`   만들었다 ${자리.id}`);
    await yt('POST', `liveBroadcasts/bind?id=${자리.id}&part=id,contentDetails&streamId=${스트림.id}`);
    말('   지금 스트림에 묶었다');
  }

  let 지금 = await 단계보기(자리.id);
  if (지금 === 'ready' || 지금 === 'created') {
    await yt('POST', `liveBroadcasts/transition?id=${자리.id}&broadcastStatus=testing&part=id,status`);
    지금 = await 단계보기(자리.id);
  }
  for (let k = 0; k < 12 && 지금 !== 'testing'; k++) { await 잠깐(5000); 지금 = await 단계보기(자리.id); }
  await yt('POST', `liveBroadcasts/transition?id=${자리.id}&broadcastStatus=live&part=id,status`);
  await 잠깐(5000);
  지금 = await 단계보기(자리.id);
  말(`   단계 ${지금}`);

  /* ④ 겉모습 — 표지·분류·찾는 낱말. 실패해도 방송은 이미 돌고 있으니 그냥 적고 넘어간다. */
  try {
    const v = ((await yt('GET', `videos?part=snippet&id=${자리.id}`)).items || [])[0];
    if (v) {
      await yt('PUT', 'videos?part=snippet', {
        id: 자리.id,
        snippet: { title: v.snippet.title, description: v.snippet.description, categoryId: 분류, tags: 꼬리표, defaultLanguage: 'ko' },
      });
    }
    if (fs.existsSync(표지길)) {
      const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${자리.id}&uploadType=media`, {
        method: 'POST', headers: { authorization: 'Bearer ' + t.access_token, 'content-type': 'image/png' }, body: fs.readFileSync(표지길),
      });
      말(`   표지 ${r.ok ? '올렸다' : '못 올렸다 ' + r.status}`);
    } else 말(`   ⚠ 표지 그림이 없다: ${표지길}`);
  } catch (e) { 말(`   ⚠ 겉모습 채우기 실패(방송은 돈다): ${e.message}`); }

  장부.연것 += 1;
  장부.자리들.push({ 때: 이제(), id: 자리.id, 단계: 지금 });
  fs.writeFileSync(장부길, JSON.stringify(장부, null, 2));
  말(`✅ ${자리.id} 를 열었다 (오늘 ${장부.연것}/${한도}) · 안 바뀌는 주소 = https://www.youtube.com/@synkkorean/live`);
})().catch((e) => { 말(`🔴 넘어졌다: ${e.message}`); process.exit(1); });
