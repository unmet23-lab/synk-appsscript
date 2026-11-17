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
const 정규화 = 글 => 글.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const 지문 = 글 => crypto.createHash('sha256').update(글).digest('hex');

function git(뿌리, 인자, 옵션 = {}) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...인자], {
    cwd: 뿌리, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 << 20,
    input: 옵션.입력, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
  });
  if (r.error || r.status !== 0) throw Error(`Git ${인자[0]} 확인 실패. ${r.error?.message || r.stderr.trim()}`);
  return r.stdout;
}

function 원문읽기(작업본) {
  const 뿌리 = 공용작업본(작업본);
  // origin을 따라가기 전인 공용본에서도 이미 받아 놓은 최신 기준을 쓴다.
  // 같은 원문을 양쪽에서 고쳤으면 어느 쪽의 지적도 조용히 잃지 않는다.
  const ref = 'refs/remotes/origin/master';
  const [공용커밋, 원격커밋 = ''] = git(뿌리, ['rev-parse', '--revs-only', 'HEAD', ref]).trim().split(/\r?\n/);
  if (!/^[0-9a-f]{40,64}$/.test(공용커밋)) throw Error('공용 작업본의 HEAD 커밋을 확인할 수 없습니다.');
  const 기준점 = 원격커밋 && 원격커밋 !== 공용커밋 ? git(뿌리, ['merge-base', 공용커밋, 원격커밋]).trim() : '';
  const 받은변경 = 기준점 && 기준점 !== 원격커밋
    ? new Set(git(뿌리, ['diff', '--name-only', '-z', 기준점, 원격커밋, '--', ...Object.values(출처)]).split('\0'))
    : new Set();
  const 내용 = {}, 원격원문 = [];
  for (const [이름, 상대] of Object.entries(출처)) {
    const 파일 = path.join(뿌리, 상대);
    let 글 = 정규화(fs.readFileSync(파일, 'utf8'));
    if (받은변경.has(상대)) {
      const 새글 = 정규화(git(뿌리, ['show', 원격커밋 + ':' + 상대]));
      if (글 !== 새글 && 글 !== 정규화(git(뿌리, ['show', 기준점 + ':' + 상대]))) {
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
  const 글 = git(뿌리, ['blame', '--incremental', ...(원격 ? [원격커밋] : ['--contents', '-']), '--', 출처.점검표],
    원격 ? {} : { 입력: 내용.점검표 });
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
  표.sort((a, b) => (변경.get(b.줄) - 변경.get(a.줄)) || b.번호 - a.번호);
  // 같은 날 한꺼번에 받은 새 지적도 모두 나오게 한다. 이전 판은 비교용 지문과 함께 JSON에 남긴다.
  const 최근값 = 변경.get(표[0].줄);
  const 최근지적 = 표.filter((x, i) => i < 3 || 변경.get(x.줄) === 최근값);
  return { 최근지적, 점검표: 표 };
}

function 사례읽기(글, 입력) {
  const 목차 = /^## 분야별 찾기[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(글)?.[1];
  const 분야 = (목차 || '').split('\n').filter(x => /^\|/.test(x) && !/^\|\s*(분야\s*\||-)/.test(x));
  if (!분야.length) throw Error('만족 사례 장부의 분야별 찾기를 읽을 수 없습니다.');
  let 지정 = '';
  if (입력 && !방식.includes(입력)) {
    const p = path.resolve(입력);
    const 파일 = fs.existsSync(p) && fs.statSync(p).isFile();
    const 폴더 = 파일 ? path.dirname(p) : p;
    const 후보 = [...(파일 ? [p] : []), path.join(폴더, '컷표.json'), path.join(폴더, '컷순서.json')];
    for (const 표 of new Set(후보)) {
      if (path.extname(표).toLowerCase() !== '.json' || !fs.existsSync(표)) continue;
      지정 = String(JSON.parse(정규화(fs.readFileSync(표, 'utf8'))).가까운사례 || '');
      if (지정) break;
    }
  }
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
  const 자료 = 원문읽기(작업본);
  const 규칙 = { 흠갈래: JSON.parse(자료.내용.흠갈래), 모음: JSON.parse(자료.내용.모음),
    점검표: 자료.내용.점검표, LAB교훈: 자료.내용.LAB교훈 };
  if (!Array.isArray(규칙.흠갈래.줄) || !Array.isArray(규칙.모음.지적)) throw Error('흠갈래나 슬롭점검 모음의 규칙 목록을 읽을 수 없습니다.');
  const 한장 = /^## 열두 원칙[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(자료.내용.스킬)?.[1];
  if (!한장?.trim()) throw Error('synk-video 스킬의 열두 원칙을 읽을 수 없습니다.');
  const 기본원칙 = 한장.split('\n').filter(x => /^\d+\. /.test(x));
  if (!기본원칙.length) throw Error('synk-video 스킬에 제작 원칙이 없습니다.');
  const 지적 = 지적읽기(자료.내용.점검표, 변경순서(자료));
  const 만족사례 = 사례읽기(자료.내용.만족사례, 입력);
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
    원문, 기본원칙, ...지적, 만족사례, 경로기준, 이력 };
}

function 기준글(r) {
  const lines = [`[영상 기준] ${r.기준판}`, `공용 작업본 ${r.공용작업본}`, ...(r.길 ? [`제작 방식 ${r.길}`] : []),
    '최근에 바뀐 점검표 항목', ...r.최근지적.map(x => `#${x.번호} ${x.이름}\n  근거  ${x.말씀}\n  확인할 것  ${x.확인}\n  고칠 것  ${x.고침}`),
    '', ...r.기본원칙.map(x => /^(\d+\. )\*\*([^*]+)\*\*/.exec(x)?.slice(1, 3).join('') || x)];
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
module.exports = { 기준읽기, 기준글, 출처, main };
