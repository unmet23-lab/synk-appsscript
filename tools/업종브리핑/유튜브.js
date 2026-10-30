'use strict';
/**
 * 업종 반응 브리핑 · 유튜브 갈래 — 검색어로 기간 안 쇼츠를 찾고, 채널 평소 조회로 튄 편을 고르고, 상위 댓글을 받는다.
 * YouTube Data API만 쓴다(수요 스캔의 API부르개 — 호출 기록·한도 멈춤, LAB YouTube 자격, 읽기만). search는 한 번에 100단위라 검색어 수가 곧 몫이다.
 * 튄 편 판정은 수요 스캔과 같다(평소 = 그 채널 최근 쇼츠 30편 조회 중앙값, 3배 이상 / 구독 3만 이하 채널은 조회 ≥ 구독).
 * 댓글은 본문·좋아요·채널 주인 여부만 남기고 쓴 사람은 저장하지 않는다(메일·링크·@언급·전화 꼴은 가린다).
 */
const { median, multiple } = require('../lib/평소배수.js');

const 규칙 = Object.freeze({ 배수: 3, 기준편수: 30, 최소편수: 5, 작은채널구독상한: 30000, 쇼츠상한초: 181 });

const 가리기 = (t) => String(t || '')
  .replace(/\S+@\S+\.\S+/g, '[메일]').replace(/https?:\/\/\S+/g, '[링크]')
  .replace(/@[\w가-힣._-]+/g, '@[언급]').replace(/\d{2,3}-\d{3,4}-\d{4}/g, '[전화]');

/** 그 편이 튄 편인지 — {배수, 튄편, 까닭} */
function 튄편판정({ 조회, 구독, 평소 }, 최소조회) {
  const 배수 = multiple(조회, 평소);
  const A = 배수 !== null && 배수 >= 규칙.배수 && 조회 >= 최소조회;
  const B = Number.isFinite(구독) && 구독 >= 0 && 구독 <= 규칙.작은채널구독상한 && 조회 >= Math.max(구독, 최소조회);
  return { 배수, 튄편: A || B, 까닭: A ? '평소 3배 이상' : (B ? '작은 채널 조회 ≥ 구독' : '') };
}

function 제외인가(v, 낱말) {
  if (!낱말?.length) return false;
  const 글 = `${v.제목 || ''} ${v.채널이름 || ''}`;
  return 낱말.some((w) => 글.includes(w));
}

/** 검색 비용 어림(돌리기 전에 보인다): 검색어 × 100 + 채널·영상·댓글 몫 */
function 단위어림(설정, 검색캐시 = {}) {
  const Y = 설정.유튜브;
  const 새검색 = Y.검색어.filter((q) => !검색캐시[q]).length;
  return 새검색 * 100 + 160 + (Y.댓글영상 || 50);
}

/**
 * 설정.유튜브 → {상태, 검색, 후보[], 댓글: {id: [{글, 좋아요, 주인}]}, 단위, 기록}
 * 부르개: tools/수요스캔/수요수집.js의 API부르개(시험에서는 가짜)
 * 검색캐시: {검색어: [영상id]} — 같은 날 다시 돌릴 때 search(100단위)를 다시 부르지 않게 넘겨받아 채운다.
 */
