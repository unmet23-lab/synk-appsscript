#!/usr/bin/env node
'use strict';
// 문서 머리의 실제 선언과 탐색 위치를 조회한다. 현행·커밋·정본 파일명은 사용자 확정과 같지 않다.
const path = require('path');
const fs = require('fs');
const { inventory, safeRead, maskCode } = require('./lib/knowledge-files');
const ROOT = path.resolve(__dirname, '..');
const 상태들 = ['✅확정', '🔄개편중', '🔵논의중'];
const 상태식 = /^\s*(?:>|<!--)\s*상태\s*[:：]\s*(✅\s*확정|🔄\s*개편중|🔵\s*논의중)/;
const 별표지우기 = (줄) => String(줄).replace(/\*/g, '');

function 선언읽기(text) {
  const lines = maskCode(text).split(/\r?\n/).slice(0, 12);
  for (let i = 0; i < lines.length; i++) {
    const line = 별표지우기(lines[i]);
    const m = 상태식.exec(line);
    if (m) return { 상태: m[1].replace(/\s+/g, ''), 줄: line.trim().replace(/^<!--\s*|\s*-->$/g, '').replace(/^>\s*/, ''), line: i + 1 };
  }
  // 머리 인용문·주석의 명시적 문구만. 본문의 정본 인용은 현행 승격의 근거가 아니다.
  for (let i = 0; i < lines.length; i++) {
    const line = 별표지우기(lines[i]);
    if (!/^\s*(?:>|<!--)/.test(line)) continue;
    const own = line.trim().replace(/^(?:>\s*|<!--\s*)/, '');
    const notCurrent = /현행\s*(?:기준|정본|진입점|안내)(?:이|가|은|는)?\s*(?:아니|아님)/.test(own);
    const state = /(?:초안|검토 중|검토중|제안|논의중)/.test(line) ? '초안·검토 표기' :
      !notCurrent && /(?:^|[·.]\s*|의\s*)현행 (?:진입점|안내)(?=\s*(?:[·.—]|$))/.test(own) ? '현행 안내 표기' :
      !notCurrent && /^(?:\d{4}-\d{2}-\d{2}\s*[·—]\s*)?현행 (?:기준|정본)(?=\s*(?:[·.—]|$))/.test(own) ? '현행 기준 표기' :
      /<!--\s*정본(?:\s*:\s*v\d+(?:\.\d+)*)?\s*-->/.test(line) ? '정본 선언' : null;
    if (state) return { 상태: state, 줄: line.trim(), line: i + 1 };
  }
  return null;
}

// 기존 호출자 호환: 옛 명시 상태만 반환한다. 새 조회 결과는 inspectText를 사용한다.
function 상태읽기(absolute) {
  try {
    const result = 선언읽기(fs.readFileSync(absolute, 'utf8'));
    return result && 상태들.includes(result.상태) ? { 상태: result.상태, 줄: result.줄 } : null;
  } catch { return null; }
}

function inspectText(text) {
  const headings = [];
  maskCode(text).split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^(#{1,6})\s+(.+)/);
    if (m) headings.push({ line: i + 1, level: m[1].length, title: m[2].replace(/\s+#+\s*$/, '') });
  });
  return { declaration: 선언읽기(text), headings };
}

function query({ root = ROOT, all = false, file, search } = {}) {
  const listed = inventory(root);
  const errors = [...listed.errors];
  const eligible = listed.files.filter((r) => r !== 'MEMORY.md' && /\.md$/i.test(r) &&
    (!r.includes('/') || (r.startsWith('docs/') && (all || r.split('/').length === 2))));
  const normalized = file && file.replace(/\\/g, '/');
  if (normalized && (!listed.files.includes(normalized) || !/\.md$/i.test(normalized))) errors.push({ file: normalized, kind: 'not-in-git-markdown-inventory' });
  const files = normalized ? listed.files.filter((r) => r === normalized && /\.md$/i.test(r)) : eligible;
  const documents = [];
  for (const relative of files) {
    try {
      const info = inspectText(safeRead(root, relative));
      const term = search && search.toLocaleLowerCase();
      const matches = term ? info.headings.filter((h) => h.title.toLocaleLowerCase().includes(term)) : [];
      if (term && !relative.toLocaleLowerCase().includes(term) && !matches.length) continue;
      documents.push({ file: relative, tracked: listed.tracked.has(relative), declaration: info.declaration,
        ...(normalized ? { headings: info.headings } : term ? { matches } : {}) });
    } catch { errors.push({ file: relative, kind: 'read-unavailable' }); }
  }
  return { scope: all ? 'root + docs recursive, Git non-ignored Markdown' : 'root + docs top-level, Git non-ignored Markdown',
    note: '머리 12줄의 문서 자체 표기다. 미표기는 결함 판정이 아니며 현행·정본·커밋은 사용자 확정 증거가 아니다.',
    examined: files.length, documents, errors };
}

function main(args = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--전체') options.all = true;
    else if (arg === '--json' || arg === '--미표기') continue;
    else if (arg === '--file' || arg === '--목차' || arg === '--찾기') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${arg}: 값이 필요하다`);
      options[arg === '--찾기' ? 'search' : 'file'] = args[++i];
    } else if (arg === '--help') {
      console.log('문서상태.js [--전체] [--json] [--미표기] [--찾기 이름/제목] [--file 경로 | --목차 경로]\n읽기 전용. 검색은 파일명·절 제목이며 본문·승인 여부를 대신 읽지 않는다.');
      return;
    } else throw new Error(`알 수 없는 옵션: ${arg}`);
  }
  const result = query(options);
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`문서 조회: ${result.documents.length}개 / 조회 대상 ${result.examined}개\n${result.note}`);
    const counts = {};
    for (const d of result.documents) {
      const state = d.declaration?.상태 || '머리 상태 미표기';
      counts[state] = (counts[state] || 0) + 1;
      if (options.file || options.search || d.declaration || args.includes('--미표기')) {
        console.log(`${d.file}${d.tracked ? '' : ' [작업 중·미추적]'} — ${state}`);
        if (d.declaration) console.log(`  ${d.declaration.line}: ${d.declaration.줄}`);
        for (const h of d.headings || d.matches || []) console.log(`  ${h.line}: ${h.title}`);
      }
    }
    console.log(JSON.stringify(counts));
    if (result.errors.length) console.error(`확인 불가 ${result.errors.length}건 (--json의 errors)`);
  }
  if (result.errors.length) process.exitCode = 2;
}

module.exports = { 상태읽기, 상태식, 상태들, 선언읽기, inspectText, query, main };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 2; }
}
