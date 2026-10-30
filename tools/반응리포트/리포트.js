#!/usr/bin/env node
'use strict';
/**
 * 광고 반응 리포트 — PULSE가 납품한 광고의 1주 · 4주 반응(플랫폼 숫자 · 랜딩 · 댓글)을 모아 「다음 편에서 바꿀 셋」까지 한 장으로 만든다(2026-10-30).
 * 납품 전 업종 반응 브리핑(tools/업종브리핑)의 짝. 설계: docs/마케팅/PULSE_반응브리핑/반응리포트_설계.md
 *
 *   node tools/반응리포트/리포트.js 돌리기 <캠페인> [--시점 1주|4주] [--날짜 YYYY-MM-DD] [--다시 <단계>] [--건너뛰기 댓글,랜딩] [--서버안읽음] [--출력 <폴더>]
 *   node tools/반응리포트/리포트.js 검사 <캠페인> [--시점 …] [--날짜 …]       네트워크 없이: 남은 자료로 다시 세어 지표 · 글 · 페이지가 맞는지
 *   node tools/반응리포트/리포트.js 랜딩받기 <캠페인>|--전부                  Clarity 지난 24시간 숫자를 하루 장부에 덧붙인다(하루 한 번 — 20시간 안에 받았으면 건너뜀)
 *   node tools/반응리포트/리포트.js 칸지도 <캠페인>                          랜딩 칸 위치를 휴대폰 · PC 폭에서 다시 잰다
 *
 * 단계: 플랫폼 → 댓글 → 랜딩 → 나누기 → 집계 → 글 → 그리기. 결과는 <공용 작업본>/.tmp/반응리포트/<캠페인>/<시점>-<기준일>/(git 밖)에
 * 단계마다 JSON으로 남고, 이미 끝난 단계는 건너뛰며, 한 단계가 새로 돌면 그 뒤는 모두 다시 돈다(업종 브리핑과 같은 무효화).
 * 캠페인 설정: .tmp/반응리포트/<캠페인>/설정.json(git 밖 — 고객사 것)을 먼저, 없으면 tools/반응리포트/설정/<캠페인>.json(SYNK 자기 캠페인만, 공개 저장소).
 * 플랫폼 숫자는 게시 성과 장부 → 회사 서버 하루 숫자(읽기 전용) → 손 입력(실행 폴더 플랫폼_손입력.json) → 유튜브 공개 숫자 차례로 찾는다.
 * 남의 댓글 원문 · Clarity 원자료는 git 밖에만 둔다. 남에게 보내기 · 게시는 하지 않는다. Claude는 tools/lib/클로드키.js 크레딧 키로.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 공용작업본 } = require('../lib/공용작업본.js');
const 플랫폼 = require('./플랫폼.js');
const 랜딩 = require('./랜딩.js');

const 여기 = __dirname;
const 저장소 = path.resolve(여기, '..', '..');
const 단계들 = ['플랫폼', '댓글', '랜딩', '나누기', '집계', '글', '그리기'];
const 하루 = 24 * 60 * 60 * 1000;
const 장부경로 = path.join(저장소, 'docs', '_ops', '게시성과.jsonl'); // 공용 작업본이 origin을 따라가므로 운영 사본이 올린 장부가 들어와 있다
const 지도유효일 = 14;

function 인자(argv) {
  const o = { 명령: argv[0], 낱말: [], 시점: '1주', 다시: null, 건너뛰기: [], 날짜: null, 출력: null, 서버안읽음: false, 전부: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--시점') o.시점 = argv[++i];
    else if (a === '--다시') o.다시 = argv[++i];
    else if (a === '--건너뛰기') o.건너뛰기 = String(argv[++i] || '').split(',').filter(Boolean);
    else if (a === '--날짜') o.날짜 = argv[++i];
    else if (a === '--출력') o.출력 = argv[++i];
    else if (a === '--서버안읽음') o.서버안읽음 = true;
    else if (a === '--전부') o.전부 = true;
    else o.낱말.push(a);
  }
  if (!플랫폼.시점들[o.시점]) throw new Error(`--시점은 ${Object.keys(플랫폼.시점들).join(' · ')}`);
  return o;
}

const 오늘서울 = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const 서울자정 = (날) => new Date(Date.parse(`${날}T00:00:00+09:00`)).toISOString();
const 읽기 = (p, 기본 = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return 기본; } };
const 쓰기 = (p, x) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(`${p}.tmp`, JSON.stringify(x, null, 1)); fs.renameSync(`${p}.tmp`, p); };
const 바탕폴더 = () => path.join(공용작업본(저장소), '.tmp', '반응리포트');

function 설정읽기(이름) {
  if (!이름 || /[\\/]|\.\./.test(이름)) throw new Error('캠페인 이름을 주세요(.tmp/반응리포트/<이름>/설정.json 또는 tools/반응리포트/설정/<이름>.json)');
  const 밖 = path.join(바탕폴더(), 이름, '설정.json');
  const 안 = path.join(여기, '설정', `${이름}.json`);
  const s = 읽기(밖) || 읽기(안);
  if (!s) throw new Error(`캠페인 설정이 없다: ${밖} · ${안}`);
  const 문제 = [];
  if (!s.업종) 문제.push('업종');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.납품일 || '')) 문제.push('납품일(YYYY-MM-DD)');
  if (!Array.isArray(s.광고) || !s.광고.length) 문제.push('광고[]');
  for (const a of s.광고 || []) {
    // 키는 지표 이름(광고.<키>.…)에 들어간다 — 숫자 · 점 · 중괄호가 없어야 글이 {{…}}로 부르기 쉽다
    if (!/^[가-힣A-Za-z_]+$/.test(a.키 || '')) 문제.push(`광고 키 「${a.키}」(한글 · 영문만)`);
    if (!a.주소?.length) 문제.push(`광고 ${a.키}의 주소[]`);
  }
  if (new Set((s.광고 || []).map((a) => a.키)).size !== (s.광고 || []).length) 문제.push('광고 키가 겹친다');
  if (문제.length) throw new Error(`캠페인 ${이름}: ${문제.join(', ')}`);
  return { ...s, 이름: s.이름 || 이름 };
}

function 기록기(폴더) {
  return (줄) => {
    fs.appendFileSync(path.join(폴더, '기록.jsonl'), JSON.stringify({ 시각: new Date().toISOString(), ...(typeof 줄 === 'string' ? { 글: 줄 } : 줄) }) + '\n');
    console.log(typeof 줄 === 'string' ? 줄 : JSON.stringify(줄));
  };
}

// ── 단계 ──────────────────────────────────────────────────────────────
async function 플랫폼단계(설정, o, 폴더, 남기기) {
  // 장부는 게시 성과 도구의 읽기 · 「가장 늦은 판정」 규칙을 그대로 쓴다(새 파서를 두지 않는다 — 검토 5)
  const { readLedger, latestJudgments } = require('../게시성과.js');
  const 최신 = latestJudgments(readLedger(장부경로));
  const 손입력 = 읽기(path.join(폴더, '플랫폼_손입력.json'), []);
  const 행들 = [];
  for (const a of 설정.광고) for (const 주소 of a.주소) {
    const 키 = 플랫폼.게시키(주소);
    행들.push({ 광고: a.키, 플랫폼: 키?.플랫폼 || '모름', 주소, 키: 키?.키 || null, 숫자: 키 ? 플랫폼.장부고르기(최신, 키.키, o.시점) : null, 까닭: 키 ? null : '모르는 주소 꼴' });
  }
  let 서버자료 = null, 서버 = '안 읽음(--서버안읽음)';
  const 남은 = () => 행들.filter((r) => r.키 && !r.숫자);
  // 장부에 없는 시점(4주)과 같은 나이 평소(장부에 견줄 편이 모자랄 때)를 위해 한 번 읽는다 — 읽기 전용 SSH(게시 성과 판정과 같은 길)
  if (!o.서버안읽음) {
    try { 서버자료 = await require('../lib/게시성과읽기.cjs').읽기({ days: 45, perChannel: 80 }); 서버 = '읽음'; } catch (e) { 서버 = `못 읽음: ${String(e.message || e).slice(0, 80)}`; }
    남기기(`회사 서버 하루 숫자: ${서버}`);
    if (서버자료) for (const r of 남은()) r.숫자 = 플랫폼.서버고르기(서버자료, 플랫폼.게시키(r.주소), o.시점);
  }
  for (const r of 남은()) r.숫자 = 플랫폼.손입력고르기(손입력, r.키, o.시점);
  let 상세 = new Map();
  const 받은때 = new Date().toISOString();
  if (행들.some((r) => r.플랫폼 === 'youtube')) {
    // 댓글 단계가 채널 id · 댓글 수를 쓰니 유튜브 행은 모두 한 번에 받는다(50편에 1단위). 받은 때를 남겨 검사가 Date.now 없이 같게 센다
    const { API부르개 } = require('../수요스캔/수요수집.js');
    const 부르개 = new API부르개({ 기록: (줄) => fs.appendFileSync(path.join(폴더, '유튜브api.jsonl'), JSON.stringify(줄) + '\n') });
    const r = await 부르개.영상들(행들.filter((x) => x.플랫폼 === 'youtube').map((x) => x.키.split(':')[1]));
    상세 = r.상세;
    if (r.상태 !== '됨') 남기기(`유튜브 영상 숫자: ${r.상태} ${r.오류 || ''}`);
  }
  for (const r of 남은().filter((x) => x.플랫폼 === 'youtube')) r.숫자 = 플랫폼.유튜브지금고르기(상세.get(r.키.split(':')[1]), o.시점, 받은때);
  for (const r of 행들) {
    if (!r.숫자) { if (!r.까닭) r.까닭 = '장부 · 서버 · 손 입력 · 공개 숫자 어디에도 그 시점 숫자가 없다'; continue; }
    const 키 = 플랫폼.게시키(r.주소);
    // 서버 · 손 입력 숫자에는 장부의 시청 유지 칸을 출처 시점과 함께 더하고, 같은 출처 · 같은 나이 평소를 붙인다
    if (r.숫자.출처 !== '게시 성과 장부') r.숫자 = 플랫폼.유지더하기(r.숫자, 플랫폼.장부고르기(최신, r.키, '1주'));
    r.숫자 = 플랫폼.평소붙이기(r.숫자, { 최신, 서버: 서버자료, 키 });
  }
  const 유튜브 = Object.fromEntries([...상세].map(([id, v]) => [id, { 채널id: v.채널id, 댓글수: v.댓글수, 올린때: v.올린때, 제목: v.제목, 길이: v.길이 }]));
  남기기({ 단계: '플랫폼', 읽음: 행들.filter((r) => r.숫자).length, 전체: 행들.length, 서버 });
  return { 행들, 서버, 유튜브, 유튜브받은때: 상세.size ? 받은때 : null, 장부판정수: 최신.size };
}

async function 댓글단계(설정, 플랫폼결과, 폴더, 남기기) {
  const { 가리기 } = require('../업종브리핑/유튜브.js');
  const 장부 = 플랫폼결과.행들.filter((r) => r.숫자 && Number.isFinite(r.숫자.숫자.댓글)).map((r) => ({ 광고: r.광고, 플랫폼: r.플랫폼, 수: r.숫자.숫자.댓글 }));
  const 대상 = 플랫폼결과.행들.filter((r) => r.플랫폼 === 'youtube' && r.키);
  const 목록 = [];
  let 부름 = 0;
  const { API부르개 } = require('../수요스캔/수요수집.js');
  const 부르개 = new API부르개({ 기록: (줄) => fs.appendFileSync(path.join(폴더, '유튜브api.jsonl'), JSON.stringify(줄) + '\n') });
  for (const r of 대상) {
    const id = r.키.split(':')[1];
    const 정보 = 플랫폼결과.유튜브?.[id] || {};
    if (정보.댓글수 === 0) continue; // 댓글이 없는 편은 부르지 않는다(1단위 아낌)
    const q = await 부르개.부르기('commentThreads', { part: 'snippet', videoId: id, order: 'relevance', maxResults: '100', textFormat: 'plainText' }, id);
    부름 += 1;
    if (q.상태 === '멈춤') { 남기기(`유튜브 댓글 멈춤: ${q.오류}`); break; }
    if (q.상태 !== '됨') continue;
    (q.몸.items || []).map((t) => t.snippet?.topLevelComment?.snippet).filter(Boolean).forEach((s, i) => {
      if (정보.채널id && s.authorChannelId?.value === 정보.채널id) return; // 채널 주인 댓글은 뺀다
      const 글 = 가리기(s.textDisplay).slice(0, 400);
      if (글.trim()) 목록.push({ 키: `${id}#${i}`, 광고: r.광고, 영상: id, 글, 좋아요: Number(s.likeCount || 0) });
    });
  }
  남기기({ 단계: '댓글', 유튜브댓글: 목록.length, 부름 });
  return { 상태: '됨', 목록, 장부 };
}

function 칸지도읽기(설정, 새로 = false) {
  if (!설정.랜딩?.주소) return [];
  const p = path.join(바탕폴더(), 설정.이름, '칸지도.json');
  const 있는것 = 읽기(p);
  const 최근 = 있는것?.length && 있는것[0].주소 === 설정.랜딩.주소 && Date.now() - Date.parse(`${있는것[0].잰날}T00:00:00Z`) < 지도유효일 * 하루;
  if (최근 && !새로) return 있는것;
  const r = spawnSync(process.execPath, [path.join(여기, '칸지도.mjs'), 설정.랜딩.주소, p], { encoding: 'utf8', timeout: 180000, windowsHide: true });
  if (r.status !== 0) { console.log(`칸 지도 못 잼: ${String(r.stderr || r.stdout).trim().slice(0, 200)}`); return 있는것 || []; }
  return 읽기(p, []);
}

/** 칸 이름: 설정 랜딩.칸이름({section id: 짧은 이름}) — 없으면 쪽 제목(길다) 그대로 */
const 칸이름붙이기 = (지도들, 칸이름 = {}) => (지도들 || []).map((m) => ({ ...m, 칸: m.칸.map((c) => ({ ...c, 이름: 칸이름[c.id] || c.이름 })) }));