async function 모으기(설정, { 부르개, 시작일, 검색캐시 = {}, 알림 = () => {} }) {
  const Y = 설정.유튜브;
  const 결과 = { 상태: '됨', 시작일, 검색: [], 후보: [], 댓글: {}, 못읽음: [], 검색어수: Y.검색어.length };
  let 단위 = 0;
  const 찾은 = new Map();
  for (const q of Y.검색어) {
    let ids = 검색캐시[q];
    if (!ids) {
      const r = await 부르개.부르기('search', { part: 'snippet', type: 'video', q, regionCode: 'KR', relevanceLanguage: 'ko', videoDuration: 'short', publishedAfter: `${시작일}T00:00:00Z`, order: 'viewCount', maxResults: '50' }, q);
      단위 += 100;
      if (r.상태 !== '됨') { 결과.못읽음.push({ 검색어: q, 오류: r.오류 }); if (r.상태 === '멈춤') break; continue; }
      ids = (r.몸.items || []).map((it) => it.id?.videoId).filter(Boolean);
      검색캐시[q] = ids;
    }
    결과.검색.push({ 검색어: q, 편수: ids.length });
    for (const id of ids) { if (!찾은.has(id)) 찾은.set(id, []); 찾은.get(id).push(q); }
    알림(`검색 ${q}: ${ids.length}편`);
  }
  // 검색이 도중에 멈추면 돈 검색어만으로 셈한다 — 페이지에 「검색어 N개 가운데 M개」를 적는다
  결과.읽은검색어수 = 결과.검색.length;
  if (!찾은.size) return { ...결과, 상태: '못 읽음', 까닭: 결과.못읽음.map((x) => x.오류).join(' · ') || '검색 결과 없음', 단위 };

  const 상세 = await 부르개.영상들([...찾은.keys()]);
  단위 += Math.ceil(찾은.size / 50);
  const 후보 = [...상세.상세.values()].filter((v) => Number.isFinite(v.길이) && v.길이 <= 규칙.쇼츠상한초 && (v.조회 || 0) >= Y.최소조회 && !제외인가(v, Y.제외낱말));

  const 채널ids = [...new Set(후보.map((v) => v.채널id).filter(Boolean))];
  await 부르개.채널들(채널ids);
  단위 += Math.ceil(채널ids.length / 50);
  // 채널 최근 쇼츠 30편의 조회 — 평소는 그 편을 뺀 나머지의 중앙값(뜨는원본.js와 같은 꼴, 튄 편이 자기 기준을 끌어올리지 않게)
  const 채널조회 = new Map();
  for (const ch of 채널ids) {
    const 목록 = await 부르개.쇼츠목록(ch, 규칙.기준편수);
    단위 += 1;
    if (목록.상태 !== '됨') { 채널조회.set(ch, []); continue; }
    const 숫자 = await 부르개.영상들(목록.ids);
    단위 += Math.ceil(목록.ids.length / 50);
    채널조회.set(ch, 목록.ids.map((id) => ({ id, 조회: 숫자.상세.get(id)?.조회 })).filter((x) => Number.isFinite(x.조회)));
  }
  const 평소구하기 = (ch, 그편) => {
    const 나머지 = (채널조회.get(ch) || []).filter((x) => x.id !== 그편).map((x) => x.조회);
    return { 중앙값: 나머지.length >= 규칙.최소편수 ? median(나머지) : null, 편수: 나머지.length };
  };
  for (const v of 후보) {
    const 채널 = 부르개.채널칸.get(v.채널id) || {};
    const 기준 = 평소구하기(v.채널id, v.id);
    const 판 = 튄편판정({ 조회: v.조회, 구독: 채널.구독 ?? null, 평소: 기준.중앙값 ?? null }, Y.최소조회);
    결과.후보.push({
      id: v.id, 제목: v.제목, 설명: (v.설명 || '').slice(0, 160), 채널id: v.채널id, 채널: v.채널이름, 구독: 채널.구독 ?? null,
      조회: v.조회, 좋아요: v.좋아요, 댓글수: v.댓글수, 길이: v.길이, 올린날: v.날짜, 평소: 기준.중앙값 ?? null, 평소편수: 기준.편수 || 0,
      배수: 판.배수, 튄편: 판.튄편, 까닭: 판.까닭, 검색어: 찾은.get(v.id) || [],
    });
  }
  결과.후보.sort((a, b) => (b.튄편 - a.튄편) || ((b.배수 || 0) - (a.배수 || 0)) || (b.조회 - a.조회));

  // 댓글: 튄 편(배수 순) 먼저, 모자라면 조회 순 — 몫은 1단위씩
  const 고른 = [];
  for (const v of 결과.후보.filter((x) => x.튄편)) if (고른.length < Y.댓글영상) 고른.push(v);
  for (const v of [...결과.후보].sort((a, b) => b.조회 - a.조회)) if (고른.length < Y.댓글영상 && !고른.includes(v)) 고른.push(v);
  for (const v of 고른) {
    const r = await 부르개.부르기('commentThreads', { part: 'snippet', videoId: v.id, order: 'relevance', maxResults: '100', textFormat: 'plainText' }, v.id);
    단위 += 1;
    if (r.상태 === '멈춤') break;
    if (r.상태 !== '됨') continue;
    결과.댓글[v.id] = (r.몸.items || []).map((t) => t.snippet?.topLevelComment?.snippet).filter(Boolean)
      .map((s) => ({ 글: 가리기(s.textDisplay).slice(0, 400), 좋아요: Number(s.likeCount || 0), 주인: s.authorChannelId?.value === v.채널id }));
  }
  알림(`후보 ${결과.후보.length}편 · 튄 편 ${결과.후보.filter((x) => x.튄편).length}편 · 댓글 ${Object.keys(결과.댓글).length}편`);
  return { ...결과, 단위 };
}

module.exports = { 규칙, 튄편판정, 제외인가, 가리기, 단위어림, 모으기 };
