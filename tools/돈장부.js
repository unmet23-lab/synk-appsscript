#!/usr/bin/env node
/**
 * 돈 장부 — 「어느 계정에 뭐가 걸려 있고, 어디서 얼마가 빠졌나」를 한 장으로 낸다.
 *
 * 🔑 왜 있나(유호 09-06):
 *   구글 무료 크레딧을 «계정 갈아 끼우며» 쓰기로 했다. 갈아 끼울 때마다 어느 계정에서 얼마가 빠졌는지
 *   안 적으면 돈이 줄줄 샌다. 그리고 라디오 서버처럼 «따로 걸리는 것»은 기계가 못 찾는다.
 *
 * 📐 자가 둘이다 — 이 도구가 그것을 갈라 낸다:
 *   ① 손으로 적는 것 = `docs/_ops/돈장부.json`(걸린 것 · 카드 · 계획 · 화면에서 읽은 잔액)
 *   ② 기계가 재는 것 = 크레딧 소비 · 결제 붙은 방 · 지금 어느 계정으로 굽나
 *
 * 쓰는 법:
 *   node tools/돈장부.js            # 한 장으로 본다
 *   node tools/돈장부.js --자세히    # 프로젝트·교체 이력까지
 *
 * 🔴 이 도구가 «안» 보는 것: 구글 밖 벤더의 실제 청구액. 장부에 적힌 대로만 말한다.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const 장부경로 = path.join(__dirname, '..', 'docs', '_ops', '돈장부.json');
const 굽기자격 = path.join(os.homedir(), '.synk-vertex-oauth.json');
const 보관자격 = path.join(os.homedir(), '.synk-vertex-oauth.보관.json');
const 배포자격 = path.join(os.homedir(), '.clasprc.json');

/* 크레딧 화면과 대조해 잰 단가(09-06). 출력 토큰 하나로 전체를 센다 — 입력 값까지 흡수한 값이다. */
const 토큰당 = 192274 / 1332857;

const 원 = (n) => `₩${Math.round(n).toLocaleString()}`;

async function 토큰(자격경로) {
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
  if (!답.access_token) throw new Error(`토큰 갱신 실패 ${r.status}`);
  return 답.access_token;
}

