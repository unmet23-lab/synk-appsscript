'use strict';
/* 업종 반응 브리핑 시험(10-30) — 여성 의류 · 겨울 아우터 쇼츠의 「평소보다 튄 편」과 상위 댓글을 YouTube Data API로 모은다.
 * 읽기만 한다(LAB YouTube 자격, 수요 스캔과 같은 길). 댓글은 본문·좋아요만, 쓴 사람은 저장하지 않는다.
 *   node yt_collect.cjs <데이터 폴더>
 */
const fs = require('node:fs');
const path = require('node:path');
const REPO = 'C:/Users/q1212/Documents/SYNK-appsscript';
const { lab토큰 } = require(path.join(REPO, 'tools/수요스캔/수요수집.js'));

const OUT = process.argv[2];
if (!OUT) { console.error('데이터 폴더를 주세요'); process.exit(2); }
const API = 'https://www.googleapis.com/youtube/v3/';
const KEYWORDS = [
  '겨울 코트 코디', '숏패딩 코디', '롱패딩 추천', '겨울 아우터 추천', '키작녀 코트', '체형별 코트',
  '무스탕 코디', '패딩 추천 여자', '겨울 데일리룩', '코트 추천', '겨울 하울', '출근룩 겨울',
];
const PUBLISHED_AFTER = '2026-09-15T00:00:00Z';
const SHORTS_MAX_SEC = 181;          // Data API 길이는 1초 올림(현장 노트)
const MIN_VIEWS = 10000;             // 후보 최소 조회
const RULE = { 배수: 3, 기준편수: 30, 최소편수: 5, 작은채널구독상한: 30000 };
const COMMENT_VIDEOS = 24;

let token = null; let units = 0;
const log = fs.createWriteStream(path.join(OUT, 'log.jsonl'), { flags: 'a' });
const note = o => log.write(JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n');
const save = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 1));

async function call(resource, params, cost = 1) {
  if (!token) token = await lab토큰();
  const url = API + resource + '?' + new URLSearchParams(params);
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    units += cost;
    if (r.status === 401 && attempt === 0) { token = await lab토큰(); continue; }
    const body = await r.json().catch(() => ({}));
    note({ resource, status: r.status, cost, q: params.q || params.id?.slice(0, 40) || params.playlistId || params.videoId });
    if (!r.ok) {
      const reason = body?.error?.errors?.[0]?.reason || body?.error?.message || r.status;
      const err = new Error(String(reason)); err.status = r.status; err.reason = reason; throw err;
    }
    return body;
  }
}

const iso = s => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || ''); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : null; };
const num = v => (v === undefined || v === null || v === '' ? null : Number(v));
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mask = t => String(t || '').replace(/\S+@\S+\.\S+/g, '[메일]').replace(/https?:\/\/\S+/g, '[링크]').replace(/@[\w가-힣._-]+/g, '@[언급]').replace(/\d{2,3}-\d{3,4}-\d{4}/g, '[전화]');

async function videosDetail(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const b = await call('videos', { part: 'snippet,statistics,contentDetails', id: ids.slice(i, i + 50).join(','), maxResults: 50 });
    for (const v of b.items || []) {
      out[v.id] = {
        id: v.id, 제목: v.snippet?.title, 채널id: v.snippet?.channelId, 채널: v.snippet?.channelTitle,
        올린때: v.snippet?.publishedAt, 길이: iso(v.contentDetails?.duration),
        조회: num(v.statistics?.viewCount), 좋아요: num(v.statistics?.likeCount), 댓글수: num(v.statistics?.commentCount),
        태그: (v.snippet?.tags || []).slice(0, 15), 설명: (v.snippet?.description || '').slice(0, 300),
      };
    }
  }
  return out;
}

