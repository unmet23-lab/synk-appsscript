'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { normalizeDm, instagramUrl } = require('./sns-dm.js');

const REPO_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_ACCOUNTS = path.join(REPO_ROOT, 'docs', '마케팅', 'sns-계정.json');
const CREDENTIAL_SCRIPT = path.join(REPO_ROOT, 'tools', 'sns-자격.ps1');
const LEGACY_TALK_ENV = path.join(os.homedir(), 'Documents', 'SYNK-talk', '.env');
const CREDENTIAL_PREFIX = 'SYNK/SNS/';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const PLATFORM_NAMES = {
  'youtube': 'YouTube',
  'instagram': 'Instagram',
  'tiktok': 'TikTok',
  'facebook': 'Facebook',
  'threads': 'Threads',
  'x': 'X',
  'linkedin': 'LinkedIn',
  'telegram': 'Telegram',
  'substack': 'Substack',
  'naver-blog': '네이버 블로그',
  'kakao-channel': '카카오톡 채널',
  'tistory': '티스토리',
  'pinterest': 'Pinterest',
};

const PLATFORM_MAP = new Map([
  ['youtube', 'youtube'],
  ['instagram', 'instagram'],
  ['tiktok', 'tiktok'],
  ['facebook', 'facebook'],
  ['threads', 'threads'],
  ['x', 'x'],
  ['twitter', 'x'],
  ['linkedin', 'linkedin'],
  ['telegram', 'telegram'],
  ['substack', 'substack'],
  ['naver blog', 'naver-blog'],
  ['kakao channel', 'kakao-channel'],
  ['tistory', 'tistory'],
  ['pinterest', 'pinterest'],
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    let read;
    while ((read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function relativeFromRepo(file) {
  const resolved = path.resolve(file);
  const relative = path.relative(REPO_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`저장소 밖 파일은 발행 계획에 담지 않습니다: ${resolved}`);
  }
  return relative.replaceAll('\\', '/');
}

function resolveRepoPath(relative) {
  const resolved = path.resolve(REPO_ROOT, relative);
  const back = path.relative(REPO_ROOT, resolved);
  if (back.startsWith('..') || path.isAbsolute(back)) {
    throw new Error(`잘못된 상대 경로입니다: ${relative}`);
  }
  return resolved;
}

function mimeFor(file) {
  switch (path.extname(file).toLowerCase()) {
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.mp4': return 'video/mp4';
    case '.mov': return 'video/quicktime';
    case '.pdf': return 'application/pdf';
    case '.srt': return 'application/x-subrip';
    case '.vtt': return 'text/vtt';
    default: return 'application/octet-stream';
  }
}

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const result = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value) result[match[1]] = value;
  }
  return result;
}

function credentialTarget(accountKey) {
  if (!/^[a-z0-9._-]+$/.test(accountKey)) throw new Error(`잘못된 계정 키입니다: ${accountKey}`);
  return `${CREDENTIAL_PREFIX}${accountKey}`;
}

function credentialCommand(mode, accountKey, input) {
  if (process.platform !== 'win32') throw new Error('SNS 자격 보관소는 현재 Windows에서만 연결됩니다.');
  const result = spawnSync('powershell.exe', [
    // 새 PC(10-17)는 PowerShell 실행 정책이 기본값이라 -File로 부른 sns-자격.ps1이 「스크립트를 실행할 수 없으므로」로 막혔다.
    // 시스템 설정은 그대로 두고 이 호출 한 번에만 Bypass를 준다(우리 저장소 안의 스크립트).
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', CREDENTIAL_SCRIPT, mode, credentialTarget(accountKey),
  ], {
    input,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  if (mode === 'get' && result.status === 3) return null;
  if (result.status !== 0) {
    throw new Error(`Windows 자격 보관소 ${mode} 실패: ${String(result.stderr || '').trim() || `exit ${result.status}`}`);
  }
  return String(result.stdout || '');
}

function hasCredential(accountKey) {
  return credentialCommand('has', accountKey).trim() === '1';
}

function readCredential(accountKey, { allowLegacy = true } = {}) {
  const raw = credentialCommand('get', accountKey);
  if (raw !== null) {
    try { return JSON.parse(raw); }
    catch { throw new Error(`${accountKey} Windows 자격이 JSON이 아닙니다.`); }
  }

  if (allowLegacy && accountKey === 'lab-youtube') {
    const env = parseEnvFile(LEGACY_TALK_ENV);
    const clientId = env.RADIO_YT_CLIENT_ID || env.YOUTUBE_OAUTH_CLIENT_ID;
    const clientSecret = env.RADIO_YT_CLIENT_SECRET || env.YOUTUBE_OAUTH_CLIENT_SECRET;
    const refreshToken = env.RADIO_YT_REFRESH_TOKEN;
    if (clientId && clientSecret && refreshToken) {
      return { clientId, clientSecret, refreshToken, source: 'legacy-talk-env' };
    }
  }
  return null;
}

function writeCredential(accountKey, value) {
  const raw = JSON.stringify(value);
  credentialCommand('set', accountKey, raw);
}

function deleteCredential(accountKey) {
  credentialCommand('delete', accountKey);
}

function migrateLegacyYoutubeLab() {
  const credential = readCredential('lab-youtube', { allowLegacy: true });
  if (!credential) throw new Error('LAB YouTube에서 옮길 기존 자격을 찾지 못했습니다.');
  writeCredential('lab-youtube', {
    clientId: credential.clientId,
    clientSecret: credential.clientSecret,
    refreshToken: credential.refreshToken,
    migratedAt: new Date().toISOString(),
  });
  return { accountKey: 'lab-youtube', stored: true };
}

function loadAccounts(file = DEFAULT_ACCOUNTS) {
  const config = readJson(file);
  if (!config.accounts || typeof config.accounts !== 'object') throw new Error('SNS 계정 설정에 accounts가 없습니다.');
  return config;
}

function normalizePlatform(value) {
  const normalized = PLATFORM_MAP.get(String(value || '').trim().toLowerCase());
  if (!normalized) throw new Error(`알 수 없는 플랫폼입니다: ${value}`);
  return normalized;
}

function accountKeyFromPackageId(id) {
  return String(id || '').replace(/^\d{2}-/, '');
}

function dependency(file, role) {
  const stat = fs.statSync(file);
  return {
    role,
    path: relativeFromRepo(file),
    bytes: stat.size,
    sha256: sha256File(file),
    mime: mimeFor(file),
  };
}

function findFiles(folder, pattern) {
  return fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(folder, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), 'ko', { numeric: true }));
}

