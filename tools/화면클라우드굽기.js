/*
 * 화면 열넷 클라우드 굽기 — 허깅페이스 잡으로 굽고, 받아서, 본문을 붓는다 (2026-09-03).
 *
 * ■ 왜 이 도구가 서나
 *   밤 사슬의 마지막 «로컬 몫»이 화면 열넷이었다. 트랙은 그 까닭을 「그릇 blend 가 합쳐 7.8GB 라
 *   올리는 값이 굽는 값을 넘는다」로 적어 두었는데, 09-03 밤에 실물을 다시 재니 셋 다 어긋났다:
 *     · `*_v1_그릇만` 은 blend 가 아니라 **PNG 산출물**이다(장당 ≈5.9MB · 열넷 합 82MB)
 *     · 저장소에 blend 는 **0개**다 — `find docs/캐릭터 -name "*.blend*"` = 0 files
 *     · 화면굽기는 `blender -b -P 요소굽기.py` 라 **blend 를 안 연다**. 빈 장면에서 파이썬이
 *       장면을 짓고, 화면 열넷 형태가 전부 `요소굽기.py` 의 `형태들` 안에 있다
 *   ⇒ 올릴 것은 `요소굽기.py` + `디자인_토큰.json` = **500KB**. 막힌 적이 없었다.
 *
 *   그날 이 기계 여유 램은 3.1GB 로 램문지기 문턱(6,000MB)에 못 미쳤다 — 로컬로는 어차피 못 굽는다.
 *   클라우드는 저쪽이 32GB 라 이 기계가 안 눌린다.
 *
 * ■ 규율
 *   · 화면 표·화면자·비율의 정본은 `tools/lib/화면표.js` 하나다. 여기서 «베끼지» 않는다.
 *   · 잡 이름·받는 폴더는 **로마자**(표의 `열쇠`) — 한글은 bash 변수·폴더 이름으로 내려가며 깨진다.
 *   · `sh -c "…"` 로 감싼다. 안 감싸면 `--` 뒤 인자가 블렌더에 안 닿는다(09-03 실측).
 *   · `토큰=` 을 빠뜨리면 **7초에 죽는다**(디자인_토큰.json 을 못 찾는다).
 *   · 완주 판정은 파일로 한다 — 수·해상도·시각. 로그 끝줄로 판정하지 않는다.
 *
 * ■ hf CLI 는 «판»을 가린다
 *   `-v/--volume` 은 huggingface_hub **1.x** 부터다. 0.36 은 그 깃발이 아예 없어 조용히 다른 뜻으로
 *   읽히지 않고 그냥 죽는다. 이 기계에서 1.x 가 있는 곳 = `synk-vendor/.venv-xpu`(과 `.venv-onnx`).
 *   env `HF_CLI` 로 덮을 수 있다.
 *
 * 쓰기:
 *   node tools/화면클라우드굽기.js --띄우기            (재료 올리고 열넷 나란히)
 *   node tools/화면클라우드굽기.js --띄우기 --것 johab,sosik
 *   node tools/화면클라우드굽기.js --상태
 *   node tools/화면클라우드굽기.js --받기              (COMPLETED 인 것만 · 공방에 놓는다)
 *   node tools/화면클라우드굽기.js --덧씌움            (받은 그릇에 본문을 붓는다 · 로컬 파이썬)
 */
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const { 화면들, 화면자, 화면비율 } = require('./lib/화면표.js');

const HF = process.env.HF_CLI || 'C:/Users/q1212/Documents/synk-vendor/.venv-xpu/Scripts/hf.exe';
const PY = process.env.HF_PY || 'C:/Users/q1212/Documents/synk-vendor/.venv-xpu/Scripts/python.exe';
const 임자 = process.env.HF_NS || 'q121235';
const 버킷 = `${임자}/jobs-artifacts`;
const 그릇 = 'linuxserver/blender:5.2.1';
const 하드웨어 = process.env.HF_FLAVOR || 'cpu-upgrade';

const 인자 = {};
const 깃발 = new Set();
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const 이름 = a.slice(2);
  if (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) { 인자[이름] = process.argv[i + 1]; i += 1; }
  else 깃발.add(이름);
}
const 너비 = 인자['너비'] || '1800';
const 견본 = 인자['샘플'] || '256';
const 고른것 = 인자['것'] ? new Set(인자['것'].split(',').map((s) => s.trim())) : null;
const 볼것 = 화면들.filter((s) => !고른것 || 고른것.has(s.열쇠));

const 시각 = () => new Date().toTimeString().slice(0, 8);

/* ── 잡 장부 — 이름으로 찾는다 ────────────────────────────────────────────────
 * 🔑 잡 이름은 «유일하지 않다»(같은 이름을 여러 번 띄울 수 있다). 그래서 언제나 **가장 최근 것**을
 *   쥔다 — 다시 띄운 뒤에 옛 잡의 상태를 읽으면 「이미 끝났다」는 거짓 초록이 나온다. */
