'use strict';

// 새 편과 이어받은 편이 한 번의 읽기로 같은 원칙, 지적, 승인 사례를 확인한다.
// 기준판은 작업본 전체 커밋 대신 실제로 읽은 원문 내용으로 만든다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { 공용작업본 } = require('./lib/공용작업본.js');
const 장부 = require('./흠장부.js');

const 양식 = 'docs/마케팅/제작양식/';
const 출처 = {
  스킬: '.claude/skills/synk-video/SKILL.md',
  제작규칙: 양식 + 'AI광고영상_제작규칙.md',
  제작절차: 'docs/마케팅/기획장부/제작절차.md',
  점검표: 양식 + '광고영상_슬롭점검표.md',
  만족사례: 양식 + '만족사례_장부.md',
  흠갈래: 양식 + '흠갈래.json',
  모음: 양식 + '슬롭점검_모음.json',
  LAB교훈: 양식 + 'LAB_교훈.json',
};
const 방식 = ['LAB', '그래픽', '컷표영상'];
// 컨셉 팩(2026-11-24 유호님 「코믹으로 시작」) — 컷표 맨 위 「컨셉」에 이름을 적은 편만 그 컨셉의 팩을 함께 읽는다.
// 설계: docs/마케팅/제작양식/영상양식/컨셉팩_설계_20261124.md. 「컨셉」이 없는 편은 출력과 기준판이 전과 같다.
const 팩자리 = 양식 + '영상양식/컨셉팩/';
const 팩이름꼴 = /^[\p{L}\p{N}]{1,20}$/u;
const 감독칸 = ['미술감독', '작가', '캐스팅디렉터', '촬영감독', '음향감독', '편집감독'];
const 정규화 = 글 => 글.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const 지문 = 글 => crypto.createHash('sha256').update(글).digest('hex');

function git(뿌리, 인자, 옵션 = {}) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...인자], {
    cwd: 뿌리, encoding: 'utf8', windowsHide: true, timeout: 옵션.제한 || 60000, maxBuffer: 8 << 20,
    input: 옵션.입력, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
  });
  if (r.error || r.status !== 0) throw Error(`Git ${인자[0]} 확인 실패. ${r.error?.message || r.stderr.trim()}`);
  return r.stdout;
}

function 원문읽기(작업본, 더할 = {}) {
  const 뿌리 = 공용작업본(작업본);
  // origin을 따라가기 전인 공용본에서도 이미 받아 놓은 최신 기준을 쓴다.
  // 같은 원문을 양쪽에서 고쳤으면 어느 쪽의 지적도 조용히 잃지 않는다.
  // 「더할」은 있을 때만 읽는 원문(컨셉 팩)이다. 공용본과 받은 원격 어디에도 없으면 읽지 않고 넘어간다.
  const 모두 = { ...출처, ...더할 };
  const ref = 'refs/remotes/origin/master';
  const [공용커밋, 원격커밋 = ''] = git(뿌리, ['rev-parse', '--revs-only', 'HEAD', ref]).trim().split(/\r?\n/);
  if (!/^[0-9a-f]{40,64}$/.test(공용커밋)) throw Error('공용 작업본의 HEAD 커밋을 확인할 수 없습니다.');
  const 기준점 = 원격커밋 && 원격커밋 !== 공용커밋 ? git(뿌리, ['merge-base', 공용커밋, 원격커밋]).trim() : '';
  const 받은변경 = 기준점 && 기준점 !== 원격커밋
    ? new Set(git(뿌리, ['diff', '--name-only', '-z', 기준점, 원격커밋, '--', ...Object.values(모두)]).split('\0'))
    : new Set();
  const 내용 = {}, 원격원문 = [];
  for (const [이름, 상대] of Object.entries(모두)) {
    const 파일 = path.join(뿌리, 상대);
    const 골라읽음 = 이름 in 더할;
    const 있음 = fs.existsSync(파일);
    if (골라읽음 && !있음 && !받은변경.has(상대)) continue;
    let 글 = 골라읽음 && !있음 ? '' : 정규화(fs.readFileSync(파일, 'utf8'));
    if (받은변경.has(상대)) {
      let 새글 = null;
      try { 새글 = 정규화(git(뿌리, ['show', 원격커밋 + ':' + 상대])); } catch (e) { if (!골라읽음) throw e; }
      let 옛글 = '';
      try { 옛글 = 정규화(git(뿌리, ['show', 기준점 + ':' + 상대])); } catch (e) { if (!골라읽음) throw e; }
      if (새글 === null) {
        // 원격에서 지운 팩: 공용본에서도 그대로면 없는 것으로 본다.
        if (글 === 옛글) continue;
        throw Error(`${파일}의 공용 수정과 받은 원격 기준을 함께 확인하고 다시 실행하세요.`);
      }
      if (글 !== 새글 && 글 !== 옛글) {
        throw Error(`${파일}의 공용 수정과 받은 원격 기준을 함께 확인하고 다시 실행하세요.`);
      }
      글 = 새글;
      원격원문.push(이름);
    }
    if (!글.trim()) throw Error(`${파일}이 비어 있습니다.`);
    내용[이름] = 글;
  }
  return { 뿌리, 공용커밋, 원격커밋, 원격원문, 내용 };
}

