#!/usr/bin/env node
/**
 * 일꾼 서버 — 이 PC가 하던 무거운 일(시험 · 렌더)을 맡을 구글 클라우드 서버를 세우고 켜고 끈다(2026-11-26, 유호님 「네, 서버부터」).
 *
 * 자리: unmet23의 synk-radio-live 프로젝트(서울 asia-northeast3). unmet23은 프로젝트 한도(7개)가 차서 새 프로젝트를 못 만든다(11-26 실측).
 * 서버: n2d-highcpu-16 스팟(16 vCPU · 16GB). 11-26 요금표로 시간당 약 $0.16이다. 서울에는 더 싼 C3D · T2D가 없다.
 *   일이 없으면 30분 뒤 서버가 스스로 꺼진다(SSH 연결도 일도 없을 때). 쓰는 도구가 꺼진 서버를 켠다(약 40초).
 *   스팟은 구글이 자리가 모자라면 서버를 끈다(지우지 않는다). 켜지지 않으면 쓰는 도구는 이 PC에서 돈다.
 * 돈: 이 프로젝트는 지금 77yuhbs 결제 계정(013A36)에 붙어 있다. 그 계정의 Welcome 크레딧이 12-05에 끝나며 남은 돈이 버려지니 그때까지 그것을 쓴다.
 *   12-05부터는 --결제옮기기로 unmet23 결제 계정(0161FA, Google 개발자 프로그램 크레딧 월 $100)으로 옮긴다. 상태 보기가 그날부터 알린다.
 * 문: SSH 22번만 쓴다(10-20 결정 「회사 서버와 같은 기준」 — 인터넷 전체에 열고 열쇠 인증에만 맡긴다). 열쇠는 ~/.ssh/synk_worker(비밀키는 이 PC 밖으로 안 나간다).
 *   서버 쪽 열쇠 지문은 구글 API(게스트 속성)에서 읽어 고정한다 — 주소가 바뀌어도 처음 보는 열쇠는 받지 않는다.
 *
 *   node tools/일꾼서버.js                 지금 상태만 본다(아무것도 안 바꾼다)
 *   node tools/일꾼서버.js --세우기         compute → 문 → 서버(있는 것은 건너뛴다)
 *   node tools/일꾼서버.js --켜기 | --끄기
 *   node tools/일꾼서버.js --명령 "<셸 명령>"  서버에서 한 줄을 돌린다(꺼져 있으면 켠다 · 표준 입력은 그대로 넘긴다)
 *   node tools/일꾼서버.js --결제옮기기     이 프로젝트의 결제를 unmet23 결제 계정(0161FA)으로 옮긴다(12-05부터 · 그 전에는 --지금을 더해야 옮긴다)
 *   node tools/일꾼서버.js --시작글         서버의 시작 스크립트(다음 부팅부터)와 SSH 열쇠 줄(사용자 · 공개키, 곧바로)을 이 파일의 판으로 바꾼다
 *   node tools/일꾼서버.js --지우기         서버만 지운다(프로젝트 · 문은 남긴다)
 * 다른 도구는 require('./일꾼서버.js')의 { 주소얻기, ssh인자 }를 쓴다.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const 자격경로 = path.join(os.homedir(), '.clasprc.json'); // unmet23 — cloud-platform 범위가 들어 있다
const 결제 = '0161FA-7C996C-F1B948';                      // unmet23 결제 계정 · 개발자 프로그램 크레딧이 들어오는 곳
const 결제옮길날 = Date.parse('2026-12-05T00:00:00+09:00'); // 013A36의 Welcome 크레딧이 끝나는 날
const 청구지 = 'gen-lang-client-0106203750';                // 결제 · 프로젝트 API를 부를 때 쓰는 방
const 프로젝트 = 'synk-radio-live';
const 존후보 = ['asia-northeast3-a', 'asia-northeast3-b', 'asia-northeast3-c'];
const 머신 = 'n2d-highcpu-16';
const 디스크GB = 60;
const 쉬면끄기분 = 30;
const 서버이름 = 'synk-worker-1';
// GitHub CI의 실행 사용자와 같은 이름이다 — 이 PC 사용자 이름을 가리는 시험이 경로 속 SYNK 폴더까지 가리지 않게(11-26 tests/크레딧작업-알림고침.test.js GA10이
// 사용자 synk에서만 깨졌다). 바꾸면 --시작글로 서버의 열쇠 줄을 맞추고, 서버 안 집 폴더를 옮긴다(현장 노트 worker-tests).
const 사용자 = 'runner';
const 열쇠 = path.join(os.homedir(), '.ssh', 'synk_worker');
const 주소장 = path.join(os.homedir(), '.ssh', 'known_hosts_synk_worker');
const 별칭 = 'synk-worker';

/* 켤 때마다 도는 준비 스크립트. 처음 한 번만 깔고, 쉬면 끄는 타이머는 켤 때마다 새로 쓴다. */
const 시작스크립트 = `#!/bin/bash
# 쉬면 끄기를 맨 먼저 깐다 — 아래 설치가 실패해도 할 일 없는 서버가 켜진 채 돈을 쓰지 않게(GPT 11-26 GA10)
mkdir -p /opt/synk-worker
cat > /opt/synk-worker/쉬면끄기.sh <<'SH'
#!/bin/bash
# 일꾼 사용자(${사용자})의 SSH 세션이 있으면 지금을 「마지막으로 일한 때」로 적는다. 그 뒤로 ${쉬면끄기분}분 동안 없으면 서버를 끈다.
# 22번에 붙은 연결 수는 세지 않는다 — 인터넷의 SSH 훑기는 인증 전에 끊겨도 늘 붙어 있어 서버가 꺼지지 않는다(일꾼몰이 GPT GA7).
f=/opt/synk-worker/마지막일.txt
# 세션 프로세스(OpenSSH 9.8부터 sshd-session, 그 전은 sshd)만 센다 — 남은 시험 프로세스나 사용자 관리자(systemd --user)가 서버를 켜 두지 않게
# (Fable 설계 검토 일꾼몰이 P2). 시험은 늘 SSH 세션 안에서 돈다.
if pgrep -u ${사용자} -x 'sshd|sshd-session' >/dev/null; then date +%s > "$f"; fi
[ -f "$f" ] || date +%s > "$f"
if [ $(( $(date +%s) - $(cat "$f") )) -gt ${쉬면끄기분 * 60} ]; then echo "쉬어서 끔 $(date -Is)" >> /opt/synk-worker/켜짐.log; shutdown -h now; fi
SH
chmod +x /opt/synk-worker/쉬면끄기.sh
cat > /etc/systemd/system/synk-idle-stop.service <<'U'
[Unit]
Description=SYNK worker idle stop
[Service]
Type=oneshot
ExecStart=/opt/synk-worker/쉬면끄기.sh
U
cat > /etc/systemd/system/synk-idle-stop.timer <<'U'
[Unit]
Description=SYNK worker idle stop check every 2 minutes
[Timer]
OnBootSec=3min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
U
date +%s > /opt/synk-worker/마지막일.txt
systemctl daemon-reload
rc=0
systemctl enable --now synk-idle-stop.timer || { echo "쉬면 끄기 켜기 실패 $(date -Is)" >> /opt/synk-worker/켜짐.log; rc=1; }
echo "켜짐 $(date -Is)" >> /opt/synk-worker/켜짐.log
# 처음 한 번만 깐다. 실패하면 준비.txt를 쓰지 않아 다음 켤 때 다시 한다.
if [ ! -f /opt/synk-worker/준비.txt ]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y     && apt-get install -y git curl ca-certificates python3 python3-venv ffmpeg fonts-noto-cjk fonts-noto-core unzip jq     && curl -fsSL https://deb.nodesource.com/setup_26.x | bash -     && apt-get install -y nodejs     && echo "준비 끝 $(date -Is) $(node -v)" > /opt/synk-worker/준비.txt     || { echo "설치 실패 $(date -Is)" >> /opt/synk-worker/켜짐.log; rc=1; }
fi
exit $rc
`;

