#!/usr/bin/env node
/**
 * 라디오 서버에 «들어가는 열쇠»를 붙인다 — SSH 공개키를 서버 메타데이터에 넣고 방화벽을 연다.
 *
 * 🔑 왜 필요한가:
 *   서버를 만들어도 안에 못 들어가면 아무것도 못 올린다. 구글은 `gcloud` CLI 로 이걸 해 주는데
 *   이 기계에는 그것이 없다(09-06 실측). ⇒ 메타데이터에 공개키를 직접 넣고 보통 `ssh` 로 들어간다.
 *
 * 🚪 22번 기준(10-20 결정 「라디오 서버 · SSH 22번 · 회사 서버와 같은 기준」):
 *   회사 서버와 같이 인터넷 전체(0.0.0.0/0)에 열어 두고 열쇠 인증에 맡긴다 — 서버 sshd 는 공개키만 받는다.
 *   10-17 의 「PC 공인 IP와 구글 IAP만」 좁히기는 장소를 옮길 때마다 막혀서 하지 않는다.
 *   상태 보기는 출발지가 이 기준보다 좁으면 알리기만 한다 — 이미 있는 규칙은 --붙이기도 바꾸지 않는다.
 *
 * 🙋 누가 돌리나(10-20 판단 위임): 상태 보기는 GCP API 를 읽기만 하니 Claude 가 돌린다.
 *   --붙이기는 열쇠를 넣고(권한 부여) 문을 여는 접근 설정이라 유호님이 명령 한 줄로 실행하고,
 *   Claude 는 그 뒤 상태 보기와 `ssh synk-radio "uptime"` 으로 확인한다.
 *
 * 🔴 자격증명 규율: 이 도구는 **공개키만** 만진다(비밀키는 이 기계 밖으로 안 나간다).
 *   화면에도 값을 안 찍는다.
 *
 * 쓰는 법:
 *   node tools/라디오서버열쇠.js          # 지금 상태만 본다(이 PC ~/.ssh/config 의 synk-radio 별칭도 본다)
 *   node tools/라디오서버열쇠.js --붙이기  # 공개키를 넣고, SSH 문이 없으면 인터넷 전체로 연다
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

/** 이 PC ~/.ssh/config 의 `Host synk-radio` 블록에서 HostName 을 읽는다. 파일이나 블록이 없으면 null.
 *  주소를 화면에 더 찍지 않으려고 지금 주소와 같은지만 견준다. */
function 별칭읽기(경로) {
  let 글;
  try { 글 = fs.readFileSync(경로, 'utf8'); } catch { return null; }
  let 찾음 = null;
  for (const 원 of 글.split(/\r?\n/)) {
    const m = 원.trim().match(/^([A-Za-z]+)(?:\s*=\s*|\s+)(.+)$/);
    if (!m) continue;                                              // 빈 줄·주석(#…)
    const 키 = m[1].toLowerCase();
    const 값 = m[2].trim().replace(/^"(.*)"$/, '$1');
    if (키 === 'host' || 키 === 'match') {
      if (찾음) break;                                             // 다음 블록이 시작됐다
      if (키 === 'host' && 값.split(/\s+/).includes('synk-radio')) 찾음 = { 호스트이름: null };
    } else if (찾음 && 키 === 'hostname' && !찾음.호스트이름) 찾음.호스트이름 = 값;
  }
  return 찾음;
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
  for (const f of ssh문) {
    const 출발지 = f.sourceRanges || [];
    console.log(`    ${f.name}${f.disabled ? '(꺼짐)' : ''} 출발지 = ${출발지.join(', ') || '(없음)'}`);
  }
  // 10-20 기준: 회사 서버와 같이 인터넷 전체에 열고 열쇠 인증에 맡긴다. 좁으면 알리기만 한다(넓히기도 접근 설정이라 유호님 몫).
  if (ssh문.length) {
    const 기준대로 = ssh문.some((f) => !f.disabled && (f.sourceRanges || []).includes('0.0.0.0/0'));
    console.log(`  22번 기준(10-20 · 인터넷 전체 + 열쇠 인증) = ${기준대로 ? '맞다' : '⚠ 출발지가 좁다 — 장소를 옮기면 22번이 시간 초과로 막힌다'}`);
  }

  // 저장소의 라디오 스크립트는 주소·계정 대신 SSH 별칭 synk-radio만 쓴다(10-17). 주소는 이 PC의 ~/.ssh/config 한 곳에 둔다.
  const 별칭 = 별칭읽기(path.join(os.homedir(), '.ssh', 'config'));
  console.log(`  이 PC 별칭(~/.ssh/config 의 Host synk-radio) = ${
    !별칭 ? '❌ 없다 — 아래 블록을 넣는다(없으면 라디오 스크립트가 Could not resolve hostname synk-radio 로 끝난다)'
      : 별칭.호스트이름 === 주소 ? '있다 · 주소 같음'
        : '⚠ 있지만 HostName 이 지금 주소와 다르다 — 아래 블록대로 고친다'}`);
  console.log(`\n~/.ssh/config 의 별칭(주소가 바뀌면 여기만 고친다):\n  Host synk-radio\n    HostName ${주소}\n    User ${사용자}\n    IdentityFile ~/.ssh/synk_radio\n    StrictHostKeyChecking accept-new`);

  if (!붙이기) { console.log('\n붙이려면: node tools/라디오서버열쇠.js --붙이기   (열쇠·문을 바꾸는 접근 설정이라 유호님이 실행)\n'); return; }

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

  // ② SSH 문 열기 — 없으면 10-20 기준(인터넷 전체 + 열쇠 인증)으로 만든다. 있는 규칙은 좁든 넓든 건드리지 않는다.
  if (!ssh문.length) {
    const r = await 부르기(tok, 'POST', `https://compute.googleapis.com/compute/v1/projects/${프로젝트}/global/firewalls`, {
      name: 'allow-ssh',
      network: `projects/${프로젝트}/global/networks/default`,
      direction: 'INGRESS',
      sourceRanges: ['0.0.0.0/0'],
      allowed: [{ IPProtocol: 'tcp', ports: ['22'] }],
      description: 'SYNK 라디오 서버에 들어가는 문(22번) — 10-20 기준: 인터넷 전체 + 열쇠 인증',
    });
    console.log(`② SSH 문 열기 ${r.코드}${r.ok ? ' ✅' : ' · ' + JSON.stringify(r.j).slice(0, 200)}`);
  } else console.log('② SSH 문은 이미 열려 있다');

  console.log(`\n📏 들어가 보는 법(열쇠가 퍼지는 데 십수 초 걸린다):`);
  console.log(`   ssh synk-radio "uptime"   (별칭은 위 ~/.ssh/config 블록)\n`);
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
