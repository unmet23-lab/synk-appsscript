#!/usr/bin/env node
/**
 * 유튜브가 «받는 쪽»에서 본 방송 상태 (2026-09-08 · 1유닛).
 *
 * ■ 왜 있나
 *   09-08 새벽에 **서버 쪽 수가 전부 초록인데 유튜브는 40분 넘게 아무것도 못 받고 있었다.**
 *   우리가 세던 것은 전부 «우리 쪽»이다 — 층이 몇 장 떴나, 파이프에 몇 장 넣었나.
 *   받는 쪽이 사라져도 그 수는 그대로 늘어난다. 그래서 **밖에서 재는 자**가 따로 있어야 한다.
 *
 * ■ 읽는 법 — 유튜브는 «받는 곳»과 «트는 곳»이 따로다. 둘 다 봐야 한다.
 *   ① 받는 곳(스트림): active = 그림이 들어오고 있다 · 건강 good = 화질·박자에 탈이 없다
 *   ② 트는 곳(방송 자리): 🟢 live 라야 사람이 본다 · testing 이면 아직 아무도 못 본다
 *   🔴 **①이 전부 초록인데 ②가 없을 수 있다.** 09-08 낮에 그 일이 났다 — 스트림 active·good 인 채로
 *      방송 자리는 셋 다 complete 였고, 그 상태로 **5시간 40분**을 밀었다. 받는 곳은 방송이 끝나도
 *      계속 받아 주기 때문이다. 그래서 이 도구가 ②를 같이 묻는다.
 *
 * ■ 안 하는 것
 *   `cdn` 부분을 안 부른다 — 그래야 방송 열쇠 값이 이 화면에 안 뜬다(기억 radio-stream-key-in-ps).
 *
 * 쓰는 법: node tools/라디오방송건강.js
 */
'use strict';
const fs = require('fs'); const os = require('os'); const path = require('path');
const env = {};
for (const 줄 of fs.readFileSync(path.join(os.homedir(), 'Documents', 'SYNK-talk', '.env'), 'utf8').split(/\r?\n/)) {
  const m = 줄.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
(async () => {
  const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.RADIO_YT_CLIENT_ID, client_secret: env.RADIO_YT_CLIENT_SECRET, refresh_token: env.RADIO_YT_REFRESH_TOKEN, grant_type: 'refresh_token' }) })).json();
  const yt = async (길) => (await fetch('https://www.googleapis.com/youtube/v3/' + 길, { headers: { authorization: 'Bearer ' + t.access_token } })).json();
  const s = (await yt('liveStreams?part=id,snippet,status&mine=true&maxResults=10')).items || [];
  for (const x of s) {
    const h = x.status && x.status.healthStatus;
    console.log('스트림', x.snippet.title, '| 받는 중?', x.status && x.status.streamStatus, '| 건강', h && h.status, '| 늦음(초)', h && h.lastUpdateTimeSeconds);
    for (const c of (h && h.configurationIssues) || []) console.log('   ·', c.severity, c.type, '—', c.reason, '/', c.description);
  }

  /* 🔴 09-08 낮 — 위 줄만으로는 «아무도 못 보는 방송»을 못 잡는다. 실측: 스트림은 active·good 인데
     방송 자리 셋이 전부 complete 였고, 그 상태로 5시간 40분을 밀었다. 유튜브는 «받는 곳»과 «트는 곳»이
     따로다 — 받는 곳은 방송이 끝나도 계속 받아 준다. 그래서 트는 곳을 따로 묻는다. */
  const b = (await yt('liveBroadcasts?part=id,snippet,status,contentDetails&broadcastStatus=all&broadcastType=all&maxResults=25')).items || [];
  const 살아있는 = b.filter((x) => !['complete', 'revoked'].includes(x.status && x.status.lifeCycleStatus));
  const 묶인스트림 = new Set(s.map((x) => x.id));
  console.log('');
  if (!살아있는.length) {
    console.log('🔴 트는 곳이 없다 — 살아 있는 방송 자리 0개. 스트림이 초록이어도 «아무도 못 본다».');
    console.log('   끝난 자리는 되살릴 수 없다. 되살리는 길 = node tools/라디오방송열쇠.js --다시켜기');
  }
  for (const x of 살아있는) {
    const 단계 = x.status.lifeCycleStatus;
    const 이음 = 묶인스트림.has(x.contentDetails && x.contentDetails.boundStreamId) ? '스트림에 묶임' : '🔴 스트림에 안 묶임';
    const 자 = 단계 === 'live' ? '🟢 방송 중' : `🟡 아직 안 튼다(${단계})`;
    console.log(자, x.id, '|', (x.snippet.title || '').slice(0, 32), '|', x.status.privacyStatus, '|', 이음);
  }
  for (const x of b.filter((y) => y.status.lifeCycleStatus === 'complete').slice(0, 3)) {
    const 산시간 = x.snippet.actualStartTime && x.snippet.actualEndTime
      ? Math.round((Date.parse(x.snippet.actualEndTime) - Date.parse(x.snippet.actualStartTime)) / 1000) + '초 살았다' : '켠 적 없다';
    console.log('   (끝난 자리)', x.id, '|', 산시간, '|', x.snippet.actualEndTime || '');
  }
})().catch((e) => { console.error('🔴', e.message); process.exit(1); });