const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));
const 기본 = `https://compute.googleapis.com/compute/v1/projects/${프로젝트}`;

async function 토큰() {
  const j = JSON.parse(fs.readFileSync(자격경로, 'utf8'));
  const t = (j.tokens && j.tokens.default) || j;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' }),
  });
  const 답 = await r.json().catch(() => ({}));
  if (!답.access_token) throw new Error(`토큰 갱신 실패 ${r.status} — unmet23로 npx clasp login`);
  return 답.access_token;
}

async function 부르기(tok, 방법, url, 몸) {
  const h = { authorization: `Bearer ${tok}`, 'content-type': 'application/json', 'x-goog-user-project': 청구지 };
  const r = await fetch(url, { method: 방법, headers: h, body: 몸 ? JSON.stringify(몸) : undefined });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { _raw: txt.slice(0, 300) }; }
  return { ok: r.ok, 코드: r.status, j };
}

async function 작업기다림(tok, op, 한도초 = 180) {
  if (!op || !op.selfLink) return op;
  for (let i = 0; i < 한도초 / 3; i++) {
    const r = await 부르기(tok, 'GET', op.selfLink);
    if (r.ok && r.j.status === 'DONE') {
      if (r.j.error) throw Object.assign(new Error(`작업 실패: ${JSON.stringify(r.j.error).slice(0, 400)}`), { 작업실패: true });
      return r.j;
    }
    await 잠깐(3000);
  }
  throw new Error('작업이 제한 시간 안에 끝나지 않았다');
}

