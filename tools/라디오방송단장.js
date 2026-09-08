#!/usr/bin/env node
/**
 * 도는 라디오 방송의 «겉모습»을 채운다 — 미리보기 그림 · 분류 · 꼬리표.
 *
 * ■ 왜 있나
 *   09-08 낮에 방송을 공개로 바꾸고 나서 보니, 남이 보는 쪽이 비어 있었다.
 *   미리보기 그림이 «지금 화면을 자동으로 찍은 것»이었고(구운 표지가 따로 있는데도),
 *   분류는 「엔터테인먼트」였고, 꼬리표는 0개였다. 셋 다 사람이 이 방송을 «찾는» 통로다.
 *
 * ■ 밟는 함정 하나
 *   🔴 `videos.update` 는 **part 에 넣은 칸을 통째로 갈아 끼운다.** snippet 을 부르면서
 *      제목·소개를 빼먹으면 그 둘이 지워진다. 그래서 이 도구는 «지금 값을 먼저 읽어»
 *      바꿀 칸만 덮고 나머지는 그대로 되넣는다.
 *
 * ■ 안 하는 것
 *   공개 범위는 안 만진다(그건 `라디오방송열쇠.js --공개범위` 가 쥔다).
 *
 * 쓰는 법: node tools/라디오방송단장.js [영상id]
 *          영상id 를 안 주면 지금 도는 방송 자리를 찾아 쓴다.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const 표지길 = path.join(__dirname, '..', 'docs', '라디오', '썸네일.png');
/* 간판은 `tools/lib/라디오간판.js` 한 곳이 쥔다 — 09-08 에 모았다.
   🔴 이 파일의 꼬리표가 «세 번째 사본»이었고, 09-08 에 앞의 둘만 고쳤을 때 여기만 옛 값으로
   남아 있었다(유호 지시 「공부·한국어 조건을 걷어라」). 그 갈림이 이 모아 두기를 낳았다. */
const { 분류, 꼬리표 } = require('../bots/오버레이/라디오간판.js');

const env = {};
for (const L of fs.readFileSync(path.join(os.homedir(), 'Documents', 'SYNK-talk', '.env'), 'utf8').split(/\r?\n/)) {
  const m = L.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

(async () => {
  const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.RADIO_YT_CLIENT_ID, client_secret: env.RADIO_YT_CLIENT_SECRET, refresh_token: env.RADIO_YT_REFRESH_TOKEN, grant_type: 'refresh_token' }) })).json();
  if (!t.access_token) throw new Error('유튜브 토큰 갱신 실패');
  const yt = async (방법, 길, 몸) => {
    const r = await fetch('https://www.googleapis.com/youtube/v3/' + 길, {
      method: 방법, headers: { authorization: 'Bearer ' + t.access_token, 'content-type': 'application/json' },
      body: 몸 ? JSON.stringify(몸) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`유튜브 ${방법} ${길.split('?')[0]} → ${r.status}: ${(j.error && j.error.message) || ''}`);
    return j;
  };

  let id = process.argv[2];
  if (!id) {
    const b = (await yt('GET', 'liveBroadcasts?part=id,status&broadcastStatus=active&broadcastType=all&maxResults=5')).items || [];
    if (!b.length) throw new Error('도는 방송이 없다 — node tools/라디오방송건강.js 로 먼저 본다');
    id = b[0].id;
  }
  console.log(`방송 ${id}`);

  const 지금 = ((await yt('GET', `videos?part=snippet,status&id=${id}`)).items || [])[0];
  if (!지금) throw new Error(`영상 ${id} 를 못 읽었다`);
  console.log(`  지금 분류 ${지금.snippet.categoryId} · 꼬리표 ${(지금.snippet.tags || []).length}개`);

  /* 🔴 지금 값을 통째로 되넣으면서 바꿀 칸만 덮는다 — 안 그러면 제목·소개가 지워진다. */
  const 새 = await yt('PUT', 'videos?part=snippet', {
    id,
    snippet: {
      title: 지금.snippet.title,
      description: 지금.snippet.description,
      categoryId: 분류,
      tags: 꼬리표,
      defaultLanguage: 지금.snippet.defaultLanguage || 'ko',
    },
  });
  console.log(`  ✅ 분류 ${새.snippet.categoryId} · 꼬리표 ${(새.snippet.tags || []).length}개`);

  if (!fs.existsSync(표지길)) { console.log(`  ⚠ 표지 그림이 없다: ${표지길}`); return; }
  const 그림 = fs.readFileSync(표지길);
  console.log(`  표지를 올린다 (${(그림.length / 1024 / 1024).toFixed(2)}MB)`);
  const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${id}&uploadType=media`, {
    method: 'POST', headers: { authorization: 'Bearer ' + t.access_token, 'content-type': 'image/png' }, body: 그림,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.log(`  ⚠ 표지 올리기 실패 ${r.status}: ${(j.error && j.error.message) || ''}`);
    console.log('     (채널이 «확인된 계정»이 아니면 막힌다 — 그때는 유호님이 스튜디오에서 한 번 올리신다)');
    return;
  }
  console.log(`  ✅ 표지 올렸다 · ${(j.items && j.items[0] && j.items[0].high && j.items[0].high.url) || ''}`);
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
