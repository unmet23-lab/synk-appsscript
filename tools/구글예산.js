#!/usr/bin/env node
/**
 * 구글 결제 «경보» — 돈이 카드로 넘어가기 전에 알게 한다.
 *
 * 🔑 왜 있나:
 *   크레딧이 바닥나면 그 다음부터는 카드로 청구된다. 그 순간을 «모르고» 지나가는 것이 유호님 걱정의 본체다.
 *   🚫 카드를 빼는 것은 답이 아니다 — 구글이 결제 계정을 정지시키고 **남은 크레딧까지 같이 죽는다**
 *      (공식 문서: 계정 정지 까닭 첫째가 「결제 수단이 만료되었거나 유효하지 않기 때문」).
 *   ⇒ 대신 경보를 달고, 정말 끊을 때는 «프로젝트에서 결제 떼기» 또는 «결제 계정 해지»로 끊는다.
 *
 * 쓰는 법:
 *   node tools/구글예산.js                # 지금 걸린 경보를 본다
 *   node tools/구글예산.js --걸기          # 아래 두 벌을 세운다(이미 있으면 겹쳐 만들지 않는다)
 *   node tools/구글예산.js --지우기 <이름>  # 그 이름의 경보를 지운다
 *
 * 🔴 뜻이 뒤집히기 쉬운 자리 — `creditTypesTreatment`:
 *   `INCLUDE_ALL_CREDITS` = 크레딧을 비용에서 **뺀다** ⇒ «카드로 나갈 돈»을 잰다
 *   `EXCLUDE_ALL_CREDITS` = 크레딧을 안 뺀다        ⇒ «총 사용액»(크레딧 소모 속도)을 잰다
 * ⚠ `calendarPeriod: MONTH` 가 저절로 붙는다(달마다 0으로 돌아간다).
 * ⚠ 알림은 «결제 계정 주인» 메일로 간다. 그 메일함을 안 보면 이 장치는 없는 것과 같다.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const 결제계정 = process.env.SYNK_BILLING_ACCOUNT || '013A36-17619E-CE0D07';
const 자격경로 = process.env.SYNK_VERTEX_OAUTH || path.join(os.homedir(), '.synk-vertex-oauth.json');

/** 세울 경보 두 벌. 하나는 «카드로 나가나», 하나는 «크레딧이 바닥나 가나». */
const 세울것 = [
  {
    displayName: '카드로 나가기 시작하면 알림',
    budgetFilter: { creditTypesTreatment: 'INCLUDE_ALL_CREDITS' },
    amount: { specifiedAmount: { currencyCode: 'KRW', units: '50000' } },
    thresholdRules: [0.01, 0.2, 0.5, 1.0].map((t) => ({ thresholdPercent: t })),
    notificationsRule: { disableDefaultIamRecipients: false },
  },
  {
    displayName: '크레딧이 바닥나 가면 알림',
    budgetFilter: { creditTypesTreatment: 'EXCLUDE_ALL_CREDITS' },
    amount: { specifiedAmount: { currencyCode: 'KRW', units: '414984' } },
    thresholdRules: [0.5, 0.8, 0.9, 1.0].map((t) => ({ thresholdPercent: t })),
    notificationsRule: { disableDefaultIamRecipients: false },
  },
];

const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

async function 토큰() {
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
  if (!답.access_token) throw new Error(`구글 토큰 갱신 실패 ${r.status}: ${답.error_description || 답.error || ''}`);
  return { tok: 답.access_token, 프로: j.프로젝트, 계정: j.계정 };
}

async function 목록(H) {
  const r = await fetch(`https://billingbudgets.googleapis.com/v1/billingAccounts/${결제계정}/budgets`, { headers: H });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`경보 목록 ${r.status}: ${JSON.stringify(j).slice(0, 250)}`);
  return j.budgets || [];
}

function 한줄(b) {
  const 금액 = b.amount?.specifiedAmount;
  const 뜻 = b.budgetFilter?.creditTypesTreatment === 'INCLUDE_ALL_CREDITS' ? '카드로 나갈 돈' : '총 사용액';
  const 문턱 = (b.thresholdRules || []).map((t) => `${Math.round(t.thresholdPercent * 100)}%`).join('·');
  return `  · ${b.displayName}\n`
    + `      재는 것 ${뜻} · 기준 ${금액?.currencyCode} ${Number(금액?.units || 0).toLocaleString()}`
    + ` · 알리는 때 ${문턱}\n`
    + `      첫 알림이 오는 값 ≈ ${금액?.currencyCode} `
    + `${Math.round(Number(금액?.units || 0) * ((b.thresholdRules || [{}])[0].thresholdPercent || 0)).toLocaleString()}`;
}

(async () => {
  const { tok, 프로, 계정 } = await 토큰();
  const H = { authorization: `Bearer ${tok}`, 'x-goog-user-project': 프로, 'content-type': 'application/json' };

  const 지울이름 = process.argv.includes('--지우기') ? process.argv[process.argv.indexOf('--지우기') + 1] : null;
  if (지울이름) {
    const 있는것 = await 목록(H);
    const 과녁 = 있는것.filter((b) => b.displayName === 지울이름);
    if (!과녁.length) { console.log(`\n그런 이름의 경보가 없다: "${지울이름}"\n`); return; }
    for (const b of 과녁) {
      const r = await fetch(`https://billingbudgets.googleapis.com/v1/${b.name}`, { method: 'DELETE', headers: H });
      console.log(`지움 ${r.status}: ${b.displayName}`);
    }
    console.log('\n남은 경보:');
    (await 목록(H)).forEach((b) => console.log(한줄(b)));
    return;
  }

  if (process.argv.includes('--걸기')) {
    // 문이 꺼져 있으면 켠다(0원 · serviceusage 는 청구지 헤더를 «안» 준다 — 주면 닭과 달걀로 403)
    const 켜기 = await fetch(
      `https://serviceusage.googleapis.com/v1/projects/${프로}/services/billingbudgets.googleapis.com:enable`,
      { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: '{}' });
    console.log(`문 켜기 ${켜기.status} · 전파를 기다린다(30초)…`);
    await 잠깐(30000);

    const 있는것 = await 목록(H).catch(() => []);
    for (const b of 세울것) {
      if (있는것.some((x) => x.displayName === b.displayName)) {
        console.log(`이미 있다(겹쳐 만들지 않는다): ${b.displayName}`);
        continue;
      }
      const r = await fetch(`https://billingbudgets.googleapis.com/v1/billingAccounts/${결제계정}/budgets`,
        { method: 'POST', headers: H, body: JSON.stringify(b) });
      const j = await r.json().catch(() => ({}));
      console.log(`세움 ${r.status}: ${b.displayName}${r.ok ? '' : ' · ' + JSON.stringify(j).slice(0, 200)}`);
    }
    await 잠깐(3000);
  }

  const 것들 = await 목록(H);
  console.log(`\n🛡 결제 경보 — 계정 ${계정 || '(모름)'} · 지갑 ${결제계정}\n`);
  if (!것들.length) {
    console.log('  걸린 경보가 없다. 세우려면: node tools/구글예산.js --걸기\n');
    return;
  }
  것들.forEach((b) => console.log(한줄(b)));
  console.log(`\n⚠ 알림은 결제 계정 «주인» 메일로 간다 — 그 메일함을 안 보면 이 장치는 없는 것과 같다.`);
  console.log(`⚠ 달마다 0으로 돌아간다(calendarPeriod=MONTH).\n`);
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
