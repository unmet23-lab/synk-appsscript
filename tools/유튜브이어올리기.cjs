#!/usr/bin/env node
'use strict';
// 유튜브 이어 올리기 — 하루 API 한도(프로젝트 10,000단위)에 걸려 partial로 멈춘 YouTube 항목의 빠진 썸네일·자막·재생목록만 채운다(2026-10-19 공용 도구).
// .tmp/hangul-mascot-video-20261006/youtube/yt_resume_partial.cjs·geu-a-ga/work/yt_recover_partial.cjs를 합쳤고,
// 재생목록·채널이 박혀 있던 읽기 보조(yt_get·yt_channel_schedule·yt_check_playlist·yt_helper state)는 --상태로 모았다.
//   node tools/유튜브이어올리기.cjs <계획.json> [--항목 id,id]                   미리보기: 빠진 것·한도가 풀렸는지·승인 대조·쓸 단위(네트워크 없음)
//   node tools/유튜브이어올리기.cjs <계획.json> --항목 <id> --실행 --근거 "…"    채운다. 새로 올리지 않는다.
//   node tools/유튜브이어올리기.cjs <계획.json> --상태 [--항목 id,id]            읽기만: 영상 공개 상태·예약·자막·재생목록(조회 단위가 든다)
//   node tools/유튜브이어올리기.cjs --상태 --계정 <계정키> [--영상 id,id] [--재생목록 id] [--예약]   읽기만: 계획 밖 영상·재생목록·채널 예약
// 지키는 것
//   · 한도가 풀린 뒤에만 채운다: 실패한 때의 태평양 날짜가 지나야 한다(서머타임이면 한국 16:00, 아니면 17:00에 풀림). 한도와 무관한 실패는 --한도무관으로만.
//   · tools/sns-발행.js --승인으로 지금 해시 그대로 승인된 항목만, 결과 파일의 해시가 그 승인과 같을 때만 다룬다.
//   · 영상이 그 채널에 올린 상태(비공개, 예약 항목이면 비공개·공개) 그대로일 때만 다룬다. 이미 붙은 자막은 다시 올리지 않는다.
//   · 공개·예약·비공개 전환은 하지 않는다. 다 채운 뒤 평소처럼 node tools/sns-발행.js --공개 ….
//   · 같은 결과 파일에 동시에 두 번 돌지 않게 잠그고, 단계마다 결과 파일에 적어 두 번째 실패에도 한 일을 잃지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const P = require('./lib/sns-publisher.js');

// YouTube Data API 단위(공식 할당표 기준 어림): 읽기 1, 자막 목록 50, 자막 올리기 400, 썸네일 50, 재생목록 넣기·만들기 50
const UNITS = { read: 1, captionsList: 50, captionInsert: 400, thumbnail: 50, playlistInsert: 50 };
const pacificDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
const kst = (date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(date)) + ' KST';
const isQuotaError = (text) => /quota|exceeded|rateLimitExceeded|dailyLimit/i.test(String(text || ''));

// 실패한 때 다음의 태평양 자정(한도가 풀리는 때).
function nextReset(failedAt) {
  const start = Math.floor(new Date(failedAt).getTime() / 60000) * 60000, day = pacificDay(start);
  let t = start;
  while (pacificDay(t) === day) t += 15 * 60000;
  for (let back = t - 60000; back > start && pacificDay(back) !== day; back -= 60000) t = back;
  return new Date(t);
}

function loadContext(planFile, accountsFile) {
  const plan = P.readJson(planFile);
  const config = P.loadAccounts(accountsFile || path.resolve(P.REPO_ROOT, plan.accountsFile));
  const resultFile = P.resultFileFor(planFile);
  const result = fs.existsSync(resultFile) ? P.readJson(resultFile) : { items: {} };
  return { plan, config, resultFile, result };
}

