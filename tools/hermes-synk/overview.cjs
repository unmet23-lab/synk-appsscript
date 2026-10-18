#!/usr/bin/env node
'use strict';

// A projection of existing records. No model call, scheduler, task execution or remote write.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const status = require('./status.cjs');
const runFile = promisify(execFile);
const ROOT = path.resolve(__dirname, '../..');
const LEDGER_CACHE = 'runtime/synk-overview/ledger-cache.json';
const LEDGER_TTL_MS = 6 * 60 * 60_000;
const ARGON_CACHE = 'runtime/synk-overview/argon-cache.json';
const ARGON_TTL_MS = 6 * 60 * 60_000;
const MAX_TASKS = 300;
const ROLES = Object.freeze({ full: '전체 조사', 'yt-tt': 'YouTube·TikTok', 'meta-brand': 'Meta·브랜드', synkbrief: 'synkbrief' });
const STATES = new Set(['preparing', 'launching', 'running', 'finalizing', 'unknown', 'launch_failed', 'exited', 'closed_by_user']);
const DELIVERIES = new Set(['sent', 'sending', 'unconfirmed', 'waiting', 'not_recorded', 'suppressed_success']);
const INTEGRATION_POLICY = 'auto_verified_v1';
const NOTIFICATION_POLICY = 'attention_only_v1';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const homeDefault = () => path.join(process.env.LOCALAPPDATA || os.homedir(), 'hermes');
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const canonicalPath = value => {
  const resolved = fs.realpathSync(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};
const readJson = (base, relative, limit) => JSON.parse(status.readText(base, relative, limit).content);
const sameRoot = (a, b) => { try { return typeof a === 'string' && canonicalPath(a) === canonicalPath(b); } catch { return false; } };
const shortId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value) ? value : null;

function event(id, kind, severity, title, detail, content = null) {
  const output = { id, kind, severity, needs_attention: false, title: status.plain(title, 110), detail: status.plain(detail, 500) };
  output.fingerprint = hash(content === null ? { kind, severity, title: output.title, detail: output.detail } : { kind, severity, content });
  return output;
}

function sanitizeLedger(payload) {
  if (!payload || payload.ok !== true || !Array.isArray(payload.rows) || payload.rows.length > 50) throw new Error('LEDGER_SHAPE');
  return payload.rows.map(row => {
    if (!row || !Number.isSafeInteger(row.row) || row.row < 2 || row.row > 1_000_000) throw new Error('LEDGER_SHAPE');
    return { row: row.row, postId: shortId(row['게시물ID'] ?? row.postId), status: status.plain(row['상태'] ?? row.status ?? '미기록', 80),
      where: status.plain(row['어디에'] ?? row.where ?? '', 120), when: status.plain(row['언제'] ?? row.when ?? '', 50) };
  }).sort((a, b) => a.row - b.row);
}

function readLedgerCache(home) {
  try {
    const record = readJson(home, LEDGER_CACHE, 100_000);
    const checkedAt = iso(record.checkedAt);
    if (record.version !== 1 || !checkedAt) throw new Error('CACHE_SHAPE');
    return { checkedAt, rows: sanitizeLedger({ ok: true, rows: record.rows }) };
  } catch { return null; }
}

