'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { 읽기: 공개쪽읽기, 주소정리 } = require('./공개쪽읽기.js');

const schema = 'synk-grok-contests-v1';
const 폴더이름 = '그록공모전';
const 보고서이름 = /^report-[0-9a-f]{64}\.json$/;
const 모음사이트 = /(^|\.)(contestkorea\.com|wevity\.com|linkareer\.com|thinkcontest\.com|thinkyou\.co\.kr|all-con\.co\.kr|detizen\.com|cobrand\.co\.kr|jungle\.co\.kr|todaktodak\.app|iddqd\.kr)$/i;
const AI판정 = new Set(['allowed', 'conditional', 'prohibited', 'unconfirmed']);

function 글(value, limit = 220) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : '';
}

function 주소(value) {
  try {
    const parsed = 주소정리(글(value, 2000));
    if (!['https:', 'http:'].includes(parsed.protocol)) return '';
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|ref_src|mc_eid)$/i.test(key)) parsed.searchParams.delete(key);
    }
    parsed.searchParams.sort();
    return parsed.href;
  } catch {
    return '';
  }
}

function 사이트(url) {
  return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
}

function 비교글(value) {
  return 글(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function 날짜(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const time = new Date(value);
  return Number.isFinite(+time) && time.toISOString().slice(0, 10) === value ? value : '';
}

function 한국마감(value, date) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d\+09:00$/.test(value)
    && value.slice(0, 10) === date ? value : '';
}

function 보고서(input) {
  if (!input || input.schema !== schema || !글(input.reportId, 100) || !Array.isArray(input.reports) ||
      !input.reports.length || !input.reports.every((item) => typeof item === 'string' && item.trim()) ||
      !Array.isArray(input.items) || input.items.length > 100) {
    throw new Error('그록 공모 보고서의 출처나 형식을 확인할 수 없습니다.');
  }
  for (const item of input.items) {
    if (!글(item?.title) || (!주소(item.officialUrl) && !주소(item.discoveryUrl))) {
      throw new Error('그록 공모 보고서에 제목이나 출처가 빠졌습니다.');
    }
  }
  return input;
}

function 본문(value) {
  return String(value || '')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (all, number) => {
      const code = /^x/i.test(number) ? parseInt(number.slice(1), 16) : Number(number);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
    })
    .replace(/&(nbsp|amp|quot|apos|lt|gt);/gi, (_, name) => ({
      nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
    })[name.toLowerCase()]).normalize('NFKC').replace(/\s+/g, ' ').trim();
}

async function 공고확인(raw, getPage) {
  const official = 주소(raw.officialUrl);
  const discovery = 주소(raw.discoveryUrl) || official;
  const officialHome = official && !모음사이트.test(사이트(official)) ? official : '';
  const head = officialHome ? await getPage(officialHome) : null;
  const final = head?.됨 ? 주소(head.끝주소 || officialHome) : '';
  const officialHost = final && !모음사이트.test(사이트(final)) ? 사이트(final) : '';

  async function 근거(field) {
    const url = 주소(field?.url);
    const quote = 글(field?.quote, 240);
    if (!officialHost || !url || quote.length < 5) return null;
    const listed = head.글.includes(url) || head.글.includes(url.replace(/&/g, '&amp;'));
    if (사이트(url) !== officialHost && url !== officialHome && !listed) return null;
    const page = url === officialHome ? head : await getPage(url);
    const end = page?.됨 && 주소(page.끝주소 || url);
    if (!end || 모음사이트.test(사이트(end)) || !본문(page.글).includes(본문(quote))) return null;
    return { url: end, quote };
  }

  const [ai, deadline, deliverables] = await Promise.all([
    근거(raw.ai), 근거(raw.deadline), 근거(raw.deliverables),
  ]);
  const status = ai && /\bAI\b|인공지능|人工知能|人工智能|artificial intelligence/i.test(ai.quote) && AI판정.has(raw.ai?.status) ? raw.ai.status : 'unconfirmed';
  const date = deadline ? 날짜(raw.deadline?.date) : '';
  const list = deliverables && Array.isArray(raw.deliverables?.items)
    ? [...new Set(raw.deliverables.items.map((item) => 글(item, 180)).filter(Boolean))].slice(0, 8) : [];
  return {
    title: 글(raw.title),
    organizer: 글(raw.organizer),
    edition: 글(raw.edition, 80),
    noticeId: 글(raw.noticeId, 80),
    video: raw.video === true ? true : raw.video === false ? false : null,
    discoveryUrl: discovery,
    officialUrl: officialHost ? final : '',
    ai: { status, ...(status !== 'unconfirmed' && ai) },
    deadline: { date, kst: 한국마감(raw.deadline?.kst, date), ...(date && deadline) },
    deliverables: { items: list, ...(list.length && deliverables) },
  };
}

