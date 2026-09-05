#!/usr/bin/env node
/**
 * 구글 계정 세우기 — 붙인 계정(tools/구글계정붙이기.js)에 굽기가 돌 자리를 만든다.
 *
 * 하는 일 넷(전부 손 없이):
 *   ① 그 계정의 결제 계정을 찾는다 → 크레딧이 붙은 자리다
 *   ② 프로젝트를 찾는다(없으면 만든다)
 *   ③ 그 프로젝트에 결제 계정을 붙이고 Vertex 문(aiplatform)을 켠다
 *   ④ 어느 프로젝트를 쓸지 자격 파일에 적어 둔다 ⇒ 굽기 도구가 그걸 보고 간다
 *
 * 🔴 문 켜기와 결제 조회는 «청구지 헤더»가 서로 반대다(09-04 실측):
 *   serviceusage = 청구지를 «안» 준다 · cloudbilling·cloudresourcemanager = 「줘야」 한다.
 *
 * 쓰는 법: node tools/구글계정세우기.js [--프로젝트 <id>] [--재보기]
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const 자격파일 = process.env.SYNK_VERTEX_OAUTH || path.join(os.homedir(), '.synk-vertex-oauth.json');
const 토큰캐시 = path.join(os.tmpdir(), 'synk_vertex_token.json');

function 죽는다(줄) { console.error(`\n🔴 ${줄}\n`); process.exit(1); }
const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

async function 토큰() {
  if (!fs.existsSync(자격파일)) {
    죽는다(`붙인 계정이 없다: ${자격파일}\n   먼저: node tools/구글계정붙이기.js --계정 <메일주소>`);
  }
  const j = JSON.parse(fs.readFileSync(자격파일, 'utf8'));
  const t = (j.tokens && j.tokens.default) || j;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' }),
  });
  const 답 = await res.json().catch(() => ({}));
  if (!res.ok || !답.access_token) 죽는다(`토큰 갱신 실패 ${res.status}: ${답.error_description || 답.error || ''}`);
  return 답.access_token;
}

/** 청구지를 줄지 말지가 통로마다 다르다. 줘야 하는 곳에 안 주면 403, 안 줘야 하는 곳에 주면 403 이다. */
async function 부르기(주소, { tok, 청구지, 방법 = 'GET', 몸 } = {}) {
  const 머리 = { authorization: `Bearer ${tok}` };
  if (청구지) 머리['x-goog-user-project'] = 청구지;
  if (몸) 머리['content-type'] = 'application/json';
  const res = await fetch(주소, { method: 방법, headers: 머리, body: 몸 ? JSON.stringify(몸) : undefined });
  const 답 = await res.json().catch(() => ({}));
  return { ok: res.ok, 코드: res.status, 답 };
}