function uniqueByPath(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = path.resolve(item.path || item).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function packageFromFolder(folder, accountConfig) {
  const sourceFile = path.join(folder, '원고.json');
  if (!fs.existsSync(sourceFile)) return null;
  const raw = readJson(sourceFile);
  const accountKey = accountKeyFromPackageId(raw.id || path.basename(folder));
  const account = accountConfig.accounts[accountKey];
  if (!account) throw new Error(`${accountKey} 계정이 sns-계정.json에 없습니다.`);
  const platform = normalizePlatform(raw.platform);
  if (platform !== account.platform) {
    throw new Error(`${raw.id} 플랫폼이 계정 설정과 다릅니다: ${platform} != ${account.platform}`);
  }

  const titleFile = path.join(folder, '제목.txt');
  const postFile = path.join(folder, '게시문안.txt');
  const bodyFile = path.join(folder, '본문.md');
  const linkFile = path.join(folder, '링크.txt');
  const title = readText(titleFile) || String(raw.title || '').trim();
  const text = readText(bodyFile) || readText(postFile) || String(raw.caption || '').trim();
  const link = readText(linkFile) || '';
  const video = findFiles(folder, /^video\.(?:mp4|mov)$/i)[0] || null;
  const images = findFiles(folder, /^upload-\d+\.(?:jpe?g|png|webp)$/i);
  const thumbnail = findFiles(folder, /^thumbnail\.(?:jpe?g|png|webp)$/i)[0]
    || findFiles(folder, /^cover\.(?:jpe?g|png|webp)$/i)[0] || null;
  const document = findFiles(folder, /\.(?:pdf)$/i)[0] || null;
  const subtitles = findFiles(folder, /^subtitles-[a-z-]+\.srt$/i);
  // YouTube 재생목록(선택): 원고.json의 playlist { title, description, visibility, language }. 같은 제목이 채널에 없으면 만든다
  const playlist = raw.playlist && String(raw.playlist.title || '').trim() ? {
    title: String(raw.playlist.title).trim(),
    description: String(raw.playlist.description || ''),
    visibility: raw.playlist.visibility || 'private',
    ...(raw.playlist.language ? { language: String(raw.playlist.language) } : {}),
  } : null;

  const deps = [dependency(sourceFile, 'metadata')];
  for (const [file, role] of [[titleFile, 'title'], [postFile, 'post-copy'], [bodyFile, 'article'], [linkFile, 'link']]) {
    if (fs.existsSync(file)) deps.push(dependency(file, role));
  }
  if (video) deps.push(dependency(video, 'video'));
  images.forEach((file) => deps.push(dependency(file, 'image')));
  if (thumbnail) deps.push(dependency(thumbnail, 'thumbnail'));
  if (document) deps.push(dependency(document, 'document'));
  subtitles.forEach((file) => deps.push(dependency(file, 'subtitle')));

  const dependencies = uniqueByPath(deps);
  const dm = normalizeDm(raw.dm);
  if (dm && platform !== 'instagram') throw new Error('댓글 DM 설정은 Instagram 게시 묶음에만 넣습니다.');
  const hashMaterial = {
    id: raw.id,
    accountKey,
    platform,
    title,
    text,
    link,
    alt: Array.isArray(raw.alt) ? raw.alt : [],
    dependencies: dependencies.map(({ role, path: file, bytes, sha256: digest }) => ({ role, path: file, bytes, sha256: digest })),
    ...(playlist ? { playlist } : {}),
    ...(dm ? { dm } : {}),
  };

  return {
    id: raw.id,
    accountKey,
    brand: raw.brand || account.brand,
    platform,
    platformName: PLATFORM_NAMES[platform] || raw.platform,
    account: raw.account || account.handle,
    format: raw.format || '',
    language: raw.language || 'ko',
    // YouTube 「동영상 언어」(실제로 말하는 언어, 제작 방식 v2 §4-3). language는 제목·설명 언어다. 원고.json에 있을 때만 싣는다(10-19)
    ...(raw.audioLanguage ? { audioLanguage: String(raw.audioLanguage) } : {}),
    title,
    text,
    alt: Array.isArray(raw.alt) ? raw.alt : [],
    link,
    folder: relativeFromRepo(folder),
    video: video ? relativeFromRepo(video) : null,
    images: images.map(relativeFromRepo),
    thumbnail: thumbnail ? relativeFromRepo(thumbnail) : null,
    document: document ? relativeFromRepo(document) : null,
    subtitles: subtitles.map(relativeFromRepo),
    ...(playlist ? { playlist } : {}),
    ...(dm ? { dm } : {}),
    dependencies,
    contentHash: sha256(JSON.stringify(hashMaterial)),
    publisher: account.publisher,
    connection: account.connection,
    publish: {
      visibility: platform === 'youtube' ? 'private' : 'public',
      publishAt: null,
      notifySubscribers: false,
    },
    approval: null,
  };
}

function scanPackages(root, accountsFile = DEFAULT_ACCOUNTS) {
  const accountConfig = loadAccounts(accountsFile);
  const resolvedRoot = path.resolve(root);
  if (!fs.existsSync(resolvedRoot)) throw new Error(`콘텐츠 묶음을 찾지 못했습니다: ${resolvedRoot}`);
  const folders = fs.readdirSync(resolvedRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2}-/.test(entry.name))
    .map((entry) => path.join(resolvedRoot, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), 'ko', { numeric: true }));
  return folders.map((folder) => packageFromFolder(folder, accountConfig)).filter(Boolean);
}