// 결과 기록과 계획으로 빠진 것만 고른다(네트워크 없음).
function missingParts(item, done) {
  const captions = (item.subtitles || []).map((file) => ({ file, language: P.subtitleLanguage(item, file) }))
    .filter((c) => !(done.captions || []).some((x) => x.language === c.language));
  return { thumbnail: !!item.thumbnail && done.thumbnail !== true, captions, playlist: !!item.playlist?.title && !done.playlist?.itemId };
}
function unitsFor(missing) {
  return 2 * UNITS.read + (missing.thumbnail ? UNITS.thumbnail : 0) + (missing.captions.length ? UNITS.captionsList + missing.captions.length * UNITS.captionInsert : 0)
    + (missing.playlist ? 2 * UNITS.read + UNITS.playlistInsert : 0);
}
function expectedPrivacy(item) {
  return item.publish?.publishAt ? ['private', 'public'] : [item.publish?.visibility || 'private'];
}

// 미리보기·실행 공통 판정: 이어 올릴 수 있는지와 그 까닭(네트워크 없음, 자격은 승인 해시를 다시 셈하려고 이 PC 보관소에서만 읽는다).
function inspect(ctx, itemId, { now = new Date(), readCredentialImpl = P.readCredential, notQuota = false } = {}) {
  const item = ctx.plan.items.find((x) => x.id === itemId);
  if (!item) return { itemId, ready: false, reasons: [`계획에 ${itemId}가 없습니다.`] };
  const done = ctx.result.items?.[itemId];
  const out = { itemId, platform: item.platform, state: done?.state || '없음', video: done?.id || null, reasons: [] };
  if (item.platform !== 'youtube') out.reasons.push('YouTube 항목이 아닙니다.');
  if (!done || done.state !== 'partial') out.reasons.push(`이어 올릴 partial 항목이 아닙니다(지금 ${done?.state || '결과 없음'}).${done?.state === 'publishing' ? ' 원격 ID 기록 전 멈춘 항목이라 스튜디오에서 먼저 확인해야 합니다.' : ''}`);
  else if (!done.id) out.reasons.push('partial인데 영상 ID가 없습니다. 스튜디오에서 먼저 확인해야 합니다.');
  if (out.reasons.length) return { ...out, ready: false };
  out.missing = missingParts(item, done);
  out.units = unitsFor(out.missing);
  const failedAt = done.failedAt || done.updatedAt || done.startedAt;
  out.failedAt = failedAt || null;
  out.error = done.error || null;
  out.quota = isQuotaError(done.error) || !done.error;
  if (!failedAt) out.reasons.push('실패 시각이 기록에 없어 한도가 풀렸는지 셀 수 없습니다.');
  else {
    out.resetAt = nextReset(failedAt).toISOString();
    out.resetKst = kst(out.resetAt);
    const released = pacificDay(now) > pacificDay(failedAt);
    if (out.quota && !released) out.reasons.push(`하루 한도가 아직 안 풀렸습니다 — ${out.resetKst} 뒤에 다시 실행하세요.`);
    if (!out.quota && !notQuota) out.reasons.push(`한도와 무관한 실패로 보입니다(${String(done.error).slice(0, 120)}). 원인을 확인한 뒤 --한도무관으로만 이어 올립니다.`);
  }
  const account = ctx.config.accounts[item.accountKey];
  if (!account) out.reasons.push(`${item.accountKey} 계정 설정이 없습니다.`);
  else {
    try {
      const credential = readCredentialImpl(item.accountKey, { allowLegacy: true });
      const approvedHash = P.verifyApproval(item, account, credential);
      if (done.publicationHash !== approvedHash || done.contentHash !== item.contentHash) out.reasons.push('결과 파일의 해시가 지금 승인과 다릅니다(승인 뒤 바뀐 계획). 스튜디오의 영상이 승인한 내용인지 먼저 확인해야 합니다.');
      out.approved = true;
      out.credential = credential;
    } catch (error) { out.reasons.push('승인 대조 실패: ' + error.message); }
  }
  if (!out.missing.thumbnail && !out.missing.captions.length && !out.missing.playlist) out.nothing = true;
  return { ...out, ready: !out.reasons.length, item, account, done };
}

