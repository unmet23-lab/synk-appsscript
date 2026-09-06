#!/usr/bin/env node
/**
 * 구글 결제 «경보» — 돈이 카드로 넘어가기 전에 알게 한다. 지갑 둘을 한 자리에서 다룬다.
 *
 * 🔑 왜 있나:
 *   크레딧이 바닥나면 그 다음부터는 카드로 청구된다. 그 순간을 «모르고» 지나가는 것이 유호님 걱정의 본체다.
 *   🚫 카드를 빼는 것은 답이 아니다 — 구글이 결제 계정을 정지시키고 **남은 크레딧까지 같이 죽는다**
 *      (공식 문서: 계정 정지 까닭 첫째가 「결제 수단이 만료되었거나 유효하지 않기 때문」).
 *   ⇒ 대신 경보를 달고, 정말 끊을 때는 «프로젝트에서 결제 떼기» 또는 «결제 계정 해지»로 끊는다.
 *
 * 쓰는 법:
 *   node tools/구글예산.js                # 지갑 둘에 걸린 경보를 본다
 *   node tools/구글예산.js --걸기          # 없는 것을 세우고, 있는 것은 «가는 곳»만 맞춘다
 *   node tools/구글예산.js --지우기 <이름>  # 그 이름의 경보를 두 지갑에서 지운다
 *
 * 🔴 뜻이 뒤집히기 쉬운 자리 — `creditTypesTreatment`:
 *   `INCLUDE_ALL_CREDITS` = 크레딧을 비용에서 **뺀다** ⇒ «카드로 나갈 돈»을 잰다
 *   `EXCLUDE_ALL_CREDITS` = 크레딧을 안 뺀다        ⇒ «총 사용액»(크레딧 소모 속도)을 잰다
 * ⚠ `calendarPeriod: MONTH` 가 저절로 붙는다(달마다 0으로 돌아간다).
 * ⚠ `sendTestNotification` 은 이 통로에 없다(v3·v1 둘 다 404 · 09-06 실측) ⇒ «도착하나»는 진짜 알림으로만 갈린다.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/* 🔑 알림이 «가는 곳». 결제 계정 주인과 아무 상관이 없다 — 아무 주소나 된다(유호 확정 09-06).
 * 지갑 주인이 77yuhbs 든 unmet23 이든 **모든 경보를 unmet23 하나로 모은다**(유호 09-06 「모든 경보 전부 다」).
 * 까닭 = 유호님이 늘 보시는 메일함이 그것 하나이기 때문. */
const 받을주소 = process.env.SYNK_BILLING_ALERT_EMAIL || 'unmet23@gmail.com';

/** 지갑마다 «자격 파일»도 «원금»도 다르다. 한 값을 두 곳이 알면 갈리므로 여기 한 자리에 둔다. */
const 지갑들 = [
  {
    이름: 'unmet23 (배포·옛 굽기)',
    결제: '0161FA-7C996C-F1B948',
    자격: path.join(os.homedir(), '.clasprc.json'),
    프로: 'gen-lang-client-0106203750',
    원금: 435523,   // GCP Free Credit · 마감 2026-11-13
  },
  {
    이름: '77yuhbs (지금 굽는 곳)',
    결제: '013A36-17619E-CE0D07',
    자격: path.join(os.homedir(), '.synk-vertex-oauth.json'),
    프로: null,      // 자격 파일이 스스로 안다
    원금: 414984,   // Free Trial · 마감 2026-12-05
  },
];