async function 서버찾기(tok) {
  const 오류 = [];
  for (const 존 of 존후보) {
    const r = await 부르기(tok, 'GET', `${기본}/zones/${존}/instances/${서버이름}`);
    if (r.ok) return { 존, j: r.j };
    // 404만 「그 존에 없다」다 — 권한 · 할당 · 일시 오류를 「서버가 없다」로 읽으면 켜진 서버를 못 끈다(GPT 11-26 GA11).
    // 한 존의 일시 오류가 다른 존의 서버 찾기를 막지 않게 끝까지 본 뒤 던진다(다시 검수 GA2).
    if (r.코드 !== 404) 오류.push(`${존} ${r.코드}: ${JSON.stringify(r.j).slice(0, 160)}`);
  }
  if (오류.length) throw new Error(`서버 조회 실패 — ${오류.join(' / ')}`);
  return null;
}

function 서버요약(s) {
  const ni = s.j.networkInterfaces?.[0];
  return {
    존: s.존, 상태: s.j.status, 머신: (s.j.machineType || '').split('/').pop(),
    주소: ni?.accessConfigs?.[0]?.natIP || null,
    스팟: s.j.scheduling?.provisioningModel === 'SPOT', 만든때: s.j.creationTimestamp,
  };
}

/* 서버가 구글에 알린 SSH 열쇠를 읽어 이 PC의 전용 known_hosts에 적는다. 주소가 바뀌어도 별칭으로 맞춘다.
 * 고정은 서버의 인스턴스 id(서버를 만들 때마다 새로 받는다)에 묶는다(<known_hosts>.id). 같은 서버의 열쇠가 고정한 것과 다르면 접속하지 않는다 —
 * 게스트 속성은 서버 안의 관리자 아닌 프로세스도 쓸 수 있다(일꾼몰이 GPT GA6). 처음 보는 서버(지웠다 새로 세운 서버)는 그 열쇠를 새로 고정한다
 * — 새 서버의 열쇠가 늦게 올라와도 다음 접속이 고정한다(일꾼몰이-2 GPT GA3). */
