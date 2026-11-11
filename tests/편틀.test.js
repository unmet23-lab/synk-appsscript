/* 편 틀 대조 — 새 편의 Remotion 틀 파일은 원천(tools/편틀)과 같아야 한다 (2026-11-11).
 *
 * 왜: 새 편마다 앞 편의 remotion/ 폴더를 손으로 복사해 틀이 갈라졌다(11월 35편에 fonts.ts 세 판 · tsconfig.json 두 판 · index.ts 두 판).
 *   원천은 tools/편틀 한 벌이고 `node tools/새편.js <편 폴더> --실행`이 찍는다. 손 복사한 틀이 원천과 다르면 여기서 걸린다.
 * 보는 편: docs/마케팅/<브랜드>_…_<YYYYMMDD>/remotion/(맨 위 편만) 가운데 tools/편틀/틀.json 「적용」에 그 브랜드가 있고 폴더 날짜가
 *   그 날짜부터인 편(가르는 규칙은 명령과 같은 함수 — tools/새편.js 편이름풀기 · 적용편인가). 그 전 날짜의 편과 「적용」에 없는 브랜드는 보지 않는다 —
 *   옛 편은 얼린 목록 없이 날짜로 얼린다. 「예외」에 적힌 편은 넘긴다.
 * 같다고 보는 것: 원천의 지금 판, 또는 원천이 지나온 판(`git log --raw -- tools/편틀 …`의 blob). 원천을 고친 날 그 전에 만든 편이 한꺼번에
 *   빨개지지 않게 — 이미 렌더한 편의 틀을 바꾸면 판본 지문(tools/lib/판본잇기.js)이 달라져 판본이 돌림에서 빠진다. CI(syntax-check)는 이력을 다 받는다.
 * 재는 법: 파일을 읽지 않고 git blob으로 견준다. 편 쪽은 `git ls-files -s`의 blob이고, 작업본에서 고친 추적 파일(`git diff-files`)과
 *   이번 push로 처음 들어가는 파일(SYNK_새파일 — tests/_git밖.js)만 디스크에서 `git hash-object`로 다시 잰다(줄끝 정리까지 git과 같은 값).
 *   원천 쪽(틀 파일 · docs/브랜드_폰트의 글꼴 다섯)은 디스크에서 잰다 — 그래서 원천을 작업본에서 고치고 올리지 않은 채 그 판으로 찍은 편만 올리면
 *   push 전에는 초록이고 CI에서 빨갛다(push 전 시험은 올리는 경로 목록을 모른다). 원천을 고쳤으면 원천도 같은 push에 올린다.
 * push 전에 골라지나: `git ls-files` 무늬(docs/마케팅/…/remotion/tsconfig.json 등)로 훑으므로 CI 읽기 지도가 그 파일을 올리는 push에 이 시험을 붙인다.
 *   지도가 새로 만들어지기 전에는 이 글에 적힌 파일 이름(remotion.config.ts · tsconfig.json · eslint.config.mjs · fonts.ts · Root.tsx)으로 골라진다.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 이번push새파일 } = require('./_git밖.js');
const { 틀읽기, 잠금읽기, 편이름풀기, 적용편인가, 요구하나, raw줄읽기, 지난blob, blob값, 기본원천 } = require('../tools/새편.js');

const REPO = path.resolve(__dirname, '..');
const 원천상대 = path.relative(REPO, 기본원천).split(path.sep).join('/');

const git = (인자, 입력) => spawnSync('git', ['-c', 'core.quotepath=false', ...인자], { cwd: REPO, encoding: 'utf8', input: 입력, maxBuffer: 256 << 20 });

/** 저장소 기준 경로 → { 편(폴더 이름), 브랜드, 날짜, 안 } — 맨 위 편(docs/마케팅/<편>/remotion/…)만, 아니면 null. 날짜로 안 끝나는 폴더는 날짜가 null이다 */
function 편가르기(rel) {
  const m = /^docs\/마케팅\/([^/]+)\/remotion\/(.+)$/.exec(rel);
  if (!m) return null;
  const 풀이 = 편이름풀기(m[1]);
  return { 편: 풀이.이름, 브랜드: 풀이.브랜드, 날짜: 풀이.날짜, 안: m[2] };
}
const 대상인가 = (편, 틀) => 적용편인가(틀, { 이름: 편.편, 브랜드: 편.브랜드, 날짜: 편.날짜 });

