'use strict';
// 계정 속성은 명시한 원장, 로그인은 관측, 게시·예약은 게시장부의 최종 줄을 쓴다.
// 이 모듈은 읽기만 한다. 접속·예약·게시·인증을 시도하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const { rowOf } = require('../게시장부.js');
const BUSINESSES = new Set(['LAB', 'SHIFT', 'PULSE', 'PATH', 'SYNK']);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const optional = file => fs.existsSync(file) ? read(file) : null;
const iso = value => { const at = Date.parse(value || ''); return Number.isFinite(at) ? new Date(at).toISOString() : null; };

function classification(assignments, id) {
  const value = assignments?.accounts?.[id];
  if (!value || !BUSINESSES.has(value.business) || !value.contentTrack || !value.purpose || !value.classificationBasis || !value.classificationSourcePaths?.length)
    throw new Error(`계정 사업 속성이 빠졌습니다: ${id} — 계정_사업속성.json에 목적과 근거를 먼저 지정하세요.`);
  if ((value.secondaryBusinesses || []).some(b => !BUSINESSES.has(b) || b === value.business)) throw new Error(`계정 보조 사업 속성 오류: ${id}`);
  return { ...value, secondaryBusinesses: [...new Set(value.secondaryBusinesses || [])] };
}

function loginOf({ registry = {}, audit = {}, observed = {}, now = Date.now() }) {
  const explicit = observed.login;
  const registryAt = iso(registry.loginVerifiedAt);
  const explicitAt = iso(explicit?.observedAt);
  const auditAt = iso(audit.loginEvidenceAt);
  const newerObservation = explicitAt && (!registryAt || explicitAt >= registryAt);
  const observedAt = newerObservation ? explicitAt : registryAt || auditAt;
  const observedRaw = newerObservation ? explicit?.observedAt : registryAt ? registry.loginVerifiedAt : audit.loginEvidenceAt;
  const browser = newerObservation && explicit.browser ? explicit.browser : registry.egoProfile ? `Ego · ${registry.egoProfile}`
    : /Aside/i.test(audit.loginBrowser || '') ? audit.loginBrowser : /Profile [12](?:\D|$)/.test(audit.loginBrowser || '') ? '현재 운영 프로필 확인 전' : audit.loginBrowser || '경로 확인 전';
  let state = newerObservation ? explicit.state : registryAt ? 'verified' : auditAt ? 'historical' : 'unknown';
  // 시간 경과는 로그아웃의 증거가 아니다. 오래된 성공/실패는 당시 관측으로만 표시한다.
  if (['verified', 'login-required'].includes(state) && observedAt && now - Date.parse(observedAt) > 72 * 3600000) state = 'historical';
  const methods={'official-gid-email-verification':'GID 이메일 인증','overseas-creator-phone-sms':'해외 창작자 사이트 문자 인증'};
  return { state, observedAt, observedDateOnly:/^\d{4}-\d{2}-\d{2}$/.test(observedRaw||''), browser, method: methods[registry.loginMethod] || audit.loginMethod || registry.loginMethod || '방식 확인 전',
    scope: newerObservation ? explicit.scope : registryAt ? registry.egoProfileNote || '계정 원장의 로그인 확인 기록' : audit.loginSessionStatus || '현재 대상 계정 재검증 전' };
}

function publicationOf(rows, now = Date.now()) {
  // 이름순으로 자르면 새 예약이 빠진다. 예약은 전부 보존하고 과거 게시 근거만 최신 60개로 제한한다.
  const byTime=(a,b)=>(Date.parse(a.at||a.observedAt)||0)-(Date.parse(b.at||b.observedAt)||0);
  const allConfirmed = rows.filter(r => r.state === '게시됨').sort(byTime);
  const confirmed = allConfirmed.slice(-60);
  const reservations = rows.filter(r => ['예약됨', '승인 대기'].includes(r.state));
  const future = reservations.filter(r => r.at && Date.parse(r.at) > now);
  const overdue = reservations.filter(r => !r.at || Date.parse(r.at) <= now);
  return { publishedCount: confirmed.length, scheduledCount: future.length, pendingConfirmationCount: overdue.length,
    lastPublishedAt: confirmed.map(r => r.observedAt || r.at).filter(Boolean).sort().at(-1) || null,
    nextScheduledAt: future.map(r => r.at).sort()[0] || null, checkedAt: new Date(now).toISOString(),
    basis: '최근 게시장부 근거 최대 60개와 예약 전체 · 실제 전체 게시물 수 아님', omittedPublishedCount:allConfirmed.length-confirmed.length,
    receipts: [...confirmed,...reservations].sort(byTime) };
}

