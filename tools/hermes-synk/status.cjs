#!/usr/bin/env node
'use strict';

// Read-only adapter for the existing SYNK sources. It starts no model or server.
const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const { createHash } = require('node:crypto');
const { trackItems, cacheDirectory } = require('../운영홈');
const { targets } = require('../operations-home/resume');
const { readClaude: officialClaude } = require('../operations-home/native-status');
const { 머리읽기, 대상나누기 } = require('../참고카드_목록');

const ROOT = path.resolve(__dirname, '../..');
const TRACK = 'docs/_ops/트랙.md';
const CARDS = 'docs/참고카드/카드';
const MAX_TEXT = 3900;
const MAX_CARD_FILES = 500;
const decoder = new TextDecoder('utf-8', { fatal: true });
const digest = value => createHash('sha256').update(String(value)).digest('hex');
const STATUS_NAMES = Object.freeze({
  active: '진행', running: '진행', idle: '대기', response_complete: '응답 종료',
  error: '오류', needs_attention: '확인 필요', interrupted: '중단', unknown: '미확인',
});

function clip(value, limit) {
  const text = String(value ?? '');
  if (text.length <= limit) return text;
  let end = limit - 1;
  if (end > 0 && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
  return text.slice(0, end) + '…';
}

function plain(value, limit = 300) {
  return clip(String(value ?? '')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, '[링크]')
    .replace(/[A-Z]:[\\/][^\s)]+/gi, '[로컬 경로]')
    .replace(/(?:~[\\/]|\/(?:home|Users)\/)[^\s)]+/g, '[개인 경로]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[계정]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [숨김]')
    .replace(/\b(?:sk-|ghp_|github_pat_|xox[baprs]-|AIza)[A-Za-z0-9_-]{12,}/g, '[숨김]')
    .replace(/\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g, '[인증값 숨김]')
    .replace(/\b(?:api[_ -]?key|(?:access|refresh|bot|telegram_bot)[_ -]?token|token|client[_ -]?secret|secret|authorization|password|비밀번호|토큰)["']?\s*[:=]\s*["']?[^\s,;]+/gi, '[인증값 숨김]')
    .replace(/[`*<>]/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim(), limit);
}

function normalizeQuery(query) {
  if (typeof query !== 'string' || query.length > 80 || /[\u0000-\u001F\u007F]/.test(query)) {
    throw new Error('검색어는 줄바꿈 없는 80자 이내로 입력해 주세요.');
  }
  return query.normalize('NFC').trim() || '전체';
}

function queryMatcher(query) {
  if (query === '전체') return () => true;
  const lower = query.toLocaleLowerCase('ko-KR');
  const target = targets.find(row => row.id === lower || row.label.toLocaleLowerCase('ko-KR') === lower);
  if (target) {
    const pattern = new RegExp(target.match, 'i');
    return text => String(text).toLocaleLowerCase('ko-KR').includes(lower) || pattern.test(text);
  }
  // User input is a literal substring, never a regular expression or shell argument.
  return text => String(text).normalize('NFC').toLocaleLowerCase('ko-KR').includes(lower);
}

function key(value) {
  const normalized = path.resolve(value);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function safePath(root, relative) {
  const base = fs.realpathSync(root);
  const requested = path.resolve(base, relative);
  const rel = path.relative(base, requested);
  if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw new Error('PATH');
  let current = base;
  for (const part of rel.split(path.sep)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('SYMLINK');
  }
  if (key(fs.realpathSync(requested)) !== key(requested)) throw new Error('SYMLINK');
  return requested;
}

function readText(root, relative, maxBytes) {
  const file = safePath(root, relative);
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > maxBytes) throw new Error('SIZE');
  const descriptor = fs.openSync(file, 'r');
  try {
    const current = fs.fstatSync(descriptor);
    if (!current.isFile() || current.size > maxBytes) throw new Error('SIZE');
    const bytes = Buffer.alloc(current.size + 1);
    const read = fs.readSync(descriptor, bytes, 0, bytes.length, 0);
    if (read > maxBytes || read !== current.size) throw new Error('CHANGED');
    return { content: decoder.decode(bytes.subarray(0, read)).replace(/^\uFEFF/, ''), modifiedAt: current.mtime.toISOString() };
  } finally { fs.closeSync(descriptor); }
}

function readTrack(root, matches) {
  try {
    const document = readText(root, TRACK, 3_000_000);
    if (!/^#\s+\S/m.test(document.content)) throw new Error('FORMAT');
    const all = trackItems(document.content);
    const seen = new Map();
    const snapshotItems = all.slice(0, 2000).map(row => {
      const stableTitle = row.title.normalize('NFC').replace(/\([^)]*\d{1,2}-\d{1,2}[^)]*\)/g, '').replace(/\s+/g, ' ').trim();
      const identity = digest(stableTitle).slice(0, 20);
      const occurrence = (seen.get(identity) || 0) + 1;
      seen.set(identity, occurrence);
      return {
        id: 'track-' + identity + (occurrence > 1 ? '-' + occurrence : ''),
        fingerprint: digest(row.heading + '\n' + row.text.normalize('NFC').replace(/\r\n/g, '\n').trim()),
        line: row.line, title: plain(row.title, 100), heading: plain(row.heading, 70),
        summary: plain(row.text.replace(/^\*\*[^]*?\*\*\s*/, ''), 250),
        status: '문서 기록 · 현재 실행 미확인',
      };
    });
    const found = all.filter(row => matches(row.heading + ' ' + row.text));
    return {
      available: true, file: TRACK, modifiedAt: document.modifiedAt, total: all.length,
      matched: found.length, omitted: Math.max(0, found.length - 6),
      items: found.slice(0, 6).map(row => ({
        line: row.line, title: plain(row.title, 100), heading: plain(row.heading, 70),
        summary: plain(row.text.replace(/^\*\*[^]*?\*\*\s*/, ''), 250),
        status: '문서 기록 · 현재 실행 미확인',
      })),
      snapshot: { complete: all.length <= 2000, items: snapshotItems },
    };
  } catch { return { available: false, file: TRACK, total: null, matched: null, items: [], error: '원문을 안전하게 읽지 못했습니다.' }; }
}

function readCardStatus(root, matches) {
  let folder;
  try { folder = safePath(root, CARDS); } catch {
    return { available: false, total: null, matched: null, items: [], error: '카드 폴더를 안전하게 읽지 못했습니다.' };
  }
  const rows = [];
  let seen = 0;
  let unreadable = 0;
  let limited = false;
  let directory;
  try {
    directory = fs.opendirSync(folder);
    let entry;
    while ((entry = directory.readSync())) {
      if (!entry.name.endsWith('.md')) continue;
      if (++seen > MAX_CARD_FILES) { limited = true; break; }
      if (!entry.isFile() || entry.isSymbolicLink()) { unreadable++; continue; }
      try {
        const file = CARDS + '/' + entry.name;
        const document = readText(root, file, 1_000_000);
        const meta = 머리읽기(document.content);
        if (!meta) { unreadable++; continue; }
        rows.push({
          file, title: plain(meta.제목 || entry.name, 100), targets: 대상나누기(meta.대상).slice(0, 10).map(x => plain(x, 50)),
          status: plain(meta.상태 || '미기록', 70), when: plain(meta.언제 || '미정', 40),
          summary: plain(meta.한줄, 140), sharedAt: plain(meta.공유일, 30), modifiedAt: document.modifiedAt,
          id: 'card-' + digest(file).slice(0, 20), fingerprint: digest(document.content.replace(/\r\n/g, '\n')),
          ledgerRow: /^\d+행$/.test(meta.장부 || '') ? Number(meta.장부.slice(0, -1)) : null,
          postId: /^[A-Za-z0-9_-]{1,120}$/.test(meta.게시물ID || '') ? meta.게시물ID : null,
        });
      } catch { unreadable++; }
    }
  } catch {
    return { available: false, total: null, matched: null, items: [], error: '카드 목록을 읽지 못했습니다.' };
  } finally { if (directory) directory.closeSync(); }
  rows.sort((a, b) => b.sharedAt.localeCompare(a.sharedAt) || a.file.localeCompare(b.file));
  const found = rows.filter(row => matches([row.title, row.targets.join(' '), row.summary, row.status].join(' ')));
  const counts = { applied: 0, pending: 0, unknown: 0 };
  for (const row of found) {
    if (row.status.startsWith('적용함')) counts.applied++;
    else if (row.status === '새로') counts.pending++;
    else counts.unknown++;
  }
  return { available: true, total: rows.length, matched: found.length, unreadable, limited, counts, omitted: Math.max(0, found.length - 4), items: found.slice(0, 4), snapshot: { complete: !limited && !unreadable, items: rows } };
}

function readCodex(root) {
  // This is the existing operations-home cache, not a conversation store.
  try {
    const folder = cacheDirectory(root);
    const document = readText(path.dirname(folder), path.basename(folder) + '/runtime.json', 1_000_000);
    return { ...JSON.parse(document.content), connected: true };
  } catch { return { connected: false, stale: true, tasks: [], checkedAt: null }; }
}

function runtimeSummary(root, source, input, now) {
  const validAt = typeof input?.checkedAt === 'string' && Number.isFinite(Date.parse(input.checkedAt));
  const age = validAt ? now.getTime() - Date.parse(input.checkedAt) : null;
  const valid = input?.connected === true && validAt && age >= -60_000 && Array.isArray(input.tasks);
  const stale = !valid || input.stale === true || age > (source === 'Codex' ? 45 * 60_000 : 60_000);
  const counts = {};
  const rootKey = key(fs.realpathSync(root));
  let total = 0;
  if (valid) for (const task of input.tasks.slice(0, 100)) {
    if (!task || typeof task.cwd !== 'string') continue;
    // Exact repository metadata only. No personal conversation titles, IDs or paths leave this module.
    try { if (key(fs.realpathSync(task.cwd)) !== rootKey) continue; } catch { continue; }
    const status = Object.hasOwn(STATUS_NAMES, task.status) ? task.status : 'unknown';
    counts[status] = (counts[status] || 0) + 1;
    total++;
  }
  return {
    source, connected: valid, stale, checkedAt: validAt && age >= -60_000 ? new Date(input.checkedAt).toISOString() : null,
    total: valid ? total : null, counts,
    coverage: source === 'Codex' ? '운영 홈의 기존 조회 사본 · 최근/고정 작업만 · 이 저장소만' : '공식 Claude agents 조회 · 이 저장소만',
    note: !valid ? '현재 실행 상태 미확인' : stale ? '지난 조회 기록 · 현재 실행 미확인' : source === 'Codex' ? '최근 조회 기록 · 실시간 아님' : '조회 시점의 실행 상태',
  };
}

function seoul(iso) {
  if (!iso) return '미확인';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(iso)) + ' KST';
}

function formatStatus(report) {
  const lines = [`SYNK 상태 · ${plain(report.query, 80)}`, `확인 ${seoul(report.checkedAt)}`, '문서 기록과 실행 상태를 구분합니다.'];
  lines.push('', '실행 상태(검색어와 관계없이 이 저장소 전체)');
  for (const runtime of report.runtimes) {
    const counts = Object.entries(runtime.counts).map(([status, count]) => STATUS_NAMES[status] + ' ' + count).join(' · ');
    lines.push(`- ${runtime.source}: ${runtime.note}${runtime.connected ? ' · ' + (counts || '조회된 작업 0') : ''}`);
    lines.push(`  기준 ${seoul(runtime.checkedAt)}`);
  }
  lines.push('대기·응답 종료는 작업 완료를 뜻하지 않습니다.');
  const track = report.documents.track;
  lines.push('', '트랙 · 문서 기록(앞부분 발췌)');
  if (!track.available) lines.push(track.error);
  else {
    lines.push(`문서 수정 ${seoul(track.modifiedAt)} · 일치 ${track.matched}/${track.total}개`);
    for (const item of track.items) lines.push(`- ${item.title} (${item.line}행)\n  ${item.summary || '상세 내용은 원문에서 확인하세요.'}`);
    if (!track.matched) lines.push('관련 기록을 찾지 못했습니다. 완료나 할 일 없음의 근거는 아닙니다.');
    if (track.omitted) lines.push(`그 밖에 ${track.omitted}개 · 검색어로 좁혀 보세요.`);
  }
  const cards = report.documents.cards;
  lines.push('', '참고카드 · 파일에 기록된 상태');
  if (!cards.available) lines.push(cards.error);
  else {
    lines.push(`일치 ${cards.matched}/${cards.total}장 · 적용함 ${cards.counts.applied} · 새로 ${cards.counts.pending} · 기타/미기록 ${cards.counts.unknown}`);
    for (const card of cards.items) lines.push(`- ${card.title}: ${card.status} · ${card.when}`);
    if (cards.unreadable || cards.limited) lines.push(`안전하게 못 읽은 카드 ${cards.unreadable}장${cards.limited ? ' · 목록 상한으로 일부 미조회' : ''}`);
    if (cards.omitted) lines.push(`그 밖에 ${cards.omitted}장`);
    lines.push('팁 장부의 원격 상태는 이번 조회에 포함하지 않습니다.');
  }
  lines.push('', `원문: ${TRACK} · docs/참고카드/`, '사용: /synk 상태 WORLD (또는 검색어)');
  let output = lines.join('\n');
  if (output.length > MAX_TEXT) output = clip(output, MAX_TEXT - 60) + '\n일부 생략 · /synk 상태 검색어 로 좁혀 보세요.';
  return output;
}

async function readStatus({ root = ROOT, query = '전체', now = new Date(), readClaude = officialClaude, readCodexStatus = readCodex } = {}) {
  const requested = normalizeQuery(query);
  const clock = new Date(now);
  if (!Number.isFinite(clock.getTime())) throw new Error('확인 시각을 읽지 못했습니다.');
  const matches = queryMatcher(requested);
  const documents = { track: readTrack(root, matches), cards: readCardStatus(root, matches) };
  const invoke = async reader => { try { return await reader(root); } catch { return null; } };
  const [claude, codex] = await Promise.all([invoke(readClaude), invoke(readCodexStatus)]);
  const report = {
    version: 1, checkedAt: clock.toISOString(), query: plain(requested, 80),
    coverage: '고정 원문과 기존 실행 메타데이터의 읽기 전용 조회 · AI 호출 없음 · 외부 장부/운영 서비스 미검증',
    documents, runtimes: [runtimeSummary(root, 'Claude', claude, clock), runtimeSummary(root, 'Codex', codex, clock)],
    snapshot: {
      track: { available: documents.track.available, complete: documents.track.snapshot?.complete === true, items: documents.track.snapshot?.items || [] },
      cards: { available: documents.cards.available, complete: documents.cards.snapshot?.complete === true, items: documents.cards.snapshot?.items || [] },
    },
  };
  delete documents.track.snapshot;
  delete documents.cards.snapshot;
  report.text = formatStatus(report);
  return report;
}

async function main(args = process.argv.slice(2)) {
  const json = args.includes('--json');
  const terms = args.filter(arg => arg !== '--json');
  if (terms.length > 1 || terms.some(arg => arg.startsWith('--'))) throw new Error('사용: node tools/hermes-synk/status.cjs [전체|검색어] [--json]');
  const report = await readStatus({ query: terms[0] || '전체' });
  process.stdout.write((json ? JSON.stringify(report, null, 2) : report.text) + '\n');
}

if (require.main === module) main().catch(() => { process.stderr.write('상태 조회 실패. 사용: node tools/hermes-synk/status.cjs [전체|검색어] [--json]\n'); process.exitCode = 1; });

module.exports = { readStatus, formatStatus, normalizeQuery, plain, safePath, readText, readCodex, runtimeSummary, MAX_TEXT };