function 랜딩단계(설정, 플랫폼결과, o, 기준일, 남기기) {
  const 지도들 = 칸이름붙이기(칸지도읽기(설정), 설정.랜딩?.칸이름);
  const 기간 = 랜딩기간(설정, 플랫폼결과, o.시점, 기준일);
  if (!설정.랜딩?.주소) return { 상태: '설정 없음', 까닭: '캠페인 설정에 랜딩이 없다', 지도: 지도들, 기간 };
  if (!설정.랜딩.프로젝트) return { 상태: '측정 전', 까닭: 'Clarity 프로젝트가 아직 없다(가입 · 측정 코드 설치 전)', 지도: 지도들, 기간 };
  const 장부 = 하루장부읽기(설정.랜딩.프로젝트);
  const r = 랜딩.랜딩모으기({ 장부, 랜딩: 설정.랜딩, 시작: 기간.시작, 끝: 기간.끝, 지도들, 캠페인낱말: 설정.랜딩.캠페인낱말 || [] });
  남기기({ 단계: '랜딩', 상태: r.상태, 기간 });
  return { ...r, 지도: r.지도 || 지도들, 기간 };
}

/** 랜딩 기간: 첫 게시 ~ min(기준일 자정, 마지막 게시 + 시점 일수). 게시 때를 모르면 납품일 자정부터 */
function 랜딩기간(설정, 플랫폼결과, 시점, 기준일) {
  const 때들 = (플랫폼결과?.행들 || []).map((r) => Date.parse(r.숫자?.게시때 || '')).filter(Number.isFinite);
  const 시작 = 때들.length ? Math.min(...때들) : Date.parse(서울자정(설정.납품일));
  const 마지막 = 때들.length ? Math.max(...때들) : 시작;
  const 끝 = Math.min(Date.parse(서울자정(기준일)) + 하루, 마지막 + 플랫폼.시점들[시점].일 * 하루);
  return { 시작: new Date(시작).toISOString(), 끝: new Date(Math.max(시작, 끝)).toISOString() };
}

