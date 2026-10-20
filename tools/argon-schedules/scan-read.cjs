#!/usr/bin/env node
'use strict';
/* 월요일 스캔 수집(scan-lab · scan-ai · scan-platform) 결과를 브라우저 없이 읽는다 (2026-10-19).
 * --매일: 매일 도는 제작 인사이트(full · yt-tt · meta-brand · synkbrief) 문서를 읽는다 (2026-10-20, 1일 1편 예약 작업용).
 *
 * 읽기 전용: GCE API로 standby 서버의 지금 주소를 읽고, 고정한 호스트 키로 SSH에 붙어
 * 서버의 docs-io.py read와 회차 상태만 가져온다. 서버·문서에 쓰지 않는다.
 *
 *   node tools/argon-schedules/scan-read.cjs [--out <폴더>]
 *   node tools/argon-schedules/scan-read.cjs --매일 [--out <폴더>]
 *
 * 저장: <저장소>/.tmp/weekly-scan/<오늘 KST>/ 에 역할별 JSON(본문을 해석한 값)과 status.json.
 *       --매일은 <저장소>/.tmp/daily-argon/<오늘 KST>/ 에 역할별 본문 원문(.txt)과 status.json.
 * 필요: ~/.ssh/synk_company_20261008(키), ~/.ssh/known_hosts_synk_argon(별칭 synk-argon-standby의 호스트 키),
 *       tools/모델정책.js의 Vertex 자격(GCE 읽기). 이 PC의 공인 IP가 회사 서버 SSH 허용 목록에 있어야 한다.
 * 막히면: 아래 「다른 길」로 결과 문서를 크롬 읽기 화면(/mobilebasic)에서 연다.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 벌텍스토큰, 벌텍스프로젝트 } = require('../모델정책.js');

const REPO = path.resolve(__dirname, '..', '..');
const PROJECT = 'synk-bake-unmet27';
const NODE = { name: 'synk-company-2', zone: 'asia-northeast3-b', id: '8318146427425792493', privateIp: '10.77.0.3' };
const KEY = path.join(os.homedir(), '.ssh', 'synk_company_20261008');
const KNOWN = path.join(os.homedir(), '.ssh', 'known_hosts_synk_argon');
const ALIAS = 'synk-argon-standby';
const WEEKLY_ROLES = ['scan-lab', 'scan-ai', 'scan-platform'];
const DAILY_ROLES = ['full', 'yt-tt', 'meta-brand', 'synkbrief'];
const DAILY = process.argv.includes('--매일');
const ROLES = DAILY ? DAILY_ROLES : WEEKLY_ROLES;
const DOCS = JSON.parse(fs.readFileSync(path.join(__dirname, 'configuration', 'docs.json'), 'utf8'));
const MARKER = 'SYNK_WEEKLY_SCAN_COMPLETE';

const REMOTE = String.raw`
import json, subprocess
roles = ${JSON.stringify(ROLES)}
keep = ('status', 'startedAt', 'completedAt', 'error', 'model')
out = {}
for r in roles:
    p = subprocess.run(['sudo', '-n', '-u', 'synk-argon-ultra', 'env', '-i', 'HOME=/var/lib/synk-argon-77yuhbs',
                        'PATH=/usr/bin:/bin', 'LANG=C.UTF-8', '/usr/bin/python3', '/opt/synk-argon-77yuhbs/docs-io.py',
                        'read', r], capture_output=True, text=True, timeout=120)
    entry = {'readCode': p.returncode}
    if p.returncode == 0:
        try:
            v = json.loads(p.stdout)
            entry.update({'plaintext': v.get('plaintext', ''), 'title': v.get('title'), 'sha256': v.get('sha256')})
        except Exception:
            entry['readError'] = 'INVALID_READ_OUTPUT'
    else:
        entry['readError'] = (p.stderr or '')[-200:]
    s = subprocess.run(['sudo', '-n', 'cat', '/var/lib/synk-argon-77yuhbs/run-status/%s.json' % r], capture_output=True, text=True)
    if s.returncode == 0:
        try:
            st = json.loads(s.stdout)
            entry['run'] = {k: st.get(k) for k in keep if k in st}
        except Exception:
            entry['run'] = {'status': 'unreadable'}
    else:
        entry['run'] = {'status': 'never-run'}
    out[r] = entry
print(json.dumps(out, ensure_ascii=False))
`;

function kstDate(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function mondayKst(d = new Date()) {
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  const back = (k.getUTCDay() + 6) % 7;
  k.setUTCDate(k.getUTCDate() - back);
  return k.toISOString().slice(0, 10);
}

async function currentAddress() {
  if (벌텍스프로젝트() !== PROJECT) throw Error('VERTEX_PROJECT_MISMATCH');
  const url = `https://compute.googleapis.com/compute/v1/projects/${PROJECT}/zones/${NODE.zone}/instances/${NODE.name}`;
  const r = await fetch(url, {
    headers: { authorization: 'Bearer ' + await 벌텍스토큰(), 'x-goog-user-project': PROJECT },
    redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Error('GCE_READ_FAILED ' + r.status);
  const v = await r.json();
  const nic = (v.networkInterfaces || []).find((x) => x.name === 'nic0');
  const nat = nic && nic.accessConfigs && nic.accessConfigs[0] && nic.accessConfigs[0].natIP;
  if (v.id !== NODE.id || v.status !== 'RUNNING' || !nic || nic.networkIP !== NODE.privateIp || !/^\d{1,3}(\.\d{1,3}){3}$/.test(nat || '')) {
    throw Error('STANDBY_IDENTITY_OR_STATE_MISMATCH');
  }
  return nat;
}

function readRemote(address) {
  for (const f of [KEY, KNOWN]) if (!fs.existsSync(f)) throw Error('MISSING ' + f);
  const p = spawnSync('ssh', ['-i', KEY, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
    '-o', 'UserKnownHostsFile=' + KNOWN.replaceAll('\\', '/'), '-o', 'HostKeyAlias=' + ALIAS, '-o', 'CheckHostIP=no',
    '-o', 'ConnectTimeout=10', 'synk@' + address, 'sudo python3 -'],
  { input: REMOTE, encoding: 'utf8', timeout: 240000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (p.status !== 0) throw Error('SSH_FAILED ' + String(p.stderr || '').trim().split('\n').slice(-1)[0]);
  return JSON.parse(p.stdout);
}

function parseBody(text) {
  const cleaned = String(text || '').replace(/\n+$/, '');
  if (!cleaned) return { empty: true };
  if (!cleaned.endsWith('\n' + MARKER)) return { error: 'MISSING_MARKER' };
  try { return { value: JSON.parse(cleaned.slice(0, -(MARKER.length + 1))) }; } catch { return { error: 'INVALID_JSON' }; }
}

function fallbackText() {
  return ROLES.map((r) => `- ${r}: https://docs.google.com/document/d/${DOCS[r]}/mobilebasic`).join('\n');
}

// 매일 문서는 형식이 역할마다 달라 해석하지 않고 원문만 남긴다. 신선함은 회차가 오늘이나 어제(KST) 끝났는지로 본다.
function saveDaily(raw, outDir, today) {
  const yesterday = kstDate(new Date(Date.now() - 24 * 3600 * 1000));
  const summary = { readAt: new Date().toISOString(), today, roles: {} };
  for (const r of ROLES) {
    const entry = raw[r] || {};
    const text = String(entry.plaintext || '');
    const done = entry.run && entry.run.completedAt ? kstDate(new Date(entry.run.completedAt)) : null;
    summary.roles[r] = {
      run: entry.run, readCode: entry.readCode, readError: entry.readError, chars: text.length,
      completedKst: done, fresh: done === today || done === yesterday,
      doc: `https://docs.google.com/document/d/${DOCS[r]}/edit`,
    };
    if (text) fs.writeFileSync(path.join(outDir, r + '.txt'), text.endsWith('\n') ? text : text + '\n');
  }
  fs.writeFileSync(path.join(outDir, 'status.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  console.log('저장: ' + outDir);
  if (!Object.values(summary.roles).some((x) => x.fresh && x.chars)) process.exitCode = 3;
}

async function main() {
  const argOut = process.argv.indexOf('--out');
  const today = kstDate();
  const outDir = argOut > -1 ? path.resolve(process.argv[argOut + 1])
    : path.join(REPO, '.tmp', DAILY ? 'daily-argon' : 'weekly-scan', today);
  const thisMonday = mondayKst();
  let raw;
  try {
    raw = readRemote(await currentAddress());
  } catch (e) {
    console.error('서버에서 읽지 못했다: ' + e.message);
    console.error('다른 길 — 크롬(결과 문서 계정 unmet23로 로그인된 프로필)에서 읽기 화면을 연다:\n' + fallbackText());
    process.exitCode = 2;
    return;
  }
  fs.mkdirSync(outDir, { recursive: true });
  if (DAILY) return saveDaily(raw, outDir, today);
  const summary = { readAt: new Date().toISOString(), thisMonday, roles: {} };
  for (const r of ROLES) {
    const entry = raw[r] || {};
    const parsed = parseBody(entry.plaintext);
    const value = parsed.value;
    const sections = {};
    if (value && Array.isArray(value.items)) for (const it of value.items) sections[it.section || '(없음)'] = (sections[it.section || '(없음)'] || 0) + 1;
    summary.roles[r] = {
      run: entry.run, readCode: entry.readCode, weekOf: value && value.weekOf, generatedAt: value && value.generatedAt,
      items: value && Array.isArray(value.items) ? value.items.length : 0, sections,
      fresh: Boolean(value && value.weekOf === thisMonday), parse: parsed.error || (parsed.empty ? 'EMPTY' : 'OK'),
      doc: `https://docs.google.com/document/d/${DOCS[r]}/edit`,
    };
    if (value) fs.writeFileSync(path.join(outDir, r + '.json'), JSON.stringify(value, null, 2) + '\n');
  }
  fs.writeFileSync(path.join(outDir, 'status.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  console.log('저장: ' + outDir);
  if (!Object.values(summary.roles).every((x) => x.fresh)) process.exitCode = 3;
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