function printInspection(rows) {
  for (const r of rows) {
    console.log(`\n${r.itemId} · ${r.state}${r.video ? ` · 영상 ${r.video}` : ''}`);
    if (r.missing) {
      const parts = [r.missing.thumbnail && '썸네일', ...r.missing.captions.map((c) => `자막 ${c.language}`), r.missing.playlist && '재생목록'].filter(Boolean);
      console.log(`  빠진 것: ${parts.length ? parts.join(' · ') : '없음(기록만 private으로 바꾸면 됨)'} · 쓸 단위 어림 ${r.units}`);
      if (r.failedAt) console.log(`  멈춘 때 ${kst(r.failedAt)} · 한도 풀림 ${r.resetKst}${r.error ? ` · 오류 ${String(r.error).slice(0, 140)}` : ''}`);
    }
    console.log(r.ready ? '  ✅ 이어 올릴 수 있음(--실행 --근거 "…")' : '  ⏳ ' + r.reasons.join('\n  ⏳ '));
  }
}

const withLock = async (resultFile, fn) => {
  const lock = `${resultFile}.이어올리기.lock`;
  let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch { throw new Error(`다른 이어 올리기가 도는 중입니다(${lock}). 아니라면 그 파일을 지운 뒤 다시 실행하세요.`); }
  try { fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); fs.closeSync(fd); return await fn(); } finally { fs.rmSync(lock, { force: true }); }
};