function saveCache(home, name, record) {
  // Only this derived, secret-free cache is writable. Never follow a directory link.
  const base = fs.realpathSync(home);
  let current = base;
  for (const part of ['runtime', 'synk-overview']) {
    current = path.join(current, part);
    try { fs.mkdirSync(current, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    if (fs.lstatSync(current).isSymbolicLink() || !fs.statSync(current).isDirectory()) throw new Error('CACHE_PATH');
  }
  if (!['ledger-cache.json', 'argon-cache.json'].includes(name)) throw new Error('CACHE_NAME');
  const destination = path.join(current, name);
  if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) throw new Error('CACHE_PATH');
  const temporary = path.join(current, 'ledger-' + randomUUID() + '.tmp');
  try {
    fs.writeFileSync(temporary, JSON.stringify({ version: 1, ...record }) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, destination);
  } finally { try { fs.unlinkSync(temporary); } catch {} }
}
const saveLedgerCache = (home, record) => saveCache(home, 'ledger-cache.json', record);

async function refreshLedger(home) {
  const script = status.safePath(home, 'skills/research/synk-tip-review/scripts/ledger.py');
  const python = process.platform === 'win32' ? path.join(os.homedir(), '.local/bin/python3.12.exe') : 'python3';
  const result = await runFile(python, ['-X', 'utf8', script, 'recent', '50'], {
    shell: false, windowsHide: true, timeout: 20_000, maxBuffer: 512_000, encoding: 'utf8',
  });
  return JSON.parse(result.stdout);
}

async function ledgerSnapshot({ hermesHome, now, remoteRefresh, readLedger }) {
  let cached = readLedgerCache(hermesHome);
  let refreshFailed = false;
  let cacheSaved = null;
  if (remoteRefresh) {
    try {
      const rows = sanitizeLedger(await (readLedger || refreshLedger)(hermesHome));
      cached = { rows, checkedAt: now.toISOString() };
      try { saveLedgerCache(hermesHome, cached); cacheSaved = true; } catch { cacheSaved = false; }
    } catch { refreshFailed = true; }
  }
  const age = cached ? now.getTime() - Date.parse(cached.checkedAt) : null;
  const valid = !!cached && age >= -60_000;
  return {
    available: valid, checkedAt: valid ? cached.checkedAt : null,
    stale: !valid || age > LEDGER_TTL_MS || refreshFailed, refreshFailed, cacheSaved,
    limited: valid && cached.rows.length === 50, rows: valid ? cached.rows : [],
    coverage: remoteRefresh && !refreshFailed ? '기존 장부 recent 50 읽기 전용 조회' : '마지막 성공 장부 조회의 로컬 사본 · 기본 실행은 원격 요청 없음',
  };
}

function fileMetadata(home, relative) {
  try {
    const file = status.safePath(home, relative);
    const stat = fs.statSync(file);
    return { available: stat.isFile() && stat.size <= 2_000_000, bytes: stat.isFile() ? stat.size : null };
  } catch { return { available: false, bytes: null }; }
}

function sanitizeTask(row, root) {
  if (!row || !/^synk-[0-9a-f]{12}$/.test(row.id || '') || !['claude', 'codex'].includes(row.engine) || !sameRoot(row.repo_root, root)) return null;
  const delivery = row.delivery || {};
  const state = STATES.has(row.state) ? row.state : 'unknown';
  const directDelivery = row.delivery_mode === 'native_result_direct_v1';
  const dueAt = row.due_source === 'user' ? iso(row.due_at) : null;
  const attention = row.attention?.kind === 'approval' && row.attention?.status === 'pending'
    ? { kind: 'approval', status: 'pending', summary: status.plain(row.attention.summary || '사용자 판단 대기', 180) } : null;
  const integration = row.integrationReceipt;
  const integrationReceipt = integration?.version === 1 && integration.policy === INTEGRATION_POLICY
    && ['integrated', 'no_changes', 'needs_attention', 'unknown'].includes(integration.state)
    ? { state: integration.state, verified: integration.verified === true, needsAttention: integration.needs_attention === true,
      reasonCode: /^[A-Z][A-Z0-9_]{0,99}$/.test(integration.reason_code || '') ? integration.reason_code : null,
      completedAt: iso(integration.completed_at) } : null;
  const validation = row.validationReceipt;
  const validationReceipt = ['passed', 'no_changes', 'needs_attention'].includes(validation?.status)
    ? { status: validation.status, reasonCode: /^[A-Z][A-Z0-9_]{0,99}$/.test(validation.reason_code || '') ? validation.reason_code : null } : null;
  const integrated = integrationReceipt?.verified && integration.needs_attention === false
    && row.needs_attention !== true && row.finalization_state !== 'attention' && validationReceipt?.status !== 'needs_attention'
    && ['integrated', 'no_changes'].includes(integrationReceipt.state);
  return {
    id: row.id, engine: row.engine, state, createdAt: iso(row.created_at),
    exitCode: Number.isInteger(row.exit_code) ? row.exit_code : null,
    deliveryStatus: DELIVERIES.has(delivery.status) ? delivery.status : directDelivery && !['closed_by_user', 'launch_failed'].includes(state) ? 'waiting' : 'not_recorded',
    directDelivery,
    quotaLimited: delivery.quota_limited === true, nativeError: delivery.native_error === true,
    finalFound: delivery.final_found === true, resultAvailable: row.resultAvailable === true,
    resultBytes: Number.isSafeInteger(row.resultBytes) && row.resultBytes >= 0 ? Math.min(row.resultBytes, 2_000_001) : null,
    integrationPolicy: row.integration_policy === INTEGRATION_POLICY ? INTEGRATION_POLICY : 'legacy',
    notificationPolicy: row.notification_policy === NOTIFICATION_POLICY ? NOTIFICATION_POLICY : 'legacy',
    finalizationState: ['pending', 'validating', 'integrating', 'completed', 'attention'].includes(row.finalization_state) ? row.finalization_state : null,
    integrationReceipt, validationReceipt,
    needsAttention: row.needs_attention === true || row.finalization_state === 'attention' || integrationReceipt?.needsAttention === true || validationReceipt?.status === 'needs_attention',
    integration: integrated ? integrationReceipt.state : row.integration === 'not_merged' ? 'not_merged' : 'unspecified', dueAt, attention,
  };
}

function readTaskRecords({ root, hermesHome }) {
  const prefix = 'runtime/synk-tasks';
  let folder;
  try { folder = status.safePath(hermesHome, prefix); }
  catch (error) {
    const empty = error.code === 'ENOENT' && fs.existsSync(hermesHome);
    return { available: empty, complete: empty, items: [] };
  }
  const items = [];
  let unreadable = 0;
  let limited = false;
  let directory;
  try {
    directory = fs.opendirSync(folder);
    let entry;
    let seen = 0;
    while ((entry = directory.readSync())) {
      if (!/^synk-[0-9a-f]{12}$/.test(entry.name)) continue;
      if (++seen > MAX_TASKS) { limited = true; break; }
      if (!entry.isDirectory() || entry.isSymbolicLink()) { unreadable++; continue; }
      const relative = prefix + '/' + entry.name;
      try {
        const request = readJson(hermesHome, relative + '/request.json', 100_000);
        if (request.id !== entry.name) { unreadable++; continue; }
        let delivery = {};
        try { delivery = readJson(hermesHome, relative + '/delivery.json', 25_000); }
        catch (error) { if (error.code !== 'ENOENT') unreadable++; }
        if (!delivery.status && fileMetadata(hermesHome, relative + '/delivery.claim').available) delivery.status = 'unconfirmed';
        let native = {};
        try { native = readJson(hermesHome, relative + '/native-result.json', 100_000); }
        catch (error) { if (error.code !== 'ENOENT') unreadable++; }
        let integrationReceipt = null;
        let validationReceipt = null;
        try { integrationReceipt = readJson(hermesHome, relative + '/integration.json', 50_000); }
        catch (error) { if (error.code !== 'ENOENT') unreadable++; }
        try { validationReceipt = readJson(hermesHome, relative + '/validation.json', 50_000); }
        catch (error) { if (error.code !== 'ENOENT') unreadable++; }
        let durableExit = null;
        if (request.output_mode === 'durable_cli_files_v1') {
          try {
            const value = status.readText(hermesHome, relative + '/native.exit', 32).content.trim();
            if (/^-?\d{1,5}$/.test(value)) durableExit = Number(value);
            else unreadable++;
          } catch (error) { if (error.code !== 'ENOENT') unreadable++; }
        }
        const nativeExited = (native.snapshot?.status === 'exited' || durableExit !== null) && !['closed_by_user', 'finalizing'].includes(request.state);
        const result = fileMetadata(hermesHome, relative + '/result.txt');
        const item = sanitizeTask({ ...request, integrationReceipt, validationReceipt,
          ...(nativeExited ? { state: 'exited', exit_code: durableExit ?? native.snapshot.exit_code } : {}),
          delivery: { quota_limited: native.quota_limited === true, native_error: native.native_error === true, final_found: native.final_found === true, ...delivery },
          resultAvailable: result.available, resultBytes: result.bytes }, root);
        if (item) items.push(item);
        else unreadable++;
      } catch { unreadable++; }
    }
  } catch { return { available: false, complete: false, items: [] }; }
  finally { if (directory) directory.closeSync(); }
  return { available: true, complete: !limited && !unreadable, limited, unreadable, items: items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || a.id.localeCompare(b.id)) };
}

