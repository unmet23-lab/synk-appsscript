#!/usr/bin/env node
'use strict';
// Default is read-only. --apply is the only path that registers public OAuth
// clients and merges the existing product map. No SQL, deployment or user login.
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { provision } = require('./provision.cjs');
const { applyConfigPlan } = require('./public-config.cjs');
async function readJson(file) {
  try { const info = await fs.stat(file); if (info.size > 1024 * 1024) throw Error(); return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') throw error; throw Error('입력 JSON 파일을 확인해 주세요. 파일 내용은 출력하지 않아요.'); }
}
function credentialMode({ environment, apply = false }) {
  if (!['production', 'rehearsal'].includes(environment) || typeof apply !== 'boolean') throw Error('대상 환경과 적용 모드를 확인해 주세요.');
  // The shared guard treats --운영 as write approval. Read-only production uses
  // the explicit project REF override and the guard's read-only declaration.
  return { 읽기: !apply, args: apply ? [...(environment === 'production' ? ['--운영'] : []), '--apply'] : [] };
}
async function createProvider({ environment, publicSettings, apply = false }, dependencies) {
  const guardOptions = credentialMode({ environment, apply });
  const { credentials } = dependencies || require('./lib.js');
  const fetcher = dependencies?.fetcher || globalThis.fetch;
  const ref = environment === 'production' ? credentials.운영REF : credentials.리허설REF;
  if (!/^[a-z0-9]+$/.test(ref)) throw Error('기존 SYNK ID 프로젝트를 확인하지 못했어요.');
  if (publicSettings && new URL(publicSettings.supabaseUrl).origin !== `https://${ref}.supabase.co`) throw Error('공개 설정과 대상 SYNK ID 프로젝트가 달라요.');
  process.env.SUPABASE_PROJECT_REF = ref;
  const credentialState = credentials.읽기('SYNK공통계정연결', guardOptions);
  if (credentialState.SUPABASE_PROJECT_REF !== ref) throw Error('자격증명 보호 조건의 대상과 실제 요청 대상이 달라요.');
  if (!credentialState.SUPABASE_ACCESS_TOKEN) throw Error('기존 운영 자격증명을 확인하지 못했어요.');
  const management = dependencies?.management || ((_ref, suffix, init = {}) => fetcher(`https://api.supabase.com/v1/projects/${ref}${suffix}`, {
    ...init, signal: AbortSignal.timeout(20000), redirect: 'error', headers: { Authorization: `Bearer ${credentialState.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  }));
  let adminKey;
  async function jsonResponse(response, label) { if (!response.ok) { const error = Error(`${label} HTTP ${response.status}`); error.status = response.status; throw error; } try { return await response.json(); } catch { throw Error(`${label} 응답 형식을 확인하지 못했어요.`); } }
  async function admin(suffix = '', init = {}) {
    if (!adminKey) {
      const response = await management(ref, '/api-keys?reveal=true', { signal: AbortSignal.timeout(20000) }), keys = await jsonResponse(response, '서버 자격증명 조회');
      adminKey = (keys.find(item => item.type === 'secret') || keys.find(item => item.name === 'service_role'))?.api_key;
      if (!adminKey) throw Error('기존 서버 인증 자격증명을 확인하지 못했어요.');
    }
    return fetcher(`https://${ref}.supabase.co/auth/v1/admin/oauth/clients${suffix}`, { ...init, signal: AbortSignal.timeout(20000), redirect: 'error', headers: { apikey: adminKey, Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' } });
  }
  return {
    async verifyFortuneBindings(bindings) {
      const ids = ['fortune-native', 'fortune-browser'].map(key => bindings[key]);
      if (!ids.some(Boolean)) return;
      if (!ids.every(Boolean)) throw Error('기존 운세의 native·browser 연결을 함께 확인해 주세요.');
      const rows = await jsonResponse(await management(ref, '/secrets'), '운세 허용 목록 지문 조회');
      // The canonical Fortune provisioner stores a sorted ID set; callback
      // validation in buildProvisionPlan separately verifies native/browser roles.
      if (rows.find(row => row.name === 'SYNK_FORTUNE_CLIENT_IDS')?.value !== crypto.createHash('sha256').update(JSON.stringify([...ids].sort())).digest('hex')) throw Error('기존 운세 허용 목록과 연결 ID가 달라요. 원본 확인 전에는 변경하지 않아요.');
    },
    async readDigest() { const rows = await jsonResponse(await management(ref, '/secrets', { signal: AbortSignal.timeout(20000) }), '제품 매핑 지문 조회'); const value = rows.find(item => item.name === 'SYNK_OAUTH_CLIENT_PRODUCTS')?.value; if (!/^[a-f0-9]{64}$/i.test(value)) throw Error('제품 매핑 SHA256 지문을 확인하지 못했어요.'); return value.toLowerCase(); },
    async listClients() {
      // Auth 719db0b, oauthserver/handlers.go: OAuthServerClientList uses All()
      // and explicitly leaves pagination TODO. page/per_page are ignored.
      // Fail closed at the OpenAPI default page size, or when that shape changes.
      const response = await admin(), data = await jsonResponse(response, 'OAuth 등록 목록 조회');
      if (!data || Array.isArray(data) || Object.keys(data).some(key => key !== 'clients') || response.headers.get('link') || response.headers.get('content-range')) throw Error('OAuth 목록의 페이지 계약이 바뀌었어요. 전체 목록을 확인한 뒤 도구를 갱신해 주세요.');
      const rows = data.clients || [];
      if (!Array.isArray(rows) || rows.length >= 50 || new Set(rows.map(row => row.client_id)).size !== rows.length || rows.some(row => typeof row.client_id !== 'string')) throw Error('OAuth 전체 목록 형식·개수·중복을 확인하지 못했어요. 페이지 계약을 다시 확인해 주세요.');
      return rows;
    },
    async createClient(body) { if (!apply) throw Error('읽기 전용 공급자에서는 OAuth 등록을 변경할 수 없어요.'); return jsonResponse(await admin('', { method: 'POST', body: JSON.stringify(body) }), 'Public OAuth 등록'); },
    async writeMapping(mapping) { if (!apply) throw Error('읽기 전용 공급자에서는 제품 매핑을 변경할 수 없어요.'); await jsonResponse(await management(ref, '/secrets', { method: 'POST', signal: AbortSignal.timeout(20000), body: JSON.stringify([{ name: 'SYNK_OAUTH_CLIENT_PRODUCTS', value: JSON.stringify(mapping) }]) }), '제품 매핑 병합'); },
  };
}
async function journalStore(root, environment) {
  if (!['production', 'rehearsal'].includes(environment)) throw Error('적용 기록 환경을 확인해 주세요.');
  const workspace = await fs.realpath(root), directory = path.join(workspace, 'tools', 'synk-id', 'state');
  let ancestor = directory;
  for (;;) { try { const real = await fs.realpath(ancestor), relative = path.relative(workspace, real); if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw Error('적용 기록 경로가 저장소 밖으로 연결돼 있어요.'); break; } catch (error) { if (error.code !== 'ENOENT') throw error; ancestor = path.dirname(ancestor); } }
  const file = path.join(directory, `provision-${environment}.json`), lockPath = file + '.lock';
  let journal = null; try { journal = await readJson(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!journal) try { journal = await readJson(path.join(workspace, '.tmp', 'synk-id', `provision-${environment}.json`)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const saveJournal = async value => {
    await fs.mkdir(directory, { recursive: true });
    const temporary = file + '.tmp-' + crypto.randomBytes(6).toString('hex');
    try { await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, file); }
    catch (error) { await fs.rm(temporary, { force: true }); throw error; }
  };
  return { directory, file, lockPath, journal, saveJournal };
}
async function main() {
  const args = process.argv.slice(2), values = new Map(), flags = new Set();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (['--apply', '--운영'].includes(key)) { if (flags.has(key)) throw Error('중복된 옵션이에요.'); flags.add(key); }
    else if (['--mapping', '--bindings', '--public', '--retry-confirmed-absent'].includes(key)) { if (values.has(key) || !args[index + 1] || args[index + 1].startsWith('--')) throw Error('옵션 값 하나가 필요해요.'); values.set(key, args[++index]); }
    else throw Error('사용: node tools/synk-id/provision-apply.cjs [--운영] [--mapping 원본.json] [--bindings 연결.json] [--public 공개설정.json] [--apply] [--retry-confirmed-absent 등록이름]');
  }
  const environment = flags.has('--운영') ? 'production' : 'rehearsal', apply = flags.has('--apply');
  if (apply && !values.has('--public')) throw Error('--apply에는 확인된 --public 공개 설정 파일이 필요해요.');
  const existingMapping = values.has('--mapping') ? await readJson(values.get('--mapping')) : undefined;
  const bindings = values.has('--bindings') ? await readJson(values.get('--bindings')) : {};
  const publicSettings = values.has('--public') ? await readJson(values.get('--public')) : undefined;
  const { directory, lockPath, journal, saveJournal } = await journalStore(path.resolve(__dirname, '../..'), environment);
  const api = await createProvider({ environment, publicSettings, apply }); // Guard may exit; do not leave a lock.
  let lock;
  try {
    if (apply) { await fs.mkdir(directory, { recursive: true }); try { lock = await fs.open(lockPath, 'wx', 0o600); await lock.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); } catch { throw Error('다른 적용 작업의 잠금이 있어요. 주인 프로세스를 확인한 뒤 다시 실행해 주세요.'); } }
    const result = await provision({ environment, api, apply, existingMapping, bindings, journal, publicSettings, saveJournal, retryConfirmedAbsent: values.get('--retry-confirmed-absent'), writeConfigs: plan => applyConfigPlan(plan, { write: true }) });
    console.log(JSON.stringify(result, null, 2));
  } finally { if (lock) { await lock.close(); await fs.unlink(lockPath); } }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { createProvider, credentialMode, journalStore };
