'use strict';
/**
 * 구글 읽기 전용 통로 — 서비스 계정 하나로 시트(방문 기록 · 방문 목적)와 서치콘솔(synk.im 속성)을 읽는다.
 * 열쇠 파일은 저장소 밖 `~/SYNK_보안/구글_사이트방문_읽기.json`(서비스 계정 JSON). 값은 출력 · 기록하지 않는다.
 * 그 계정은 시트 두 개에 「보기」, 서치콘솔 속성에 「제한됨」으로만 들어간다(설계 3절).
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 범위 = Object.freeze(['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/webmasters.readonly']);

function 열쇠자리() {
  return process.env.SYNK_SITE_VISITS_GOOGLE_KEY || path.join(os.homedir(), 'SYNK_보안', '구글_사이트방문_읽기.json');
}

/** 열쇠 파일을 읽는다. 없으면 null(「권한을 기다림」으로 쓰인다). 꼴이 틀리면 던진다. */
function 열쇠읽기(자리 = 열쇠자리()) {
  if (!fs.existsSync(자리)) return null;
  const j = JSON.parse(fs.readFileSync(자리, 'utf8'));
  if (j.type !== 'service_account' || !j.client_email || !j.private_key) throw new Error('구글 열쇠 파일이 서비스 계정 꼴이 아니다');
  return j;
}

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** 서비스 계정 JWT → 접근 토큰(1시간) */
async function 접근토큰(열쇠, { fetch기 = (...a) => fetch(...a), 지금 = () => Date.now(), 범위들 = 범위 } = {}) {
  const iat = Math.floor(지금() / 1000);
  const 토큰주소 = 열쇠.token_uri || 'https://oauth2.googleapis.com/token';
  const 머리 = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const 몸 = b64url(JSON.stringify({ iss: 열쇠.client_email, scope: 범위들.join(' '), aud: 토큰주소, iat, exp: iat + 3600 }));
  const 서명 = crypto.createSign('RSA-SHA256').update(`${머리}.${몸}`).sign(열쇠.private_key);
  const res = await fetch기(토큰주소, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, redirect: 'error', signal: AbortSignal.timeout(30000),
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${머리}.${몸}.${b64url(서명)}` }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`구글 토큰을 받지 못했다 — HTTP ${res.status} ${String(j.error || '')} ${String(j.error_description || '').slice(0, 200)}`.trim());
  return j.access_token;
}

async function 받기(주소, 토큰, fetch기, 옵션 = {}) {
  const res = await fetch기(주소, {
    method: 옵션.method || 'GET', redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { authorization: `Bearer ${토큰}`, ...(옵션.body ? { 'content-type': 'application/json' } : {}) },
    ...(옵션.body ? { body: JSON.stringify(옵션.body) } : {}),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status} ${String(j?.error?.status || '')} ${String(j?.error?.message || '').slice(0, 200)}`.trim());
    e.http = res.status;
    throw e;
  }
  return j;
}

/** 시트 한 탭의 값(일련번호 날짜) — 2차원 배열, 첫 줄이 머리 */
async function 시트읽기({ 시트, 탭, 토큰, fetch기 = (...a) => fetch(...a) }) {
  const 범위글 = encodeURIComponent(`'${String(탭).replace(/'/g, "''")}'`);
  const 주소 = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(시트)}/values/${범위글}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`;
  const j = await 받기(주소, 토큰, fetch기);
  return Array.isArray(j.values) ? j.values : [];
}

/** 서치콘솔 검색 실적(웹). 차원은 [] · ['query'] · ['page'] 따위. */
async function 검색실적({ 속성, 시작, 끝, 차원 = [], 줄수 = 10, 토큰, fetch기 = (...a) => fetch(...a) }) {
  const 주소 = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(속성)}/searchAnalytics/query`;
  const j = await 받기(주소, 토큰, fetch기, { method: 'POST', body: { startDate: 시작, endDate: 끝, dimensions: 차원, rowLimit: 줄수, type: 'web' } });
  return Array.isArray(j.rows) ? j.rows : [];
}

/** 날짜 'YYYY-MM-DD'에 날을 더한다 */
function 날더하기(날, n) {
  const d = new Date(`${날}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const 순위 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

/**
 * 서치콘솔에서 요약의 구글 칸을 만든다. 서치콘솔 자료는 2~3일 늦게 들어오므로 끝은 오늘(한국)에서 3일 앞이다.
 * 지난 28일과 그 앞 28일의 합, 검색어 다섯, 쪽 다섯.
 */
async function 구글칸({ 속성, 오늘, 토큰, fetch기, 날수 = 28 }) {
  const 끝 = 날더하기(오늘, -3), 시작 = 날더하기(끝, -(날수 - 1));
  const 앞끝 = 날더하기(시작, -1), 앞시작 = 날더하기(앞끝, -(날수 - 1));
  const 합 = async (s, e) => {
    const [r] = await 검색실적({ 속성, 시작: s, 끝: e, 차원: [], 줄수: 1, 토큰, fetch기 });
    return r ? { 노출: r.impressions || 0, 클릭: r.clicks || 0, 평균순위: 순위(r.position) } : { 노출: 0, 클릭: 0, 평균순위: null };
  };
  const 이번 = await 합(시작, 끝);
  const 앞 = await 합(앞시작, 앞끝);
  const 검색어 = (await 검색실적({ 속성, 시작, 끝, 차원: ['query'], 줄수: 5, 토큰, fetch기 }))
    .map((r) => ({ 말: String(r.keys?.[0] || ''), 노출: r.impressions || 0, 클릭: r.clicks || 0 }));
  const 쪽 = (await 검색실적({ 속성, 시작, 끝, 차원: ['page'], 줄수: 5, 토큰, fetch기 }))
    .map((r) => { let p = String(r.keys?.[0] || ''); try { p = new URL(p).pathname; } catch {} return { 쪽: p, 노출: r.impressions || 0, 클릭: r.clicks || 0 }; });
  return { 상태: '됨', 까닭: null, 시작, 끝, ...이번, 앞, 검색어, 쪽 };
}

module.exports = { 범위, 열쇠자리, 열쇠읽기, 접근토큰, 시트읽기, 검색실적, 구글칸, 날더하기 };
