#!/usr/bin/env node
// 힉스필드 정지컷 일괄 생성기 — 컷 목록(JSON)을 받아 여러 장을 동시에 만들고 결과 PNG를 내려받는다.
// 쓰는 법: docs/마케팅/제작양식/실제얼굴_화보_뮤직비디오.md
//
//   node tools/힉스필드정지컷.cjs <컷목록.json> [--out <폴더>] [--동시 6] [--계정폴더 <폴더>]
//
// 컷 목록 한 줄: { "id": "L05_redroom", "model": "nano_banana_pro", "prompt": "...",
//                "refs": ["C:/.../face1.png", ...], "aspect": "16:9", "resolution": "2k",
//                "quality": "high"(모델에 있을 때만), "extra": ["--soul-id", "..."](선택), "job": "기존 작업 id"(선택) }
// --계정폴더: 다른 힉스필드 계정으로 따로 로그인한 설정 폴더(그 안에 .config/higgsfield 가 있다).
//            공용 로그인(~/.config/higgsfield)을 건드리지 않으려고 쓴다. 비우면 공용 로그인을 쓴다.
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), https = require('https');

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
const listFile = argv[0];
if (!listFile || !fs.existsSync(listFile)) {
  console.error('사용: node tools/힉스필드정지컷.cjs <컷목록.json> [--out 폴더] [--동시 6] [--계정폴더 폴더]');
  process.exit(1);
}
const OUT = path.resolve(opt('--out', path.join(path.dirname(listFile), 'stills')));
const CONC = Number(opt('--동시', '6'));
const HOME = opt('--계정폴더', '');
const EXE = process.platform === 'win32' ? path.join(process.env.APPDATA || '', 'npm', 'higgsfield.exe') : 'higgsfield';
const env = HOME ? { ...process.env, USERPROFILE: path.resolve(HOME), HOME: path.resolve(HOME) } : process.env;
fs.mkdirSync(OUT, { recursive: true });

const shots = JSON.parse(fs.readFileSync(listFile, 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const run = args => new Promise(res => {
  const p = spawn(EXE, args, { env, windowsHide: true });
  let out = '', err = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
  p.on('error', e => res({ code: -1, out, err: String(e) }));
  p.on('close', code => res({ code, out, err }));
});
const download = (url, file) => new Promise((res, rej) => {
  https.get(url, r => {
    if (r.statusCode !== 200) return rej(new Error('HTTP ' + r.statusCode));
    const w = fs.createWriteStream(file); r.pipe(w); w.on('finish', () => w.close(res));
  }).on('error', rej);
});
// create 는 성공하면 작업 번호 문자열 배열(["uuid"])을 돌려준다. 실패 출력에서 번호를 읽지 않는다.
const jobIdOf = r => (r.code === 0 ? (String(r.out).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/) || [])[0] : null);
// 같은 id 를 동시에 여러 장 받을 때 파일 이름이 겹치지 않게 미리 자리를 잡는다.
const taken = new Set();
const reserve = base => {
  let n = 1, name = `${base}.png`;
  while (taken.has(name) || fs.existsSync(path.join(OUT, name))) name = `${base}_v${++n}.png`;
  taken.add(name); return path.join(OUT, name);
};

async function poll(id, job) {
  for (let t = 0; t < 360; t++) {
    await sleep(5000);
    const r = await run(['generate', 'get', job, '--json']);
    let j; try { j = JSON.parse(r.out); } catch { continue; }
    if (j.status === 'completed' && j.result_url) {
      const file = reserve(id);
      await download(j.result_url, file);
      console.log(`[${id}] 완료 → ${path.basename(file)}`);
      return { id, ok: true, job, url: j.result_url, file };
    }
    if (['failed', 'nsfw', 'canceled', 'cancelled', 'error'].includes(j.status)) {
      console.log(`[${id}] 실패: ${j.status}${j.status === 'nsfw' ? ' (안전 필터 오탐일 수 있다. 문구를 바꿔 다시. 크레딧은 환불된다)' : ''}`);
      return { id, ok: false, job, status: j.status };
    }
  }
  return { id, ok: false, job, status: 'timeout' };
}

async function one(s) {
  if (s.job) return poll(s.id, s.job);
  const args = ['generate', 'create', s.model || 'nano_banana_pro', '--prompt', s.prompt, '--aspect_ratio', s.aspect || '16:9', '--json'];
  if (s.quality) args.push('--quality', s.quality);
  if (s.resolution) args.push('--resolution', s.resolution);
  for (const r of s.refs || []) args.push('--image-references', r);
  for (const a of s.extra || []) args.push(a);
  let job = null;
  for (let t = 0; t < 40 && !job; t++) {
    const r = await run(args);
    job = jobIdOf(r);
    if (!job) {
      const msg = r.err || r.out;
      if (!/rate_limit_reached|520|503|no response/.test(msg)) { console.log(`[${s.id}] 만들기 실패: ${msg.slice(0, 200)}`); return { id: s.id, ok: false }; }
      await sleep(/rate_limit_reached/.test(msg) ? 20000 : 8000);   // 동시 작업 한도·일시 오류는 기다렸다 다시
    }
  }
  if (!job) return { id: s.id, ok: false };
  console.log(`[${s.id}] 작업 ${job}`);
  return poll(s.id, job);
}

(async () => {
  const results = []; let i = 0;
  await Promise.all(Array.from({ length: CONC }, async () => { while (i < shots.length) results.push(await one(shots[i++])); }));
  const log = path.join(OUT, '_생성기록.json');
  let prev = []; try { prev = JSON.parse(fs.readFileSync(log, 'utf8')); } catch {}
  fs.writeFileSync(log, JSON.stringify(prev.concat(results.map(r => ({ ...r, at: new Date().toISOString() }))), null, 1));
  console.log('끝:', results.map(r => `${r.id}:${r.ok ? 'ok' : 'x'}`).join(' '));
})();
