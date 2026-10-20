'use strict';

// Complete the existing, approved publication handoff. This module never posts
// content, changes approval, or implements a second DM sender.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const publisher = require('./sns-publisher.js');
const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}'
    : JSON.stringify(value);
const hash = value => crypto.createHash('sha256').update(stable(value)).digest('hex');
const pending = new Set(['awaiting_sync', 'pending_catchup', 'needs_reconciliation']);
const need = (ok, message) => { if (!ok) throw new Error(message); };

function createRegistration({ readHandoff, invoke, loadStatus, saveStatus, journalStage = () => null, clock = () => new Date().toISOString() }) {
  return { async run() {
    const handoff = readHandoff(), fingerprint = hash(handoff);
    const previous = loadStatus();
    need(!previous || previous.fingerprint === fingerprint, 'DM 등록 기록과 현재 승인·게시물이 다릅니다.');
    if (previous?.state === 'registered') return { ok: true, state: 'registered', routing_code: previous.routing_code, catchup_verified: true, reused: true };
    const save = result => {
      // Only fixed states and a routing code leave the private Talk journal.
      const value = { fingerprint, state: result.state, updatedAt: clock() };
      if (result.state === 'registered') value.routing_code = result.routing_code;
      saveStatus(value);
      return { ...result, automatic_retry: false };
    };
    const stage = journalStage();
    if (previous?.state === 'registering' || previous?.state === 'needs_reconciliation' || ['uploading', 'needs_reconciliation'].includes(stage)) {
      let proof;
      try { proof = await invoke({ apply: false }); } catch { return save({ ok: false, state: 'needs_reconciliation' }); }
      // A timeout/unknown write must never be replayed merely because the row is
      // absent. An exact registered row is checked by the existing Talk CLI.
      if (!(proof?.ok === true && proof.state === 'ready' && proof.registered === true)) {
        return save({ ok: false, state: 'needs_reconciliation' });
      }
    }
    need(hash(readHandoff()) === fingerprint, 'DM 등록을 준비하는 동안 승인·게시물이 바뀌었습니다.');
    saveStatus({ fingerprint, state: 'registering', updatedAt: clock() });
    let result;
    try { result = await invoke({ apply: true }); }
    catch { return save({ ok: false, state: 'needs_reconciliation' }); }
    if (result?.ok === true && result.state === 'registered' && result.catchup_verified === true && /^D\d{4,}$/.test(result.routing_code || '')) {
      return save({ ok: true, state: 'registered', routing_code: result.routing_code, catchup_verified: true });
    }
    return save({ ok: false, state: pending.has(result?.state) ? result.state : 'needs_reconciliation' });
  } };
}

function readJson(file, max = 32768) {
  const data = fs.readFileSync(file);
  need(data.length <= max, 'DM 등록 기록이 허용 크기를 넘었습니다.');
  return JSON.parse(data);
}
function writeJson(file, value) {
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  try { fs.renameSync(temp, file); } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function acquireLock(file) {
  let recovered=false;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const fd=fs.openSync(file,'wx',0o600),owner={pid:process.pid,startedAt:new Date().toISOString(),token:crypto.randomUUID()};
      fs.writeFileSync(fd,JSON.stringify(owner));return {fd,recovered,token:owner.token};
    }catch(error){
      if(error.code!=='EEXIST')throw error;
      // Missing/malformed/legacy owner metadata is not proof that a process
      // died. EPERM and a reused live PID also remain locked.
      try{
        const before=fs.statSync(file),bytes=fs.readFileSync(file);
        if(bytes.length>1024)return null;
        const owner=JSON.parse(bytes);
        if(!Number.isSafeInteger(owner.pid)||owner.pid<=0)return null;
        try{process.kill(owner.pid,0);return null;}catch(probe){if(probe.code!=='ESRCH')return null;}
        const after=fs.statSync(file);
        if(before.ino!==after.ino||before.birthtimeMs!==after.birthtimeMs||before.mtimeMs!==after.mtimeMs||!bytes.equals(fs.readFileSync(file)))return null;
        fs.unlinkSync(file);recovered=true;
      }catch{return null;}
    }
  }
  return null;
}
function releaseLock(file,lock){
  fs.closeSync(lock.fd);
  try{if(readJson(file,1024).token===lock.token)fs.unlinkSync(file);}catch{/* Never remove another process's lock. */}
}
function invokeTalk({ script, publisherRoot, planFile, itemId, registry, journal, live, node = process.execPath, spawnImpl = spawn, timeoutMs = 420000 }, { apply }) {
  const args = [script, '--publisher-root', publisherRoot, '--plan', planFile, '--item', itemId, '--registry', registry, '--journal', journal];
  if (live) args.push('--운영');
  if (apply) args.push('--apply');
  return new Promise((resolve, reject) => {
    const child = spawnImpl(node, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', oversized = false, timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stdout.on('data', data => {
      if (Buffer.byteLength(output) + data.length > 65536) { oversized = true; child.kill(); }
      else output += data.toString('utf8');
    });
    // The CLI may mention a project ID on stderr. Consume it without echoing
    // raw provider errors or credentials to the caller.
    child.stderr.on('data', () => {});
    child.once('error', () => { clearTimeout(timer); reject(new Error('DM 등록 도구를 실행하지 못했습니다.')); });
    child.once('close', code => {
      clearTimeout(timer);
      if (timedOut || oversized) return reject(new Error('DM 등록 결과를 확인해야 합니다.'));
      const lines = output.trim().split(/\r?\n/);
      let result;
      try { result = JSON.parse(lines.at(-1)); } catch { return reject(new Error('DM 등록 결과를 확인해야 합니다.')); }
      if (![0, 2].includes(code) || !result || typeof result !== 'object') return reject(new Error('DM 등록 결과를 확인해야 합니다.'));
      resolve(result);
    });
  });
}

