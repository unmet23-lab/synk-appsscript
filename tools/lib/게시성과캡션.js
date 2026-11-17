'use strict';
/**
 * 게시성과캡션 — 서버가 찾은 게시물을, 서버가 받은 글과 그 편 판의 글로 편 폴더에 잇는다(2026-11-18).
 *
 * 까닭: Business Suite 교차 예약(인스타 + 페북)과 ego 틱톡 예약으로 건 판은 게시결과.json에 공개 주소가 남지 않는다. 그래서 서버가 자동 등록한
 * 게시물을 편 폴더에 잇지 못해 판정 줄이 「편 폴더 못 찾음」이 됐다(11-10 ~ 11-17 LAB 몽골 인스타 · 페북 · 틱톡이 모두 그랬다).
 *
 * 확실한 값만 쓴다. 넷이 모두 맞을 때만 잇는다.
 *  ① 계정: 서버 채널이 sns-계정.json의 계정 하나로만 좁혀진다(lib/게시성과연결.js channelMatches — 핸들, 또는 페북 apiPageId).
 *  ② 걸 때 글 그대로: 그 편 게시결과.json에 그 계정 줄의 「게시글지문」(걸 때 tools/게시장부.js postTextSha가 적은 값)이 있고,
 *     같은 함수로 지금 판 글을 다시 센 지문이 그 값과 같다. 곧 지금 읽는 판 글이 플랫폼에 걸린 글이다.
 *  ③ 글이 같다: 서버 등록 제목(인스타 · 페북 · 틱톡은 캡션, 유튜브는 영상 제목)이 그 판의 캡션(유튜브는 제목)과 띄어쓰기 · 줄바꿈만 빼고 같다.
 *     서버 읽기는 제목 앞 TITLE_MAX자만 가져오므로, 그만큼 길면 판 글의 앞부분과 같아야 한다. MIN자보다 짧은 글로는 잇지 않는다.
 *  ④ 하나로 좁혀진다: 그 게시물에 맞는 편이 하나이고, 그 편 · 계정에 맞는 게시물도 하나다.
 *
 * 「게시글지문」은 제목 · 본문 · 첫 댓글 · 고정 댓글 넷을 함께 센 값이라 서버 캡션만으로는 다시 셀 수 없다. 그래서 ②로 판 글이 걸 때 그대로인지 보고,
 * ③에서 그 판 글과 서버 글을 맞댄다. 시간이나 제목이 비슷하다는 것만으로는 잇지 않는다(lib/게시성과연결.js 머리말).
 * 서버 제목이 캡션이 아닌 등록은 ③에서 맞지 않아 잇지 않는다 — 작업실 예약으로 올린 synkbrief · yuhobuilds 인스타는 등록 제목이 준비.json 「제목」이다.
 *
 * 쓰지 않는다. --연결목록과 같은 모양의 요청(방법 「캡션」)을 돌려주고, tools/게시성과.js가 연결.prepare로 같은 검사를 거쳐 장부에 「게시연결」 줄로 남긴다.
 * 게시결과.json은 고치지 않는다(게시 세션이 쓰는 파일이다).
 */
const fs = require('node:fs');
const path = require('node:path');
const { postIdOf } = require('./게시성과판정.js');
const 연결 = require('./게시성과연결.js');
const { TITLE_MAX } = require('./게시성과읽기.cjs');

const MIN = 12;
const norm = s => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const 글자수 = s => [...String(s ?? '')].length;

/** 판 글 — 그 계정의 첫 판(postTextSha와 같은 고르기)의 글과 읽은 파일. 못 읽으면 던진다 */
function 판글(dir, account) {
  const 묶음 = require('./게시묶음.js');
  const bundle = 묶음.load(dir);
  const mine = (Array.isArray(bundle.prep?.판) ? bundle.prep.판 : []).filter(p => p && p.계정 === account).slice(0, 1);
  if (!mine.length) return null;
  const plate = 묶음.plates({ ...bundle, prep: { ...bundle.prep, 판: mine } })[0];
  return { platform: plate.platform, texts: plate.texts, sources: plate.texts.source || [] };
}

/** 서버 글이 판 글과 같은가 — { ok, 잘림, 길이 } */
function 같은글(serverTitle, plateText) {
  const s = norm(serverTitle), p = norm(plateText);
  const 잘림 = 글자수(serverTitle) >= TITLE_MAX;
  if (글자수(s) < MIN || !p) return { ok: false, 잘림, 길이: 글자수(s) };
  return { ok: 잘림 ? p.startsWith(s) : p === s, 잘림, 길이: 글자수(s) };
}