function 변경순서({ 뿌리, 원격커밋, 원격원문, 내용 }) {
  const 원격 = 원격원문.includes('점검표');
  // 점검표 blame은 큰 저장소에서 다른 일과 겹치면 60초를 넘겼다(11-24 두 번). 부르는 도구들의 제한(240초) 안에서 넉넉히 기다린다.
  const 글 = git(뿌리, ['blame', '--incremental', ...(원격 ? [원격커밋] : ['--contents', '-']), '--', 출처.점검표],
    { ...(원격 ? {} : { 입력: 내용.점검표 }), 제한: 180000 });
  const 시각 = new Map(), 변경 = new Map();
  let 조각;
  for (const 줄 of 글.split('\n')) {
    const m = /^([0-9a-f]{40,64}) \d+ (\d+) (\d+)$/.exec(줄);
    if (m) { 조각 = { 커밋: m[1], 첫줄: Number(m[2]), 수: Number(m[3]) }; continue; }
    if (줄.startsWith('committer-time ') && 조각) 시각.set(조각.커밋, Number(줄.slice(15)));
    if (줄.startsWith('filename ') && 조각) {
      const 순서 = /^0+$/.test(조각.커밋) ? Infinity : 시각.get(조각.커밋);
      if (순서 === undefined) throw Error('점검표 변경 이력에서 커밋 시각을 읽을 수 없습니다.');
      for (let i = 조각.첫줄; i < 조각.첫줄 + 조각.수; i++) 변경.set(i, 순서);
    }
  }
  return 변경;
}

// 말씀 칸의 날짜(MM-DD · YYYY-MM-DD) 가운데 가장 늦은 날(초). 흠장부 말씀다시세기와 같은 꼴로 읽는다.
// 해가 없는 날은 그 줄을 마지막으로 고친 해로 읽고, 고친 때보다 이틀 넘게 뒤면 한 해 앞으로 본다(12월 지적을 1월에 고친 줄).
const 말씀날 = /(?<![\d:.~/-])(?:(20\d\d)-)?(\d{1,2})-(\d{1,2})(?![\d:])/g;
function 마지막말씀날(말씀, 고친시각) {
  const 기준 = Number.isFinite(고친시각) ? 고친시각 : Date.now() / 1000;
  const 기준해 = new Date(기준 * 1000).getUTCFullYear();
  let 늦은 = null;
  for (const m of String(말씀).matchAll(말씀날)) {
    const 월 = Number(m[2]), 일 = Number(m[3]);
    if (월 < 1 || 월 > 12 || 일 < 1 || 일 > 31) continue;
    let 날 = Date.UTC(m[1] ? Number(m[1]) : 기준해, 월 - 1, 일) / 1000;
    if (!m[1] && 날 > 기준 + 2 * 86400) 날 = Date.UTC(기준해 - 1, 월 - 1, 일) / 1000;
    if (늦은 === null || 날 > 늦은) 늦은 = 날;
  }
  return 늦은;
}