function readArgonRecords({ root }) {
  let mappings;
  try { mappings = readJson(root, 'tools/argon-schedules/configuration/docs.json', 5000); }
  catch { return { available: false, remoteVerified: false, items: [] }; }
  let proof = null;
  try { proof = readJson(root, 'tools/argon-schedules/verification/20261018.json', 100_000).firstProduction; } catch {}
  const items = [];
  for (const [role, title] of Object.entries(ROLES)) {
    const documentId = typeof mappings[role] === 'string' && /^[A-Za-z0-9_-]{15,100}$/.test(mappings[role]) ? mappings[role] : null;
    if (!documentId) continue;
    const verified = proof?.role === role && proof?.status === 'verified'
      && proof.expectedDocumentId === documentId && proof.acceptance?.scheduledRunObserved === true
      && proof.acceptance?.argonExecutionVerified === true && proof.acceptance?.docsReadbackVerified === true
      && proof.acceptance?.newDocsSaveVerified === true && proof.runState?.status === 'complete' && iso(proof.checkedAt)
      && /^[a-f0-9]{64}$/.test(proof.docs?.sha256 || '') && proof.docs.sha256 === proof.runState?.sha256;
    items.push({ role, title, url: 'https://docs.google.com/document/d/' + documentId + '/edit',
      storedVerified: verified, storedVerifiedAt: verified ? iso(proof.checkedAt) : null,
      completedAt: verified ? iso(proof.runState.completedAt) : null,
      revisionFingerprint: verified ? proof.docs.sha256 : null,
    });
  }
  return { available: items.length > 0, complete: items.length === 4, remoteVerified: false, items,
    coverage: '기존 결과 문서 링크와 저장된 검증 기록만 · 원격 현재 실행·최신 본문·회사 가져오기 상태 미조회' };
}

