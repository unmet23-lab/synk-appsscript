#!/usr/bin/env node
'use strict';
/* 미학 맹검 — 보여 드리기 · 게시 전에 그림(영상 대표 프레임 · 핵심 순간 띠 · 카드 · 화면 시안 · 썸네일)을 아르곤(Gemini 웹)에게 맹검으로 판정받는다(2026-11-08).
 *
 * 왜: 내부 검수를 통과한 결과물이 유호님께 「AI 슬롭 · 촌스럽다 · 맹하다 · 짜친다」로 거듭 기각됐다(11-03~07 메모에만 일곱 번).
 * 11-08 눈가림 시험(docs/_ops/qa/그록_눈가림_20261107/README.md)에서 유호님이 기각한 판 8장을 「기각」으로 잡은 수가
 * 아르곤 7 · Fable 3 · 그록 0이었다 — 그래서 이 관문은 아르곤이 본다. 유호님 「내 피드백도 … 검수, 검토작업에 적용해줬으면 해」(11-08)로
 * 슬롭 점검표(docs/마케팅/제작양식/광고영상_슬롭점검표.md)의 표 — 유호님 말씀과 「이렇게 본다」 — 를 보낼 때마다 글 파일로 붙인다.
 *
 *   node tools/미학맹검.js <그림>[::<중립 설명>] … [--무엇 "<모든 그림 공통 설명>"] [--쌍 <그림>,<그림>]… [--이름 <작업 이름>] [--편 <편 폴더>] [--준비만]
 *   node tools/미학맹검.js --영상 <최종.mp4> --순간 <초>[::<설명>] --순간 … [--의도 "<대본 의도 한 줄>"] [--마스코트 몽글|없음] --편 <편 폴더>
 *     · --매체 영상,SNS,화면,그림(기본 넷 — 소리는 그림으로 못 들어 뺀다): 그 매체의 지적 · 통과만 붙인다(영상 속 펠트 CG 지적이 펠트 정물 커버로 번진 11-08 오판).
 *     · --영상 · --순간(11-10 LAB 하루 두 편 설계 17): 핵심 순간마다 앞뒤 1초를 0.25초 간격 8칸 띠 한 장으로 만들어 보낸다 — 정지 화면 한 장은
 *       「끝에 뜻이 없다」(2초 앞에 나옴) 같은 헛지적과 움직이는 동안의 문제(잠깐 뜨는 물건 · 손 없이 움직이는 연필)를 못 봤다. 순간 셋 + 마스코트 대조
 *       한 장(정본 몽글 + 세 장면 — 장면끼리 생김새)이 한 대화 4장이다. 마스코트 대조는 LAB 편이면 저절로(--마스코트 없음으로 뺀다).
 *     · --의도: 대본이 일부러 노린 엉뚱함 · 웃음 자리를 한 줄로 알린다(「그가 다 먹었다」의 「그」를 마스코트로 읽은 11-09 헛지적).
 *     · 다시 렌더하면 바뀐 컷만 다시 본다: --편의 지난 기록과 컷 이름(순간@초 · 그림 파일 이름)이 같고 그림 지문(64×64 회색 칸)이 같은 컷은
 *       지난 판정을 이어받고 보내지 않는다(--다시모두로 끈다). 쌍은 늘 다시 본다.
 *     · --편: 결과를 그 편 폴더 게시/미학맹검.json에도 남긴다 — 올리기 전 검사(⑱ · tools/lib/미학관문.js)가 본다.
 *     · 설명은 판정이 드러나지 않게 쓴다(「새 판」 「고친」 「옛」 금지 — 「가상 러닝화 광고의 끝 화면(9:16)」처럼).
 *     · 그림은 화면01…로 이름을 바꿔 보낸다(파일 이름이 답을 흘리지 않게). 아르곤 웹 한 대화에 그림 4장까지 — 쌍은 같은 대화에 둔다.
 *   막힘(11-10 설계 18): 아르곤이 답을 못 주면(거절 한 줄 · 보낸 글 사라짐 · 안 보내짐 · 줄 꺼짐) 묶음마다 꼴 · 보낸 시각 · 거절 첫 줄을 기록 「막힘」에
 *     남긴다 — ⑱은 이 증거와 대체 눈의 결과 파일이 있어야 확인할 것으로 내린다(「맹검못함」 글만으로는 못 넘는다). 대체 순서는 아르곤 → GPT → Opus:
 *       --눈 gpt   같은 그림을 GPT(구독 Codex — tools/codex계정.js, 돈 안 나감)가 본다. 적중(11-08 기각 사례)을 잰 기록이 있어야 쓴다.
 *       --눈 opus  하위 에이전트 재료(opus_질문_<묶음>.md)만 만든다 — 세션이 Agent(opus)로 돌려 답을 opus_답_<묶음>.md에 쓰고
 *                  `--눈 opus --받기 <작업 폴더> --편 <편>`으로 받는다. 하위 에이전트도 못 돌면 `--눈 opus --막힘 "<첫 줄>" --편 <편>`.
 *     대체 결과는 게시/미학맹검_대체.json — 아르곤이 본 컷은 빼고 못 본 컷만 본다. Fable은 언어 교정 몫이라 시각 대체에서 뺀다. 셋 다 막히면 예비편.
 *   node tools/미학맹검.js --적중시험 <눈가림 폴더> [--눈 gpt] [--기준 붙임]   지난 기각 사례로 그 눈의 적중을 잰다(폴더: 문제.json · 답안.json · 그림/화면NN.*,
 *     11-08 판은 공용 작업본 .tmp/맹검눈가림_20261108). 결과는 tools/lib/맹검눈_적중.json에 그 눈 줄로 적는다. 기본은 11-08과 같은 맨 지시문.
 *   끝 코드: 0 기각 없음 · 1 기각 있음 · 2 답을 못 받은 그림이 있음(도구 실패 · 막힘 — 통과로 치지 않는다) · 4 재료만 만듦(--눈 opus — 세션 차례).
 *   결과: <공용 작업본>/.tmp/미학맹검/<이름>/결과.md · 결과.json(git 밖). 판정 · 약점은 Claude가 그림과 대조해 고른다 — 아르곤은 엄하게 본다.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { 공용작업본 } = require('./lib/공용작업본.js');
const { 마지막JSON } = require('./lib/그록호출.js');
const 관문 = require('./lib/미학관문.js');
const 그림눈 = require('./lib/그림눈.js');

const 뿌리 = path.resolve(__dirname, '..');
const 점검표 = path.join(뿌리, 'docs', '마케팅', '제작양식', '광고영상_슬롭점검표.md');
// 11-08 세션 224개에서 모은 지적 C · 통과 P(매체 · 자리 · 범위 주의). 점검표행이 있는 지적은 점검표 표가 정본이라 빼고 붙인다.
const 모음파일 = path.join(뿌리, 'docs', '마케팅', '제작양식', '슬롭점검_모음.json');
const 적중파일 = path.join(뿌리, 'tools', 'lib', '맹검눈_적중.json');
// 그림만 보는 맹검이라 소리는 기본에서 뺀다 — --매체로 고른다(영상 프레임이면 영상, 카드 편이면 SNS, 앱 · 사이트 시안이면 화면).
const 기본매체 = ['영상', 'SNS', '화면', '그림'];
const 한대화 = 4;
const 판정들 = ['그대로 냄', '고쳐서 냄', '기각'];
const 눈들 = ['아르곤', 'gpt', 'opus'];
const 지시문한도 = 4250; // 아르곤웹 4,300자 − 작업 표식
// 띠 — 핵심 순간 앞뒤 1초를 0.25초 간격 8칸(0이 그 순간, 빨간 테). 아르곤은 1초 간격에서 짧은 것을 못 본다(점검표 · 11-08 지시 0.125~0.14초)
const 띠간격 = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75];

/** 마크다운 꾸밈(링크 · 굵게 · 코드)을 걷고 한 줄로. */
const 맨글 = s => String(s || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();
const 자르기 = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const KST시각 = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');

const 매체들 = ['영상', 'SNS', '화면', '그림', '소리'];
/** 자리 칸 앞의 매체(「SNS · 카드 글자」)를 떼어 낸다. 없으면 영상 — 11-08 전 줄은 모두 광고 영상에서 나온 지적이다. */
function 매체가르기(자리) {
  const m = /^(영상|SNS|화면|그림|소리)\s*·\s*(.+)$/.exec(자리);
  return m ? { 매체: m[1], 자리: m[2] } : { 매체: '영상', 자리 };
}

/** 점검표의 지적 줄(| 번호 | 자리 | 유호님 말씀 | 이렇게 본다 | 대신 |)을 읽는다. */
function 기준읽기(글) {
  const 줄들 = [];
  for (const 줄 of String(글).split(/\r?\n/)) {
    const m = /^\|\s*(\d+)\s*\|(.*)\|\s*$/.exec(줄);
    if (!m) continue;
    const 칸 = m[2].split('|').map(맨글);
    if (칸.length < 3) continue;
    줄들.push({ 번호: Number(m[1]), ...매체가르기(칸[0]), 말씀: 칸[1], 본다: 칸[2], 대신: 칸[3] || '' });
  }
  return 줄들;
}

/** 점검표 「통과한 판」 줄(| G번호 | 자리 | 유호님 말씀 | 무엇이 좋았나 |)을 읽는다 — 유호님이 고르거나 만족하신 판. */
function 통과읽기(글) {
  const 줄들 = [];
  for (const 줄 of String(글).split(/\r?\n/)) {
    const m = /^\|\s*G(\d+)\s*\|(.*)\|\s*$/.exec(줄);
    if (!m) continue;
    const 칸 = m[2].split('|').map(맨글);
    if (칸.length < 3) continue;
    줄들.push({ 번호: Number(m[1]), ...매체가르기(칸[0]), 말씀: 칸[1], 좋았나: 칸[2] });
  }
  return 줄들;
}

/** 모음 JSON(지적 · 통과)을 읽어 매체로 고른다. 점검표행이 있는 지적 · 통과는 점검표 표 줄로 이미 붙으니 뺀다. */
function 모음읽기(글, 매체들 = 기본매체) {
  let j = null; try { j = JSON.parse(글); } catch { return { 지적: [], 통과: [] }; }
  const 고르기 = xs => (Array.isArray(xs) ? xs : []).filter(x => x && 매체들.includes(x.매체) && x.점검표행 == null && x.질문)
    .map(x => ({ id: String(x.id), 매체: x.매체, 자리: 맨글(x.자리), 질문: 맨글(x.질문), 말씀: 맨글(x.말씀), 범위: 맨글(x['범위 주의'] || '') }));
  return { 지적: 고르기(j?.지적), 통과: 고르기(j?.통과) };
}

/** 아르곤에게 붙일 기준 글(글 파일). 지적은 K<n> · C<번호>, 통과한 판은 G<n> · P<번호>로 답에 붙이게 한다. */
function 기준글(줄들, 통과 = [], 모음 = { 지적: [], 통과: [] }) {
  return [
    '# 이 회사 대표가 실제 결과물에 한 말 — 지적과 통과한 판',
    '',
    '읽는 법: 대괄호 안은 [매체 · 자리]다. 그 말은 그 매체 · 그 자리에서 나온 것이니, 지금 보는 화면이 같은 매체 · 같은 자리일 때만 근거로 쓴다. 재료나 기법(예: 펠트 · 3D · 명조) 자체를 금지한 말로 넓혀 읽지 않는다 — 같은 재료로 대표가 고른 판이 아래 「통과한 판」에 있다.',
    '',
    '## 지적 — 걸리면 약점 앞에 [K번호] · [C번호]',
    ...줄들.map(r => `K${r.번호} [${r.매체} · ${r.자리}] ${자르기(r.본다, 240)} / 말씀: ${자르기(r.말씀, 110)}`),
    ...모음.지적.map(r => `${r.id} [${r.매체} · ${자르기(r.자리, 60)}] ${자르기(r.질문, 220)} / 말씀: ${자르기(r.말씀, 90)}${r.범위 ? ` (범위 주의: ${자르기(r.범위, 120)})` : ''}`),
    '',
    '## 통과한 판 — 대표가 고르거나 만족한 것. 같은 쪽이면 강점에 [G번호]',
    ...(통과.length || 모음.통과.length ? [
      ...통과.map(r => `G${r.번호} [${r.매체} · ${r.자리}] ${자르기(r.좋았나, 200)} / 말씀: ${자르기(r.말씀, 90)}`),
      ...모음.통과.map(r => `${r.id} [${r.매체} · ${자르기(r.자리, 60)}] ${자르기(r.질문, 200)} / 말씀: ${자르기(r.말씀, 80)}${r.범위 ? ` (범위 주의: ${자르기(r.범위, 100)})` : ''}`),
    ] : ['(아직 없음)']),
    '',
  ].join('\n');
}

function 눈풀기(v) {
  const 눈 = String(v || '').trim().toLowerCase().replace(/^argon$/, '아르곤');
  if (관문.뺀눈[눈]) throw new Error(`--눈 ${v}: ${관문.뺀눈[눈]} — 시각 대체는 GPT → Opus`);
  if (!눈들.includes(눈)) throw new Error(`--눈은 ${눈들.join(' · ')} 가운데 하나(대체 순서 아르곤 → gpt → opus)`);
  return 눈;
}

function 인자(argv) {
  const o = { 그림: [], 쌍: [], 무엇: '', 이름: null, 준비만: false, 편: null, 매체: [...기본매체], 영상: null, 순간: [], 의도: '', 마스코트: null, 눈: '아르곤', 다시모두: false, 받기: null, 막힘: null, 적중시험: null, 기준: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--무엇') o.무엇 = argv[++i] || '';
    else if (a === '--쌍') o.쌍.push(String(argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean));
    else if (a === '--이름') o.이름 = argv[++i];
    else if (a === '--준비만') o.준비만 = true;
    else if (a === '--편') o.편 = argv[++i] || null;
    else if (a === '--매체') { o.매체 = String(argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean); if (!o.매체.length || o.매체.some(m => !매체들.includes(m))) throw new Error(`--매체는 ${매체들.join('·')} 가운데(쉼표로 여럿)`); }
    else if (a === '--영상') o.영상 = argv[++i] || null;
    else if (a === '--순간') {
      const [초글, ...설명] = String(argv[++i] || '').split('::');
      const 초 = Number(초글);
      if (!초글 || !Number.isFinite(초) || 초 < 0) throw new Error(`--순간은 0 이상 초(소수 가능)[::설명]: ${초글}`);
      o.순간.push({ 초, 설명: 설명.join('::') });
    }
    else if (a === '--의도') o.의도 = 맨글(argv[++i] || '');
    else if (a === '--마스코트') { o.마스코트 = String(argv[++i] || ''); if (!['몽글', '없음'].includes(o.마스코트)) throw new Error('--마스코트는 몽글 · 없음'); }
    else if (a === '--눈') o.눈 = 눈풀기(argv[++i]);
    else if (a === '--다시모두') o.다시모두 = true;
    else if (a === '--받기') o.받기 = argv[++i] || null;
    else if (a === '--막힘') o.막힘 = 맨글(argv[++i] || '');
    else if (a === '--적중시험') o.적중시험 = argv[++i] || null;
    else if (a === '--기준') { const v = argv[++i]; if (!['붙임', '없음'].includes(v)) throw new Error('--기준은 붙임 · 없음'); o.기준 = v === '붙임'; }
    else if (a.startsWith('--')) throw new Error(`모르는 인자: ${a}`);
    else { const [파일, ...설명] = a.split('::'); o.그림.push({ 파일, 설명: 설명.join('::') }); }
  }
  if (o.순간.length && !o.영상) throw new Error('--순간은 --영상과 함께 준다(띠를 그 영상에서 뽑는다)');
  if ((o.받기 || o.막힘) && o.눈 !== 'opus') throw new Error('--받기 · --막힘은 --눈 opus와 함께(하위 에이전트 결과를 받는다)');
  if (o.받기 && o.막힘) throw new Error('--받기와 --막힘은 따로');
  if ((o.받기 || o.막힘) && !o.편) throw new Error('--받기 · --막힘은 --편 <편 폴더>와 함께(대체 결과를 그 편에 남긴다)');
  if (o.적중시험) { if (o.눈 === '아르곤') o.눈 = 'gpt'; if (o.눈 !== 'gpt') throw new Error('--적중시험은 도구가 직접 부르는 눈(--눈 gpt)만 — Opus는 세션이 재료로 잰다'); return o; }
  if (!o.그림.length && !o.순간.length && !o.받기 && !o.막힘) throw new Error('그림이 없다 — node tools/미학맹검.js <그림>[::<설명>] … 또는 --영상 <최종.mp4> --순간 <초> …');
  for (const p of o.쌍) if (p.length !== 2) throw new Error(`--쌍은 그림 둘(쉼표): ${p.join(',')}`);
  if (o.의도.length > 200) o.의도 = 자르기(o.의도, 200);
  return o;
}

/** 공개 저장소에 남길 경로 — 이 작업본 · 공용 작업본 안이면 그 안의 상대 경로, 밖(스크래치 · 임시 폴더)이면 파일 이름만. 이 PC 사용자 폴더 경로를 올리지 않는다(11-08). */
function 저장소경로(p, 바탕들 = [뿌리, 공용작업본(뿌리)]) {
  const 글 = String(p || '');
  // 윈도 드라이브 경로는 어느 OS에서든 절대 경로다 — 리눅스 CI의 path.resolve는 상대로 풀어 저장소 안으로 본다(11-08 master syntax-check 빨강)
  if (path.sep === '/' && /^[A-Za-z]:[\\/]/.test(글)) return 글.split(/[\\/]/).pop();
  const 절대 = path.resolve(글);
  for (const 바탕 of 바탕들) {
    const r = path.relative(path.resolve(바탕), 절대);
    if (r && !r.startsWith('..') && !path.isAbsolute(r)) return r.split(path.sep).join('/');
  }
  return path.basename(절대);
}

/** 그림을 한 대화 4장 안으로 나눈다. 쌍의 두 그림은 같은 대화에 둔다. */
function 묶음나누기(번호들, 쌍들, 크기 = 한대화) {
  const 남음 = [...번호들], 묶음 = [];
  const 넣기 = 덩이 => {
    let 자리 = 묶음.find(b => b.length + 덩이.length <= 크기);
    if (!자리) { 자리 = []; 묶음.push(자리); }
    자리.push(...덩이);
  };
  for (const [a, b] of 쌍들) { const 덩이 = [a, b].filter(x => 남음.includes(x)); for (const x of 덩이) 남음.splice(남음.indexOf(x), 1); if (덩이.length) 넣기(덩이); }
  for (const x of 남음) 넣기([x]);
  return 묶음;
}

/** 아르곤(또는 대체 눈)에게 줄 지시문. 선택: 기준(유호님_기준 글 파일을 붙였나 — 11-08 적중시험은 맨 지시문), 의도(대본 의도 한 줄). */
function 지시문(화면들, 쌍들, { 기준 = true, 의도 = '' } = {}) {
  const 쌍글 = 쌍들.length ? `\n그다음 아래 쌍은 같은 자리에 쓸 두 판이다. 쌍마다 더 나은 쪽 하나를 고르고 한 줄 까닭을 적어라.\n쌍: ${쌍들.map(([a, b]) => `(${a}, ${b})`).join(' · ')}\n` : '\n이번에는 쌍이 없다 — "쌍"은 빈 배열로.\n';
  const 띠 = 화면들.some(h => h.종류 === '띠'), 마스코트 = 화면들.some(h => h.종류 === '마스코트');
  return [
    '너는 세계 최고 수준 광고 에이전시의 크리에이티브 디렉터다. 이 회사 대표의 기준은 이렇다: 「모든 화면이 곧 포트폴리오다. 한 부분이라도 AI 슬롭(흔한 AI 생성물 티) · 촌스러움 · 초보 디자이너 티가 나면 기각하고 다시 만든다.」 비교 기준은 지금 가장 트렌디한 최상위 브랜드 · 에이전시 작업이다.',
    ...(기준 ? ['', '붙인 글 파일 「유호님_기준」은 이 대표가 실제 결과물에 한 지적(K)과 고른 판(G)이다. 지적은 [매체 · 자리]가 지금 화면과 같을 때만 근거로 쓰고 재료 · 기법 자체의 금지로 넓혀 읽지 마라. 걸리는 줄이 있으면 약점 앞에 [K번호] · [C번호], 고른 판과 같은 쪽이면 강점에 [G번호] · [P번호]를 붙여라. 목록에 없어도 싸 보이는 곳은 적는다.'] : []),
    ...(의도 ? ['', `이 편이 일부러 노린 것(대본 의도 — 결함이 아니다): ${의도.replace(/[.!?。]\s*$/, '')}. 의도한 엉뚱함 · 웃음 자리는 짚지 말고, 의도와 상관없이 싸 보이는 곳과 물리가 틀린 곳(떠 있는 물건 · 손 없이 움직이는 물건 · 실사 섞임 · 뭉개진 물건)만 짚어라.`] : []),
    ...(띠 ? ['', '「띠」 화면은 한 핵심 순간의 앞뒤 1초를 0.25초 간격으로 찍은 8칸이다(칸 위 숫자는 그 순간과의 초 차이, 빨간 테가 그 순간). 한 칸이 아니라 흐름으로 보고, 움직이는 동안만 보이는 문제(잠깐 뜨는 물건 · 손 없이 움직이는 물건 · 깜박임 · 늦게 뜨는 글자)도 짚어라. 앞뒤 칸에 이미 나온 것을 「없다」고 하지 마라.'] : []),
    ...(마스코트 ? ['', '「마스코트 대조」 화면의 REF 줄은 정본(생김새 기준)일 뿐 판정하지 않는다 — 장면 칸의 펠트 마스코트가 정본 · 서로와 다른 곳(색 · 털결 · 눈 · 비율 · 크기)만 약점으로 적어라.'] : []),
    '',
    `아래 화면 ${화면들.length}장을 하나씩 따로 판정해라(서로 비교하지 말고 한 장씩). 화면마다:`,
    '- 판정: 「그대로 냄」 · 「고쳐서 냄」 · 「기각」 중 하나',
    '- 점수: 1~10(10 = 최상위 에이전시 포트폴리오에 바로 넣음)',
    '- 약점: 싸 보이거나 AI 슬롭 · 촌스러움 · 초보 티가 나는 곳 셋 이하 — 화면의 어디가, 왜',
    '- 강점: 가장 강한 점 하나',
    쌍글,
    '화면 목록(붙인 파일 이름이 화면 번호다)',
    ...화면들.map(h => `- ${h.번호}: ${h.설명 || '(설명 없음)'}`),
    '',
    '답은 JSON 한 덩이만, 앞뒤 설명 없이:',
    '{"낱장":[{"번호":"01","판정":"그대로 냄|고쳐서 냄|기각","점수":0,"약점":["[K번호] …"],"강점":"…"}],"쌍":[{"쌍":"01-02","고름":"01|02","까닭":"…"}]}',
  ].join('\n');
}

/** 묶음 답들을 합치고 판정 꼴을 거른다. */
function 답모으기(답들, 번호들) {
  const 낱장 = new Map(), 쌍 = [];
  for (const j of 답들) {
    if (!j) continue;
    for (const x of Array.isArray(j.낱장) ? j.낱장 : []) {
      const 번호 = String(x?.번호 ?? '').padStart(2, '0');
      if (!번호들.includes(번호) || !판정들.includes(x?.판정)) continue;
      낱장.set(번호, { 번호, 판정: x.판정, 점수: Number.isFinite(x.점수) ? x.점수 : null, 약점: (Array.isArray(x.약점) ? x.약점 : []).map(맨글).filter(Boolean).slice(0, 5), 강점: 맨글(x.강점) });
    }
    for (const p of Array.isArray(j.쌍) ? j.쌍 : []) if (p?.쌍 && p?.고름) 쌍.push({ 쌍: String(p.쌍), 고름: String(p.고름), 까닭: 맨글(p.까닭) });
  }
  const 빠짐 = 번호들.filter(n => !낱장.has(n));
  return { 낱장: 번호들.filter(n => 낱장.has(n)).map(n => 낱장.get(n)), 쌍, 빠짐 };
}

const 끝코드 = 모음 => (모음.빠짐.length ? 2 : 모음.낱장.some(x => x.판정 === '기각') ? 1 : 0);

const 눈머리 = { 아르곤: '아르곤(Gemini 웹)', gpt: 'GPT(구독 Codex)', opus: 'Claude Opus(하위 에이전트)' };
function 결과글(이름, 화면들, 모음, { 눈 = '아르곤', 막힘 = [] } = {}) {
  const 원래 = new Map(화면들.map(h => [h.번호, h]));
  const 줄 = [`# 미학 맹검 · ${이름}`, '', `${눈머리[눈] || 눈} · 유호님 기준 표 붙임 · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, '',
    '| 화면 | 원래 파일 | 판정 | 점수 | 약점 | 강점 |', '|---|---|---|---|---|---|'];
  for (const x of 모음.낱장) 줄.push(`| ${x.번호}${x.이어받음 ? ' (지난 판정)' : ''} | ${path.basename(원래.get(x.번호)?.파일 || '')} | ${x.판정} | ${x.점수 ?? '—'} | ${(x.약점 || []).join('<br>').replace(/\|/g, '/')} | ${String(x.강점 || '').replace(/\|/g, '/')} |`);
  if (모음.쌍.length) { 줄.push('', '쌍', ...모음.쌍.map(p => `- ${p.쌍} → ${p.고름}: ${p.까닭}`)); }
  if (모음.빠짐.length) 줄.push('', `**답을 못 받은 화면: ${모음.빠짐.join(', ')}** — 통과로 치지 않는다. \`node tools/아르곤웹.js 읽기 <작업 파일>\`로 받거나 다시 맹검한다. 막혔으면 대체 눈(--눈 gpt → --눈 opus).`);
  if (막힘.length) 줄.push('', '막힘', ...막힘.map(m => `- 묶음 ${m.묶음}(${(m.화면 || []).join(', ')}): ${m.꼴}${m.보낸때 ? ` · 보낸 때 ${m.보낸때}` : ''}${m.끈때 ? ` · 끈 때 ${m.끈때}` : ''}${m.첫줄 ? ` · 「${m.첫줄}」` : ''}`));
  return 줄.join('\n') + '\n';
}

/* ── 띠 · 마스코트 대조 ───────────────────────────────────────────────── */

/** 핵심 순간 하나의 8칸 프레임 번호(0부터) — 영상 밖은 처음 · 끝 프레임으로 붙인다. */
function 띠프레임(초, fps, 길이) {
  const 끝 = Math.max(0, Math.ceil(길이 * fps) - 1);
  return 띠간격.map(d => Math.min(끝, Math.max(0, Math.round((초 + d) * fps + 1e-6))));
}
/** 칸 이름 — 그 순간은 「3.20s」, 나머지는 실제 뽑힌 프레임과 그 순간의 초 차이(+0.25 · -1.00). */
function 띠이름(초, 프레임들, fps) {
  return 프레임들.map((n, i) => (띠간격[i] === 0 ? `${초.toFixed(2)}s` : (() => { const d = n / fps - 초; return `${d >= 0 ? '+' : '-'}${Math.abs(d).toFixed(2)}`; })()));
}

/** 마스코트 대조 필터 — 위 줄 정본 시트(REF), 아래 줄 장면들. */
function 대조필터(장면수, 이름들, 글꼴파일 = 그림눈.글꼴()) {
  const 글 = (t) => (글꼴파일 ? `,drawtext=fontfile='${String(글꼴파일).replace(/\\/g, '/').replace(/:/g, '\\:')}':text='${String(t).replace(/[':\\]/g, '')}':x=12:y=12:fontsize=40:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=10` : '');
  const 줄 = [`[0:v]format=rgb24${글('REF')},pad=iw+16:ih+16:8:8:color=0x2F6BFF[r]`];
  for (let i = 0; i < 장면수; i += 1) 줄.push(`[${i + 1}:v]format=rgb24${글(이름들[i] || `S${i + 1}`)},pad=iw+16:ih+16:8:8:color=white[s${i}]`);
  const 자리 = ['0_0', ...Array.from({ length: 장면수 }, (_, i) => `${i ? Array.from({ length: i }, (__, k) => `w${k + 1}`).join('+') : '0'}_h0`)];
  줄.push(`[r]${Array.from({ length: 장면수 }, (_, i) => `[s${i}]`).join('')}xstack=inputs=${장면수 + 1}:layout=${자리.join('|')}:fill=white[out]`);
  return 줄.join(';');
}

/** --영상 · --순간에서 띠 · 마스코트 대조 그림을 만든다 → 화면 후보(파일 · 컷 · 설명 · 종류). */
function 띠화면만들기(o, 폴더, 손 = {}) {
  const 실행 = 손.ffmpeg || 그림눈.ffmpeg돌리기;
  const 정보 = (손.영상정보 || 그림눈.영상정보)(o.영상);
  const 띠들 = o.순간.map((m, k) => ({ ...m, k: k + 1, 프레임: 띠프레임(m.초, 정보.fps, 정보.길이) }));
  const 뽑은 = 그림눈.프레임뽑기(o.영상, 띠들.flatMap(d => d.프레임), path.join(폴더, '프레임'), { 폭: 432, 실행 });
  const 후보 = 띠들.map(d => {
    const 파일 = path.join(폴더, `띠_${d.k}.jpg`);
    그림눈.띠만들기(d.프레임.map(n => 뽑은.get(n)), 파일, { 열: 4, 이름들: 띠이름(d.초, d.프레임, 정보.fps), 강조: 띠간격.indexOf(0), 실행 });
    const 앞 = o.무엇 ? `${o.무엇} — ` : '';
    return { 파일, 컷: `순간@${d.초.toFixed(2)}`, 종류: '띠', 설명: `${앞}핵심 순간 ${d.k}(${d.초.toFixed(2)}초) 띠${d.설명 ? ` — ${d.설명}` : ''}` };
  });
  const 마스코트 = o.마스코트 || (/LAB_/.test(`${o.편 || ''} ${o.영상 || ''}`) ? '몽글' : '없음');
  if (마스코트 === '몽글' && 띠들.length) {
    const 큰 = 그림눈.프레임뽑기(o.영상, 띠들.map(d => d.프레임[띠간격.indexOf(0)]), path.join(폴더, '프레임_큰'), { 폭: 540, 실행 });
    const 정본 = (손.정본시트 || 그림눈.정본시트)(path.join(폴더, '정본시트.jpg'), { 칸: 540, 실행 });
    const 장면 = 띠들.map(d => 큰.get(d.프레임[띠간격.indexOf(0)]));
    const 파일 = path.join(폴더, '마스코트대조.jpg');
    실행(['-i', 정본, ...장면.flatMap(f => ['-i', f]), '-filter_complex', 대조필터(장면.length, 띠들.map(d => `S${d.k} ${d.초.toFixed(2)}s`)), '-map', '[out]', '-frames:v', '1', '-q:v', '2', 파일]);
    후보.push({ 파일, 컷: '마스코트', 종류: '마스코트', 설명: `마스코트 대조 — 위 REF 줄은 몽글 정본(정면 · 오른쪽 3/4 · 왼쪽 3/4, 판정 대상 아님), 아래는 핵심 순간 ${띠들.length}장면: 장면끼리 · 정본과 생김새가 다른 곳` });
  }
  return { 후보, 정보 };
}

/* ── 지문 · 이어받기 ─────────────────────────────────────────────────── */

/** 지난 기록(편의 게시 기록)과 그 작업 폴더의 결과.json(격자)을 읽는다. */
function 지난기록읽기(편, 파일이름) {
  if (!편) return null;
  let 기록 = null;
  try { 기록 = JSON.parse(fs.readFileSync(path.join(path.resolve(편), '게시', 파일이름), 'utf8')); } catch { return null; }
  const 격자 = new Map();
  for (const 바탕 of [공용작업본(뿌리), 뿌리]) {
    if (!기록?.결과) break;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(바탕, path.dirname(String(기록.결과)), '결과.json'), 'utf8'));
      for (const h of Array.isArray(j.화면) ? j.화면 : []) if (h.컷 && h.격자) 격자.set(String(h.컷), h.격자);
      if (격자.size) break;
    } catch { /* 다음 바탕 */ }
  }
  return { 기록, 격자 };
}

