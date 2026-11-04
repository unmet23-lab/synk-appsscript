#!/usr/bin/env node
// 「제2의 나」 얼굴 점수 일꾼을 회사 서버 B(synk-company-2)에 깐다 — 2026-11-04. 절차 · 숫자의 뜻은 docs/제2의나_사진아바타_일괄처리_설계_20261103.md 8절.
//   node tools/me2-face-worker/설치.mjs                                  미리 보기(서버 상태만 읽는다)
//   node tools/me2-face-worker/설치.mjs --실행                           venv · 모델 · 일꾼 · 단위 파일을 깐다(타이머는 켜지 않는다)
//   node tools/me2-face-worker/설치.mjs --실행 --황금 <황금.json>        까는 데 더해 황금 세트(지어낸 대역, git 밖)로 같은 숫자가 나는지 본다
//   node tools/me2-face-worker/설치.mjs --연결 rehearsal|live --실행     그 과녁의 키를 env로 올리고 타이머를 켠다(키는 ~/SYNK_보안/me2_face_worker_<ref>.txt)
//   node tools/me2-face-worker/설치.mjs --끊기 rehearsal|live --실행     그 과녁의 타이머를 끈다
// 안으로 들어오는 포트 · Caddy · 방화벽 · 회사 릴리스를 건드리지 않는다. 키 값을 찍지 않는다.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { NODES } = require('../server-backup/read-status.cjs');
const policy = require('../모델정책.js');
const args = process.argv.slice(2);
const 값 = (이름) => { const i = args.indexOf(이름); return i >= 0 ? args[i + 1] : null; };
const 실행 = args.includes('--실행');
const die = (m) => { console.error(`[일꾼 설치] ⛔ ${m}`); process.exit(1); };

const 과녁 = { rehearsal: 'baasvefzinrxaryksayl', live: 'qiwxeddwwnzkwalpsuty' };
const 모델 = {
  'face_detection_yunet_2023mar.onnx': '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
  'face_recognition_sface_2021dec.onnx': '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79',
};
const PIN = 'opencv-python-headless==5.0.0.93';
const 뿌리 = '/opt/synk-me2-face';

const node = NODES.find((n) => n.role === 'research');
if (!node) die('회사 서버 B 정보 없음');
const 키파일 = path.join(os.homedir(), '.ssh', node.key || 'synk_company_20261008');