function sanitizeArgon(payload) {
  if (!payload || !Array.isArray(payload.roles) || payload.roles.length !== 4) throw new Error('ARGON_SHAPE');
  const seen = new Set();
  const roles = payload.roles.map(row => {
    if (!row || !Object.hasOwn(ROLES, row.role) || seen.has(row.role)) throw new Error('ARGON_SHAPE');
    seen.add(row.role);
    return { role: row.role, status: ['running', 'complete', 'no-change', 'failed', 'missing'].includes(row.status) ? row.status : 'unknown',
      startedAt: iso(row.startedAt), completedAt: iso(row.completedAt), modelMatches: row.modelMatches === true,
      documentId: /^[A-Za-z0-9_-]{15,100}$/.test(row.documentId || '') ? row.documentId : null,
      sha256: /^[a-f0-9]{64}$/.test(row.sha256 || '') ? row.sha256 : null,
      errorCode: /^[A-Z][A-Z0-9_]{0,99}$/.test(row.errorCode || '') ? row.errorCode : null,
      serviceState: ['active', 'activating', 'deactivating', 'inactive', 'failed'].includes(row.serviceState) ? row.serviceState : 'unknown',
      serviceResult: ['success', 'exit-code', 'timeout', 'signal', 'resources', 'dependency', 'start-limit-hit'].includes(row.serviceResult) ? row.serviceResult : 'unknown',
      exitCode: Number.isInteger(row.exitCode) ? row.exitCode : null,
      timerActive: row.timerActive === true, timerEnabled: row.timerEnabled === true,
    };
  });
  return roles.sort((a, b) => a.role.localeCompare(b.role));
}