/** 확인한 때 이후로 태운 출력 토큰을 센다. 창은 «확인한 때부터 지금까지»로 자동으로 잡는다. */
async function 확인뒤태운값(tok, 프로, 확인때) {
  const 시작 = new Date(확인때);
  const 끝 = new Date();
  const 시간 = Math.max(1, Math.ceil((끝 - 시작) / 3600000));
  if (시간 > 700) return { 못잼: '확인한 때가 너무 오래됐다(모니터링이 보관하는 기간을 넘는다)' };
  const q = new URLSearchParams({
    filter: 'metric.type="aiplatform.googleapis.com/publisher/online_serving/token_count" AND metric.labels.type="output"',
    'interval.startTime': 시작.toISOString(),
    'interval.endTime': 끝.toISOString(),
    'aggregation.alignmentPeriod': '3600s',
    'aggregation.perSeriesAligner': 'ALIGN_SUM',
    'aggregation.crossSeriesReducer': 'REDUCE_SUM',
  });
  const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${프로}/timeSeries?${q}`,
    { headers: { authorization: `Bearer ${tok}`, 'x-goog-user-project': 프로 } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { 못잼: `모니터링 ${r.status}` };
  let 합 = 0;
  for (const ts of (j.timeSeries || [])) for (const p of (ts.points || [])) 합 += Number(p.value.int64Value ?? p.value.doubleValue ?? 0);
  return { 토큰: 합, 값: Math.round(합 * 토큰당) };
}

/** 굽기 자격 파일이 있으면 새 계정, 없으면 옛 계정(= `모델정책.js` 의 `붙인자격()` 과 같은 규칙). */
const 지금굽는곳 = () => (fs.existsSync(굽기자격) ? '77yuhbs@gmail.com' : 'unmet23@gmail.com');

/** 그 계정을 열 자격 파일. 새 계정 것은 굽기를 옛 쪽으로 돌려 두면 «보관»에 있다. */
function 자격찾기(계정) {
  if (계정.이름.startsWith('unmet23')) return 배포자격;
  if (계정.이름.startsWith('77yuhbs')) return fs.existsSync(굽기자격) ? 굽기자격 : 보관자격;
  return null;
}

(async () => {
  if (!fs.existsSync(장부경로)) { console.error(`\n🔴 장부가 없다: ${장부경로}\n`); process.exit(1); }
  const 장부 = JSON.parse(fs.readFileSync(장부경로, 'utf8'));
  const 자세히 = process.argv.includes('--자세히');
  const 굽는곳 = 지금굽는곳();

  console.log('\n📒 돈 장부 — 어느 계정에 뭐가 걸려 있나\n' + '═'.repeat(62));
  console.log(`\n🔥 지금 굽기가 태우는 계정 = ${굽는곳}   (바꾸기: node tools/굽기계정.js --옛/--새)`);

  let 총남은 = 0;
  console.log('\n■ 계정별 크레딧');
  for (const a of 장부.계정) {
    const 굽나 = a.이름 === 굽는곳 ? ' 🔥' : '';
    if (!a.크레딧) { console.log(`\n   · ${a.이름} (${a.별명})${굽나}\n       크레딧 없음 — ${a.메모 ? a.메모.slice(0, 60) + '…' : ''}`); continue; }
    const c = a.크레딧;
    const 남은날 = Math.ceil((new Date(`${c.마감}T23:59:59+09:00`) - Date.now()) / 86400000);
    let 지금잔액 = c.잔액, 꼬리 = `(화면 ${c.확인때.slice(0, 16).replace('T', ' ')})`;
    const 자격 = 자격찾기(a);
    if (자격 && fs.existsSync(자격)) {
      try {
        const tok = await 토큰(자격);
        const 프로 = (a.프로젝트.find((p) => p.결제 === '켜짐') || {}).id;
        if (프로) {
          const 뒤 = await 확인뒤태운값(tok, 프로, c.확인때);
          if (뒤.못잼) 꼬리 = `(화면값 그대로 — ${뒤.못잼})`;
          else { 지금잔액 = c.잔액 - 뒤.값; 꼬리 = `(화면 ${원(c.잔액)} − 그 뒤 태운 ${원(뒤.값)})`; }
        }
      } catch (e) { 꼬리 = `(화면값 그대로 — 못 쟀다: ${e.message})`; }
    }
    총남은 += 지금잔액;
    console.log(`\n   · ${a.이름} (${a.별명})${굽나}`);
    console.log(`       남은 것  ${원(지금잔액)}  ${꼬리}`);
    console.log(`       마감 ${c.마감} · 남은 날 ${남은날}일 · 원금 ${원(c.원금)}`);
    if (a['9월 카드 청구']) {
      const b = a['9월 카드 청구'];
      console.log(`       9월 카드로 나갈 것 ${원(b.값)}${b.무엇 ? ` — ${b.무엇}` : ''}`);
    }
    console.log(`       경보 ${a.경보 || '(없음)'}`);
    if (자세히) for (const p of a.프로젝트) console.log(`         · ${p.id} · 결제 ${p.결제} · ${p.쓰임}`);
  }
  console.log(`\n   ── 남은 크레딧 합계 ≈ ${원(총남은)}`);

  console.log('\n■ 따로 걸린 것 (기계가 못 찾는다 — 장부가 쥔다)');
  for (const x of 장부['걸린 것']) {
    const 나감 = x['지금 나가는 돈'];
    const 표 = 나감 === 0 ? '0원' : (나감 == null ? '❔ 안 재봤다' : 원(나감));
    console.log(`\n   · ${x.무엇} — ${x.상태}`);
    console.log(`       어디 ${x.어디} · 값 ${x.값 || '(모름)'} · 지금 나가는 돈 ${표}`);
    if (x['⚠']) console.log(`       ⚠ ${x['⚠']}`);
  }

  if (자세히) {
    console.log('\n■ 계정 교체 이력');
    for (const h of 장부.교체이력) {
      console.log(`\n   · ${h.때.slice(0, 16).replace('T', ' ')} · ${h.에서} → ${h.으로}`);
      console.log(`       까닭 ${h.까닭}`);
      if (h['그때 잔액']) console.log(`       그때 잔액 ${Object.entries(h['그때 잔액']).map(([k, v]) => `${k} ${원(v)}`).join(' · ')}`);
      if (h['그 구간에 태운 것']) console.log(`       그 구간에 태운 것 ${Object.entries(h['그 구간에 태운 것']).filter(([k]) => k !== '자').map(([k, v]) => `${k} ${원(v)}`).join(' · ')}`);
      if (h.메모) console.log(`       메모 ${h.메모}`);
    }
  } else {
    console.log(`\n■ 계정 교체 ${장부.교체이력.length}번 — 자세히 보려면 --자세히`);
  }

  console.log('\n' + '═'.repeat(62));
  console.log('🔑 장부 고치는 자리 = docs/_ops/돈장부.json');
  console.log('   · 화면을 다시 읽으면 그 계정의 «잔액»과 «확인때» 를 갱신한다');
  console.log('   · 새 서비스에 결제를 붙이면 그 자리에서 «걸린 것» 에 적는다');
  console.log('   · 계정을 갈아 끼우면 tools/굽기계정.js 가 «교체이력» 에 스스로 적는다\n');
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