/**
 * → { requests: [--연결목록 요청 + 방법 '캡션'], skipped: [{ url, account, why }] }
 * server = 서버 읽기(entries · channels), accounts = [{key, platform, handle, apiPageId}], index = 편.buildIndex 결과, connections = 연결.latest 결과.
 * 지문 = (dir, account) → 게시글지문(기본 tools/게시장부.js postTextSha), 글 = (dir, account) → 판 글(기본 위 판글) — 시험이 바꿔 끼운다.
 */
function 요청들({ repo, server, accounts, index, connections = new Map(), 지문 = null, 글 = 판글 }) {
  const sha = 지문 || require('../게시장부.js').postTextSha;
  const requests = [], skipped = [];
  const cache = new Map();
  // 그 편 · 계정 판의 글 — 게시결과 「게시글지문」이 지금 지문과 같을 때만(②). 아니면 null
  const plateOf = (info, account) => {
    const key = `${info.folder}|${account}`;
    if (cache.has(key)) return cache.get(key);
    let out = null;
    const booked = new Set(연결.resultRows(info.result).filter(r => r && r.계정 === account && typeof r.게시글지문 === 'string' && r.게시글지문).map(r => r.게시글지문));
    if (booked.size) {
      try {
        const now = sha(info.dir, account);
        const plate = now && booked.has(now) ? 글(info.dir, account) : null;
        if (plate) out = { ...plate, sha: now };
      } catch { out = null; }
    }
    cache.set(key, out);
    return out;
  };
  const found = [];
  for (const entry of server.entries || []) {
    const id = postIdOf(entry.url);
    if (!id || connections.has(id.key) || index.resolve(id.key)) continue;
    const channel = (server.channels || []).find(c => c.id === entry.channelId);
    const owners = accounts.filter(a => 연결.channelMatches(a, channel));
    if (owners.length !== 1) { skipped.push({ url: entry.url, account: null, why: owners.length ? '계정이 여럿으로 맞는다' : '계정을 못 찾음' }); continue; }
    const account = owners[0];
    const hits = [];
    for (const info of index.folders.values()) {
      const plate = plateOf(info, account.key);
      if (!plate) continue;
      const field = account.platform === 'youtube' ? plate.texts.title : plate.texts.caption;
      const same = 같은글(entry.title, field);
      if (same.ok) hits.push({ info, plate, same });
    }
    const folders = [...new Set(hits.map(h => h.info.folder))];
    if (folders.length !== 1) {
      skipped.push({ url: entry.url, account: account.key, why: folders.length ? `맞는 편이 여럿(${folders.join(', ')})` : '글이 맞는 편 없음(게시글지문이 있는 판 가운데)' });
      continue;
    }
    found.push({ entry, account, hit: hits[0] });
  }
  // ④ 같은 편 · 계정에 맞는 게시물이 둘 이상이면 어느 것도 잇지 않는다
  const per = new Map();
  for (const f of found) {
    const key = `${f.hit.info.folder}|${f.account.key}`;
    per.set(key, (per.get(key) || 0) + 1);
  }
  for (const { entry, account, hit } of found) {
    const folder = hit.info.folder;
    if (per.get(`${folder}|${account.key}`) > 1) { skipped.push({ url: entry.url, account: account.key, why: `같은 편 · 계정(${folder})에 맞는 게시물이 여럿` }); continue; }
    const result = path.join('docs', '마케팅', folder, '게시', '게시결과.json').split(path.sep).join('/');
    const 근거 = [result, ...hit.plate.sources].filter((rel, i, all) => all.indexOf(rel) === i && fs.existsSync(path.join(repo, rel)));
    const what = account.platform === 'youtube' ? '영상 제목' : '캡션';
    requests.push({
      주소: entry.url, 편: folder, 계정: account.key, 구분: '콘텐츠', 방법: '캡션', 근거,
      이유: `캡션 자동 연결: 서버 등록 글 ${hit.same.길이}자${hit.same.잘림 ? '(앞부분)' : ''}가 판 ${what}과 같음 · 게시결과 게시글지문 ${hit.plate.sha.slice(0, 12)}가 지금 판 글 지문과 같음 · 계정 ${account.key}`,
    });
  }
  return { requests, skipped };
}

/** 요청을 하나씩 연결.prepare에 넣는다 — 하나가 막혀도 나머지는 잇고, 막힌 것은 까닭과 함께 돌려준다(정기 실행을 멈추지 않는다) */
function 준비(repo, requests, server, accounts, ledger, now) {
  const plans = [], failed = [];
  for (const request of requests) {
    try { plans.push(...연결.prepare(repo, [request], server, accounts, ledger, now)); } catch (e) { failed.push({ url: request.주소, account: request.계정, why: e.message }); }
  }
  return { plans, failed };
}

module.exports = { MIN, norm, 같은글, 판글, 요청들, 준비 };