async function resumeItem(planFile, itemId, note, { accountsFile, fetchImpl = fetch, readCredentialImpl = P.readCredential, now = () => new Date(), notQuota = false, retry401 = { retries: 5, delayMs: 2000 }, playlistRetry, log = console.log } = {}) {
  if (!String(note || '').trim()) throw new Error('이어 올리기에는 --근거가 필요합니다(어떤 partial을 왜 채우는지).');
  const ctx = loadContext(planFile, accountsFile);
  const r = inspect(ctx, itemId, { now: now(), readCredentialImpl, notQuota });
  if (!r.ready) throw new Error(`${itemId}: ` + r.reasons.join(' / '));
  return withLock(ctx.resultFile, async () => {
    // 잠근 뒤 결과 파일을 다시 읽는다(그사이 다른 실행이 바꿨을 수 있다).
    const fresh = loadContext(planFile, accountsFile);
    const done = fresh.result.items[itemId];
    if (!done || done.state !== 'partial' || done.id !== r.video) throw new Error(`${itemId}: 잠그는 사이 결과가 바뀌었습니다(${done?.state}).`);
    const { item, account } = r;
    const fetchYt = P.retryYoutube401(fetchImpl, retry401);
    const { token, channel } = await P.youtubeChannel(r.credential, fetchYt);
    if (!P.matchesYoutubeAccount(channel, account)) throw new Error(`${itemId}: YouTube 인증 채널이 계정 설정과 다릅니다.`);
    const auth = { authorization: `Bearer ${token.accessToken}` };
    const get = async (url, what) => {
      const response = await P.fetchWithRetry(url, { headers: auth }, { fetchImpl: fetchYt });
      const body = await P.responseJson(response);
      if (!response.ok) throw new Error(`YouTube ${what} 조회 실패 ${response.status}: ${P.apiMessage(body)}`);
      return body;
    };
    const video = (await get(`https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id=${encodeURIComponent(done.id)}`, '영상')).items?.[0];
    if (!video) throw new Error(`${itemId}: 영상 ${done.id}을(를) 찾지 못했습니다. 지워졌는지 스튜디오에서 확인하세요.`);
    if (video.snippet?.channelId !== channel.id) throw new Error(`${itemId}: 영상 ${done.id}이(가) 이 채널 영상이 아닙니다.`);
    if (!expectedPrivacy(item).includes(video.status?.privacyStatus)) throw new Error(`${itemId}: 영상이 ${video.status?.privacyStatus} 상태입니다(올린 상태 ${expectedPrivacy(item).join('·')}가 아님). 손대지 않고 멈춥니다.`);
    log(`영상 ${done.id} · ${video.status.privacyStatus}${video.status.publishAt ? ` · 예약 ${kst(video.status.publishAt)}` : ''} · ${video.snippet.title}`);
    const filled = { thumbnail: false, captions: [], playlist: false };
    const checkpoint = (patch) => {
      Object.assign(done, patch, { updatedAt: now().toISOString() });
      fresh.result.items[itemId] = done;
      P.writeJsonAtomic(fresh.resultFile, fresh.result);
    };
    try {
      if (item.thumbnail && done.thumbnail !== true) {
        await P.youtubeSetThumbnail(done.id, path.resolve(P.REPO_ROOT, item.thumbnail), token, fetchYt);
        filled.thumbnail = true; checkpoint({ thumbnail: true }); log('썸네일 올림');
      }
      const missing = missingParts(item, done).captions;
      if (missing.length) {
        const listed = await get(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${encodeURIComponent(done.id)}`, '자막 목록');
        const have = new Map((listed.items || []).map((c) => [c.snippet.language, c.id]));
        for (const c of missing) {
          if (have.has(c.language)) {
            checkpoint({ captions: [...(done.captions || []), { language: c.language, id: have.get(c.language) }] });
            log(`자막 ${c.language} 이미 붙어 있음(기록만 채움)`); continue;
          }
          const made = await P.youtubeUploadCaption(done.id, path.resolve(P.REPO_ROOT, c.file), c.language, token, fetchYt);
          filled.captions.push(c.language); checkpoint({ captions: [...(done.captions || []), made] }); log(`자막 ${c.language} 올림`);
        }
      }
      if (item.playlist?.title && !done.playlist?.itemId) {
        const playlist = await P.youtubeAddToPlaylist(done.id, item.playlist, token, fetchYt, playlistRetry);
        filled.playlist = true; checkpoint({ playlist }); log(`재생목록 ${playlist.title} · ${playlist.created ? '새로 만듦' : '있던 목록'}`);
      }
    } catch (error) {
      checkpoint({ failedAt: now().toISOString(), error: `이어 올리기 중 ${error.message}` });
      throw new Error(`${itemId}: ${error.message} — 채운 것은 결과 파일에 남겼고 partial 그대로입니다(한도면 다음 날 다시).`);
    }
    const at = now().toISOString();
    const { error, failedAt, updatedAt, ...rest } = done;
    const state = item.publish?.publishAt ? 'scheduled' : (item.publish?.visibility || 'private');
    fresh.result.items[itemId] = { ...rest, state, finishedAt: at, recovery: { from: 'partial', failedAt, error, note: String(note).trim(), resumedAt: at, filled } };
    P.writeJsonAtomic(fresh.resultFile, fresh.result);
    return { resultFile: fresh.resultFile, item: fresh.result.items[itemId] };
  });
}

// ── 읽기만(조회 단위가 든다) ─────────────────────────────────────────────
async function readStatus({ planFile, ids = [], accountKey, videos = [], playlistId, schedule = false, accountsFile, fetchImpl = fetch, readCredentialImpl = P.readCredential, log = console.log } = {}) {
  const fetchYt = P.retryYoutube401(fetchImpl);
  const session = async (key) => {
    const { token, channel } = await P.youtubeChannel(readCredentialImpl(key, { allowLegacy: true }), fetchYt);
    const get = async (url) => {
      const response = await P.fetchWithRetry(url, { headers: { authorization: `Bearer ${token.accessToken}` } }, { fetchImpl: fetchYt });
      const body = await P.responseJson(response);
      if (!response.ok) throw new Error(`YouTube 조회 실패 ${response.status}: ${P.apiMessage(body)}`);
      return body;
    };
    return { channel, get };
  };
  const line = (v, extra = '') => `${v.id} · ${v.status.privacyStatus}${v.status.publishAt ? ` · 예약 ${kst(v.status.publishAt)}` : ''} · ${String(v.snippet.title).slice(0, 60)}${extra}`;
  const rows = [];
  if (planFile) {
    const ctx = loadContext(planFile, accountsFile);
    const items = ctx.plan.items.filter((x) => x.platform === 'youtube' && (!ids.length || ids.includes(x.id)) && ctx.result.items?.[x.id]?.id);
    const byAccount = new Map();
    for (const item of items) byAccount.set(item.accountKey, [...(byAccount.get(item.accountKey) || []), item]);
    for (const [key, list] of byAccount) {
      const { channel, get } = await session(key);
      log(`채널 ${channel.snippet?.title || channel.id}`);
      for (const item of list) {
        const done = ctx.result.items[item.id];
        const v = (await get(`https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id=${encodeURIComponent(done.id)}`)).items?.[0];
        if (!v) { log(`  ${item.id} · 영상 ${done.id} 찾지 못함`); rows.push({ itemId: item.id, video: done.id, found: false }); continue; }
        const caps = (await get(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${encodeURIComponent(done.id)}`)).items || [];
        let inPlaylist = null;
        if (done.playlist?.id) inPlaylist = !!(await get(`https://www.googleapis.com/youtube/v3/playlistItems?part=id&playlistId=${encodeURIComponent(done.playlist.id)}&videoId=${encodeURIComponent(done.id)}`)).items?.length;
        log(`  ${item.id} · 기록 ${done.state} · ${line(v, ` · 자막 ${caps.map((c) => c.snippet.language).join(',') || '없음'}${inPlaylist === null ? '' : ` · 재생목록 ${inPlaylist ? '들어 있음' : '없음'}`}`)}`);
        rows.push({ itemId: item.id, recorded: done.state, video: v.id, privacy: v.status.privacyStatus, publishAt: v.status.publishAt || null, captions: caps.map((c) => c.snippet.language), inPlaylist });
      }
    }
    log('읽기 반영은 늦을 수 있습니다 — 공개 전환·예약 해제 직후에는 1분 뒤 다시 읽으세요.');
    return rows;
  }
  if (!accountKey) throw new Error('--상태에는 계획 파일이나 --계정 <계정키>가 필요합니다.');
  const { channel, get } = await session(accountKey);
  log(`채널 ${channel.snippet?.title || channel.id}`);
  if (videos.length) {
    const body = await get(`https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id=${videos.map(encodeURIComponent).join(',')}`);
    for (const id of videos) { const v = (body.items || []).find((x) => x.id === id); log(v ? '  ' + line(v) : `  ${id} · 찾지 못함`); rows.push(v ? { video: id, privacy: v.status.privacyStatus, publishAt: v.status.publishAt || null } : { video: id, found: false }); }
  }
  if (playlistId) {
    const pl = (await get(`https://www.googleapis.com/youtube/v3/playlists?part=snippet,status&id=${encodeURIComponent(playlistId)}`)).items?.[0];
    log(`재생목록 ${pl?.snippet?.title || playlistId} · ${pl?.status?.privacyStatus || '?'}`);
    let page = '';
    do {
      const body = await get(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
      for (const it of body.items || []) { log(`  #${it.snippet.position} 항목 ${it.id} · 영상 ${it.snippet.resourceId.videoId} · ${String(it.snippet.title).slice(0, 50)}`); rows.push({ playlistItem: it.id, video: it.snippet.resourceId.videoId, position: it.snippet.position }); }
      page = body.nextPageToken || '';
    } while (page);
  }
  if (schedule) {
    const ch = (await get('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true')).items?.[0];
    const uploads = ch?.contentDetails?.relatedPlaylists?.uploads, idsAll = [];
    let page = '';
    do {
      const body = await get(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${encodeURIComponent(uploads)}${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
      (body.items || []).forEach((x) => idsAll.push(x.contentDetails.videoId));
      page = body.nextPageToken || '';
    } while (page && idsAll.length < 200);
    const all = [];
    for (let i = 0; i < idsAll.length; i += 50) all.push(...((await get(`https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id=${idsAll.slice(i, i + 50).join(',')}`)).items || []));
    const scheduled = all.filter((v) => v.status.publishAt).sort((a, b) => a.status.publishAt.localeCompare(b.status.publishAt));
    log(`공개 예약 ${scheduled.length}편:`); scheduled.forEach((v) => log('  ' + line(v)));
    rows.push(...scheduled.map((v) => ({ video: v.id, publishAt: v.status.publishAt, privacy: v.status.privacyStatus })));
  }
  return rows;
}

function parseArgs(argv) {
  const o = { files: [] };
  const value = (i, a) => { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${a} 뒤에 값이 필요합니다.`); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['--실행', '--상태', '--예약', '--한도무관', '--json', '--도움', '--help'].includes(a)) o[a] = true;
    else if (['--항목', '--근거', '--계정', '--영상', '--재생목록', '--계정설정'].includes(a)) { o[a] = value(i, a); i++; }
    else if (a.startsWith('--')) throw new Error('모르는 인자: ' + a);
    else o.files.push(a);
  }
  return o;
}
async function main(argv = process.argv.slice(2), deps = {}) {
  const o = parseArgs(argv);
  const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
  if (o['--도움'] || o['--help'] || (!o.files.length && !o['--상태'])) {
    const out = [];
    for (const l of fs.readFileSync(__filename, 'utf8').split('\n')) { if (l.startsWith('//')) out.push(l.replace(/^\/\/ ?/, '')); else if (out.length) break; }
    console.log(out.join('\n'));
    return 0;
  }
  const planFile = o.files[0] ? path.resolve(o.files[0]) : null;
  const accountsFile = o['--계정설정'] ? path.resolve(o['--계정설정']) : undefined;
  if (o['--상태']) {
    await readStatus({ planFile, ids: list(o['--항목']), accountKey: o['--계정'], videos: list(o['--영상']), playlistId: o['--재생목록'], schedule: !!o['--예약'], accountsFile, ...deps });
    return 0;
  }
  if (o['--실행']) {
    const ids = list(o['--항목']);
    if (ids.length !== 1) throw new Error('--실행은 --항목을 하나만 지정합니다(한 편씩 확인하며 채웁니다).');
    const { resultFile, item } = await resumeItem(planFile, ids[0], o['--근거'], { accountsFile, notQuota: !!o['--한도무관'], ...deps });
    console.log(`\n✅ ${ids[0]} 이어 올리기 끝 → ${item.state} · 채운 것 ${JSON.stringify(item.recovery.filled)}\n   결과: ${resultFile}\n   공개·예약은 평소처럼: node tools/sns-발행.js --공개 ${path.relative(process.cwd(), planFile)} --항목 ${ids[0]} [--시각 …] --근거 "…"\n`);
    return 0;
  }
  const ctx = loadContext(planFile, accountsFile);
  const ids = list(o['--항목']).length ? list(o['--항목']) : ctx.plan.items.filter((x) => x.platform === 'youtube' && ctx.result.items?.[x.id]?.state === 'partial').map((x) => x.id);
  if (!ids.length) { console.log('이 계획에 partial로 멈춘 YouTube 항목이 없습니다.'); return 0; }
  const rows = ids.map((id) => { const { credential, item, account, done, ...rest } = inspect(ctx, id, { now: deps.now ? deps.now() : new Date(), readCredentialImpl: deps.readCredentialImpl, notQuota: !!o['--한도무관'] }); return rest; });
  if (o['--json']) console.log(JSON.stringify(rows, null, 1)); else printInspection(rows);
  return 0;
}

if (require.main === module) main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(`\n❌ ${error.message}\n`); process.exitCode = 1; });
module.exports = { pacificDay, nextReset, isQuotaError, missingParts, unitsFor, inspect, resumeItem, readStatus, main, UNITS };
