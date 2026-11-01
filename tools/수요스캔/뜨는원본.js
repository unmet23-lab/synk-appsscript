#!/usr/bin/env node
'use strict';
/* 뜨는 원본 — 최근 N일(기본 14) 안에 올라와 지금 반응이 뜨거운 쇼츠를 조회순으로 모아, 채널 평소(최근 쇼츠 조회 중앙값) 대비
 * 배수를 붙인다. 오마주 원본 고르기(docs/마케팅/기획장부/제작절차.md 「오마주」 1 · 「근거 · 틀 · 화면」)의 재료다.
 *
 * 10-29 유호님 「반응이 핫한것들을 제대로 크롤링해줘야해」. 시드 채널 증분 스캔(스캔.js)은 지난 회차 뒤 새로 튄 편만 그날 요약에 싣고
 * (10-28 yuhobuilds 새 튄 편 3편 — 하나는 GPU 꿀팁, 하나는 웹툰 예고), yt-dlp 검색은 관련순 첫 쪽이라 쇼츠가 회차마다 열 편 남짓이었다.
 * 그래서 이 도구는 ① YouTube Data API search.list를 조회순(order=viewCount) · 최근 N일 · 4분 이하로 갈래(AI 활용 · 1인 창업 ·
 * 업무 자동화 · LAB 영어 · LAB 몽골)마다 그 갈래의 지역 · 언어로 불러 시드 밖에서 뜬 편을 찾고(11-02 아르곤 딥리서치 시험에서 시드 밖
 * LAB 영어 원본 둘을 이 도구가 못 봤다 — 그때까지 검색이 한국 · 한국어 고정이었다), ② 스캔 누적(tools/수요스캔/누적)의 튄 편 가운데 N일 안 편을 합친 뒤,
 * ③ 채널마다 최근 쇼츠 30편 조회 중앙값(그 편은 빼고)으로 배수를 잰다. 기준은 스캔과 같다 — 튄 편 ×3 · 최소 조회,
 * 「형식만」 원본 가능 ×5 · 10만(제작 절차 「오마주」 1).
 *
 *   node tools/수요스캔/뜨는원본.js [--일수 14] [--검색 12] [--최소 5000] [--날짜 YYYY-MM-DD] [--출력 <폴더>] [--갈래 "LAB 영어,LAB 몽골"]
 *   node tools/수요스캔/뜨는원본.js --어 "AI 목소리 어색,TTS 자연스럽게" [--이름 실화] [--갈래 "LAB 영어"]   이 검색어만(설정 갈래 대신) — 실화 한 줄의
 *     「남도 겪나」 근거와 형식 원본을 찾을 때(--갈래를 주면 그 갈래의 지역 · 언어 · 최소 조회로). 결과는 뜨는원본_<이름>.md(같은 날 기본 판을 덮지 않게)
 *
 * 읽기만 한다(LAB YouTube 자격 — 값은 찍지 않는다). 검색 한 번 100단위, 영상 · 채널 묶음은 1단위 — 회차당 1,500단위 안팎.
 * 설정 「갈래」마다 몫(회차당 검색 수) · 지역 · 언어 · 최소 조회를 두고, 회차 전체는 「회차당」까지, 하루(태평양 날짜 — 한도가 풀리는 때)는
 * 이 도구 몫 「하루몫」까지만 쓴다(LAB 프로젝트 10,000단위를 업로드 · 자막 · 스캔과 나눠 쓴다). 쓴 단위는 <공용 작업본>/.tmp/수요스캔/뜨는원본_단위.json.
 * 결과: <공용 작업본>/.tmp/수요스캔/<날짜>/뜨는원본.md · 뜨는원본.json(git 밖 — 남의 제목이 들어 있다).
 * 틱톡 · 릴스는 이 도구가 못 찾는다(틱톡 검색 · 릴스 검색은 로그인 벽) — 스캔.js의 틱톡 프로필 · 릴스.js 결과를 함께 본다.
 */
