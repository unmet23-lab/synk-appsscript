'use strict';
// 게시 주소와 편의 연결만 기록한다. 게시·공개·삭제·서버 쓰기는 하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { postIdOf } = require('./게시성과판정.js');

const GROUPS = new Set(['콘텐츠', '작품', '운영시험', '공개확인대기']);
const handleOf = value => String(value || '').trim().replace(/^https?:\/\//i, '').replace(/^(?:www\.)?(?:facebook\.com|instagram\.com|youtube\.com|tiktok\.com|t\.me|threads\.com|threads\.net)\//i, '').replace(/^@/, '').replace(/\/$/, '').toLowerCase();
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const pathParts = value => { try { return new URL(String(value)).pathname.split('/').filter(Boolean); } catch { return []; } };

/** sns-계정.json 계정 하나가 서버 채널과 같은 계정인가 — 같은 플랫폼이고 핸들이 같거나(「@synk.mn」 · 「facebook.com/synkworld」 · 「t.me/synkmn」 꼴을 맞춘다),
 * 핸들 없는 페북 페이지는 원장 apiPageId가, 핸들 없는 유튜브 채널은 원장 expectedChannelId가 채널 externalId와 같을 때(11-18 — Sri Lanka · Cambodia
 * 페북, lab-mx-youtube는 서버 채널에 핸들이 없다). 둘 다 없는 계정은 원장 주소의 경로 한 칸이 채널 externalId와 글자 그대로 같을 때
 * (11-19 — 샤오훙수 /user/profile/<번호>, RUTUBE /channel/<번호>). 이름이 비슷한 것은 보지 않는다. */
function channelMatches(account, channel) {
  if (!account || !channel || account.platform !== channel.platform) return false;
  const handle = handleOf(account.handle);
  if (handle && handleOf(channel.handle) === handle) return true;
  if (!channel.externalId) return false;
  if (account.apiPageId || account.expectedChannelId) return [account.apiPageId, account.expectedChannelId].some(v => v && String(v) === String(channel.externalId));
  return Boolean(!handle && pathParts(account.url).includes(String(channel.externalId)));
}

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

/** 게시결과 줄 하나가 가리키는 게시물(11-18 설계 검토 — 「같은 게시물인가」를 여러 곳이 따로 세던 것을 여기 하나로).
 * 주소가 게시물로 읽히면 그것. 아니면 「게시물ID」에 줄의 「플랫폼」(없으면 platform 인자)을 붙인다. 플랫폼을 모르면 key 없이 externalId만,
 * 주소가 게시물로 안 읽히면 그 글자 그대로를 key로(raw). 아무것도 없으면 null. */
function postOfRow(row, platform = null) {
  if (!row || typeof row !== 'object') return null;
  const id = postIdOf(row.주소);
  if (id) return id;
  const ext = row.게시물ID != null && row.게시물ID !== '' ? String(row.게시물ID) : null;
  const p = row.플랫폼 || platform || null;
  if (ext) return { platform: p, externalId: ext, key: p ? `${p}:${ext}` : null };
  return row.주소 ? { platform: null, externalId: null, key: String(row.주소), raw: true } : null;
}
/** 두 줄이 같은 게시물인가 — 둘 다 key가 있으면 key로, 한쪽이 플랫폼을 모르면 게시물ID로 견준다 */
function samePost(a, b, platform = null) {
  // 같은 주소 글자면 같은 게시물이다 — 게시물로 안 읽히는 주소(페북 share/r 등)에 한쪽만 게시물ID를 적어 둔 줄도(5회차 GA2)
  if (a && b && typeof a.주소 === 'string' && a.주소.trim() && a.주소.trim() === String(b.주소 ?? '').trim()) return true;
  const x = postOfRow(a, platform), y = postOfRow(b, platform);
  if (!x || !y) return false;
  if (x.key && y.key) return x.key === y.key;
  return Boolean(x.externalId && y.externalId && x.externalId === y.externalId);
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
    if (!channelMatches(account, channel)) throw new Error('연결 계정이 서버의 실제 계정과 다르다');
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
      account: account.key, folder, group: input.구분, reason: input.이유.trim(), evidence,
      // 누가 이었나 — 「캡션」은 tools/게시성과.js가 판 글로 스스로 이은 줄(lib/게시성과캡션.js). 없으면 사람이 --연결목록으로 이은 줄
      ...(typeof input.방법 === 'string' && input.방법.trim() ? { how: input.방법.trim() } : {}),
      // 사람이 「게시결과의 이 번호 줄이 이 게시물」이라고 밝힌 연결 — 그 줄에 적힌 게시물ID를 글자 그대로 받는다(페북 페이지 게시물 번호 ↔ 릴스 주소).
      // 도구가 다른 번호 줄 가운데 하나를 찾지 않는다(설계 검토 8 대안 B — 15회차 GA1 · 손연결 GA1 · GA2 · 2회차 GA1~GA3이 모두 그 찾기에서 나왔다)
      ...(typeof input.같은게시물 === 'string' && input.같은게시물.trim() ? { samePost: input.같은게시물.trim() } : {}) };
    if (Object.prototype.hasOwnProperty.call(input, '같은게시물')) {
      if (!line.samePost) throw new Error('같은게시물에는 게시결과 그 판 줄의 게시물ID를 글자 그대로 적는다');
      // 공개 확인 대기는 판 줄을 채우지 않고(손연결 2회차 GA2), 편이 없는 연결은 적을 게시결과가 없다
      if (input.구분 === '공개확인대기') throw new Error('같은게시물은 공개확인대기와 함께 쓰지 않는다');
      if (!folder) throw new Error('같은게시물은 편과 함께 쓴다');
    }
    const before = old.get(id.key);
    if (before && before.folder && folder && before.folder !== folder && input.정정 !== true) throw new Error('다른 편에 연결된 게시물이다 — 근거를 확인하고 정정을 명시한다');
    const unchanged = before && JSON.stringify(Object.fromEntries(Object.entries(before).filter(([k]) => k !== 'at'))) === JSON.stringify(line);
    plans.push({ line: { at: new Date(now).toISOString(), ...line }, changed: !unchanged, entry });
  }
  // 같은게시물 번호가 이 목록의 다른 게시물 번호면 서로 어긋난 요청이다 — 처리 순서에 따라 결과가 갈리지 않게 쓰기 전에 거절한다(손연결 3회차)
  const ids = new Set(plans.map(p => `${p.line.platform}:${p.line.externalId}`));
  for (const { line } of plans) if (line.samePost && line.samePost !== line.externalId && ids.has(`${line.platform}:${line.samePost}`)) throw new Error(`같은게시물 번호 ${line.samePost}는 이 연결목록의 다른 게시물 번호다 — 두 요청 가운데 하나를 고친다`);
  return plans;
}