function 지적읽기(글, 변경) {
  const 표 = [];
  for (const [i, 행] of 글.split('\n').entries()) {
    if (!/^\|\s*\d+\s*\|/.test(행)) continue;
    const 칸 = 행.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(x => x.trim());
    if (칸.length !== 5 || 칸.some(x => !x)) throw Error(`점검표 ${i + 1}행의 다섯 칸을 확인하세요.`);
    const [n, 이름, 말씀, 확인, 고침] = 칸;
    if (!변경.has(i + 1)) throw Error(`점검표 ${i + 1}행의 버전을 확인할 수 없습니다.`);
    표.push({ 번호: Number(n), 이름, 말씀, 확인, 고침, 줄: i + 1, 지문: 지문(행) });
  }
  if (!표.length) throw Error('슬롭 점검표에서 지적을 읽을 수 없습니다.');
  // 「최근」은 말씀 칸의 가장 늦은 날이다. 표를 한꺼번에 다시 쓴 커밋이 모든 줄을 최근으로 만들지 않게 한다(11-23 점검표 압축).
  // 날짜가 없는 줄만 그 줄을 마지막으로 고친 때(git blame)로 센다.
  const 순서 = new Map(표.map(x => [x.줄, 마지막말씀날(x.말씀, 변경.get(x.줄)) ?? 변경.get(x.줄)]));
  표.sort((a, b) => (순서.get(b.줄) - 순서.get(a.줄)) || (변경.get(b.줄) - 변경.get(a.줄)) || b.번호 - a.번호);
  // 같은 날 한꺼번에 받은 새 지적도 모두 나오게 한다. 이전 판은 비교용 지문과 함께 JSON에 남긴다.
  const 최근값 = 순서.get(표[0].줄);
  const 최근지적 = 표.filter((x, i) => i < 3 || 순서.get(x.줄) === 최근값);
  return { 최근지적, 점검표: 표 };
}

// 편 폴더나 컷표 파일에서 그 편의 표(컷표.json, 없으면 옛 컷순서.json)를 읽는다. 표가 없으면 null이다.
function 편표읽기(입력) {
  if (!입력 || 방식.includes(입력)) return null;
  const p = path.resolve(입력);
  const 파일 = fs.existsSync(p) && fs.statSync(p).isFile();
  const 폴더 = 파일 ? path.dirname(p) : p;
  const 후보 = 파일 ? [p] : [path.join(폴더, '컷표.json'), path.join(폴더, '컷순서.json')];
  const 표 = 후보.find(x => path.extname(x).toLowerCase() === '.json' && fs.existsSync(x));
  return 표 ? JSON.parse(정규화(fs.readFileSync(표, 'utf8'))) : null;
}

const 컨셉이름 = 표 => (표 && typeof 표.컨셉 === 'string' ? 표.컨셉.trim() : '');

