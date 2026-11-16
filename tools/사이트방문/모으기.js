#!/usr/bin/env node
'use strict';
/**
 * synk.im 방문자 분석 — 하루 한 번 모아 솔리오가 읽는 요약 한 장을 쓴다(설계: docs/마케팅/사이트방문_분석/설계.md).
 *
 *   node tools/사이트방문/모으기.js 돌리기 [--강제] [--AI강제] [--건너뛰기 방문,목적,검색,AI]
 *   node tools/사이트방문/모으기.js 보기                 지금 요약을 사람이 읽는 글로
 *   node tools/사이트방문/모으기.js AI재기 [--질문 K01,B01] [--서비스 Claude,Gemini]   한 회차만(장부에 남기지 않는 시험은 --시험)
 *
 * 단계: 방문 기록(시트) → 홈 방문 목적(시트) → 서치콘솔 → AI 재기(6.5일마다) → 요약.
 * 한 단계가 막혀도 나머지는 돌고, 그 칸만 까닭과 함께 「못 읽음」이 된다(3일 안의 앞 값이 있으면 낡음 표시로 이어 쓴다).
 * 23시간 안에 돌았으면 건너뛴다(예약 「SYNK 반응 리포트 랜딩 받기」가 3시간마다 깨워 부른다).
 * 장부와 원자료는 <공용 작업본>/.tmp/사이트방문/(git 밖), 요약은 %LOCALAPPDATA%\synk\site-visits\summary.json.
 */
const fs = require('fs');
const path = require('path');
const { 공용작업본 } = require('../lib/공용작업본.js');
const 셈 = require('./방문셈.js');
const 구글 = require('./구글.js');
const AI = require('./AI재기.js');
const 요약 = require('./요약.js');

const 저장소 = path.resolve(__dirname, '..', '..');
const 장부폴더 = () => process.env.SYNK_SITE_VISITS_LEDGER || path.join(공용작업본(저장소), '.tmp', '사이트방문');
const 설정읽기 = () => JSON.parse(fs.readFileSync(path.join(__dirname, '설정.json'), 'utf8'));
const 하루 = 24 * 60 * 60 * 1000;

function JSON읽기(p, 기본) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return 기본; } }
function JSON쓰기(p, x) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(`${p}.tmp`, JSON.stringify(x, null, 1)); fs.renameSync(`${p}.tmp`, p); }
function 줄덧붙이기(p, x) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.appendFileSync(p, `${JSON.stringify(x)}\n`); }
function 줄들(p) { try { return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } }

// 권한이 없는 것은 고장이 아니다 — 「못 읽음」과 나눠 「권한 기다림」으로 둔다(화면은 「측정 전」처럼 차분하게 보인다).
const 권한기다림 = (무엇을) => ({ 상태: '권한 기다림', 까닭: `${무엇을} 읽을 권한을 기다립니다.` });
const 오류칸 = (e, 무엇을) => ({ 오류: true, 까닭: `${무엇을} 읽지 못했습니다(${String(e && e.message || e).slice(0, 80)}).` });