(async () => {
  const 인자 = process.argv.slice(2);
  const 고른프로젝트 = 인자.includes('--프로젝트') ? 인자[인자.indexOf('--프로젝트') + 1] : null;
  const tok = await 토큰();
  const j = JSON.parse(fs.readFileSync(자격파일, 'utf8'));
  const t = (j.tokens && j.tokens.default) || j;
  const 누구 = (() => { try { return JSON.parse(Buffer.from(String(t.id_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).email; } catch { return '(못 읽음)'; } })();
  console.log(`\n👤 붙어 있는 계정 = ${누구}`);

  // ── ② 프로젝트 먼저 찾는다(청구지로 쓸 자리가 있어야 결제 조회가 된다)
  let 프로젝트 = 고른프로젝트;
  // 🔴 닭과 달걀: 목록을 보려면 청구지가 있어야 하고, 청구지는 프로젝트다.
  //    ⇒ 첫 판은 «아는 프로젝트»를 청구지로 준다(--프로젝트 또는 앞서 적어 둔 값). 그것도 없으면 화면으로 한 번 읽어야 한다.
  const 청구지 = 고른프로젝트 || (() => { try { return JSON.parse(fs.readFileSync(자격파일, 'utf8')).프로젝트 || undefined; } catch { return undefined; } })();
  const 프목 = await 부르기('https://cloudresourcemanager.googleapis.com/v1/projects?filter=lifecycleState:ACTIVE', { tok, 청구지 });
  const 있는것 = (프목.답.projects || []).map((p) => ({ id: p.projectId, 번호: p.projectNumber, 이름: p.name }));
  if (프목.ok) {
    console.log(`\n📦 프로젝트 ${있는것.length}개`);
    있는것.forEach((p) => console.log(`   · ${p.id}  (번호 ${p.번호} · ${p.이름})`));
  } else {
    console.log(`\n⚠ 프로젝트 목록을 못 봤다 ${프목.코드}: ${프목.답.error?.message || ''}`);
  }
  if (!프로젝트 && 있는것.length) 프로젝트 = 있는것[0].id;

  if (!프로젝트) {
    프로젝트 = `synk-bake-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`\n🆕 프로젝트가 없어 만든다: ${프로젝트}  (이름에 한글은 못 쓴다 — 400)`);
    const 만듦 = await 부르기('https://cloudresourcemanager.googleapis.com/v1/projects', { tok, 방법: 'POST', 몸: { projectId: 프로젝트, name: 'SYNK bake' } });
    if (!만듦.ok) 죽는다(`프로젝트 만들기 실패 ${만듦.코드}: ${만듦.답.error?.message || ''}`);
    for (let i = 0; i < 20; i++) { // 만들기는 «뒤에서 도는 작업»이다 — 다 될 때까지 기다린다
      await 잠깐(3000);
      const 봄 = await 부르기(`https://cloudresourcemanager.googleapis.com/v1/projects/${프로젝트}`, { tok });
      if (봄.ok && 봄.답.lifecycleState === 'ACTIVE') { console.log('   ✅ 섰다'); break; }
      process.stdout.write('.');
    }
  }
  console.log(`\n🎯 쓸 프로젝트 = ${프로젝트}`);

  // ── ① 결제 계정 = 크레딧이 붙은 자리
  const 결목 = await 부르기('https://cloudbilling.googleapis.com/v1/billingAccounts', { tok, 청구지: 프로젝트 });
  if (!결목.ok) {
    console.log(`\n⚠ 결제 계정을 못 봤다 ${결목.코드}: ${결목.답.error?.message || ''}`);
    console.log('   (cloudbilling 문이 아직 안 켜졌을 수 있다 — 아래에서 켠 뒤 --재보기 로 다시 돈다)');
  }
  const 결제들 = (결목.답.billingAccounts || []).filter((b) => b.open);
  결제들.forEach((b) => console.log(`   💳 ${b.name}  (${b.displayName})`));
  const 결제 = 결제들[0];

  // ── ③ 문 켜기 (청구지를 «안» 준다) + 결제 붙이기 (청구지를 «준다»)
  const 켤것 = ['aiplatform.googleapis.com', 'cloudbilling.googleapis.com', 'cloudresourcemanager.googleapis.com', 'serviceusage.googleapis.com'];
  console.log('\n🔌 문 켜기');
  for (const api of 켤것) {
    const r = await 부르기(`https://serviceusage.googleapis.com/v1/projects/${프로젝트}/services/${api}:enable`, { tok, 방법: 'POST', 몸: {} });
    console.log(`   ${r.ok ? '✅' : '⚠ ' + r.코드} ${api}${r.ok ? '' : ' — ' + (r.답.error?.message || '').slice(0, 120)}`);
  }

  if (결제) {
    const 붙임 = await 부르기(`https://cloudbilling.googleapis.com/v1/projects/${프로젝트}/billingInfo`, {
      tok, 청구지: 프로젝트, 방법: 'PUT', 몸: { billingAccountName: 결제.name },
    });
    console.log(`\n💳 결제 붙이기 ${붙임.ok ? '✅ 됐다' : '⚠ ' + 붙임.코드 + ' ' + (붙임.답.error?.message || '').slice(0, 160)}`);
  } else {
    console.log('\n⚠ 붙일 결제 계정을 못 찾았다 — 크레딧이 그 계정에 있는지 콘솔에서 봐야 한다.');
  }

  // ── ④ 어디로 갈지 자격 파일에 적어 둔다(굽기 도구가 이걸 보고 간다 · env 를 손으로 안 켜도 된다)
  j.프로젝트 = 프로젝트;
  j.계정 = 누구;
  j.세운때 = new Date().toISOString();
  fs.writeFileSync(자격파일, JSON.stringify(j, null, 2), { mode: 0o600 });
  try { fs.unlinkSync(토큰캐시); } catch { /* 없으면 그만 */ }

  console.log(`\n✅ 적어 뒀다 — 앞으로 굽기는 ${누구} 의 ${프로젝트} 로 간다.`);
  console.log('   재보기: node tools/모델정책.js --제미나이확인 돈\n');
})().catch((e) => 죽는다(e.message));