const fs = require('node:fs');
const path = require('node:path');
const 수집 = require('./수요수집.js');
const { median, multiple } = require('../lib/평소배수.js');
const { 공용작업본 } = require('../lib/공용작업본.js');

const 여기 = __dirname;
// 광고 의심: 좋아요가 조회의 0.3%보다 적은 편(10-29 첫 회차 — KT 320만 회 · 좋아요 55, 현대차 13만 · 105처럼 광고비로 키운 기업 영상이 ×100~2000으로 맨 위에 섰다)
const 기본 = { 일수: 14, 최소: 5000, 튄배수: 3, 형식만배수: 5, 형식만조회: 100000, 최대길이: 181, 기준편수: 30, 광고좋아요율: 0.003, 지역: 'KR', 언어: 'ko', 하루몫: 3500, 검색뒤여유: 300 };
const 검색단위 = 100;

function 인자(argv) {
  const o = { 일수: 기본.일수, 검색: null, 최소: null, 날짜: null, 출력: null, 어: null, 이름: null, 갈래: null, 도움: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const 수 = () => { const v = Number(argv[++i]); if (!Number.isFinite(v) || v < 0) throw new Error(`${a} 뒤에 0 이상의 수`); return v; };
    if (a === '--일수') o.일수 = 수();
    else if (a === '--검색') o.검색 = 수();
    else if (a === '--최소') o.최소 = 수();
    else if (a === '--날짜') o.날짜 = argv[++i];
    else if (a === '--출력') o.출력 = argv[++i];
    else if (a === '--어') o.어 = String(argv[++i] || '').split(',').map(q => q.trim()).filter(Boolean);
    else if (a === '--갈래') o.갈래 = String(argv[++i] || '').split(',').map(q => q.trim()).filter(Boolean);
    else if (a === '--이름') o.이름 = String(argv[++i] || '').replace(/[^\w가-힣-]/g, '');
    else if (a === '--도움' || a === '-h') o.도움 = true;
    else throw new Error(`모르는 선택 ${a}`);
  }
  return o;
}

const 서울날짜 = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

/** 갈래 한 칸 → {어, 몫, 지역, 언어, 최소, 누적}. 옛 모양(검색어 배열)은 몫 없이 전부 · 설정 기본 지역 · 언어. 지역 null은 지역 제한 없이 */
function 갈래칸(값, 설정 = {}) {
  const 칸 = Array.isArray(값) ? { 어: 값 } : (값 || {});
  const 고름 = (k, 기) => (Object.prototype.hasOwnProperty.call(칸, k) ? 칸[k] : 기);
  return {
    어: 칸.어 || [], 몫: 칸.몫 ?? null,
    지역: 고름('지역', 설정.기본지역 !== undefined ? 설정.기본지역 : 기본.지역) || null,
    언어: 고름('언어', 설정.기본언어 !== undefined ? 설정.기본언어 : 기본.언어) || null,
    최소: 칸.최소 ?? null, 누적: 칸.누적 || [],
  };
}

/** 설정 「갈래」의 검색어를 갈래마다 몫까지 잘라 번갈아 한 줄로 — 앞에서 수만큼(갈래 하나가 회차를 다 쓰지 않게, 회차가 모자라면 갈래마다 고르게 빠진다) */
function 검색차례(갈래, 수, 설정 = {}) {
  const 줄 = Object.entries(갈래 || {}).map(([이름, 값]) => {
    const { 어, 몫, 지역, 언어, 최소 } = 갈래칸(값, 설정);
    return (몫 == null ? 어 : 어.slice(0, 몫)).map(q => ({ 갈래: 이름, q, 지역, 언어, 최소 }));
  });
  const 섞음 = [];
  for (let i = 0; 줄.some(l => i < l.length); i += 1) for (const l of 줄) if (i < l.length) 섞음.push(l[i]);
  return 수 == null ? 섞음 : 섞음.slice(0, 수);
}