async function refreshArgon({ root }) {
  // Reuse the canonical backup reader's pinned research-node identity and existing OAuth helper.
  // Only Compute metadata and these four run-status files/systemd properties are read.
  const { NODES } = require('../server-backup/read-status.cjs');
  const policy = require('../모델정책.js');
  const project = 'synk-bake-unmet27';
  const node = NODES.find(row => row.role === 'research');
  if (!node || policy.벌텍스프로젝트() !== project) throw new Error('ARGON_IDENTITY');
  const response = await fetch(`https://compute.googleapis.com/compute/v1/projects/${project}/zones/${node.zone}/instances/${node.name}`, {
    headers: { authorization: 'Bearer ' + await policy.벌텍스토큰() }, redirect: 'error', signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('ARGON_METADATA');
  const instance = await response.json();
  const nic = instance.networkInterfaces?.find(row => row.name === 'nic0');
  const address = nic?.accessConfigs?.[0]?.natIP;
  if (instance.id !== node.id || instance.name !== node.name || instance.status !== 'RUNNING' || nic?.networkIP !== node.privateIp
    || nic.accessConfigs?.length !== 1 || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address || '')) throw new Error('ARGON_IDENTITY');
  const known = path.join(os.tmpdir(), 'synk-argon-read-' + randomUUID());
  const source = String.raw`import json,pathlib,re,subprocess,datetime,urllib.request
ROOT=pathlib.Path('/var/lib/synk-argon-77yuhbs/run-status')
def meta(p):
 return urllib.request.urlopen(urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/'+p,headers={'Metadata-Flavor':'Google'}),timeout=3).read(200).decode()
def props(unit):
 try:
  p=subprocess.run(['/usr/bin/systemctl','show',unit,'-p','ActiveState','-p','UnitFileState','-p','Result','-p','ExecMainStatus'],capture_output=True,text=True,timeout=3)
  return dict(line.split('=',1) for line in p.stdout.splitlines() if '=' in line) if p.returncode==0 else {}
 except Exception:return {}
rows=[]
for role in ['full','yt-tt','meta-brand','synkbrief']:
 p=ROOT/(role+'.json');data={}
 try:
  if p.is_symlink() or not p.is_file() or p.stat().st_size>32000:raise ValueError()
  data=json.loads(p.read_text())
 except Exception:pass
 service=props('synk-argon-ultra-'+role+'.service');timer=props('synk-argon-ultra-'+role+'.timer')
 code=service.get('ExecMainStatus','')
 rows.append({'role':role,'status':data.get('status','missing'),'startedAt':data.get('startedAt'),'completedAt':data.get('completedAt'),
 'modelMatches':data.get('model')=='gemini-4-argon-high','documentId':data.get('documentId'),'sha256':data.get('sha256'),
 'errorCode':data.get('error') if re.fullmatch('[A-Z][A-Z0-9_]{0,99}',str(data.get('error',''))) else None,
 'serviceState':service.get('ActiveState'),'serviceResult':service.get('Result'),'exitCode':int(code) if re.fullmatch('[0-9]{1,5}',code) else None,
 'timerActive':timer.get('ActiveState')=='active','timerEnabled':timer.get('UnitFileState')=='enabled'})
print(json.dumps({'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'instanceId':meta('instance/id'),'project':meta('project/project-id'),'roles':rows}))
`;
  try {
    fs.writeFileSync(known, node.alias + ' ' + node.hostKey + '\n', { flag: 'wx', mode: 0o600 });
    const result = await new Promise((resolve, reject) => {
      const child = execFile('ssh', ['-i', path.join(os.homedir(), '.ssh', node.key), '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'UserKnownHostsFile=' + known.replaceAll('\\', '/'), '-o', 'HostKeyAlias=' + node.alias, '-o', 'CheckHostIP=no', '-o', 'ConnectTimeout=8',
        'synk@' + address, 'sudo -n python3 -'], { shell: false, windowsHide: true, timeout: 22_000, maxBuffer: 50_000, encoding: 'utf8' },
      (error, stdout) => error ? reject(error) : resolve(stdout));
      child.stdin.end(source);
    });
    const payload = JSON.parse(result);
    if (payload.instanceId !== node.id || payload.project !== project) throw new Error('ARGON_IDENTITY');
    return { roles: sanitizeArgon(payload) };
  } finally { try { fs.unlinkSync(known); } catch {} }
}

async function researchSnapshot({ root, hermesHome, now, remoteRefresh, readArgon, readArgonRemote }) {
  const base = await (readArgon || readArgonRecords)({ root, now });
  let cached = null;
  try {
    const record = readJson(hermesHome, ARGON_CACHE, 30_000);
    if (record.version === 1 && iso(record.checkedAt)) cached = { checkedAt: iso(record.checkedAt), roles: sanitizeArgon(record) };
  } catch {}
  let refreshFailed = false;
  if (remoteRefresh) {
    try {
      cached = { checkedAt: now.toISOString(), roles: sanitizeArgon(await (readArgonRemote || refreshArgon)({ root, hermesHome, now })) };
      try { saveCache(hermesHome, 'argon-cache.json', cached); } catch {}
    } catch { refreshFailed = true; }
  }
  const age = cached ? now.getTime() - Date.parse(cached.checkedAt) : null;
  const available = !!cached && age >= -60_000;
  const stale = !available || refreshFailed || age > ARGON_TTL_MS;
  return { ...base, remoteStatusAvailable: available, remoteCheckedAt: available ? cached.checkedAt : null, stale, refreshFailed,
    items: base.items.map(row => {
      const current = available ? cached.roles.find(current => current.role === row.role) : null;
      if (!current) return { ...row, current: null };
      const { documentId, ...publicCurrent } = current;
      return { ...row, current: { ...publicCurrent, documentMatches: row.url === 'https://docs.google.com/document/d/' + documentId + '/edit' } };
    }),
    coverage: available ? '고정 서버 4역할의 후처리 영수증·systemd 상태 조회 사본 · Docs 본문·인증값·실행 로그 미조회' : base.coverage,
  };
}

function stage(value) {
  if (String(value).startsWith('적용함')) return 'applied';
  if (['새로', '적용 중', '적용중'].includes(value)) return 'pending';
  if (['버림', '안 맞음'].includes(value)) return 'discarded';
  return 'unknown';
}

function reconcileTips(cards, ledger) {
  const items = cards.items.map(card => {
    const byPost = card.postId ? ledger.rows.find(row => row.postId === card.postId) : null;
    const byRow = card.ledgerRow ? ledger.rows.find(row => row.row === card.ledgerRow && (!card.postId || !row.postId || card.postId === row.postId)) : null;
    const sheet = byPost || byRow;
    return { ...card, ledgerStatus: sheet?.status ?? null, ledgerRow: sheet?.row ?? card.ledgerRow ?? null,
      mismatch: !!sheet && stage(card.status) !== stage(sheet.status), effectiveStatus: card.status, statusSource: '카드 원문',
    };
  });
  const counts = { applied: 0, pending: 0, unknown: 0, discarded: 0, mismatch: 0 };
  for (const card of items) { counts[stage(card.status)]++; if (card.mismatch) counts.mismatch++; }
  return { available: cards.available, complete: cards.complete, counts, items,
    coverage: '적용상태는 카드 원문 우선 · 장부·카드 기록은 실제 배포·사용자 효과 검증과 구분' };
}

function buildEvents({ track, tips, ledger, tasks, research, runtimes, now }) {
  const events = [];
  if (!track.available || !track.complete) events.push(event('coverage-track', 'coverage', 'warning', '트랙 조회 범위 미완전', '읽지 못한 기록을 삭제·완료로 판정하지 않습니다.'));
  for (const row of track.items) events.push(event(row.id, 'track', 'info', row.title, row.summary, { text: row.fingerprint }));
  if (!tips.available || !tips.complete) events.push(event('coverage-tips', 'coverage', 'warning', '카드 조회 범위 미완전', '카드가 없는 것과 읽지 못한 것을 구분합니다.'));
  for (const card of tips.items) events.push(event(card.id, stage(card.status) === 'applied' ? 'completion' : 'tip', 'info', card.title,
    `카드: ${card.status} · ${card.when}${card.mismatch ? ' · 장부: ' + card.ledgerStatus + '와 다름(카드 우선)' : ''}`,
    { content: card.fingerprint, ledgerStatus: card.ledgerStatus, mismatch: card.mismatch }));
  if (!ledger.available || ledger.stale) events.push(event('coverage-ledger', 'coverage', 'info', !ledger.available ? '팁 장부 원격 상태 미확인' : '팁 장부 조회 사본이 오래됨', '카드 원문은 별도로 조회했습니다. 수동 또는 일일 조회로 장부를 갱신할 수 있습니다.', { available: ledger.available, stale: ledger.stale }));
  if (!tasks.available || !tasks.complete) events.push(event('coverage-tasks', 'coverage', 'warning', '휴대폰 작업 기록 일부 미확인', '현재 기록을 안전하게 읽지 못했습니다. 자동 재실행하지 않습니다.'));
  for (const task of tasks.items) {
    const failed = task.state === 'launch_failed' || task.quotaLimited || task.nativeError || task.state === 'exited' && task.exitCode !== null && task.exitCode !== 0;
    const uncertain = task.state === 'unknown' || task.state === 'exited' && task.exitCode === null || task.deliveryStatus === 'unconfirmed';
    const closed = task.state === 'closed_by_user';
    // The plugin owns this result's one delivery attempt, including the gap
    // between request update, claim reservation and transport acknowledgement.
    const pluginOwnsNotification = task.directDelivery && task.notificationPolicy === NOTIFICATION_POLICY;
    const title = `${task.engine === 'claude' ? 'Claude' : 'Codex'} ${task.id}`;
    const label = closed ? '사용자 종료 확인 · 목표 완료 미판정' : task.state === 'finalizing' ? '공식 실행 종료 후 검증·통합 처리 중' : task.state === 'exited' ? failed ? '실행 종료 · 오류/한도' : task.exitCode === null ? '실행 종료 · 종료코드 미확인' : '실행 종료 · 결과 기록 있음'
      : task.state === 'running' ? '실행 기록 있음 · 실시간 생존 미조회' : task.state === 'preparing' ? '격리 작업본 준비 기록' : task.state === 'launching' ? '접수 중 기록' : task.state === 'launch_failed' ? '시작 실패' : '실행 상태 미확인';
    const delivery = task.deliveryStatus === 'suppressed_success' ? '정상 결과 보관 · 알림 생략(조회 가능)' : task.deliveryStatus === 'sent' ? '결과 Telegram API 수신 확인 · 열람 미확인' : task.deliveryStatus === 'waiting' ? '알림 처리 기록 대기'
      : task.deliveryStatus === 'not_recorded' ? '전달 영수증 없음 · 이전 전달 여부 미확인' : '결과 전달 미확인 · 자동 재전송 안 함';
    const integration = task.integration === 'integrated' ? ' · 검증 후 원본 통합 완료' : task.integration === 'no_changes' ? ' · 검증 결과 원본 변경 없음'
      : task.needsAttention ? ' · 검증·통합에 사용자 판단 필요' + (task.integrationReceipt?.reasonCode || task.validationReceipt?.reasonCode ? ' · ' + (task.integrationReceipt?.reasonCode || task.validationReceipt?.reasonCode) : '')
      : task.integrationPolicy === INTEGRATION_POLICY ? ' · 원본 자동 통합 영수증 대기' : task.integration === 'not_merged' ? ' · 원본에 미통합' : ' · 목표 달성은 결과 확인 필요';
    const taskEvent = event('task-' + task.id, 'task', closed ? 'info' : failed ? 'error' : uncertain || task.needsAttention ? 'warning' : 'info', title,
      label + ' · ' + delivery + (task.quotaLimited ? ' · 구독 사용량 한도' : '') + (task.resultAvailable ? ' · PC 결과 파일 있음' : '') + integration,
      { state: task.state, exitCode: task.exitCode, deliveryStatus: task.deliveryStatus, quotaLimited: task.quotaLimited, nativeError: task.nativeError, finalFound: task.finalFound,
        resultAvailable: task.resultAvailable, integration: task.integration, integrationReceipt: task.integrationReceipt, validationReceipt: task.validationReceipt,
        finalizationState: task.finalizationState, notificationPolicy: task.notificationPolicy });
    taskEvent.needs_attention = !closed && (task.needsAttention || uncertain || failed && (task.directDelivery || task.notificationPolicy === NOTIFICATION_POLICY));
    taskEvent.attention_fingerprint = hash({ id:taskEvent.id, failed, uncertain, quota:task.quotaLimited,
      integrationReason:task.integrationReceipt?.reasonCode, validationReason:task.validationReceipt?.reasonCode, finalization:task.finalizationState, needsAttention:task.needsAttention });
    taskEvent.notify = !pluginOwnsNotification && !['sent', 'suppressed_success'].includes(task.deliveryStatus) && task.state !== 'launch_failed' && !closed
      && !(task.state === 'exited' && !task.directDelivery && task.notificationPolicy !== NOTIFICATION_POLICY);
    events.push(taskEvent);
    if (task.attention && !closed) {
      const approval = event('approval-' + task.id, 'approval', 'warning', '사용자 판단 대기 · ' + task.id, task.attention.summary);
      approval.needs_attention = true;
      approval.notify = !pluginOwnsNotification && task.deliveryStatus !== 'sent';
      events.push(approval);
    }
    if (task.dueAt && !closed && !['integrated', 'no_changes'].includes(task.integration)) {
      const dueState = Date.parse(task.dueAt) <= now.getTime() ? 'overdue' : Date.parse(task.dueAt) - now.getTime() <= 24 * 60 * 60_000 ? 'due_today' : 'upcoming';
      const due = event('due-' + task.id, 'deadline', dueState === 'overdue' ? 'warning' : 'info', (dueState === 'overdue' ? '기한 경과 · ' : '명시한 기한 · ') + task.id,
        `사용자가 지정한 기한 ${formatTime(task.dueAt)} · 목표 완료 여부는 별도 확인`, { dueAt: task.dueAt, dueState });
      due.needs_attention = dueState === 'overdue';
      events.push(due);
    }
  }
  if (!research.available) events.push(event('coverage-research', 'coverage', 'info', '조사 결과 연결 미확인', '기존 문서 매핑을 읽지 못했습니다. 새 문서를 만들지 않습니다.'));
  for (const row of research.items) {
    let detail = row.storedVerified ? `저장된 검증: ${formatTime(row.storedVerifiedAt)} · 당시 Argon 실행·Docs 새 저장 대조 · 현재 원격 상태 미확인`
      : '기존 결과 문서 링크 있음 · 현재 실행·새 저장 여부 미확인';
    let severity = 'info';
    const current = row.current;
    if (current) {
      const failed = current.status === 'failed' || current.serviceState === 'failed' || ['exit-code', 'timeout', 'signal'].includes(current.serviceResult);
      const consistent = ['complete', 'no-change'].includes(current.status) && current.modelMatches && current.documentMatches && current.sha256;
      severity = failed ? 'error' : (!current.timerActive || !current.timerEnabled || ['complete', 'no-change'].includes(current.status) && !consistent) ? 'warning' : 'info';
      const label = { running: '조사 실행 기록', complete: '서버 후처리 완료 영수증', 'no-change': '서버 후처리 변경 없음 영수증', failed: '서버 후처리 실패', missing: '저장된 실행 영수증 없음', unknown: '실행 기록 미확인' }[current.status];
      detail = `${label} · ${formatTime(current.completedAt || current.startedAt)}${research.stale ? ' · 조회 사본 오래됨/연결 미확인' : ''}`
        + (consistent ? ' · 기록상 모델·문서 일치' : '') + (current.errorCode ? ' · ' + current.errorCode : '')
        + ' · Docs 본문 재검증·회사 가져오기 미조회';
    }
    const researchEvent = event('research-' + row.role, 'research', severity, row.title + ' · 기존 결과', detail,
      { url: row.url, storedVerified: row.storedVerified, revisionFingerprint: row.revisionFingerprint, current, stale: current ? research.stale : true });
    researchEvent.needs_attention = !!current && ['error','warning'].includes(severity);
    researchEvent.attention_fingerprint = hash({ role:row.role,status:current?.status,error:current?.errorCode,
      timerActive:current?.timerActive,timerEnabled:current?.timerEnabled,model:current?.modelMatches,document:current?.documentMatches });
    events.push(researchEvent);
  }
  for (const runtime of runtimes) events.push(event('runtime-' + runtime.source, 'runtime', 'info', runtime.source + ' 작업 조회', runtime.note,
    { connected: runtime.connected, stale: runtime.stale }));
  return events.sort((a, b) => a.id.localeCompare(b.id));
}

function formatTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '미확인';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) + ' KST';
}

