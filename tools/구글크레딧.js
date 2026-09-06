#!/usr/bin/env node
/**
 * 구글 무료 크레딧 — 얼마나 탔나를 «콘솔 화면 없이» 잰다.
 *
 * 🔑 왜 이 도구가 있나:
 *   크레딧 잔액 자체는 구글이 API 로 안 준다(v1beta 주소가 404 · 09-04 실측). 재는 자리는 콘솔 화면 하나뿐이고,
 *   그 화면은 크롬 확장이 붙어 있어야 읽는다 — 확장은 자주 끊긴다(09-06 에 끊겨 못 읽었다).
 *   ⇒ 대신 «쓴 양»을 구글 모니터링에서 실측하고, 어제 청구서에서 잰 단가를 곱해 값을 세운다.
 *
 * 📐 자가 둘이다 — 섞어 읽지 말 것:
 *   ① 쓴 양(호출 수·토큰 수) = 구글이 준 실측값. 추정 아니다.
 *   ② 값(원) = ①에 «어제 청구서 단가»를 곱한 추정. 청구서가 며칠 늦게 따라오므로 오늘치는 화면에 아직 없다.
 *
 * 쓰는 법:
 *   node tools/구글크레딧.js              # 최근 40시간을 시간별로
 *   node tools/구글크레딧.js --시간 100    # 창을 넓힌다
 *   node tools/구글크레딧.js --날          # 날짜별로 묶는다
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/* 크레딧 원금 = 09-06 콘솔 실측(새 계정 77yuhbs · Free Trial · 마감 2026-12-05). */
const 크레딧원금 = 414984;
const 마감 = '2026-12-05';

/* 단가 = 09-05 청구서 실측 SKU(Gemini Image Output ₩60,329 / 363,440 토큰).
 * 🔑 «장당»이 아니라 «토큰당»으로 잰다 — 4K 로 올리면 장당 값은 뛰지만 토큰당 값은 그대로다. */
const 토큰당 = 60329 / 363440;
const 단가출처 = '09-05 청구서 SKU 실측 (Gemini Image Output ₩60,329 / 363,440토큰)';

const 자격경로 = process.env.SYNK_VERTEX_OAUTH || path.join(os.homedir(), '.synk-vertex-oauth.json');

function 인자(이름, 기본) {
  const i = process.argv.indexOf(이름);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : 기본;
}

async function 토큰얻기() {
  if (!fs.existsSync(자격경로)) {
    throw new Error(`굽기 계정의 자격이 없다: ${자격경로}\n   세우는 법: node tools/구글계정붙이기.js --계정 <메일주소>`);
  }
  const j = JSON.parse(fs.readFileSync(자격경로, 'utf8'));
  const t = (j.tokens && j.tokens.default) || j;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: t.client_id, client_secret: t.client_secret,
      refresh_token: t.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const 답 = await r.json().catch(() => ({}));
  if (!답.access_token) {
    throw new Error(`구글 토큰 갱신 실패 ${r.status}: ${답.error_description || 답.error || ''}\n`
      + `   되살리는 법: node tools/구글계정붙이기.js --계정 ${j.계정 || '<메일주소>'}`);
  }
  return { tok: 답.access_token, 프로: j.프로젝트, 계정: j.계정 };
}

/** 모니터링 시계열 하나를 «시각 → 합계» 표로 접는다. */
async function 시계열(H, 프로, metric, 창초, 덧필터 = '') {
  const 끝 = new Date();
  const 시작 = new Date(끝 - 창초 * 1000);
  const q = new URLSearchParams({
    filter: `metric.type="${metric}"${덧필터}`,
    'interval.startTime': 시작.toISOString(),
    'interval.endTime': 끝.toISOString(),
    'aggregation.alignmentPeriod': '3600s',
    'aggregation.perSeriesAligner': 'ALIGN_SUM',
    'aggregation.crossSeriesReducer': 'REDUCE_SUM',
  });
  const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${프로}/timeSeries?${q}`, { headers: H });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`모니터링 ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  const m = new Map();
  for (const ts of (j.timeSeries || [])) {
    for (const p of (ts.points || [])) {
      const k = new Date(p.interval.endTime).toLocaleString('sv', { timeZone: 'Asia/Seoul' }).slice(0, 13);
      m.set(k, (m.get(k) || 0) + Number(p.value.int64Value ?? p.value.doubleValue ?? 0));
    }
  }
  return m;
}

