// master 계정 라이브러리 시험 셋(보기·자료·복구)을 「공개될 바이트」에 그대로 돌린다.
//   node run-tests.cjs <후보 폴더>
// 이 저장소 원천·시험을 임시 폴더에 옮기고, 후보 묶음에서 뗀 라이브러리 모듈을 부르는 시험 사본을 만들어 원천 판과 나란히 돌린다.
// 후보가 원천보다 더 실패하면 1로 끝난다(원천도 실패하는 시험은 그 환경 탓이라 같은 목록이면 통과로 본다).
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { spawnSync } = require('node:child_process');
const L = require('./live-modules.cjs');
const repo = path.resolve(__dirname, '../../../..'), [dir] = process.argv.slice(2);
if (!dir) throw Error('node run-tests.cjs <후보 폴더>');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'library-tests-'));
// 시험이 부르는 원천만(글 파일) 옮긴다 — 자료 시험은 서버 판 personal-data(→ path-vr·path-travel·atlas)와 desktop/src를,
// 묶음 입력 시험은 웹 포털 전체(platform.mjs → desktop/renderer)를 부른다.
for (const part of ['experiences/synk-account/src', 'experiences/synk-account/tests', 'experiences/path-vr', 'experiences/path-travel', 'atlas', 'desktop/src', 'desktop/renderer'])
  fs.cpSync(path.join(repo, part), path.join(tmp, part), { recursive: true, filter: f => fs.statSync(f).isDirectory() || /\.(mjs|cjs|js|json)$/.test(f) });
// 「라이브러리 화면은 제 검사만 묶는다」 시험이 esbuild로 포털을 묶는다 — 공용 작업본의 계정 node_modules(약 21MB)를 복사한다.
// 연결(junction)은 임시 폴더를 지울 때 대상까지 지울 수 있어 쓰지 않는다.
fs.cpSync(path.join(L.SHARED, 'experiences/synk-account/node_modules'), path.join(tmp, 'experiences/synk-account/node_modules'), { recursive: true });
const tests = path.join(tmp, 'experiences/synk-account/tests');
fs.writeFileSync(path.join(tests, 'candidate-library.mjs'), L.testModule(fs.readFileSync(path.join(dir, 'account__dist__platform.js'), 'utf8')));
const redirect = (name, pairs) => {
  let s = fs.readFileSync(path.join(tests, name), 'utf8');
  for (const [from, to] of pairs) { if (!from.test(s)) throw Error(name + ': ' + from); s = s.replace(from, to); }
  const out = name.replace('.test.mjs', '.candidate.test.mjs'); fs.writeFileSync(path.join(tests, out), s); return out;
};
const files = ['platform-library-view.test.mjs', 'platform-library.test.mjs', 'platform-library-recovery.test.mjs'];
const candidates = [
  redirect(files[0], [[/await import\(process\.env\.SYNK_PLATFORM_LIBRARY_TEST_BUNDLE === 'desktop'\r?\n\s*\? '[^']+' : '\.\.\/src\/platform-library-view\.mjs'\)/, "await import('./candidate-library.mjs')"]]),
  // 자료 시험: 라이브러리 모듈은 후보에서, 서버 판 personal-data는 원천 그대로(공개본에 그대로 남는 문서 동기화도 후보 묶음 판)
  redirect(files[1], ['platform-library-data', 'platform-library-state', 'platform-library-account', 'document-sync'].map(m => [new RegExp(`from '\\.\\./src/${m}\\.mjs'`), "from './candidate-library.mjs'"])),
  redirect(files[2], [[/from '\.\.\/src\/platform-library-recovery\.mjs'/, "from './candidate-library.mjs'"]]),
];
function run(list) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...list.map(f => path.join('experiences/synk-account/tests', f))], { cwd: tmp, encoding: 'utf8', maxBuffer: 1 << 26 });
  const text = r.stdout + r.stderr, num = k => Number(new RegExp(`^ℹ ${k} (\\d+)`, 'm').exec(text)?.[1] ?? NaN);
  const failed = [...new Set([...text.matchAll(/^✖ (.+?) \(\d/mg)].map(m => m[1]).filter(n => !/\.test\.mjs$/.test(n)))];
  return { tests: num('tests'), pass: num('pass'), fail: num('fail'), failed };
}
const source = run(files), candidate = run(candidates);
const worse = candidate.failed.filter(n => !source.failed.includes(n));
console.log(JSON.stringify({ tmp, source, candidate, candidateOnlyFailures: worse }, null, 1));
if (worse.length || candidate.tests !== source.tests || Number.isNaN(candidate.tests)) process.exit(1);
