#!/usr/bin/env node
'use strict';

// RUTUBE documents this public list in rutube/php-api-client, DefaultTransport::loadVideoPersonById.
// This routine records the public video inventory and the exact hits returned per video on this PC.
// An empty inventory carries no channel view count. Studio reports and server connections have independent sources.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { TextDecoder } = require('node:util');
const catalog = require('../../docs/마케팅/온라인마케팅지도/engagement/company/account-catalog.json');

const ORIGIN = 'https://rutube.ru';
const LIMIT = { bytes: 2 * 1024 * 1024, pages: 50, timeout: 12_000 };
const ROOT = path.join(os.homedir(), '.synk', 'account-metrics', 'public-api', 'rutube');
const STATUS = new Set(['operating', 'confirmed-expansion']);
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

function resolveAccount(accountId, registry = catalog) {
  const entries = registry.accounts.filter(a => a.id === accountId && a.platform === 'rutube' && STATUS.has(a.accountStatus));
  if (entries.length !== 1) throw Error('운영 원장의 RUTUBE 계정을 하나 지정해 주세요.');
  const account = entries[0];
  const id = String(account.externalId || '');
  if (!/^[1-9][0-9]{0,15}$/.test(id) || account.publicUrl !== ORIGIN + '/channel/' + id + '/') {
    throw Error('원장의 RUTUBE 채널 번호와 공개 주소가 일치하지 않습니다.');
  }
  return account;
}

async function verifiedIdentity(html, account) {
  const { parse } = await import('parse5');
  const data = parse(html);
  const head = data.childNodes.find(n => n.tagName === 'html')?.childNodes.find(n => n.tagName === 'head');
  const values = {};
  for (const el of head?.childNodes || []) {
    if (el.tagName !== 'meta') continue;
    const attrs = Object.fromEntries(el.attrs.map(a => [a.name, a.value]));
    const name = attrs.property || attrs.name;
    if (name && ['og:url', 'og:title', 'description'].includes(name)) (values[name] ||= []).push(attrs.content || '');
  }
  const one = name => values[name]?.length === 1 ? values[name][0] : '';
  let canonical;
  try { canonical = new URL(one('og:url'), ORIGIN).href; } catch { canonical = ''; }
  const description = one('description'), title = one('og:title');
  if (canonical !== account.publicUrl || !title.trim() || !description.includes('(' + account.externalId + ')')) {
    throw Error('공개 채널 화면에서 원장의 채널 번호를 확인하지 못했습니다.');
  }
  return { externalId: String(account.externalId), canonical, title };
}

async function read(url, mime, fetchImpl) {
  const res = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(LIMIT.timeout), headers: { accept: mime } });
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  if (!res.ok || type !== mime || Number(res.headers.get('content-length') || 0) > LIMIT.bytes || !res.body) {
    await res.body?.cancel().catch(() => {});
    throw Error('RUTUBE 응답 상태 또는 형식이 다릅니다 (' + res.status + ').');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.byteLength;
    if (size > LIMIT.bytes) throw Error('RUTUBE 응답이 허용 크기를 넘었습니다.');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  return { bytes, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), digest: sha256(bytes) };
}