async function main() {
  // 1) 검색
  const found = new Map();
  for (const q of KEYWORDS) {
    try {
      const b = await call('search', { part: 'snippet', type: 'video', q, regionCode: 'KR', relevanceLanguage: 'ko', videoDuration: 'short', publishedAfter: PUBLISHED_AFTER, order: 'viewCount', maxResults: 50 }, 100);
      for (const it of b.items || []) {
        const id = it.id?.videoId; if (!id) continue;
        if (!found.has(id)) found.set(id, { id, 검색어: [] });
        found.get(id).검색어.push(q);
      }
      console.log(`검색 ${q}: ${b.items?.length || 0}`);
    } catch (e) { console.log(`검색 실패 ${q}: ${e.reason}`); if (/quota/i.test(String(e.reason))) break; }
  }
  save('search.json', [...found.values()]);

  // 2) 영상 숫자
  const det = await videosDetail([...found.keys()]);
  const cands = Object.values(det).filter(v => v.길이 !== null && v.길이 <= SHORTS_MAX_SEC && (v.조회 || 0) >= MIN_VIEWS);
  for (const v of cands) v.검색어 = found.get(v.id).검색어;
  console.log(`영상 ${Object.keys(det).length} · 쇼츠·최소조회 통과 ${cands.length}`);

  // 3) 채널 구독·기준선(쇼츠 목록 최근 30편 중앙값)
  const chIds = [...new Set(cands.map(v => v.채널id))];
  const ch = {};
  for (let i = 0; i < chIds.length; i += 50) {
    const b = await call('channels', { part: 'snippet,statistics', id: chIds.slice(i, i + 50).join(',') });
    for (const c of b.items || []) ch[c.id] = { id: c.id, 이름: c.snippet?.title, 핸들: c.snippet?.customUrl, 구독: c.statistics?.hiddenSubscriberCount ? null : num(c.statistics?.subscriberCount) };
  }
  for (const id of chIds) {
    const c = ch[id] || (ch[id] = { id });
    try {
      const b = await call('playlistItems', { part: 'contentDetails', playlistId: 'UUSH' + id.slice(2), maxResults: RULE.기준편수 });
      c.쇼츠목록 = (b.items || []).map(x => x.contentDetails?.videoId).filter(Boolean);
    } catch (e) { c.쇼츠목록 = []; c.기준선오류 = String(e.reason); }
  }
  const needIds = [...new Set(Object.values(ch).flatMap(c => c.쇼츠목록 || []))].filter(id => !det[id]);
  Object.assign(det, await videosDetail(needIds));
  for (const c of Object.values(ch)) {
    const views = (c.쇼츠목록 || []).map(id => det[id]?.조회).filter(Number.isFinite);
    c.기준편수 = views.length; c.중앙값 = views.length >= RULE.최소편수 ? median(views) : null;
    delete c.쇼츠목록;
  }
  save('channels.json', ch);

  // 4) 튄 편 판정(수요 스캔과 같은 꼴: 평소 중앙값 3배 이상, 또는 구독 3만 이하 채널에서 조회 ≥ 구독)
  for (const v of cands) {
    const c = ch[v.채널id] || {};
    v.구독 = c.구독 ?? null; v.평소 = c.중앙값 ?? null; v.기준편수 = c.기준편수 || 0;
    v.배수 = v.평소 > 0 ? Math.round((v.조회 / v.평소) * 100) / 100 : null;
    const A = v.배수 !== null && v.배수 >= RULE.배수;
    const B = Number.isFinite(v.구독) && v.구독 <= RULE.작은채널구독상한 && v.조회 >= Math.max(v.구독, MIN_VIEWS);
    v.튄편 = A || B; v.튄까닭 = A ? '평소 3배+' : (B ? '작은 채널 조회≥구독' : '');
    v.참여율 = v.조회 ? Math.round(((v.좋아요 || 0) + (v.댓글수 || 0)) / v.조회 * 10000) / 100 : null;
  }
  cands.sort((a, b) => (b.튄편 - a.튄편) || ((b.배수 || 0) - (a.배수 || 0)) || (b.조회 - a.조회));
  save('candidates.json', cands);
  const spikes = cands.filter(v => v.튄편);
  console.log(`튄 편 ${spikes.length}`);

  // 5) 상위 댓글 — 튄 편(배수 순) 먼저, 모자라면 조회 순
  const pick = [...spikes];
  for (const v of [...cands].sort((a, b) => b.조회 - a.조회)) { if (pick.length >= COMMENT_VIDEOS) break; if (!pick.includes(v)) pick.push(v); }
  for (const v of pick.slice(0, COMMENT_VIDEOS)) {
    try {
      const b = await call('commentThreads', { part: 'snippet', videoId: v.id, order: 'relevance', maxResults: 100, textFormat: 'plainText' });
      const rows = (b.items || []).map(t => t.snippet?.topLevelComment?.snippet).filter(Boolean)
        .map(s => ({ 글: mask(s.textDisplay).slice(0, 400), 좋아요: num(s.likeCount), 주인: s.authorChannelId?.value === v.채널id }));
      fs.writeFileSync(path.join(OUT, 'comments', v.id + '.json'), JSON.stringify({ id: v.id, 제목: v.제목, 조회: v.조회, 배수: v.배수, 댓글: rows }, null, 1));
    } catch (e) { note({ comments: v.id, err: String(e.reason) }); }
  }
  console.log(`끝 · 쓴 단위 약 ${units}`);
}
main().catch(e => { console.error('멈춤:', e.message); process.exit(1); });