/** 디스크의 파일을 git이 넣을 blob 값으로 잰다(줄끝 정리 포함) — Map(경로 → blob), 디스크에 없는 경로는 빠진다 */
function 디스크blob(경로들) {
  const 있는 = 경로들.filter((p) => fs.existsSync(path.join(REPO, p)));
  if (!있는.length) return new Map();
  const r = git(['hash-object', '--stdin-paths'], `${있는.join('\n')}\n`);
  assert.strictEqual(r.status, 0, `git hash-object 실패: ${r.stderr}`);
  const 값 = String(r.stdout).split('\n').filter(Boolean);
  assert.strictEqual(값.length, 있는.length, 'git hash-object가 준 줄 수가 다르다');
  return new Map(있는.map((p, i) => [p, 값[i]]));
}

/**
 * 원천 파일이 지나온 판 — 명령과 같은 함수(tools/새편.js 지난blob)로 읽는다: 원천이 생긴 날부터의 이력만 걷는다(이력 전체를 걸으면 5초가 든다).
 * 이력에 그 경로가 아직 없으면(이번 push가 처음) 빈 집합이다. git이 다른 꼴로 답해 못 읽으면 지금 판만 받는다 — 느슨해지는 쪽이 아니라 빨개지는 쪽이다.
 */
function 지난판(경로들) {
  const 지도 = 지난blob(REPO, 경로들);
  assert.ok(지도, 'git log로 원천의 이력을 못 읽었다');
  return 지도;
}

/** 편 쪽 틀 파일의 blob — 추적 파일은 색인에서, 고친 파일 · 새 파일은 디스크에서. 돌려주는 값 { 지도: Map(경로 → blob), 추적수 } */
function 편blob(틀이름) {
  const 꼬리 = [...틀이름, 'src/Root.tsx'];
  const 무늬 = 꼬리.map((n) => `docs/마케팅/*/remotion/${n}`);
  const 목록 = git(['ls-files', '-s', '-z', '--', ...무늬]);
  assert.strictEqual(목록.status, 0, `git ls-files 실패: ${목록.stderr}`);
  const 지도 = new Map();
  for (const 줄 of String(목록.stdout).split('\0')) {
    const m = /^\d+ ([0-9a-f]{40,64}) \d+\t(.+)$/.exec(줄);
    if (m) 지도.set(m[2], m[1]);
  }
  const 추적수 = 지도.size;
  const 바뀜 = git(['diff-files', '--name-only', '-z', '--', ...무늬]);
  assert.strictEqual(바뀜.status, 0, `git diff-files 실패: ${바뀜.stderr}`);
  const 꼬리집합 = new Set(꼬리);
  const 다시잴 = new Set(String(바뀜.stdout).split('\0').filter(Boolean));
  for (const 새 of 이번push새파일()) {
    const p = 새.replace(/\\/g, '/');
    const 편 = 편가르기(p);
    if (편 && 꼬리집합.has(편.안)) 다시잴.add(p);
  }
  const 잰 = 디스크blob([...다시잴]);
  for (const p of 다시잴) { if (잰.has(p)) 지도.set(p, 잰.get(p)); else 지도.delete(p); } // 디스크에 없으면 지운 파일이다
  return { 지도, 추적수 };
}