// 컨셉 팩을 읽는다. 「컨셉」이 없으면 null이다. 팩 파일이 없거나 이름 꼴이 아니면 「없음」으로 두고 공통 기준만 쓴다(멈추지 않는다).
function 팩읽기(컨셉, 자료, 점검표) {
  if (!컨셉) return null;
  if (!팩이름꼴.test(컨셉)) return { 컨셉, 없음: true, 까닭: '팩 이름은 빈칸 없는 글자와 숫자 스무 자 안쪽이다' };
  const 상대 = 팩자리 + 컨셉 + '.json';
  if (자료.내용.컨셉팩 === undefined) return { 컨셉, 상대, 없음: true };
  let 팩;
  try { 팩 = JSON.parse(자료.내용.컨셉팩); } catch (e) { throw Error(`컨셉 팩 ${상대}을 읽을 수 없습니다. ${e.message}`); }
  if (팩?.컨셉 !== 컨셉) throw Error(`컨셉 팩 ${상대}의 「컨셉」이 파일 이름과 다릅니다.`);
  const 줄 = [];
  for (const 칸 of 감독칸) {
    const 값 = 팩[칸] ?? [];
    if (!Array.isArray(값)) throw Error(`컨셉 팩 ${상대}의 「${칸}」은 줄 목록이어야 합니다.`);
    for (const x of 값) {
      if (typeof x?.번 !== 'string' || typeof x.기준 !== 'string' || !x.기준.trim()) {
        throw Error(`컨셉 팩 ${상대}의 「${칸}」 줄마다 「번」과 「기준」이 있어야 합니다.`);
      }
      줄.push({ 칸, 번: x.번, 기준: x.기준, 근거: String(x.근거 || ''), ...(x.공통과다름 != null ? { 공통과다름: Number(x.공통과다름) } : {}) });
    }
  }
  const 먼저볼 = 팩.컨셉감독?.먼저볼공통줄?.줄 ?? [];
  if (!Array.isArray(먼저볼)) throw Error(`컨셉 팩 ${상대}의 먼저볼공통줄.줄은 번호 목록이어야 합니다.`);
  const 번호들 = new Set(점검표.map(x => x.번호));
  for (const n of [...먼저볼, ...줄.filter(x => '공통과다름' in x).map(x => x.공통과다름)]) {
    if (!번호들.has(n)) throw Error(`컨셉 팩 ${상대}이 점검표에 없는 번호 ${n}을 가리킵니다.`);
  }
  // 기승전결 모양(11-24) — 띠마다 한 문장. 「검사」가 있으면 컷 연속성 검사 T24가 감정흐름으로 본다.
  const 판 = 팩.기승전결;
  let 모양 = null;
  if (판 != null) {
    if (typeof 판 !== 'object' || typeof 판.모양 !== 'object' || ![...'기승전결'].every(k => typeof 판.모양?.[k] === 'string' && 판.모양[k].trim())) {
      throw Error(`컨셉 팩 ${상대}의 기승전결.모양은 기 · 승 · 전 · 결마다 한 문장이어야 합니다.`);
    }
    모양 = { ...Object.fromEntries([...'기승전결'].map(k => [k, 판.모양[k].trim()])), 검사: !!판.검사 };
  }
  return { 컨셉, 상대, 지문: 지문(자료.내용.컨셉팩), 이기나: String(팩.컨셉감독?.무엇으로이기나 || ''), 줄, 먼저볼, ...(모양 ? { 모양 } : {}) };
}

// 팩이 공통 줄과 다르게 정한 번호는 확인 · 고침을 팩 줄로 바꾸고, 팩이 먼저 볼 공통 줄은 최근 지적에 더한다.
// 첫 컷 검사가 이 두 목록으로 다른 눈에게 묻는다. 팩대로 만든 판을 점검표 원문으로 「다시」라고 하지 않게 한다.
function 팩적용(지적, 팩) {
  if (!팩 || 팩.없음) return 지적;
  const 덮음 = new Map(팩.줄.filter(x => '공통과다름' in x).map(x => [x.공통과다름, x]));
  const 바꿈 = x => {
    const p = 덮음.get(x.번호);
    return p ? { ...x, 확인: `이 편은 컨셉 「${팩.컨셉}」이라 점검표 원문 대신 팩 줄을 기준으로 본다(${p.번}). ${p.기준}`,
      고침: `팩 줄을 따른다(${p.번}). ${p.기준}`, 팩줄: p.번 } : x;
  };
  const 점검표 = 지적.점검표.map(바꿈);
  const 최근지적 = 지적.최근지적.map(바꿈);
  const 있는 = new Set(최근지적.map(x => x.번호));
  for (const n of 팩.먼저볼) {
    const x = 점검표.find(r => r.번호 === n);
    if (x && !있는.has(n)) { 최근지적.push({ ...x, 먼저볼: 팩.컨셉 }); 있는.add(n); }
  }
  return { 최근지적, 점검표 };
}