function validateItem(item) {
  const errors = [];
  try { if (item.dm) { normalizeDm(item.dm); if (item.platform !== 'instagram') errors.push('DM은 Instagram만 지원'); } } catch(error) { errors.push(error.message); }
  if (!item.title) errors.push('제목 없음');
  if (!item.text) errors.push('본문 없음');
  if (item.platform === 'youtube' && !item.video) errors.push('video.mp4 없음');
  if (item.playlist && item.platform !== 'youtube') errors.push('재생목록은 YouTube만 지원');
  if (item.audioLanguage && item.platform !== 'youtube') errors.push('동영상 언어는 YouTube만 지원');
  if (item.audioLanguage && !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(item.audioLanguage)) errors.push(`동영상 언어 코드가 아님: ${item.audioLanguage}`);
  if (['instagram', 'facebook', 'pinterest', 'kakao-channel', 'telegram'].includes(item.platform)
      && !item.video && item.images.length === 0) errors.push('게시할 이미지/영상 없음');
  if (item.platform === 'tiktok' && !item.video) errors.push('video.mp4 없음');
  if (item.platform === 'linkedin' && !item.document && item.images.length === 0) errors.push('PDF/이미지 없음');
  if (['naver-blog', 'substack', 'tistory'].includes(item.platform)) {
    const hasArticle = item.dependencies.some((d) => d.role === 'article');
    if (!hasArticle) errors.push('본문.md 없음');
  }
  return errors;
}

function buildPlan({ root, accountsFile = DEFAULT_ACCOUNTS, outputFile } = {}) {
  if (!root) throw new Error('--묶음 경로가 필요합니다.');
  const config = loadAccounts(accountsFile);
  const items = scanPackages(root, accountsFile).map((item) => ({ ...item, errors: validateItem(item) }));
  const plan = {
    schema: 'synk-sns-publish-plan/v1',
    createdAt: new Date().toISOString(),
    sourceRoot: relativeFromRepo(root),
    accountsFile: relativeFromRepo(accountsFile),
    accountsSha256: sha256File(accountsFile),
    reviewPolicy: config.policy,
    items,
  };
  if (outputFile) {
    writeJsonAtomic(outputFile, plan);
    fs.writeFileSync(outputFile.replace(/\.json$/i, '.md'), renderPlanMarkdown(plan), 'utf8');
  }
  return plan;
}

function renderPlanMarkdown(plan) {
  const direct = plan.items.filter((item) => /^direct/.test(item.publisher)).length;
  const manual = plan.items.filter((item) => item.publisher === 'manual-assisted').length;
  const blocked = plan.items.filter((item) => item.publisher.startsWith('blocked')).length;
  const lines = [
    '# SNS 통합 발행 검수판',
    '',
    `- 만든 때: ${plan.createdAt}`,
    `- 원본: \`${plan.sourceRoot}\``,
    `- 직접 발행 대상 ${direct}개 / 공식 편집기 보조 ${manual}개 / 계정 확정 대기 ${blocked}개`,
    `- 현재 형식 승인 기록 ${plan.items.filter((item) => item.approval?.version === 2).length}/${plan.items.length}개. 발행 직전에 본문·계정·미디어·발행 설정을 다시 검증합니다.`,
    '',
    '| ID | 계정 | 형식 | 통로 | 연결 | 파일 검사 |',
    '|---|---|---|---|---|---|',
  ];
  for (const item of plan.items) {
    lines.push(`| ${item.id} | ${item.platformName} ${item.account} | ${item.format} | ${item.publisher} | ${item.connection} | ${item.errors.length ? item.errors.join(', ') : '통과'} |`);
  }
  for (const item of plan.items.filter((entry) => entry.dm)) {
    lines.push('', `## 댓글 DM 자료 연결 — ${item.id}`, '',
      `게시 계정: ${item.account}. 아래 자료·문구·기한·공개 답글·FAQ 전체가 이 게시물의 승인에 포함됩니다.`, '',
      '```json', JSON.stringify(normalizeDm(item.dm), null, 2), '```', '');
  }
  lines.push('', '## 유호님이 실제로 하는 일', '',
    '1. 이 한 판에서 계정·본문·파일·공개범위·예약시각을 한 번 검수합니다.',
    '2. 직접 통로는 --발행으로 처리합니다. 네이버·카카오·티스토리·Substack은 --수동열기로 본문을 복사하고 공식 편집기와 자료 폴더를 엽니다.',
    '3. 본인인증·최초 연결·재인증·광고비 집행만 사람 단계로 남깁니다.', '');
  return `${lines.join('\n')}\n`;
}