(async () => {
  const 날묶음 = process.argv.includes('--날');
  const 창시간 = Number(인자('--시간', 40));
  const { tok, 프로, 계정 } = await 토큰얻기();
  const H = { authorization: `Bearer ${tok}`, 'x-goog-user-project': 프로 };
  const M = 'aiplatform.googleapis.com/publisher/online_serving';

  const [출력, 입력, 호출, 막힘] = await Promise.all([
    시계열(H, 프로, `${M}/token_count`, 창시간 * 3600, ' AND metric.labels.type="output"'),
    시계열(H, 프로, `${M}/token_count`, 창시간 * 3600, ' AND metric.labels.type="input"'),
    시계열(H, 프로, `${M}/model_invocation_count`, 창시간 * 3600),
    시계열(H, 프로, `${M}/model_invocation_count`, 창시간 * 3600, ' AND metric.labels.response_code="429"'),
  ]);

  const 자르기 = (k) => (날묶음 ? k.slice(0, 10) : k);
  const 접기 = (m) => {
    const o = new Map();
    for (const [k, v] of m) o.set(자르기(k), (o.get(자르기(k)) || 0) + v);
    return o;
  };
  const [O, I, C, X] = [접기(출력), 접기(입력), 접기(호출), 접기(막힘)];
  const 키들 = [...new Set([...O.keys(), ...C.keys()])].sort();

  console.log(`\n💳 구글 무료 크레딧 — 얼마나 탔나`);
  console.log(`   계정 ${계정 || '(모름)'} · 프로젝트 ${프로} · 원금 ₩${크레딧원금.toLocaleString()} · 마감 ${마감}\n`);
  console.log('시각(KST)       부른 수   막힌 수      받은 양      값(₩·추정)');
  console.log('─'.repeat(64));

  let 총호출 = 0, 총막힘 = 0, 총출력 = 0, 총입력 = 0;
  for (const k of 키들) {
    const c = C.get(k) || 0, x = X.get(k) || 0, o = O.get(k) || 0, i = I.get(k) || 0;
    총호출 += c; 총막힘 += x; 총출력 += o; 총입력 += i;
    console.log(k.padEnd(15), String(c).padStart(7), String(x).padStart(9),
      String(o.toLocaleString()).padStart(12), String(Math.round(o * 토큰당).toLocaleString()).padStart(15));
  }
  const 총값 = Math.round(총출력 * 토큰당);
  console.log('─'.repeat(64));
  console.log('합계'.padEnd(15), String(총호출).padStart(7), String(총막힘).padStart(9),
    String(총출력.toLocaleString()).padStart(12), String(총값.toLocaleString()).padStart(15));

  const 남은 = 크레딧원금 - 총값;
  const 남은날 = Math.ceil((new Date(`${마감}T23:59:59+09:00`) - Date.now()) / 86400000);
  console.log(`\n📊 이 창에서 태운 것 ≈ ₩${총값.toLocaleString()} (원금의 ${(총값 / 크레딧원금 * 100).toFixed(0)}%)`);
  console.log(`   남은 것 ≈ ₩${남은.toLocaleString()} (${(남은 / 크레딧원금 * 100).toFixed(0)}%) · 남은 날 ${남은날}일`);
  if (총호출) console.log(`   한 번 부를 때마다 ≈ ₩${Math.round(총값 / 총호출).toLocaleString()}`);

  console.log(`\n📐 자 둘 — 섞어 읽지 말 것`);
  console.log(`   ① 부른 수·받은 양 = 구글 모니터링 실측(추정 아니다)`);
  console.log(`   ② 값(원) = ①에 단가를 곱한 «추정». 단가 출처 = ${단가출처}`);
  console.log(`   ⚠ 이 창 밖에서 태운 것은 안 들어 있다. 창을 넓히려면 --시간 100`);
  console.log(`   ⚠ 화면의 실제 잔액은 여기가 아니라 콘솔이 쥔다:`);
  console.log(`      console.cloud.google.com/billing/013A36-17619E-CE0D07/credits?authuser=1\n`);
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
