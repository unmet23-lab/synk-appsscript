#!/usr/bin/env node
/**
 * 라디오24 송출 서버를 구글 클라우드에 세운다 — unmet23 계정 · 무료 등급.
 *
 * 🔑 값 (09-06 공식 요금표 실측):
 *   서버(e2-micro 1대) 0원 · 디스크 30GB 0원 · 유튜브로 나가는 데이터 0원
 *   🔴 **인터넷 주소만 월 ≈₩5,300**(시간당 $0.005) — 무료 등급이 안 덮는 유일한 자리
 *
 * 🔴 왜 «새 프로젝트»에 세우나:
 *   기존 `synk-radio24` 프로젝트에 결제를 붙이면 **공짜 「글」 열쇠가 죽는다**(결정 09-03).
 *   기존 `gen-lang-client-…` 은 굽기 자리라 섞인다. ⇒ 라디오 전용 방을 따로 판다.
 *
 * 🔑 무료 등급 조건(공식): 비선점형 `e2-micro` **1대** · `us-west1`/`us-central1`/`us-east1` 중 하나
 *   · 표준 영구 디스크 30GB 까지 · **결제 계정당 1대**.
 *
 * 쓰는 법:
 *   node tools/라디오서버세우기.js --점검   # 아무것도 안 바꾸고 지금 상태만 본다
 *   node tools/라디오서버세우기.js --세우기  # 프로젝트 → 결제 → 문 → 서버
 *   node tools/라디오서버세우기.js --지우기  # 서버를 지운다(주소도 같이 놓는다)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const 자격경로 = path.join(os.homedir(), '.clasprc.json'); // unmet23 (배포 자격 · 읽기만)
const 결제 = '0161FA-7C996C-F1B948';
const 청구지 = 'gen-lang-client-0106203750';               // 이 계정에서 이미 결제가 켜진 방(헤더용)
const 프로젝트 = 'synk-radio-live';
const 프로젝트이름 = 'SYNK Radio Live';                     // ⚠ 한글은 400 이다
const 지역 = 'us-central1';
const 존 = 'us-central1-a';                                 // 무료 등급이 되는 세 리전 중 하나(아이오와)
const 서버이름 = 'synk-radio-1';
const 머신 = 'e2-micro';
const 디스크GB = 30;

/* 서버가 처음 켜질 때 한 번 도는 준비 스크립트. 송출에 필요한 것만 깐다. */
const 시작스크립트 = `#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ffmpeg curl ca-certificates
# 노드 24 (라디오 봇이 쓰는 판)
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
mkdir -p /opt/synk-radio/팩 /opt/synk-radio/송출
echo "준비 끝 $(date -Is)" > /opt/synk-radio/준비.txt
`;

const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

async function 토큰() {
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
  if (!답.access_token) throw new Error(`토큰 갱신 실패 ${r.status} — npx clasp login`);
  return 답.access_token;
}

async function 부르기(tok, 방법, url, 몸, 헤더청구지) {
  const h = { authorization: `Bearer ${tok}`, 'content-type': 'application/json' };
  if (헤더청구지) h['x-goog-user-project'] = 헤더청구지;
  const r = await fetch(url, { method: 방법, headers: h, body: 몸 ? JSON.stringify(몸) : undefined });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { _raw: txt.slice(0, 300) }; }
  return { ok: r.ok, 코드: r.status, j };
}

async function 서버보기(tok) {
  const r = await 부르기(tok, 'GET', `https://compute.googleapis.com/compute/v1/projects/${프로젝트}/zones/${존}/instances/${서버이름}`);
  if (!r.ok) return null;
  const ip = r.j.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;
  return { 상태: r.j.status, 주소: ip, 머신: (r.j.machineType || '').split('/').pop(), 만든때: r.j.creationTimestamp };
}

async function 점검(tok) {
  console.log('\n🔍 지금 상태\n' + '─'.repeat(52));
  const p = await 부르기(tok, 'GET', `https://cloudresourcemanager.googleapis.com/v1/projects/${프로젝트}`, null, 청구지);
  console.log(`  방(프로젝트) ${프로젝트} — ${p.ok ? `있다 (${p.j.lifecycleState})` : '없다'}`);
  if (!p.ok) return false;
  const b = await 부르기(tok, 'GET', `https://cloudbilling.googleapis.com/v1/projects/${프로젝트}/billingInfo`, null, 청구지);
  console.log(`  결제 ${b.ok ? (b.j.billingEnabled ? `켜짐 (${b.j.billingAccountName})` : '꺼짐') : '못 봄 ' + b.코드}`);
  const s = await 부르기(tok, 'GET', `https://serviceusage.googleapis.com/v1/projects/${프로젝트}/services/compute.googleapis.com`);
  console.log(`  서버 기능(compute) ${s.ok ? s.j.state : '못 봄 ' + s.코드}`);
  const v = await 서버보기(tok);
  console.log(`  서버 ${v ? `🟢 ${v.상태} · ${v.머신} · 주소 ${v.주소 || '(없음)'} · 만든 때 ${v.만든때}` : '없다'}`);
  console.log('─'.repeat(52));
  return true;
}