function 사례읽기(글, 편표) {
  const 목차 = /^## 분야별 찾기[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(글)?.[1];
  const 분야 = (목차 || '').split('\n').filter(x => /^\|/.test(x) && !/^\|\s*(분야\s*\||-)/.test(x));
  if (!분야.length) throw Error('만족 사례 장부의 분야별 찾기를 읽을 수 없습니다.');
  const 지정 = String(편표?.가까운사례 || '');
  const 선택 = [];
  for (const id of new Set(지정.match(/\bS\d+\b/g) || [])) {
    const m = new RegExp('^### (' + id + '\\b[^\\n]*)\\n([\\s\\S]*?)(?=^###? |(?![\\s\\S]))', 'm').exec(글);
    if (!m) throw Error(`컷표에 적은 ${id}를 만족 사례 장부에서 찾지 못했습니다.`);
    선택.push({ id, 제목: m[1], 지문: 지문(m[0].trim()), 적용: m[2].split('\n').filter(x => /^- \*\*(좋았던 범위|방법)[:：]?\*\*/.test(x)) });
  }
  return { 지정, 선택, 분야 };
}

function 기준읽기(입력 = '', { 작업본 = path.resolve(__dirname, '..'), 편이력 = true, 종류 = '' } = {}) {
  if (종류 && (!방식.includes(종류) || !입력 || 방식.includes(입력))) throw Error('--종류는 편 폴더나 컷표 파일과 함께 LAB, 그래픽, 컷표영상 중 하나로 지정하세요.');
  const 편표 = 편표읽기(입력);
  const 컨셉 = 컨셉이름(편표);
  const 자료 = 원문읽기(작업본, 컨셉 && 팩이름꼴.test(컨셉) ? { 컨셉팩: 팩자리 + 컨셉 + '.json' } : {});
  const 규칙 = { 흠갈래: JSON.parse(자료.내용.흠갈래), 모음: JSON.parse(자료.내용.모음),
    점검표: 자료.내용.점검표, LAB교훈: 자료.내용.LAB교훈 };
  if (!Array.isArray(규칙.흠갈래.줄) || !Array.isArray(규칙.모음.지적)) throw Error('흠갈래나 슬롭점검 모음의 규칙 목록을 읽을 수 없습니다.');
  const 한장 = /^## 열두 원칙[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(자료.내용.스킬)?.[1];
  if (!한장?.trim()) throw Error('synk-video 스킬의 열두 원칙을 읽을 수 없습니다.');
  const 기본원칙 = 한장.split('\n').filter(x => /^\d+\. /.test(x));
  if (!기본원칙.length) throw Error('synk-video 스킬에 제작 원칙이 없습니다.');
  const 원지적 = 지적읽기(자료.내용.점검표, 변경순서(자료));
  const 팩 = 팩읽기(컨셉, 자료, 원지적.점검표);
  const 지적 = 팩적용(원지적, 팩);
  const 만족사례 = 사례읽기(자료.내용.만족사례, 편표);
  let 이력 = null;
  if (편이력 && 입력) {
    const 폴더 = process.env.SYNK_FLAW_LEDGER_DIR || path.join(자료.뿌리, 'docs', '마케팅');
    fs.accessSync(폴더, fs.constants.R_OK);
    if (!fs.statSync(폴더).isDirectory()) throw Error(`편 이력을 읽을 폴더가 아닙니다. ${폴더}`);
    이력 = 장부.시작(종류 || 입력, { 폴더, 기준뿌리: 자료.뿌리, 원문: 규칙, 범위밖허용: true });
    if (이력.까닭 && 이력.까닭 !== 'SYNK_FLAW_LEDGER=off') throw Error(이력.까닭);
    if (이력.길 === 'LAB' && (!이력.LAB교훈 || 이력.LAB교훈.표없음)) throw Error('LAB 교훈 원문을 읽을 수 없습니다.');
  }
  const 길 = 종류 || 이력?.길 || (방식.includes(입력) ? 입력 : 입력 ? 장부.시작길(입력, []).길 : '') || '';
  const 원문 = Object.entries(출처).filter(([이름]) => 이름 !== 'LAB교훈' || 길 === 'LAB')
    .map(([이름, 상대]) => ({ 이름, 경로: path.join(자료.뿌리, 상대), 지문: 지문(자료.내용[이름]),
      ...(자료.원격원문.includes(이름) ? { Git원문: 자료.원격커밋 + ':' + 상대 } : {}) }));
  // 팩이 있는 편만 원문과 기준판에 팩이 든다. 팩이 바뀌면 그 컨셉 편의 첫 컷 확인을 다시 받는다.
  if (팩 && !팩.없음) {
    원문.push({ 이름: '컨셉팩', 경로: path.join(자료.뿌리, 팩.상대), 지문: 팩.지문,
      ...(자료.원격원문.includes('컨셉팩') ? { Git원문: 자료.원격커밋 + ':' + 팩.상대 } : {}) });
  }
  const 길에맞는 = 항목 => !길 || !Array.isArray(항목.길) || 항목.길.includes(길);
  const 검사자리 = 항목 => Object.fromEntries(['올린검사', '올린곳'].map(k => [k, (항목[k] || []).filter(길에맞는)]));
  const 경로기준 = {
    점검표: 규칙.흠갈래.줄.map(x => ({ 번호: x.번호, ...검사자리(x) })),
    항목: Object.fromEntries(Object.entries(규칙.흠갈래.항목 || {}).map(([k, v]) => [k, 검사자리(v)])),
  };
  // 다른 편의 새 승인과 LAB 이력의 통계 변동으로 기존 컷의 판정을 무효로 만들지 않는다.
  const 적용판 = 원문.filter(x => !['만족사례', 'LAB교훈', '흠갈래'].includes(x.이름)).map(x => [x.이름, x.지문]);
  if (길 === 'LAB') {
    const 교훈 = JSON.parse(규칙.LAB교훈).교훈;
    if (!Array.isArray(교훈)) throw Error('LAB 교훈 목록을 읽을 수 없습니다.');
    경로기준.LAB교훈 = 교훈.map(({id, 단계, 할것, 올린곳, 자리}) => ({id, 단계, 할것, 올린곳, 자리}));
  }
  적용판.push(['길', 길], ['검사와 기본값', 경로기준], ['승인 사례', 만족사례.지정, 만족사례.선택.map(x => x.지문)]);
  return { 기준판: 지문(JSON.stringify(적용판)), 피드백판: 지문(자료.내용.점검표), 길,
    공용작업본: 자료.뿌리, 공용커밋: 자료.공용커밋, 원격커밋: 자료.원격커밋, 원격원문: 자료.원격원문,
    원문, 기본원칙, ...지적, 만족사례, 경로기준, 이력, ...(팩 ? { 팩 } : {}) };
}

