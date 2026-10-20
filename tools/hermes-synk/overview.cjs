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
// 회사 서버의 SNS 연결 기록은 세 시간에 한 번만 읽는다. 이틀 넘게 못 읽으면 그 사실을 알린다.
const SNS_CACHE = 'runtime/synk-overview/sns-cache.json';
const SNS_REFRESH_MS = 3 * 60 * 60_000;
const SNS_STALE_MS = 48 * 60 * 60_000;
const SNS_HEALTH_STALE_MS = 6 * 60 * 60_000;
const SNS_INBOX_STALE_MS = 12 * 60 * 60_000;
const SNS_LABEL = Object.freeze({ youtube: '유튜브', instagram: '인스타그램', facebook: '페이스북', other: '기타 SNS' });
// PC 백업 상태는 「SYNK 백업 상태 확인」 예약이 쓰는 파일을 읽기만 한다. 실패 표시는 다음 성공까지 이어 둔다.
const BACKUP_CACHE = 'runtime/synk-overview/backup-cache.json';
const BACKUP_STALE_MS = 2 * 60 * 60_000;
const BACKUP_GRACE_MS = Object.freeze({ onedrive: 2 * 60 * 60_000, github: 4 * 60 * 60_000 });
const BACKUP_STATUS = Object.freeze({ healthy: '정상', running: '실행 중', attention: '주의', failed: '실패', unknown: '상태 미확인' });
const backupHealthDefault = () => process.env.SYNK_BACKUP_HEALTH || path.join(os.homedir(), 'Documents', 'SYNK_원본창고', 'backup-health.json');
// 헤르메스 복구 작업(runtime/recover-gateway.ps1)이 점검마다 남기는 기록을 읽기만 한다. 재시작 뒤에도 새 패키지를 못 쓰거나
// 바빠서 재시작을 30분 넘게 미룬 어긋남만 판단으로 올린다. 15분 넘게 새 기록이 없으면 절전·일시 중지일 수 있어 사건을 내지 않는다.
const GATEWAY_RECOVERY_STATUS = 'synk-gateway-recovery-status.json';
const GATEWAY_RECOVERY_STALE_MS = 15 * 60_000;
const GATEWAY_RECOVERY_LABEL = Object.freeze({ ok: '이상 없음', starting: '게이트웨이를 켜는 중', startFailed: '게이트웨이 켜기 실패 · 다음 점검에서 다시 켭니다',
  waiting: '새로 깔린 패키지를 반영하는 중', restarting: '다시 켜는 중', restartFailed: '다시 켜기 실패 · 다음 점검에서 다시 봅니다', recorded: '점검 기록 있음' });
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
  if (!['ledger-cache.json', 'argon-cache.json', 'sns-cache.json', 'backup-cache.json'].includes(name)) throw new Error('CACHE_NAME');
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

function readBackupHealth(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 200_000) throw new Error('BACKUP_HEALTH_SHAPE');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (raw?.schemaVersion !== 1 || !Array.isArray(raw.components) || raw.components.length > 20) throw new Error('BACKUP_HEALTH_SHAPE');
  const components = raw.components.map(row => ({
    id: /^[a-z][a-z0-9-]{0,30}$/.test(row?.id || '') ? row.id : null,
    label: status.plain(row?.label || row?.id || '', 40),
    status: Object.hasOwn(BACKUP_STATUS, row?.status) ? row.status : 'unknown',
    lastSuccessAt: iso(row?.lastSuccessAt),
    codes: Array.isArray(row?.codes) ? row.codes.filter(code => /^[A-Z][A-Z0-9_]{0,79}$/.test(code)).slice(0, 8).sort() : [],
  })).filter(row => row.id);
  return { checkedAt: iso(raw.checkedAt), components };
}

