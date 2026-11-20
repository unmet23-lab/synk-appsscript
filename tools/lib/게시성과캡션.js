'use strict';
/**
 * 게시성과캡션 — 서버가 찾은 게시물을, 서버가 받은 글과 그 편 판의 글로 편 폴더에 잇는다(2026-11-18).
 *
 * 까닭: Business Suite 교차 예약(인스타 + 페북)과 ego 틱톡 예약으로 건 판은 게시결과.json에 공개 주소가 남지 않는다. 그래서 서버가 자동 등록한
 * 게시물을 편 폴더에 잇지 못해 판정 줄이 「편 폴더 못 찾음」이 됐다(11-10 ~ 11-17 LAB 몽골 인스타 · 페북 · 틱톡이 모두 그랬다).
 *
 * 확실한 값만 쓴다. 넷이 모두 맞을 때만 잇는다.
 *  ① 계정: 서버 채널이 sns-계정.json의 계정 하나로만 좁혀진다(lib/게시성과연결.js channelMatches — 핸들, 또는 페북 apiPageId).
 *  ② 걸 때 글 그대로: 그 편 게시결과.json에 그 계정의 「예약됨」 · 「게시됨」 줄의 「게시글지문」(걸 때 tools/게시장부.js postTextSha가 적은 값)이 있고,
 *     지금 판 글을 한 번 읽어 같은 셈(textShaOf)으로 센 지문이 그 값과 같다. 곧 지금 읽는 판 글이 플랫폼에 걸린 글이다.
 *  ③ 글이 같다: 서버 글(인스타 · 페북 · 틱톡은 캡션, 유튜브는 영상 제목)이 그 판의 캡션(유튜브는 제목)과 띄어쓰기 · 줄바꿈만 빼고 통째로 같다.
 *     서버는 등록 제목을 JS 글자 TITLE_MAX(200)자에서 잘라 저장한다. 잘린 등록은 수집 목록(posts)의 같은 게시물 제목(POST_TITLE_MAX(1000)자까지
 *     저장)으로 완결 글을 얻어 견주고, 완결 글을 못 얻으면 잇지 않는다 — 앞부분만 같은 글로는 잇지 않는다(GPT 검수 GA6, 11-18 5회차). MIN자보다 짧은 글로도 잇지 않는다.
 *     인스타 · 페북은 Business Suite 예약이 그 판의 첫 댓글을 캡션 끝에 붙여 올리므로 「캡션 + 첫 댓글」과 통째로 같아도 같은 글이다(11-18 실측 — LAB 몽골 12건).
 *  ④ 양방향으로 하나다(11-18 설계 검토 — .tmp/검수/설계검토_게시성과편연결_20261118.md): 먼저 모든 게시물(이미 이어진 것 · 계정이 여럿으로
 *     맞는 것 포함)과 모든 판 사이에 「글이 맞음」 이음선을 다 긋고, 거르기는 마지막에 한 번만 한다. 그 게시물의 이음선이 그 판 하나이고, 그 판의
 *     이음선도 그 게시물 하나이며, 그 편 · 계정에 이미 이어진 게시물이 없다(장부 연결 · 게시결과 주소 · 서버 등록과 수집 목록 가운데 편 색인이 찾는 것).
 *     그 계정에 판 글을 못 읽은 편이 있으면(「모름」) 그 계정은 이번 회차에 잇지 않는다. 결과는 게시물 · 편 순서에 따라 달라지지 않는다.
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
const { TITLE_MAX, POST_TITLE_MAX } = require('./게시성과읽기.cjs');

const MIN = 12;
const norm = s => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const 글자수 = s => [...String(s ?? '')].length;

/** 판 글 — 그 계정의 첫 판(postTextSha와 같은 고르기)의 글과 읽은 파일. 못 읽으면 던진다 */
function 판글(dir, account) {
  const 묶음 = require('./게시묶음.js');
  if (!fs.existsSync(path.join(dir, '게시', '준비.json'))) return null; // 판이 없는 편(기획만 있음)은 「모름」이 아니라 판 없음이다
  const bundle = 묶음.load(dir);
  const mine = (Array.isArray(bundle.prep?.판) ? bundle.prep.판 : []).filter(p => p && p.계정 === account).slice(0, 1);
  if (!mine.length) return null;
  const plate = 묶음.plates({ ...bundle, prep: { ...bundle.prep, 판: mine } })[0];
  return { platform: plate.platform, texts: plate.texts, sources: plate.texts.source || [] };
}