/** search.list 인자 — 지역이 없으면 regionCode를 빼고(지역 제한 없이), 언어가 없으면 relevanceLanguage를 뺀다 */
function 검색값({ q, 지역, 언어 }, publishedAfter) {
  const 값 = { part: 'snippet', type: 'video', videoDuration: 'short', order: 'viewCount', publishedAfter, maxResults: '50', q };
  if (지역) 값.regionCode = 지역;
  if (언어) 값.relevanceLanguage = 언어;
  return 값;
}

/** 태평양 날짜 — YouTube Data API 하루 한도가 풀리는 날 기준 */
const 태평양날짜 = (ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);

/** 이 도구의 하루 단위 장부 — {태평양날짜: 쓴 단위}, 14일 넘은 날은 버린다 */
function 장부읽기(파일) { try { return JSON.parse(fs.readFileSync(파일, 'utf8')) || {}; } catch { return {}; } }
function 장부쓰기(파일, 오늘, 더할) {
  const 장부 = 장부읽기(파일);
  장부[오늘] = (장부[오늘] || 0) + 더할;
  const 끝 = 태평양날짜(Date.parse(`${오늘}T12:00:00Z`) - 14 * 86400e3);
  for (const d of Object.keys(장부)) if (d < 끝) delete 장부[d];
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.writeFileSync(파일, JSON.stringify(장부, null, 2));
  return 장부;
}

/** 한 편 판정 — 튄(×3 · 최소 조회) · 형식만(×5 · 10만) · 광고 의심(좋아요율 0.3% 밑 — 튄 편에서 뺀다) */
function 판정하기(편, { 최소 = 기본.최소 } = {}) {
  const 광고 = 편.조회 > 0 && 편.좋아요 != null && 편.좋아요 / 편.조회 < 기본.광고좋아요율;
  const 튄 = !광고 && 편.배수 != null && 편.배수 >= 기본.튄배수 && 편.조회 >= 최소;
  return { 튄, 광고, 형식만: 튄 && 편.배수 >= 기본.형식만배수 && 편.조회 >= 기본.형식만조회 };
}

/** 누적(수요_<브랜드>.json)의 튄 편 가운데 「날짜」가 시작날 이후인 유튜브 편 → [{id, 출처}] */
function 누적편(누적들, 시작날) {
  const 나옴 = [];
  for (const [브랜드, 누적] of Object.entries(누적들)) {
    for (const [id, 편] of Object.entries(누적?.튄편 || {})) {
      if (편?.곳 === '유튜브' && /^[\w-]{11}$/.test(id) && String(편.날짜 || '') >= 시작날) 나옴.push({ id, 출처: `스캔 누적 ${브랜드}` });
    }
  }
  return 나옴;
}

