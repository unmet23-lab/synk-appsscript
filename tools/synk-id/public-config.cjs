'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { SERVICES, CLIENTS } = require('./registry.cjs');
const OUTPUTS = Object.freeze({ desktop: 'desktop/auth-config.json', browser: 'experiences/synk-account/config.json', fortune: 'experiences/daily-fortune/account.config.json', dating: 'experiences/atlas-lab/account.config.json' });
const fail = message => { throw new Error(message); };
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
function publicUrl(value, originOnly = false) {
  let url; try { url = new URL(value); } catch { fail('공개 URL 형식을 확인해 주세요.'); }
  if (url.username || url.password || url.hash || !['https:', 'http:'].includes(url.protocol)
    || url.protocol === 'http:' && url.hostname !== '127.0.0.1'
    || originOnly && (url.pathname !== '/' || url.search)) fail('공개 URL은 HTTPS 또는 명시한 127.0.0.1 주소여야 해요.');
  return originOnly ? url.origin : url.href;
}
function publicKey(value) {
  if (typeof value !== 'string' || value.length > 4096 || !value) fail('공개 publishable 또는 anon 키가 필요해요.');
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return value;
  try { if (value.split('.').length === 3 && JSON.parse(Buffer.from(value.split('.')[1], 'base64url')).role === 'anon') return value; } catch {}
  fail('비밀 키를 설정 파일에 쓸 수 없어요. 공개 publishable 또는 anon 키만 사용해 주세요.');
}
function callback(value, registration) {
  if (typeof value !== 'string' || value.length > 2000) fail('실제 등록된 콜백 주소가 필요해요.');
  let url; try { url = new URL(value); } catch { fail('등록 콜백의 형식을 확인해 주세요.'); }
  if (registration.runtime !== 'browser') {
    if (!registration.redirectUris.includes(value) && url.protocol !== 'https:') fail(`${registration.id}의 등록 콜백이 공통 목록과 달라요.`);
  } else publicUrl(value);
  if (url.username || url.password || url.hash || [...url.searchParams.keys()].some(key => url.searchParams.getAll(key).length !== 1)
    || ['code', 'state', 'error', 'error_description', 'access_token', 'refresh_token'].some(key => url.searchParams.has(key))) fail('콜백에는 인증 응답이나 중복 query를 넣을 수 없어요.');
  return value;
}
function buildConfigPlan(input) {
  if (!object(input) || input.version !== 1 || !['production', 'rehearsal'].includes(input.environment) || !Array.isArray(input.clients)
    || Object.keys(input).some(key => !['version', 'environment', 'supabaseUrl', 'accountApiUrl', 'supabasePublishableKey', 'portalUrl', 'learningUrl', 'messengerUrl', 'clients', 'bindings'].includes(key))) fail('등록 결과 파일의 v1 공개 형식을 확인해 주세요.');
  const common = { version: 1, supabaseUrl: publicUrl(input.supabaseUrl, true), accountApiUrl: publicUrl(input.accountApiUrl || input.supabaseUrl, true), supabasePublishableKey: publicKey(input.supabasePublishableKey) };
  const browserBase = { ...common, portalUrl: publicUrl(input.portalUrl), ...(input.learningUrl ? { learningUrl: publicUrl(input.learningUrl) } : {}), ...(input.messengerUrl ? { messengerUrl: publicUrl(input.messengerUrl) } : {}) };
  const bindings = input.bindings || {};
  if (!object(bindings) || Object.keys(bindings).some(key => !CLIENTS.some(item => item.id === key))) fail('공통 목록에 없는 OAuth 연결 이름이 있어요.');
  const byId = new Map(), explicit = new Map();
  for (const row of input.clients) {
    if (!object(row) || typeof row.client_id !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(row.client_id) || byId.has(row.client_id)) fail('실제 등록 목록에 중복되거나 잘못된 client_id가 있어요.');
    if (row.client_type !== 'public' || row.client_secret || row.access_token || row.refresh_token || row.deleted_at || row.revoked === true) fail('활성 public OAuth 등록 결과만 입력해 주세요.');
    if (!Array.isArray(row.redirect_uris) || !row.redirect_uris.length || row.redirect_uris.some(uri => typeof uri !== 'string') || new Set(row.redirect_uris).size !== row.redirect_uris.length) fail('각 등록의 실제 redirect_uris가 필요해요.');
    byId.set(row.client_id, row);
    if (row.registration) {
      if (!CLIENTS.some(item => item.id === row.registration) || explicit.has(row.registration)) fail('등록 결과의 공통 목록 연결 이름이 중복되거나 잘못됐어요.');
      explicit.set(row.registration, row.client_id);
    }
  }
  const desktop = { ...common, clients: {} }, browser = { ...browserBase, clients: {}, authorizationClients: [] }, fortune = { ...browserBase, clients: {}, authorizationClients: [] }, dating = { ...browserBase, clients: {}, authorizationClients: [] };
  const registered = [], missing = [], used = new Set(), products = {};
  for (const registration of CLIENTS) {
    const bound = bindings[registration.id];
    if (bound !== undefined && (typeof bound === 'string' && !bound || object(bound) && (typeof bound.clientId !== 'string' || !bound.clientId))) fail('OAuth bindings에는 실제 등록 clientId가 필요해요.');
    const id = typeof bound === 'string' ? bound : object(bound) ? bound.clientId : explicit.get(registration.id) || registration.knownIds?.[input.environment];
    if (bound !== undefined && typeof bound !== 'string' && (!object(bound) || Object.keys(bound).some(key => !['clientId', 'redirectUri'].includes(key)))) fail('OAuth bindings에는 clientId와 선택한 redirectUri만 쓸 수 있어요.');
    if (bound && explicit.has(registration.id) && id !== explicit.get(registration.id)) fail('등록 결과와 bindings의 client_id가 달라요.');
    const row = byId.get(id);
    if (!row) { if (bound !== undefined || explicit.has(registration.id)) fail(`${registration.id}에 지정한 client_id가 실제 등록 목록에 없어요.`); missing.push(registration.id); continue; }
    if (used.has(id)) fail('서비스나 실행 환경 사이에서 OAuth client_id를 공유할 수 없어요.');
    const redirectUris = row.redirect_uris.map(uri => callback(uri, registration));
    if (registration.runtime !== 'browser' && registration.redirectUris.some(uri => !redirectUris.includes(uri))) fail(`${registration.id}의 필수 등록 콜백이 빠졌어요.`);
    const selected = object(bound) && bound.redirectUri ? bound.redirectUri : registration.redirectUris.find(uri => redirectUris.includes(uri)) || (redirectUris.length === 1 ? redirectUris[0] : null);
    if (registration.runtime === 'native' && !registration.redirectUris.includes(selected)) fail(`${registration.id}의 실행 주소는 PC 앱의 등록된 로컬 콜백이어야 해요.`);
    if (registration.runtime !== 'legacy' && (!selected || !redirectUris.includes(selected))) fail(`${registration.id}의 실제 콜백 중 하나를 bindings.redirectUri로 선택해 주세요.`);
    used.add(id); products[id] = registration.product;
    registered.push({ registration: registration.id, clientId: id, redirectUris, connection: registration.connection });
    browser.authorizationClients.push({ product: registration.product, clientId: id, redirectUris });
    if (registration.connection === 'pending-adapter') continue;
    const client = { clientId: id, redirectUri: selected };
    if (registration.runtime === 'native') desktop.clients[registration.configKey] = client;
    if (registration.runtime === 'browser') {
      if (registration.service === 'fortune') fortune.clients.platform = client;
      else if (registration.service === 'dating') dating.clients.platform = client;
      else browser.clients[registration.configKey] = client;
    }
  }
  fortune.authorizationClients = browser.authorizationClients;
  dating.authorizationClients = browser.authorizationClients;
  return { environment: input.environment, services: SERVICES, registered, missing, unmapped: [...byId.keys()].filter(id => !used.has(id)), products,
    files: [{ path: OUTPUTS.desktop, data: desktop }, { path: OUTPUTS.browser, data: browser }, { path: OUTPUTS.fortune, data: fortune }, ...(dating.clients.platform ? [{ path: OUTPUTS.dating, data: dating }] : [])] };
}
const stable = value => JSON.stringify(Array.isArray(value) ? value.map(item => JSON.parse(stable(item))) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(stable(value[key]))])) : value);
const inside = (root, candidate) => { const relative = path.relative(root, candidate); return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
async function applyConfigPlan(plan, { write = false, root = path.resolve(__dirname, '../..') } = {}) {
  const workspace = await fs.realpath(root), allowed = new Set(Object.values(OUTPUTS)), pending = [];
  for (const file of plan.files) {
    if (!allowed.has(file.path)) fail('설정 출력 경로는 저장소 안의 고정된 공개 설정 파일만 허용해요.');
    const target = path.resolve(workspace, file.path);
    if (!inside(workspace, target)) fail('설정 파일이 저장소 밖에 있어요.');
    // Check every existing ancestor before mkdir or any write, including junctions.
    let ancestor = path.dirname(target);
    for (;;) { try { if (!inside(workspace, await fs.realpath(ancestor))) fail('설정 경로가 저장소 밖으로 연결되어 있어요.'); break; } catch (error) { if (error.code !== 'ENOENT') throw error; const parent = path.dirname(ancestor); if (parent === ancestor) throw error; ancestor = parent; } }
    let previous = null;
    try { if (!inside(workspace, await fs.realpath(target))) fail('설정 파일이 저장소 밖으로 연결되어 있어요.'); previous = await fs.readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    let equal = false; try { equal = previous !== null && stable(JSON.parse(previous)) === stable(file.data); } catch {}
    pending.push({ path: file.path, target, previous, content: JSON.stringify(file.data, null, 2) + '\n', action: equal ? 'unchanged' : previous === null ? 'create' : 'replace' });
  }
  const changes = [];
  for (const file of pending) {
    let backup = null;
    if (write && file.action !== 'unchanged') {
      await fs.mkdir(path.dirname(file.target), { recursive: true });
      const suffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      if (file.previous !== null) { backup = `${file.target}.backup-${suffix}`; await fs.writeFile(backup, file.previous, { flag: 'wx', mode: 0o600 }); }
      const temporary = `${file.target}.tmp-${suffix}`;
      try { await fs.writeFile(temporary, file.content, { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, file.target); }
      catch (error) { await fs.rm(temporary, { force: true }); throw error; }
    }
    changes.push({ path: file.path, action: file.action, written: write && file.action !== 'unchanged', ...(backup ? { backup: path.relative(workspace, backup) } : {}) });
  }
  return changes;
}
module.exports = { OUTPUTS, buildConfigPlan, applyConfigPlan };