/** 완결 글이 판 글과 같은가 — 띄어쓰기 · 줄바꿈만 빼고 통째로 같아야 한다. { ok, 길이 } */
function 같은글(serverText, plateText) {
  const s = norm(serverText), p = norm(plateText);
  return { ok: 글자수(s) >= MIN && Boolean(p) && p === s, 길이: 글자수(s) };
}
// 잘린 등록과 판 글 가운데 한쪽이 다른 쪽의 앞부분인가 — 잇는 데는 쓰지 않고, 완결 글을 모르는 잘린 등록을 그 판의 경쟁 게시물로 세는 데만 쓴다
// (판 글이 그 등록의 앞부분일 수도 — 짧은 캡션 + 첫 댓글, 6회차 GA2). 완결 글을 아는 등록은 통째로 같은 판만 센다(7회차 GA2)
const 잘린끝 = s => String(s ?? '').replace(/[\uD800-\uDBFF]$/, '');
function 앞부분관계(serverText, plateText) {
  const s = norm(잘린끝(serverText)), p = norm(plateText);
  return 글자수(s) >= MIN && 글자수(p) >= MIN && (p.startsWith(s) || s.startsWith(p));
}
/** 등록 하나의 완결 글 — 등록 제목이 TITLE_MAX보다 짧으면 그것(출처 「등록」). 잘렸으면 수집 목록의 같은 게시물 제목이 POST_TITLE_MAX보다 짧고
 * 등록 제목으로 시작할 때 그것(출처 「수집」). 못 얻으면 null — 그 등록은 잇지 않는다(5회차 GA3 · GA6). postsByKey = 게시물 key → 수집 목록 줄 */
function 완결글(entry, postsByKey = new Map()) {
  const title = String(entry?.title ?? '');
  if (title.length < TITLE_MAX) return { text: title, 출처: '등록' };
  const id = postIdOf(entry?.url);
  const post = id ? postsByKey.get(id.key) : null;
  const full = typeof post?.title === 'string' ? post.title : '';
  if (!full || full.length >= POST_TITLE_MAX || !norm(full).startsWith(norm(잘린끝(title)))) return null;
  return { text: full, 출처: '수집' };
}

// 지문을 믿는 게시결과 줄 — 실제로 걸렸거나 나간 판만(GPT 검수 GA7). 게시장부는 플랫폼에 걸기 전 「거는 중」 줄에 지문을 적고 「실패」로 끝나도
// 지문을 남기며, 「보류」 · 「지움」 · 「취소됨」도 지문을 그대로 둔다. 그런 줄의 지문으로는 잇지 않는다.
const BOOKED = new Set(['예약됨', '게시됨']);

/**
 * → { requests: [--연결목록 요청 + 방법 '캡션'], skipped: [{ url, account, why }] }
 * server = 서버 읽기(entries · posts · channels), accounts = [{key, platform, handle, apiPageId, expectedChannelId}], index = 편.buildIndex 결과,
 * connections = 연결.latest 결과. 글 = (dir, account) → 판 글(기본 위 판글, 판 없으면 null, 못 읽으면 던짐) — 시험이 바꿔 끼운다.
 * 지문은 그 한 번 읽은 글로 tools/게시장부.js textShaOf(postTextSha와 같은 셈)가 센다.
 */