const 천 = n => (n == null ? '?' : n >= 10000 ? `${Math.round(n / 1000) / 10}만` : n >= 1000 ? `${Math.round(n / 100) / 10}천` : String(n));
const 칸글 = s => String(s || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

function 표(편들) {
  const 머리 = '| 갈래 · 출처 | 영상 | 날짜 | 조회 | 배수 | 좋아요 · 댓글 | 길이 | 채널(구독) | 제목 |\n|---|---|---|---|---|---|---|---|---|';
  const 줄 = 편들.map(p => `| ${칸글(p.출처)}${p.형식만 ? ' · **형식만 가능**' : ''} | [${p.id}](https://www.youtube.com/shorts/${p.id}) | ${p.날짜} | ${천(p.조회)} | ×${p.배수} | ${천(p.좋아요)}(${p.조회 ? Math.round((p.좋아요 || 0) / p.조회 * 1000) / 10 : '?'}%) · ${천(p.댓글수)} | ${p.길이}초 | ${칸글(p.채널이름)}(${천(p.구독)}) | ${칸글(p.제목).slice(0, 70)} |`);
  return [머리, ...줄].join('\n');
}

async function 돌리기(o, 주입 = {}) {
  const 지금 = 주입.지금 || Date.now;
  const 날짜 = o.날짜 || 서울날짜(지금());
  const 시작날 = 서울날짜(Date.parse(`${날짜}T00:00:00+09:00`) - o.일수 * 86400e3);
  const 스캔폴더 = path.join(공용작업본(path.resolve(여기, '..', '..')), '.tmp', '수요스캔');
  const 출력 = o.출력 || path.join(스캔폴더, 날짜);
  fs.mkdirSync(출력, { recursive: true });
  const 기록줄 = [];
  const api = 주입.api || new 수집.API부르개({ 기록: 줄 => 기록줄.push(줄) });
  const 설정 = 주입.설정 || JSON.parse(fs.readFileSync(path.join(여기, '설정', '뜨는원본.json'), 'utf8'));
  const 모든갈래 = 설정.갈래 || {};
  for (const g of o.갈래 || []) if (!모든갈래[g]) throw new Error(`설정에 없는 갈래 「${g}」 — ${Object.keys(모든갈래).join(' · ')}`);
  const 고른갈래 = o.갈래 ? Object.fromEntries(o.갈래.map(g => [g, 모든갈래[g]])) : 모든갈래;
  let 차례;
  if (o.어) {
    const 칸 = 갈래칸(o.갈래 ? 고른갈래[o.갈래[0]] : [], 설정);
    차례 = o.어.map(q => ({ 갈래: o.이름 || (o.갈래 ? o.갈래[0] : '직접'), q, 지역: 칸.지역, 언어: 칸.언어, 최소: 칸.최소 }));
  } else 차례 = 검색차례(고른갈래, o.검색 ?? 설정.회차당, 설정);
  const 못잼 = [];
  // 하루 몫 — 이 도구가 오늘(태평양 날짜) 이미 쓴 단위 + 이번 회차 단위(검색 100 · 나머지 1)에 검색 뒤 숫자 읽기 여유를 더해 넘으면 검색을 그친다
  const 장부파일 = 주입.장부 || path.join(스캔폴더, '뜨는원본_단위.json');
  const 하루몫 = 설정.하루몫 ?? 기본.하루몫;
  const 오늘 = 태평양날짜(지금());
  const 이미 = 장부읽기(장부파일)[오늘] || 0;
  let 검색번 = 0;
  const 이번단위 = () => api.셈.호출 + (검색단위 - 1) * 검색번;

  // ① 조회순 검색 — 갈래마다 그 지역 · 언어로
  const 후보 = new Map();
  const 한검색 = [];
  const publishedAfter = new Date(Date.parse(`${시작날}T00:00:00+09:00`)).toISOString();
  for (const 줄 of 차례) {
    const { 갈래, q, 최소 } = 줄;
    if (이미 + 이번단위() + 검색단위 + (설정.검색뒤여유 ?? 기본.검색뒤여유) > 하루몫) {
      못잼.push(`하루 몫 ${하루몫}단위(태평양 ${오늘} · 앞 회차 ${이미} · 이번 ${이번단위()}) — 검색 ${차례.length - 한검색.length}번을 건너뜀(「${q}」부터)`);
      break;
    }
    검색번 += 1;
    한검색.push(줄);
    const r = await api.부르기('search', 검색값(줄, publishedAfter), `검색 ${q}`);
    if (r.상태 !== '됨') { 못잼.push(`검색 「${q}」 — ${r.오류}`); if (r.상태 === '멈춤') break; continue; }
    for (const it of r.몸.items || []) {
      const id = it?.id?.videoId;
      if (/^[\w-]{11}$/.test(id || '') && !후보.has(id)) 후보.set(id, { 출처: `검색 ${갈래} 「${q}」`, 최소: o.최소 ?? 최소 ?? 기본.최소 });
    }
  }
  // ② 스캔 누적의 N일 안 튄 편 — 설정 「누적」(갈래를 고르면 빼고) + 고른 갈래의 누적, 최소 조회는 그 브랜드 판정 그대로
  const 누적들 = {};
  const 누적이름 = o.어 ? [] : [...new Set([...(o.갈래 ? [] : 설정.누적 || []), ...Object.values(고른갈래).flatMap(v => 갈래칸(v, 설정).누적)])];
  for (const b of 누적이름) {
    try { 누적들[b] = JSON.parse(fs.readFileSync(path.join(여기, '누적', `수요_${b}.json`), 'utf8')); } catch { 못잼.push(`누적 ${b} — 못 읽음`); }
  }
  const 브랜드최소 = b => { try { return JSON.parse(fs.readFileSync(path.join(여기, '설정', `수요_${b}.json`), 'utf8')).판정?.최소조회 ?? null; } catch { return null; } };
  for (const { id, 출처 } of 누적편(누적들, 시작날)) if (!후보.has(id)) 후보.set(id, { 출처, 최소: o.최소 ?? 브랜드최소(출처.replace('스캔 누적 ', '')) ?? 기본.최소 });

  // ③ 숫자 · 길이 · 날짜
  const 상세 = (await api.영상들([...후보.keys()])).상세;
  const 편들 = [];
  for (const [id, { 출처, 최소 }] of 후보) {
    const d = 상세.get(id);
    if (!d || d.조회 == null || d.길이 == null || d.길이 > 기본.최대길이 || !d.날짜 || d.날짜 < 시작날) continue;
    if (d.조회 < 최소) continue;
    편들.push({ ...d, 출처, 최소 });
  }
  // ④ 채널 평소 — 최근 쇼츠 30편 중앙값(그 편 빼고)
  const 채널칸 = await api.채널들([...new Set(편들.map(p => p.채널id))]);
  const 평소 = new Map();
  for (const 채널id of new Set(편들.map(p => p.채널id))) {
    const 목록 = await api.쇼츠목록(채널id, 기본.기준편수);
    if (목록.상태 !== '됨' || 목록.ids.length < 5) { 못잼.push(`채널 ${채널id} — 쇼츠 목록 ${목록.상태 === '됨' ? `${목록.ids.length}편(5편 안 됨)` : 목록.오류}`); continue; }
    const 숫자 = (await api.영상들(목록.ids)).상세;
    평소.set(채널id, 목록.ids.map(v => ({ id: v, 조회: 숫자.get(v)?.조회 ?? null })));
  }
  for (const p of 편들) {
    const 줄 = 평소.get(p.채널id);
    const 가운데 = 줄 ? median(줄.filter(x => x.id !== p.id).map(x => x.조회)) : null;
    Object.assign(p, { 구독: 채널칸.get(p.채널id)?.구독 ?? null, 중앙값: 가운데, 배수: multiple(p.조회, 가운데) });
    Object.assign(p, 판정하기(p, { 최소: p.최소 }));
  }
  const 튄 = 편들.filter(p => p.튄).sort((a, b) => (b.형식만 - a.형식만) || b.배수 - a.배수);
  const 큰데안튄 = 편들.filter(p => !p.튄 && !p.광고 && p.조회 >= 기본.형식만조회).sort((a, b) => b.조회 - a.조회).slice(0, 15);
  const 광고 = 편들.filter(p => p.광고 && p.조회 >= 기본.형식만조회).length;
  const 단위 = 이번단위();
  try { 장부쓰기(장부파일, 오늘, 단위); } catch (e) { 못잼.push(`단위 장부를 못 씀 — ${e.message}`); }
  const 갈래글 = [...new Set(한검색.map(c => c.갈래))].map(g => {
    const 줄 = 한검색.filter(c => c.갈래 === g);
    return `${g} ${줄.length}번(${줄[0].지역 || '지역 제한 없이'} · ${줄[0].언어 || '언어 없이'})`;
  }).join(' · ');

  const 글 = [
    `# 뜨는 원본 · ${날짜} (최근 ${o.일수}일 · ${시작날}~)`,
    '',
    `> tools/수요스캔/뜨는원본.js — Data API 조회순 검색 ${한검색.length}번(${갈래글 || '없음'}) + 스캔 누적(${Object.keys(누적들).join(' · ') || '없음'})의 ${o.일수}일 안 튄 편, 쇼츠(3분 이하)만. 배수 = 조회 ÷ 그 채널 최근 쇼츠 30편 조회 중앙값(그 편 빼고). 튄 편 ×${기본.튄배수} · ${o.최소 != null ? 천(o.최소) : `갈래 · 브랜드 최소 조회(없으면 ${천(기본.최소)})`} 이상, **형식만 가능** ×${기본.형식만배수} · ${천(기본.형식만조회)} 이상(제작 절차 「오마주」 1). API ${api.셈.호출}번 · 약 ${단위.toLocaleString('en-US')}단위(태평양 ${오늘} 이 도구 누적 ${(이미 + 단위).toLocaleString('en-US')} / 하루 몫 ${하루몫.toLocaleString('en-US')})${api.셈.멈춤 ? ` · 멈춤(${api.셈.까닭})` : ''}.`,
    '',
    `## 튄 편 ${튄.length}편(형식만 가능 ${튄.filter(p => p.형식만).length})`,
    '',
    튄.length ? 표(튄) : '없음',
    '',
    `## 조회는 크지만 그 채널 평소 수준(×${기본.튄배수} 밑) — 원본으로 쓰지 않는다`,
    '',
    큰데안튄.length ? 표(큰데안튄) : '없음',
    '',
    `광고 의심으로 뺀 큰 편(10만 회 이상 · 좋아요율 ${기본.광고좋아요율 * 100}% 밑): ${광고}편`,
    '',
    `## 못 잰 것 ${못잼.length}`,
    '',
    ...(못잼.length ? 못잼.map(s => `- ${s}`) : ['- 없음']),
    '',
  ].join('\n');
  const 파일 = o.이름 ? `뜨는원본_${o.이름}` : '뜨는원본';
  fs.writeFileSync(path.join(출력, `${파일}.md`), 글);
  fs.writeFileSync(path.join(출력, `${파일}.json`), JSON.stringify({ 날짜, 시작날, 일수: o.일수, 검색: 한검색, 튄, 큰데안튄, 못잼, api: { ...api.셈, 단위, 태평양날짜: 오늘, 하루누적: 이미 + 단위, 하루몫 } }, null, 2));
  fs.appendFileSync(path.join(출력, '기록.jsonl'), 기록줄.map(j => JSON.stringify({ 도구: '뜨는원본', ...j })).join('\n') + (기록줄.length ? '\n' : ''));
  return { 출력, 파일, 튄, 못잼, 검색: 한검색, api: { ...api.셈, 단위 } };
}

if (require.main === module) {
  let o;
  try { o = 인자(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (o.도움) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 23).join('\n')); process.exit(0); }
  돌리기(o).then(r => {
    console.log(`뜨는 원본 · 튄 편 ${r.튄.length}(형식만 가능 ${r.튄.filter(p => p.형식만).length}) · 못 잰 것 ${r.못잼.length} · API ${r.api.호출}번 · 약 ${r.api.단위}단위${r.api.멈춤 ? ` · 멈춤 ${r.api.까닭}` : ''}`);
    console.log(`  ${path.join(r.출력, `${r.파일}.md`)}`);
    process.exit(r.api.멈춤 && !r.튄.length ? 1 : 0);
  }).catch(e => { console.error(e?.stack || e); process.exit(1); });
}

module.exports = { 인자, 갈래칸, 검색차례, 검색값, 태평양날짜, 장부쓰기, 판정하기, 누적편, 표, 돌리기, 기본 };
