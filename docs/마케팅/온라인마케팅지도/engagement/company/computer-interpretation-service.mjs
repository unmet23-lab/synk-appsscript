// One product endpoint, one official provider request. The existing company
// session owns authorization; Core owns source/field validation and user review.
import { createHmac } from 'node:crypto';
import { hash } from './store.mjs';
import { buildComputerModelRequest, parseComputerModelResponse, COMPUTER_MODEL, computerRuntimeProof, computerAdapterStatus } from './computer-interpretation-runtime.mjs';

const KIND = 'computerAIRequests';
const ENDPOINT = 'https://api.openai.com/v1/responses';
const MAX_RESPONSE_BYTES = 1024 * 1024;
const RETENTION_HOURS = 24, RETENTION_MS = RETENTION_HOURS * 60 * 60 * 1000;
const error = (message, status = 400, code = 'SYNK_COMPUTER_AI_INVALID') => Object.assign(new Error(message), { status, code });
const token = x => typeof x === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(x) && !['__proto__', 'constructor', 'prototype'].includes(x);
const integer = x => Number.isSafeInteger(x) && x >= 0;
const cost = (input, output, rates) => {
  const ceil = (n, rate) => (BigInt(n) * BigInt(rate) + 999999n) / 1000000n;
  const value = ceil(input, rates.inputRate) + ceil(output, rates.outputRate);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw error('사용량이 비용 계산 범위를 넘었습니다.', 502);
  return Number(value);
};

function configuration(env) {
  // The adapter is optional for the host: without it nothing can be built, parsed
  // or dispatched, while stored responses stay readable and deletable.
  if (!computerAdapterStatus().available) return { reason: 'adapter-unavailable', message: 'AI 상담 모듈을 불러오지 못했어요. 서버의 상담 원본 파일을 확인해야 해요.' };
  if (env('SYNK_COMPUTER_AI_ENABLED') !== '1') return { reason: 'disabled', message: '관리자가 AI 상담을 아직 켜지 않았어요.' };
  const number = name => { const value = env(name); return typeof value === 'string' && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null; };
  const config = {
    model: env('SYNK_COMPUTER_AI_MODEL'), key: env('OPENAI_API_KEY'),
    maxOutputTokens: number('SYNK_COMPUTER_AI_MAX_OUTPUT_TOKENS'),
    inputRate: number('SYNK_COMPUTER_AI_INPUT_PER_MILLION_MICRO_USD'),
    outputRate: number('SYNK_COMPUTER_AI_OUTPUT_PER_MILLION_MICRO_USD'),
    requestLimit: number('SYNK_COMPUTER_AI_REQUEST_LIMIT_MICRO_USD'),
    totalLimit: number('SYNK_COMPUTER_AI_TOTAL_LIMIT_MICRO_USD'),
  };
  if (config.model !== COMPUTER_MODEL || typeof config.key !== 'string' || !config.key.trim()
    || config.maxOutputTokens === null || config.maxOutputTokens < 512 || config.maxOutputTokens > 3000
    || config.inputRate === null || config.inputRate < 125000 || config.outputRate === null || config.outputRate < 500000
    || config.requestLimit === null || config.totalLimit === null) return { reason: 'configuration-required', message: 'AI 모델·키·비용 한도 설정을 확인해야 해요.' };
  return config;
}

function validate(input) {
  const keys = ['id', 'requestId', 'sourceId', 'revision', 'text'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key) && key !== 'expectedBuildId') || keys.some(key => !Object.hasOwn(input, key))
    || typeof input.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)
    || !token(input.requestId) || !token(input.sourceId) || !integer(input.revision)
    || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 4000
    || (Object.hasOwn(input, 'expectedBuildId') && (typeof input.expectedBuildId !== 'string' || !/^[0-9a-f]{64}$/i.test(input.expectedBuildId)))) throw error('상담 원문과 요청 번호를 확인해 주세요.');
  return { id: input.id.toLowerCase(), requestId: input.requestId, sourceId: input.sourceId, revision: input.revision, text: input.text,
    ...(Object.hasOwn(input, 'expectedBuildId') ? { expectedBuildId: input.expectedBuildId.toLowerCase() } : {}) };
}