const 하루장부경로 = (프로젝트) => path.join(바탕폴더(), '_clarity', `${String(프로젝트).replace(/[^\w-]/g, '')}.jsonl`);
function 하루장부읽기(프로젝트) {
  const p = 하루장부경로(프로젝트);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function 그리기입력(모음, 글결과, 설정, o, 기준일, 랜딩결과) {
  return { 지표: 모음.지표, 그림: 모음.그림, 표본: 모음.표본, 글: 글결과?.상태 === '됨' ? 글결과.글 : null, 글까닭: 글결과?.상태 === '됨' ? null : (글결과?.까닭 || '글 단계를 돌리지 않음'), 상태: 모음.상태, 설정, 시점: o.시점, 기준일, 지도들: 랜딩결과?.지도 || [] };
}

async function 돌리기(o) {
  const 이름 = o.낱말[0];
  const 설정 = 설정읽기(이름);
  const 기준일 = o.날짜 || 오늘서울();
  const 폴더 = o.출력 || path.join(바탕폴더(), 이름, `${o.시점}-${기준일}`);
  fs.mkdirSync(폴더, { recursive: true });
  const 남기기 = 기록기(폴더);
  const 파일 = Object.fromEntries(단계들.map((d) => [d, path.join(폴더, `${d}.json`)]));
  const 다시부터 = o.다시 ? 단계들.indexOf(o.다시) : -1;
  if (o.다시 && 다시부터 < 0) throw new Error(`모르는 단계: ${o.다시} (${단계들.join('·')})`);
  let 새로돈 = false;
  const 할까 = (d) => {
    if (o.건너뛰기.includes(d)) return false;
    const 해야 = 새로돈 || !fs.existsSync(파일[d]) || (다시부터 >= 0 && 단계들.indexOf(d) >= 다시부터);
    if (해야) 새로돈 = true;
    return 해야;
  };
  남기기({ 단계: '시작', 캠페인: 이름, 시점: o.시점, 기준일, 폴더 });

  if (할까('플랫폼')) 쓰기(파일.플랫폼, await 플랫폼단계(설정, o, 폴더, 남기기));
  const 플랫폼결과 = 읽기(파일.플랫폼);
  if (할까('댓글')) {
    try { 쓰기(파일.댓글, await 댓글단계(설정, 플랫폼결과, 폴더, 남기기)); } catch (e) { 쓰기(파일.댓글, { 상태: '못 읽음', 까닭: String(e.message || e).slice(0, 200) }); 남기기(`댓글 못 읽음: ${e.message}`); }
  }
  const 댓글결과 = 읽기(파일.댓글, { 상태: '안 읽음', 까닭: '건너뜀' });
  if (할까('랜딩')) 쓰기(파일.랜딩, 랜딩단계(설정, 플랫폼결과, o, 기준일, 남기기));
  const 랜딩결과 = 읽기(파일.랜딩, { 상태: '안 읽음', 까닭: '건너뜀' });

  if (할까('나누기')) {
    const 항목 = (댓글결과.목록 || []).map((c) => ({ 키: c.키, 글: c.글 }));
    const 결과 = { 댓글: {}, 낱말로: { 댓글: [] }, 주제: {} };
    if (항목.length) {
      const 클로드 = require('../lib/클로드키.js');
      const { 나누기 } = require('../업종브리핑/나누기.js');
      const 캐시경로 = path.join(바탕폴더(), 이름, '나누기캐시.json');
      const 캐시 = 읽기(캐시경로, {});
      const r = await 나누기({ 보내기: 클로드.보내기, 종류: '댓글', 설정: { 업종: 설정.업종, 주제: 설정.주제 || {} }, 항목, 캐시, 알림: 남기기 });
      결과.댓글 = r.표; 결과.낱말로.댓글 = r.낱말로; 결과.주제.댓글 = r.주제;
      쓰기(캐시경로, 캐시);
    }
    쓰기(파일.나누기, 결과);
  }
  const 나눔 = 읽기(파일.나누기, {});

  if (할까('집계')) {
    const { 집계 } = require('./집계.js');
    쓰기(파일.집계, 집계({ 설정, 플랫폼행: 플랫폼결과?.행들 || [], 유튜브: 플랫폼결과?.유튜브 || {}, 랜딩: 랜딩결과, 댓글: 댓글결과, 나누기: 나눔 }));
  }
  const 모음 = 읽기(파일.집계);

  if (할까('글')) {
    try {
      const 클로드 = require('../lib/클로드키.js');
      const { 쓰기: 글쓰기 } = require('./글.js');
      const r = await 글쓰기({ 보내기: 클로드.보내기, 설정, 시점: o.시점, 지표: 모음.지표, 표본: 모음.표본, 상태: 모음.상태, 알림: 남기기 });
      쓰기(파일.글, { 상태: '됨', 글: r.글, 회차: r.번 });
    } catch (e) { 쓰기(파일.글, { 상태: '못 씀', 까닭: String(e.message).slice(0, 300) }); 남기기(`글 못 씀: ${e.message}`); }
  }
  const 글결과 = 읽기(파일.글, {});

  if (할까('그리기')) {
    const { 그리기 } = require('./그리기.js');
    const { 문서, 조각 } = 그리기(그리기입력(모음, 글결과, 설정, o, 기준일, 랜딩결과));
    fs.writeFileSync(path.join(폴더, '리포트.html'), 문서);
    fs.writeFileSync(path.join(폴더, '리포트_조각.html'), 조각);
    쓰기(파일.그리기, { 상태: '됨', 문서: path.join(폴더, '리포트.html'), 조각: path.join(폴더, '리포트_조각.html'), 바이트: Buffer.byteLength(문서) });
  }
  남기기({ 단계: '끝', 상태: 모음?.상태, 글: 글결과.상태, 페이지: path.join(폴더, '리포트.html') });
  return { 폴더, 페이지: path.join(폴더, '리포트.html') };
}

/** 네트워크 없이: 남은 원자료로 다시 세어 집계.json과 같은지, 글이 검사를 지나는지, 페이지가 같은지 */
function 검사(o) {
  const 이름 = o.낱말[0];
  const 설정 = 설정읽기(이름);
  const 기준일 = o.날짜 || 오늘서울();
  const 폴더 = o.출력 || path.join(바탕폴더(), 이름, `${o.시점}-${기준일}`);
  const 문제 = [];
  const { 집계 } = require('./집계.js');
  const { 검사하기 } = require('./글.js');
  const 모음 = 읽기(path.join(폴더, '집계.json'));
  if (!모음) throw new Error(`집계.json이 없다: ${폴더}`);
  const 랜딩결과 = 읽기(path.join(폴더, '랜딩.json'), { 상태: '안 읽음', 까닭: '건너뜀' });
  const 플랫폼결과 = 읽기(path.join(폴더, '플랫폼.json'));
  const 다시 = 집계({ 설정, 플랫폼행: 플랫폼결과?.행들 || [], 유튜브: 플랫폼결과?.유튜브 || {}, 랜딩: 랜딩결과, 댓글: 읽기(path.join(폴더, '댓글.json'), { 상태: '안 읽음', 까닭: '건너뜀' }), 나누기: 읽기(path.join(폴더, '나누기.json'), {}) });
  if (JSON.stringify(다시.지표) !== JSON.stringify(모음.지표)) 문제.push('지표가 다시 센 값과 다르다(원자료나 집계가 바뀜)');
  const 글결과 = 읽기(path.join(폴더, '글.json'), {});
  if (글결과.상태 === '됨') {
    const 표본댓글 = {};
    for (const cs of Object.values(모음.표본?.댓글 || {})) for (const c of cs) 표본댓글[c.키] = c.글;
    문제.push(...검사하기(글결과.글, { 지표: 모음.지표, 표본댓글, 상태: 모음.상태, 허용낱말: 설정.광고.map((a) => a.이름) }).map((x) => `글: ${x}`));
  }
  const 페이지 = fs.existsSync(path.join(폴더, '리포트.html')) ? fs.readFileSync(path.join(폴더, '리포트.html'), 'utf8') : '';
  if (!페이지) 문제.push('리포트.html이 없다');
  if (페이지.includes('{{')) 문제.push('페이지에 채우지 못한 자리표시자가 있다');
  const { 그리기 } = require('./그리기.js');
  if (페이지 && 그리기(그리기입력(모음, 글결과, 설정, o, 기준일, 랜딩결과)).문서 !== 페이지) 문제.push('같은 지표 · 글로 다시 그린 페이지가 다르다');
  return { 폴더, 문제 };
}

async function 랜딩받기(o) {
  const 이름들 = o.전부 ? fs.readdirSync(path.join(여기, '설정')).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
    .concat(fs.existsSync(바탕폴더()) ? fs.readdirSync(바탕폴더()).filter((d) => fs.existsSync(path.join(바탕폴더(), d, '설정.json'))) : []) : o.낱말;
  const 프로젝트들 = new Map();
  for (const 이름 of new Set(이름들)) { const s = 설정읽기(이름); if (s.랜딩?.프로젝트) 프로젝트들.set(s.랜딩.프로젝트, 이름); }
  if (!프로젝트들.size) { console.log('Clarity 프로젝트가 있는 캠페인이 없다 — 받을 것 없음'); return; }
  for (const [프로젝트, 이름] of 프로젝트들) {
    const 장부 = 하루장부읽기(프로젝트);
    const 마지막 = Math.max(0, ...장부.map((x) => Date.parse(x.받은때)).filter(Number.isFinite));
    if (Date.now() - 마지막 < 20 * 3600 * 1000) { console.log(`${프로젝트}(${이름}): 20시간 안에 받았다 — 건너뜀`); continue; }
    const r = await 랜딩.하루받기({ 프로젝트 });
    if (r.줄들.length) { fs.mkdirSync(path.dirname(하루장부경로(프로젝트)), { recursive: true }); fs.appendFileSync(하루장부경로(프로젝트), r.줄들.map((x) => JSON.stringify(x)).join('\n') + '\n'); }
    console.log(`${프로젝트}(${이름}): ${r.상태}${r.까닭 ? ` — ${r.까닭}` : ''} · 줄 ${r.줄들.length}`);
    if (r.상태 !== '됨') process.exitCode = 1;
  }
}

async function main() {
  const o = 인자(process.argv.slice(2));
  if (o.명령 === '돌리기') { const r = await 돌리기(o); console.log(`페이지: ${r.페이지}`); return; }
  if (o.명령 === '검사') { const r = 검사(o); console.log(r.문제.length ? `문제 ${r.문제.length}건\n- ${r.문제.join('\n- ')}` : `통과: ${r.폴더}`); if (r.문제.length) process.exitCode = 1; return; }
  if (o.명령 === '랜딩받기') { await 랜딩받기(o); return; }
  if (o.명령 === '칸지도') { const m = 칸지도읽기(설정읽기(o.낱말[0]), true); for (const x of m) console.log(`${x.폭}폭: ${x.칸.map((c) => `${c.id} ${c.위}%`).join(' · ')}`); return; }
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 18).map((l) => l.replace(/^ \*\s?/, '')).join('\n'));
}

if (require.main === module) main().catch((e) => { console.error(`멈춤: ${e.message}`); process.exit(1); });

module.exports = { 인자, 설정읽기, 랜딩기간, 단계들, 검사, 그리기입력 };
