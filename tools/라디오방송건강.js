#!/usr/bin/env node
/**
 * 유튜브가 «받는 쪽»에서 본 방송 상태 (2026-09-08 · 1유닛).
 *
 * ■ 왜 있나
 *   09-08 새벽에 **서버 쪽 수가 전부 초록인데 유튜브는 40분 넘게 아무것도 못 받고 있었다.**
 *   우리가 세던 것은 전부 «우리 쪽»이다 — 층이 몇 장 떴나, 파이프에 몇 장 넣었나.
 *   받는 쪽이 사라져도 그 수는 그대로 늘어난다. 그래서 **밖에서 재는 자**가 따로 있어야 한다.
 *
 * ■ 읽는 법
 *   받는 중? active   = 유튜브가 지금 그림을 받고 있다   · inactive = 아무것도 안 온다
 *   건강     good     = 문제 없음 · ok/bad/noData 는 그 아래 줄에 까닭이 붙는다
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
})().catch((e) => { console.error('🔴', e.message); process.exit(1); });