function verifyDependencies(item) {
  const changed = [];
  for (const dep of item.dependencies) {
    const file = resolveRepoPath(dep.path);
    if (!fs.existsSync(file)) { changed.push(`${dep.path}: 사라짐`); continue; }
    if (sha256File(file) !== dep.sha256) changed.push(`${dep.path}: 내용 변경`);
  }
  return changed;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// Only public routing/settings belong in the approval. Never include tokens or
// secrets: rotating an access token must not change the reviewed publication.
function publicationHash(item, account, credential = {}) {
  const pick = (source, keys) => Object.fromEntries(keys.map((key) => [key, source?.[key] ?? null]));
  const media = [
    [item.video, 'video'], [item.thumbnail, 'thumbnail'], [item.document, 'document'],
    ...(item.images || []).map((file) => [file, 'image']),
    ...(item.subtitles || []).map((file) => [file, 'subtitle']),
  ].filter(([file]) => file).map(([file, role]) => dependency(resolveRepoPath(file), role));
  const itemPart = pick(item, ['id', 'accountKey', 'account', 'platform', 'publisher', 'language',
    'title', 'text', 'alt', 'link', 'folder', 'video', 'images', 'thumbnail', 'document',
    'subtitles', 'remoteMediaUrls', 'publish', 'dependencies']);
  // 재생목록은 있는 항목에만 넣는다 — 재생목록이 없는 기존 계획의 승인 해시가 바뀌지 않게
  if (item.playlist) itemPart.playlist = item.playlist;
  if (item.audioLanguage) itemPart.audioLanguage = item.audioLanguage; // 동영상 언어도 같은 까닭으로 있는 항목에만
  if (item.dm) itemPart.dm = normalizeDm(item.dm);
  return sha256(stableJson({
    version: 2,
    item: itemPart,
    account: pick(account, ['platform', 'handle', 'publisher', 'expectedChannelId',
      'expectedHandle', 'expectedChannelTitle', 'categoryId', 'madeForKids', 'chatId',
      'graphVersion', 'apiVersion', 'editorUrl']),
    routing: pick(credential, ['channelId', 'pageId', 'igUserId', 'userId', 'authorUrn',
      'boardId', 'graphVersion', 'apiVersion']),
    media,
  }));
}

function verifyPublication(item, account, credential) {
  if (!account || item.platform !== account.platform) throw new Error(`${item.id} 발행 계정/플랫폼이 다릅니다.`);
  const errors = validateItem(item);
  if (errors.length) throw new Error(`${item.id} 파일 검사 실패: ${errors.join(', ')}`);
  const changed = verifyDependencies(item);
  if (changed.length) throw new Error(`${item.id} 원본이 계획 후 바뀌었습니다: ${changed.join(', ')}`);
  return publicationHash(item, account, credential);
}

function verifyApproval(item, account, credential) {
  if (item.approval?.version !== 2 || !item.approval.publicationHash
      || item.approval.contentHash !== item.contentHash) {
    throw new Error(`${item.id}는 현재 발행 설정으로 최종 승인되지 않았습니다. 기존 형식 승인은 다시 검수해야 합니다.`);
  }
  const currentHash = verifyPublication(item, account, credential);
  if (item.approval.publicationHash !== currentHash) {
    throw new Error(`${item.id} 승인 후 본문·계정·미디어·발행 설정이 바뀌었습니다. 다시 검수해야 합니다.`);
  }
  return currentHash;
}

function approvePlan(planFile, ids, note = '', { accountsFile, readCredentialImpl = readCredential } = {}) {
  const plan = readJson(planFile);
  const config = loadAccounts(accountsFile || resolveRepoPath(plan.accountsFile));
  const selected = new Set(ids && ids.length ? ids : plan.items.map((item) => item.id));
  const now = new Date().toISOString();
  for (const item of plan.items) {
    if (!selected.has(item.id)) continue;
    const account = config.accounts[item.accountKey];
    const credential = account?.platform !== 'instagram' && account?.publisher.startsWith('direct')
      ? readCredentialImpl(item.accountKey, { allowLegacy: true }) : null;
    const hash = verifyPublication(item, account, credential);
    item.approval = { version: 2, contentHash: item.contentHash, publicationHash: hash, approvedAt: now, note };
  }
  writeJsonAtomic(planFile, plan);
  fs.writeFileSync(planFile.replace(/\.json$/i, '.md'), renderPlanMarkdown(plan), 'utf8');
  return plan;
}

async function responseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { return { raw: text.slice(0, 500) }; }
}

function apiMessage(body) {
  return String(body?.error?.message || body?.message || body?.error_description || body?.error || body?.raw || '알 수 없는 오류').slice(0, 500);
}

async function fetchWithRetry(url, options = {}, { fetchImpl = fetch, attempts = 3 } = {}) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, options);
      if (!RETRYABLE.has(response.status) || attempt === attempts - 1) return response;
      last = new Error(`HTTP ${response.status}`);
    } catch (error) {
      last = error;
      if (attempt === attempts - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)));
  }
  throw last;
}

async function checkConnection(accountKey, account, { fetchImpl = fetch, readCredentialImpl = readCredential } = {}) {
  if (account.publisher === 'manual-assisted') {
    return { state: 'manual-ready', detail: '공식 편집기 보조' };
  }
  if (account.publisher.startsWith('blocked')) {
    return { state: 'blocked', detail: account.connection };
  }
  const credential = readCredentialImpl(accountKey, { allowLegacy: true });
  if (!credential) return { state: 'needs-auth', detail: account.connection };

  const adapter = adapters[account.platform];
  return adapter ? adapter.check(account, credential, fetchImpl) : { state: 'credential-present', detail: '자격 있음' };
}

async function checkAllConnections(accountsFile = DEFAULT_ACCOUNTS, options = {}) {
  const config = loadAccounts(accountsFile);
  const results = [];
  for (const [accountKey, account] of Object.entries(config.accounts)) {
    try {
      results.push({ accountKey, platform: account.platform, handle: account.handle, ...(await checkConnection(accountKey, account, options)) });
    } catch (error) {
      results.push({ accountKey, platform: account.platform, handle: account.handle, state: 'error', detail: error.message });
    }
  }
  return results;
}