function 잡들() {
  const r = spawnSync(PY, ['-c', `
import json, sys
from huggingface_hub import HfApi
a = HfApi()
out = []
for j in list(a.list_jobs())[:80]:
    # 🔑 Volume 은 dict 가 아니라 dataclass 다 — .get() 을 부르면 AttributeError 로 죽는다(09-03 실측).
    v = []
    for m in (j.volumes or []):
        v.append({'mount': getattr(m, 'mount_path', None), 'path': getattr(m, 'path', None),
                  'ro': getattr(m, 'read_only', None)})
    out.append({
        'id': j.id,
        'name': (j.labels or {}).get('name'),
        'stage': j.status.stage if j.status else None,
        'msg': getattr(j.status, 'message', None) if j.status else None,
        'created': j.created_at.isoformat(),
        'volumes': v,
    })
sys.stdout.write(json.dumps(out, ensure_ascii=False))
`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error('🔴 잡 목록을 못 읽었다 —', String(r.stderr || '').trim().split('\n').slice(-3).join(' | '));
    process.exit(1);
  }
  return JSON.parse(r.stdout);
}

const 잡이름 = (s) => `synk-screen-${s.열쇠}`;
function 최근잡(모두, 이름) {
  const 것들 = 모두.filter((j) => j.name === 이름).sort((a, b) => (a.created < b.created ? 1 : -1));
  return 것들[0] || null;
}

/* ── ① 띄우기 ────────────────────────────────────────────────────────────── */
function 띄우기() {
  console.log(`\n■ 화면 ${볼것.length}장 클라우드 굽기 — ${너비}px · 샘플 ${견본} · ${하드웨어} · ${시각()}`);
  const 모두 = 잡들();
  const 재료 = path.join(루트, 'upload_screens');
  fs.mkdirSync(path.join(재료, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(재료, 'docs'), { recursive: true });
  fs.copyFileSync(path.join(루트, 'tools', '요소굽기.py'), path.join(재료, 'tools', '요소굽기.py'));
  fs.copyFileSync(path.join(루트, 'docs', '디자인_토큰.json'), path.join(재료, 'docs', '디자인_토큰.json'));

  const 결과 = [];
  for (const s of 볼것) {
    const 이름 = 잡이름(s);
    const 옛 = 최근잡(모두, 이름);
    if (옛 && 옛.stage === 'RUNNING') { console.log(`  ── ${s.형태.padEnd(12)} 이미 돈다 (${옛.id}) — 안 띄운다`); continue; }
    const 받을곳 = `./받을것_${s.열쇠}`;
    fs.mkdirSync(path.join(루트, `받을것_${s.열쇠}`), { recursive: true });
    /* 재료는 매번 «로컬 폴더»로 넘긴다 — hf 가 버킷과 대조해 바뀐 것만 올린다(안 바뀌면 Skips).
     * 버킷 해시 경로를 손으로 박으면 요소굽기.py 를 고친 날 옛 판이 조용히 구워진다. */
    const 명령 = `blender -b -P /work/tools/요소굽기.py -- 형태=${s.형태} 비율=${화면비율} `
      + `${화면자.join(' ')} 샘플=${견본} 너비=${너비} 장치=CPU `
      + `출력=/out/${s.그릇}.png 토큰=/work/docs/디자인_토큰.json`;
    const r = spawnSync(HF, ['jobs', 'run', '-d', '--name', 이름, '--flavor', 하드웨어,
      '--timeout', 인자['제한'] || '90m',
      '-v', './upload_screens:/work:ro', '-v', `${받을곳}:/out:rw`,
      그릇, 'sh', '-c', 명령], { cwd: 루트, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const 말 = String(r.stdout || '') + String(r.stderr || '');
    const id = (말.match(/id=([0-9a-f]{24})/) || [])[1];
    console.log(`  ── ${s.형태.padEnd(12)} ${id ? `✅ ${id}` : `🔴 ${말.trim().split('\n').slice(-2).join(' | ')}`}`);
    결과.push({ 열쇠: s.열쇠, id });
  }
  console.log(`\n  → 띄웠다 ${결과.filter((x) => x.id).length}/${결과.length} · 상태는 --상태`);
}

/* ── ② 상태 ─────────────────────────────────────────────────────────────── */
function 상태() {
  const 모두 = 잡들();
  const 지금 = Date.now();
  console.log(`\n■ 화면 ${볼것.length}장 상태 — ${시각()}`);
  const 셈 = {};
  for (const s of 볼것) {
    const j = 최근잡(모두, 잡이름(s));
    const 단계 = j ? j.stage : '없음';
    셈[단계] = (셈[단계] || 0) + 1;
    const 분 = j ? ((지금 - Date.parse(j.created)) / 60000).toFixed(1) : '-';
    const 놓인것 = path.join(루트, 'docs', '캐릭터', s.공방, `${s.그릇}.png`);
    let 놓임 = '·';
    try { 놓임 = new Date(fs.statSync(놓인것).mtimeMs).toLocaleString('ko-KR'); } catch (_) { 놓임 = '없음'; }
    console.log(`  ${s.형태.padEnd(12)} ${String(단계).padEnd(10)} ${String(분).padStart(6)}분   공방판 ${놓임}`);
  }
  console.log(`  → ${Object.entries(셈).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
}

/* ── ③ 받기 — 버킷 → 로컬 → 공방 ─────────────────────────────────────────────
 * 🔑 판정은 «파일»이 한다: 해상도가 요청한 너비와 같아야 받은 것으로 친다.
 *   잡이 COMPLETED 라도 렌더가 안 났을 수 있다(블렌더는 죽어도 종료코드 0 을 낼 때가 있다). */
function 받기() {
  const 모두 = 잡들();
  console.log(`\n■ 받기 — ${시각()}`);
  const 실패 = [];
  for (const s of 볼것) {
    const j = 최근잡(모두, 잡이름(s));
    if (!j) { console.log(`  ── ${s.형태.padEnd(12)} 잡이 없다`); continue; }
    if (j.stage !== 'COMPLETED') { console.log(`  ── ${s.형태.padEnd(12)} ${j.stage} — 아직`); continue; }
    const 밖 = (j.volumes || []).find((v) => v.mount === '/out');
    if (!밖 || !밖.path) { console.log(`  ── ${s.형태.padEnd(12)} 🔴 출력 볼륨을 못 찾았다`); 실패.push(s.형태); continue; }
    const 받을곳 = path.join(루트, `받을것_${s.열쇠}`);
    fs.mkdirSync(받을곳, { recursive: true });
    const r = spawnSync(HF, ['buckets', 'sync', `hf://buckets/${버킷}/${밖.path}`, 받을곳],
      { cwd: 루트, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const 난것 = path.join(받을곳, `${s.그릇}.png`);
    const 크기 = 해상도(난것);
    if (!크기 || 크기[0] !== Number(너비)) {
      console.log(`  ── ${s.형태.padEnd(12)} 🔴 ${크기 ? `${크기[0]}x${크기[1]}` : '없음'} · ${String(r.stderr || '').trim().split('\n').slice(-1)[0] || ''}`);
      실패.push(s.형태); continue;
    }
    /* 공방에 놓는다 — «구움 ≠ 입음». 칸.json 도 같이 옮긴다(덧씌움이 그걸 읽어 카드 안에 앉힌다). */
    const 방 = path.join(루트, 'docs', '캐릭터', s.공방);
    fs.copyFileSync(난것, path.join(방, `${s.그릇}.png`));
    const 칸 = `${난것}.칸.json`;
    if (fs.existsSync(칸)) fs.copyFileSync(칸, path.join(방, `${s.그릇}.png.칸.json`));
    console.log(`  ── ${s.형태.padEnd(12)} ✅ ${크기[0]}x${크기[1]} → ${s.공방}`);
  }
  if (실패.length) console.log(`  🔴 못 받은 것: ${실패.join(' · ')}`);
  return 실패;
}

function 해상도(p) {
  try {
    const fd = fs.openSync(p, 'r');
    const b = Buffer.alloc(33);
    fs.readSync(fd, b, 0, 33, 0);
    fs.closeSync(fd);
    if (b.toString('ascii', 1, 4) !== 'PNG') return null;
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  } catch (_) { return null; }
}

/* ── ④ 덧씌움 — 받은 그릇에 본문을 붓는다(로컬 파이썬 · 가볍다) ───────────────────
 * ⚠08-24 실사고를 물려받은 판정: «있나»가 아니라 «시각과 해상도»를 같이 본다.
 *   어제 판이 그 자리에 남아 있으면 존재 검사만으로는 ✅ 가 찍힌다. */
function 덧씌우기() {
  console.log(`\n■ 본문 덧씌움 ${볼것.length}장 — ${시각()}`);
  const 실패 = [];
  for (const s of 볼것) {
    const 방 = path.join(루트, 'docs', '캐릭터', s.공방);
    const t0 = Date.now();
    const r = spawnSync('python', [path.join(방, s.덧), s.그릇], { cwd: 방, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const 난것 = path.join(방, `${s.그릇.replace('_그릇만', '')}.png`);
    const 크기 = 해상도(난것);
    let 새로 = false;
    try { 새로 = fs.statSync(난것).mtimeMs >= t0 - 1000; } catch (_) { 새로 = false; }
    const 됐나 = r.status === 0 && 크기 && 새로;
    console.log(`  ── ${s.형태.padEnd(12)} ${됐나 ? '✅' : '🔴'} ${크기 ? `${크기[0]}x${크기[1]}` : '없음'}`);
    if (!됐나) {
      실패.push(s.형태);
      console.log('       ', String(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | '));
    }
  }
  if (실패.length) console.log(`  🔴 덧씌움 실패: ${실패.join(' · ')}`);
  return 실패;
}

if (깃발.has('띄우기')) 띄우기();
else if (깃발.has('받기')) 받기();
else if (깃발.has('덧씌움')) 덧씌우기();
else 상태();