async function 주소() {
  const token = await policy.벌텍스토큰();
  const r = await fetch(`https://compute.googleapis.com/compute/v1/projects/synk-bake-unmet27/zones/${node.zone}/instances/${node.name}`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!r.ok) die(`GCE ${r.status}`);
  const j = await r.json();
  if (String(j.id) !== String(node.id)) die('인스턴스 id가 다르다');
  return j.networkInterfaces[0].accessConfigs[0].natIP;
}
function 원격준비(address) {
  const known = path.join(os.tmpdir(), 'synk-me2-worker-hostkey');
  fs.writeFileSync(known, `${node.alias} ${node.hostKey}\n`);
  return (command, input) => {
    const p = spawnSync('ssh', ['-i', 키파일, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${known.replaceAll('\\', '/')}`, '-o', `HostKeyAlias=${node.alias}`, '-o', 'CheckHostIP=no', '-o', 'ConnectTimeout=15', `synk@${address}`, command], { input: typeof input === 'string' ? Buffer.from(input) : input, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, timeout: 540000 });
    return { code: p.status, out: (p.stdout || Buffer.alloc(0)).toString('utf8'), err: (p.stderr || Buffer.alloc(0)).toString('utf8') };
  };
}
const 꼭 = (r, 이름) => { if (r.code !== 0) die(`${이름} 실패(${r.code}): ${(r.err || r.out).slice(-400)}`); return r.out; };

const 원격 = 원격준비(await 주소());
console.log(`[일꾼 설치] 대상 ▸ ${node.name}`);
console.log(꼭(원격(`set -e; test -d ${뿌리} && ls ${뿌리} ${뿌리}/models 2>/dev/null | head -12 || echo '(아직 안 깔림)'; systemctl list-timers --no-pager 'synk-me2-face*' 2>/dev/null | head -5`), '상태').trim());

const 연결 = 값('--연결'), 끊기 = 값('--끊기');
if (연결 || 끊기) {
  const 이름 = 연결 || 끊기;
  if (!과녁[이름]) die('과녁은 rehearsal 또는 live');
  if (!실행) { console.log('미리 보기다 — 바꾸려면 --실행'); process.exit(0); }
  if (끊기) {
    꼭(원격(`sudo -n systemctl disable --now synk-me2-face@${이름}.timer`), '끊기');
    console.log(`✅ ${이름} 타이머 끔`);
    process.exit(0);
  }
  const ref = 과녁[이름];
  const 키 = fs.readFileSync(path.join(os.homedir(), 'SYNK_보안', `me2_face_worker_${ref}.txt`), 'utf8').trim();
  if (!/^[\w-]{20,}$/.test(키)) die('일꾼 키 파일 꼴이 이상하다');
  const env = `ME2_WORKER_ENDPOINT=https://${ref}.supabase.co/functions/v1/me2-photo\nME2_FACE_WORKER_KEY=${키}\n`;
  꼭(원격(`sudo -n install -d -m 0750 /etc/synk-me2-face && sudo -n tee /etc/synk-me2-face/${이름}.env >/dev/null && sudo -n chmod 0640 /etc/synk-me2-face/${이름}.env`, env), 'env');
  꼭(원격(`sudo -n systemctl enable --now synk-me2-face@${이름}.timer && sudo -n systemctl start --no-block synk-me2-face@${이름}.service`), '타이머');
  console.log(`✅ ${이름} 연결 · 타이머 켬`);
  process.exit(0);
}

if (!실행) { console.log('미리 보기다 — 깔려면 --실행'); process.exit(0); }
// Debian은 python3-venv가 따로다(없으면 pip 없는 반쪽 venv가 남는다). 이 패키지 하나만 더한다.
꼭(원격(`set -e; python3 -c 'import ensurepip' 2>/dev/null || sudo -n DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3-venv >/dev/null; sudo -n install -d -m 0755 ${뿌리} ${뿌리}/models; sudo -n test -x ${뿌리}/venv/bin/pip || { sudo -n rm -rf ${뿌리}/venv; sudo -n python3 -m venv ${뿌리}/venv; }; sudo -n ${뿌리}/venv/bin/pip install --quiet --disable-pip-version-check '${PIN}'; OPENCV_LOG_LEVEL=ERROR ${뿌리}/venv/bin/python -I -c "import cv2;print('cv2',cv2.__version__)"`), 'venv');
const 모델곳 = process.env.ME2_MODEL_DIR || path.join(os.homedir(), '.rembg', 'models', 'yunet');
for (const [이름, sha] of Object.entries(모델)) {
  const 있음 = 원격(`sha256sum ${뿌리}/models/${이름} 2>/dev/null | cut -d' ' -f1`).out.trim();
  if (있음 === sha) { console.log(`  모델 ${이름} 그대로`); continue; }
  const bytes = fs.readFileSync(path.join(모델곳, 이름));
  if (createHash('sha256').update(bytes).digest('hex') !== sha) die(`이 PC의 모델 해시가 다르다: ${이름}`);
  꼭(원격(`sudo -n tee ${뿌리}/models/${이름} >/dev/null && test "$(sha256sum ${뿌리}/models/${이름} | cut -d' ' -f1)" = "${sha}"`, bytes), `모델 ${이름}`);
  console.log(`  ✅ 모델 ${이름}`);
}
for (const [이름, 곳] of [['worker.py', `${뿌리}/worker.py`], ['synk-me2-face@.service', '/etc/systemd/system/synk-me2-face@.service'], ['synk-me2-face@.timer', '/etc/systemd/system/synk-me2-face@.timer']]) {
  꼭(원격(`sudo -n tee '${곳}' >/dev/null && sudo -n chmod 0644 '${곳}'`, fs.readFileSync(path.join(here, 이름))), 이름);
  console.log(`  ✅ ${이름}`);
}
꼭(원격('sudo -n systemctl daemon-reload'), 'daemon-reload');

const 황금 = 값('--황금');
if (황금) {
  // 임시 폴더에 올려 재고 지운다 — 지어낸 대역뿐이지만 서버에 남기지 않는다. 파일마다 접속하면 연달은 접속이 막혀 묶음 하나로 보낸다(11-04).
  const 곳 = path.dirname(path.resolve(황금)), 이름 = path.basename(황금), 임시 = '/tmp/me2-golden';
  const 묶음 = spawnSync('tar', ['-cf', '-', '-C', 곳.replaceAll('\\', '/'), '.'], { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });
  if (묶음.status !== 0) die('황금 묶기 실패');
  const r = 원격(`rm -rf ${임시}; install -d -m 0700 ${임시}; tar -xf - -C ${임시} && ME2_MODEL_DIR=${뿌리}/models OPENCV_LOG_LEVEL=ERROR ${뿌리}/venv/bin/python -I -X utf8 ${뿌리}/worker.py --황금 '${임시}/${이름}'; c=$?; rm -rf ${임시}; exit $c`, 묶음.stdout);
  console.log(r.out.trim());
  if (r.code !== 0) die(`황금 어긋남(${r.code}) ${r.err.slice(0, 400)}`);
  console.log('  ✅ 황금 통과 · 임시 폴더 지움');
}
console.log('✅ 설치 끝 — 타이머는 --연결에서 켠다');