function openChrome(url) {
  if (process.platform === 'win32') {
    const candidates = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
    const chrome = candidates.find((candidate) => fs.existsSync(candidate));
    if (!chrome) throw new Error('Google Chrome 실행 파일을 찾지 못했습니다.');
    spawn(chrome, [url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(command, [url], { detached: true, stdio: 'ignore' }).unref();
}

function loopbackServer({ state, onCode, successText }) {
  let resolveCode;
  let rejectCode;
  const codePromise = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== '/') { response.writeHead(404).end(); return; }
    const error = url.searchParams.get('error');
    const code = url.searchParams.get('code');
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    if (error) {
      response.end(`<h2 style="font-family:system-ui">인증이 취소됐습니다: ${error}</h2>`);
      server.close(); rejectCode(new Error(`인증 취소: ${error}`)); return;
    }
    if (!code || url.searchParams.get('state') !== state) {
      response.end('<h2 style="font-family:system-ui">인증 값이 서로 다릅니다.</h2>');
      server.close(); rejectCode(new Error('OAuth code/state 불일치')); return;
    }
    try {
      const value = await onCode(code);
      response.end(`<h2 style="font-family:system-ui">${successText || '연결을 저장했습니다. 이 창을 닫으셔도 됩니다.'}</h2>`);
      server.close(); resolveCode(value);
    } catch (err) {
      response.end('<h2 style="font-family:system-ui">연결을 저장하지 못했습니다. 작업 화면의 오류를 확인해 주세요.</h2>');
      server.close(); rejectCode(err);
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, result: codePromise }));
  });
}

async function authorizeYoutube(accountKey, accountsFile = DEFAULT_ACCOUNTS, {
  openBrowser = openChrome,
  fetchImpl = fetch,
  timeoutMs = 20 * 60 * 1000,
} = {}) {
  const config = loadAccounts(accountsFile);
  const account = config.accounts[accountKey];
  if (!account || account.platform !== 'youtube') throw new Error(`${accountKey}는 YouTube 계정이 아닙니다.`);
  const source = readCredential('lab-youtube', { allowLegacy: true });
  if (!source?.clientId || !source?.clientSecret) throw new Error('YouTube OAuth 클라이언트를 찾지 못했습니다.');
  const state = crypto.randomBytes(24).toString('hex');
  let redirectUri = '';
  const loopback = await loopbackServer({
    state,
    onCode: async (code) => {
      const response = await fetchWithRetry('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: source.clientId,
          client_secret: source.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      }, { fetchImpl });
      const body = await responseJson(response);
      if (!response.ok || !body.refresh_token) throw new Error(`Google 토큰 교환 실패 ${response.status}: ${apiMessage(body)}`);
      const candidate = { clientId: source.clientId, clientSecret: source.clientSecret, refreshToken: body.refresh_token };
      const { channel } = await youtubeChannel(candidate, fetchImpl);
      if (!matchesYoutubeAccount(channel, account)) {
        throw new Error(`다른 YouTube 채널이 선택됐습니다: ${channel.snippet?.title || channel.id}`);
      }
      writeCredential(accountKey, { ...candidate, connectedAt: new Date().toISOString(), channelId: channel.id });
      return { accountKey, channelId: channel.id, title: channel.snippet?.title, handle: channel.snippet?.customUrl || null };
    },
  });
  redirectUri = `http://127.0.0.1:${loopback.port}`;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: source.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state,
  })}`;
  openBrowser(authUrl);
  let timeout;
  const timedOut = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      loopback.server.close();
      reject(new Error('YouTube 연결이 제한 시간 안에 완료되지 않았습니다. 다시 연결해 주세요.'));
    }, timeoutMs);
  });
  try { return await Promise.race([loopback.result, timedOut]); }
  finally { clearTimeout(timeout); }
}

function credentialFields(platform) {
  return (adapters[platform]?.fields || []).map(field => [...field]);
}

async function openCredentialForm(accountKey, accountsFile = DEFAULT_ACCOUNTS, { openBrowser = openChrome } = {}) {
  const config = loadAccounts(accountsFile);
  const account = config.accounts[accountKey];
  if (!account) throw new Error(`알 수 없는 계정입니다: ${accountKey}`);
  const fields = credentialFields(account.platform);
  if (!fields.length) throw new Error(`${account.platform}은 이 연결 폼 대상이 아닙니다.`);

  let resolveResult;
  let rejectResult;
  const result = new Promise((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });
  const server = http.createServer((request, response) => {
    if (request.method === 'GET') {
      const inputs = fields.map(([name, label, secret]) => `<label style="display:block;margin:16px 0 6px">${label}</label><input name="${name}" type="${secret ? 'password' : 'text'}" required style="width:100%;padding:12px;box-sizing:border-box">`).join('');
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(`<meta charset="utf-8"><title>SYNK SNS 연결</title><body style="font:16px/1.55 system-ui;max-width:640px;margin:40px auto;padding:24px;background:#fbf7f0;color:#2b2320"><h1>${account.handle} 공식 연결</h1><p>값은 Windows 자격 증명 보관소에만 저장되고 터미널이나 저장소에 표시되지 않습니다.</p><form method="post">${inputs}<button style="margin-top:22px;padding:12px 20px">저장하고 닫기</button></form></body>`);
      return;
    }
    if (request.method !== 'POST') { response.writeHead(405).end(); return; }
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
        const value = {};
        fields.forEach(([name]) => { value[name] = form.get(name) || ''; });
        writeCredential(accountKey, { ...value, connectedAt: new Date().toISOString() });
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end('<h2 style="font-family:system-ui">연결 값을 안전하게 저장했습니다. 이 창을 닫으셔도 됩니다.</h2>');
        server.close(); resolveResult({ accountKey, stored: true });
      } catch (error) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('저장에 실패했습니다.');
        server.close(); rejectResult(error);
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  openBrowser(`http://127.0.0.1:${server.address().port}/`);
  const timeout = setTimeout(() => { server.close(); rejectResult(new Error('연결 폼이 20분 동안 완료되지 않았습니다.')); }, 20 * 60 * 1000);
  try { return await result; }
  finally { clearTimeout(timeout); }
}

async function publishItem(item, account, credential, options = {}) {
  const adapter = adapters[account.platform];
  if (!adapter) throw new Error(`${account.platform}은 직접 발행 어댑터가 없습니다.`);
  return adapter.publish(item, account, credential, options);
}

function resultFileFor(planFile) {
  return planFile.replace(/\.json$/i, '.결과.json');
}

