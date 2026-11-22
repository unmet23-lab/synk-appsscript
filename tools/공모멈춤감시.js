#!/usr/bin/env node
'use strict';
/**
 * 공모 마감 직전 멈춘 작업 감시(2026-11-20).
 *
 * 왜: 11-18~19에 공모를 맡은 곁 세션 셋이 마감을 앞두고 멈췄는데 아무도 몰랐다.
 *   용산 편은 10시간, YOUTH UP 편은 12시간(기다리기 감시가 앱 재시작으로 꺼짐), 빠졌쏭 편은 9시간(유호님께 묻는 창이 끊김) 멈췄다.
 *   유호님 11-20 「다섯 개 다 해」 가운데 첫째.
 *
 * 쓰기(Claude 앱 예약 작업 「공모 멈춤 감시」가 매시 부른다):
 *   node tools/공모멈춤감시.js                  볼 공고와 주인 세션을 JSON으로 낸다. 볼 것이 없으면 볼것이 빈 배열이다.
 *   node tools/공모멈춤감시.js --관찰 <파일>    예약 작업이 본 세션 상태를 받아 세션마다 할 일을 정한다.
 *   node tools/공모멈춤감시.js --깨움 <세션id>   깨운 시각을 적는다. --알림 <세션id>는 유호님께 알린 시각을 적는다.
 *   --보관함 <폴더> · --지금 <ISO 시각>은 시험용이다.
 *
 * 볼 공고: 신청현황.json에서 단계가 「준비 중」 · 「제작 중」이고 마감이 7일 안쪽(또는 지난 지 하루 안)인 항목.
 *   영상 공모는 굽기에 며칠이 걸려, 48시간 안쪽만 보면 사용 한도로 멈춘 세션을 너무 늦게 안다(11-20 매경 편이 마감 열흘 앞에서 Fable 한도로 멈춤).
 *   주인 세션은 항목의 owner_session(local_ id 하나나 배열)이다. 없으면 주인없음으로 낸다.
 * 관찰 파일: [{ session_id, 상태: 'running'|'idle', 끝글: 마지막 대화 몇 줄, 판단: '일함'|'답기다림'|'한도'|'멈춤'|'끝남' }]
 *   판단은 예약 작업이 끝글을 읽고 정한다. 답기다림은 유호님 답 · 승인을 기다리는 경우, 한도는 사용 한도(「hit your … limit」)로 멈춘 경우,
 *   끝남은 제출 · 마무리를 마친 경우다. 한도로 멈춘 세션은 깨워도 못 하므로 유호님께 알린다(모델을 바꾸거나 다른 세션이 이어야 한다).
 * 판정: 쉬고 있는(idle) 세션의 끝글이 문턱 넘게 그대로면 멈춘 것이다.
 *   문턱은 마감 12시간 안쪽 60분, 48시간 안쪽 120분, 그 밖 720분이다. 앱 재시작이 모든 세션의 마지막 활동 시각을 바꾸므로 끝글로 잰다.
 *   멈춤 → 깨우기(마지막으로 깨운 뒤 문턱이 지났을 때만). 답기다림 · 한도 → 알리기(6시간에 한 번).
 *   끝남인데 단계가 그대로 → 알리기(장부를 고쳐야 한다). 주인 세션이 없고 마감이 24시간 안쪽 → 알리기.
 *   알리기 가운데 마감이 48시간 안쪽이면 텔레그램 칸이 참이다. 예약 작업이 그 줄을 유호님 텔레그램으로도 보낸다(11-23).
 *
 * 주인 없는 급한 공고(2026-11-23, 유호님 「이거 왜 체크가 자동으로 안되지?」 → 「지금 고쳐」):
 *   그록 · 조사가 찾은 공고는 지도와 자격 확인까지만 자동이었다. 세라믹 · 광명역 · SVAIFF처럼 자격이 되는 AI 영상 공고가
 *   마감 이틀 안쪽이 되도록 아무도 유호님께 말하지 않았다. 그래서 공모 지도의 열린 영상 공모(신청현황에 없고 자격 「안 됨」이 아닌 것) 가운데
 *   AI 영상이고 마감이 7일 안쪽인 공고를 텔레그램으로 알린다. 공고마다 7일 · 3일 · 1일 안쪽에 들어설 때 한 번씩 알린다.
 *   node tools/공모멈춤감시.js --급한공고알림   알릴 공고를 한 통으로 보내고, 보낸 공고의 알린 단계를 적는다.
 *   시험에서는 SYNK_TG_DRYRUN_DIR로 텔레그램 대신 파일에 쓴다.
 * 상태는 비공개 보관함의 멈춤감시.json에 둔다.
 * 시험: node --test tests/공모멈춤감시.test.js
 */