// applyResult가 추가게시에 새로 만드는 줄에는 「만든곳」 표시와, 도구가 마지막으로 쓴 내용의 「만든지문」을 남긴다. 표시가 있고 지문이 지금 내용과 같으며
// 꼴이 이 연결과 같은 줄만 이 도구가 만든 줄로 보고 옮긴다. 칸 꼴만으로 가르면, 손으로 고친 줄에 연결을 적는 순간 편ID 같은 칸이 도구 꼴로 돌아가
// 다음 실행이 그 줄을 지운다(손연결 5회차 GA1 · 6회차). 그래서 지문이 맞지 않는 줄에 연결을 적을 때는 지문을 지워, 다시는 도구가 만든 줄로 보지 않는다.
// 표시는 새로 만드는 줄에만 붙는다. 표시 없는 옛 추가게시 줄은 옮기지 않는다. 도구는 추가게시 줄에 처음게시물ID를 적지 않는다(3회차 GA1)
const EXTRA_MARK = '게시성과 --연결목록';
const AUTO_EXTRA_KEYS = new Set(['계정', '상태', '시각', '만든곳', '만든지문', '주소', '편ID', '플랫폼', '게시물ID', '성과구분', '연결근거']);
const stableJson = v => (Array.isArray(v) ? `[${v.map(stableJson).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(',')}}`
    : JSON.stringify(v));