(async () => {
  const tok = await 토큰();

  if (process.argv.includes('--지우기')) {
    const r = await 부르기(tok, 'DELETE', `https://compute.googleapis.com/compute/v1/projects/${프로젝트}/zones/${존}/instances/${서버이름}`);
    console.log(`\n서버 지우기 ${r.코드}${r.ok ? ' — 지우는 중이다(주소도 같이 놓인다)' : ' · ' + JSON.stringify(r.j).slice(0, 200)}\n`);
    return;
  }

  if (!process.argv.includes('--세우기')) { await 점검(tok); console.log('\n세우려면: node tools/라디오서버세우기.js --세우기\n'); return; }

  // ① 방 만들기
  let p = await 부르기(tok, 'GET', `https://cloudresourcemanager.googleapis.com/v1/projects/${프로젝트}`, null, 청구지);
  if (!p.ok) {
    console.log(`\n① 방을 판다: ${프로젝트}`);
    const r = await 부르기(tok, 'POST', 'https://cloudresourcemanager.googleapis.com/v1/projects',
      { projectId: 프로젝트, name: 프로젝트이름 }, 청구지);
    if (!r.ok) throw new Error(`방 만들기 실패 ${r.코드}: ${JSON.stringify(r.j).slice(0, 300)}`);
    console.log('   만드는 중… 25초 기다린다');
    await 잠깐(25000);
  } else console.log(`\n① 방이 이미 있다: ${프로젝트}`);

  // ② 결제 붙이기 — 이것이 「어느 계정이 내나」를 정한다
  console.log(`② 결제를 붙인다 → ${결제}`);
  const b = await 부르기(tok, 'PUT', `https://cloudbilling.googleapis.com/v1/projects/${프로젝트}/billingInfo`,
    { billingAccountName: `billingAccounts/${결제}` }, 청구지);
  if (!b.ok) throw new Error(`결제 붙이기 실패 ${b.코드}: ${JSON.stringify(b.j).slice(0, 300)}`);
  console.log(`   결제 ${b.j.billingEnabled ? '켜졌다' : '안 켜졌다'}`);

  // ③ 문 켜기 — 켠 직후엔 아직 403 이라 전파를 기다린다
  console.log('③ 서버 기능(compute)을 켠다');
  await 부르기(tok, 'POST', `https://serviceusage.googleapis.com/v1/projects/${프로젝트}/services/compute.googleapis.com:enable`, {});
  console.log('   전파를 기다린다(40초)');
  await 잠깐(40000);

  // ④ 서버 만들기
  const 있나 = await 서버보기(tok);
  if (있나) { console.log(`④ 서버가 이미 있다 — ${있나.상태} · 주소 ${있나.주소 || '(없음)'}`); }
  else {
    console.log(`④ 서버를 만든다: ${서버이름} (${머신} · ${존} · 디스크 ${디스크GB}GB)`);
    const 몸 = {
      name: 서버이름,
      machineType: `zones/${존}/machineTypes/${머신}`,
      disks: [{
        boot: true, autoDelete: true,
        initializeParams: {
          sourceImage: 'projects/debian-cloud/global/images/family/debian-12',
          diskSizeGb: String(디스크GB),
          diskType: `zones/${존}/diskTypes/pd-standard`,
        },
      }],
      networkInterfaces: [{
        network: 'global/networks/default',
        accessConfigs: [{ name: 'External NAT', type: 'ONE_TO_ONE_NAT', networkTier: 'PREMIUM' }],
      }],
      metadata: { items: [{ key: 'startup-script', value: 시작스크립트 }] },
      tags: { items: ['synk-radio'] },
      scheduling: { preemptible: false, automaticRestart: true, onHostMaintenance: 'MIGRATE' },
      labels: { 쓰임: 'radio24' },
    };
    const r = await 부르기(tok, 'POST', `https://compute.googleapis.com/compute/v1/projects/${프로젝트}/zones/${존}/instances`, 몸);
    if (!r.ok) throw new Error(`서버 만들기 실패 ${r.코드}: ${JSON.stringify(r.j).slice(0, 500)}`);
    console.log('   만드는 중… 30초 기다린다');
    await 잠깐(30000);
  }

  await 점검(tok);
  console.log('\n⚠ 지금부터 인터넷 주소 값이 붙는다 — 월 ≈₩5,300 (크레딧이 덮는다 · unmet23 마감 11-13)');
  console.log('⚠ 준비 스크립트(ffmpeg·node 설치)가 서버 안에서 도는 데 몇 분 걸린다.');
  console.log('📒 장부에 적을 것: docs/_ops/돈장부.json 의 «라디오24 송출 서버» → 상태·지금 나가는 돈\n');
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
