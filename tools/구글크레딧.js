#!/usr/bin/env node
'use strict';
/** 모델별 Google Monitoring 사용량 조회. 추론/결제/계정 변경은 하지 않는다.
 * node tools/구글크레딧.js [--시간 40] [--날] [--옛|--이전|--새] [--json|--설정]
 * 실제 청구액과 현재 크레딧은 Monitoring으로 알 수 없으므로 추산하지 않는다. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 지갑들 = {
  옛: { 이름: '옛', 프로: 'gen-lang-client-0106203750', 결제: '0161FA-7C996C-F1B948', 자격: path.join(os.homedir(), '.clasprc.json') },
  이전: { 이름: '이전', 프로: 'project-22fd10a3-c9c2-4b34-9f0', 결제: '013A36-17619E-CE0D07', 자격: path.join(os.homedir(), '.synk-vertex-oauth.77yuhbs.json') },
  새: { 이름: '새', 프로: 'synk-bake-unmet27', 결제: '01864D-0E650C-40F3CB', 자격: path.join(os.homedir(), '.synk-vertex-oauth.json') },
};
/** 금융 화면값은 공개 저장소에 넣지 않고 로컬 runtime의 날짜 붙은 관찰만 읽는다. */
function 마지막확인읽기(프로젝트, 파일 = process.env.SYNK_BILLING_SNAPSHOT || path.join(os.homedir(), '.codex', 'runtime', 'synk-cloud-billing.json')) {
  if (!fs.existsSync(파일)) return null;
  const j = JSON.parse(fs.readFileSync(파일, 'utf8'));
  return j && j.snapshots && j.snapshots[프로젝트] || null;
}
function 고른지갑(argv = process.argv.slice(2)) {
  const 선택 = ['옛', '이전', '새'].filter((s) => argv.includes(`--${s}`));
  if (선택.length > 1) throw new Error('--옛, --이전, --새 중 하나만 지정한다');
  return 지갑들[선택[0] || '새']; // 자격이 없어도 배포 계정으로 자동 이동하지 않는다.
}
function 값(argv, 이름, 기본) {
  const i = argv.indexOf(이름);
  if (i < 0) return 기본;
  if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${이름} 뒤에 값이 없다`);
  return argv[i + 1];
}
async function 토큰얻기(지갑, env = process.env) {
  const 파일 = env.SYNK_VERTEX_OAUTH || 지갑.자격;
  if (!fs.existsSync(파일)) throw new Error(`명시한 조회 계정의 자격이 없다: ${파일}. 다른 계정으로 자동 이동하지 않는다.`);
  const j = JSON.parse(fs.readFileSync(파일, 'utf8'));
  const t = require('./모델정책.js').벌텍스자격확인(j, 지갑.프로);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret,
      refresh_token: t.refresh_token, grant_type: 'refresh_token' }), signal: AbortSignal.timeout(15000),
  });
  const 답 = await r.json();
  if (!r.ok || !답.access_token) throw new Error(`Google 조회 자격 갱신 실패 ${r.status}: ${답.error || 'token 없음'}`);
  return 답.access_token;
}
/** 모델 라벨과 모든 페이지를 보존한다. 일부 조회 실패를 0건으로 바꾸지 않는다. */
async function 시계열(H, 프로, metric, 창초, 덧필터 = '', 끝 = new Date()) {
  const q = new URLSearchParams({ filter: `metric.type="${metric}"${덧필터}`,
    'interval.startTime': new Date(끝.getTime() - 창초 * 1000).toISOString(), 'interval.endTime': 끝.toISOString(),
    'aggregation.alignmentPeriod': '3600s', 'aggregation.perSeriesAligner': 'ALIGN_SUM',
    'aggregation.crossSeriesReducer': 'REDUCE_SUM', 'aggregation.groupByFields': 'resource.labels.model_user_id' });
  const rows = [], pages = new Set();
  for (;;) {
    const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${프로}/timeSeries?${q}`,
      { headers: H, signal: AbortSignal.timeout(30000) });
    const j = await r.json();
    if (!r.ok || (j.executionErrors && j.executionErrors.length)) throw new Error(`Monitoring 조회 불완전 ${r.status}: ${(j.error && j.error.message) || 'executionErrors'}`);
    for (const ts of j.timeSeries || []) {
      const model = ts.resource?.labels?.model_user_id || ts.metric?.labels?.model_user_id || '(모델 미확인)';
      for (const p of ts.points || []) {
        const time = new Date(p.interval.endTime), value = Number(p.value.int64Value ?? p.value.doubleValue);
        if (!Number.isFinite(time.getTime()) || !Number.isFinite(value)) throw new Error('Monitoring 시각/값을 읽을 수 없다');
        rows.push({ model, time: time.toLocaleString('sv', { timeZone: 'Asia/Seoul' }).slice(0, 13), value });
      }
    }
    if (!j.nextPageToken) break;
    if (pages.has(j.nextPageToken)) throw new Error('Monitoring 페이지가 반복돼 전체 조회를 확인할 수 없다');
    pages.add(j.nextPageToken); q.set('pageToken', j.nextPageToken);
  }
  return rows;
}
function 합치기(시계열들, 날 = false) {
  const m = new Map();
  for (const field of ['호출', '막힘429', '입력', '출력']) for (const r of 시계열들[field] || []) {
    const 시각 = 날 ? r.time.slice(0, 10) : r.time, key = JSON.stringify([r.model, 시각]);
    if (!m.has(key)) m.set(key, { 모델: r.model, 시각, 호출: 0, 막힘429: 0, 입력: 0, 출력: 0 });
    m.get(key)[field] += r.value;
  }
  return [...m.values()].sort((a, b) => a.시각.localeCompare(b.시각) || a.모델.localeCompare(b.모델));
}
function 보고서(지갑, 행들, 창시간, 때 = new Date(), snapshot = 마지막확인읽기(지갑.프로)) {
  return { 조회시각: 때.toISOString(), 프로젝트: 지갑.프로, 계정: 지갑.이름, 창시간,
    실제청구액KRW: null, 현재크레딧KRW: null,
    마지막화면확인: snapshot ? { 잔액KRW: snapshot.balanceKRW ?? null, 확인때: snapshot.asOfDate || null,
      마감: snapshot.expiresOn || null, 계정유형: snapshot.accountType || null, 현재값아님: true } : null, 행들,
    합계: 행들.reduce((acc, r) => { for (const f of ['호출', '막힘429', '입력', '출력']) acc[f] += r[f]; return acc; },
      { 호출: 0, 막힘429: 0, 입력: 0, 출력: 0 }),
    결제화면: `https://console.cloud.google.com/billing/${지갑.결제}/credits`,
    한계: '선택 프로젝트·기간의 Monitoring 사용량이다. 토큰과 과금 단위/크레딧/할인은 달라 실제 비용·현재 잔액을 계산하지 않는다. 시계열 없음은 무료 또는 미사용의 증명이 아니다.' };
}
async function main(argv = process.argv.slice(2)) {
  const 지갑 = 고른지갑(argv), 창시간 = Number(값(argv, '--시간', 40));
  if (!Number.isFinite(창시간) || 창시간 <= 0 || 창시간 > 2160) throw new Error('--시간은 0 초과 2160 이하로 지정한다');
  if (argv.includes('--설정')) {
    const r = 보고서(지갑, [], 창시간); delete r.행들; delete r.합계; r.조회실행 = false;
    console.log(JSON.stringify(r, null, 2)); return r;
  }
  const tok = await 토큰얻기(지갑), 프로 = 지갑.프로;
  const H = { authorization: `Bearer ${tok}`, 'x-goog-user-project': 프로 };
  const M = 'aiplatform.googleapis.com/publisher/online_serving', 때 = new Date();
  const [출력, 입력, 호출, 막힘429] = await Promise.all([
    시계열(H, 프로, `${M}/token_count`, 창시간 * 3600, ' AND metric.labels.type="output"', 때),
    시계열(H, 프로, `${M}/token_count`, 창시간 * 3600, ' AND metric.labels.type="input"', 때),
    시계열(H, 프로, `${M}/model_invocation_count`, 창시간 * 3600, '', 때),
    시계열(H, 프로, `${M}/model_invocation_count`, 창시간 * 3600, ' AND metric.labels.response_code="429"', 때),
  ]);
  const r = 보고서(지갑, 합치기({ 출력, 입력, 호출, 막힘429 }, argv.includes('--날')), 창시간, 때);
  if (argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`Google 모델별 사용량 · ${지갑.이름} / ${프로} · 최근 ${창시간}시간`); console.table(r.행들);
    console.log('합계:', r.합계); console.log('현재 실제 청구액·크레딧 잔액: 확인 불가(Monitoring으로 계산하지 않음)');
    console.log('마지막 화면 확인(날짜가 지난 관찰이며 현재 잔액 아님):', r.마지막화면확인 || '확인 불가');
    console.log(r.한계); console.log(`결제 확인: ${r.결제화면}`);
  }
  return r;
}
module.exports = { 지갑들, 고른지갑, 마지막확인읽기, 시계열, 합치기, 보고서, main };
if (require.main === module) main().catch((e) => { console.error(`확인 불가: ${e.message}`); process.exitCode = 1; });