test('틀 원천(tools/편틀)이 제 목록과 맞는다', () => {
  const 틀 = 틀읽기();
  for (const 이름 of 틀.같아야) assert.ok(fs.existsSync(path.join(기본원천, 이름)), `원천에 없다: ${원천상대}/${이름}`);
  for (const [이름, 출처] of Object.entries(틀.있으면같아야)) assert.ok(fs.existsSync(path.join(기본원천, 출처)), `원천에 없다: ${원천상대}/${출처}(${이름})`);
  for (const [이름, 판] of Object.entries(틀.처음만)) for (const 값 of Object.values(판)) assert.ok(fs.existsSync(path.join(기본원천, 값)), `원천에 없다: ${원천상대}/${값}(${이름})`);
  // 원천 폴더에 진짜 .gitignore를 두면 저장소에 작용한다 — gitignore.기본 · gitignore.<브랜드>로 두고 찍을 때 이름을 바꾼다
  assert.ok(!fs.existsSync(path.join(기본원천, '.gitignore')), '원천 폴더에 .gitignore를 두지 않는다(gitignore.기본 · gitignore.<브랜드>로 둔다)');
  for (const 판 of Object.values(틀.처음만['.gitignore'] || {})) {
    const 줄 = fs.readFileSync(path.join(기본원천, 판), 'utf8').split(/\r?\n/);
    for (const 꼭 of ['node_modules', 'out']) assert.ok(줄.includes(꼭), `${판}에 ${꼭} 줄이 없다 — 렌더 결과 · 부품 연결이 올라간다`);
  }
  // 글꼴: 출처가 추적 파일이고, fonts.ts가 부르는 파일 이름과 목록이 같다
  const 글꼴출처 = Object.values(틀.글꼴);
  const 추적 = new Set(String(git(['ls-files', '-z', '--', ...글꼴출처]).stdout).split('\0').filter(Boolean));
  for (const 출처 of 글꼴출처) assert.ok(추적.has(출처) || 이번push새파일().includes(출처), `글꼴 출처가 추적 파일이 아니다: ${출처}`);
  const 부르는 = [...fs.readFileSync(path.join(기본원천, 'src', 'lib', 'fonts.ts'), 'utf8').matchAll(/staticFile\('([^']+)'\)/g)].map((m) => `public/${m[1]}`).sort();
  assert.deepStrictEqual(Object.keys(틀.글꼴).sort(), 부르는, 'fonts.ts가 부르는 글꼴 파일과 틀.json 「글꼴」 목록이 다르다');
  // 잠금 파일 뿌리가 package.json과 같다(한쪽만 고치면 npm ci가 멈춘다)
  const pkg = JSON.parse(fs.readFileSync(path.join(기본원천, 'package.json'), 'utf8'));
  const 뿌리 = 잠금읽기().잠금.packages[''];
  assert.deepStrictEqual(뿌리.dependencies, pkg.dependencies, 'package-lock.json 뿌리의 dependencies가 package.json과 다르다');
  assert.deepStrictEqual(뿌리.devDependencies, pkg.devDependencies, 'package-lock.json 뿌리의 devDependencies가 package.json과 다르다');
  // 명령이 「지난 판」을 가릴 때 쓰는 blob 셈(tools/새편.js blob값 — 글 파일은 줄끝을 정리)이 git과 같은 값을 낸다(글 · 잠금 · 글꼴)
  const 잴것 = [...틀.같아야.map((이름) => `${원천상대}/${이름}`), `${원천상대}/package-lock.json`, ...글꼴출처];
  const git값 = 디스크blob(잴것);
  for (const p of 잴것) assert.strictEqual(blob값(fs.readFileSync(path.join(REPO, p))), git값.get(p), `blob 셈이 git hash-object와 다르다: ${p}`);
  // 적용 · 예외의 꼴
  for (const [브랜드, 날짜] of Object.entries(틀.적용)) assert.match(String(날짜), /^20\d{6}$/, `틀.json 「적용」 ${브랜드}의 날짜 꼴(YYYYMMDD)`);
  for (const [편, 까닭] of Object.entries(틀.예외)) assert.ok(typeof 까닭 === 'string' && 까닭.trim().length >= 4, `틀.json 「예외」 ${편}에 까닭을 적는다`);
});

test('새 편의 틀 파일은 원천과 같다 — 손 복사한 틀이 갈라지면 여기서 걸린다', () => {
  const 틀 = 틀읽기();
  const 원천경로 = new Map([
    ...틀.같아야.map((이름) => [이름, `${원천상대}/${이름}`]),
    ...Object.entries(틀.글꼴),
    ...Object.entries(틀.있으면같아야).map(([이름, 출처]) => [이름, `${원천상대}/${출처}`]),
  ]);
  const 틀이름 = [...원천경로.keys()];
  const 원천blob = 디스크blob([...원천경로.values()]);
  for (const [이름, 경로] of 원천경로) assert.ok(원천blob.has(경로), `원천 파일이 이 작업본에 없다: ${경로}(${이름})`);
  // 같다고 보는 판 = 원천의 지금 판 + 지나온 판
  const 지난 = 지난판([...원천경로.values()]);
  const 받는판 = new Map(틀이름.map((이름) => [이름, new Set([원천blob.get(원천경로.get(이름)), ...지난.get(원천경로.get(이름))])]));

  const { 지도, 추적수 } = 편blob(틀이름);
  // 훑기가 살아 있는지부터 — 훑기가 깨져 0개를 내면 통과하면 안 된다(11-11 origin에 remotion/package.json 108곳)
  const 꾸러미 = [...지도.keys()].filter((p) => p.endsWith('/remotion/package.json'));
  assert.ok(추적수 > 150 && 꾸러미.length >= 30, `편 틀 파일 훑기가 너무 적게 잡았다: 추적 ${추적수} · package.json ${꾸러미.length}`);
  // 「적용」에 적은 브랜드가 실제 편 폴더의 이름과 맞는지(철자가 틀리면 아무 편도 안 보고 영영 초록이다), 그 브랜드의 편 폴더가 날짜로 끝나는지(안 끝나면 대조할 수 없다)
  for (const 브랜드 of Object.keys(틀.적용)) {
    const 그편 = 꾸러미.map(편가르기).filter((편) => 편 && 편.브랜드 === 브랜드);
    assert.ok(그편.length >= 1, `틀.json 「적용」의 ${브랜드}로 시작하는 편 폴더(docs/마케팅/${브랜드}_…/remotion)가 하나도 없다 — 브랜드 이름 철자를 본다`);
    const 날짜없는 = 그편.filter((편) => !편.날짜).map((편) => 편.편);
    assert.deepStrictEqual(날짜없는, [], `${브랜드} 편 폴더 이름이 날짜(_YYYYMMDD)로 끝나지 않아 틀 대조 대상인지 가를 수 없다 — 이름을 고치거나 틀.json 「예외」가 아니라 폴더 이름부터 맞춘다`);
  }

  const 편들 = new Map();
  for (const [p, blob] of 지도) {
    const 편 = 편가르기(p);
    if (!편 || !대상인가(편, 틀)) continue;
    if (!편들.has(편.편)) 편들.set(편.편, new Map());
    편들.get(편.편).set(편.안, blob);
  }
  const 어긋남 = [];
  for (const [편, 파일] of [...편들].sort((a, b) => a[0].localeCompare(b[0]))) {
    const 다른 = 틀이름.filter((이름) => 파일.has(이름) && !받는판.get(이름).has(파일.get(이름)));
    if (다른.length) 어긋남.push(`docs/마케팅/${편} — 원천과 다른 틀 파일: ${다른.join(' · ')}`);
    // 틀 파일이 빠진 편도 잡는다 — remotion.config.ts가 없으면 화질 설정 없이 기본값으로 렌더되고, 글꼴이 없으면 렌더가 멈춘다
    // 원천에 나중에 더한 틀 파일(틀.json 「더함」)은 그 날짜부터의 편에만 요구한다 — 그 전에 찍은 편이 한꺼번에 빨개지지 않게
    const 꼭 = [...틀.같아야, ...Object.keys(틀.글꼴)].filter((이름) => 요구하나(틀, 이름, 편이름풀기(편).날짜));
    const 없는 = 파일.has('package.json') || 파일.has('src/Root.tsx') ? 꼭.filter((이름) => !파일.has(이름)) : [];
    if (없는.length) 어긋남.push(`docs/마케팅/${편} — 틀 파일이 없다: ${없는.join(' · ')}`);
  }
  assert.deepStrictEqual(어긋남, [], [
    '새 편의 Remotion 틀 파일이 원천(tools/편틀)과 다르다:',
    ...어긋남.map((줄) => `  ${줄}`),
    '→ 틀 파일이 없는 것은: node tools/새편.js docs/마케팅/<편> --실행  (없는 틀 파일을 찍는다 — 있는 파일은 건드리지 않는다)',
    '→ 원천에 틀 파일을 새로 더해서 그 전에 찍은 편들이 걸린 것이면: 편에 찍어 넣지 말고 tools/편틀/틀.json 「더함」에 그 파일과 날짜(YYYYMMDD — 그 날짜부터의 편에만 요구한다)를 적는다.',
    '→ 원천과 다른 것은, 아직 렌더 · 게시하지 않은 편이면: node tools/새편.js docs/마케팅/<편> --갱신 --실행  (틀 파일을 원천 판으로 바꾼다 — 덮기 전에 편에만 있던 줄을 보여 준다)',
    '→ 그 편만의 서체 · 설정이 필요하면 틀 파일을 고치지 말고 편 파일을 더한다(src/lib/편서체.ts에서 loadFont, 글꼴 파일은 public/fonts/에 더 둔다).',
    '→ 이미 렌더 · 게시한 편에는 --갱신을 쓰지 않는다(판본 지문이 바뀐다) — tools/편틀/틀.json 「예외」에 편 이름과 까닭을 적는다.',
    '→ 틀 자체를 바꿀 일이면 tools/편틀을 고친다(그 전에 만든 편은 지나온 판으로 통과한다).',
  ].join('\n'));
});

test('원천이 지나온 판도 같은 것으로 본다 — git log --raw 줄 읽기', () => {
  const 가 = 'a'.repeat(40), 나 = 'b'.repeat(40), 다 = 'c'.repeat(40), 영 = '0'.repeat(40);
  const 글 = [
    `:100644 100644 ${나} ${다} M\ttools/편틀/src/lib/fonts.ts`,
    '',
    `:000000 100644 ${영} ${나} A\ttools/편틀/src/lib/fonts.ts`,
    `:100644 000000 ${가} ${영} D\ttools/편틀/옛파일.ts`,
    `:100644 100644 ${가} ${나} M\tdocs/마케팅/남의편_20261112/remotion/src/lib/fonts.ts\r`,
  ].join('\n');
  const 지도 = raw줄읽기(글, ['tools/편틀/src/lib/fonts.ts', 'tools/편틀/package.json']);
  assert.deepStrictEqual([...지도.get('tools/편틀/src/lib/fonts.ts')].sort(), [나, 다]);
  assert.strictEqual(지도.get('tools/편틀/package.json').size, 0, '이력에 없는 경로는 빈 집합 — 지금 판만 받는다');
  // 실제 저장소에서도 명령이 돈다(원천이 아직 이력에 없으면 빈 집합이다)
  const 산 = 지난판([`${원천상대}/package.json`]);
  assert.ok(산.get(`${원천상대}/package.json`) instanceof Set);
});

test('편 가르기 — 맨 위 편만, 브랜드는 첫 _ 앞, 날짜는 폴더 이름 끝', () => {
  assert.deepStrictEqual(편가르기('docs/마케팅/synkbrief_없는판결_20261111/remotion/tsconfig.json'), { 편: 'synkbrief_없는판결_20261111', 브랜드: 'synkbrief', 날짜: '20261111', 안: 'tsconfig.json' });
  assert.deepStrictEqual(편가르기('docs/마케팅/LAB_네마침표_mn_20261110/remotion/src/lib/fonts.ts'), { 편: 'LAB_네마침표_mn_20261110', 브랜드: 'LAB', 날짜: '20261110', 안: 'src/lib/fonts.ts' });
  assert.strictEqual(편가르기('docs/마케팅/PULSE_포트폴리오_제작준비_20261012/video/자막시안_20261103/remotion/package.json'), null);
  assert.strictEqual(편가르기('docs/마케팅/LAB_퀴즈은행/틀/package.json'), null);
  assert.strictEqual(편가르기('tools/편틀/package.json'), null);
  assert.strictEqual(편가르기('docs/마케팅/LAB_날짜없는편/remotion/package.json').날짜, null);
  const 틀 = { 적용: { synkbrief: '20261115' }, 예외: { synkbrief_다른틀_20261120: '까닭' } };
  const 편 = (이름) => 편가르기(`docs/마케팅/${이름}/remotion/package.json`);
  assert.strictEqual(대상인가(편('synkbrief_새편_20261115'), 틀), true);
  assert.strictEqual(대상인가(편('synkbrief_새편_20261201'), 틀), true);
  assert.strictEqual(대상인가(편('synkbrief_없는판결_20261114'), 틀), false, '문턱 전 날짜의 편은 얼린 것이다');
  assert.strictEqual(대상인가(편('LAB_새편_20261120'), 틀), false, '「적용」에 없는 브랜드는 보지 않는다');
  assert.strictEqual(대상인가(편('synkbrief_다른틀_20261120'), 틀), false, '「예외」에 적힌 편은 넘긴다');
  assert.strictEqual(대상인가(편('synkbriefX_새편_20261120'), 틀), false, '브랜드 이름은 통째로 같아야 한다');
  assert.strictEqual(대상인가(편('synkbrief_날짜없는편'), 틀), false);
});