/** 같은 컷인가 — 컷 이름이 같고, 지문(파일 해시)이 같거나 격자가 같다. */
function 같은컷(새, 옛, 옛격자) {
  if (!새?.컷 || !옛?.컷 || 새.컷 !== 옛.컷) return false;
  if (새.지문 && 옛.지문 && 새.지문 === 옛.지문) return true;
  return 그림눈.격자같음(새.격자, 옛격자);
}

/**
 * 이어받기 — 지난 기록에서 판정이 있는 같은 컷을 찾아 그 판정을 새 번호로 옮긴다. 쌍에 든 화면 · --다시모두는 이어받지 않는다.
 * → Map(새 번호 → 낱장)
 */
function 이어받기(화면들, 지난, { 쌍번호 = new Set(), 다시모두 = false } = {}) {
  const 옮김 = new Map();
  if (!지난?.기록 || 다시모두) return 옮김;
  const 옛화면 = Array.isArray(지난.기록.화면) ? 지난.기록.화면 : [];
  const 옛판정 = new Map((Array.isArray(지난.기록.낱장) ? 지난.기록.낱장 : []).map(x => [String(x.번호), x]));
  for (const h of 화면들) {
    if (쌍번호.has(h.번호)) continue;
    const 옛 = 옛화면.find(x => x.컷 && x.컷 === h.컷 && 옛판정.has(String(x.번호)));
    if (!옛 || !같은컷(h, 옛, 지난.격자.get(String(옛.컷)))) continue;
    const 판정 = 옛판정.get(String(옛.번호));
    옮김.set(h.번호, { ...판정, 번호: h.번호, 이어받음: 판정.이어받음 || { 만든때: 지난.기록.만든때 || null, 이름: 지난.기록.이름 || null, 눈: 지난.기록.눈 || '아르곤' } });
  }
  return 옮김;
}

