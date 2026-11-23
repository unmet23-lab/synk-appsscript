'use strict';
// 후보 트리 T1: 꺼낸 master X 사본(export)의 공용 원천 14개를 후보(라이브 + 새 길 조각)의 원천 꼴로, 생성 묶음 셋(계정 묶음 · 생활 단독 묶음 ·
// 생활 css)을 라이브 바이트의 원천 꼴로 바꾼다. 원천 꼴 = 공개 빌드의 고쳐 쓰기를 되돌린 것(rewrite(unrewrite(x)) === x를 확인한다).
// 바꾸기 전 원천은 <export>/.tmp/t1-before/에 둔다(다시 돌리면 그것으로 되돌린 뒤 바꾼다).
//   node t1.cjs
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const { makeRewrite, makeUnrewrite } = require('./rewrite-lib.cjs');
const E = 'D:/SYNK-worktrees/world-export-atlas-20261120b';
const C = path.join(E, '.tmp/cand-step1');
const BUILD = path.join(E, '.tmp/world-public-atlas-20261120');
const BEFORE = path.join(E, '.tmp/t1-before');
const cache = path.join(BUILD, 'live-blobs');
const config = { basePath: '/world/', account: { learningUrl: 'https://synk.im/try/learning-hub/' } };
const manifest = JSON.parse(fs.readFileSync(path.join(BUILD, 'manifest.json'), 'utf8'));
const sourceOf = new Map(manifest.files.map(f => [f.path, f.source]));
const report = JSON.parse(fs.readFileSync(path.join(C, 'report.json'), 'utf8'));
const tree = JSON.parse(execFileSync('gh', ['api', 'repos/unmet23-lab/synk-policy/git/trees/main?recursive=1'], { maxBuffer: 1 << 28 }).toString());
const liveSha = new Map(tree.tree.filter(t => t.type === 'blob' && t.path.startsWith('world/')).map(t => [t.path.slice(6), t.sha]));
const rewrite = makeRewrite(config);
// 라이브 바이트(캐시 없으면 gh api로 받는다)
const liveText = pub => {
  const sha = liveSha.get(pub), file = path.join(cache, sha);
  if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(JSON.parse(execFileSync('gh', ['api', 'repos/unmet23-lab/synk-policy/git/blobs/' + sha], { maxBuffer: 1 << 28 }).toString('utf8')).content, 'base64'));
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
};
const jobs = [];
// MODE=live면 공용 파일 14개도 라이브 바이트로(T0 — 지금 공개본 그대로의 바탕 트리), 아니면 후보(T1).
const MODE = process.env.MODE === 'live' ? 'live' : 'cand';
for (const f of report.files.filter(x => x.kind === 'merged')) jobs.push({ pub: f.p, src: f.src, text: MODE === 'live' ? liveText(f.p) : fs.readFileSync(path.join(C, 'new/world', f.p), 'utf8'), from: MODE === 'live' ? '라이브' : '후보' });
for (const pub of ['world-account.bundle.mjs', 'brand-opening/content/life-standalone.mjs', 'brand-opening/content/life-ui.css'])
  jobs.push({ pub, src: sourceOf.get(pub), text: liveText(pub), from: '라이브' });
for (const job of jobs) {
  if (!job.src) throw Error('원천을 모른다 ' + job.pub);
  const dir = job.pub.includes('/') ? job.pub.slice(0, job.pub.lastIndexOf('/') + 1) : '';
  // ./x · ../x 가 가리키는 공개 경로의 원천(빌드 manifest)
  const originOf = name => sourceOf.get(path.posix.normalize((job.pub.startsWith('brand-opening/') ? '' : dir) + name)) || null;
  const unrewrite = makeUnrewrite(config, originOf);
  const src = unrewrite(job.text, job.pub);
  const back = rewrite(src, job.pub);
  if (back !== job.text) {
    const a = back.split('\n'), b = job.text.split('\n');
    const i = a.findIndex((line, k) => line !== b[k]);
    throw Error(`${job.pub}: 되돌린 원천을 다시 고쳐 쓰면 다르다 — ${i + 1}행\n  다시: ${a[i]?.slice(0, 200)}\n  원래: ${b[i]?.slice(0, 200)}`);
  }
  const target = path.join(E, job.src);
  const keep = path.join(BEFORE, job.src);
  if (!fs.existsSync(keep)) { fs.mkdirSync(path.dirname(keep), { recursive: true }); fs.copyFileSync(target, keep); }
  fs.writeFileSync(target, src);
  console.log(job.from.padEnd(4), job.pub.padEnd(44), '→', job.src);
}
console.log(MODE === 'live' ? 'T0' : 'T1', '바꿈', jobs.length, '· 앞 원천', BEFORE);
