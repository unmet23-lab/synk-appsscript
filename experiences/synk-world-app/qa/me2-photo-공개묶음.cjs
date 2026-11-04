'use strict';
// 「제2의 나」 사진 시범의 synk.im/world 공개 재료(2026-11-04): 바탕 판과 내 판에서 이 일이 바꾼 파일만 꺼낸 두 폴더를 만든다.
// tools/공개.js가 「공개본 + (바탕 → 내 판)」 3방향으로 얹는다 — 남의 아직 안 올린 변경은 두 판에 같이 있어 실리지 않는다.
// 코드는 공개 빌드(tools/build-world-app-public.mjs rewrite · publicAsset)와 같은 경로 고쳐 쓰기를 두 판에 똑같이 건다. 그림 · 얼굴 찾기 도구는 내 판에만 있는 새 파일이다.
//   node experiences/synk-world-app/qa/me2-photo-공개묶음.cjs [바탕] [내 판=HEAD] [--판 <글자>]
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../..');
const 값 = process.argv.slice(2);
const 판자리 = 값.indexOf('--판'), 판 = 판자리 >= 0 ? 값[판자리 + 1] : '';
const 위치 = 값.filter((x, i) => x !== '--판' && i !== 판자리 + 1 || 판자리 < 0);
const NEW = 위치[1] || 'HEAD';
const git = (...a) => execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', ...a], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const BASE = 위치[0] || git('merge-base', NEW, 'origin/master').toString().trim();
const OUT = path.join(공용작업본(ROOT), '.tmp', `me2-pub-20261104${판 ? '-' + 판 : ''}`);
const APP = 'experiences/synk-world-app/';
const 목록 = git('ls-tree', '-r', '--name-only', NEW, `${APP}me2-assets`, `${APP}vendor/face-api`).toString().trim().split('\n').map((x) => x.slice(APP.length)).filter((x) => !/PROVENANCE/.test(x));
const FILES = ['app-shell.mjs', 'world-account.bundle.mjs', 'me2-photo.mjs', 'me2-photo.css', 'me2-photo-consent.json', ...목록].map((f) => [APP + f, 'world/' + f]);
function 고쳐쓰기(bytes, pub) {
  const relative = pub.slice('world/'.length);
  if (!/\.(mjs|css)$/.test(pub)) return bytes;
  let text = bytes.toString('utf8');
  text = text.replaceAll('../synk-world-home/', './');
  if (!relative.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  text = text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => `${quote}/world/${folder}`);
  if (relative === 'world-account.bundle.mjs') text = text.replaceAll('SUNO_RECORDINGS', 'RECORDINGS').replaceAll('suno-tracks.mjs', 'recording-tracks.mjs');
  return Buffer.from(text, 'utf8');
}
const show = (rev, file) => { try { return git('show', `${rev}:${file}`); } catch { return null; } };
// 공개본 계정 묶음은 공백을 줄인 판이라 줄 단위 3방향이 안 맞물린다(현장 노트 「WORLD 공개」) — 공개본 글에 이 일의 자리만 정확히 한 번씩 바꿔 넣는다. 공개본에 없는 남의 변경은 실리지 않는다.
const 묶음자리 = [
  ['["speaking","POST"]]);function createWorldAccount', '["speaking","POST"],["me2","POST"]]);function createWorldAccount'],
  ['const accept=(data,ok,status)=>{if(guard(expected),(status===401||authErrors.has(data?.error?.code))&&(clear(),forgetSession()),', 'const accept=(data,ok,status)=>{if(guard(expected),path!=="me2"&&(status===401||authErrors.has(data?.error?.code))&&(clear(),forgetSession()),'],
  ['endpoint=path==="writing"?"world-writing"', 'endpoint=path==="me2"?"me2-photo":path==="writing"?"world-writing"'],
  ['suffix=path==="writing"||path==="speaking"?"feedback"', 'suffix=path==="me2"?"api":path==="writing"||path==="speaking"?"feedback"'],
  ['path==="writing"||path==="speaking"?95e3:12e3', 'path==="writing"||path==="speaking"?95e3:path==="me2"?3e4:12e3'],
  ['async function speakingRequest(payload){', 'async function me2Request(payload){if(native)throw Object.assign(Error("ME2_UNSUPPORTED"),{code:"ME2_UNSUPPORTED"});const response=await request("me2",{method:"POST",body:JSON.stringify(payload)}),data=await response.json();if(!response.ok)throw Object.assign(Error(data?.code||"ME2_UNAVAILABLE"),{code:data?.code||"ME2_UNAVAILABLE",status:response.status});return data}async function speakingRequest(payload){'],
  ['speakingRequest,pushRequest,pushAnonymous,get supportsPush()', 'speakingRequest,me2Request,pushRequest,pushAnonymous,get supportsMe2(){return!native},get supportsPush()'],
];
(async () => {
fs.rmSync(OUT, { recursive: true, force: true });
const items = [];
for (const [src, pub] of FILES) {
  let a = show(BASE, src), b = show(NEW, src);
  if (!b) throw Error('내 판에 없다: ' + src);
  if (a && a.equals(b)) continue;
  if (pub === 'world/world-account.bundle.mjs') {
    // 공개 주소는 CDN이 앞 판을 줄 수 있어 공개 도구의 사본에서 지금 판을 읽는다(11-04 — 앞 판을 기준으로 삼아 3방향이 겹쳤다).
    const 사본 = path.join(os.homedir(), 'Documents', 'synk-vendor', 'synk-policy-publish.git');
    execFileSync('git', ['-C', 사본, 'fetch', '-q', 'origin', 'main'], { stdio: 'ignore' });
    const live = execFileSync('git', ['-C', 사본, '-c', 'core.autocrlf=false', 'show', `FETCH_HEAD:${pub}`], { maxBuffer: 1 << 28 }).toString('utf8');
    let patched = live;
    for (const [from, to] of 묶음자리) {
      if (patched.split(from).length !== 2) throw Error('공개본 묶음에 정확히 한 번 있어야 한다: ' + from.slice(0, 60));
      patched = patched.replace(from, () => to);
    }
    a = Buffer.from(live); b = Buffer.from(patched);
    for (const [dir, bytes] of [['base', a], ['new', b]]) {
      const file = path.join(OUT, dir, pub);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
    items.push(pub);
    continue;
  }
  for (const [dir, bytes] of [['base', a], ['new', b]]) {
    if (!bytes) continue;
    const file = path.join(OUT, dir, pub);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 고쳐쓰기(bytes, pub));
  }
  items.push(pub);
}
const posix = (p) => p.replaceAll('\\', '/');
console.log(`원천 ${git('rev-parse', '--short', NEW).toString().trim()} · 바탕 ${git('rev-parse', '--short', BASE).toString().trim()} · 파일 ${items.length}개`);
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), ...items, '--허용', 'world/me2-photo-consent.json', '--후보폴더', posix(path.join(OUT, '후보'))].join(' '));
})().catch((error) => { console.error(String(error?.message || error)); process.exit(1); });
