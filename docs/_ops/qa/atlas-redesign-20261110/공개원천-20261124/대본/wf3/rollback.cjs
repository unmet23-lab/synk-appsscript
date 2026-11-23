'use strict';
// 되돌림 준비(설계 주인 11-20 조건 — 공개 전에 되돌리는 명령을 적어 둔다): 공개 미리 보기 후보(후보.json)에서 공개본을 바꾸는 경로마다
// 지금 라이브 바이트를 <out>/files/에 두고, 새로 생기는 경로 목록을 적는다. 되돌림 = 이 바이트를 다시 공개하고(바뀐 경로), 새 경로는 지운다.
//   node rollback.cjs <후보 폴더(공개.js --후보폴더)> <out>
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const CAND = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3]);
const list = JSON.parse(fs.readFileSync(path.join(CAND, '후보.json'), 'utf8'));
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
const head = JSON.parse(execFileSync('gh', ['api', 'repos/unmet23-lab/synk-policy/commits/main'], { maxBuffer: 1 << 26, env }).toString('utf8')).sha;
const tree = JSON.parse(execFileSync('gh', ['api', `repos/unmet23-lab/synk-policy/git/trees/${head}?recursive=1`], { maxBuffer: 1 << 28, env }).toString('utf8'));
const live = new Map(tree.tree.filter(t => t.type === 'blob').map(t => [t.path, t.sha]));
fs.rmSync(OUT, { recursive: true, force: true });
const files = (list.항목 || list.files || list.파일).map(f => (typeof f === 'string' ? f : f.경로 || f.path)).filter(Boolean);
const changed = [], added = [];
for (const p of files) {
  if (!live.has(p)) { added.push(p); continue; }
  const bytes = Buffer.from(JSON.parse(execFileSync('gh', ['api', 'repos/unmet23-lab/synk-policy/git/blobs/' + live.get(p)], { maxBuffer: 1 << 28, env }).toString('utf8')).content, 'base64');
  const f = path.join(OUT, 'files', p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, bytes); changed.push(p);
}
fs.writeFileSync(path.join(OUT, 'rollback.json'), JSON.stringify({ liveHead: head, changed, added }, null, 1));
console.log('되돌림 바탕 라이브', head.slice(0, 9), '· 바뀌는 경로', changed.length, '· 새 경로', added.length);
console.log(changed.join('\n'));
