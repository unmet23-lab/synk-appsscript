// 아르곤(agy gemini-4-argon-high)에게 묻기만 한다 — 명령 실행 · 파일 쓰기 권한 없이(sandbox), 작업 폴더의 그림만 볼 수 있게.
// 답의 글과 ```python 묶음을 따로 저장한다. 다음 회차는 --이어서로 같은 대화를 잇는다.
// 작업 폴더(기본 .tmp/townstyle-20261026/argon-residents)에는 reference/ · scripts/ · out/ · review/가 있다.
//   node docs/디자인/싱크타운_그림체_20261026/블렌더주민/ask-argon.cjs <요청문.md> <회차 이름> [--이어서] [--폴더 <작업 폴더>]
const fs = require('node:fs'), path = require('node:path');
const { agy받기, 비밀환경걷기 } = require('../../../../tools/lib/제미나이구독호출.js');
const [promptFile, round, ...rest] = process.argv.slice(2);
const dir = path.resolve(rest.includes('--폴더') ? rest[rest.indexOf('--폴더') + 1] : '.tmp/townstyle-20261026/argon-residents');
const prompt = fs.readFileSync(path.resolve(promptFile), 'utf8');
const args = ['--input-format', 'stream-json', '--output-format', 'stream-json', '--model', 'gemini-4-argon-high', '--effort', 'high',
  '--print-timeout', '3000s', '--sandbox', '--disable-slash-commands', '--log-file', path.join(dir, `agy-${round}.log`), ...(rest.includes('--이어서') ? ['--continue'] : [])];
(async () => {
  const started = Date.now();
  const got = await agy받기({ args, cwd: dir, input: JSON.stringify({ event: 'user', message: { content: prompt } }) + '\n', env: 비밀환경걷기(), 제한Ms: 3_100_000 });
  try {
    const result = got.result || {};
    if (result.status && result.status !== 'SUCCESS') throw new Error(`agy 상태 ${result.status}: ${result.error || ''}`);
    const text = String(result.response || '').trim();
    fs.writeFileSync(path.join(dir, `answer-${round}.md`), text, 'utf8');
    const code = [...text.matchAll(/```python\s*\n([\s\S]*?)```/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0];
    if (code) fs.writeFileSync(path.join(dir, 'scripts', `build_residents_${round}.py`), code, 'utf8');
    console.log(JSON.stringify({ round, seconds: Math.round((Date.now() - started) / 1000), textChars: text.length, scriptLines: code ? code.split('\n').length : 0, model: got.init?.model }));
  } finally { await got.닫기?.(); }
})().catch(e => { console.error('아르곤 묻기 실패:', e.message); process.exit(2); });