// 실패 표시는 그 구성 요소의 마지막 성공 시각이 바뀔 때까지 이어진다. 실패 → 다음 회차 「실행 중」으로
// 바뀌었다고 해결로 보지 않아야 같은 문제를 30분마다 다시 알리지 않는다. 표시는 감시 프로세스만 저장한다.
function backupSnapshot({ hermesHome, now, backupHealthFile, uptimeSeconds, persistState }) {
  let health;
  try { health = readBackupHealth(backupHealthFile || backupHealthDefault()); }
  catch { return { available: false, checkedAt: null, stale: true, monitorStale: false, components: [] }; }
  let previous = {};
  try {
    const record = readJson(hermesHome, BACKUP_CACHE, 20_000);
    if (record.version === 1 && record.failing && typeof record.failing === 'object') previous = record.failing;
  } catch {}
  const failing = {};
  const components = health.components.map(row => {
    const sticky = !!row.lastSuccessAt && previous[row.id] === row.lastSuccessAt && row.status !== 'healthy';
    const failed = ['failed', 'attention'].includes(row.status) || sticky;
    if (failed && row.lastSuccessAt) failing[row.id] = row.lastSuccessAt;
    const sinceSuccess = row.lastSuccessAt ? now.getTime() - Date.parse(row.lastSuccessAt) : null;
    return { ...row, failing: failed, attention: failed && (sinceSuccess === null || sinceSuccess > (BACKUP_GRACE_MS[row.id] || 0)) };
  });
  if (persistState && JSON.stringify(failing) !== JSON.stringify(previous)) {
    try { saveCache(hermesHome, 'backup-cache.json', { checkedAt: now.toISOString(), failing }); } catch {}
  }
  const age = health.checkedAt ? now.getTime() - Date.parse(health.checkedAt) : null;
  const stale = age === null || age > BACKUP_STALE_MS;
  // 켠 직후에는 상태 확인 예약이 아직 돌지 않았을 수 있어 30분은 기다린다.
  const uptime = Number.isFinite(uptimeSeconds) ? uptimeSeconds : os.uptime();
  return { available: true, checkedAt: health.checkedAt, stale, monitorStale: stale && uptime > 1800, components };
}

function gatewayRecoverySnapshot({ hermesHome, now }) {
  let raw;
  try { raw = readJson(hermesHome, GATEWAY_RECOVERY_STATUS, 4_000); } catch { return { available: false }; }
  const checkedAt = iso(raw?.checkedAt);
  if (raw?.schemaVersion !== 1 || !checkedAt || !Number.isSafeInteger(raw.code)) return { available: false };
  const age = now.getTime() - Date.parse(checkedAt);
  return { available: true, checkedAt, stale: age > GATEWAY_RECOVERY_STALE_MS || age < -60_000, code: raw.code, drift: raw.drift === true,
    selected: /^[a-f0-9]{32}$/.test(raw.selected || '') ? raw.selected : null, since: iso(raw.since) };
}

function sanitizeSns(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.appRunning !== 'boolean') throw new Error('SNS_SHAPE');
  const code = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(value) ? value : null;
  const platform = (value, allowed) => allowed.includes(value) ? value : 'other';
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const refs = value => Array.isArray(value) ? value.filter(ref => /^[a-f0-9]{12}$/.test(ref)).slice(0, 50).sort() : [];
  const list = value => Array.isArray(value) ? value : [];
  if (list(payload.connections).length > 40 || list(payload.inbox).length > 20) throw new Error('SNS_SHAPE');
  const jobs = payload.jobs && typeof payload.jobs === 'object' ? payload.jobs : {};
  return { appRunning: payload.appRunning,
    connections: list(payload.connections).map(row => ({ platform: platform(row?.platform, ['youtube', 'instagram', 'facebook']), state: code(row?.state),
      errorCode: code(row?.errorCode), checkedAt: iso(row?.checkedAt), requiresReconnect: row?.requiresReconnect === true, failureCode: code(row?.failureCode) })),
    inbox: list(payload.inbox).map(row => ({ platform: platform(row?.platform, ['instagram', 'facebook']), lastStatus: code(row?.lastStatus),
      lastErrorCode: code(row?.lastErrorCode), lastSyncedAt: iso(row?.lastSyncedAt) })),
    jobs: { total: count(jobs.total), overdue: count(jobs.overdue), overdueRefs: refs(jobs.overdueRefs), recentFailed: count(jobs.recentFailed), recentFailedRefs: refs(jobs.recentFailedRefs) },
  };
}