const fs = require('node:fs');
const path = require('node:path');

const 기본보관함 = 'C:/Users/q1212/Documents/SYNK-보관함/지원사업';
const 상태파일 = '멈춤감시.json';
const 볼단계 = ['준비 중', '제작 중'];
const 창시간 = 7 * 24;
const 알림간격분 = 360;

const 읽기JSON = (file, 없으면) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')) : 없으면);
function 쓰기JSON(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

/** 장부의 마감 글(「2026-11-23T23:59」, 「2026-11-30」)을 시각으로 읽는다. 시간대가 없으면 한국 시각이다. */
function 마감시각(글) {
  const t = String(글 || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(t)) return NaN;
  const 본 = /T\d{2}:\d{2}/.test(t) ? t : `${t.slice(0, 10)}T23:59`;
  return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(본) ? 본 : `${본}+09:00`);
}

const 주인들 = o => [].concat(o.owner_session || []).filter(x => /^local_[0-9a-f-]{8,}$/i.test(String(x)));
const 문턱분 = 남은ms => (남은ms <= 12 * 36e5 ? 60 : 남은ms <= 48 * 36e5 ? 120 : 720);

/** 지금 볼 공고. */
function 볼것(현황, 지금) {
  const out = [];
  for (const o of 현황.items || []) {
    if (!볼단계.includes(o.stage)) continue;
    const 끝 = 마감시각(o.deadline);
    if (!Number.isFinite(끝)) continue;
    const 남은 = 끝 - +지금;
    if (남은 > 창시간 * 36e5 || 남은 < -24 * 36e5) continue;
    out.push({ id: o.id, 이름: o.name, 마감: o.deadline, 남은시간: Math.round(남은 / 36e5 * 10) / 10, 단계: o.stage, 주인: o.owner || '', 주인세션: 주인들(o), 문턱분: 문턱분(남은) });
  }
  return out.sort((a, b) => a.남은시간 - b.남은시간);
}

const 고른글 = t => String(t || '').replace(/\s+/g, ' ').trim().slice(-400);
const 분지남 = (때, 지금) => (때 ? (+지금 - Date.parse(때)) / 6e4 : Infinity);

/**
 * 관찰을 상태에 반영하고 세션마다 할 일을 정한다.
 * → [{ session_id, 할일: '깨우기'|'알리기'|'기다리기', 까닭, 공고: [이름…] }]
 */
function 판정(상태, 관찰, 볼, 지금) {
  상태.sessions ||= {};
  const 결과 = [];
  const 지금글 = new Date(지금).toISOString();
  for (const 본 of 관찰) {
    const sid = 본.session_id;
    const 공고 = 볼.filter(x => x.주인세션.includes(sid));
    if (!공고.length) continue;
    const 문턱 = Math.min(...공고.map(x => x.문턱분));
    const 남은 = Math.min(...공고.map(x => x.남은시간));
    const s = 상태.sessions[sid] ||= {};
    const 글 = 고른글(본.끝글);
    if (s.끝글 !== 글 || 본.상태 === 'running') { s.끝글 = 글; s.같은글부터 = 지금글; }
    const 그대로분 = 분지남(s.같은글부터, 지금);
    const 이름 = 공고.map(x => x.이름);
    let 할일 = '기다리기', 까닭 = '';
    if (본.상태 === 'running' || 본.판단 === '일함') 까닭 = '일하는 중';
    else if (본.판단 === '끝남') {
      if (공고.some(x => 볼단계.includes(x.단계)) && 분지남(s.알린때, 지금) >= 알림간격분) { 할일 = '알리기'; 까닭 = '세션은 마쳤는데 신청현황 단계가 그대로다'; }
      else 까닭 = '마침';
    } else if (그대로분 < 문턱) 까닭 = `쉰 지 ${Math.round(그대로분)}분(문턱 ${문턱}분)`;
    else if (본.판단 === '답기다림' || 본.판단 === '한도') {
      if (분지남(s.알린때, 지금) >= 알림간격분) {
        할일 = '알리기';
        까닭 = 본.판단 === '한도' ? `사용 한도로 ${Math.round(그대로분)}분째 멈췄다(모델을 바꾸거나 다른 세션이 이어야 한다). 마감까지 ${남은}시간`
          : `유호님 답을 ${Math.round(그대로분)}분째 기다린다. 마감까지 ${남은}시간`;
      }
      else 까닭 = '이미 알림';
    } else if (분지남(s.깨운때, 지금) >= 문턱) { 할일 = '깨우기'; 까닭 = `${Math.round(그대로분)}분째 멈춤. 마감까지 ${남은}시간`; }
    else 까닭 = `깨운 지 ${Math.round(분지남(s.깨운때, 지금))}분`;
    결과.push({ session_id: sid, 할일, 까닭, 공고: 이름, 텔레그램: 할일 === '알리기' && 남은 <= 48 });
  }
  for (const x of 볼) {
    if (x.주인세션.length || x.남은시간 > 24) continue;
    const k = `주인없음:${x.id}`;
    const s = 상태.sessions[k] ||= {};
    if (분지남(s.알린때, 지금) < 알림간격분) continue;
    결과.push({ session_id: k, 할일: '알리기', 까닭: `맡은 세션이 장부에 없다. 마감까지 ${x.남은시간}시간`, 공고: [x.이름], 텔레그램: true });
  }
  return 결과;
}