async function registerPublication(planFile, itemId, options = {}) {
  need(path.isAbsolute(planFile), '게시 계획은 절대 경로로 지정해 주세요.');
  const publisherRoot = publisher.REPO_ROOT;
  const talkRoot = options.talkRoot || process.env.SYNK_TALK_ROOT || path.join(os.homedir(), 'Documents', 'SYNK-talk');
  const registry = options.registry || path.join(publisherRoot, 'tools', 'company-messenger', 'data', 'drive-storage.json');
  // Runtime receipts never belong in a public repository or the content bundle.
  const stateRoot = options.stateRoot || path.join(os.homedir(), 'SYNK_보안', 'sns-dm-publications');
  for (const value of [talkRoot, registry, stateRoot]) need(path.isAbsolute(value), 'DM 연결 경로는 절대 경로로 지정해 주세요.');
  const script = path.join(talkRoot, 'tools', 'synkbrief-publication.js');
  const readHandoff = options.readHandoff || (() => publisher.dmPublicationHandoff(planFile, itemId, options));
  const handoff = readHandoff(); // Verify approval and exact source bytes before creating any state.
  const key = hash({ planFile: path.resolve(planFile), itemId });
  fs.mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  const journal = path.join(stateRoot, key + '.journal.json'), status = path.join(stateRoot, key + '.status.json');
  const lock = path.join(stateRoot, key + '.lock');
  const ownedLock=acquireLock(lock);
  if(!ownedLock)return {ok:false,state:'registration_locked',automatic_retry:false,lockPath:lock};
  try {
    if(ownedLock.recovered){
      const previous=fs.existsSync(status)?readJson(status):null;
      if(previous?.state!=='registered')writeJson(status,{...previous,fingerprint:previous?.fingerprint||hash(handoff),
        state:'needs_reconciliation',updatedAt:new Date().toISOString()});
    }
    if (!options.invoke) {
      for (const file of [script, registry]) need(fs.existsSync(file) && fs.statSync(file).isFile(), '기존 Talk 등록 도구와 비공개 Google 연결을 확인해 주세요.');
    }
    const run = createRegistration({
      readHandoff: () => {
        const current = readHandoff();
        need(hash(current) === hash(handoff), 'DM 승인·게시물이 바뀌었습니다.');
        return current;
      },
      invoke: options.invoke || (input => invokeTalk({ script, publisherRoot, planFile, itemId, registry, journal, live: options.live !== false }, input)),
      loadStatus: () => fs.existsSync(status) ? readJson(status) : null,
      saveStatus: value => writeJson(status, value),
      journalStage: () => ownedLock.recovered ? 'needs_reconciliation' : fs.existsSync(journal) ? readJson(journal).stage : null,
    });
    return await run.run();
  } finally {
    releaseLock(lock,ownedLock);
  }
}

async function recordAndRegister(planFile, itemId, url, note, options = {}) {
  const receipt = publisher.recordInstagramPublication(planFile, itemId, url, note, options);
  // A registration failure must not turn a successful post into a failed post,
  // nor cause the publication command to create the post again.
  let registration;
  try { registration = await registerPublication(planFile, itemId, options); }
  catch { registration = { ok: false, state: 'registration_blocked', automatic_retry: false }; }
  return { recorded: true, resultFile: receipt.resultFile, state: receipt.item.state, dm: registration };
}

module.exports = { createRegistration, invokeTalk, registerPublication, recordAndRegister };
