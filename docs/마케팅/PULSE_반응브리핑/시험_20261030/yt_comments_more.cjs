'use strict';
// 여성 쪽 튄 편 댓글을 더 모은다(읽기만, 쓴 사람 저장 안 함). node yt_comments_more.cjs <데이터 폴더>
const fs = require('node:fs'), path = require('node:path');
const { lab토큰 } = require('C:/Users/q1212/Documents/SYNK-appsscript/tools/수요스캔/수요수집.js');
const OUT = process.argv[2];
const cands = JSON.parse(fs.readFileSync(path.join(OUT, 'candidates.json'), 'utf8'));
const men = /남자|남성|남친|남편|아빠|men\b|man\b/i;
const women = cands.filter(v => !men.test((v.제목 || '') + ' ' + (v.채널 || '')));
const have = new Set(fs.readdirSync(path.join(OUT, 'comments')).map(f => f.replace(/\.json$/, '')));
const pick = [...women.filter(v => v.튄편).sort((a, b) => (b.배수 || 0) - (a.배수 || 0)).slice(0, 45), ...[...women].sort((a, b) => b.조회 - a.조회).slice(0, 12)];
const mask = t => String(t || '').replace(/\S+@\S+\.\S+/g, '[메일]').replace(/https?:\/\/\S+/g, '[링크]').replace(/@[\w가-힣._-]+/g, '@[언급]').replace(/\d{2,3}-\d{3,4}-\d{4}/g, '[전화]');
(async () => {
  const token = await lab토큰(); let n = 0, got = 0;
  for (const v of pick) {
    if (have.has(v.id)) continue; have.add(v.id);
    const u = 'https://www.googleapis.com/youtube/v3/commentThreads?' + new URLSearchParams({ part: 'snippet', videoId: v.id, order: 'relevance', maxResults: 100, textFormat: 'plainText' });
    const r = await fetch(u, { headers: { Authorization: 'Bearer ' + token } }); n++;
    if (!r.ok) continue;
    const b = await r.json();
    const rows = (b.items || []).map(t => t.snippet?.topLevelComment?.snippet).filter(Boolean).map(s => ({ 글: mask(s.textDisplay).slice(0, 400), 좋아요: Number(s.likeCount || 0), 주인: s.authorChannelId?.value === v.채널id }));
    got += rows.length;
    fs.writeFileSync(path.join(OUT, 'comments', v.id + '.json'), JSON.stringify({ id: v.id, 제목: v.제목, 조회: v.조회, 배수: v.배수, 댓글: rows }, null, 1));
  }
  console.log(`부름 ${n} · 새 댓글 ${got}`);
})().catch(e => { console.error(e.message); process.exit(1); });
