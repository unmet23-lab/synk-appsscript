#!/usr/bin/env node
'use strict';
/* 미학 맹검 — 보여 드리기 · 게시 전에 그림(영상 대표 프레임 · 카드 · 화면 시안 · 썸네일)을 아르곤(Gemini 웹)에게 맹검으로 판정받는다(2026-11-08).
 *
 * 왜: 내부 검수를 통과한 결과물이 유호님께 「AI 슬롭 · 촌스럽다 · 맹하다 · 짜친다」로 거듭 기각됐다(11-03~07 메모에만 일곱 번).
 * 11-08 눈가림 시험(docs/_ops/qa/그록_눈가림_20261107/README.md)에서 유호님이 기각한 판 8장을 「기각」으로 잡은 수가
 * 아르곤 7 · Fable 3 · 그록 0이었다 — 그래서 이 관문은 아르곤이 본다. 유호님 「내 피드백도 … 검수, 검토작업에 적용해줬으면 해」(11-08)로
 * 슬롭 점검표(docs/마케팅/제작양식/광고영상_슬롭점검표.md)의 표 — 유호님 말씀과 「이렇게 본다」 — 를 보낼 때마다 글 파일로 붙인다.
 * 표에 한 줄이 늘면 다음 맹검부터 그대로 반영된다.
 *
 *   node tools/미학맹검.js <그림>[::<중립 설명>] … [--무엇 "<모든 그림 공통 설명>"] [--쌍 <그림>,<그림>]… [--이름 <작업 이름>] [--편 <편 폴더>] [--준비만]
 *     · --매체 영상,SNS,화면,그림(기본 넷 — 소리는 그림으로 못 들어 뺀다): 그 매체의 지적 · 통과만 붙인다(영상 속 펠트 CG 지적이 펠트 정물 커버로 번진 11-08 오판).
 *     · 기준: 점검표 표(K · G) + docs/마케팅/제작양식/슬롭점검_모음.json(11-08 세션 224개에서 모은 지적 C · 통과 P).
 *     · --편: 결과를 그 편 폴더 게시/미학맹검.json에도 남긴다 — 올리기 전 검사(⑱)가 보고, 11-08부터 SNS 편은 만든 날 상관없이 이것 없이 못 올린다.
 *     · 설명은 판정이 드러나지 않게 쓴다(「새 판」 「고친」 「옛」 금지 — 「가상 러닝화 광고의 끝 화면(9:16)」처럼).
 *     · 그림은 화면01…로 이름을 바꿔 보낸다(파일 이름이 답을 흘리지 않게). 아르곤 웹 한 대화에 그림 4장까지(11-07 8장 묶음은 두 번 다
 *       대화가 남지 않았다) — 쌍은 같은 대화에 둔다.
 *   끝 코드: 0 기각 없음 · 1 기각 있음 · 2 답을 못 받은 그림이 있음(도구 실패 — 통과로 치지 않는다).
 *   결과: <공용 작업본>/.tmp/미학맹검/<이름>/결과.md · 결과.json(git 밖). 판정 · 약점은 Claude가 그림과 대조해 고른다 — 아르곤은 엄하게 본다
 *   (11-08 시험에서 채택 판 4장 중 3장도 깎았다). 기각이면 지적대로 고치거나 다시 뽑아 한 번 더 보고, 그래도 기각이면 그 사실과 함께 보인다.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 공용작업본 } = require('./lib/공용작업본.js');
const { 마지막JSON } = require('./lib/그록호출.js');

const 뿌리 = path.resolve(__dirname, '..');
const 점검표 = path.join(뿌리, 'docs', '마케팅', '제작양식', '광고영상_슬롭점검표.md');
// 11-08 세션 224개에서 모은 지적 C · 통과 P(매체 · 자리 · 범위 주의). 점검표행이 있는 지적은 점검표 표가 정본이라 빼고 붙인다.
const 모음파일 = path.join(뿌리, 'docs', '마케팅', '제작양식', '슬롭점검_모음.json');
// 그림만 보는 맹검이라 소리는 기본에서 뺀다 — --매체로 고른다(영상 프레임이면 영상, 카드 편이면 SNS, 앱 · 사이트 시안이면 화면).
const 기본매체 = ['영상', 'SNS', '화면', '그림'];
const 한대화 = 4;
const 판정들 = ['그대로 냄', '고쳐서 냄', '기각'];

/** 마크다운 꾸밈(링크 · 굵게 · 코드)을 걷고 한 줄로. */
const 맨글 = s => String(s || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();
const 자르기 = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

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

function 인자(argv) {
  const o = { 그림: [], 쌍: [], 무엇: '', 이름: null, 준비만: false, 편: null, 매체: [...기본매체] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--무엇') o.무엇 = argv[++i] || '';
    else if (a === '--쌍') o.쌍.push(String(argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean));
    else if (a === '--이름') o.이름 = argv[++i];
    else if (a === '--준비만') o.준비만 = true;
    else if (a === '--편') o.편 = argv[++i] || null;
    else if (a === '--매체') { o.매체 = String(argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean); if (!o.매체.length || o.매체.some(m => !매체들.includes(m))) throw new Error(`--매체는 ${매체들.join('·')} 가운데(쉼표로 여럿)`); }
    else if (a.startsWith('--')) throw new Error(`모르는 인자: ${a}`);
    else { const [파일, ...설명] = a.split('::'); o.그림.push({ 파일, 설명: 설명.join('::') }); }
  }
  if (!o.그림.length) throw new Error('그림이 없다 — node tools/미학맹검.js <그림>[::<설명>] … [--무엇 "<설명>"]');
  for (const p of o.쌍) if (p.length !== 2) throw new Error(`--쌍은 그림 둘(쉼표): ${p.join(',')}`);
  return o;
}

/** 그림을 한 대화 4장 안으로 나눈다. 쌍의 두 그림은 같은 대화에 둔다. */
/** 공개 저장소에 남길 경로 — 이 작업본 · 공용 작업본 안이면 그 안의 상대 경로, 밖(스크래치 · 임시 폴더)이면 파일 이름만. 이 PC 사용자 폴더 경로를 올리지 않는다(11-08). */
function 저장소경로(p, 바탕들 = [뿌리, 공용작업본(뿌리)]) {
  const 절대 = path.resolve(String(p || ''));
  for (const 바탕 of 바탕들) {
    const r = path.relative(path.resolve(바탕), 절대);
    if (r && !r.startsWith('..') && !path.isAbsolute(r)) return r.split(path.sep).join('/');
  }
  return path.basename(절대);
}

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

function 지시문(화면들, 쌍들) {
  const 쌍글 = 쌍들.length ? `\n그다음 아래 쌍은 같은 자리에 쓸 두 판이다. 쌍마다 더 나은 쪽 하나를 고르고 한 줄 까닭을 적어라.\n쌍: ${쌍들.map(([a, b]) => `(${a}, ${b})`).join(' · ')}\n` : '\n이번에는 쌍이 없다 — "쌍"은 빈 배열로.\n';
  return [
    '너는 세계 최고 수준 광고 에이전시의 크리에이티브 디렉터다. 이 회사 대표의 기준은 이렇다: 「모든 화면이 곧 포트폴리오다. 한 부분이라도 AI 슬롭(흔한 AI 생성물 티) · 촌스러움 · 초보 디자이너 티가 나면 기각하고 다시 만든다.」 비교 기준은 지금 가장 트렌디한 최상위 브랜드 · 에이전시 작업이다.',
    '',
    '붙인 글 파일 「유호님_기준」은 이 대표가 실제 결과물에 한 지적(K)과 고른 판(G)이다. 지적은 [매체 · 자리]가 지금 화면과 같을 때만 근거로 쓰고 재료 · 기법 자체의 금지로 넓혀 읽지 마라. 걸리는 줄이 있으면 약점 앞에 [K번호] · [C번호], 고른 판과 같은 쪽이면 강점에 [G번호] · [P번호]를 붙여라. 목록에 없어도 싸 보이는 곳은 적는다.',
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

function 결과글(이름, 화면들, 모음) {
  const 원래 = new Map(화면들.map(h => [h.번호, h]));
  const 줄 = [`# 미학 맹검 · ${이름}`, '', `아르곤(Gemini 웹) · 유호님 기준 표 붙임 · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, '',
    '| 화면 | 원래 파일 | 판정 | 점수 | 약점 | 강점 |', '|---|---|---|---|---|---|'];
  for (const x of 모음.낱장)줄.push(`| ${x.번호} | ${path.basename(원래.get(x.번호)?.파일 || '')} | ${x.판정} | ${x.점수 ?? '—'} | ${x.약점.join('<br>').replace(/\|/g, '/')} | ${x.강점.replace(/\|/g, '/')} |`);
  if (모음.쌍.length) { 줄.push('', '쌍', ...모음.쌍.map(p => `- ${p.쌍} → ${p.고름}: ${p.까닭}`)); }
  if (모음.빠짐.length) 줄.push('', `**답을 못 받은 화면: ${모음.빠짐.join(', ')}** — 통과로 치지 않는다. \`node tools/아르곤웹.js 읽기 <작업 파일>\`로 받거나 다시 맹검한다.`);
  return 줄.join('\n') + '\n';
}

function main(argv) {
  const o = 인자(argv);
  const 이름 = o.이름 || `맹검-${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
  const 폴더 = path.join(공용작업본(뿌리), '.tmp', '미학맹검', 이름);
  fs.mkdirSync(폴더, { recursive: true });
  const 표글 = fs.readFileSync(점검표, 'utf8');
  const 표기준 = 기준읽기(표글);
  if (!표기준.length) throw new Error(`점검표에서 기준 줄을 못 읽었다: ${점검표}`);
  const 기준 = 표기준.filter(r => o.매체.includes(r.매체)), 통과 = 통과읽기(표글).filter(r => o.매체.includes(r.매체));
  const 기준모음 = fs.existsSync(모음파일) ? 모음읽기(fs.readFileSync(모음파일, 'utf8'), o.매체) : { 지적: [], 통과: [] };
  const 기준파일 = path.join(폴더, '유호님_기준.md');
  fs.writeFileSync(기준파일, 기준글(기준, 통과, 기준모음));
  const 화면들 = o.그림.map((g, i) => {
    const 원 = path.resolve(g.파일); if (!fs.existsSync(원)) throw new Error(`그림이 없다: ${g.파일}`);
    const 번호 = String(i + 1).padStart(2, '0'); const 새 = path.join(폴더, `화면${번호}${path.extname(원).toLowerCase()}`);
    fs.copyFileSync(원, 새);
    return { 번호, 파일: 원, 보낸파일: 새, 설명: g.설명 || o.무엇 };
  });
  const 번호of = 파일 => 화면들.find(h => h.파일 === path.resolve(파일))?.번호;
  const 쌍들 = o.쌍.map(([a, b]) => { const x = 번호of(a), y = 번호of(b); if (!x || !y) throw new Error(`--쌍의 그림이 목록에 없다: ${a}, ${b}`); return [x, y]; });
  const 묶음들 = 묶음나누기(화면들.map(h => h.번호), 쌍들);
  const 작업들 = 묶음들.map((묶음, k) => {
    const 이 = 화면들.filter(h => 묶음.includes(h.번호)); const 이쌍 = 쌍들.filter(([a, b]) => 묶음.includes(a) && 묶음.includes(b));
    const 지시 = path.join(폴더, `지시_${k + 1}.md`); fs.writeFileSync(지시, 지시문(이, 이쌍));
    const 작업 = path.join(폴더, `작업_${k + 1}.json`);
    fs.writeFileSync(작업, JSON.stringify({ files: [...이.map(h => h.보낸파일), 기준파일], promptFile: path.basename(지시), out: `답_${k + 1}.md` }, null, 1));
    return { 작업, 답: path.join(폴더, `답_${k + 1}.md`) };
  });
  fs.writeFileSync(path.join(폴더, '화면.json'), JSON.stringify(화면들.map(({ 번호, 파일, 설명 }) => ({ 번호, 파일, 설명 })), null, 1));
  console.log(`미학 맹검 ${이름}: 그림 ${화면들.length}장 · 대화 ${작업들.length}개 · 매체 ${o.매체.join('·')} · 지적 ${기준.length + 기준모음.지적.length}줄 · 통과 ${통과.length + 기준모음.통과.length}줄 → ${폴더}`);
  if (o.준비만) { console.log(작업들.map(w => w.작업).join('\n')); return 0; }
  const 아르곤 = path.join(뿌리, 'tools', '아르곤웹.js');
  const 부르기 = 명령 => spawnSync(process.execPath, [아르곤, 명령, ...작업들.filter(w => !fs.existsSync(w.답)).map(w => w.작업)], { stdio: 'inherit', cwd: 뿌리 });
  부르기('보내기');
  if (작업들.some(w => !fs.existsSync(w.답))) 부르기('읽기');
  const 답들 = 작업들.map(w => (fs.existsSync(w.답) ? 마지막JSON(fs.readFileSync(w.답, 'utf8')) : null));
  const 모음 = 답모으기(답들, 화면들.map(h => h.번호));
  fs.writeFileSync(path.join(폴더, '결과.json'), JSON.stringify({ 이름, 화면: 화면들.map(({ 번호, 파일, 설명 }) => ({ 번호, 파일, 설명 })), ...모음 }, null, 1));
  fs.writeFileSync(path.join(폴더, '결과.md'), 결과글(이름, 화면들, 모음));
  if (o.편) { // 올리기 전 검사 ⑱이 본다 — 편 폴더 게시/미학맹검.json(공개 저장소에 올라가니 이 PC 경로는 저장소 안 상대 경로 · 파일 이름만)
    const 게시 = path.join(path.resolve(o.편), '게시'); fs.mkdirSync(게시, { recursive: true });
    fs.writeFileSync(path.join(게시, '미학맹검.json'), JSON.stringify({ 만든때: new Date().toISOString(), 이름, 결과: 저장소경로(path.join(폴더, '결과.md')), 화면: 화면들.map(({ 번호, 파일, 설명 }) => ({ 번호, 파일: 저장소경로(파일), 설명 })), ...모음 }, null, 1));
  }
  const 셈 = 판정들.map(p => `${p} ${모음.낱장.filter(x => x.판정 === p).length}`).join(' · ');
  console.log(`결과: ${셈}${모음.빠짐.length ? ` · 답 없음 ${모음.빠짐.length}` : ''} → ${path.join(폴더, '결과.md')}`);
  return 끝코드(모음);
}

if (require.main === module) { try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 2; } }

module.exports = { 기준읽기, 통과읽기, 모음읽기, 매체가르기, 기준글, 인자, 묶음나누기, 지시문, 답모으기, 끝코드, 결과글, 한대화, 저장소경로 };
