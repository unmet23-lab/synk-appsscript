#!/usr/bin/env node
/**
 * 돈 점검 — 「지금 나갈 돈이 있나」를 한 번에 센다.
 *
 * 🔑 왜 있나:
 *   09-06 에 같은 무늬로 두 번 틀렸다 — 기억에 적힌 «옛 숫자»를 지금 것처럼 말했다
 *   (「9월 예상 ₩64,047」→ 실제 ₩7,172 · 「4K 488장 남음」→ 이미 348장 전량 완료).
 *   ⇒ 돈 이야기는 기억에 묻지 말고 **매번 세어서** 답한다. 이 도구가 그 자다.
 *
 * 무엇을 보나(지갑 둘 × 프로젝트 전부):
 *   ① 지갑이 열려 있나 · ② 어느 방(프로젝트)에 결제가 붙어 있나
 *   ③ 그 방에 «계속 돈 먹는 것»이 도나(VM · SQL · 저장소 · 고정 IP)
 *   ④ 돈 경보가 걸려 있나 · ⑤ 최근에 부른 것이 있나(지금도 도나)
 *
 * 쓰는 법:  node tools/돈점검.js
 *
 * ⚠ 이 도구가 «안» 보는 것 — 여기서 초록이어도 이것들은 따로 봐야 한다:
 *   · 구글 밖 벤더(허깅페이스 · 앤트로픽 · 오픈AI 등)
 *   · 크레딧 잔액 자체(그 자는 `node tools/구글크레딧.js`)
 *   · 아직 청구서에 안 잡힌 오늘치(청구는 며칠 늦게 따라온다)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/** 볼 지갑들. 자격 파일이 다르면 보는 눈도 다르다. */
const 지갑들 = [
  { 이름: 'unmet23 (배포·옛 굽기)', 결제: '0161FA-7C996C-F1B948', 자격: path.join(os.homedir(), '.clasprc.json'), 청구지: 'gen-lang-client-0106203750' },
  { 이름: '77yuhbs (지금 굽는 곳)', 결제: '013A36-17619E-CE0D07', 자격: path.join(os.homedir(), '.synk-vertex-oauth.json'), 청구지: null },
];

/** 켜져 있으면 «계속» 돈이 나갈 수 있는 문들. 안 켜져 있으면 그 값은 0이다. */
const 무서운문 = [
  'compute.googleapis.com', 'sqladmin.googleapis.com', 'run.googleapis.com',
  'container.googleapis.com', 'redis.googleapis.com', 'file.googleapis.com',
];

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

async function 가져오기(url, tok, 청구지) {
  const h = { authorization: `Bearer ${tok}` };
  if (청구지) h['x-goog-user-project'] = 청구지;
  const r = await fetch(url, { headers: h });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = null; }
  return { ok: r.ok, 코드: r.status, j };
}