function 요청들({ repo, server, accounts, index, connections = new Map(), 글 = 판글 }) {
  const { textShaOf } = require('../게시장부.js');
  const requests = [], skipped = [];
  const channelOf = id => (server.channels || []).find(c => c && c.id === id);
  const ownersOf = channel => accounts.filter(a => 연결.channelMatches(a, channel));
  // 편은 이름 순으로 본다 — 결과가 색인 순서에 따라 달라지지 않게(설계 검토 시험 8)
  const folders = [...index.folders.values()].sort((a, b) => (a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0));
  // 판 글은 편 · 계정마다 한 번만 읽는다 — 그 한 번 읽은 글로 대조 · 지문을 함께 본다(GA8). 판 없음은 null, 못 읽으면 { 모름 }(설계 검토 C3)
  const texts = new Map();
  const textOf = (info, account) => {
    const key = `${info.folder}|${account}`;
    if (!texts.has(key)) {
      let plate;
      try { plate = 글(info.dir, account); } catch (e) { plate = { 모름: String(e?.message || e).split('\n')[0] }; }
      texts.set(key, plate || null);
    }
    return texts.get(key);
  };
  // 그 판의 글이 걸 때 그대로인가(②) — 걸렸거나 나간 게시결과 줄의 「게시글지문」이 지금 글(위 한 번 읽은 글)의 지문과 같으면 그 지문, 아니면 null
  const bookedSha = (info, account, plate) => {
    const booked = new Set(연결.resultRows(info.result).filter(r => r && r.계정 === account && BOOKED.has(r.상태) && typeof r.게시글지문 === 'string' && r.게시글지문).map(r => r.게시글지문));
    const now = booked.size ? textShaOf(plate.texts) : null;
    return now && booked.has(now) ? now : null;
  };

  // 이미 게시물이 이어진 편 · 계정(설계 검토 C2) — 장부 연결 · 게시결과 게시물 주소, 그리고 서버 등록(entries)과 수집 목록(posts)의 게시물 가운데
  // 편 색인이 찾는 것. 색인이 여러 편으로 갈린 게시물은 그 편들을 모두 넣는다. 계정은 연결이 아는 계정, 모르면 채널 주인 계정들이다 — 우리 채널이
  // 아닌 주소(기획.md에 적은 남의 쇼츠)는 서버 목록에 없으니 막지 않는다.
  const taken = new Set(), idRows = new Map(), 번호만 = new Map();
  // 게시결과에 주소 없이 적힌 번호는 그 번호가 서버 등록(entries) 주소의 번호와 같을 때만 잇는다(9회차 GA2). 페북은 「페이지번호_게시물번호」의
  // 뒤 번호로 견준다. 수집 목록(posts)의 externalId · pagePostId · videoId로 등록에 짝짓는 길은 쓰지 않는다 — 수집기 자료의 채운 주소 · 남은 옛
  // 번호 · 읽기 상한 때문에 8~14회차 내내 잘못 잇기와 놓치기가 오갔다(유호님 11-20 「니 추천대로」 · 결정 11-20). 그래서 게시결과에 페이지 게시물
  // 번호만 적힌 페북 판(서버 등록은 릴스 주소)은 자동으로 잇지 않고, 판정 요약의 「주소 없이 건 판」으로 남아 사람이 --연결목록으로 잇는다.
  const entryKeys = new Set((server.entries || []).map(x => (x ? postIdOf(x.url)?.key : null)).filter(Boolean));
  const 번호 = (platform, v) => (platform === 'facebook' && v.includes('_') ? v.split('_').pop() : v);
  const 짝 = p => { const who = `${p.platform}:${번호(p.platform, String(p.externalId))}`; return entryKeys.has(who) ? who : null; };
  for (const l of connections.values()) if (l && l.folder && l.account) taken.add(`${l.folder}|${l.account}`);
  for (const info of folders) {
    // 게시물 주소나 게시물ID가 적힌 줄은 이어진 게시물이다 — 그 판에는 캡션이 같은 다른 게시물을 잇지 않는다(설계 검토 다시 보기 2 N2 · 6회차 GA1 ·
    // 8회차 GA1 — 적힌 번호가 서버에 없어도 같다. 다시 올린 게시물을 그 판에 잇지 않는다). 주소 없이 게시물ID만 적힌 판은 그 번호의 서버 게시물을 캡션
    // 없이 게시물ID로 잇는다(5회차 GA1) — 그 번호가 서버 등록 주소의 번호와 같을 때만(위 짝).
    for (const r of 연결.resultRows(info.result)) {
      if (!r || typeof r.계정 !== 'string') continue;
      const p = 연결.postOfRow(r, accounts.find(a => a.key === r.계정)?.platform || null);
      if (!p?.externalId) continue;
      taken.add(`${info.folder}|${r.계정}`);
      if (postIdOf(r.주소) || !p.key) continue;
      const found = 짝(p), key = found || p.key;
      if (!found && !번호만.has(`${info.folder}|${r.계정}`)) 번호만.set(`${info.folder}|${r.계정}`, p.externalId);
      if (!idRows.has(key)) idRows.set(key, []);
      // 한 판에 같은 게시물의 번호가 둘 적혀도 그 판 하나로 센다(9회차 GA1). 적힌 번호는 이유에 남긴다(GA3)
      if (!idRows.get(key).some(o => o.info.folder === info.folder && o.account === r.계정)) idRows.get(key).push({ info, account: r.계정, rowId: p.externalId });
    }
  }
  for (const item of [...(server.entries || []), ...(server.posts || [])]) {
    const id = item ? postIdOf(item.url) : null;
    const found = id ? index.resolve(id.key) : null;
    if (!found) continue;
    const names = found.info ? [found.info.folder] : Array.isArray(found.ambiguous) ? found.ambiguous : [];
    const keys = found.info && found.account ? [found.account] : ownersOf(channelOf(item.channelId)).map(a => a.key);
    for (const folder of names) for (const key of keys) taken.add(`${folder}|${key}`);
  }

  // ① · ③ 이음선 — 모든 게시물(이미 이어진 것 · 계정이 여럿인 것 포함)을 그 계정 후보들의 모든 판과 맞댄다. 거르기 전에 다 긋는다(설계 검토 C1).
  const postsByKey = new Map();
  // 수집기가 첨부 릴스 주소로 채운 페북 줄(urlFromAttachment)은 그 릴스의 줄이 아니라 완결 글의 출처로 쓰지 않는다(설계 검토 6 조건 1)
  for (const p of server.posts || []) { const id = p ? postIdOf(p.url) : null; if (id && !(id.platform === 'facebook' && p.urlFromAttachment === true) && !postsByKey.has(id.key)) postsByKey.set(id.key, p); }
  // 같은 게시물이 서버에 여러 번(다른 채널로) 등록됐으면 그 등록을 모두 모아 한 게시물로 본다(4회차 GA2) — 이음선은 모든 등록에서 긋고, 잇지는 않는다
  const byId = new Map();
  for (const entry of server.entries || []) {
    const id = entry ? postIdOf(entry.url) : null;
    if (!id) continue;
    if (!byId.has(id.key)) byId.set(id.key, { id, entries: [] });
    byId.get(id.key).entries.push(entry);
  }
  const posts = [...byId.values()].map(u => {
    const owners = new Map();
    for (const entry of u.entries) for (const a of ownersOf(channelOf(entry.channelId))) owners.set(a.key, a);
    return { ...u, entry: u.entries[0], linked: Boolean(connections.has(u.id.key) || index.resolve(u.id.key)), owners: [...owners.values()] };
  });
  posts.sort((a, b) => (a.id.key < b.id.key ? -1 : a.id.key > b.id.key ? 1 : 0));
  const byPost = new Map(), byPlate = new Map(), 모름 = new Map();
  for (const u of posts) {
    const edges = new Map();
    for (const entry of u.entries) {
      // 완결 글을 못 얻은 등록(잘렸는데 수집 목록에 없거나 1000자를 넘음)은 앞부분이 맞는 판의 경쟁 게시물로만 세고, 그 게시물은 잇지 않는다
      const full = 완결글(entry, postsByKey);
      if (!full) u.불완전 = true;
      for (const account of ownersOf(channelOf(entry.channelId))) {
        for (const info of folders) {
          const plate = textOf(info, account.key);
          if (!plate) continue;
          if (plate.모름) { if (!모름.has(account.key)) 모름.set(account.key, new Set()); 모름.get(account.key).add(info.folder); continue; }
          // 견줄 판 글 — 유튜브는 제목, 그 밖은 캡션과 「캡션 + 첫 댓글」 둘(첫 댓글을 캡션에 붙여 올린 판)
          const forms = account.platform === 'youtube' ? [plate.texts.title]
            : [plate.texts.caption, plate.texts.caption && plate.texts.firstComment ? `${plate.texts.caption}\n${plate.texts.firstComment}` : null];
          // 통째로 같은 꼴이 있으면 이을 수 있는 이음선, 완결 글을 모르는 잘린 등록이 앞부분으로 겹치면 경쟁으로만 세는 이음선(경쟁)
          let same = null;
          if (full) {
            for (const [i, form] of forms.entries()) {
              const r = form ? 같은글(full.text, form) : null;
              if (r?.ok) { same = { ...r, 출처: full.출처, 첫댓글: i === 1 }; break; }
            }
          }
          if (!same && !full && forms.some(form => form && 앞부분관계(entry.title, form))) same = { ok: true, 경쟁: true };
          if (!same) continue;
          const key = `${info.folder}|${account.key}`;
          if (!edges.has(key) || (edges.get(key).same.경쟁 && !same.경쟁)) edges.set(key, { key, info, account, plate, same });
          if (!byPlate.has(key)) byPlate.set(key, new Set());
          byPlate.get(key).add(u.id.key);
        }
      }
    }
    byPost.set(u.id.key, [...edges.values()]);
  }

  // ④ 받는 조건 — 모두 맞아야 잇는다
  for (const u of posts) {
    if (u.linked) continue;
    const url = u.entry.url;
    // 게시결과에 주소 없이 게시물ID로만 적힌 판의 바로 그 게시물 — 캡션 없이 게시물ID로 잇는다(5회차 GA1). 계정 · 등록 · 판이 모두 하나여야 한다
    const own = idRows.get(u.id.key);
    if (own) {
      const one = own.length === 1 ? own[0] : null;
      if (!one || u.owners.length !== 1 || u.owners[0].key !== one.account || u.entries.length !== 1) {
        skipped.push({ url, account: one?.account || null, why: `게시결과에 게시물ID로 적힌 판(${own.map(o => `${o.info.folder} ${o.account}`).join(', ')})의 게시물인데 판 · 계정 · 등록이 하나로 맞지 않는다` });
        continue;
      }
      requests.push({
        주소: url, 편: one.info.folder, 계정: one.account, 구분: '콘텐츠', 방법: '게시물ID',
        근거: [path.join('docs', '마케팅', one.info.folder, '게시', '게시결과.json').split(path.sep).join('/')].filter(rel => fs.existsSync(path.join(repo, rel))),
        이유: `게시물ID 연결: 게시결과 ${one.info.folder} ${one.account} 줄의 게시물ID ${one.rowId}가 서버 게시물과 같음`,
      });
      continue;
    }
    if (u.owners.length !== 1) { skipped.push({ url, account: null, why: u.owners.length ? '계정이 여럿으로 맞는다' : '계정을 못 찾음' }); continue; }
    if (u.entries.length !== 1) { skipped.push({ url, account: u.owners[0].key, why: `서버에 같은 게시물 등록이 ${u.entries.length}개다 — 사람이 보고 --연결목록으로` }); continue; }
    const account = u.owners[0];
    if (모름.has(account.key)) { skipped.push({ url, account: account.key, why: `판 글을 못 읽은 편이 있어(${[...모름.get(account.key)].slice(0, 3).join(', ')}) 이번 회차에는 이 계정을 잇지 않는다` }); continue; }
    const edges = byPost.get(u.id.key) || [];
    if (edges.length !== 1) { skipped.push({ url, account: account.key, why: edges.length ? `맞는 편이 여럿(${edges.map(e => e.info.folder).join(', ')})` : '글이 맞는 편 없음' }); continue; }
    const e = edges[0], folder = e.info.folder;
    if (byPlate.get(e.key).size !== 1) { skipped.push({ url, account: account.key, why: `같은 편 · 계정(${folder})에 맞는 게시물이 여럿` }); continue; }
    if (taken.has(e.key)) {
      // 게시결과에 번호만 적혀 있고 그 번호가 서버 등록 주소의 번호와 다른 판이면 그렇게 밝힌다(설계 검토 7 P2-2)
      const only = 번호만.get(e.key);
      skipped.push({ url, account: account.key, why: only ? `그 편 · 계정(${folder}) 게시결과에 게시물ID ${only}가 적혀 있어 이미 이어진 판으로 본다 — 그 번호가 서버 등록 주소의 번호와 달라 자동으로 잇지 않는다(같은 게시물이면 사람이 --연결목록 요청의 「같은게시물」에 그 게시물ID를 적어 잇는다)`
        : `그 편 · 계정(${folder})에는 이미 이어진 게시물이 있다(다시 올린 게시물이면 --연결목록으로)` });
      continue;
    }
    if (u.불완전) { skipped.push({ url, account: account.key, why: `서버 등록 글이 ${TITLE_MAX}자에서 잘렸고 수집 목록에서 완결 글을 못 얻었다(없거나 ${POST_TITLE_MAX}자를 넘음) — 앞부분만으로는 잇지 않는다` }); continue; }
    if (e.same.경쟁) { skipped.push({ url, account: account.key, why: `글이 ${folder} 판 글과 앞부분만 겹치고 통째로 같지 않다 — 잇지 않는다` }); continue; }
    const sha = bookedSha(e.info, account.key, e.plate);
    if (!sha) { skipped.push({ url, account: account.key, why: `글은 ${folder}와 맞지만 걸 때 지문이 없거나 지금 글과 다르다(예약됨 · 게시됨 줄 기준)` }); continue; }
    const result = path.join('docs', '마케팅', folder, '게시', '게시결과.json').split(path.sep).join('/');
    const 근거 = [result, ...e.plate.sources].filter((rel, i, all) => all.indexOf(rel) === i && fs.existsSync(path.join(repo, rel)));
    const what = account.platform === 'youtube' ? '영상 제목' : '캡션';
    requests.push({
      주소: url, 편: folder, 계정: account.key, 구분: '콘텐츠', 방법: '캡션', 근거, 완결글: e.same.출처,
      이유: `캡션 자동 연결: 서버 ${e.same.출처 === '수집' ? '수집 목록' : '등록'} 글 ${e.same.길이}자가 판 ${what}${e.same.첫댓글 ? '(+첫 댓글)' : ''}과 통째로 같음 · 게시결과 게시글지문 ${sha.slice(0, 12)}가 지금 판 글 지문과 같음 · 계정 ${account.key}`,
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

module.exports = { MIN, BOOKED, norm, 같은글, 완결글, 판글, 요청들, 준비 };