// A browser publication is an explicit receipt, never an API-post claim.
function recordInstagramPublication(planFile,itemId,url,note,{accountsFile}={}) {
  if (!String(note||'').trim()) throw new Error('게시 확인 근거가 필요합니다.');
  const plan=readJson(planFile),item=plan.items.find(x=>x.id===itemId);
  const config=loadAccounts(accountsFile||resolveRepoPath(plan.accountsFile));
  if(!item||item.platform!=='instagram'||!item.dm)throw new Error('DM 설정을 승인한 Instagram 항목이 필요합니다.');
  const approvedHash=verifyApproval(item,config.accounts[item.accountKey],null);
  const canonical=instagramUrl(url),resultFile=resultFileFor(planFile);
  const result=fs.existsSync(resultFile)?readJson(resultFile):{schema:'synk-sns-publish-result/v1',plan:relativeFromRepo(planFile),items:{}};
  const previous=result.items[itemId];
  if(previous?.publicationHash&&previous.publicationHash!==approvedHash)throw new Error('이전 게시 결과와 현재 승인이 다릅니다.');
  if(previous?.url&&instagramUrl(previous.url)!==canonical)throw new Error('기록한 게시물 주소를 다른 게시물로 덮어쓸 수 없습니다.');
  if(previous?.state==='browser-published')return {resultFile,item:previous};
  const receipt={state:'browser-published',url:canonical,account:item.account,contentHash:item.contentHash,
    publicationHash:approvedHash,confirmedAt:new Date().toISOString(),note:String(note).trim()};
  result.items[itemId]=receipt;writeJsonAtomic(resultFile,result);return {resultFile,item:receipt};
}

function dmPublicationHandoff(planFile,itemId,{accountsFile}={}) {
  const plan=readJson(planFile),item=plan.items.find(x=>x.id===itemId);
  const config=loadAccounts(accountsFile||resolveRepoPath(plan.accountsFile));
  if(!item||item.platform!=='instagram'||!item.dm)throw new Error('승인된 Instagram DM 항목이 필요합니다.');
  const publicationHash=verifyApproval(item,config.accounts[item.accountKey],null);
  const receipt=readJson(resultFileFor(planFile)).items?.[itemId];
  if(!receipt||receipt.state!=='browser-published'||receipt.publicationHash!==publicationHash||receipt.contentHash!==item.contentHash||receipt.account!==item.account)
    throw new Error('현재 승인과 일치하는 게시 확인 기록이 필요합니다.');
  const dm=normalizeDm(item.dm),post_url=instagramUrl(receipt.url);
  const campaign_id=dm.campaign_id||'pub-'+sha256(stableJson({folder:item.folder,item:item.id,dm,post_url})).slice(0,40);
  return {schema_version:1,publication_hash:publicationHash,account_handle:item.account,post_url,campaign:{...dm,campaign_id},receipt_at:receipt.confirmedAt};
}

async function publishPlan(planFile, ids, { accountsFile, fetchImpl = fetch, readCredentialImpl = readCredential, force = false } = {}) {
  const plan = readJson(planFile);
  const config = loadAccounts(accountsFile || resolveRepoPath(plan.accountsFile));
  const selected = new Set(ids && ids.length ? ids : plan.items.map((item) => item.id));
  const resultFile = resultFileFor(planFile);
  const result = fs.existsSync(resultFile) ? readJson(resultFile) : { schema: 'synk-sns-publish-result/v1', plan: relativeFromRepo(planFile), items: {} };

  for (const item of plan.items) {
    if (!selected.has(item.id)) continue;
    const account = config.accounts[item.accountKey];
    if (!account) throw new Error(`${item.accountKey} 계정 설정이 없습니다.`);
    const previous = result.items[item.id];
    // A changed plan/hash or force must not create another video after a partial
    // success. An interrupted attempt without an ID is also not safe to repeat.
    if (previous && ['partial', 'publishing'].includes(previous.state)) {
      throw new Error(`${item.id}는 ${previous.state} 상태입니다${previous.id ? ` (기존 영상 ${previous.id})` : ''}. 원격 결과를 확인하기 전 재발행하지 않습니다.${previous.state === 'partial' && previous.id ? ' 빠진 자막·재생목록은 node tools/유튜브이어올리기.cjs로 채웁니다.' : ''}`);
    }
    const credential = account.publisher.startsWith('direct')
      ? readCredentialImpl(item.accountKey, { allowLegacy: true }) : null;
    const approvedHash = verifyApproval(item, account, credential);
    if (account.publisher === 'manual-assisted') {
      result.items[item.id] = { state: 'manual-required', at: new Date().toISOString(), contentHash: item.contentHash, publicationHash: approvedHash };
      writeJsonAtomic(resultFile, result);
      continue;
    }
    if (!force && previous?.contentHash === item.contentHash && ['published', 'scheduled', 'processing', 'private', 'unlisted', 'public'].includes(previous.state)) {
      continue;
    }
    if (!credential) throw new Error(`${item.id} 공식 계정 연결이 없습니다.`);
    const attempt = { contentHash: item.contentHash, publicationHash: approvedHash, startedAt: new Date().toISOString() };
    result.items[item.id] = { ...attempt, state: 'publishing' };
    writeJsonAtomic(resultFile, result);
    try {
      const published = await publishItem(item, account, credential, {
        fetchImpl,
        onProgress: (progress) => {
          result.items[item.id] = { ...attempt, ...progress, updatedAt: new Date().toISOString() };
          writeJsonAtomic(resultFile, result);
        },
      });
      result.items[item.id] = { ...attempt, ...published, finishedAt: new Date().toISOString() };
    } catch (error) {
      const partial = error.partialResult || (result.items[item.id]?.state === 'partial' ? result.items[item.id] : null);
      result.items[item.id] = { ...attempt, ...partial, state: partial ? 'partial' : 'failed', failedAt: new Date().toISOString(), error: error.message };
      writeJsonAtomic(resultFile, result);
      throw error;
    }
    writeJsonAtomic(resultFile, result);
  }
  return { resultFile, result };
}