function formatOverview(report) {
  const { snapshot, events } = report;
  const tips = snapshot.tips;
  const lines = [`SYNK 오늘 확인 · ${formatTime(report.checkedAt)}`, '', '자료 → 적용'];
  lines.push(tips.available ? `- 카드 ${tips.items.length}장 · 적용함 ${tips.counts.applied} · 대기 ${tips.counts.pending}${tips.counts.mismatch ? ' · 장부와 상태 다름 ' + tips.counts.mismatch : ''}` : '- 카드 상태 미확인');
  lines.push('- 적용 상태는 카드 원문을 우선합니다. 실제 배포 완료와는 구분합니다.');
  lines.push(`- 장부 기준 ${formatTime(snapshot.ledger.checkedAt)}${snapshot.ledger.stale ? ' · 오래됨/연결 미확인' : ' · 마지막 성공 조회 사본'}`);
  lines.push(snapshot.research.remoteStatusAvailable ? `- 조사 서버 조회 ${formatTime(snapshot.research.remoteCheckedAt)}${snapshot.research.stale ? ' · 오래됨/연결 미확인' : ' · 저장된 영수증 기준'}` : '- 조사는 기존 결과를 재사용합니다(현재 원격 상태 미확인).');
  for (const row of snapshot.research.items) lines.push(`  ${row.title}${row.current ? ' · ' + ({ running: '실행 기록', complete: '후처리 완료 기록', 'no-change': '변경 없음 기록', failed: '실패 기록', missing: '실행기록 없음', unknown: '미확인' }[row.current.status]) : ''}: ${row.url}`);
  lines.push('', '요청 → 완료');
  if (!snapshot.tasks.available) lines.push('- 맡긴 작업 기록 미확인');
  else if (!snapshot.tasks.items.length) lines.push('- 이 연결에서 맡긴 작업 기록 없음');
  const taskEvents = events.filter(row => ['task', 'approval', 'deadline'].includes(row.kind));
  const priority = { error: 0, warning: 1, info: 2 };
  const selected = taskEvents.sort((a, b) => priority[a.severity] - priority[b.severity] || a.id.localeCompare(b.id)).slice(0, 6);
  for (const row of selected) lines.push(`- ${row.title}\n  ${row.detail}`);
  if (taskEvents.length > selected.length) lines.push(`- 그 밖에 ${taskEvents.length - selected.length}개 · /synk_tasks 로 확인`);
  lines.push('', '현재 확인');
  lines.push(`- 트랙 ${snapshot.track.items.length}개 기록${snapshot.track.complete ? '' : ' · 일부 미확인'} · 문서 날짜로 마감을 추정하지 않습니다.`);
  for (const row of events.filter(item => item.kind === 'coverage' && item.severity !== 'info').slice(0, 3)) lines.push('- ' + row.title);
  lines.push('- PC 앱의 모든 작업·실패를 감시하는 기능은 아닙니다.');
  lines.push('실행 종료·문서 기록·실제 목표 달성을 구분합니다.');
  let text = lines.join('\n');
  if (text.length > status.MAX_TEXT) text = text.slice(0, 3700).replace(/[\uD800-\uDBFF]$/, '') + '\n일부 생략 · /synk_status 검색어 또는 /synk_tasks 로 확인';
  return text;
}

