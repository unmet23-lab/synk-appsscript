import { createServer } from 'node:http';
import { readFile, mkdir, open, rename, copyFile, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mapRoot = resolve(here, '..');
const dataPath = process.env.SYNK_RECORD_DATA_PATH ? resolve(process.env.SYNK_RECORD_DATA_PATH) : join(here, 'data', 'records.json');
const backupDir = join(dirname(dataPath), 'backups');
const mapPath = join(mapRoot, 'dashboard', 'src', 'data.json');
const mapDist = join(mapRoot, 'dashboard', 'dist');
const verificationPath = join(mapRoot, 'verification-data.json');
const port = Number(process.env.SYNK_RECORD_PORT || 4188);
const metricKeys = ['views', 'reach', 'likes', 'comments', 'shares', 'saves'];
let writeQueue = Promise.resolve();

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function dateValid(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value && value <= today();
}
function cleanText(value, limit, required = false) {
  const text = String(value ?? '').trim();
  if (text.length > limit || (required && !text)) throw new Error('필수 항목 또는 글자 수를 확인해 주세요.');
  return text;
}
function cleanUrl(value) {
  const text = cleanText(value, 1000, true);
  let url;
  try { url = new URL(text); } catch { throw new Error('게시물 주소를 확인해 주세요.'); }
  if (url.protocol !== 'https:' || !url.hostname) throw new Error('https 게시물 주소를 입력해 주세요.');
  return url.href;
}
function cleanCount(value) {
  if (value === '' || value === null || value === undefined) return null;
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0 || count > 1000000000000) throw new Error('수치는 0 이상의 정수로 입력해 주세요.');
  return count;
}
function emptyStore() { return { version: 1, posts: [], snapshots: [], channelSnapshots: [] }; }
async function readStore() {
  try {
    const parsed = JSON.parse(await readFile(dataPath, 'utf8'));
    if (parsed.version !== 1 || !Array.isArray(parsed.posts) || !Array.isArray(parsed.snapshots) || !Array.isArray(parsed.channelSnapshots)) throw new Error('기록 파일 형식이 맞지 않습니다.');
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return emptyStore();
    throw error;
  }
}
async function saveStore(store) {
  await mkdir(dirname(dataPath), { recursive: true });
  await mkdir(backupDir, { recursive: true });
  try {
    await stat(dataPath);
    await copyFile(dataPath, join(backupDir, today() + '-' + Date.now() + '-' + randomUUID().slice(0, 8) + '.json'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const temp = dataPath + '.' + randomUUID() + '.tmp';
  const file = await open(temp, 'wx');
  try {
    await file.writeFile(JSON.stringify(store, null, 2) + '\n', 'utf8');
    await file.sync();
  } finally { await file.close(); }
  await rename(temp, dataPath);
}
async function catalog() {
  const [map, verification] = await Promise.all([
    readFile(mapPath, 'utf8').then(JSON.parse),
    readFile(verificationPath, 'utf8').then(JSON.parse)
  ]);
  const channels = map.queries.channels.rows.map(row => ({
    id: row.id, brand: row.brand, country: row.country, platform: row.platform,
    handle: row.handle, publicUrl: row.publicUrl, scope: row.channelScope,
    ready: (row.channelScope === '기존 운영' && row.publishable === true) || row.channelScope === '확장 확보'
  }));
  const stale = [];
  for (const source of verification.files) {
    try {
      // 지도 생성기와 같이 줄끝을 LF로 맞춘 바이트로 잰다(CRLF 작업본에서도 같은 값).
      const actual = createHash('sha256').update((await readFile(resolve(mapRoot, source.file))).toString('latin1').replace(/\r\n/g, '\n'), 'latin1').digest('hex');
      if (actual !== source.sha256) stale.push(source.file);
    } catch { stale.push(source.file); }
  }
  return {
    channels,
    contents: map.queries.contents.rows.map(row => ({ id: row.id, brand: row.brand, title: row.title })),
    generatedAt: verification.generatedAt,
    sourceAsOf: verification.sourceAsOf,
    staleSources: stale
  };
}
function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
async function bodyJson(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Error('JSON 형식으로 입력해 주세요.');
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 65536) throw new Error('입력 크기가 너무 큽니다.');
  }
  try { return JSON.parse(text); } catch { throw new Error('입력 형식을 읽을 수 없습니다.'); }
}
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
function csv(store, channels) {
  const byChannel = new Map(channels.map(row => [row.id, row]));
  const byPost = new Map(store.posts.map(row => [row.id, row]));
  const header = ['종류', '날짜', '채널ID', '브랜드', '국가', '플랫폼', '게시물ID', '제목', '게시주소', '조회', '도달', '좋아요', '댓글', '공유', '저장', '팔로워', '확인시각'];
  const lines = [header];
  for (const row of store.snapshots) {
    const post = byPost.get(row.postId);
    const channel = byChannel.get(post?.channelId);
    lines.push(['게시물', row.date, post?.channelId, channel?.brand, channel?.country, channel?.platform, post?.id, post?.title, post?.url, ...metricKeys.map(key => row[key]), '', row.checkedAt]);
  }
  for (const row of store.channelSnapshots) {
    const channel = byChannel.get(row.channelId);
    lines.push(['채널', row.date, row.channelId, channel?.brand, channel?.country, channel?.platform, '', '', '', '', '', '', '', '', '', row.followers, row.checkedAt]);
  }
  return '\uFEFF' + lines.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
function enqueue(work) {
  const next = writeQueue.then(work);
  writeQueue = next.catch(() => {});
  return next;
}
async function mutate(path, payload) {
  return enqueue(async () => {
    const store = await readStore();
    const currentCatalog = await catalog();
    const readyIds = new Set(currentCatalog.channels.filter(row => row.ready).map(row => row.id));
    const now = new Date().toISOString();
    let result;
    if (path === '/api/posts') {
      const id = cleanText(payload.id, 100);
      const old = id ? store.posts.find(row => row.id === id) : null;
      const channelId = cleanText(payload.channelId, 100, true);
      if (!readyIds.has(channelId)) throw new Error('현재 게시 가능한 채널 목록에서 선택해 주세요.');
      const title = cleanText(payload.title, 160, true);
      const url = cleanUrl(payload.url);
      const publishedDate = cleanText(payload.publishedDate, 10, true);
      if (!dateValid(publishedDate)) throw new Error('게시 날짜를 확인해 주세요.');
      const monitorDays = Number(payload.monitorDays ?? 14);
      if (!Number.isInteger(monitorDays) || monitorDays < 1 || monitorDays > 365) throw new Error('관리 기간은 1~365일로 입력해 주세요.');
      const duplicate = store.posts.find(row => row.channelId === channelId && row.url === url && row.id !== id);
      if (duplicate) throw new Error('같은 채널에 이미 등록된 게시물 주소입니다.');
      const post = {
        id: old?.id || randomUUID(), channelId, title, url, publishedDate,
        contentId: cleanText(payload.contentId, 100), format: cleanText(payload.format, 60),
        monitorDays, note: cleanText(payload.note, 500),
        archived: old?.archived || false, createdAt: old?.createdAt || now, updatedAt: now
      };
      if (old) Object.assign(old, post); else store.posts.push(post);
      result = post;
    } else if (path === '/api/posts/archive') {
      const post = store.posts.find(row => row.id === payload.id);
      if (!post) throw new Error('게시물을 찾지 못했습니다.');
      post.archived = Boolean(payload.archived);
      post.updatedAt = now;
      result = post;
    } else if (path === '/api/snapshots') {
      const post = store.posts.find(row => row.id === payload.postId);
      if (!post) throw new Error('게시물을 찾지 못했습니다.');
      if (!dateValid(payload.date) || payload.date < post.publishedDate) throw new Error('게시일부터 오늘까지의 날짜를 선택해 주세요.');
      const counts = Object.fromEntries(metricKeys.map(key => [key, cleanCount(payload[key])]));
      if (Object.values(counts).every(value => value === null)) throw new Error('수치 한 개 이상을 입력해 주세요. 확인한 0은 0으로 입력합니다.');
      const old = store.snapshots.find(row => row.postId === post.id && row.date === payload.date);
      const row = { postId: post.id, date: payload.date, ...counts, checkedAt: now };
      if (old) Object.assign(old, row); else store.snapshots.push(row);
      result = row;
    } else if (path === '/api/channel-snapshots') {
      const channelId = cleanText(payload.channelId, 100, true);
      if (!readyIds.has(channelId)) throw new Error('현재 게시 가능한 채널 목록에서 선택해 주세요.');
      if (!dateValid(payload.date)) throw new Error('오늘까지의 날짜를 선택해 주세요.');
      const followers = cleanCount(payload.followers);
      if (followers === null) throw new Error('팔로워 또는 구독자 수를 입력해 주세요.');
      const old = store.channelSnapshots.find(row => row.channelId === channelId && row.date === payload.date);
      const row = { channelId, date: payload.date, followers, checkedAt: now };
      if (old) Object.assign(old, row); else store.channelSnapshots.push(row);
      result = row;
    } else throw new Error('지원하지 않는 입력입니다.');
    await saveStore(store);
    return result;
  });
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:' + port);
    if (req.method === 'GET' && url.pathname === '/api/catalog') return send(res, 200, await catalog());
    if (req.method === 'GET' && url.pathname === '/api/records') return send(res, 200, await readStore());
    if (req.method === 'GET' && url.pathname === '/api/export.json') {
      return send(res, 200, await readStore(), 'application/json; charset=utf-8', { 'Content-Disposition': 'attachment; filename="synk-sns-records.json"' });
    }
    if (req.method === 'GET' && url.pathname === '/api/export.csv') {
      const [store, list] = await Promise.all([readStore(), catalog()]);
      return send(res, 200, csv(store, list.channels), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="synk-sns-records.csv"' });
    }
    if (req.method === 'POST' && ['/api/posts', '/api/posts/archive', '/api/snapshots', '/api/channel-snapshots'].includes(url.pathname)) {
      const origin = req.headers.origin;
      if (origin && origin !== 'http://127.0.0.1:' + port) return send(res, 403, { error: '이 로컬 기록 화면에서만 수정할 수 있습니다.' });
      return send(res, 200, { ok: true, record: await mutate(url.pathname, await bodyJson(req)) });
    }
    if (req.method === 'GET' && url.pathname === '/map') {
      res.writeHead(302, { Location: '/map/' });
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/map/') {
      return send(res, 200, await readFile(join(mapDist, 'index.html'), 'utf8'), 'text/html; charset=utf-8');
    }
    const mapAsset = url.pathname.slice('/map/'.length);
    if (req.method === 'GET' && url.pathname.startsWith('/map/') &&
        (mapAsset === 'data-app-build.json' || /^snapshot\.[a-f0-9]{64}\.json$/.test(mapAsset))) {
      return send(res, 200, JSON.parse(await readFile(join(mapDist, mapAsset), 'utf8')));
    }
    const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
    for (const name of ['analytics.mjs', 'analytics-ui.mjs', 'calendar.mjs', 'calendar-ui.mjs']) files['/' + name] = [name, 'text/javascript; charset=utf-8'];
    if (req.method === 'GET' && files[url.pathname]) {
      const [name, type] = files[url.pathname];
      return send(res, 200, await readFile(join(here, name), 'utf8'), type);
    }
    send(res, 404, { error: '찾을 수 없습니다.' });
  } catch (error) {
    const client = /입력|확인|찾지|지원하지|게시|채널|날짜|수치|기간|JSON|형식|크기|주소/.test(error.message);
    send(res, client ? 400 : 500, { error: client ? error.message : '기록을 처리하지 못했습니다. 기존 기록 파일은 보존했습니다.' });
    if (!client) console.error(error);
  }
}).listen(port, '127.0.0.1', () => console.log('SYNK SNS records: http://127.0.0.1:' + port + '/'));

if (port === 4188) {
  const legacy = createServer((req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('GET only');
    }
    res.writeHead(302, {
      Location: 'http://127.0.0.1:4188/map/',
      'Cache-Control': 'no-store'
    });
    res.end();
  });
  legacy.on('error', error => {
    if (error.code !== 'EADDRINUSE') console.error(error);
  });
  legacy.listen(4187, '127.0.0.1');
}
