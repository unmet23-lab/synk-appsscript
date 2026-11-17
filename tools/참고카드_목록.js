#!/usr/bin/env node
'use strict';
/**
 * 참고카드 목록 — docs/참고카드/카드/*.md의 머리 정보를 읽어 docs/참고카드/README.md의 목록 구간을 다시 쓴다.
 *
 *   node tools/참고카드_목록.js           목록 구간을 새로 쓴다
 *   node tools/참고카드_목록.js --확인    쓰지 않고 새 목록만 보여 준다
 *   node tools/참고카드_목록.js --json    카드 머리 정보를 기계 판독용으로
 *
 * README의 「목록 시작」~「목록 끝」 표식 사이만 바꾼다. 맨 위에 판단이 「시안」인데 아직 닫지 않은 카드,
 * 그 아래 README 대상 표 순서대로 대상별 카드를 둔다(카드 하나가 여러 대상에 나올 수 있다).
 * 머리 정보는 `키: 값` 한 줄씩이다(README 「카드 형식」).
 */
const fs = require('fs');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const 폴더 = path.join(루트, 'docs', '참고카드');
const 카드폴더 = path.join(폴더, '카드');
const 안내 = path.join(폴더, 'README.md');
const 시작표식 = '<!-- 목록 시작 · tools/참고카드_목록.js 가 이 구간만 다시 쓴다 -->';
const 끝표식 = '<!-- 목록 끝 -->';
const 대상순서 = ['홈페이지', 'WORLD 앱', '싱크타운', 'LAB 게임', '데스크톱 앱', 'SNS·영상', '브랜드·디자인', 'AI 작업 방식', '엔진·Atlas'];

/** 카드 글에서 머리 정보를 읽는다. 머리가 없으면 null. */
function 머리읽기(글) {
  const 줄들 = 글.replace(/^﻿/, '').split(/\r?\n/);
  if (줄들[0].trim() !== '---') return null;
  const 머리 = {};
  for (let i = 1; i < 줄들.length; i++) {
    if (줄들[i].trim() === '---') return 머리;
    const m = 줄들[i].match(/^([^:]+):\s*(.*)$/);
    if (m) 머리[m[1].trim()] = m[2].trim();
  }
  return null;
}

/** 여러 대상은 앞뒤를 띄운 ` · `나 쉼표로 잇는다. 「SNS·영상」처럼 이름 안에 붙은 `·`는 나누지 않는다. */
function 대상나누기(값) {
  return String(값 || '').split(/\s+·\s+|\s*,\s*/).map(s => s.trim()).filter(Boolean);
}

/**
 * 판단(2026-11-16 유호님): 시안 = 넣으면 확실히 좋아서 시안까지 만든다, 기록 = 적당히 좋아 카드만 둔다, 기각 = 카드 없음.
 * 그 전 카드는 `판단:` 칸이 없어 `언제:`로 읽는다(지금 → 시안, 그 작업 때 → 기록, 안 맞음 → 기각).
 */
const 언제판단 = { '지금': '시안', '그 작업 때': '기록', '안 맞음': '기각' };
function 판단읽기(머리) {
  if (['시안', '기록', '기각'].includes(머리.판단)) return 머리.판단;
  return 언제판단[머리.언제] || '';
}

/**
 * 판단이 시안인 카드의 상태 글은 README 「자동 시안」 절의 꼴로 쓴다. 워크스페이스 「공유한 게시물」은 이 글의 앞머리로 진행을 정한다
 * (`tools/팁장부동기.js` 줄만들기). 11-17에 「안 맞음 — 」 · 「시험함 — 」으로 닫은 카드 다섯 장이 「시안 만들 예정」으로,
 * 10월에 멈춘 「적용 중(…)」 카드 한 장이 진행 중으로 보였다.
 */
const 시안상태꼴 = /^(새로$|시안 만드는 중 — |시안 대기 — |적용 중 — 자동 |적용함|기각 — |보류 — |버림)/;
function 상태꼴어긋남(목록) {
  return 목록.filter(c => !c.오류 && (c.판단 || 판단읽기(c)) === '시안' && !시안상태꼴.test(String(c.상태 || '').trim()));
}

function 카드들() {
  let 파일들 = [];
  try { 파일들 = fs.readdirSync(카드폴더).filter(f => f.endsWith('.md')).sort(); } catch (_) {}
  return 파일들.map(f => {
    const 머리 = 머리읽기(fs.readFileSync(path.join(카드폴더, f), 'utf8'));
    if (!머리) return { 파일: f, 오류: '머리 정보 없음' };
    return { 파일: f, ...머리, 판단: 판단읽기(머리), 대상목록: 대상나누기(머리.대상) };
  });
}