async function 열쇠지문고정(tok, s) {
  const id = String(s.j.id || '');
  const r = await 부르기(tok, 'GET', `${기본}/zones/${s.존}/instances/${서버이름}/getGuestAttributes?queryPath=hostkeys/`);
  const ed = (r.ok ? (r.j.queryValue?.items || []) : []).find((x) => x.key === 'ssh-ed25519');
  if (!ed || !id) return false;
  const 줄 = `${별칭} ssh-ed25519 ${ed.value.trim()}\n`;
  const id자리 = `${주소장}.id`;
  let 있던 = null, 있던id = null;
  try { 있던 = fs.readFileSync(주소장, 'utf8'); 있던id = fs.readFileSync(id자리, 'utf8').trim(); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  // 같은 서버이거나, 인스턴스 id 표가 생기기 전의 고정(.id 없음)이면 있던 열쇠와 대조한다 — 덮어쓰지 않는다(일꾼몰이-3 GPT GA3)
  if (있던 !== null && (있던id === id || 있던id === null)) {
    if (있던 !== 줄) throw new Error(`서버(${id}) SSH 열쇠가 고정한 것과 다르다 — 접속하지 않는다(${주소장}). 서버를 새로 세운 것이 확실하면 그 파일과 .id를 지우고 다시 접속한다`);
    if (있던id === null) fs.writeFileSync(id자리, `${id}\n`);
    return true;
  }
  fs.writeFileSync(주소장, 줄);
  fs.writeFileSync(id자리, `${id}\n`);
  return true;
}

function ssh인자(주소) {
  return ['-i', 열쇠, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${주소장.replaceAll('\\', '/')}`,
    '-o', `HostKeyAlias=${별칭}`, '-o', 'CheckHostIP=no', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=30', `${사용자}@${주소}`];
}

/* 다른 도구용: 켜져 있으면 주소, 아니면 null. 켜기 = true면 꺼진 서버를 켜고 sshd가 받을 때까지 기다린다. */
async function 주소얻기({ 켜기: 켤까 = false, 최대기다림초 = 150 } = {}) {
  const tok = await 토큰();
  let s = await 서버찾기(tok);
  if (!s) return null;
  const 끝 = Date.now() + 최대기다림초 * 1000;
  if (s.j.status !== 'RUNNING' && 켤까) {
    if (s.j.status === 'TERMINATED' || s.j.status === 'STOPPED') await 부르기(tok, 'POST', `${기본}/zones/${s.존}/instances/${서버이름}/start`, {});
    while (Date.now() < 끝) { await 잠깐(5000); s = await 서버찾기(tok); if (s?.j.status === 'RUNNING') break; }
  }
  if (!s || s.j.status !== 'RUNNING') return null;
  while (!(await 열쇠지문고정(tok, s)) && Date.now() < 끝) await 잠깐(4000);
  const 주소 = 서버요약(s).주소;
  while (Date.now() < 끝) {
    const r = spawnSync('ssh', [...ssh인자(주소), 'true'], { encoding: 'utf8', timeout: 20000, windowsHide: true });
    if (r.status === 0) return 주소;
    await 잠깐(4000);
  }
  return null;
}

async function 점검(tok) {
  console.log(`\n일꾼 서버 — ${프로젝트}/${서버이름}\n${'─'.repeat(56)}`);
  const b = await 부르기(tok, 'GET', `https://cloudbilling.googleapis.com/v1/projects/${프로젝트}/billingInfo`);
  const 결제지금 = b.ok ? b.j.billingAccountName?.split('/').pop() : null;
  console.log(`  결제: ${b.ok ? (b.j.billingEnabled ? `켜짐 (${결제지금})` : '꺼짐') : '못 봄 ' + b.코드}`);
  if (Date.now() >= 결제옮길날 && 결제지금 && 결제지금 !== 결제) console.log(`  ⚠ 12-05가 지났다 — node tools/일꾼서버.js --결제옮기기 (→ ${결제})`);
  const s = await 서버찾기(tok);
  if (!s) { console.log('  서버: 없다'); return null; }
  const v = 서버요약(s);
  console.log(`  서버: ${v.상태} · ${v.머신}${v.스팟 ? ' (스팟)' : ''} · ${v.존} · 주소 ${v.주소 || '(꺼져 있어 없음)'} · 만든 때 ${v.만든때.slice(0, 16)}`);
  console.log(`  열쇠 지문: ${fs.existsSync(주소장) ? '고정됨' : '아직'} · 비밀키: ${fs.existsSync(열쇠) ? '있음' : '없음'}`);
  if (v.상태 === 'RUNNING' && v.주소) {
    await 열쇠지문고정(tok, s);
    const r = spawnSync('ssh', [...ssh인자(v.주소), 'cat /opt/synk-worker/준비.txt 2>/dev/null || echo 준비 중; echo "$(nproc)코어 $(free -g | awk \'/Mem/{print $2}\')GB"; df -h / | tail -1; systemctl is-active synk-idle-stop.timer'],
      { encoding: 'utf8', timeout: 40000, windowsHide: true });
    console.log(`  들어가 보기: ${r.status === 0 ? r.stdout.trim().replace(/\n/g, ' · ') : '실패 ' + (r.stderr || '').trim().slice(0, 200)}`);
  }
  console.log('─'.repeat(56));
  return s;
}

async function 세우기(tok) {
  // ① compute
  const sv = await 부르기(tok, 'GET', `https://serviceusage.googleapis.com/v1/projects/${프로젝트}/services/compute.googleapis.com`);
  if (sv.j?.state !== 'ENABLED') {
    console.log('① compute를 켠다');
    await 부르기(tok, 'POST', `https://serviceusage.googleapis.com/v1/projects/${프로젝트}/services/compute.googleapis.com:enable`, {});
    for (let i = 0; i < 30; i++) { await 잠깐(5000); const t = await 부르기(tok, 'GET', `${기본}/zones`); if (t.ok) break; }
  } else console.log('① compute가 켜져 있다');

  // ② 문(SSH 22번) — 이 프로젝트의 default-allow-ssh가 이미 모든 서버에 22번을 열어 두었으면 새로 만들지 않는다
  const fw = await 부르기(tok, 'GET', `${기본}/global/firewalls`);
  const 열림 = (fw.j.items || []).some((f) => !f.disabled && f.direction === 'INGRESS' && (f.sourceRanges || []).includes('0.0.0.0/0')
    && (!f.targetTags || f.targetTags.includes('synk-worker')) && (f.allowed || []).some((a) => a.IPProtocol === 'tcp' && (a.ports || []).includes('22')));
  if (!열림) {
    console.log('② SSH 문을 연다(22번 · 열쇠 인증만)');
    const r = await 부르기(tok, 'POST', `${기본}/global/firewalls`, {
      name: 'synk-worker-ssh', network: 'global/networks/default', direction: 'INGRESS', priority: 1000,
      allowed: [{ IPProtocol: 'tcp', ports: ['22'] }], sourceRanges: ['0.0.0.0/0'], targetTags: ['synk-worker'],
    });
    if (!r.ok) throw new Error(`문 열기 실패 ${r.코드}: ${JSON.stringify(r.j).slice(0, 300)}`);
    await 작업기다림(tok, r.j);
  } else console.log('② SSH 22번 문이 열려 있다');

  // ③ 서버 — 이 PC의 --세우기는 하나만 돈다(잠금). 둘째 존부터는 만들기 전에 세 존을 다시 본다 — 다른 곳의 --세우기가 먼저 만들었으면 멈춘다
  //   (한 존이 자리 없음으로 실패한 사이 다른 실행이 그 존에 만들 수 있다, 일꾼몰이-2 GPT GA8)
  const 잠금 = path.join(os.homedir(), '.ssh', 'synk_worker.세우기.lock');
  // 남은 잠금은 넘겨받지 않는다 — 둘이 함께 넘겨받을 수 있다(일꾼몰이-3 GPT GA4). 사람이 도는 것이 없음을 보고 지운다
  try { fs.writeFileSync(잠금, `${process.pid} ${new Date().toISOString()}\n`, { flag: 'wx' }); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    throw new Error(`--세우기 잠금이 있다(${잠금}) — 다른 --세우기가 도는 중이면 끝난 뒤 다시 돌린다. 도는 것이 없으면 그 파일을 지우고 다시 돌린다`);
  }
  try { return await 서버만들기(tok); } finally { try { fs.rmSync(잠금, { force: true }); } catch { /* 이미 없다 */ } }
}

async function 서버만들기(tok) {
  if (await 서버찾기(tok)) { console.log('③ 서버가 있다'); return false; }
  if (!fs.existsSync(열쇠 + '.pub')) throw new Error(`공개키가 없다: ssh-keygen -t ed25519 -N "" -C synk-worker -f ${열쇠}`);
  const 공개키 = fs.readFileSync(열쇠 + '.pub', 'utf8').trim();
  let 마지막오류 = '';
  for (const [i, 존] of 존후보.entries()) {
    if (i > 0 && await 서버찾기(tok)) { console.log('③ 그 사이 서버가 생겼다 — 더 만들지 않는다'); return false; }
    const 몸 = {
      name: 서버이름,
      machineType: `zones/${존}/machineTypes/${머신}`,
      disks: [{ boot: true, autoDelete: true, initializeParams: { sourceImage: 'projects/debian-cloud/global/images/family/debian-13', diskSizeGb: String(디스크GB), diskType: `zones/${존}/diskTypes/pd-balanced` } }],
      networkInterfaces: [{ network: 'global/networks/default', nicType: 'GVNIC', accessConfigs: [{ name: 'External NAT', type: 'ONE_TO_ONE_NAT', networkTier: 'PREMIUM' }] }],
      metadata: { items: [
        { key: 'startup-script', value: 시작스크립트 },
        { key: 'ssh-keys', value: `${사용자}:${공개키}` },
        { key: 'enable-guest-attributes', value: 'TRUE' },
        { key: 'block-project-ssh-keys', value: 'TRUE' },
      ] },
      tags: { items: ['synk-worker'] },
      scheduling: { provisioningModel: 'SPOT', instanceTerminationAction: 'STOP', automaticRestart: false, onHostMaintenance: 'TERMINATE' },
      labels: { role: 'worker', owner: 'synk' },
    };
    console.log(`③ 서버를 만든다: ${서버이름} (${머신} 스팟 · ${존} · 디스크 ${디스크GB}GB)`);
    const r = await 부르기(tok, 'POST', `${기본}/zones/${존}/instances`, 몸);
    // 409는 같은 이름이 이미 있다는 뜻이다 — 다른 --세우기가 만드는 중일 수 있어 다른 존에 또 만들지 않는다(일꾼몰이 GPT GA8)
    if (r.코드 === 409) throw new Error(`${존}에 같은 이름의 서버가 이미 있다(다른 --세우기가 만드는 중일 수 있다) — 다른 존에 만들지 않았다. node tools/일꾼서버.js로 상태를 본다`);
    if (!r.ok) { 마지막오류 = `${r.코드}: ${JSON.stringify(r.j).slice(0, 400)}`; console.log(`   ${존} 안 됨 — ${마지막오류.slice(0, 200)}`); continue; }
    // 받아 준 만들기가 늦게 끝나는 것뿐이면 다음 존에 또 만들지 않는다 — 같은 이름의 서버가 둘 생긴다(GPT 11-26 GA8).
    // 작업이 오류로 끝났을 때(자리 없음 등)만 다음 존으로 간다.
    try { await 작업기다림(tok, r.j, 300); return true; } catch (e) {
      if (!e.작업실패) throw new Error(`${존}에서 만들기 확인이 늦다 — 잠시 뒤 node tools/일꾼서버.js로 상태를 본다(다른 존에 또 만들지 않았다)`);
      마지막오류 = e.message; console.log(`   ${존} 안 됨 — ${e.message.slice(0, 200)}`);
    }
  }
  throw new Error(`세 존 모두 서버를 못 만들었다 — ${마지막오류}`);
}

if (require.main === module) {
  (async () => {
    const tok = await 토큰();
    const a = process.argv.slice(2);
    if (a.includes('--세우기')) {
      await 세우기(tok);
      console.log('   서버 안 준비(노드 · git 설치)에 몇 분 걸린다. 열쇠 지문을 기다린다…');
      for (let i = 0; i < 30; i++) { const s = await 서버찾기(tok); if (s && await 열쇠지문고정(tok, s)) { console.log('   열쇠 지문 고정'); break; } await 잠깐(5000); }
      await 점검(tok);
      return;
    }
    if (a.includes('--시작글')) {
      const s0 = await 서버찾기(tok);
      if (!s0) { console.log('서버가 없다'); return; }
      const 공개키 = fs.readFileSync(열쇠 + '.pub', 'utf8').trim();
      // 다른 열쇠 줄(운영자 등)은 그대로 둔다 — 이 PC 열쇠가 든 줄(옛 사용자 이름 포함)만 이 파일의 사용자로 바꾼다(일꾼몰이-2 GPT GA2)
      const 열쇠몸 = 공개키.split(/\s+/)[1];
      const 옛줄 = String((s0.j.metadata?.items || []).find((x) => x.key === 'ssh-keys')?.value || '').split('\n');
      const 열쇠줄 = [...옛줄.filter((l) => l.trim() && !l.split(/\s+/).includes(열쇠몸)), `${사용자}:${공개키}`].join('\n');
      const 항목 = (s0.j.metadata?.items || []).filter((x) => x.key !== 'startup-script' && x.key !== 'ssh-keys')
        .concat([{ key: 'startup-script', value: 시작스크립트 }, { key: 'ssh-keys', value: 열쇠줄 }]);
      const r = await 부르기(tok, 'POST', `${기본}/zones/${s0.존}/instances/${서버이름}/setMetadata`, { fingerprint: s0.j.metadata.fingerprint, items: 항목 });
      if (!r.ok) throw new Error(`${r.코드}: ${JSON.stringify(r.j).slice(0, 300)}`);
      await 작업기다림(tok, r.j);
      console.log(`시작 스크립트(다음 부팅부터)와 열쇠 줄(${사용자})을 바꿨다`);
      return;
    }
    if (a.includes('--결제옮기기')) {
      if (Date.now() < 결제옮길날 && !a.includes('--지금')) {
        console.log('12-05 전이다 — 77yuhbs 결제 계정의 Welcome 크레딧이 그때까지 남아 있어 옮기지 않는다. 그래도 옮기려면 --결제옮기기 --지금');
        return;
      }
      const r = await 부르기(tok, 'PUT', `https://cloudbilling.googleapis.com/v1/projects/${프로젝트}/billingInfo`, { billingAccountName: `billingAccounts/${결제}` });
      if (!r.ok) throw new Error(`결제 옮기기 실패 ${r.코드}: ${JSON.stringify(r.j).slice(0, 300)}`);
      await 점검(tok);
      return;
    }
    if (a.includes('--켜기') || a.includes('--끄기') || a.includes('--지우기')) {
      const s = await 서버찾기(tok);
      if (!s) { console.log('서버가 없다'); return; }
      const 무엇 = a.includes('--켜기') ? 'start' : a.includes('--끄기') ? 'stop' : null;
      const r = 무엇 ? await 부르기(tok, 'POST', `${기본}/zones/${s.존}/instances/${서버이름}/${무엇}`, {})
        : await 부르기(tok, 'DELETE', `${기본}/zones/${s.존}/instances/${서버이름}`);
      if (!r.ok) throw new Error(`${r.코드}: ${JSON.stringify(r.j).slice(0, 300)}`);
      await 작업기다림(tok, r.j);
      await 점검(tok);
      return;
    }
    const i = a.indexOf('--명령');
    if (i >= 0) {
      const 주소 = await 주소얻기({ 켜기: true });
      if (!주소) { console.error('서버를 켜지 못했다(스팟 자리 없음일 수 있다)'); process.exit(2); }
      const r = spawnSync('ssh', [...ssh인자(주소), a[i + 1]], { stdio: 'inherit', windowsHide: true });
      process.exit(r.status ?? 1);
    }
    await 점검(tok);
  })().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });
}

module.exports = { 주소얻기, ssh인자, 프로젝트, 서버이름 };
