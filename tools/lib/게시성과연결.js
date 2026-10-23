'use strict';
// 게시 주소와 편의 연결만 기록한다. 게시·공개·삭제·서버 쓰기는 하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { postIdOf } = require('./게시성과판정.js');

const GROUPS = new Set(['콘텐츠', '작품', '운영시험', '공개확인대기']);
const handleOf = value => String(value || '').trim().replace(/^https?:\/\//i, '').replace(/^(?:www\.)?(?:facebook\.com|instagram\.com|youtube\.com|tiktok\.com)\//i, '').replace(/^@/, '').replace(/\/$/, '').toLowerCase();
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

function latest(ledger) {
  const out = new Map();
  for (const line of ledger) {
    if (line.kind !== '게시연결' || !GROUPS.has(line.group)) continue;
    const id = postIdOf(line.url);
    if (!id || id.key !== line.post || typeof line.account !== 'string') throw new Error('게시연결 장부의 식별값이 맞지 않는다');
    out.set(line.post, line);
  }
  return out;
}

function identity(folder, row) {
  const id = postIdOf(row.주소);
  if (!id) return { ...row, 편ID: folder };
  if (row.게시물ID && row.게시물ID !== id.externalId) throw new Error('주소와 게시물ID가 다르다');
  if (row.플랫폼 && row.플랫폼 !== id.platform) throw new Error('주소와 플랫폼이 다르다');
  return { ...row, 편ID: folder, 플랫폼: id.platform, 게시물ID: id.externalId };
}

function resultRows(result) {
  return [...(Array.isArray(result?.판) ? result.판 : []), ...(Array.isArray(result?.추가게시) ? result.추가게시 : [])];
}

// 모든 요청을 검증한 뒤에만 쓰기 시작한다. 시간·제목의 유사도만으로 자동 연결하지 않는다.
function prepare(repo, requests, server, accounts, ledger, now) {
  if (!Array.isArray(requests)) throw new Error('연결목록은 배열이어야 한다');
  const old = latest(ledger), seen = new Set(), plans = [];
  for (const input of requests) {
    if (!isObject(input) || !GROUPS.has(input.구분)) throw new Error('연결 구분을 확인한다');
    const id = postIdOf(input.주소);
    if (!id || seen.has(id.key)) throw new Error('연결목록 주소가 없거나 중복이다');
    seen.add(id.key);
    const entries = server.entries.filter(e => postIdOf(e.url)?.key === id.key);
    const account = accounts.find(a => a.key === input.계정);
    if (entries.length !== 1 || !account || account.platform !== id.platform) throw new Error('서버 등록·계정·플랫폼을 하나로 확인하지 못했다');
    const entry = entries[0], channel = server.channels.find(c => c.id === entry.channelId);
    if (!channel || channel.platform !== account.platform || !handleOf(account.handle) || handleOf(channel.handle) !== handleOf(account.handle)) throw new Error('연결 계정이 서버의 실제 계정과 다르다');
    const folder = input.편 || null;
    if (folder && (typeof folder !== 'string' || path.basename(folder) !== folder || /[\\/]|^\.{1,2}$/.test(folder))) throw new Error('편은 docs/마케팅 바로 아래 폴더 이름이어야 한다');
    if (input.구분 !== '운영시험' && !folder) throw new Error('콘텐츠·작품·확인 대기는 편을 지정한다');
    if (folder && !fs.statSync(path.join(repo, 'docs', '마케팅', folder)).isDirectory()) throw new Error('편 폴더가 없다');
    if (!Array.isArray(input.근거) || !input.근거.length || typeof input.이유 !== 'string' || !input.이유.trim()) throw new Error('연결 근거 파일과 이유가 필요하다');
    const evidence = input.근거.map(rel => {
      if (typeof rel !== 'string' || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error('근거는 저장소 안 상대 경로여야 한다');
      const bytes = fs.readFileSync(path.join(repo, rel));
      return { path: rel.replace(/\\/g, '/'), sha256: createHash('sha256').update(bytes).digest('hex') };
    });
    const line = { kind: '게시연결', post: id.key, url: entry.url, platform: id.platform, externalId: id.externalId,
      account: account.key, folder, group: input.구분, reason: input.이유.trim(), evidence };
    const before = old.get(id.key);
    if (before && before.folder && folder && before.folder !== folder && input.정정 !== true) throw new Error('다른 편에 연결된 게시물이다 — 근거를 확인하고 정정을 명시한다');
    const unchanged = before && JSON.stringify(Object.fromEntries(Object.entries(before).filter(([k]) => k !== 'at'))) === JSON.stringify(line);
    plans.push({ line: { at: new Date(now).toISOString(), ...line }, changed: !unchanged, entry });
  }
  return plans;
}

function applyResult(result, folder, plans) {
  if (!isObject(result)) throw new Error('게시결과.json 모양이 달라 건드리지 않았다');
  const out = structuredClone(result);
  if (out.판 != null && !Array.isArray(out.판)) throw new Error('게시결과.json 판이 배열이 아니다');
  out.판 ||= [];
  for (const { line, entry } of plans) {
    if (line.folder !== folder) continue;
    let row = resultRows(out).find(r => r.계정 === line.account && postIdOf(r.주소)?.key === line.post);
    if (!row && line.group !== '공개확인대기') {
      const empty = out.판.filter(r => r.계정 === line.account && !r.주소);
      if (empty.length === 1) row = empty[0];
    }
    if (!row) {
      out.추가게시 ||= [];
      row = { 계정: line.account, 상태: '공개 확인 필요', 시각: entry.publishedAt };
      out.추가게시.push(row);
    }
    // 예약 성공과 공개 확인은 별개다. 링크를 회수해도 기존 상태·예약 시각을 바꾸지 않는다.
    Object.assign(row, identity(folder, { ...row, 주소: line.url }), { 성과구분: line.group, 연결근거: line.evidence });
  }
  return out;
}

function filterServer(server, connections) {
  const excluded = new Set([...connections.values()].filter(l => l.group !== '콘텐츠').map(l => l.post));
  return { ...server,
    entries: server.entries.filter(e => !excluded.has(postIdOf(e.url)?.key)),
    posts: server.posts.filter(p => !excluded.has(postIdOf(p.url)?.key)) };
}

function writeResults(repo, plans) {
  const files = [], pending = [];
  for (const folder of new Set(plans.map(p => p.line.folder).filter(Boolean))) {
    const file = path.join(repo, 'docs', '마케팅', folder, '게시', '게시결과.json');
    const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    const data = raw === null ? {} : JSON.parse(raw.replace(/^\uFEFF/, ''));
    const next = applyResult(data, folder, plans);
    if (JSON.stringify(data) === JSON.stringify(next)) continue;
    const text = (JSON.stringify(next, null, 2) + '\n').replace(/\n/g, /\r\n/.test(raw || '') ? '\r\n' : '\n');
    pending.push({ file, raw, text });
  }
  for (const { file, raw, text } of pending) {
    if ((fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null) !== raw) throw new Error('게시결과가 바뀌어 연결 쓰기를 멈췄다');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = file + `.연결-${process.pid}.tmp`;
    fs.writeFileSync(temp, text, { flag: 'wx' });
    fs.renameSync(temp, file);
    files.push(path.relative(repo, file).replace(/\\/g, '/'));
  }
  return files;
}

module.exports = { GROUPS, latest, identity, resultRows, prepare, applyResult, filterServer, writeResults };