async function responsePayload(response) {
  if (!response?.body?.getReader) throw error('AI 응답을 읽지 못했어요.', 502);
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw error('AI 응답이 허용 크기를 넘었어요.', 502);
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

function authenticationRejection(status, payload) {
  // Only a bounded, ordinary authentication/permission error envelope proves
  // this call was rejected before generation. Other responses remain uncertain.
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  const reason = payload?.error;
  return [401, 403].includes(status) && plain(payload) && Object.keys(payload).length === 1
    && plain(reason) && Object.keys(reason).every(key => ['message', 'type', 'code', 'param'].includes(key))
    && typeof reason.message === 'string'
    && ['invalid_request_error', 'authentication_error', 'permission_error'].includes(reason.type);
}

function invalidReason(cause, payload, model, usageOverrun) {
  if (usageOverrun) return 'usage-bound-exceeded';
  if (cause?.code === 'MODEL_RESPONSE_INVALID' && payload.model !== model) return 'model-mismatch';
  return ({ MODEL_REFUSED: 'model-refused', MODEL_RESPONSE_INCOMPLETE: 'model-response-incomplete',
    MODEL_QUOTE_INVALID: 'model-quote-invalid', MODEL_RESPONSE_INVALID: 'model-response-invalid' })[cause?.code] || 'model-response-invalid';
}

export function createComputerInterpretationService({ store, clock = () => new Date().toISOString(), getEnv = name => process.env[name], fetchImpl = globalThis.fetch, customerAuthorized = () => false }) {
  const running = new Set(); let stopping = false, expiryTimer = null;
  // The input fingerprint outlives response deletion and expiry. Key it with the
  // store secret so the ledger alone cannot confirm a guessed source sentence.
  const fingerprint = value => createHmac('sha256', store.key).update(value).digest('hex');
  const currentTime = () => {
    const at = clock(), ms = Date.parse(at);
    if (!Number.isFinite(ms)) throw error('서버의 보관 기준 시각을 확인해야 해요.', 503);
    return { at: new Date(ms).toISOString(), ms };
  };
  const active = user => {
    if (user?.kind === 'customer') {
      if (!customerAuthorized(user)) throw error('현재 로그인한 계정을 확인해 주세요.', 401, 'SYNK_COMPUTER_AI_FORBIDDEN');
      return user;
    }
    const current = user && store.get('users', user.id);
    if (!current?.active) throw error('현재 로그인한 계정을 확인해 주세요.', 401, 'SYNK_COMPUTER_AI_FORBIDDEN');
    return current;
  };
  const authorized = user => {
    const current = active(user);
    if (current.kind !== 'customer' && current.role !== 'admin') throw error('AI 상담 시험은 관리자 계정에서 이용할 수 있어요.', 403, 'SYNK_COMPUTER_AI_FORBIDDEN');
  };
  function customerLimits() {
    const positive = name => { const value = getEnv(name); return typeof value === 'string' && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null; };
    const requestLimit = positive('SYNK_COMPUTER_AI_CUSTOMER_DAILY_REQUESTS');
    const costLimitMicroUSD = positive('SYNK_COMPUTER_AI_CUSTOMER_DAILY_MICRO_USD');
    if (getEnv('SYNK_COMPUTER_AI_CUSTOMER_ENABLED') !== '1' || requestLimit === null || costLimitMicroUSD === null) return null;
    return { requestLimit, costLimitMicroUSD };
  }
  function customerUsage(user, limits) {
    const time = currentTime(), day = time.at.slice(0, 10);
    let requestsUsed = 0, accounted = 0n;
    for (const row of store.all(KIND)) {
      if (row.userId !== user.id) continue;
      const accepted = Date.parse(row.at);
      if (!Number.isFinite(accepted) || !integer(row.accountedMicroUSD)) throw error('개인별 사용량 기록을 확인해야 해요.', 503);
      if (new Date(accepted).toISOString().slice(0, 10) !== day) continue;
      if (row.status !== 'cancelled') requestsUsed++;
      accounted += BigInt(row.accountedMicroUSD);
    }
    // Keep reservations and deleted-response ledger rows: neither a restart nor
    // a privacy deletion grants more paid requests.
    return { day, ...limits, requestsUsed, requestsRemaining: Math.max(0, limits.requestLimit - requestsUsed),
      accountedMicroUSD: Number(accounted > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : accounted),
      remainingMicroUSD: Number(accounted >= BigInt(limits.costLimitMicroUSD) ? 0n : BigInt(limits.costLimitMicroUSD) - accounted),
      resetsAt: new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString() };
  }
  const removed = () => error('이 요청의 서버 응답 인용은 삭제되었거나 보관 기간이 끝났어요. 같은 요청을 다시 전송하지 않습니다.', 410, 'SYNK_COMPUTER_AI_RESPONSE_REMOVED');
  function withoutResponse(row, at, reason) {
    const { resultCiphertext: _ciphertext, ...retained } = row;
    return { ...retained, responseRemovedAt: row.responseRemovedAt || at, responseRemovalReason: row.responseRemovalReason || reason };
  }
  function retention(row, time) {
    // Legacy rows use their original acceptance time too. Never extend a lease
    // because a response arrived late, was replayed, or the process restarted.
    const accepted = Date.parse(row.at), deadline = accepted + RETENTION_MS;
    const valid = Number.isFinite(accepted) && Number.isFinite(deadline) && Math.abs(deadline) <= 8640000000000000;
    const expiresAt = valid ? new Date(deadline).toISOString() : null;
    const normalized = { ...row, expiresAt };
    return row.responseRemovedAt || !valid || time.ms >= deadline ? withoutResponse(normalized, time.at, 'expired') : normalized;
  }
  function armExpiry(rows) {
    clearTimeout(expiryTimer); expiryTimer = null;
    if (stopping) return;
    const deadlines = rows.filter(row => !row.responseRemovedAt).map(row => Date.parse(row.expiresAt)).filter(Number.isFinite);
    if (!deadlines.length) return;
    const earliest = deadlines.reduce((min, at) => Math.min(min, at), Infinity);
    const delay = Math.max(1, Math.min(2147483647, earliest - currentTime().ms));
    const clean = () => {
      expiryTimer = null;
      try { purgeExpired(); }
      catch { if (!stopping) { expiryTimer = setTimeout(clean, 60000); expiryTimer.unref?.(); } }
    };
    expiryTimer = setTimeout(clean, delay); expiryTimer.unref?.();
  }
  function purgeExpired() {
    const time = currentTime();
    const rows = store.transaction(() => store.all(KIND).map(row => {
      const next = retention(row, time);
      if (next.expiresAt !== row.expiresAt || next.responseRemovedAt !== row.responseRemovedAt || (Object.hasOwn(row, 'resultCiphertext') && !Object.hasOwn(next, 'resultCiphertext'))) store.put(KIND, row.id, next);
      return next;
    }));
    armExpiry(rows); return rows;
  }
  function privacySummary(user, rows) {
    const own = rows.filter(row => row.userId === user.id && !row.responseRemovedAt);
    const stored = own.filter(row => typeof row.resultCiphertext === 'string');
    const pending = own.filter(row => ['reserved', 'sent'].includes(row.status));
    const expiry = [...stored, ...pending].map(row => row.expiresAt).sort();
    return { retentionHours: RETENTION_HOURS, storedResponses: stored.length, pendingResponses: pending.length, canDelete: true, nextExpiryAt: expiry[0] || null };
  }
  function privacy(user) {
    active(user);
    return privacySummary(user, purgeExpired());
  }
  function removeResponses(user, input) {
    active(user);
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw error('본인의 서버 응답 인용만 삭제할 수 있어요.');
    purgeExpired();
    const time = currentTime(); let deletedResponses = 0, cancelledPendingResponses = 0;
    const rows = store.transaction(() => {
      active(user);
      return store.all(KIND).map(row => {
        if (row.userId !== user.id || row.responseRemovedAt) return row;
        if (typeof row.resultCiphertext === 'string') deletedResponses++;
        if (['reserved', 'sent'].includes(row.status)) cancelledPendingResponses++;
        // Tombstone every current request, including sent ones. A later provider
        // response still settles usage, but cannot store or deliver quotations.
        return store.put(KIND, row.id, withoutResponse(row, time.at, 'deleted'));
      });
    });
    armExpiry(rows);
    return { ...privacySummary(user, rows), deletedResponses, cancelledPendingResponses };
  }
  purgeExpired();
  // Includes unresolved reservations across process restarts. Never reset this
  // lifetime budget automatically, and never reclaim an uncertain dispatch.
  const spent = () => store.all(KIND).reduce((sum, row) => {
    if (!integer(row.accountedMicroUSD)) throw error('AI 비용 기록을 확인해야 해요.', 503);
    return sum + BigInt(row.accountedMicroUSD);
  }, 0n);
  const stoppedByUsage = () => store.all(KIND).some(row => row.usageOverrun === true);
  function state(user) {
    const base = { available: false, providerLabel: 'OpenAI', modelLabel: 'GPT-6 Luna', model: COMPUTER_MODEL, maxOutputTokens: null };
    // This status is reachable without a login. Decide who is asking before
    // opening the ledger's write transaction; the timer and authenticated
    // requests already enforce expiry.
    try { authorized(user); } catch { return { ...base, reason: user ? 'admin-required' : 'session-required', message: '회사 관리자 계정으로 로그인하면 AI 상담 설정을 확인할 수 있어요.' }; }
    purgeExpired();
    base.buildProof = computerRuntimeProof();
    if (user.kind === 'customer') {
      const limits = customerLimits();
      if (!limits) return { ...base, reason: 'customer-configuration-required', message: '고객용 AI 상담을 아직 준비하고 있어요. 직접 조건을 선택하고 저장할 수 있어요.' };
      base.usage = customerUsage(user, limits);
      if (!base.usage.requestsRemaining || !base.usage.remainingMicroUSD) return { ...base, reason: 'customer-daily-limit', message: '오늘의 AI 상담 사용 한도에 도달했어요. 저장된 조건은 계속 볼 수 있어요.' };
    }
    const config = configuration(getEnv);
    if (config.reason) return { ...base, reason: config.reason, message: config.message };
    const configured = { ...base, maxOutputTokens: config.maxOutputTokens };
    if (stopping) return { ...configured, reason: 'stopping', message: '서버를 종료하고 있어요.' };
    if (stoppedByUsage() || spent() >= BigInt(config.totalLimit)) return { ...configured, reason: 'budget-review-required', message: 'AI 상담 시험 비용 한도 또는 사용량 기록을 확인해야 해요.' };
    return { ...configured, available: true };
  }
  function replay(row, digest, expectedBuildId) {
    if (expectedBuildId && row.buildId !== expectedBuildId) throw error('이전 실행판의 요청 결과를 이번 평가에 사용할 수 없어요.', 409, 'SYNK_COMPUTER_AI_BUILD_MISMATCH');
    if (row.digest !== digest) throw error('같은 요청 번호에 다른 원문을 보낼 수 없어요.', 409, 'SYNK_COMPUTER_AI_CONFLICT');
    if (row.responseRemovedAt) throw removed();
    if (row.status === 'completed') return store.decrypt(row.resultCiphertext);
    if (row.status === 'invalid') throw invalidResult(row, 409);
    if (row.status === 'rejected') throw providerRejected(409);
    // A pending row may belong to another process, or be left by a crash.
    // Neither case permits another paid dispatch under the same request UUID.
    throw error('이 요청은 이미 접수됐습니다. 처리 또는 비용 확인이 필요해 자동 재시도하지 않아요.', 409, 'SYNK_COMPUTER_AI_ALREADY_SENT');
  }
  function providerRejected(status = 502) {
    return error('AI 제공자가 키 또는 권한을 거절했어요. 이 요청은 다시 전송하지 않습니다. 관리자 설정을 확인해 주세요.', status, 'SYNK_COMPUTER_AI_PROVIDER_REJECTED');
  }
  function invalidResult(row, status = 502) {
    // This receipt only reports a finished invalid attempt. It neither releases
    // accounted cost nor proves a pending/uncertain provider dispatch completed.
    return Object.assign(error('AI 조건이나 원문 인용을 검증하지 못했어요. 기존 선택은 유지됩니다.', status, 'SYNK_COMPUTER_AI_RESPONSE_INVALID'), {
      captureReceipt: { version: 1, id: row.requestUUID, requestId: row.requestId, revision: row.revision, buildId: row.buildId, status: 'invalid' },
    });
  }
  async function run(user, raw, revalidate) {
    if (stopping) throw error('서버가 종료 중입니다.', 503);
    authorized(user); revalidate();
    purgeExpired();
    const input = validate(raw), id = hash(`${user.id}:${input.id}`), digest = fingerprint(JSON.stringify(input)), proof = computerRuntimeProof();
    if (input.expectedBuildId && (!proof.runtimeAttested || proof.buildId !== input.expectedBuildId)) throw error('요청한 평가 실행판과 현재 서버가 일치하지 않아요.', 409, 'SYNK_COMPUTER_AI_BUILD_MISMATCH');
    const existing = store.get(KIND, id);
    if (existing) return replay(existing, digest, input.expectedBuildId);
    const config = configuration(getEnv);
    if (config.reason) throw error(config.message, 503, 'SYNK_COMPUTER_AI_UNAVAILABLE');
    const at = clock();
    const { body, context } = buildComputerModelRequest({ text: input.text, sourceId: input.sourceId, at,
      scope: { domain: 'SHIFT', workspace: 'computer-consultation', subject: user.id }, model: config.model, maxOutputTokens: config.maxOutputTokens });
    const serialized = JSON.stringify(body);
    // UTF-8 bytes upper-bound ordinary input tokenization; include the entire
    // request/schema and an explicit 4096-token protocol allowance. Actual usage
    // is still checked and any overrun stops subsequent requests.
    const inputBound = Buffer.byteLength(serialized, 'utf8') + 4096;
    const reserved = cost(inputBound, config.maxOutputTokens, config);
    if (reserved > config.requestLimit) throw error('이 원문의 예상 비용이 요청당 시험 한도를 넘어요.', 429, 'SYNK_COMPUTER_AI_BUDGET');
    const duplicate = store.transaction(() => {
      const row = store.get(KIND, id); if (row) return row;
      authorized(user); revalidate();
      if (user.kind === 'customer') {
        const limits = customerLimits();
        if (!limits) throw error('고객용 AI 상담을 아직 준비하고 있어요.', 503, 'SYNK_COMPUTER_AI_UNAVAILABLE');
        const usage = customerUsage(user, limits);
        if (!usage.requestsRemaining || reserved > usage.remainingMicroUSD) throw error('오늘의 AI 상담 사용 한도에 도달했어요.', 429, 'SYNK_COMPUTER_AI_CUSTOMER_LIMIT');
      }
      if (stoppedByUsage() || spent() + BigInt(reserved) > BigInt(config.totalLimit)) throw error('AI 상담 시험 비용 한도에 도달했어요.', 429, 'SYNK_COMPUTER_AI_BUDGET');
      store.put(KIND, id, { id, requestUUID: input.id, userId: user.id, digest, requestId: input.requestId, sourceId: input.sourceId, revision: input.revision,
        model: config.model, buildId: proof.buildId, at, expiresAt: new Date(Date.parse(at) + RETENTION_MS).toISOString(), status: 'reserved', inputBound, maxOutputTokens: config.maxOutputTokens, inputRate: config.inputRate, outputRate: config.outputRate,
        reservedMicroUSD: reserved, accountedMicroUSD: reserved });
      return null;
    });
    if (duplicate) return replay(duplicate, digest, input.expectedBuildId);
    const update = patch => {
      const time = currentTime();
      const row = store.transaction(() => store.put(KIND, id, retention({ ...store.get(KIND, id), ...patch, updatedAt: time.at }, time)));
      armExpiry(store.all(KIND)); return row;
    };
    try { authorized(user); revalidate(); }
    catch (cause) { update({ status: 'cancelled', accountedMicroUSD: 0 }); throw cause; }
    // Persist before starting I/O: a process death after this point remains held.
    if (update({ status: 'sent' }).responseRemovedAt) { update({ status: 'cancelled', accountedMicroUSD: 0 }); throw removed(); }
    let payload, rejectedStatus = null;
    try {
      const response = await fetchImpl(ENDPOINT, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45000),
        headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' }, body: serialized });
      if (!response.ok) {
        if ([401, 403].includes(response.status) && authenticationRejection(response.status, await responsePayload(response))) rejectedStatus = response.status;
        else { await response.body?.cancel().catch(() => {}); throw error('AI 제공자가 응답을 완료하지 않았어요.', 502); }
      } else payload = await responsePayload(response);
    } catch {
      if (update({ status: 'uncertain', failure: 'provider-response-unconfirmed' }).responseRemovedAt) throw removed();
      throw error('AI 응답을 확인하지 못했어요. 비용 예약을 유지하며 자동 재시도하지 않습니다.', 502, 'SYNK_COMPUTER_AI_UNCERTAIN');
    }
    if (rejectedStatus !== null) {
      if (update({ status: 'rejected', failure: 'provider-authentication-rejected', providerStatus: rejectedStatus, accountedMicroUSD: 0 }).responseRemovedAt) throw removed();
      authorized(user); revalidate(); throw providerRejected();
    }
    const usage = payload?.usage;
    if (!integer(usage?.input_tokens) || !integer(usage?.output_tokens) || !integer(usage?.total_tokens)
      || usage.total_tokens !== usage.input_tokens + usage.output_tokens || usage.input_tokens === 0) {
      if (update({ status: 'uncertain', failure: 'usage-unconfirmed' }).responseRemovedAt) throw removed();
      throw error('AI 사용량을 확인하지 못해 비용 예약을 유지합니다.', 502, 'SYNK_COMPUTER_AI_UNCERTAIN');
    }
    let charged;
    try { charged = cost(usage.input_tokens, usage.output_tokens, config); }
    catch { update({ status: 'uncertain', failure: 'usage-overflow', usageOverrun: true }); throw error('AI 사용량을 확인해야 해요.', 502); }
    const usageOverrun = usage.input_tokens > inputBound || usage.output_tokens > config.maxOutputTokens || charged > reserved;
    // Settle known provider usage even when the interpretation is invalid or the
    // session was revoked during the request. Never store raw provider text.
    if (update({ status: 'invalid', failure: 'response-validation-unfinished', accountedMicroUSD: charged, usage: { input: usage.input_tokens, output: usage.output_tokens }, usageOverrun }).responseRemovedAt) throw removed();
    let parsed;
    try { if (usageOverrun) throw error('usage bound exceeded'); parsed = parseComputerModelResponse(payload, context); }
    catch (cause) {
      const row = update({ failure: invalidReason(cause, payload, context.model, usageOverrun) });
      if (row.responseRemovedAt) throw removed();
      authorized(user); revalidate(); throw invalidResult(row);
    }
    const result = { requestId: input.requestId, revision: input.revision, buildId: proof.buildId, ...parsed };
    if (update({ status: 'completed', failure: null, resultCiphertext: store.encrypt(result) }).responseRemovedAt) throw removed();
    authorized(user); revalidate();
    return result;
  }
  function interpret(user, input, { revalidate = () => {} } = {}) {
    const task = run(user, input, revalidate); running.add(task);
    task.then(() => running.delete(task), () => running.delete(task));
    return task;
  }
  return { state, interpret, privacy, removeResponses, waitForIdle: () => Promise.allSettled([...running]), stop: async () => { stopping = true; clearTimeout(expiryTimer); expiryTimer = null; await Promise.allSettled([...running]); } };
}
