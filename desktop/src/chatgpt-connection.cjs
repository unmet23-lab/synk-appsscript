'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {ID} = require('./site-visits.cjs');
const {ISSUER, registrationOf, discover, transaction, authorize, identify} = require('./chatgpt-identity.cjs');

const RECHECK_MS = 30 * 24 * 60 * 60 * 1000;
const sameLogin = (a, b) => !!a && !!b && a.owner === b.owner && a.generation === b.generation;
const reply = (res, code, message) => {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(code, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store',
    'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer',
    'X-Content-Type-Options':'nosniff','Connection':'close'});
  res.end(message);
};

function createChatGPTConnection({registration, userData, safeStorage, session, openExternal,
  fetcher = globalThis.fetch, changed = () => {}, now = Date.now, timeoutMs = 180000}) {
  const reg = registrationOf(registration);
  const directory = path.join(userData, 'ChatGPTConnection');
  let pending = null, problem = null, closed = false;
  function current() {
    const member = session();
    return !closed && typeof member?.owner === 'string' && ID.test(member.owner) && Number.isSafeInteger(member.generation) ? member : null;
  }
  function fileOf(owner) {
    const name = createHash('sha256').update(JSON.stringify([owner, ISSUER, reg.clientId])).digest('hex');
    return path.join(directory, name + '.enc');
  }
  function encryption() { return safeStorage?.isEncryptionAvailable() && safeStorage.getSelectedStorageBackend?.() !== 'basic_text'; }
  function read(owner) {
    if (!encryption()) throw new Error('STORAGE_UNAVAILABLE');
    const file = fileOf(owner);
    // Startup may follow a power loss between writing and renaming. The old record is authoritative.
    fs.rmSync(file + '.pending', {force:true});
    let stat;
    try { stat = fs.statSync(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    if (!stat.isFile()) throw new Error('STORAGE_INVALID');
    if (stat.size > 16384) return null;
    const encrypted = fs.readFileSync(file);
    let v;
    try { v = JSON.parse(safeStorage.decryptString(encrypted)); } catch { return null; }
    if (v?.version !== 1 || v.owner !== owner || v.issuer !== ISSUER || v.clientId !== reg.clientId ||
        typeof v.subject !== 'string' || !/^[\x21-\x7e]{1,255}$/.test(v.subject) ||
        !Number.isSafeInteger(v.verifiedAt) || v.verifiedAt <= 0) return null;
    return v;
  }
  function save(owner, subject) {
    const file = fileOf(owner), temporary = file + '.pending';
    const value = {version:1, owner, issuer:ISSUER, clientId:reg.clientId, subject, verifiedAt:now()};
    const encrypted = safeStorage.encryptString(JSON.stringify(value));
    fs.mkdirSync(directory, {recursive:true});
    try {
      fs.writeFileSync(temporary, encrypted, {mode:0o600, flag:'wx', flush:true});
      fs.renameSync(temporary, file);
    } finally { fs.rmSync(temporary, {force:true}); }
  }
  function status() {
    const member = current();
    // Identity confirmation never conveys a ChatGPT plan grant.
    const view = (state, extra = {}) => ({ok:true, state, planUse:false, ...extra});
    if (!member) return {ok:false, code:'SIGN_IN_REQUIRED'};
    if (!reg) return view('pending-approval');
    if (sameLogin(pending?.member, member)) return view('connecting');
    const error = sameLogin(problem?.member, member) ? {code:problem.code} : {};
    try {
      const v = read(member.owner);
      if (!v) return view('disconnected', error);
      const age = now() - v.verifiedAt;
      return view(age < 0 || age >= RECHECK_MS ? 'recheck' : 'connected', {...error, verifiedAt:v.verifiedAt});
    } catch { return view('storage-error', {code:'STORAGE_UNAVAILABLE'}); }
  }
  function active(flow) { return pending === flow && sameLogin(flow.member, current()) && !flow.abort.signal.aborted; }
  function release(flow, code) {
    if (pending !== flow) return;
    pending = null;
    problem = code ? {member:flow.member, code} : null;
    clearTimeout(flow.timer);
    flow.abort.abort();
    if (flow.server?.listening) flow.server.close();
    changed();
  }
  function expired(flow) { const age = now() - flow.started; return age < 0 || age >= timeoutMs; }
  async function callback(flow, req, res) {
    const deny = () => reply(res, 400, '솔리오에서 시작한 로그인 주소를 확인해 주세요.');
    if (active(flow) && expired(flow)) release(flow, 'TIMEOUT');
    if (!active(flow) || flow.consumed) return reply(res, 410, '로그인 시도가 끝났습니다. 솔리오에서 다시 시작해 주세요.');
    const route = reg.callback;
    if (req.method !== 'GET' || req.socket.remoteAddress !== '127.0.0.1' || req.headers.host !== route.host ||
        typeof req.url !== 'string' || req.url.length > 8192 || !req.url.startsWith(route.pathname + '?')) return deny();
    const u = new URL(req.url, route.origin), p = u.searchParams;
    if (u.hash || u.pathname !== route.pathname || p.getAll('state').length !== 1 || p.get('state') !== flow.tx.state ||
        (p.has('iss') && (p.getAll('iss').length !== 1 || p.get('iss') !== ISSUER)) ||
        p.getAll('code').length + p.getAll('error').length !== 1) return deny();
    const code = p.get('code');
    if (!p.has('error') && (!code || code.length > 4096)) return deny();
    flow.consumed = true;
    if (p.has('error')) {
      reply(res, 400, 'ChatGPT 연결을 마치지 않았습니다. 솔리오로 돌아가세요.');
      release(flow, p.get('error') === 'access_denied' ? 'CONSENT_DENIED' : 'SIGN_IN_FAILED'); return;
    }
    let failure = 'IDENTITY_INVALID';
    try {
      const subject = await identify({reg, endpoints:flow.endpoints, tx:flow.tx, code, fetcher, signal:flow.abort.signal, now});
      if (active(flow) && expired(flow)) release(flow, 'TIMEOUT');
      if (!active(flow)) return reply(res, 410, '로그인 시도가 끝났습니다.');
      failure = 'STORAGE_UNAVAILABLE';
      const old = read(flow.member.owner);
      if (old && old.subject !== subject) {
        failure = 'DIFFERENT_ACCOUNT';
        throw new Error(failure);
      }
      // No asynchronous step between checking the current owner and replacing the encrypted member file.
      save(flow.member.owner, subject);
      reply(res, 200, 'ChatGPT 계정을 확인했습니다. 솔리오로 돌아가세요.');
      release(flow);
    } catch (error) {
      reply(res, active(flow) ? 400 : 410, '연결을 마치지 못했습니다. 솔리오에서 상태를 확인해 주세요.');
      release(flow, error.code === 'OPENAI_NETWORK' ? 'NETWORK' : failure);
    }
  }
  async function connect() {
    accountChanged();
    const initial = status(), member = current();
    if (!member || !reg || !['disconnected','recheck'].includes(initial.state)) return initial;
    const flow = {member:{...member}, tx:transaction(), started:now(), consumed:false, abort:new AbortController()};
    pending = flow; problem = null;
    flow.timer = setTimeout(() => release(flow, 'TIMEOUT'), timeoutMs);
    flow.timer.unref?.();
    changed();
    let failure = 'NETWORK';
    try {
      flow.endpoints = await discover(fetcher, flow.abort.signal);
      if (!active(flow)) return {ok:false,code:'CANCELLED'};
      failure = 'CALLBACK_UNAVAILABLE';
      const server = http.createServer({maxHeaderSize:8192,requestTimeout:10000,headersTimeout:10000}, (req, res) => {
        callback(flow, req, res).catch(() => { reply(res, 400, '다시 로그인해 주세요.'); });
      });
      flow.server = server;
      await new Promise((resolve, reject) => {
        const abort = () => reject(new Error('CANCELLED'));
        flow.abort.signal.addEventListener('abort', abort, {once:true});
        server.once('error', reject);
        server.listen({port:Number(reg.callback.port), host:'127.0.0.1', exclusive:true, signal:flow.abort.signal}, () => {
          flow.abort.signal.removeEventListener('abort', abort);
          resolve();
        });
      });
      if (!active(flow)) return {ok:false,code:'CANCELLED'};
      failure = 'BROWSER_UNAVAILABLE';
      await openExternal(authorize(reg, flow.endpoints, flow.tx));
      return sameLogin(member, current()) ? status() : {ok:false,code:'CANCELLED'};
    } catch {
      if (!active(flow)) return {ok:false,code:'CANCELLED'};
      release(flow, failure);
      return {ok:false,code:failure};
    }
  }
  function cancel() {
    if (pending && sameLogin(pending.member, current())) release(pending);
    return status();
  }
  function disconnect() {
    const member = current();
    if (!member || !reg) return status();
    cancel(); problem = null;
    try {
      const file = fileOf(member.owner);
      fs.rmSync(file + '.pending', {force:true}); fs.rmSync(file, {force:true});
      changed(); return status();
    } catch { return {ok:false,code:'STORAGE_UNAVAILABLE'}; }
  }
  function accountChanged() {
    if (pending && !sameLogin(pending.member, current())) release(pending);
    if (problem && !sameLogin(problem.member, current())) problem = null;
  }
  function close() { closed = true; if (pending) release(pending); }
  return {status, connect, cancel, disconnect, accountChanged, close};
}
module.exports = {createChatGPTConnection};