function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function 가져오기(folder, input, fetchPage = 공개쪽읽기) {
  const source = 보고서(input);
  const key = sha(JSON.stringify(source));
  const dir = path.join(folder, 폴더이름);
  const file = path.join(dir, 'report-' + key + '.json');
  if (fs.existsSync(file)) return { already: true, items: JSON.parse(fs.readFileSync(file, 'utf8')).items };
  const pages = new Map();
  const page = (url) => {
    if (!pages.has(url)) pages.set(url, fetchPage(url, { 전체시한: 12000, 시한: 8000, 최대바이트: 1300000 }));
    return pages.get(url);
  };
  const items = [];
  for (let i = 0; i < source.items.length; i += 4) {
    items.push(...await Promise.all(source.items.slice(i, i + 4).map((item) => 공고확인(item, page))));
  }
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, randomUUID() + '.tmp');
  try {
    fs.writeFileSync(tmp, JSON.stringify({
      schema, reportId: source.reportId, reports: source.reports, importedAt: new Date().toISOString(), items,
    }, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return { already: false, items };
}

function 동일공고(a, b) {
  const 주최 = (value) => 비교글(글(value).replace(/^\((?:주|사|재)\)\s*/, '').replace(/\s+[（(].*$/, ''));
  const hostA = 주최(a.organizer), hostB = 주최(b.organizer);
  const editionA = 비교글(a.edition), editionB = 비교글(b.edition);
  if ((hostA && hostB && hostA !== hostB) || (editionA && editionB && editionA !== editionB)) return false;
  const idA = 비교글(a.noticeId), idB = 비교글(b.noticeId);
  if (idA && idB) return idA === idB && !!(hostA || hostB);
  const urls = (item) => [item.officialUrl, item.discoveryUrl, ...(item.urls || [])].map(주소)
    .filter((url) => url && (new URL(url).pathname !== '/' || new URL(url).search));
  const left = urls(a);
  if (urls(b).some((url) => left.includes(url))) return true;
  const title = 비교글(a.title);
  return title.length >= 6 && title === 비교글(b.title);
}

function 기존공고(item) {
  const record = item.historical_assessment?.record || {};
  const oldGrok = item.grok_20261117 || {};
  return {
    title: item.title,
    organizer: item.organizer || record.organizer || oldGrok.organizer,
    edition: item.edition || record.edition,
    noticeId: item.noticeId || item.notice_id || record.notice_id,
    urls: [
      ...Object.values(item).flatMap((entry) => entry && typeof entry === 'object' && entry.url ? [entry.url] : []),
      ...(Array.isArray(record.links) ? record.links.map((link) => link?.url) : []),
    ],
  };
}

function 갱신(old, entry) {
  if (!old) return entry;
  return {
    ...entry,
    officialUrl: entry.officialUrl || old.officialUrl,
    organizer: entry.organizer || old.organizer,
    edition: entry.edition || old.edition,
    noticeId: entry.noticeId || old.noticeId,
    video: entry.video ?? old.video,
    ai: entry.ai.status !== 'unconfirmed' ? entry.ai : old.ai,
    deadline: entry.deadline.date ? entry.deadline : old.deadline,
    deliverables: entry.deliverables.items.length ? entry.deliverables : old.deliverables,
  };
}

function 보고서읽기(folder) {
  const dir = path.join(folder, 폴더이름);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => 보고서이름.test(name)).map((name) => {
    const record = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    return 보고서(record);
  }).sort((a, b) => a.importedAt.localeCompare(b.importedAt) || a.reportId.localeCompare(b.reportId, 'en'));
}

function 합치기(통합, reports) {
  const items = (통합.items || []).map((item) => ({ ...item }));
  const keys = items.map(기존공고);
  for (const report of reports) {
    for (const row of report.items) {
      const index = items.findIndex((item, i) => 동일공고(row, item.grok_contest || keys[i]) || 동일공고(row, keys[i]));
      if (index >= 0) {
        items[index].grok_contest = 갱신(items[index].grok_contest, row);
      } else {
        const id = 'grok-contest:' + sha([row.organizer, row.title, row.edition, row.noticeId, row.officialUrl].join('\n')).slice(0, 20);
        keys.push(row);
        items.push({ id, title: row.title, grok_contest: row });
      }
    }
  }
  return { ...통합, items };
}

module.exports = { 가져오기, 보고서읽기, 합치기, 동일공고 };