function 한줄(c) {
  const 상태 = String(c.상태 || '');
  const 표시 = 상태.startsWith('적용함') ? ' · 적용함' : 상태.startsWith('시안 대기') ? ' · 시안 대기' : '';
  const 설명 = c.한줄 ? ` — ${c.한줄}` : '';
  return `- [${c.제목 || c.파일}](카드/${c.파일.replace(/ /g, '%20')})${설명} · ${c.판단 || 판단읽기(c) || '판단 미정'} · ${c.공유일 || ''}${표시}`;
}

/** 목록 구간 글. 새 카드가 위로 오게 공유일 내림차순. */
function 목록글(목록) {
  const 정상 = 목록.filter(c => !c.오류).sort((a, b) => String(b.공유일).localeCompare(String(a.공유일)) || a.파일.localeCompare(b.파일));
  const 틀린 = 목록.filter(c => c.오류);
  if (!정상.length && !틀린.length) return '아직 카드가 없다.';
  const 부분 = [];
  const 시안 = 정상.filter(c => (c.판단 || 판단읽기(c)) === '시안' && !/^(적용함|안 맞음|기각|버림)/.test(c.상태 || ''));
  부분.push(`카드 ${정상.length}장. 새 카드가 위.`);
  if (시안.length) 부분.push(['### 시안', ...시안.map(한줄)].join('\n'));
  const 대상들 = [...대상순서];
  정상.forEach(c => c.대상목록.forEach(t => { if (!대상들.includes(t)) 대상들.push(t); }));
  for (const 대상 of 대상들) {
    const 묶음 = 정상.filter(c => c.대상목록.includes(대상));
    if (묶음.length) 부분.push([`### ${대상}`, ...묶음.map(한줄)].join('\n'));
  }
  const 대상없음 = 정상.filter(c => !c.대상목록.length);
  if (대상없음.length) 부분.push(['### 대상 미정', ...대상없음.map(한줄)].join('\n'));
  if (틀린.length) 부분.push(['### 머리 정보를 못 읽은 카드', ...틀린.map(c => `- 카드/${c.파일} — ${c.오류}`)].join('\n'));
  return 부분.join('\n\n');
}

/** README 글의 목록 구간만 바꾼다. 줄끝은 원래 README를 따른다. */
function 갈아쓰기(원문, 새목록) {
  const 시작 = 원문.indexOf(시작표식);
  const 끝 = 원문.indexOf(끝표식);
  if (시작 < 0 || 끝 < 시작) throw new Error('README에 목록 표식이 없다');
  const 줄끝 = 원문.includes('\r\n') ? '\r\n' : '\n';
  const 본문 = 새목록.split('\n').join(줄끝);
  return 원문.slice(0, 시작 + 시작표식.length) + 줄끝 + 본문 + 줄끝 + 원문.slice(끝);
}

function main() {
  const args = process.argv.slice(2);
  const 모르는 = args.filter(a => !['--확인', '--json'].includes(a));
  if (모르는.length) { console.error(`모르는 인자: ${모르는.join(' ')} (아는 것: --확인 --json)`); process.exit(1); }
  const 목록 = 카드들();
  if (args.includes('--json')) { console.log(JSON.stringify(목록, null, 2)); return; }
  for (const c of 상태꼴어긋남(목록)) {
    console.error(`알림: 카드/${c.파일}의 상태 「${String(c.상태 || '(비었음)').slice(0, 30)}」가 README 「자동 시안」 절의 꼴과 다르다. 워크스페이스가 진행을 잘못 보이니 「기각 — 」 · 「적용함 — 」 · 「보류 — 유호님 차례: 」 가운데 맞는 것으로 고친다.`);
  }
  const 새목록 = 목록글(목록);
  if (args.includes('--확인')) { console.log(새목록); return; }
  const 원문 = fs.readFileSync(안내, 'utf8');
  const 새글 = 갈아쓰기(원문, 새목록);
  if (새글 === 원문) { console.log(`목록 그대로 (카드 ${목록.length}장)`); return; }
  // 공용 문서라 임시 파일에 쓴 뒤 바꿔 끼운다(쓰다 실패해도 원본이 남는다).
  const 임시 = `${안내}.${process.pid}.tmp`;
  fs.writeFileSync(임시, 새글, 'utf8');
  fs.renameSync(임시, 안내);
  console.log(`목록을 다시 썼다 (카드 ${목록.length}장)`);
}

if (require.main === module) main();

module.exports = { 머리읽기, 대상나누기, 목록글, 갈아쓰기, 카드들, 판단읽기, 상태꼴어긋남 };
