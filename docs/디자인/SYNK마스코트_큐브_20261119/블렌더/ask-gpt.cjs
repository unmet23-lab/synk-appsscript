// GPT(구독 Codex CLI, 검수 모델 값)에게 같은 요청문을 묻는다. 읽기 전용이고 기준 그림을 붙인다.
// 답은 작업 폴더의 answer-gpt-<회차>.md, 스크립트는 scripts/felt_cube_gpt_<회차>.py로 꺼낸다.
//   node docs/디자인/SYNK마스코트_큐브_20261119/블렌더/ask-gpt.cjs <요청문.md> <회차 이름> [붙일 그림…]
const fs = require('node:fs'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const 뿌리 = path.resolve(__dirname, '../../../..');
const { codex모델인자 } = require(path.join(뿌리, 'tools/lib/GPT검수모델.js'));
const [promptFile, round, ...images] = process.argv.slice(2);
const dir = path.join(뿌리, '.tmp/synk-cube-blender-20261119');
const answer = path.join(dir, `answer-gpt-${round}.md`);
const started = Date.now();
const r = spawnSync(process.execPath, [path.join(뿌리, 'tools/codex계정.js'), 'exec', '--skip-git-repo-check', '-C', dir, '-s', 'read-only',
  ...codex모델인자(), '-o', answer, ...images.flatMap(f => ['-i', path.resolve(f)])],
  { input: fs.readFileSync(path.resolve(promptFile), 'utf8'), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, cwd: 뿌리 });
fs.writeFileSync(path.join(dir, `gpt-${round}.log`), (r.stdout || '') + (r.stderr || ''));
if (r.status !== 0) { console.error('GPT 묻기 실패: 종료 ' + r.status); process.exit(r.status || 2); }
const text = fs.existsSync(answer) ? fs.readFileSync(answer, 'utf8') : '';
const code = [...text.matchAll(/```python\s*\n([\s\S]*?)```/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0];
if (code) fs.writeFileSync(path.join(dir, 'scripts', `felt_cube_gpt_${round}.py`), code, 'utf8');
console.log(JSON.stringify({ round: 'gpt-' + round, seconds: Math.round((Date.now() - started) / 1000), textChars: text.length, scriptLines: code ? code.split('\n').length : 0 }));