// 비공개로 올려 검수한 YouTube 항목을 공개로 바꾼다(재생목록이 있으면 재생목록도). 영상·재생목록의 다른 설정은 읽은 값 그대로 두고
// 공개 여부만 바꾸며, 근거(유호님 승인)를 결과 파일에 남긴다.
// publishAt을 주면 영상은 그 시각에 YouTube가 공개하도록 예약하고(비공개 + publishAt — 한 번도 공개한 적 없는 영상만) 재생목록은 지금 공개한다.
// syntheticMedia는 YouTube의 '변경되거나 합성된 콘텐츠' 표시(status.containsSyntheticMedia)를 켠다. AI로 만든 음악이 중심인 영상은
// YouTube 규정상 표시 대상이다(2026-10-08 유호님 「켜기」). 주지 않으면 영상에 있던 값을 그대로 둔다.
// 2026-10-08 새벽 구글 인증이 같은 토큰에 무작위로 401을 돌려줬다. 여기 요청은 다시 보내도 같은 값을 쓰므로 YouTube API의 401은 잠시 뒤 다시 묻는다.
async function youtubeMakePublic(planFile, itemId, note, {
  accountsFile, fetchImpl = fetch, readCredentialImpl = readCredential, publishAt = null, syntheticMedia = false,
  now = () => new Date(), retry401 = { retries: 5, delayMs: 2000 },
} = {}) {
  if (!String(note || '').trim()) throw new Error('공개 전환에는 --근거(유호님 승인)가 필요합니다.');
  let scheduleAt = null;
  if (publishAt) {
    const text = String(publishAt).trim();
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) throw new Error(`예약 시각에 시간대를 붙여 주세요(예: 2026-10-09T08:00:00+09:00): ${publishAt}`);
    const when = new Date(text);
    if (Number.isNaN(when.getTime())) throw new Error(`예약 시각을 읽지 못했습니다: ${publishAt}`);
    if (when.getTime() <= now().getTime() + 5 * 60 * 1000) throw new Error(`예약 시각이 지났거나 5분 안입니다: ${publishAt} — 바로 공개하려면 --시각 없이 실행하세요.`);
    scheduleAt = when.toISOString();
  }
  const plan = readJson(planFile);
  const config = loadAccounts(accountsFile || resolveRepoPath(plan.accountsFile));
  const item = plan.items.find((candidate) => candidate.id === itemId);
  if (!item || item.platform !== 'youtube') throw new Error(`계획에 YouTube 항목 ${itemId}가 없습니다.`);
  const account = config.accounts[item.accountKey];
  if (!account) throw new Error(`${item.accountKey} 계정 설정이 없습니다.`);
  const resultFile = resultFileFor(planFile);
  const result = fs.existsSync(resultFile) ? readJson(resultFile) : null;
  const done = result?.items?.[itemId];
  if (!done?.id || !['private', 'unlisted', 'public', 'scheduled'].includes(done.state)) {
    throw new Error(`${itemId}는 올린 영상이 없거나 상태가 ${done?.state || '없음'}입니다.`);
  }
  const retrying = retryYoutube401(fetchImpl, retry401);
  const credential = readCredentialImpl(item.accountKey, { allowLegacy: true });
  const { token, channel } = await youtubeChannel(credential, retrying);
  if (!matchesYoutubeAccount(channel, account)) throw new Error(`${itemId}: YouTube 인증 채널이 다릅니다.`);
  const auth = { authorization: `Bearer ${token.accessToken}` };
  const get = async (url, what) => {
    const response = await fetchWithRetry(url, { headers: auth }, { fetchImpl: retrying });
    const body = await responseJson(response);
    if (!response.ok) throw new Error(`YouTube ${what} 조회 실패 ${response.status}: ${apiMessage(body)}`);
    const found = body.items?.[0];
    if (!found) throw new Error(`YouTube ${what}을(를) 찾지 못했습니다.`);
    return found;
  };
  const put = async (url, payload, what) => {
    const response = await fetchWithRetry(url, { method: 'PUT', headers: { ...auth, 'content-type': 'application/json; charset=UTF-8' }, body: JSON.stringify(payload) }, { fetchImpl: retrying });
    const body = await responseJson(response);
    if (!response.ok) throw new Error(`YouTube ${what} 실패 ${response.status}: ${apiMessage(body)}`);
    return body;
  };
  const video = await get(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(done.id)}`, '영상');
  const s = video.status || {};
  // part=status를 PUT하면 빠진 값은 지워지므로 읽은 값을 그대로 다시 싣는다. 예약 없이 공개하면 publishAt이 빠져 예약도 풀린다.
  const status = { privacyStatus: scheduleAt ? 'private' : 'public', ...(scheduleAt ? { publishAt: scheduleAt } : {}), selfDeclaredMadeForKids: s.selfDeclaredMadeForKids ?? Boolean(account.madeForKids) };
  for (const key of ['embeddable', 'license', 'publicStatsViewable', 'containsSyntheticMedia']) if (s[key] !== undefined) status[key] = s[key];
  if (syntheticMedia) status.containsSyntheticMedia = true;
  const syntheticChanged = status.containsSyntheticMedia !== s.containsSyntheticMedia;
  if (scheduleAt) {
    if (s.privacyStatus !== 'private') throw new Error(`${itemId}: 영상이 이미 ${s.privacyStatus} 상태라 예약할 수 없습니다(예약은 한 번도 공개하지 않은 비공개 영상만).`);
    if (Date.parse(s.publishAt || '') !== Date.parse(scheduleAt) || syntheticChanged) {
      await put('https://www.googleapis.com/youtube/v3/videos?part=status', { id: done.id, status }, '영상 공개 예약');
    }
  } else if (s.privacyStatus !== 'public' || syntheticChanged) {
    await put('https://www.googleapis.com/youtube/v3/videos?part=status', { id: done.id, status }, '영상 공개 전환');
  }
  let playlist = done.playlist || null;
  if (playlist?.id) {
    const found = await get(`https://www.googleapis.com/youtube/v3/playlists?part=snippet,status&id=${encodeURIComponent(playlist.id)}`, '재생목록');
    if (found.status?.privacyStatus !== 'public') {
      const snippet = { title: found.snippet.title, description: found.snippet.description || '', ...(found.snippet.defaultLanguage ? { defaultLanguage: found.snippet.defaultLanguage } : {}) };
      await put('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', { id: found.id, snippet, status: { privacyStatus: 'public' } }, '재생목록 공개 전환');
    }
    playlist = { ...playlist, visibility: 'public' };
  }
  const at = now().toISOString();
  // 예약해 둔 항목을 나중에 다시 --공개하면 처음 승인 근거는 publicNote에 그대로 두고 이번 근거를 publicConfirmNote에 남긴다.
  const confirmingSchedule = !scheduleAt && done.state === 'scheduled' && done.publicNote;
  result.items[itemId] = {
    ...done,
    state: scheduleAt ? 'scheduled' : 'public',
    ...(scheduleAt ? { publishAt: scheduleAt, scheduledAt: at } : { publicAt: at }),
    ...(confirmingSchedule ? { publicConfirmNote: note } : { publicNote: note }),
    ...(status.containsSyntheticMedia !== undefined ? { containsSyntheticMedia: status.containsSyntheticMedia } : {}),
    ...(playlist ? { playlist } : {}),
  };
  writeJsonAtomic(resultFile, result);
  return { resultFile, item: result.items[itemId] };
}