/* ── 막힌 증거 ───────────────────────────────────────────────────────── */

/** 아르곤웹 공용 차례의 a 줄이 꺼졌나(미학맹검은 --두줄 없이 a 줄만 선다) → 막힘 한 줄 또는 null. */
function 줄꺼짐(차례py = process.env.SYNK_CHARYE_PY || path.join(os.homedir(), 'Documents', 'synk-vendor', '_공용차례', '차례.py')) {
  const f = path.join(path.dirname(차례py), 'gemini-a.off');
  let 글 = '';
  try { 글 = fs.readFileSync(f, 'utf8'); } catch { return null; }
  const 줄 = 글.split(/\r?\n/).map(s => s.trim()).filter(Boolean).pop() || 'gemini-a.off';
  let 때 = null; try { 때 = KST시각(fs.statSync(f).mtimeMs); } catch { /* 모름 */ }
  return { 꼴: '줄 꺼짐', 끈때: 때, 첫줄: 자르기(줄, 200) };
}

/** 묶음 하나의 막힌 증거 — 답 파일(JSON 없는 거절 · 오류 한 줄) · 보냄 표시(보냈는데 대화 · 답 없음) · 안보내짐 표시 · 아르곤웹 출력 꼬리. 답이 JSON이면 null. */
function 막힘읽기(답파일, 출력꼬리 = '', 작업이름 = '') {
  const 읽기 = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
  const 답 = 읽기(답파일);
  if (답 != null) {
    if (마지막JSON(답)) return null;
    const 때 = /^#[^\n]*?(\d{4}-\d\d-\d\d \d\d:\d\d(?::\d\d)?)/m.exec(답)?.[1] || null;
    const 몸 = 답.includes('Gemini의 응답') ? 답.slice(답.indexOf('Gemini의 응답') + 'Gemini의 응답'.length) : 답.replace(/^#.*$/m, '');
    const 첫 = 몸.split(/\r?\n/).map(s => s.trim()).filter(s => s && !/^(대화|올린 것):/.test(s))[0] || '(빈 답)';
    return { 꼴: '거절', 보낸때: 때, 첫줄: 자르기(첫, 200) };
  }
  const 표시 = (f) => { const t = 읽기(f); if (t == null) return null; try { const j = JSON.parse(t); return Array.isArray(j) ? j[j.length - 1] : j; } catch { return {}; } };
  const 보냄 = 표시(`${답파일}.보냄.json`);
  if (보냄) return { 꼴: '답 없음', 보낸때: 보냄.시각 || null, 첫줄: 보냄.대화 ? '대화는 생겼는데 답을 못 읽음' : '보낸 글이 사라짐(대화 없음)' };
  const 안 = 표시(`${답파일}.안보내짐.json`);
  if (안) return { 꼴: '안 보내짐', 보낸때: 안.시각 || null, 첫줄: 자르기(String(안.까닭 || '사이드바에도 없음'), 200) };
  const 줄들 = String(출력꼬리).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const 그줄 = (작업이름 && [...줄들].reverse().find(s => s.includes(작업이름))) || 줄들.filter(s => /실패|멈춤|안 함|못/.test(s)).pop() || 줄들.pop() || '';
  return { 꼴: '보내기 실패', 보낸때: null, 첫줄: 자르기(그줄 || '아르곤웹 출력 없음', 200) };
}

/* ── 부르기 ─────────────────────────────────────────────────────────── */

/** 아르곤웹 보내기 → (답 없는 작업만) 읽기. 출력은 그대로 흘리며 꼬리를 남긴다. */
async function 아르곤부르기(작업들) {
  const 아르곤 = path.join(뿌리, 'tools', '아르곤웹.js');
  let 꼬리 = '';
  const 한번 = (명령) => new Promise((resolve) => {
    const 남은 = 작업들.filter(w => !fs.existsSync(w.답)).map(w => w.작업);
    if (!남은.length) return resolve(0);
    const c = spawn(process.execPath, [아르곤, 명령, ...남은], { cwd: 뿌리, stdio: ['inherit', 'pipe', 'pipe'] });
    const 흘림 = (곳) => (d) => { 곳.write(d); 꼬리 = (꼬리 + d).slice(-20000); };
    c.stdout.on('data', 흘림(process.stdout));
    c.stderr.on('data', 흘림(process.stderr));
    c.on('error', (e) => { 꼬리 += `\n${e.message}`; resolve(1); });
    c.on('close', (code) => resolve(code ?? 1));
  });
  await 한번('보내기');
  if (작업들.some(w => !fs.existsSync(w.답))) await 한번('읽기');
  return 꼬리;
}

function 적중읽기(파일 = 적중파일) { try { return JSON.parse(fs.readFileSync(파일, 'utf8')); } catch { return { 눈: {} }; } }
function 적중요약(눈, 파일 = 적중파일) {
  const j = 적중읽기(파일), e = j.눈?.[눈], 아르곤 = j.눈?.아르곤, 시험 = j.시험 || {};
  if (!e) return null;
  return { 잰날: e.잰날, 기각: `${e.기각잡음}/${시험.기각 ?? 8}`, 채택: `${e.채택맞음}/${시험.채택 ?? 4}`, 쌍: `${e.쌍맞음}/${시험.쌍 ?? 4}`, 시험: 시험.이름 || '', ...(아르곤 ? { 아르곤: `${아르곤.기각잡음}/${시험.기각 ?? 8}` } : {}) };
}

/** 유호님 기준을 GPT 지시문 뒤에 글로 붙인다(Codex는 글 파일을 첨부로 못 받는다). */
const GPT글 = (지시, 기준글값) => (기준글값 ? `${지시}\n\n[붙인 글 파일 「유호님_기준」 — 아래가 그 전문]\n${기준글값}` : 지시);

/** opus 하위 에이전트 재료 한 장. */
function opus질문(지시, 그림들, 기준파일, 답파일) {
  return [
    '너는 이 회사 미학 맹검의 대체 눈이다(아르곤이 막혀 대신 본다). 아래 그림 파일을 Read 도구로 순서대로 열어 보고, 맨 아래 지시대로 판정한다.',
    `답은 JSON 한 덩이만 — 그 글을 Write 도구로 ${답파일}에 그대로 저장하고, 마지막 메시지에도 같은 JSON을 쓴다. 다른 파일은 읽거나 고치지 않는다.`,
    '',
    '그림(파일 이름이 화면 번호다):',
    ...그림들.map((f, i) => `${i + 1}. ${f}`),
    ...(기준파일 ? ['', `붙인 글 파일 「유호님_기준」: ${기준파일}`] : []),
    '',
    '---',
    '',
    지시,
    '',
  ].join('\n');
}

/* ── 기록 ───────────────────────────────────────────────────────────── */

const 공개화면 = (화면들) => 화면들.map(({ 번호, 컷, 파일, 설명, 지문, 종류 }) => ({ 번호, ...(컷 ? { 컷 } : {}), 파일: 저장소경로(파일), 설명, ...(지문 ? { 지문 } : {}), ...(종류 && 종류 !== '그림' ? { 종류 } : {}) }));
const 공개막힘 = (막힘) => 막힘.map(({ 묶음, 화면, 꼴, 보낸때, 끈때, 첫줄 }) => ({ 묶음, 화면, 꼴, ...(보낸때 ? { 보낸때 } : {}), ...(끈때 ? { 끈때 } : {}), ...(첫줄 ? { 첫줄 } : {}) }));
function 영상기록(영상) {
  if (!영상) return undefined;
  try { const s = fs.statSync(영상); return [{ 파일: 저장소경로(영상), 이름: path.basename(영상), 크기: s.size, 바뀐때: new Date(s.mtimeMs).toISOString() }]; } catch { return undefined; }
}

function 편기록쓰기(편, 파일이름, 기록) {
  const 게시 = path.join(path.resolve(편), '게시'); fs.mkdirSync(게시, { recursive: true });
  const 파일 = path.join(게시, 파일이름);
  fs.writeFileSync(파일, `${JSON.stringify(기록, null, 1)}\n`);
  return 파일;
}

/* ── 적중시험 ───────────────────────────────────────────────────────── */

/** 답안(정답 기각 · 채택 · 쌍)으로 답을 채점한다(11-08 blind-run 채점과 같은 셈). */
function 채점(답안, 모음) {
  const 판 = new Map(모음.낱장.map(x => [x.번호, x]));
  const r = { 기각잡음: 0, 기각반: 0, 기각놓침: 0, 채택맞음: 0, 채택깎음: 0, 답없음: 0, 쌍맞음: 0, 쌍수: 0, 평균점수: { 기각: null, 채택: null } };
  const 점 = { 기각: [], 채택: [] };
  for (const k of 답안.답안 || []) {
    const a = 판.get(String(k.번호));
    if (!a) { r.답없음 += 1; continue; }
    if (Number.isFinite(a.점수)) 점[k.판정 === '기각' ? '기각' : '채택'].push(a.점수);
    if (k.판정 === '기각') { if (a.판정 === '기각') r.기각잡음 += 1; else if (a.판정 === '고쳐서 냄') r.기각반 += 1; else r.기각놓침 += 1; }
    else if (a.판정 === '그대로 냄') r.채택맞음 += 1; else r.채택깎음 += 1;
  }
  for (const p of 답안.쌍들 || []) {
    r.쌍수 += 1;
    const q = 모음.쌍.find(x => x.쌍 === `${p.A}-${p.B}` || x.쌍 === `${p.B}-${p.A}`);
    if (q && String(q.고름).padStart(2, '0') === String(p.채택)) r.쌍맞음 += 1;
  }
  const 평 = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
  r.평균점수 = { 기각: 평(점.기각), 채택: 평(점.채택) };
  return r;
}

async function 적중시험(o, 손 = {}) {
  const 폴더 = path.resolve(o.적중시험);
  const 문제 = JSON.parse(fs.readFileSync(path.join(폴더, '문제.json'), 'utf8'));
  const 답안 = JSON.parse(fs.readFileSync(path.join(폴더, '답안.json'), 'utf8'));
  const 그림폴더 = path.join(폴더, '그림');
  const 이름들 = fs.readdirSync(그림폴더);
  const 화면들 = (문제.낱장 || []).map(x => {
    const 번호 = String(x.번호).padStart(2, '0');
    const 이름 = 이름들.find(f => f.startsWith(`화면${번호}.`));
    if (!이름) throw new Error(`그림이 없다: ${그림폴더}/화면${번호}.*`);
    return { 번호, 파일: path.join(그림폴더, 이름), 보낸파일: path.join(그림폴더, 이름), 설명: x.무엇 || '' };
  });
  const 쌍들 = (문제.쌍들 || []).map(p => [String(p.A).padStart(2, '0'), String(p.B).padStart(2, '0')]);
  const 기준 = o.기준 === true;
  const 작업폴더 = path.join(손.작업뿌리 || 작업뿌리(), o.이름 || `적중-${o.눈}-${KST시각().replace(/[-: ]/g, '').slice(0, 12)}`);
  fs.mkdirSync(작업폴더, { recursive: true });
  const 기준글값 = 기준 ? 기준만들기(o.매체).글 : '';
  const 묻기 = 손.GPT묻기 || 그림눈.GPT묻기;
  const 답들 = [], 시도 = [];
  for (const [k, 묶음] of 묶음나누기(화면들.map(h => h.번호), 쌍들).entries()) {
    const 이 = 화면들.filter(h => 묶음.includes(h.번호)), 이쌍 = 쌍들.filter(([a, b]) => 묶음.includes(a) && 묶음.includes(b));
    const 답파일 = path.join(작업폴더, `답_gpt_${k + 1}.md`);
    const r = await 묻기({ 그림들: 이.map(h => h.보낸파일), 글: GPT글(지시문(이, 이쌍, { 기준 }), 기준글값), 답파일 });
    시도.push({ 묶음: k + 1, 결과: r.결과, 꼴: r.꼴, 첫줄: r.첫줄, 초: r.초 });
    답들.push(r.결과 === '받음' ? 마지막JSON(r.답) : null);
    console.log(`  묶음 ${k + 1}: ${r.결과}${r.결과 === '받음' ? '' : ` — ${r.꼴} · ${r.첫줄}`} (${r.초}초)`);
  }
  const 모음 = 답모으기(답들, 화면들.map(h => h.번호));
  const 점수 = 채점(답안, 모음);
  fs.writeFileSync(path.join(작업폴더, '결과.json'), `${JSON.stringify({ 이름: path.basename(작업폴더), 눈: o.눈, 기준, 화면: 화면들.map(({ 번호, 설명 }) => ({ 번호, 설명 })), ...모음, 시도, 점수 }, null, 1)}\n`);
  console.log(`적중 · ${o.눈} — 기각 8장 중 「기각」 ${점수.기각잡음} · 「고쳐서 냄」 ${점수.기각반} · 놓침 ${점수.기각놓침} | 채택 4장 중 「그대로 냄」 ${점수.채택맞음} | 쌍 ${점수.쌍맞음}/${점수.쌍수} | 답 없음 ${점수.답없음} → ${작업폴더}`);
  if (점수.답없음) { console.error('답을 못 받은 그림이 있어 적중 기록을 쓰지 않는다(다시 잰다).'); return 2; }
  if (o.준비만) return 0;
  const j = 적중읽기(손.적중파일 || 적중파일);
  j.눈 = j.눈 || {};
  j.눈[o.눈] = { 잰날: KST시각().slice(0, 10), ...점수, 시각대체: true, 지시문: 기준 ? '유호님 기준 붙임' : '11-08과 같은 맨 지시문', 모델: '구독(Codex — 모델 지정 못함)', 묶음: '한 대화 4장 · 쌍은 같은 대화' };
  delete j.눈[o.눈].답없음; delete j.눈[o.눈].쌍수;
  fs.writeFileSync(손.적중파일 || 적중파일, `${JSON.stringify(j, null, 1)}\n`);
  console.log(`적중 기록 → ${저장소경로(손.적중파일 || 적중파일)}`);
  return 0;
}

const 작업뿌리 = () => path.join(공용작업본(뿌리), '.tmp', '미학맹검');

/* ── 본 흐름 ────────────────────────────────────────────────────────── */

function 기준만들기(매체) {
  const 표글 = fs.readFileSync(점검표, 'utf8');
  const 표기준 = 기준읽기(표글);
  if (!표기준.length) throw new Error(`점검표에서 기준 줄을 못 읽었다: ${점검표}`);
  const 기준 = 표기준.filter(r => 매체.includes(r.매체)), 통과 = 통과읽기(표글).filter(r => 매체.includes(r.매체));
  const 기준모음 = fs.existsSync(모음파일) ? 모음읽기(fs.readFileSync(모음파일, 'utf8'), 매체) : { 지적: [], 통과: [] };
  return { 글: 기준글(기준, 통과, 기준모음), 지적수: 기준.length + 기준모음.지적.length, 통과수: 통과.length + 기준모음.통과.length };
}

/** 묶음 답 파일 이름 — 묶음 안 그림 · 지시문이 같을 때만 같은 이름(다시 부를 때 이어 받고, 묶음이 바뀌면 새로 보낸다). */
function 묶음이름(k, 지시, 그림들) {
  const h = crypto.createHash('sha1').update(지시);
  for (const f of 그림들) { try { h.update(fs.readFileSync(f)); } catch { h.update(String(f)); } }
  return `${k}_${h.digest('hex').slice(0, 6)}`;
}

async function main(argv, 손 = {}) {
  const o = 인자(argv);
  if (o.적중시험) return 적중시험(o, 손);
  const 기록파일 = o.눈 === '아르곤' ? 관문.기록이름 : 관문.대체이름;
  if (o.받기 || o.막힘) return opus받기(o, 손);
  if (o.눈 === 'gpt' && !적중요약('gpt', 손.적중파일)) throw new Error('GPT 적중을 아직 안 쟀다 — node tools/미학맹검.js --적중시험 .tmp/맹검눈가림_20261108 --눈 gpt (11-10 설계 18: 지난 기각 사례로 적중을 먼저 잰다)');
  const 이름 = o.이름 || `맹검-${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '')}${o.눈 === '아르곤' ? '' : `-${o.눈}`}`;
  const 폴더 = path.join(손.작업뿌리 || 작업뿌리(), 이름);
  fs.mkdirSync(폴더, { recursive: true });
  const 기준 = 기준만들기(o.매체);
  const 기준파일 = path.join(폴더, '유호님_기준.md');
  fs.writeFileSync(기준파일, 기준.글);

  // 화면 — 띠(--영상 --순간) · 마스코트 대조 · 그림
  const 후보 = o.순간.length ? 띠화면만들기(o, 폴더, 손).후보 : [];
  const 쓴컷 = new Map();
  for (const g of o.그림) {
    const 원 = path.resolve(g.파일); if (!fs.existsSync(원)) throw new Error(`그림이 없다: ${g.파일}`);
    const 기본 = path.basename(원).replace(/\.[^.]+$/, '');
    const n = (쓴컷.get(기본) || 0) + 1; 쓴컷.set(기본, n);
    후보.push({ 파일: 원, 컷: n > 1 ? `${기본}#${n}` : 기본, 종류: '그림', 설명: g.설명 || o.무엇 });
  }
  const 지문셈 = 손.격자 || ((f) => 그림눈.격자(f, 손.ffmpeg || 그림눈.ffmpeg돌리기));
  const 화면들 = 후보.map((h, i) => {
    const 번호 = String(i + 1).padStart(2, '0'); const 새 = path.join(폴더, `화면${번호}${path.extname(h.파일).toLowerCase()}`);
    if (path.resolve(h.파일) !== path.resolve(새)) fs.copyFileSync(h.파일, 새);
    let 격자 = null; try { 격자 = 지문셈(새); } catch (e) { console.error(`  (지문 못 냄 — 이어받기 없이 보낸다: ${path.basename(h.파일)} · ${e.message})`); }
    return { ...h, 번호, 보낸파일: 새, 설명: 자르기(맨글(h.설명), 220), 지문: 그림눈.파일해시(새), 격자 };
  });
  const 번호of = 파일 => 화면들.find(h => h.파일 === path.resolve(파일))?.번호;
  const 쌍들 = o.쌍.map(([a, b]) => { const x = 번호of(a), y = 번호of(b); if (!x || !y) throw new Error(`--쌍의 그림이 목록에 없다: ${a}, ${b}`); return [x, y]; });
  const 쌍번호 = new Set(쌍들.flat());

  // 지난 판정 이어받기 — 같은 눈의 지난 기록, 그리고 대체 눈이면 아르곤이 이미 본 컷은 뺀다
  const 지난 = 지난기록읽기(o.편, 기록파일);
  const 옮김 = 이어받기(화면들, 지난, { 쌍번호, 다시모두: o.다시모두 });
  const 아르곤지난 = o.눈 === '아르곤' ? null : 지난기록읽기(o.편, 관문.기록이름);
  const 아르곤본 = o.눈 === '아르곤' ? new Map() : 이어받기(화면들, 아르곤지난, { 쌍번호 });
  const 대상 = 화면들.filter(h => !아르곤본.has(h.번호));
  const 보낼 = 대상.filter(h => !옮김.has(h.번호)).map(h => h.번호);
  const 묶음들 = 묶음나누기(보낼, 쌍들.filter(([a, b]) => 보낼.includes(a) && 보낼.includes(b)));
  const 작업들 = 묶음들.map((묶음, k) => {
    const 이 = 화면들.filter(h => 묶음.includes(h.번호)); const 이쌍 = 쌍들.filter(([a, b]) => 묶음.includes(a) && 묶음.includes(b));
    let 지시 = 지시문(이, 이쌍, { 의도: o.의도 });
    if (지시.length > 지시문한도) { for (const h of 이) h.설명 = 자르기(h.설명, 120); 지시 = 지시문(이, 이쌍, { 의도: o.의도 }); }
    if (지시.length > 지시문한도) throw new Error(`지시문 ${지시.length}자 — ${지시문한도}자 안으로(설명 · --의도를 줄인다)`);
    const 꼬리 = 묶음이름(k + 1, 지시, 이.map(h => h.보낸파일));
    const 지시파일 = path.join(폴더, `지시_${꼬리}.md`); fs.writeFileSync(지시파일, 지시);
    const 답 = path.join(폴더, o.눈 === '아르곤' ? `답_${꼬리}.md` : `${o.눈}_답_${꼬리}.md`);
    const 작업 = path.join(폴더, `작업_${꼬리}.json`);
    fs.writeFileSync(작업, JSON.stringify({ files: [...이.map(h => h.보낸파일), 기준파일], promptFile: path.basename(지시파일), out: path.basename(답) }, null, 1));
    return { k: k + 1, 번호들: 묶음, 이, 지시, 작업, 답, 꼬리 };
  });
  fs.writeFileSync(path.join(폴더, '화면.json'), JSON.stringify(화면들.map(({ 번호, 컷, 파일, 설명, 종류, 지문, 격자 }) => ({ 번호, 컷, 파일, 설명, 종류, 지문, 격자 })), null, 1));
  fs.writeFileSync(path.join(폴더, '묶음.json'), JSON.stringify({ 눈: o.눈, 편: o.편 ? path.resolve(o.편) : null, 영상: o.영상 ? path.resolve(o.영상) : null, 의도: o.의도, 묶음: 작업들.map(w => ({ k: w.k, 번호들: w.번호들, 답: path.basename(w.답), 꼬리: w.꼬리 })), 옮김: [...옮김.values()], 아르곤본: [...아르곤본.keys()] }, null, 1));
  console.log(`미학 맹검 ${이름} · ${눈머리[o.눈]}: 화면 ${화면들.length}장(띠 ${화면들.filter(h => h.종류 === '띠').length} · 마스코트 ${화면들.filter(h => h.종류 === '마스코트').length}) · 지난 판정 이어받음 ${옮김.size}${o.눈 === '아르곤' ? '' : ` · 아르곤이 본 컷 ${아르곤본.size}장 뺌`} · 보낼 ${보낼.length}장 · 대화 ${작업들.length}개 · 지적 ${기준.지적수}줄 · 통과 ${기준.통과수}줄 → ${폴더}`);
  if (o.준비만) { console.log(작업들.map(w => w.작업).join('\n')); return 0; }

  // 부르기
  const 막힘 = [];
  const 시도 = [];
  if (o.눈 === 'opus') {
    for (const w of 작업들) fs.writeFileSync(path.join(폴더, `opus_질문_${w.꼬리}.md`), opus질문(w.지시, w.이.map(h => h.보낸파일), 기준파일, w.답));
    console.log(`재료만 만들었다(세션 차례) — 묶음마다 Agent(model: opus)에게 ${path.join(폴더, 'opus_질문_<묶음>.md')}를 그대로 주고 답을 opus_답_<묶음>.md에 쓰게 한 뒤:\n  node tools/미학맹검.js --눈 opus --받기 ${폴더} --편 ${o.편 || '<편 폴더>'}\n  하위 에이전트도 못 돌면: node tools/미학맹검.js --눈 opus --막힘 "<첫 줄>" --편 ${o.편 || '<편 폴더>'}\n${작업들.map(w => `  ${path.join(폴더, `opus_질문_${w.꼬리}.md`)}`).join('\n')}`);
    return 4;
  }
  if (o.눈 === '아르곤' && 작업들.length) {
    const 꺼짐 = (손.줄꺼짐 || 줄꺼짐)();
    if (꺼짐) {
      console.log(`  아르곤 a 줄이 꺼져 있다(${꺼짐.첫줄}) — 보내지 않고 막힘으로 적는다. 대체 눈: --눈 gpt`);
      for (const w of 작업들) 막힘.push({ 묶음: w.k, 화면: w.번호들, ...꺼짐 });
    } else {
      const 꼬리 = await (손.아르곤부르기 || 아르곤부르기)(작업들);
      for (const w of 작업들) { const m = 막힘읽기(w.답, 꼬리, path.basename(w.작업, '.json')); if (m) 막힘.push({ 묶음: w.k, 화면: w.번호들, ...m }); }
    }
  }
  if (o.눈 === 'gpt') {
    const 묻기 = 손.GPT묻기 || 그림눈.GPT묻기;
    for (const w of 작업들) {
      if (fs.existsSync(w.답) && 마지막JSON(fs.readFileSync(w.답, 'utf8'))) { 시도.push({ 눈: 'gpt', 결과: '받음', 때: new Date().toISOString(), 묶음: w.k, 이어받음: true }); continue; }
      const r = await 묻기({ 그림들: w.이.map(h => h.보낸파일), 글: GPT글(w.지시, 기준.글), 답파일: w.답 });
      console.log(`  GPT 묶음 ${w.k}: ${r.결과}${r.결과 === '받음' ? '' : ` — ${r.꼴} · ${r.첫줄}`} (${r.초}초)`);
      if (r.결과 === '받음' && !마지막JSON(r.답)) { r.결과 = '막힘'; r.꼴 = '거절'; r.첫줄 = 자르기(맨글(r.답), 200); }
      시도.push({ 눈: 'gpt', 결과: r.결과, ...(r.결과 === '막힘' ? { 꼴: r.꼴, 첫줄: r.첫줄 } : {}), 때: new Date().toISOString(), 묶음: w.k });
      if (r.결과 === '막힘') { 막힘.push({ 묶음: w.k, 화면: w.번호들, 꼴: r.꼴, 보낸때: KST시각(), 첫줄: r.첫줄 }); if (r.꼴 === '계정 없음') break; }
    }
  }
  return 마무리(o, { 이름, 폴더, 화면들, 작업들, 옮김, 아르곤본, 막힘, 시도, 쌍들, 적중파일: 손.적중파일 });
}

/** 답 모으기 → 결과 파일 · 편 기록. */
function 마무리(o, { 이름, 폴더, 화면들, 작업들, 옮김, 아르곤본, 막힘, 시도, 적중파일: 적중쪽 = 적중파일 }) {
  const 답들 = 작업들.map(w => (fs.existsSync(w.답) ? 마지막JSON(fs.readFileSync(w.답, 'utf8')) : null));
  const 대상 = 화면들.filter(h => !아르곤본.has(h.번호));
  const 새 = 답모으기(답들, 작업들.flatMap(w => w.번호들));
  const 낱장 = new Map([...옮김.entries(), ...새.낱장.map(x => [x.번호, x])]);
  const 모음 = { 낱장: 대상.map(h => 낱장.get(h.번호)).filter(Boolean), 쌍: 새.쌍, 빠짐: 대상.map(h => h.번호).filter(n => !낱장.has(n)) };
  const 시작 = new Date().toISOString();
  fs.writeFileSync(path.join(폴더, '결과.json'), JSON.stringify({ 이름, 눈: o.눈, 의도: o.의도, 화면: 화면들.map(({ 번호, 컷, 파일, 설명, 종류, 지문, 격자 }) => ({ 번호, 컷, 파일, 설명, 종류, 지문, 격자 })), ...모음, 막힘, 시도, 아르곤본: [...아르곤본.keys()] }, null, 1));
  fs.writeFileSync(path.join(폴더, '결과.md'), 결과글(이름, 화면들, 모음, { 눈: o.눈, 막힘 }));
  if (o.편) {
    const 공통 = { 판: 2, 만든때: 시작, 이름, 눈: o.눈, 결과: 저장소경로(path.join(폴더, '결과.md')), ...(o.의도 ? { 의도: o.의도 } : {}), ...(o.영상 ? { 영상: 영상기록(path.resolve(o.영상)) } : {}) };
    if (o.눈 === '아르곤') {
      편기록쓰기(o.편, 관문.기록이름, { ...공통, 화면: 공개화면(화면들), ...모음, ...(막힘.length ? { 막힘: 공개막힘(막힘) } : {}) });
    } else {
      const P = 지난기록읽기(o.편, 관문.기록이름)?.기록 || null;
      const 앞S = 지난기록읽기(o.편, 관문.대체이름)?.기록 || null;
      const P만든 = Date.parse(P?.만든때 || '') || 0;
      const 이어시도 = 앞S && (Date.parse(앞S.만든때 || '') || 0) + 1000 >= P만든 ? (Array.isArray(앞S.시도) ? 앞S.시도 : []) : [];
      const 이번시도 = 시도.length ? 시도 : [{ 눈: o.눈, 결과: 모음.낱장.length ? '받음' : '막힘', 때: 시작 }];
      편기록쓰기(o.편, 관문.대체이름, { ...공통, 화면: 공개화면(대상), ...모음, 덮음: 대상.map(h => h.컷).filter(Boolean),
        적중: 적중요약(o.눈, 적중쪽), 시도: [...이어시도, ...이번시도.map(({ 묶음, 이어받음, ...t }) => t)],
        ...(P ? { 앞눈: { 눈: P.눈 || '아르곤', 만든때: P.만든때 || null, ...(Array.isArray(P.막힘) ? { 막힘: P.막힘 } : {}) } } : {}) });
    }
  }
  const 셈 = 판정들.map(p => `${p} ${모음.낱장.filter(x => x.판정 === p).length}`).join(' · ');
  console.log(`결과(${눈머리[o.눈]}): ${셈}${옮김.size ? ` · 지난 판정 이어받음 ${옮김.size}` : ''}${모음.빠짐.length ? ` · 답 없음 ${모음.빠짐.length}` : ''}${막힘.length ? ` · 막힘 ${막힘.map(m => m.꼴).join('/')}` : ''} → ${path.join(폴더, '결과.md')}`);
  if (막힘.length && o.눈 === '아르곤') console.log('  아르곤이 막혔다 — 같은 그림 · 같은 --영상 --순간에 --눈 gpt를 붙여 다시 부른다(GPT도 막히면 --눈 opus). 셋 다 막히면 예비편으로 바꾼다.');
  return 끝코드(모음);
}

/** --눈 opus --받기 <작업 폴더> | --막힘 "<첫 줄>" — 하위 에이전트 결과를 대체 기록으로 받는다. */
function opus받기(o, 손 = {}) {
  if (o.막힘) {
    const P = 지난기록읽기(o.편, 관문.기록이름)?.기록 || null;
    const 앞S = 지난기록읽기(o.편, 관문.대체이름)?.기록 || null;
    const P만든 = Date.parse(P?.만든때 || '') || 0;
    const 이어시도 = 앞S && (Date.parse(앞S.만든때 || '') || 0) + 1000 >= P만든 ? (Array.isArray(앞S.시도) ? 앞S.시도 : []) : [];
    const 지금 = new Date().toISOString();
    const 기록 = { ...(앞S && 이어시도.length ? 앞S : { 판: 2, 화면: [], 낱장: [], 쌍: [], 빠짐: [] }), 만든때: 지금, 눈: 'opus',
      시도: [...이어시도, { 눈: 'opus', 결과: '막힘', 꼴: '부르기 실패', 첫줄: 자르기(o.막힘, 200), 때: 지금 }],
      ...(P ? { 앞눈: { 눈: P.눈 || '아르곤', 만든때: P.만든때 || null, ...(Array.isArray(P.막힘) ? { 막힘: P.막힘 } : {}) } } : {}) };
    if (기록.눈 === 'opus' && 앞S?.눈 === 'gpt' && Array.isArray(앞S.낱장) && 앞S.낱장.length) 기록.눈 = 'gpt'; // GPT가 낸 판정이 있으면 그 눈 그대로
    const 파일 = 편기록쓰기(o.편, 관문.대체이름, 기록);
    console.log(`Opus 막힘을 적었다 → ${파일}`);
    return 2;
  }
  const 폴더 = fs.existsSync(path.resolve(o.받기)) ? path.resolve(o.받기) : path.join(손.작업뿌리 || 작업뿌리(), o.받기);
  const 묶음 = JSON.parse(fs.readFileSync(path.join(폴더, '묶음.json'), 'utf8'));
  const 화면들 = JSON.parse(fs.readFileSync(path.join(폴더, '화면.json'), 'utf8'));
  if (묶음.눈 !== 'opus') throw new Error(`이 작업 폴더는 ${묶음.눈} 눈 재료다: ${폴더}`);
  const 작업들 = 묶음.묶음.map(w => ({ k: w.k, 번호들: w.번호들, 답: path.join(폴더, w.답) }));
  const 막힘 = [], 시도 = [];
  for (const w of 작업들) {
    const 답 = fs.existsSync(w.답) ? fs.readFileSync(w.답, 'utf8') : '';
    const ok = 답 && 마지막JSON(답);
    시도.push({ 눈: 'opus', 결과: ok ? '받음' : '막힘', ...(ok ? {} : { 꼴: 답 ? '거절' : '답 없음', 첫줄: 답 ? 자르기(맨글(답), 200) : `답 파일이 없다: ${path.basename(w.답)}` }), 때: new Date().toISOString() });
    if (!ok) 막힘.push({ 묶음: w.k, 화면: w.번호들, 꼴: 답 ? '거절' : '답 없음', 보낸때: KST시각(), 첫줄: 시도[시도.length - 1].첫줄 });
  }
  const 옮김 = new Map((묶음.옮김 || []).map(x => [x.번호, x]));
  const 아르곤본 = new Map((묶음.아르곤본 || []).map(n => [n, true]));
  return 마무리({ ...o, 영상: 묶음.영상 || o.영상, 의도: 묶음.의도 || o.의도 }, { 이름: path.basename(폴더), 폴더, 화면들: 화면들.map(h => ({ ...h, 보낸파일: path.join(폴더, `화면${h.번호}${path.extname(h.파일).toLowerCase()}`) })), 작업들, 옮김, 아르곤본, 막힘, 시도, 쌍들: [], 적중파일: 손.적중파일 });
}

if (require.main === module) { main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(e.message); process.exitCode = 2; }); }

module.exports = { 기준읽기, 통과읽기, 모음읽기, 매체가르기, 기준글, 인자, 묶음나누기, 지시문, 답모으기, 끝코드, 결과글, 한대화, 저장소경로,
  띠간격, 띠프레임, 띠이름, 대조필터, 띠화면만들기, 이어받기, 같은컷, 지난기록읽기, 줄꺼짐, 막힘읽기, 채점, 적중요약, 적중시험, GPT글, opus질문, 묶음이름, main, 지시문한도 };
