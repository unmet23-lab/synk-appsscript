'use strict';
// LAB TOPIK 관용구 퀴즈 · 게시 숫자 읽기(읽기만 — 게시·수정·댓글을 하지 않는다. 자격 값은 출력하지 않는다).
// 쓰는 법: node 숫자재기.cjs [유튜브 영상 id …]   (기본: 10-13 키즈판 -sLV-OAim3k)
// YouTube Data API 공개 숫자(조회·좋아요·댓글)와, 자격에 분석 권한이 있으면 YouTube Analytics(평균 시청 시간·평균 본 비율·공유)를 JSON으로 찍는다.
// 인스타·페이스북 숫자는 API 자격이 없어 Business Suite 화면에서 읽는다(기획.md 「게시」).
const path = require('node:path');
const publisher = require(path.resolve(__dirname, '../../../../tools/lib/sns-publisher.js'));

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['-sLV-OAim3k'];
const kst = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);

(async () => {
  const credential = publisher.readCredential('lab-youtube', { allowLegacy: true });
  const token = await publisher.googleAccessToken(credential);
  const auth = { headers: { authorization: `Bearer ${token.accessToken}` } };
  const out = { at: new Date().toISOString(), videos: [] };
  for (const id of ids) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,status,snippet&id=${encodeURIComponent(id)}`, auth);
    const body = await r.json();
    if (!r.ok) throw new Error(`videos ${r.status}: ${body.error?.message || ''}`);
    const v = (body.items || [])[0];
    if (!v) { out.videos.push({ id, error: '찾지 못함' }); continue; }
    const s = v.statistics || {};
    const row = {
      id,
      privacy: v.status.privacyStatus,
      publishedAt: v.snippet.publishedAt,
      views: Number(s.viewCount || 0),
      likes: Number(s.likeCount || 0),
      comments: Number(s.commentCount || 0),
    };
    // 분석은 하루쯤 늦게 채워진다. 권한이 없으면(403) 이유만 적고 넘어간다.
    const q = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: v.snippet.publishedAt.slice(0, 10),
      endDate: kst(new Date()),
      metrics: 'views,averageViewDuration,averageViewPercentage,shares,subscribersGained',
      filters: `video==${id}`,
    });
    const a = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${q}`, auth);
    const ab = await a.json().catch(() => ({}));
    if (a.ok && ab.rows && ab.rows[0]) {
      const [views, avgSec, avgPct, shares, subs] = ab.rows[0];
      row.analytics = { views, averageViewDurationSec: avgSec, averageViewPercentage: avgPct, shares, subscribersGained: subs };
    } else {
      row.analytics = { unavailable: a.ok ? '아직 집계 없음' : `${a.status} ${ab.error?.status || ''}`.trim() };
    }
    out.videos.push(row);
  }
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