function 팩글(팩) {
  if (팩.없음) {
    return [`컨셉 「${팩.컨셉}」의 팩이 아직 없습니다${팩.까닭 ? `(${팩.까닭})` : ''}. 공통 기준만 적용합니다.`,
      `  이 컨셉에서 나온 지적은 점검표에 적고, 다른 컨셉의 만족 사례나 지적과 반대일 때만 ${팩자리}<컨셉>.json을 만듭니다.`];
  }
  return [`컨셉 팩 「${팩.컨셉}」 ${팩.이기나}`.trimEnd(),
    ...(팩.모양 ? [`  기승전결  ${[...'기승전결'].map(k => `${k} ${팩.모양[k]}`).join(' → ')}${팩.모양.검사 ? '  (컷 연속성 검사 T24가 감정흐름으로 본다)' : ''}`] : []),
    ...팩.줄.map(x => `  ${x.번}  ${x.기준}${'공통과다름' in x ? `  (점검표 #${x.공통과다름} 대신)` : ''}`),
    ...(팩.먼저볼.length ? [`  이 컨셉에서 먼저 볼 점검표 줄  ${팩.먼저볼.map(n => '#' + n).join(' ')}`] : [])];
}

function 기준글(r) {
  const lines = [`[영상 기준] ${r.기준판}`, `공용 작업본 ${r.공용작업본}`, ...(r.길 ? [`제작 방식 ${r.길}`] : []),
    '최근 지적이 붙은 점검표 항목', ...r.최근지적.map(x => `#${x.번호} ${x.이름}${x.먼저볼 ? `  (컨셉 「${x.먼저볼}」이 먼저 볼 줄)` : ''}\n  근거  ${x.말씀}\n  확인할 것  ${x.확인}\n  고칠 것  ${x.고침}`),
    '', ...r.기본원칙.map(x => /^(\d+\. )\*\*([^*]+)\*\*/.exec(x)?.slice(1, 3).join('') || x)];
  if (r.팩) lines.push('', ...팩글(r.팩));
  if (r.만족사례.선택.length) lines.push('', ...r.만족사례.선택.map(x => [x.제목, ...x.적용].join('\n')));
  else lines.push('', '컷표의 가까운사례에 이번 편과 가장 가까운 승인 사례를 고릅니다.',
    ...r.만족사례.분야.map(x => `${x.split('|')[1].trim()}  ${[...new Set(x.match(/\bS\d+\b/g) || [])].join(' ')}`));
  if (r.이력) lines.push('', 장부.시작글(r.이력) || (r.이력.까닭 || `최근 ${r.이력.편수}편의 ${r.이력.길} 이력에서 따로 띄울 흠이 없습니다.`));
  for (const x of r.최근지적) {
    const 자리 = r.경로기준.점검표.find(row => row.번호 === x.번호);
    if (자리?.올린곳.length) lines.push(`#${x.번호} 적용 위치  ${자리.올린곳.map(row => row.자리).join(' / ')}`);
  }
  return lines.concat('', r.원문.map(x => `${x.이름}  ${x.Git원문 ? 'git show ' + x.Git원문 : x.경로}`)).join('\n');
}

function main(argv) {
  let 인자;
  try {
    인자 = parseArgs({ args: argv, allowPositionals: true, options: { 종류: { type: 'string' }, json: { type: 'boolean' } } });
    if (인자.positionals.length > 1 || (인자.values.종류 !== undefined &&
        (!방식.includes(인자.values.종류) || !인자.positionals.length || 방식.includes(인자.positionals[0])))) throw Error();
  } catch {
    console.error('사용: node tools/영상기준.js [편 폴더 | 컷표 파일 | 컷표영상 | 그래픽 | LAB] [--종류 LAB|그래픽|컷표영상] [--json]'); return 2;
  }
  try {
    const 결과 = 기준읽기(인자.positionals[0], { 종류: 인자.values.종류 });
    console.log(인자.values.json ? JSON.stringify(결과) : 기준글(결과)); return 0;
  } catch (e) { console.error(`영상 기준을 읽지 못했습니다. ${e.message} 원문을 확인한 뒤 같은 명령으로 다시 실행하세요.`); return 1; }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { 기준읽기, 기준글, 출처, 팩자리, main };