/** 한 번 모은다. 결과 요약과 단계별 한 줄을 돌려준다. 시험은 의존을 갈아 끼운다. */
async function 돌리기({ 지금 = new Date(), 설정 = 설정읽기(), 건너뛰기 = [], AI강제 = false, 의존 = {} } = {}) {
  const 폴더 = 의존.장부폴더 || 장부폴더();
  const 열쇠 = 의존.열쇠 !== undefined ? 의존.열쇠 : 구글.열쇠읽기();
  const fetch기 = 의존.fetch기 || ((...a) => fetch(...a));
  const 앞요약 = 의존.앞요약 !== undefined ? 의존.앞요약 : 요약.요약읽기();
  const 단계 = {}, 알림 = [];
  let 토큰 = null;
  if (열쇠) {
    try { 토큰 = await (의존.접근토큰 || 구글.접근토큰)(열쇠, { fetch기 }); } catch (e) { 알림.push(`구글 토큰: ${e.message}`); }
  }

  // 1. 방문 기록
  if (건너뛰기.includes('방문')) 단계.방문 = { 상태: '못 읽음', 까닭: '이번에는 방문 기록을 건너뛰었습니다.' };
  else if (!설정.방문기록?.시트 || !설정.방문기록?.켠날) 단계.방문 = { 상태: '측정 전', 까닭: '사이트 전체 방문 기록을 아직 켜지 않았습니다.' };
  else if (!열쇠) 단계.방문 = 권한기다림('방문 기록 시트를');
  else if (!토큰) 단계.방문 = { 오류: true, 까닭: '구글 토큰을 받지 못했습니다.' };
  else {
    try {
      const 값 = await 구글.시트읽기({ 시트: 설정.방문기록.시트, 탭: 설정.방문기록.탭, 토큰, fetch기 });
      const 정리 = 셈.줄들읽기(값).map((r) => 셈.방문줄(r, 설정.방문기록.시간대분)).filter(Boolean);
      단계.방문 = { 칸: 셈.방문셈(정리, { 지금, 시간대분: 설정.방문기록.시간대분, 켠날: 설정.방문기록.켠날 }) };
      알림.push(`방문 기록: 시트 ${Math.max(0, 값.length - 1)}줄 · 셀 줄 ${정리.length}`);
    } catch (e) { 단계.방문 = 오류칸(e, '방문 기록 시트를'); 알림.push(`방문 기록: ${e.message}`); }
  }

  // 2. 홈 방문 목적
  if (건너뛰기.includes('목적')) 단계.목적 = { 상태: '못 읽음', 까닭: '이번에는 홈 방문 목적을 건너뛰었습니다.' };
  else if (!열쇠) 단계.목적 = 권한기다림('홈 방문 목적 시트를');
  else if (!토큰) 단계.목적 = { 오류: true, 까닭: '구글 토큰을 받지 못했습니다.' };
  else {
    try {
      const 값 = await 구글.시트읽기({ 시트: 설정.방문목적.시트, 탭: 설정.방문목적.탭, 토큰, fetch기 });
      단계.목적 = { 칸: 셈.목적셈(셈.줄들읽기(값), { 지금, 시간대분: 설정.방문목적.시간대분 }) };
      알림.push(`홈 방문 목적: 시트 ${Math.max(0, 값.length - 1)}줄`);
    } catch (e) { 단계.목적 = 오류칸(e, '홈 방문 목적 시트를'); 알림.push(`홈 방문 목적: ${e.message}`); }
  }

  // 3. 서치콘솔
  const 오늘 = 셈.한국날(+지금);
  if (건너뛰기.includes('검색')) 단계.구글 = { 상태: '못 읽음', 까닭: '이번에는 서치콘솔을 건너뛰었습니다.' };
  else if (!열쇠) 단계.구글 = 권한기다림('구글 서치콘솔을');
  else if (!토큰) 단계.구글 = { 오류: true, 까닭: '구글 토큰을 받지 못했습니다.' };
  else {
    try {
      단계.구글 = { 칸: await 구글.구글칸({ 속성: 설정.서치콘솔.속성, 오늘, 토큰, fetch기 }) };
      알림.push(`서치콘솔: 노출 ${단계.구글.칸.노출} · 클릭 ${단계.구글.칸.클릭}`);
    } catch (e) { 단계.구글 = 오류칸(e, '구글 서치콘솔을'); 알림.push(`서치콘솔: ${e.message}`); }
  }
  단계.네이버 = { 상태: 설정.네이버?.상태 || '확인 안 함', 까닭: 설정.네이버?.까닭 || null };

  // 4. AI 재기(주 1회)
  const AI장부 = path.join(폴더, 'AI재기.jsonl');
  const 회차들 = 줄들(AI장부);
  const 마지막회차 = 회차들[회차들.length - 1] || null;
  const 주기 = (설정.AI재기?.주기일 || 6.5) * 하루;
  const 때됨 = !마지막회차 || +지금 - Date.parse(마지막회차.잰때 || `${마지막회차.날}T00:00:00Z`) >= 주기;
  if (!건너뛰기.includes('AI') && (때됨 || AI강제)) {
    try {
      const 질문들 = (의존.질문세트 || AI.질문세트읽기()).질문;
      const 회차 = await (의존.회차재기 || AI.회차재기)({ 날: 오늘, 질문들, 원문쓰기: 의존.원문쓰기 === undefined ? AI.원문쓰기만들기(오늘) : 의존.원문쓰기 });
      const 줄 = { 잰때: new Date(지금).toISOString(), 날: 회차.날, 서비스: 회차.서비스.map(({ 판정들, ...s }) => s), 멈춤: 회차.멈춤 };
      줄덧붙이기(AI장부, 줄);
      회차들.push(줄);
      알림.push(`AI 재기: ${줄.서비스.map((s) => `${s.이름} 언급 ${s.언급}/${s.답받음}`).join(' · ')}`);
    } catch (e) { 알림.push(`AI 재기: ${e.message}`); }
  }
  const 끝회차 = 회차들[회차들.length - 1] || null;
  단계.AI = 끝회차 ? { 회차: 끝회차, 앞회차: 회차들[회차들.length - 2] || null } : { 상태: '측정 전', 까닭: '첫 회차를 아직 재지 않았습니다.' };

  const 결과 = 요약.요약만들기({ 단계, 앞요약, 지금, 세는쪽: 설정.세는쪽 || [] });
  return { 요약: 결과, 알림 };
}