function setClipboard(text) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', '$input | Set-Clipboard'], {
    input: text,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`클립보드 복사 실패: ${String(result.stderr || '').trim()}`);
}

function openManualItem(planFile, itemId, accountsFile) {
  const plan = readJson(planFile);
  const config = loadAccounts(accountsFile || resolveRepoPath(plan.accountsFile));
  const item = plan.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`계획에 ${itemId}가 없습니다.`);
  const account = config.accounts[item.accountKey];
  if (!account?.editorUrl) throw new Error(`${itemId}에 공식 편집기 URL이 없습니다.`);
  verifyApproval(item, account, null);
  setClipboard(item.text);
  openChrome(account.editorUrl);
  const folder = resolveRepoPath(item.folder);
  spawn('explorer.exe', [folder], { detached: true, stdio: 'ignore' }).unref();
  return { itemId, clipboard: '본문', editorUrl: account.editorUrl, folder };
}

const youtubeAdapter = require('./sns-adapters/youtube.cjs')({ apiMessage, fetchWithRetry, mimeFor, resolveRepoPath, responseJson });
const { googleAccessToken, youtubeChannel, matchesYoutubeAccount, youtubeAddToPlaylist, retryYoutube401, subtitleLanguage, youtubeSetThumbnail, youtubeUploadCaption, youtubeUpload } = youtubeAdapter;
const telegramAdapter = require('./sns-adapters/telegram.cjs')({ apiMessage, fetchWithRetry, mimeFor, resolveRepoPath, responseJson });
const { splitText, telegramPublish } = telegramAdapter;
const pinterestAdapter = require('./sns-adapters/pinterest.cjs')({ apiMessage, fetchWithRetry, mimeFor, resolveRepoPath, responseJson });
const { pinterestPublish } = pinterestAdapter;
const metaAdapter = require('./sns-adapters/meta.cjs')({ apiMessage, fetchWithRetry, mimeFor, resolveRepoPath, responseJson });
const { facebookPublish } = metaAdapter;
const threadsAdapter = require('./sns-adapters/threads.cjs')({ apiMessage, fetchWithRetry, responseJson });
const { threadsPublish } = threadsAdapter;
const linkedinAdapter = require('./sns-adapters/linkedin.cjs')({ apiMessage, fetchWithRetry, mimeFor, resolveRepoPath, responseJson });
const { linkedinPublish } = linkedinAdapter;
const tiktokAdapter = require('./sns-adapters/tiktok.cjs')({ apiMessage, fetchWithRetry, mimeFor, resolveRepoPath, responseJson });
const { tiktokPublish } = tiktokAdapter;
const adapters = Object.freeze({ youtube: youtubeAdapter, telegram: telegramAdapter, pinterest: pinterestAdapter, facebook: metaAdapter.facebook, instagram: metaAdapter.instagram, threads: threadsAdapter, linkedin: linkedinAdapter, tiktok: tiktokAdapter });

module.exports = {
  REPO_ROOT,
  DEFAULT_ACCOUNTS,
  readJson,
  writeJsonAtomic,
  sha256File,
  loadAccounts,
  scanPackages,
  packageFromFolder,
  validateItem,
  buildPlan,
  renderPlanMarkdown,
  approvePlan,
  verifyDependencies,
  publicationHash,
  verifyApproval,
  hasCredential,
  readCredential,
  writeCredential,
  deleteCredential,
  migrateLegacyYoutubeLab,
  googleAccessToken,
  youtubeChannel,
  matchesYoutubeAccount,
  fetchWithRetry,
  retryYoutube401,
  responseJson,
  apiMessage,
  subtitleLanguage,
  youtubeSetThumbnail,
  youtubeUploadCaption,
  checkConnection,
  checkAllConnections,
  authorizeYoutube,
  openCredentialForm,
  splitText,
  youtubeAddToPlaylist,
  youtubeUpload,
  youtubeMakePublic,
  telegramPublish,
  pinterestPublish,
  facebookPublish,
  threadsPublish,
  linkedinPublish,
  tiktokPublish,
  publishItem,
  publishPlan,
  resultFileFor,
  recordInstagramPublication,
  dmPublicationHandoff,
  openManualItem,
};