(async () => {
  console.log('\n💰 돈 점검 — 지금 나갈 돈이 있나\n' + '═'.repeat(58));
  let 경고 = [];

  for (const 지갑 of 지갑들) {
    console.log(`\n■ ${지갑.이름}`);
    let tok, 프로;
    try { ({ tok, 프로 } = await 토큰(지갑.자격)); }
    catch (e) { console.log(`   🔴 자격을 못 열었다: ${e.message}`); 경고.push(`${지갑.이름} 자격 못 엶`); continue; }
    const 청구지 = 지갑.청구지 || 프로;

    // ① 지갑
    const 계정 = await 가져오기(`https://cloudbilling.googleapis.com/v1/billingAccounts/${지갑.결제}`, tok, 청구지);
    console.log(`   지갑 열림 = ${계정.j?.open === true ? '예' : 계정.j?.open === false ? '아니오(닫힘)' : '못 읽음 ' + 계정.코드}`);

    // ② 붙은 방
    const 방들 = await 가져오기(`https://cloudbilling.googleapis.com/v1/billingAccounts/${지갑.결제}/projects`, tok, 청구지);
    const 목록 = 방들.j?.projectBillingInfo || [];
    const 켜진방 = 목록.filter((p) => p.billingEnabled);
    console.log(`   결제가 켜진 방 = ${켜진방.length}개 / 붙은 방 ${목록.length}개`);
    for (const p of 목록) console.log(`      · ${p.projectId} · 결제 ${p.billingEnabled ? '켜짐' : '꺼짐'}`);

    // ③ 그 방에 «계속 돈 먹는 것»이 도나
    for (const p of 켜진방) {
      const 문 = await 가져오기(
        `https://serviceusage.googleapis.com/v1/projects/${p.projectId}/services?filter=state:ENABLED&pageSize=200`, tok, null);
      if (!문.ok) { console.log(`      ⓘ ${p.projectId} 의 문 목록은 못 봤다(${문.코드}) — Service Usage 가 꺼져 있으면 그 자체로 «안 쓴다»는 뜻이다`); continue; }
      const 켠것 = (문.j.services || []).map((s) => (s.config?.name || s.name || '').split('/').pop());
      const 걸린것 = 무서운문.filter((f) => 켠것.includes(f));
      console.log(`      ⓘ ${p.projectId} · 켜진 문 ${켠것.length}개 · 그중 계속 돈 먹을 수 있는 것 ${걸린것.length}개`
        + (걸린것.length ? `: ${걸린것.join(', ')}` : ''));

      if (켠것.includes('compute.googleapis.com')) {
        const vm = await 가져오기(`https://compute.googleapis.com/compute/v1/projects/${p.projectId}/aggregated/instances`, tok, null);
        const 도는것 = [];
        for (const [zone, v] of Object.entries(vm.j?.items || {})) {
          for (const i of (v.instances || [])) 도는것.push(`${i.name}(${i.status}·${zone.split('/').pop()})`);
        }
        console.log(`         VM = ${도는것.length ? '🔴 ' + 도는것.join(', ') : '0대 (도는 것 없다)'}`);
        if (도는것.length) 경고.push(`${p.projectId} 에 VM ${도는것.length}대가 돈다`);
      }
    }

    // ④ 돈 경보
    const 예산 = await 가져오기(`https://billingbudgets.googleapis.com/v1/billingAccounts/${지갑.결제}/budgets`, tok, 청구지);
    if (!예산.ok) {
      console.log(`   🟡 돈 경보 = 못 봤다(${예산.코드}) — 예산 문이 꺼져 있으면 «경보가 하나도 없다»는 뜻이다`);
      경고.push(`${지갑.이름}: 돈 경보를 못 확인했다(문이 꺼져 있을 수 있다)`);
    } else {
      const bs = 예산.j.budgets || [];
      console.log(`   돈 경보 = ${bs.length}개`);
      for (const b of bs) {
        const 채널 = (b.notificationsRule?.monitoringNotificationChannels || []).length;
        console.log(`      · ${b.displayName} · 가는 곳 ${채널 ? '따로 지정됨' : '계정 주인'}`);
      }
      if (!bs.length) 경고.push(`${지갑.이름}: 돈 경보가 0개다`);
    }

    // ⑤ 최근에 부른 것이 있나(지금도 도나)
    if (프로 || 지갑.청구지) {
      const 잴방 = 프로 || 지갑.청구지;
      const 끝 = new Date(); const 시작 = new Date(끝 - 3 * 3600 * 1000);
      const q = new URLSearchParams({
        filter: 'metric.type="aiplatform.googleapis.com/publisher/online_serving/model_invocation_count"',
        'interval.startTime': 시작.toISOString(), 'interval.endTime': 끝.toISOString(),
        'aggregation.alignmentPeriod': '3600s', 'aggregation.perSeriesAligner': 'ALIGN_SUM',
        'aggregation.crossSeriesReducer': 'REDUCE_SUM',
      });
      const m = await 가져오기(`https://monitoring.googleapis.com/v3/projects/${잴방}/timeSeries?${q}`, tok, 청구지);
      if (!m.ok) { console.log(`   최근 3시간 부른 수 = 못 봤다(${m.코드})`); }
      else {
        let 합 = 0;
        for (const ts of (m.j.timeSeries || [])) for (const p of (ts.points || [])) 합 += Number(p.value.int64Value ?? p.value.doubleValue ?? 0);
        console.log(`   최근 3시간 부른 수 = ${합}${합 ? ' 🔴 지금도 뭔가 돌고 있다' : ' (조용하다)'}`);
        if (합) 경고.push(`${지갑.이름}: 최근 3시간에 ${합}번 불렀다`);
      }
    }
  }

  console.log('\n' + '═'.repeat(58));
  if (경고.length) {
    console.log('🔴 살펴볼 것:');
    경고.forEach((w) => console.log('   · ' + w));
  } else {
    console.log('✅ 계속 돈을 먹는 것은 없다.');
  }
  console.log('\n⚠ 이 점검이 «안» 보는 것 — 따로 봐야 한다:');
  console.log('   · 구글 밖 벤더(허깅페이스 · 앤트로픽 등) · 크레딧 잔액(node tools/구글크레딧.js)');
  console.log('   · 아직 청구서에 안 잡힌 오늘치(청구는 며칠 늦게 따라온다)\n');
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