const 급한단계 = [['7일', 7 * 24], ['3일', 72], ['1일', 24]];
const 단계순위 = 이름 => 급한단계.findIndex(([n]) => n === 이름);

/** 공모 지도 열린 영상 공모의 마감 시각. 마감글(「2026-11-23 17:00 KST」)에 시각이 있으면 그 시각, 없으면 마감 날 23:59 한국 시각. */
function 열린마감시각(o) {
  const m = /(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/.exec(String(o.마감글 || ''));
  if (m && m[1] === o.마감) return 마감시각(m[2] ? `${m[1]}T${m[2]}` : m[1]);
  return 마감시각(o.마감);
}

/**
 * 맡은 세션 없이 마감이 7일 안쪽인 AI 영상 공고 가운데 이번에 알릴 것.
 * 열린: 공모지도.열린영상()의 결과(신청현황에 있는 공고와 자격 「안 됨」은 이미 빠져 있다).
 * 공고마다 7일 · 3일 · 1일 안쪽에 들어설 때 한 번씩만 낸다. 한 번에 두 단계를 건너뛰었으면 지금 단계 하나로 낸다.
 */
function 급한공고(열린, 상태, 지금) {
  const out = [];
  for (const o of 열린 || []) {
    if (o.값 !== 'AI 영상') continue;
    const 끝 = 열린마감시각(o);
    if (!Number.isFinite(끝)) continue;
    const 남은 = (끝 - +지금) / 36e5;
    if (남은 <= 0 || 남은 > 급한단계[0][1]) continue;
    const 단계 = [...급한단계].reverse().find(([, 시간]) => 남은 <= 시간)[0];
    const 앞 = 상태.sessions?.[`급한공고:${o.id}`]?.알린단계;
    if (앞 && 단계순위(앞) >= 단계순위(단계)) continue;
    const g = o.공고조건 || {};
    out.push({
      id: o.id, 이름: o.전체이름 || o.이름, 마감: o.마감, 마감시각: new Date(끝).toISOString(), 남은시간: Math.round(남은 * 10) / 10, 단계,
      자격: o.자격 || '확인 전', 주소: o.주소 || '', 상금만원: g.상금합계만원 || null, 작품수: g.작품수상한 || null, 현장참석: !!g.현장참석,
      // 「조건부 허용」에는 AI 그림 · 영상을 막고 소리만 허용하는 공고도 섞여 있다(11-23 수목원 · 정원 숏폼).
      AI조건부: o.AI허용 === '조건부 허용',
    });
  }
  return out.sort((a, b) => a.남은시간 - b.남은시간);
}

const 요일 = ['일', '월', '화', '수', '목', '금', '토'];
function 한국때(iso) {
  const d = new Date(Date.parse(iso) + 9 * 36e5);
  return `${d.getUTCMonth() + 1}-${String(d.getUTCDate()).padStart(2, '0')}(${요일[d.getUTCDay()]}) ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
const 남은글 = h => (h < 1 ? '1시간 안' : h < 48 ? `${Math.floor(h)}시간 남음` : `${Math.floor(h / 24)}일 남음`);

/** 텔레그램 한 통. 처음 읽는 사람이 무엇을 정하면 되는지 알게 쓴다. 12건이 넘으면 나머지는 지도로 넘긴다. */
function 급한글(목록, 지도주소 = '') {
  const 줄 = [`맡은 세션 없이 마감이 다가온 AI 영상 공모가 ${목록.length}건 있습니다. 낼지 정해 주세요.`];
  for (const x of 목록.slice(0, 12)) {
    const 덧 = [x.상금만원 && `총상금 ${x.상금만원.toLocaleString('ko-KR')}만 원`, x.작품수 && `1인 ${x.작품수}작품`, x.현장참석 && '현장 참석',
      x.AI조건부 && 'AI는 조건부 허용이라 조건 확인 필요', x.자격 !== '됨' && '자격 확인 필요'].filter(Boolean);
    줄.push('', `• ${한국때(x.마감시각)} 마감 · ${남은글(x.남은시간)}`, `  ${x.이름}${덧.length ? ` (${덧.join(', ')})` : ''}`);
    if (x.주소) 줄.push(`  ${x.주소}`);
  }
  if (목록.length > 12) 줄.push('', `나머지 ${목록.length - 12}건은 공모 지도에 있습니다.`);
  if (지도주소) 줄.push('', `공모 지도: ${지도주소}`);
  return 줄.join('\n');
}

function 값(argv, 옵션) {
  if (!argv.includes(옵션)) return '';
  const v = argv[argv.indexOf(옵션) + 1];
  if (!v || v.startsWith('--')) throw Error(옵션 + ' 다음에 값을 적어 주세요.');
  return v;
}

/** 공모 지도와 같은 자료로 열린 영상 공모를 만든다. 통합목록이 없으면(시험 보관함) 빈 목록이다. */
function 열린목록(보관함, 지금) {
  if (!fs.existsSync(path.join(보관함, '통합목록.json'))) return { 열린: [], 지도주소: '' };
  const 지도 = require('./공모지도.js');
  const { 현황, 통합, 설정, 자격판정 } = 지도.읽기(보관함);
  return { 열린: 지도.열린영상(통합, 현황, 지도.오늘(지금), 지금, 자격판정), 지도주소: 설정.artifact_url || '' };
}

function main(argv) {
  const 보관함 = 값(argv, '--보관함') || 기본보관함;
  const 지금 = 값(argv, '--지금') ? new Date(값(argv, '--지금')) : new Date();
  const 상태경로 = path.join(보관함, 상태파일);
  const 상태 = 읽기JSON(상태경로, { schema: 'synk-contest-stall-v1', sessions: {} });
  if (argv.includes('--급한공고알림')) {
    const { 열린, 지도주소 } = 열린목록(보관함, 지금);
    const 낼것 = 급한공고(열린, 상태, 지금);
    if (!낼것.length) { console.log(JSON.stringify({ 보냄: 0 })); return 0; }
    const 결과 = require('./텔레그램승인.js').예약알림보내기(급한글(낼것, 지도주소), process.env, { 한도ms: 150000 });
    if (!결과.ok) { console.log(JSON.stringify({ 보냄: 0, 오류: 결과.error || '텔레그램을 보내지 못했다', 공고: 낼것.map(x => x.이름) })); return 1; }
    for (const x of 낼것) Object.assign(상태.sessions[`급한공고:${x.id}`] ||= {}, { 알린단계: x.단계, 알린때: 지금.toISOString(), 이름: x.이름 });
    쓰기JSON(상태경로, 상태);
    console.log(JSON.stringify({ 보냄: 낼것.length, method: 결과.method, 공고: 낼것.map(x => `${x.이름} (${x.단계} 안쪽)`) }, null, 1));
    return 0;
  }
  const 현황 = 읽기JSON(path.join(보관함, '신청현황.json'), { items: [] });
  const 볼 = 볼것(현황, 지금);
  for (const [옵션, 칸] of [['--깨움', '깨운때'], ['--알림', '알린때']]) {
    if (!argv.includes(옵션)) continue;
    const sid = 값(argv, 옵션);
    (상태.sessions[sid] ||= {})[칸] = 지금.toISOString();
    쓰기JSON(상태경로, 상태);
    console.log(`${sid} ${칸} ${지금.toISOString()}`);
    return 0;
  }
  if (argv.includes('--관찰')) {
    const 관찰 = 읽기JSON(값(argv, '--관찰'), null);
    if (!Array.isArray(관찰)) throw Error('관찰 파일은 배열이어야 합니다.');
    const 결과 = 판정(상태, 관찰, 볼, 지금);
    쓰기JSON(상태경로, 상태);
    console.log(JSON.stringify(결과, null, 1));
    return 0;
  }
  const 세션들 = [...new Set(볼.flatMap(x => x.주인세션))];
  // 통합목록을 못 읽어도 멈춤 감시 본래 일(볼것 · 볼세션)은 낸다.
  let 급한 = [], 급한공고오류 = '';
  try { 급한 = 급한공고(열린목록(보관함, 지금).열린, 상태, 지금).map(x => `${x.이름} (${x.단계} 안쪽, ${남은글(x.남은시간)})`); }
  catch (e) { 급한공고오류 = String(e.message || e).slice(0, 300); }
  console.log(JSON.stringify({ 지금: 지금.toISOString(), 볼것: 볼, 볼세션: 세션들, 주인없음: 볼.filter(x => !x.주인세션.length).map(x => x.이름), 급한공고: 급한,
    ...(급한공고오류 && { 급한공고오류 }) }, null, 1));
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}

module.exports = { 마감시각, 볼것, 판정, 문턱분, 급한공고, 급한글, 열린마감시각, main };