const madeHash = r => { const { 만든지문: _, ...rest } = r; return createHash('sha256').update(stableJson(rest)).digest('hex').slice(0, 16); };
const untouched = r => r.만든곳 === EXTRA_MARK && typeof r.만든지문 === 'string' && r.만든지문 === madeHash(r);
// 번호 없는 빈 줄 하나를 그 게시물의 줄로 볼 수 있는 상태 — 취소됨 · 지움 · 보류 · 실패 · 승인 대기 · 대기 줄은 나가지 않은 판이다(설계 검토 8 P1-1).
// 예약된 시각이 게시 시각보다 한 시간 넘게 뒤인 줄은 다음 예약이다.
const LIVE_STATES = new Set(['게시됨', '예약됨', '보내는 중', '확인 필요']);
const LATER_MS = 60 * 60 * 1000;
const numberOf = r => (r.게시물ID == null || r.게시물ID === '' ? null : String(r.게시물ID));

function applyResult(result, folder, plans) {
  if (!isObject(result)) throw new Error('게시결과.json 모양이 달라 건드리지 않았다');
  const out = structuredClone(result);
  if (out.판 != null && !Array.isArray(out.판)) throw new Error('게시결과.json 판이 배열이 아니다');
  out.판 ||= [];
  const extra = () => (Array.isArray(out.추가게시) ? out.추가게시 : []);
  const fresh = new WeakSet();
  const addExtra = (line, entry) => {
    out.추가게시 ||= [];
    const row = { 계정: line.account, 상태: '공개 확인 필요', 시각: entry.publishedAt, 만든곳: EXTRA_MARK };
    out.추가게시.push(row);
    fresh.add(row);
    return row;
  };
  // 예약 성공과 공개 확인은 별개다. 링크를 회수해도 기존 상태·예약 시각을 바꾸지 않는다.
  // 같은게시물로 밝힌 줄은 적힌 번호를 「처음게시물ID」로 옮기고 게시물ID를 주소의 번호로 적는다. 처음게시물ID가 이미 다른 번호로 있으면 처음 번호를
  // 잃지 않게 멈춘다(설계 검토 8 조건 6). 밝히지 않았는데 번호가 다르면 예전처럼 멈추고, 같은게시물에 적을 값을 알린다(P2-2).
  const write = (line, row) => {
    const made = fresh.has(row) || untouched(row);
    // 다른 편ID가 적힌 줄은 이 편으로 덮지 않고 멈춘다 — 사람이 적은 값을 잃는다(손연결 7회차, 실제 게시결과 405줄 가운데 다른 편ID 0줄)
    if (row.편ID != null && row.편ID !== '' && row.편ID !== folder) throw new Error(`${folder} 게시결과 ${line.account} 줄의 편ID ${row.편ID}가 이 편과 다르다 — 어느 편의 줄인지 확인한 뒤 다시 연결한다`);
    const next = { ...row, 주소: line.url };
    if (line.samePost && numberOf(row) && numberOf(row) !== line.externalId) {
      if (row.처음게시물ID != null && row.처음게시물ID !== '' && String(row.처음게시물ID) !== numberOf(row)) throw new Error(`${line.account} 줄에 처음게시물ID ${row.처음게시물ID}가 이미 있다 — 처음 번호를 지키려고 멈춘다`);
      next.처음게시물ID = row.게시물ID;
      delete next.게시물ID;
    }
    let fixed;
    try { fixed = identity(folder, next); } catch (e) {
      if (!line.samePost && /주소와 게시물ID가 다르다/.test(e.message)) throw new Error(`${folder} ${line.account} 줄의 게시물ID ${row.게시물ID}가 이 주소의 번호와 다르다 — 같은 게시물이면 연결 요청의 「같은게시물」에 그 게시물ID를 글자 그대로 적는다`);
      throw e;
    }
    Object.assign(row, fixed, { 성과구분: line.group, 연결근거: line.evidence });
    // 도구가 만든 그대로인 줄만 새 지문을 받는다. 손댄 줄은 지문을 지워 다음 실행에도 옮기거나 지우지 않는다
    if (made) row.만든지문 = madeHash(row);
    else delete row.만든지문;
  };

  // 1단계: 줄이 정해지는 연결 — 이 주소가 이미 적힌 줄, 같은게시물 번호 줄, 이 게시물 번호가 적힌 빈 줄
  // 게시물 순서로 처리해 요청 순서와 상관없이 같은 게시결과를 만든다(추가게시 줄 순서까지 — 3회차 GA2). prepare가 같은 게시물 둘을 받지 않는다
  const fallback = [], ordered = [...plans].sort((x, y) => (x.line.post < y.line.post ? -1 : x.line.post > y.line.post ? 1 : 0));
  for (const plan of ordered) {
    const { line, entry } = plan;
    if (line.folder !== folder) continue;
    const mine = r => postIdOf(r.주소)?.key === line.post;
    const own = out.판.filter(r => r.계정 === line.account);
    // 이 주소가 적힌 줄 전부 — 추가게시에 같은 주소가 둘 이상 있을 수 있다(3회차 GA4)
    const mines = resultRows(out).filter(r => r.계정 === line.account && mine(r));
    let rows = mines, target = null;
    // 같은게시물이면 그 번호가 적힌 줄(이미 옮겨 적었으면 그 줄) 정확히 하나다 — 아니면 쓰기 전에 멈춘다(설계 검토 8 조건 2 · 3).
    // 밝히지 않았으면 판에 이 주소가 아직 없을 때 이 게시물의 번호가 적힌 빈 줄 하나다(2회차 GA1).
    if (line.samePost) {
      const named = own.filter(r => (numberOf(r) === line.samePost && (!r.주소 || mine(r)))
        || (mine(r) && numberOf(r) === line.externalId && String(r.처음게시물ID ?? '') === line.samePost));
      if (named.length !== 1) throw new Error(`${folder} 게시결과에 같은게시물 번호 ${line.samePost}가 적힌 ${line.account} 판 줄이 ${named.length}개다 — 주소가 없거나 이 주소인 줄 하나여야 한다. 그 줄의 게시물ID를 확인한 뒤 다시 연결한다`);
      target = named[0];
    } else if (line.group !== '공개확인대기' && !mines.some(r => out.판.includes(r))) {
      const exact = own.filter(r => !r.주소 && numberOf(r) === line.externalId);
      if (exact.length === 1) target = exact[0];
    }
    // 이 주소가 다른 줄에도 있으면 — 모두 이 도구가 만든 추가게시 줄이면 지우고 판 줄로 옮긴다(손연결 GA2 · 2회차 GA3). 하나라도 손으로 고친 줄이거나 판의
    // 다른 줄이면, 같은게시물 연결은 멈추고 밝히지 않은 연결은 옮기지 않는다(설계 검토 8 조건 4 · 3회차 GA1 · GA4).
    // 도구가 만든 줄은 applyResult가 쓰는 꼴 그대로인 줄이다 — 도구의 칸만 있고, 편 · 플랫폼 · 번호 · 게시 시각이 이 연결과 같고, 구분과 근거가 있다(4회차 GA1)
    if (target) {
      const others = mines.filter(r => r !== target);
      const generated = r => extra().includes(r) && untouched(r) && r.상태 === '공개 확인 필요' && Object.keys(r).every(k => AUTO_EXTRA_KEYS.has(k))
        && r.편ID === folder && r.플랫폼 === line.platform && numberOf(r) === line.externalId && r.시각 === entry.publishedAt
        && GROUPS.has(r.성과구분) && Array.isArray(r.연결근거);
      if (others.every(generated)) {
        for (const r of others) out.추가게시.splice(out.추가게시.indexOf(r), 1);
        if (Array.isArray(out.추가게시) && !out.추가게시.length) delete out.추가게시;
        rows = [target];
      } else if (line.samePost) throw new Error(`이 주소가 ${folder} 게시결과의 다른 줄에 이미 적혀 있다 — 그 줄을 정리한 뒤 다시 연결한다(「만든곳」 표시가 없거나 「만든지문」이 맞지 않는 추가게시 줄은 사람이 고친 줄이라 사람이 지운다)`);
    }
    if (!rows.length && line.group !== '공개확인대기') { fallback.push(plan); continue; }
    // 옮기지 않은 연결은 이 주소가 적힌 줄 모두에 같은 연결을 적는다 — 첫 줄만 고치면 다른 줄에 옛 근거가 남는다(4회차 GA2)
    for (const r of rows.length ? rows : [addExtra(line, entry)]) write(line, r);
  }

  // 2단계: 줄이 정해지지 않은 연결은 번호 없는 빈 줄 하나를 고른다. 1단계가 끝난 게시결과로 한꺼번에 정해, 요청 순서와 상관없이 같다(P2-3 · 3회차 GA2).
  // 같은 계정에서 이 단계에 온 연결이 둘 이상이면 어느 것도 고르지 않는다. 그 계정에 번호가 적힌 빈 줄이 하나라도 있으면(상태 · 시각과 상관없이 — 3회차 GA3)
  // 고르지 않는다 — 그 줄을 빼고 남은 예약 줄을 고르면 다른 판의 줄에 이 게시물을 적게 된다(15회차 GA1 · 손연결 GA1). 고르지 못하면 추가게시로 남긴다.
  const waiting = new Map();
  for (const { line } of fallback) waiting.set(line.account, (waiting.get(line.account) || 0) + 1);
  const picks = fallback.map(({ line, entry }) => {
    const empty = out.판.filter(r => r.계정 === line.account && !r.주소);
    if (waiting.get(line.account) !== 1 || empty.some(numberOf)) return null;
    const at = Date.parse(entry.publishedAt), limit = (Number.isFinite(at) ? at : Date.parse(line.at)) + LATER_MS;
    const live = empty.filter(r => LIVE_STATES.has(r.상태) && (r.상태 === '게시됨' || !(Date.parse(r.시각) > limit)));
    return live.length === 1 ? live[0] : null;
  });
  fallback.forEach(({ line, entry }, i) => write(line, picks[i] || addExtra(line, entry)));
  return out;
}

