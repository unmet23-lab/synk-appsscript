#!/usr/bin/env node
/**
 * 라디오 서버에 «들어가는 열쇠»를 붙인다 — SSH 공개키를 서버 메타데이터에 넣고 방화벽을 연다.
 *
 * 🔑 왜 필요한가:
 *   서버를 만들어도 안에 못 들어가면 아무것도 못 올린다. 구글은 `gcloud` CLI 로 이걸 해 주는데
 *   이 기계에는 그것이 없다(09-06 실측). ⇒ 메타데이터에 공개키를 직접 넣고 보통 `ssh` 로 들어간다.
 *
 * 🔴 자격증명 규율: 이 도구는 **공개키만** 만진다(비밀키는 이 기계 밖으로 안 나간다).
 *   화면에도 값을 안 찍는다.
 *
 * 쓰는 법:
 *   node tools/라디오서버열쇠.js          # 지금 상태만 본다
 *   node tools/라디오서버열쇠.js --붙이기  # 공개키를 넣고 SSH 문을 연다
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const 자격경로 = path.join(os.homedir(), '.clasprc.json'); // unmet23 · 읽기만
const 프로젝트 = 'synk-radio-live';
const 존 = 'us-central1-a';
const 서버이름 = 'synk-radio-1';
const 사용자 = 'synk';
const 공개키경로 = path.join(os.homedir(), '.ssh', 'synk_radio.pub');

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
  if (!답.access_token) throw new Error(`토큰 갱신 실패 ${r.status}`);
  return 답.access_token;
}

async function 부르기(tok, 방법, url, 몸) {
  const r = await fetch(url, {
    method: 방법,
    headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: 몸 ? JSON.stringify(몸) : undefined,
  });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { _raw: txt.slice(0, 300) }; }
  return { ok: r.ok, 코드: r.status, j };
}

(async () => {
  const tok = await 토큰();
  const 붙이기 = process.argv.includes('--붙이기');

  const 서버 = await 부르기(tok, 'GET', `https://compute.googleapis.com/compute/v1/projects/${프로젝트}/zones/${존}/instances/${서버이름}`);
  if (!서버.ok) throw new Error(`서버를 못 찾았다 ${서버.코드} — 먼저 node tools/라디오서버세우기.js --세우기`);
  const 주소 = 서버.j.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;
  const 지금키 = (서버.j.metadata?.items || []).find((x) => x.key === 'ssh-keys');
  console.log(`\n서버 ${서버이름} · ${서버.j.status} · 주소 ${주소}`);
  console.log(`  들어가는 열쇠(ssh-keys) = ${지금키 ? '이미 붙어 있다' : '아직 없다'}`);

  const 방화벽 = await 부르기(tok, 'GET', `https://compute.googleapis.com/compute/v1/projects/${프로젝트}/global/firewalls`);
  const ssh문 = (방화벽.j.items || []).filter((f) => (f.allowed || []).some((a) => (a.ports || []).includes('22')));
  console.log(`  SSH 문(22번) = ${ssh문.length ? ssh문.map((f) => f.name).join(', ') : '❌ 안 열려 있다'}`);

  if (!붙이기) { console.log('\n붙이려면: node tools/라디오서버열쇠.js --붙이기\n'); return; }

  // ① 공개키 넣기 — 기존 메타데이터를 지우지 않고 이 키만 더한다
  if (!fs.existsSync(공개키경로)) throw new Error(`공개키가 없다: ${공개키경로}\n   만드는 법: ssh-keygen -t ed25519 -f ~/.ssh/synk_radio -N ""`);
  const 공개키 = fs.readFileSync(공개키경로, 'utf8').trim();
  const 한줄 = `${사용자}:${공개키}`;
  if (지금키 && 지금키.value.includes(공개키.split(' ')[1].slice(0, 20))) {
    console.log('\n① 이 열쇠는 이미 붙어 있다(겹쳐 넣지 않는다)');
  } else {
    const 새값 = 지금키 ? `${지금키.value}\n${한줄}` : 한줄;
    const 항목 = (서버.j.metadata?.items || []).filter((x) => x.key !== 'ssh-keys').concat([{ key: 'ssh-keys', value: 새값 }]);
    const r = await 부르기(tok, 'POST',
      `https://compute.googleapis.com/compute/v1/projects/${프로젝트}/zones/${존}/instances/${서버이름}/setMetadata`,
      { fingerprint: 서버.j.metadata.fingerprint, items: 항목 });
    console.log(`\n① 열쇠 붙이기 ${r.코드}${r.ok ? ' ✅' : ' · ' + JSON.stringify(r.j).slice(0, 200)}`);
  }

  // ② SSH 문 열기 — 없으면 만든다
  if (!ssh문.length) {
    const r = await 부르기(tok, 'POST', `https://compute.googleapis.com/compute/v1/projects/${프로젝트}/global/firewalls`, {
      name: 'allow-ssh',
      network: `projects/${프로젝트}/global/networks/default`,
      direction: 'INGRESS',
      sourceRanges: ['0.0.0.0/0'],
      allowed: [{ IPProtocol: 'tcp', ports: ['22'] }],
      description: 'SYNK 라디오 서버에 들어가는 문(22번)',
    });
    console.log(`② SSH 문 열기 ${r.코드}${r.ok ? ' ✅' : ' · ' + JSON.stringify(r.j).slice(0, 200)}`);
  } else console.log('② SSH 문은 이미 열려 있다');

  console.log(`\n📏 들어가 보는 법(열쇠가 퍼지는 데 십수 초 걸린다):`);
  console.log(`   ssh -i ~/.ssh/synk_radio -o StrictHostKeyChecking=no ${사용자}@${주소} "uptime"\n`);
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