function 숫자줄(s) {
  return {
    날: 셈.한국날(Date.parse(s.만든때)),
    사람: s.방문.상태 === '됨' ? s.방문.사람 : null,
    문의: s.행동.상태 === '됨' ? s.행동.문의.합 : null,
    앱받기: s.행동.상태 === '됨' ? s.행동.앱받기.합 : null,
    구글노출: s.검색.구글.상태 === '됨' ? s.검색.구글.노출 : null,
    구글클릭: s.검색.구글.상태 === '됨' ? s.검색.구글.클릭 : null,
    AI언급: s.AI.상태 === '됨' ? s.AI.서비스.reduce((a, x) => a + x.언급, 0) : null,
  };
}

function 보기글(s) {
  if (!s) return '요약이 아직 없다.';
  const 줄 = [`요약 판 ${s.판} · ${s.만든때}`];
  const 칸글 = (이름, c, 몸) => 줄.push(`${이름}: ${c.상태 === '됨' ? 몸() : `${c.상태} — ${c.까닭 || ''}`}${c.낡음 ? ` (${c.까닭})` : ''}`);
  칸글('방문', s.방문, () => `사람 ${s.방문.사람}(앞 ${s.방문.앞사람 ?? '—'}) · ${s.방문.갈래.map((g) => `${g.이름} ${g.수}`).join(' · ')}${s.방문.까닭 && !s.방문.낡음 ? ` · ${s.방문.까닭}` : ''}`);
  칸글('쪽', s.쪽, () => s.쪽.쪽들.map((p) => `${p.이름} ${p.본수}`).join(' · ') || '없음');
  칸글('행동', s.행동, () => `문의 ${s.행동.문의.합} · 앱 받기 ${s.행동.앱받기.합}`);
  칸글('홈 방문 목적', s.목적, () => `방문 ${s.목적.방문} · 고른 방문 ${s.목적.고른방문}`);
  칸글('구글', s.검색.구글, () => `${s.검색.구글.시작}~${s.검색.구글.끝} 노출 ${s.검색.구글.노출} · 클릭 ${s.검색.구글.클릭} · 평균 순위 ${s.검색.구글.평균순위}`);
  줄.push(`네이버: ${s.검색.네이버.상태}`);
  칸글('AI', s.AI, () => `${s.AI.회차날} ${s.AI.서비스.map((x) => `${x.이름} 언급 ${x.언급}/${x.답받음} 인용 ${x.인용}`).join(' · ')}`);
  return 줄.join('\n');
}