async function readOverview({ root = ROOT, hermesHome = homeDefault(), now = new Date(), remoteRefresh = false,
  readStatus = status.readStatus, readLedger, readTasks = readTaskRecords, readArgon, readArgonRemote } = {}) {
  const clock = new Date(now);
  if (!Number.isFinite(clock.getTime())) throw new Error('INVALID_TIME');
  const invoke = operation => Promise.resolve().then(operation);
  const [sourceResult, ledgerResult, taskResult, researchResult] = await Promise.allSettled([
    invoke(() => readStatus({ root, now: clock })), invoke(() => ledgerSnapshot({ hermesHome, now: clock, remoteRefresh, readLedger })),
    invoke(() => readTasks({ root, hermesHome, now: clock })), invoke(() => researchSnapshot({ root, hermesHome, now: clock, remoteRefresh, readArgon, readArgonRemote })),
  ]);
  const source = sourceResult.status === 'fulfilled' ? sourceResult.value : {};
  const ledger = ledgerResult.status === 'fulfilled' ? ledgerResult.value : { available: false, stale: true, checkedAt: null, rows: [] };
  const track = source.snapshot?.track || { available: false, complete: false, items: [] };
  const cards = source.snapshot?.cards || { available: false, complete: false, items: [] };
  const tips = reconcileTips(cards, ledger);
  const tasks = taskResult.status === 'fulfilled' ? taskResult.value : { available: false, complete: false, items: [] };
  const research = researchResult.status === 'fulfilled' ? researchResult.value : { available: false, remoteVerified: false, items: [] };
  const events = buildEvents({ track, tips, ledger, tasks, research, runtimes: source.runtimes || [], now: clock });
  const report = { version: 1, checkedAt: clock.toISOString(), notification_policy: NOTIFICATION_POLICY, integration_policy: INTEGRATION_POLICY,
    fingerprint: hash(events.map(row => [row.id, row.fingerprint, row.needs_attention])), events,
    snapshot: { track, tips, ledger, tasks, research },
    coverage: { trackComplete: track.available && track.complete, cardsComplete: cards.available && cards.complete,
      tasksComplete: tasks.available && tasks.complete, ledgerAvailable: ledger.available, ledgerStale: ledger.stale,
      ledgerComplete: ledger.available && !ledger.limited, researchComplete: research.available && research.complete === true,
      argonRemoteVerified: false, argonStatusAvailable: research.remoteStatusAvailable === true, argonStatusStale: research.stale !== false,
      desktopFailureCoverage: '이 연결의 공식 작업 영수증만 · 다른 데스크톱 작업 미감시',
      comparison: '미완전한 원문에서 사라진 항목은 삭제·완료로 판정하지 않음', noModelCalls: true, noRemoteWrites: true },
  };
  report.text = formatOverview(report);
  return report;
}

async function main(args = process.argv.slice(2)) {
  if (args.some(arg => !['--json', '--refresh'].includes(arg))) throw new Error('ARGS');
  const result = await readOverview({ remoteRefresh: args.includes('--refresh') });
  process.stdout.write((args.includes('--json') ? JSON.stringify(result) : result.text) + '\n');
}
if (require.main === module) main().catch(() => { process.stderr.write('SYNK 오늘 조회를 확인하지 못했습니다. 원문·PC 연결을 확인해 주세요.\n'); process.exitCode = 1; });

module.exports = { readOverview, formatOverview, sanitizeLedger, ledgerSnapshot, readLedgerCache, readTaskRecords, readArgonRecords, researchSnapshot, sanitizeArgon, refreshArgon, reconcileTips, buildEvents, LEDGER_TTL_MS, LEDGER_CACHE, ARGON_TTL_MS, ARGON_CACHE };