/** 세울 경보 두 벌. 하나는 «카드로 나가나», 하나는 «크레딧이 바닥나 가나». */
function 세울것(원금) {
  return [
    {
      displayName: '카드로 나가기 시작하면 알림',
      budgetFilter: { creditTypesTreatment: 'INCLUDE_ALL_CREDITS' },
      amount: { specifiedAmount: { currencyCode: 'KRW', units: '50000' } },
      thresholdRules: [0.01, 0.2, 0.5, 1.0].map((t) => ({ thresholdPercent: t })),
    },
    {
      displayName: '크레딧이 바닥나 가면 알림',
      budgetFilter: { creditTypesTreatment: 'EXCLUDE_ALL_CREDITS' },
      amount: { specifiedAmount: { currencyCode: 'KRW', units: String(원금) } },
      thresholdRules: [0.5, 0.8, 0.9, 1.0].map((t) => ({ thresholdPercent: t })),
    },
  ];
}

const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

async function 토큰(자격경로) {
  if (!fs.existsSync(자격경로)) throw new Error(`자격이 없다: ${자격경로}`);
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
  if (!답.access_token) throw new Error(`토큰 갱신 실패 ${r.status}: ${답.error_description || 답.error || ''}`);
  return { tok: 답.access_token, 프로: j.프로젝트 || null };
}

async function 목록(H, 결제) {
  const r = await fetch(`https://billingbudgets.googleapis.com/v1/billingAccounts/${결제}/budgets`, { headers: H });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { 실패: `${r.status}`, 것들: [] };
  return { 것들: j.budgets || [] };
}

/** 문을 켠다. serviceusage 는 청구지 헤더를 «안» 준다 — 주면 닭과 달걀로 403 이다. */
async function 문켜기(tok, 프로, 이름) {
  const r = await fetch(`https://serviceusage.googleapis.com/v1/projects/${프로}/services/${이름}:enable`,
    { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: '{}' });
  return r.status;
}