function readPublicationRows(repo) {
  const root = path.join(repo, 'docs/마케팅');
  const byAccount = new Map();
  for (const folder of fs.readdirSync(root).filter(name => /_20\d{6}$/.test(name)).sort()) {
    const file = path.join(root, folder, '게시/게시결과.json');
    const result = optional(file);
    if (!result) continue;
    for (const id of new Set((result.판 || []).map(p => p.계정).filter(Boolean))) {
      const row = rowOf(result.판, id);
      if (!row || !['게시됨', '예약됨', '승인 대기'].includes(row.상태)) continue;
      if (!byAccount.has(id)) byAccount.set(id, []);
      byAccount.get(id).push({ episode: folder, state: row.상태, at: iso(row.시각), observedAt: iso(row.게시관측시각),
        url: typeof row.주소 === 'string' && /^https:\/\//.test(row.주소) ? row.주소 : null,
        jobId: typeof row.작업 === 'string' ? row.작업 : null,
        source: `docs/마케팅/${folder}/게시/게시결과.json` });
    }
  }
  return byAccount;
}

function loadAccountContext(repo, { now = Date.now() } = {}) {
  const root = path.join(repo, 'docs/마케팅');
  const registry = read(path.join(root, 'sns-계정.json'));
  const audit = read(path.join(root, '온라인마케팅지도/inputs/login-audit.json'));
  const assignments = read(path.join(root, '계정_사업속성.json'));
  const observations = optional(path.join(root, '온라인마케팅지도/inputs/account-observations.json')) || { accounts: {} };
  const publications = readPublicationRows(repo);
  return { registry, audit, assignments, observations, publications, now };
}

function decorateAccount(row, ctx) {
  const source = ctx.registry.accounts[row.id] || {};
  const observed = ctx.observations.accounts[row.id] || {};
  const managed=['operating','operating-contact','confirmed-expansion'].includes(row.accountStatus);
  const login = managed ? loginOf({ registry: source, audit: ctx.audit.accounts[row.id], observed, now: ctx.now }) : {state:'unknown',observedAt:null,browser:'운영 대상 아님',method:'운영 대상 아님',scope:row.accountStatus==='planned'?'개설 미확인 계획':'운영 제외·보류 기록'};
  const publication = publicationOf(ctx.publications.get(row.id) || [], ctx.now);
  // A dated owner screen is a separate observation, never inferred from a URL or a browser session.
  if (observed.publication && iso(observed.publication.observedAt)) publication.screenObservation = observed.publication;
  const collection = { state: source.metricsState === 'reading' ? 'historical' : 'unknown', checkedAt: null,
    method: source.metricsRoute || null, metrics: [] };
  const statuses = { verified: '로그인 확인', 'login-required': '확인한 프로필에서 로그인 필요', historical: '이전 확인 기록 · 현재 미재검증', unknown: '현재 로그인 미확인' };
  return { ...row, ...classification(ctx.assignments, row.id),
    countryCode: source.countryCode || row.countryCode || null,
    loginBrowser: login.browser, loginMethod: login.method, loginEvidenceAt: login.observedAt,
    loginStatusLabel: statuses[login.state], loginSessionStatus: login.scope, loginCaveat: login.scope,
    loginMappingStatus: !managed ? ctx.audit.accounts[row.id]?.loginMappingStatus || 'not-created' : login.state === 'verified' ? 'confirmed' : ctx.audit.accounts[row.id]?.loginMappingStatus || 'partial',
    operations: { login, publication, collection },
    publishStatus: publication.publishedCount || publication.scheduledCount || publication.pendingConfirmationCount
      ? `게시 확인 ${publication.publishedCount} · 예약 기록 ${publication.scheduledCount} · 게시 여부 확인 필요 ${publication.pendingConfirmationCount}` : '게시·예약 기록 미확인',
    publicationEvidence: publication.receipts.length ? publication.receipts : null };
}

function accountMapOf(repo, now = Date.now()) {
  const file=path.join(repo,'docs/마케팅/온라인마케팅지도/engagement/company/account-catalog.json');
  if(!fs.existsSync(file))return null;
  const catalogue=read(file),ctx=loadAccountContext(repo,{now});
  return {generatedAt:new Date(now).toISOString(),accounts:catalogue.accounts.map(row=>{
    const enriched=decorateAccount(row,ctx);
    return {id:row.id,business:row.business,contentTrack:row.contentTrack,operations:enriched.operations};
  })};
}

module.exports = { BUSINESSES, classification, loginOf, publicationOf, readPublicationRows, loadAccountContext, decorateAccount, accountMapOf };