// 쓰기 전에 편마다 바꿀 게시결과를 만든다 — 미리 보기도 이것을 불러 멈출 요청을 --실행 전에 보인다(설계 검토 8 P2-4)
function planResults(repo, plans) {
  const pending = [];
  for (const folder of new Set(plans.map(p => p.line.folder).filter(Boolean))) {
    const file = path.join(repo, 'docs', '마케팅', folder, '게시', '게시결과.json');
    const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    const data = raw === null ? {} : JSON.parse(raw.replace(/^﻿/, ''));
    const next = applyResult(data, folder, plans);
    if (JSON.stringify(data) === JSON.stringify(next)) continue;
    const text = (JSON.stringify(next, null, 2) + '\n').replace(/\n/g, /\r\n/.test(raw || '') ? '\r\n' : '\n');
    pending.push({ file, raw, text });
  }
  return pending;
}

function filterServer(server, connections) {
  const excluded = new Set([...connections.values()].filter(l => l.group !== '콘텐츠').map(l => l.post));
  return { ...server,
    entries: server.entries.filter(e => !excluded.has(postIdOf(e.url)?.key)),
    posts: server.posts.filter(p => !excluded.has(postIdOf(p.url)?.key)) };
}

function writeResults(repo, plans) {
  const files = [], pending = planResults(repo, plans);
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

module.exports = { GROUPS, handleOf, channelMatches, latest, identity, resultRows, prepare, applyResult, planResults, filterServer, writeResults, postOfRow, samePost };
