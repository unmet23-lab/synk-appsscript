// 이 편의 그림을 GPT 이미지 2.5(ChatGPT 구독)로 굽는다. 굽기 계정 돌림은 tools/codex계정.js가 맡는다(본 계정은 맨 마지막 예비).
// 실행(이 폴더에서): node 굽기.cjs <지시문.txt> <이름> [참고그림…]
// 결과: <이름>.png(이 폴더) + log/<이름>.txt. 한 번 부를 때마다 한 장이다 — 장 수는 README에 적는다.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const [, , promptFile, name, ...refs] = process.argv;
if (!promptFile || !name) { console.error('node 굽기.cjs <지시문.txt> <이름> [참고그림…]'); process.exit(2); }
const here = __dirname;
const repo = path.resolve(here, '../../../../../..');
const rotate = path.join(repo, 'tools', 'codex계정.js');
const out = path.join(here, name + '.png');
if (fs.existsSync(out)) { console.log('있음', out); process.exit(0); }
fs.mkdirSync(path.join(here, 'log'), { recursive: true });
const head = 'Use your built-in image generation tool to create exactly ONE image. Do not run any shell commands and do not '
  + 'create or edit any files yourself. After the image is generated, reply with only the absolute path of the saved image file.\n\n';
const text = head + fs.readFileSync(path.resolve(promptFile), 'utf8');
const last = path.join(here, 'log', name + '.last.txt');
const args = [rotate, 'exec', '--skip-git-repo-check', '-C', here, '-s', 'read-only'];
for (const r of refs) args.push('-i', path.resolve(r));
args.push('-o', last, '-');
const t0 = Date.now();
const p = spawnSync('node', args, { input: text, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
fs.writeFileSync(path.join(here, 'log', name + '.txt'), (p.stdout || '') + '\n---stderr---\n' + (p.stderr || ''));
const said = fs.existsSync(last) ? fs.readFileSync(last, 'utf8').trim() : '';
const m = said.match(/[A-Za-z]:[\\/][^\s"'`]+\.(png|jpg|jpeg|webp)/i);
if (p.status !== 0 || !m || !fs.existsSync(m[0])) {
  console.error(`실패(종료 ${p.status}) — log/${name}.txt를 본다`);
  process.exit(p.status || 1);
}
fs.copyFileSync(m[0], out);
console.log(`${name}.png ← ${m[0]} · ${Math.round((Date.now() - t0) / 1000)}초`);