function views(raw) {
  if (typeof raw === 'number') return Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
  if (typeof raw !== 'string' || !/^(0|[1-9]\d*)$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

function videoRow(video, owner) {
  if (!video || String(video.author?.id) !== owner || typeof video.id !== 'string' || !/^[0-9a-f]{32}$/i.test(video.id)) {
    throw Error('목록에서 다른 게시자 또는 식별할 수 없는 영상을 발견했습니다.');
  }
  const canonical = ORIGIN + '/video/' + video.id + '/';
  if (video.video_url && video.video_url !== canonical) throw Error('영상 번호와 공식 주소가 일치하지 않습니다.');
  return { id: video.id, url: canonical, publishedAt: video.publication_ts || null, metrics: { views: views(video.hits) } };
}

async function collect(account, { fetchImpl = fetch, capture, maxPages = LIMIT.pages } = {}) {
  const owner = String(account.externalId);
  const profile = await read(account.publicUrl, 'text/html', fetchImpl);
  const identity = await verifiedIdentity(profile.text, account);
  if (capture) capture('channel.html', profile.bytes);
  const base = ORIGIN + '/api/video/person/' + owner + '/';
  const sources = [{ role: 'public-channel-identity', url: account.publicUrl, evidenceFile:capture ? 'channel.html' : null, sha256: profile.digest }];
  const rows = new Map();
  let complete = false;
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(base);
    url.searchParams.set('format', 'json');
    url.searchParams.set('page', String(page));
    const result = await read(url.href, 'application/json', fetchImpl);
    const data = JSON.parse(result.text);
    if (!Array.isArray(data.results) || data.page !== page || typeof data.has_next !== 'boolean' ||
        !Number.isSafeInteger(data.per_page) || data.per_page < 1 || data.results.length > data.per_page) {
      throw Error('RUTUBE 목록 번호 또는 행 형식이 바뀌었습니다.');
    }
    for (const item of data.results) {
      const row = videoRow(item, owner);
      if (rows.has(row.id)) throw Error('페이지 사이에서 같은 영상이 겹쳐 다시 읽어야 합니다.');
      rows.set(row.id, row);
    }
    const filename = 'page-' + page + '.json';
    if (capture) capture(filename, result.bytes);
    sources.push({ role:'public-api', url:url.href, evidenceFile:capture ? filename : null, sha256:result.digest });
    if (!data.has_next) {
      if (data.next) throw Error('RUTUBE의 마지막 페이지 표시가 일치하지 않습니다.');
      complete = true;
      break;
    }
    if (!data.results.length || typeof data.next !== 'string') throw Error('RUTUBE의 다음 페이지를 확인하지 못했습니다.');
    const next = new URL(data.next, ORIGIN);
    if (next.origin !== ORIGIN || next.pathname !== new URL(base).pathname || next.username || next.password ||
        next.searchParams.getAll('page').length !== 1 || next.searchParams.get('page') !== String(page + 1)) {
      throw Error('RUTUBE 다음 페이지가 이 계정의 목록과 일치하지 않습니다.');
    }
  }
  const videos = [...rows.values()];
  return { version:1, accountId:account.id, observedAt:new Date().toISOString(), source:'rutube-public-api',
    scope:'public-video-list', identity, inventoryComplete:complete, listedVideos:videos.length,
    videosWithExactViews:videos.filter(v=>v.metrics.views !== null).length, videos, sources };
}

async function collectToDisk(accountId, { directory = ROOT, fetchImpl = fetch } = {}) {
  const account = resolveAccount(accountId);
  fs.mkdirSync(directory, { recursive:true });
  const attempt = fs.mkdtempSync(path.join(directory, 'run-'));
  const save = (name, bytes) => fs.writeFileSync(path.join(attempt, name), bytes, { flag:'wx' });
  try {
    const record = await collect(account, { fetchImpl, capture:save });
    save('observation.json', JSON.stringify(record,null,2)+'\n');
    return { accountId, observedAt:record.observedAt, source:record.source, scope:record.scope,
      inventoryComplete:record.inventoryComplete, listedVideos:record.listedVideos, videosWithExactViews:record.videosWithExactViews,
      observationFile:path.join(attempt,'observation.json') };
  } catch(error) {
    save('failure.json',JSON.stringify({accountId,at:new Date().toISOString(),message:error.message})+'\n');
    throw error;
  }
}

if (require.main === module) {
  const [id, ...rest] = process.argv.slice(2);
  if (!id || rest.length) { console.error('node tools/계정통계예약/rutube-public.cjs <원장 계정 ID>');process.exitCode=2; }
  else collectToDisk(id).then(row=>console.log(JSON.stringify(row))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
module.exports = { resolveAccount, collect, collectToDisk };