async function refreshSns() {
  // Argon 조회와 같은 고정 서버 신원·호스트 키·OAuth 도우미를 쓴다. 회사 DB를 읽기 전용으로 열고
  // 연결 상태·예약 게시·댓글 수집의 코드와 시각만 가져온다. 인증값을 풀거나 SNS API를 부르지 않는다.
  const { NODES } = require('../server-backup/read-status.cjs');
  const policy = require('../모델정책.js');
  const project = 'synk-bake-unmet27';
  const node = NODES.find(row => row.role === 'company');
  if (!node || policy.벌텍스프로젝트() !== project) throw new Error('SNS_IDENTITY');
  const response = await fetch(`https://compute.googleapis.com/compute/v1/projects/${project}/zones/${node.zone}/instances/${node.name}`, {
    headers: { authorization: 'Bearer ' + await policy.벌텍스토큰() }, redirect: 'error', signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('SNS_METADATA');
  const instance = await response.json();
  const nic = instance.networkInterfaces?.find(row => row.name === 'nic0');
  const address = nic?.accessConfigs?.[0]?.natIP;
  if (instance.id !== node.id || instance.name !== node.name || instance.status !== 'RUNNING' || nic?.networkIP !== node.privateIp
    || nic.accessConfigs?.length !== 1 || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address || '')) throw new Error('SNS_IDENTITY');
  const known = path.join(os.tmpdir(), 'synk-sns-read-' + randomUUID());
  const source = String.raw`import json,sqlite3,subprocess,datetime,hashlib,urllib.request
def meta(p):
 return urllib.request.urlopen(urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/'+p,headers={'Metadata-Flavor':'Google'}),timeout=3).read(200).decode()
def code(v):
 return v if isinstance(v,str) and 0<len(v)<=80 and all(c.isalnum() or c in '_.-' for c in v) else None
def when(v):
 try:
  d=datetime.datetime.fromisoformat(str(v).replace('Z','+00:00'))
  return d.astimezone(datetime.timezone.utc).isoformat().replace('+00:00','Z') if d.tzinfo else None
 except Exception:return None
now=datetime.datetime.now(datetime.timezone.utc)
def age(v):
 w=when(v)
 return (now-datetime.datetime.fromisoformat(w.replace('Z','+00:00'))).total_seconds() if w else None
ref=lambda v:hashlib.sha256(str(v).encode()).hexdigest()[:12]
out={'checkedAt':now.isoformat(),'instanceId':meta('instance/id'),'project':meta('project/project-id'),'appRunning':False}
try:
 info=json.loads(subprocess.run(['docker','inspect','synk-company-company-1'],capture_output=True,text=True,timeout=15).stdout or '[]')
except Exception:info=[]
app=info[0] if info else None
mount=next((m.get('Source') for m in (app or {}).get('Mounts',[]) if m.get('Destination')=='/data'),None)
if app and app.get('State',{}).get('Running') is True and mount:
 db=sqlite3.connect('file:'+mount+'/company.sqlite?mode=ro',uri=True,timeout=5)
 try:
  db.execute('PRAGMA query_only=ON');db.execute('BEGIN')
  def rows(kind):return [dict(json.loads(body),_id=key) for key,body in db.execute('SELECT id,body FROM documents WHERE kind=?',(kind,))]
  channels={r['_id']:r for r in rows('channels')};health={r['_id']:r for r in rows('socialDirectHealth')}
  conns=[]
  for link in rows('socialDirectConnections'):
   c=channels.get(link['_id'],{})
   if link.get('enabled') is not True or c.get('active') is False or c.get('hidden'):continue
   h=health.get(link['_id'],{})
   conns.append({'platform':c.get('platform'),'state':code(h.get('state')),'errorCode':code(h.get('errorCode')),'checkedAt':when(h.get('checkedAt')),'requiresReconnect':c.get('requiresReconnect') is True,'failureCode':code(c.get('failureCode'))})
  jobs=rows('socialPublishJobs')
  overdue=[j for j in jobs if j.get('status')=='scheduled' and not j.get('reviewWaiting') and (age(j.get('scheduledAt')) or -1)>600]
  failed=[j for j in jobs if j.get('status') in ('failed','missed','uncertain','unknown','expired') and (age(j.get('updatedAt')) if age(j.get('updatedAt')) is not None else 10**9)<7*86400]
  inbox=[]
  for c in rows('socialInboxConnections'):
   ch=channels.get(c['_id'],{})
   if ch.get('platform') not in ('instagram','facebook') or c.get('enabled') is not True:continue
   inbox.append({'platform':ch.get('platform'),'lastStatus':code(c.get('lastStatus')),'lastErrorCode':code(c.get('lastErrorCode')),'lastSyncedAt':when(c.get('lastSyncedAt'))})
  out.update({'appRunning':True,'connections':conns[:40],'inbox':inbox[:20],'jobs':{'total':len(jobs),'overdue':len(overdue),'overdueRefs':sorted(ref(j['_id']) for j in overdue)[:50],'recentFailed':len(failed),'recentFailedRefs':sorted(ref(j['_id']) for j in failed)[:50]}})
 finally:
  db.rollback();db.close()
print(json.dumps(out))
`;
  try {
    fs.writeFileSync(known, node.alias + ' ' + node.hostKey + '\n', { flag: 'wx', mode: 0o600 });
    const result = await new Promise((resolve, reject) => {
      const child = execFile('ssh', ['-i', path.join(os.homedir(), '.ssh', node.key), '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'UserKnownHostsFile=' + known.replaceAll('\\', '/'), '-o', 'HostKeyAlias=' + node.alias, '-o', 'CheckHostIP=no', '-o', 'ConnectTimeout=8',
        'synk@' + address, 'sudo -n python3 -'], { shell: false, windowsHide: true, timeout: 40_000, maxBuffer: 200_000, encoding: 'utf8' },
      (error, stdout) => error ? reject(error) : resolve(stdout));
      child.stdin.end(source);
    });
    const payload = JSON.parse(result);
    if (payload.instanceId !== node.id || payload.project !== project) throw new Error('SNS_IDENTITY');
    return sanitizeSns(payload);
  } finally { try { fs.unlinkSync(known); } catch {} }
}

async function snsSnapshot({ hermesHome, now, remoteRefresh, readSnsRemote }) {
  let cached = null;
  try {
    const record = readJson(hermesHome, SNS_CACHE, 60_000);
    if (record.version === 1 && iso(record.checkedAt)) cached = { checkedAt: iso(record.checkedAt), ...sanitizeSns(record) };
  } catch {}
  let refreshFailed = false;
  const due = !cached || now.getTime() - Date.parse(cached.checkedAt) >= SNS_REFRESH_MS;
  if (remoteRefresh && due) {
    try {
      cached = { checkedAt: now.toISOString(), ...sanitizeSns(await (readSnsRemote || refreshSns)({ hermesHome, now })) };
      try { saveCache(hermesHome, 'sns-cache.json', cached); } catch {}
    } catch { refreshFailed = true; }
  }
  const age = cached ? now.getTime() - Date.parse(cached.checkedAt) : null;
  const available = !!cached && age >= -60_000;
  return { available, checkedAt: available ? cached.checkedAt : null, refreshFailed, stale: !available || age > SNS_STALE_MS,
    appRunning: available ? cached.appRunning : null, connections: available ? cached.connections : [], inbox: available ? cached.inbox : [],
    jobs: available ? cached.jobs : null };
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

function attention(row, needed, content) {
  row.needs_attention = needed;
  row.attention_fingerprint = hash(content);
  return row;
}

function backupEvents(backup) {
  if (!backup) return [];
  if (!backup.available) return [event('coverage-backup', 'coverage', 'info', 'PC 백업 상태 기록 미확인', '백업 상태 파일을 읽지 못했습니다. 백업 실패로 단정하지 않습니다.')];
  const rows = [];
  if (backup.monitorStale) rows.push(attention(event('backup-monitor', 'backup', 'warning', 'PC 백업 상태 확인이 멈춤',
    `마지막 확인 ${formatTime(backup.checkedAt)} · Windows 예약 「SYNK 백업 상태 확인」이 돌고 있는지 봐 주세요.`, { stale: true }), true, { id: 'backup-monitor', stale: true }));
  for (const row of backup.components) {
    const detail = `${BACKUP_STATUS[row.status]} · 마지막 성공 ${formatTime(row.lastSuccessAt)}${row.codes.length ? ' · ' + row.codes.join(', ') : ''}`;
    rows.push(attention(event('backup-' + row.id, 'backup', row.attention ? 'error' : row.failing ? 'warning' : 'info', 'PC 백업 · ' + row.label, detail,
      { failing: row.failing, attention: row.attention, lastSuccessAt: row.lastSuccessAt, codes: row.codes }),
    row.attention, { id: row.id, lastSuccessAt: row.lastSuccessAt }));
  }
  return rows;
}

function gatewayRecoveryEvents(gateway) {
  // 오래된 기록은 해결로도 문제로도 보지 않는다. 사건을 빼면 감시는 이전 판단을 그대로 둔다.
  if (!gateway?.available || gateway.stale) return [];
  const content = { code: gateway.code, drift: gateway.drift, selected: gateway.selected };
  const incident = { id: 'gateway-recovery', code: gateway.code, selected: gateway.selected };
  if (gateway.drift && gateway.code === 4) return [attention(event('gateway-recovery', 'gateway', 'error', '헤르메스 게이트웨이 · 재시작 뒤에도 새 패키지를 못 씀',
    `자동 재시작을 한 번 시도했지만 새로 깔린 패키지를 아직 쓰지 못하고 있습니다 · 텔레그램 대화 일부가 실패할 수 있습니다 · 자동 재시작은 더 하지 않으니 PC에서 확인해 주세요 · 처음 확인 ${formatTime(gateway.since)}`,
    content), true, incident)];
  if (gateway.drift && gateway.code === 6) return [attention(event('gateway-recovery', 'gateway', 'warning', '헤르메스 게이트웨이 · 바빠서 재시작을 30분 넘게 미룸',
    `새로 깔린 패키지를 쓰려면 다시 켜야 하는데 처리 중인 일이 이어지고 있습니다 · 그동안 텔레그램 대화 일부가 실패할 수 있습니다 · 한가해지면 자동으로 한 번 다시 켭니다 · 처음 확인 ${formatTime(gateway.since)}`,
    content), true, incident)];
  const state = gateway.drift ? { 0: 'waiting', 3: 'restarting', 1: 'restartFailed' }[gateway.code] : { 0: 'ok', 3: 'starting', 1: 'startFailed' }[gateway.code];
  return [attention(event('gateway-recovery', 'gateway', 'info', '헤르메스 게이트웨이 복구 점검',
    `${GATEWAY_RECOVERY_LABEL[state || 'recorded']} · 마지막 점검 ${formatTime(gateway.checkedAt)}`, content), false, incident)];
}

function snsEvents(sns, now) {
  if (!sns) return [];
  const rows = [];
  if (!sns.available || sns.stale) rows.push(attention(event('coverage-sns', 'coverage', sns.available ? 'warning' : 'info',
    sns.available ? 'SNS 연결 상태 조회가 이틀 넘게 멈춤' : 'SNS 연결 상태 미확인',
    `마지막 조회 ${formatTime(sns.checkedAt)} · 회사 서버를 읽지 못한 것을 연결 끊김으로 단정하지 않습니다.`, { available: sns.available, stale: sns.stale }),
  sns.available && sns.stale && sns.refreshFailed, { id: 'coverage-sns', stale: true }));
  if (!sns.available) return rows;
  if (sns.appRunning === false) rows.push(attention(event('sns-app', 'sns', 'warning', '회사 앱이 1번 서버에서 돌지 않음',
    '장애 전환으로 2번 서버가 맡았을 수 있습니다. SNS 상태는 1번 서버에서만 읽습니다.', { appRunning: false }), true, { id: 'sns-app', appRunning: false }));
  const seen = {};
  const age = value => value ? now.getTime() - Date.parse(value) : null;
  for (const row of sns.connections) {
    seen[row.platform] = (seen[row.platform] || 0) + 1;
    const id = 'sns-connection-' + row.platform + (seen[row.platform] > 1 ? '-' + seen[row.platform] : '');
    const broken = row.state !== 'connected' || !!row.errorCode || row.requiresReconnect || !!row.failureCode;
    const healthStale = !broken && (age(row.checkedAt) === null || age(row.checkedAt) > SNS_HEALTH_STALE_MS);
    const detail = broken ? `재연결이 필요하거나 오류가 있습니다${row.errorCode ? ' · ' + row.errorCode : ''}${row.failureCode ? ' · ' + row.failureCode : ''} · 작업실 「계정 연결」에서 확인`
      : healthStale ? `서버의 연결 점검이 ${formatTime(row.checkedAt)} 뒤로 없습니다` : `정상 · 서버 점검 ${formatTime(row.checkedAt)}`;
    rows.push(attention(event(id, 'sns', broken ? 'error' : healthStale ? 'warning' : 'info', SNS_LABEL[row.platform] + ' 게시 연결', detail,
      { state: row.state, errorCode: row.errorCode, requiresReconnect: row.requiresReconnect, failureCode: row.failureCode, healthStale }),
    broken || healthStale, { id, state: row.state, errorCode: row.errorCode, requiresReconnect: row.requiresReconnect, failureCode: row.failureCode, healthStale }));
  }
  const seenInbox = {};
  for (const row of sns.inbox) {
    seenInbox[row.platform] = (seenInbox[row.platform] || 0) + 1;
    const id = 'sns-comments-' + row.platform + (seenInbox[row.platform] > 1 ? '-' + seenInbox[row.platform] : '');
    const syncStale = age(row.lastSyncedAt) === null || age(row.lastSyncedAt) > SNS_INBOX_STALE_MS;
    const detail = row.lastErrorCode ? `댓글 수집 오류 · ${row.lastErrorCode}` : syncStale ? `댓글 수집이 ${formatTime(row.lastSyncedAt)} 뒤로 없습니다` : `정상 · 마지막 수집 ${formatTime(row.lastSyncedAt)}`;
    rows.push(attention(event(id, 'sns', row.lastErrorCode ? 'error' : syncStale ? 'warning' : 'info', SNS_LABEL[row.platform] + ' 댓글 수집', detail,
      { lastErrorCode: row.lastErrorCode, syncStale }), !!row.lastErrorCode || syncStale, { id, lastErrorCode: row.lastErrorCode, syncStale }));
  }
  if (sns.jobs) {
    const bad = sns.jobs.overdue > 0 || sns.jobs.recentFailed > 0;
    rows.push(attention(event('sns-jobs', 'sns', bad ? 'error' : 'info', 'SNS 예약 게시',
      bad ? `예정 시각을 10분 넘긴 예약 ${sns.jobs.overdue}건 · 최근 7일 실패·결과 불명 ${sns.jobs.recentFailed}건 · 작업실 「게시」에서 확인` : `늦어진 예약 없음 · 전체 ${sns.jobs.total}건`,
      { overdueRefs: sns.jobs.overdueRefs, recentFailedRefs: sns.jobs.recentFailedRefs }),
    bad, { id: 'sns-jobs', overdueRefs: sns.jobs.overdueRefs, recentFailedRefs: sns.jobs.recentFailedRefs }));
  }
  return rows;
}

function buildEvents({ track, tips, ledger, tasks, research, runtimes, now, backup, sns, gateway }) {
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
  events.push(...backupEvents(backup), ...snsEvents(sns, now), ...gatewayRecoveryEvents(gateway));
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
  const backup = snapshot.backup;
  if (backup?.available) {
    const failing = backup.components.filter(row => row.attention);
    lines.push(`- PC 백업 ${backup.components.length}종${failing.length ? ' · 확인 필요 ' + failing.map(row => row.label).join(', ') : ' · 확인할 실패 없음'} · 기록 ${formatTime(backup.checkedAt)}`);
  } else if (backup) lines.push('- PC 백업 상태 기록 미확인');
  const sns = snapshot.sns;
  if (sns?.available) {
    const broken = events.filter(row => row.kind === 'sns' && row.needs_attention).length;
    lines.push(`- SNS 연결 ${sns.connections.length}개·댓글 수집 ${sns.inbox.length}개${broken ? ' · 확인 필요 ' + broken + '건' : ' · 이상 없음'} · 조회 ${formatTime(sns.checkedAt)}${sns.stale ? ' · 오래됨' : ''}`);
  } else if (sns) lines.push('- SNS 연결 상태 미확인(회사 서버 조회 전)');
  const gateway = snapshot.gateway;
  if (gateway?.available) {
    const row = events.find(item => item.id === 'gateway-recovery');
    lines.push(`- 헤르메스 게이트웨이 복구 점검 · ${gateway.stale ? '기록이 오래됨(절전·일시 중지일 수 있음)' : row?.needs_attention ? '확인 필요' : '확인할 문제 없음'} · 기록 ${formatTime(gateway.checkedAt)}`);
  }
  lines.push(`- 트랙 ${snapshot.track.items.length}개 기록${snapshot.track.complete ? '' : ' · 일부 미확인'} · 문서 날짜로 마감을 추정하지 않습니다.`);
  for (const row of events.filter(item => item.kind === 'coverage' && item.severity !== 'info').slice(0, 3)) lines.push('- ' + row.title);
  lines.push('- PC 앱의 모든 작업·실패를 감시하는 기능은 아닙니다.');
  lines.push('실행 종료·문서 기록·실제 목표 달성을 구분합니다.');
  let text = lines.join('\n');
  if (text.length > status.MAX_TEXT) text = text.slice(0, 3700).replace(/[\uD800-\uDBFF]$/, '') + '\n일부 생략 · /synk_status 검색어 또는 /synk_tasks 로 확인';
  return text;
}

async function readOverview({ root = ROOT, hermesHome = homeDefault(), now = new Date(), remoteRefresh = false,
  readStatus = status.readStatus, readLedger, readTasks = readTaskRecords, readArgon, readArgonRemote,
  readSnsRemote, backupHealthFile, uptimeSeconds, persistState = false } = {}) {
  const clock = new Date(now);
  if (!Number.isFinite(clock.getTime())) throw new Error('INVALID_TIME');
  const invoke = operation => Promise.resolve().then(operation);
  const [sourceResult, ledgerResult, taskResult, researchResult, backupResult, snsResult] = await Promise.allSettled([
    invoke(() => readStatus({ root, now: clock })), invoke(() => ledgerSnapshot({ hermesHome, now: clock, remoteRefresh, readLedger })),
    invoke(() => readTasks({ root, hermesHome, now: clock })), invoke(() => researchSnapshot({ root, hermesHome, now: clock, remoteRefresh, readArgon, readArgonRemote })),
    invoke(() => backupSnapshot({ hermesHome, now: clock, backupHealthFile, uptimeSeconds, persistState })),
    invoke(() => snsSnapshot({ hermesHome, now: clock, remoteRefresh, readSnsRemote })),
  ]);
  const backup = backupResult.status === 'fulfilled' ? backupResult.value : { available: false, checkedAt: null, stale: true, monitorStale: false, components: [] };
  const sns = snsResult.status === 'fulfilled' ? snsResult.value : { available: false, checkedAt: null, stale: true, refreshFailed: true, connections: [], inbox: [], jobs: null };
  const gateway = gatewayRecoverySnapshot({ hermesHome, now: clock });
  const source = sourceResult.status === 'fulfilled' ? sourceResult.value : {};
  const ledger = ledgerResult.status === 'fulfilled' ? ledgerResult.value : { available: false, stale: true, checkedAt: null, rows: [] };
  const track = source.snapshot?.track || { available: false, complete: false, items: [] };
  const cards = source.snapshot?.cards || { available: false, complete: false, items: [] };
  const tips = reconcileTips(cards, ledger);
  const tasks = taskResult.status === 'fulfilled' ? taskResult.value : { available: false, complete: false, items: [] };
  const research = researchResult.status === 'fulfilled' ? researchResult.value : { available: false, remoteVerified: false, items: [] };
  const events = buildEvents({ track, tips, ledger, tasks, research, runtimes: source.runtimes || [], now: clock, backup, sns, gateway });
  const report = { version: 1, checkedAt: clock.toISOString(), notification_policy: NOTIFICATION_POLICY, integration_policy: INTEGRATION_POLICY,
    fingerprint: hash(events.map(row => [row.id, row.fingerprint, row.needs_attention])), events,
    snapshot: { track, tips, ledger, tasks, research, backup, sns, gateway },
    coverage: { trackComplete: track.available && track.complete, cardsComplete: cards.available && cards.complete,
      tasksComplete: tasks.available && tasks.complete, ledgerAvailable: ledger.available, ledgerStale: ledger.stale,
      ledgerComplete: ledger.available && !ledger.limited, researchComplete: research.available && research.complete === true,
      argonRemoteVerified: false, argonStatusAvailable: research.remoteStatusAvailable === true, argonStatusStale: research.stale !== false,
      backupStatusAvailable: backup.available, snsStatusAvailable: sns.available, snsStatusStale: sns.stale !== false,
      gatewayRecoveryStatusAvailable: gateway.available,
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

module.exports = { readOverview, formatOverview, sanitizeLedger, ledgerSnapshot, readLedgerCache, readTaskRecords, readArgonRecords, researchSnapshot, sanitizeArgon, refreshArgon, reconcileTips, buildEvents,
  readBackupHealth, backupSnapshot, sanitizeSns, refreshSns, snsSnapshot, gatewayRecoverySnapshot,
  LEDGER_TTL_MS, LEDGER_CACHE, ARGON_TTL_MS, ARGON_CACHE, SNS_CACHE, SNS_REFRESH_MS, SNS_STALE_MS, BACKUP_CACHE, GATEWAY_RECOVERY_STATUS, GATEWAY_RECOVERY_STALE_MS };