async function main(argv) {
  const [명령, ...나머지] = argv;
  const 있나 = (f) => 나머지.includes(f);
  const 값 = (f) => { const i = 나머지.indexOf(f); return i >= 0 ? 나머지[i + 1] : null; };
  if (명령 === '보기') { console.log(보기글(요약.요약읽기())); return 0; }
  if (명령 === 'AI재기') {
    const 세트 = AI.질문세트읽기();
    const 고른 = 값('--질문') ? new Set(값('--질문').split(',')) : null;
    const 서비스 = 값('--서비스') ? Object.fromEntries(Object.entries(AI.서비스들).filter(([k]) => 값('--서비스').split(',').includes(k))) : AI.서비스들;
    const 날 = 셈.한국날(Date.now());
    const 회차 = await AI.회차재기({ 날, 질문들: 세트.질문.filter((q) => !고른 || 고른.has(q.id)), 묻기: 서비스, 원문쓰기: 있나('--시험') ? null : AI.원문쓰기만들기(날) });
    for (const s of 회차.서비스) console.log(`${s.이름}: 일반 ${s.답받음}/${s.일반질문} 답 · 언급 ${s.언급} · 인용 ${s.인용} · 브랜드 인용 ${s.브랜드인용}/${s.브랜드답받음}`);
    if (Object.keys(회차.멈춤).length) console.log('멈춤:', 회차.멈춤);
    return 0;
  }
  if (명령 !== '돌리기') {
    console.error('사용: node tools/사이트방문/모으기.js 돌리기 [--강제] [--AI강제] [--건너뛰기 방문,목적,검색,AI] | 보기 | AI재기 [--질문 …] [--서비스 …] [--시험]');
    return 1;
  }
  const 폴더 = 장부폴더();
  const 마지막 = JSON읽기(path.join(폴더, '마지막.json'), {});
  if (!있나('--강제') && 마지막.돌린때 && Date.now() - Date.parse(마지막.돌린때) < 23 * 3600 * 1000) {
    console.log(`건너뜀 — ${마지막.돌린때}에 돌았다(23시간 안). --강제로 다시 돈다.`);
    return 0;
  }
  // 한 번에 하나만 돈다 — AI 재기는 수십 분 걸려, 3시간 뒤 예약이 다시 깨워도 겹치지 않게 한다(2시간 넘은 잠금은 주인 없는 것으로 본다).
  const 잠금 = path.join(폴더, '돌는중.json');
  fs.mkdirSync(폴더, { recursive: true });
  try { fs.writeFileSync(잠금, JSON.stringify({ pid: process.pid, 시작: new Date().toISOString() }), { flag: 'wx' }); } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const j = JSON읽기(잠금, {});
    if (j.시작 && Date.now() - Date.parse(j.시작) < 2 * 3600 * 1000) { console.log(`건너뜀 — ${j.시작}부터 다른 모으기가 돌고 있다.`); return 0; }
    fs.writeFileSync(잠금, JSON.stringify({ pid: process.pid, 시작: new Date().toISOString(), 앞잠금: j }));
  }
  try {
    const { 요약: 결과, 알림 } = await 돌리기({ 건너뛰기: (값('--건너뛰기') || '').split(',').filter(Boolean), AI강제: 있나('--AI강제') });
    const 자리 = 요약.요약쓰기(결과);
    줄덧붙이기(path.join(폴더, '하루.jsonl'), 숫자줄(결과));
    JSON쓰기(path.join(폴더, '마지막.json'), { 돌린때: 결과.만든때 });
    for (const a of 알림) console.log(a);
    console.log(`요약: ${자리}`);
    console.log(보기글(결과));
    return 0;
  } finally {
    fs.rmSync(잠금, { force: true });
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e.stack || e.message); process.exit(1); });
}

module.exports = { 돌리기, 숫자줄, 보기글, main };