/** 메일 채널을 찾거나 만든다. 이 채널이 예산과 «주소»를 잇는 다리다. */
async function 메일채널(H, 프로) {
  const 있 = await (await fetch(`https://monitoring.googleapis.com/v3/projects/${프로}/notificationChannels`, { headers: H })).json();
  const 찾음 = (있.notificationChannels || []).find((c) => c.type === 'email' && c.labels?.email_address === 받을주소);
  if (찾음) return 찾음;
  const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${프로}/notificationChannels`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      type: 'email',
      displayName: 'SYNK 돈 경보 받는 곳',
      description: '구글 크레딧이 바닥나거나 카드로 돈이 나가기 시작하면 여기로 온다',
      labels: { email_address: 받을주소 },
      enabled: true,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.name) throw new Error(`메일 채널을 못 만들었다 ${r.status}: ${JSON.stringify(j).slice(0, 250)}`);
  return j;
}

function 한줄(b) {
  const 금액 = b.amount?.specifiedAmount;
  const 뜻 = b.budgetFilter?.creditTypesTreatment === 'INCLUDE_ALL_CREDITS' ? '카드로 나갈 돈' : '총 사용액';
  const 문턱 = (b.thresholdRules || []).map((t) => `${Math.round(t.thresholdPercent * 100)}%`).join('·');
  const n = b.notificationsRule || {};
  const 가는곳 = (n.monitoringNotificationChannels || []).length ? 받을주소 : '결제 계정 주인 (채널이 안 붙었다)';
  const 첫값 = Math.round(Number(금액?.units || 0) * ((b.thresholdRules || [{}])[0].thresholdPercent || 0));
  return `     · ${b.displayName}\n`
    + `         재는 것 ${뜻} · 기준 ${금액?.currencyCode} ${Number(금액?.units || 0).toLocaleString()} · 알리는 때 ${문턱}\n`
    + `         첫 알림이 오는 값 ≈ ${금액?.currencyCode} ${첫값.toLocaleString()}\n`
    + `         가는 곳 = ${가는곳}${n.disableDefaultIamRecipients ? ' · 계정 주인에게는 안 간다' : ''}`;
}

(async () => {
  const 걸기 = process.argv.includes('--걸기');
  const 지울이름 = process.argv.includes('--지우기') ? process.argv[process.argv.indexOf('--지우기') + 1] : null;

  console.log(`\n🛡 결제 경보 — 모든 알림이 가는 곳 = ${받을주소}\n` + '═'.repeat(58));

  for (const 지갑 of 지갑들) {
    console.log(`\n■ ${지갑.이름} · 지갑 ${지갑.결제}`);
    let tok, 자격프로;
    try { ({ tok, 프로: 자격프로 } = await 토큰(지갑.자격)); }
    catch (e) { console.log(`   🔴 ${e.message}`); continue; }
    const 프로 = 지갑.프로 || 자격프로;
    const H = { authorization: `Bearer ${tok}`, 'x-goog-user-project': 프로, 'content-type': 'application/json' };

    if (지울이름) {
      const { 것들 } = await 목록(H, 지갑.결제);
      for (const b of 것들.filter((x) => x.displayName === 지울이름)) {
        const r = await fetch(`https://billingbudgets.googleapis.com/v1/${b.name}`, { method: 'DELETE', headers: H });
        console.log(`   지움 ${r.status}: ${b.displayName}`);
      }
    }

    if (걸기) {
      const 문들 = ['billingbudgets.googleapis.com', 'monitoring.googleapis.com'];
      const 켠결과 = [];
      for (const f of 문들) 켠결과.push(`${f.split('.')[0]} ${await 문켜기(tok, 프로, f)}`);
      console.log(`   문 켜기: ${켠결과.join(' · ')} · 전파를 기다린다(30초)…`);
      await 잠깐(30000);

      let 채널;
      try { 채널 = await 메일채널(H, 프로); }
      catch (e) { console.log(`   🔴 ${e.message}`); continue; }
      const 알림규칙 = { monitoringNotificationChannels: [채널.name], disableDefaultIamRecipients: true };

      const { 것들: 있는것 } = await 목록(H, 지갑.결제);
      for (const b of 세울것(지갑.원금)) {
        const 이미 = 있는것.find((x) => x.displayName === b.displayName);
        if (이미) {
          // 겹쳐 만들지 않고 «가는 곳»만 맞춘다(주소를 바꿨을 때 이 자리가 따라온다)
          const r = await fetch(`https://billingbudgets.googleapis.com/v1/${이미.name}?updateMask=notificationsRule`,
            { method: 'PATCH', headers: H, body: JSON.stringify({ notificationsRule: 알림규칙 }) });
          console.log(`   이미 있다 · 가는 곳만 맞췄다 ${r.status}: ${b.displayName}`);
          continue;
        }
        const r = await fetch(`https://billingbudgets.googleapis.com/v1/billingAccounts/${지갑.결제}/budgets`,
          { method: 'POST', headers: H, body: JSON.stringify({ ...b, notificationsRule: 알림규칙 }) });
        const j = await r.json().catch(() => ({}));
        console.log(`   세움 ${r.status}: ${b.displayName}${r.ok ? '' : ' · ' + JSON.stringify(j).slice(0, 200)}`);
      }
      await 잠깐(3000);
    }

    // 되읽기 — 「걸렸다」를 응답이 아니라 목록으로 잰다
    const { 것들, 실패 } = await 목록(H, 지갑.결제);
    if (실패) { console.log(`   🟡 경보 목록을 못 봤다(${실패}) — 예산 문이 꺼져 있으면 «경보가 하나도 없다»는 뜻이다`); continue; }
    console.log(`   경보 ${것들.length}개`);
    것들.forEach((b) => console.log(한줄(b)));
  }

  console.log('\n' + '═'.repeat(58));
  console.log('⚠ 달마다 0으로 돌아간다(calendarPeriod=MONTH).');
  console.log('⚠ «진짜 도착하나»는 아직 안 재봤다 — 시험 발송 주소가 이 통로에 없다.');
  console.log('   첫 진짜 알림이 그것을 가른다. 문턱에 닿았는데 메일이 없으면 채널을 의심한다.\n');
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
