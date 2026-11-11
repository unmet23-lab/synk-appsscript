/* 새편 — 틀 찍기 · 부품 잇기 · 부품 깔기 (2026-11-11). 도구: tools/새편.js, 원천 대조는 tests/편틀.test.js.
 *
 * 진짜 npm · 진짜 부품 자리(%LOCALAPPDATA%\synk\remotion-parts)는 건드리지 않는다 — 임시 폴더의 가짜 원천 · 가짜 부품 자리 · 가짜 설치기로 돈다
 * (설치기를 바꿔 넣고 자리를 안 주면 도구가 던진다). 연결은 fs.symlinkSync(…, 'junction')이라 Linux에서는 그냥 심링크다(OS 조건으로 건너뛰는 시험 없음).
 * 가짜 원천의 「적용」은 LAB · synkbrief 2026-11-12부터다.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const 새편 = require('../tools/새편.js');

const REPO = path.resolve(__dirname, '..');
const 도구 = path.join(REPO, 'tools', '새편.js');

/** 가짜 설치기 — 잠금의 선택 아닌 패키지를 깐 것처럼 폴더 · 장부(.package-lock.json) · remotion 실행 파일을 놓는다 */
function 가짜설치(폴더) {
  const fs2 = require('node:fs'), path2 = require('node:path');
  const 잠금 = JSON.parse(fs2.readFileSync(path2.join(폴더, 'package-lock.json'), 'utf8'));
  const 깔린 = {};
  for (const [이름, 값] of Object.entries(잠금.packages)) {
    if (!이름 || 값.optional) continue;
    깔린[이름] = { version: 값.version, integrity: 값.integrity };
    fs2.mkdirSync(path2.join(폴더, 이름), { recursive: true });
    fs2.writeFileSync(path2.join(폴더, 이름, 'package.json'), JSON.stringify({ name: 이름.replace(/^node_modules\//, ''), version: 값.version }) + '\n');
  }
  fs2.mkdirSync(path2.join(폴더, 'node_modules', '.bin'), { recursive: true });
  for (const 실행 of ['remotion', 'remotion.cmd']) fs2.writeFileSync(path2.join(폴더, 'node_modules', '.bin', 실행), '가짜\n');
  fs2.writeFileSync(path2.join(폴더, 'node_modules', '.package-lock.json'), JSON.stringify({ packages: 깔린 }));
}

/** 임시 저장소 뿌리 + 가짜 원천(진짜 틀 글 파일 + 작은 잠금 + 가짜 글꼴) + 빈 부품 자리 */
function 무대(t, 틀바꿈 = {}) {
  const 바닥 = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), '새편-')));
  t.after(() => {
    // 연결을 따라 지우지 않게 연결부터 푼다
    const 걷기 = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isSymbolicLink()) fs.unlinkSync(p); else if (e.isDirectory()) 걷기(p); } };
    try { 걷기(바닥); } catch {}
    fs.rmSync(바닥, { recursive: true, force: true });
  });
  const 뿌리 = path.join(바닥, '뿌리'), 원천 = path.join(뿌리, 'tools', '편틀'), 자리 = path.join(바닥, '부품');
  const 진짜틀 = 새편.틀읽기();
  fs.mkdirSync(path.join(원천, 'src', 'lib'), { recursive: true });
  for (const 이름 of [...진짜틀.같아야, 'gitignore.기본', 'gitignore.synkbrief']) {
    fs.mkdirSync(path.dirname(path.join(원천, 이름)), { recursive: true });
    fs.copyFileSync(path.join(새편.기본원천, 이름), path.join(원천, 이름));
  }
  const 진짜글 = JSON.parse(fs.readFileSync(path.join(새편.기본원천, '틀.json'), 'utf8'));
  fs.writeFileSync(path.join(원천, '틀.json'), JSON.stringify({ ...진짜글, 적용: { LAB: '20261112', synkbrief: '20261112' }, 예외: {}, ...틀바꿈 }, null, 1));
  const 잠금 = { name: 'remotion', lockfileVersion: 3, packages: {
    '': { name: 'remotion', dependencies: { remotion: '4.0.535', react: '19.2.3', '@remotion/cli': '4.0.535' }, devDependencies: { typescript: '5.9.3' } },
    'node_modules/remotion': { version: '4.0.535', integrity: 'sha512-가' },
    'node_modules/react': { version: '19.2.3', integrity: 'sha512-나' },
    'node_modules/@remotion/cli': { version: '4.0.535', integrity: 'sha512-다' },
    'node_modules/typescript': { version: '5.9.3', integrity: 'sha512-라', dev: true },
    'node_modules/@x/linux-only': { version: '1.0.0', integrity: 'sha512-마', optional: true },
  } };
  fs.writeFileSync(path.join(원천, 'package-lock.json'), `${JSON.stringify(잠금, null, 2)}\n`);
  for (const 출처 of Object.values(진짜틀.글꼴)) {
    fs.mkdirSync(path.dirname(path.join(뿌리, 출처)), { recursive: true });
    fs.writeFileSync(path.join(뿌리, 출처), Buffer.concat([Buffer.from([0, 1, 2, 3]), Buffer.from(출처)]));
  }
  let 깐횟수 = 0;
  const 옵션 = { 원천, 뿌리, 자리, 설치기: (폴더) => { 깐횟수 += 1; 가짜설치(폴더); } };
  const 편 = (이름) => path.join(뿌리, 'docs', '마케팅', 이름);
  return { 바닥, 뿌리, 원천, 자리, 옵션, 편, 틀: 진짜틀, 깐횟수: () => 깐횟수 };
}
const 읽기 = (p) => fs.readFileSync(p);
const 안파일 = (d) => { const 줄 = []; const 걷기 = (x, 앞) => { for (const e of fs.readdirSync(x, { withFileTypes: true })) { const 상 = 앞 ? `${앞}/${e.name}` : e.name; if (e.isSymbolicLink()) 줄.push(`${상}@`); else if (e.isDirectory()) 걷기(path.join(x, e.name), 상); else 줄.push(상); } }; 걷기(d, ''); return 줄.sort(); };
const 모습 = (프) => 안파일(프).filter((p) => !p.endsWith('@')).map((p) => [p, 읽기(path.join(프, p)).toString('base64')]);
/** 옛 방식으로 손 복사한 편 — 틀 파일은 원천 판이되 tsconfig · fonts.ts가 다르고 eslint · .gitignore가 없다 */
function 손복사편(무, 이름) {
  const 프 = path.join(무.편(이름), 'remotion');
  for (const f of ['package.json', 'remotion.config.ts', 'tsconfig.json', 'src/index.ts', 'src/lib/fonts.ts']) { fs.mkdirSync(path.dirname(path.join(프, f)), { recursive: true }); fs.copyFileSync(path.join(무.원천, f), path.join(프, f)); }
  fs.writeFileSync(path.join(프, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }\n');
  fs.appendFileSync(path.join(프, 'src', 'lib', 'fonts.ts'), "export const PEN = \"'Nanum Pen Script', 'SUIT', sans-serif\";\n");
  fs.writeFileSync(path.join(프, 'src', 'Root.tsx'), "import './lib/fonts';\nexport const RemotionRoot = () => null;\n");
  return 프;
}

test('새 편 — 틀을 원천과 같은 바이트로 찍고 부품을 한 곳에 잇는다. 편 고유 파일은 만들지 않는다', (t) => {
  const 무 = 무대(t);
  const 편 = 무.편('LAB_새편_20261112');
  const r = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.strictEqual(r.결과, '됨');
  assert.deepStrictEqual([r.브랜드, r.갈래], ['LAB', '틀까지']);
  const 프 = path.join(편, 'remotion');
  for (const 이름 of 무.틀.같아야) assert.ok(읽기(path.join(프, 이름)).equals(읽기(path.join(무.원천, 이름))), 이름);
  for (const [이름, 출처] of Object.entries(무.틀.글꼴)) assert.ok(읽기(path.join(프, 이름)).equals(읽기(path.join(무.뿌리, 출처))), 이름);
  assert.ok(읽기(path.join(프, '.gitignore')).equals(읽기(path.join(무.원천, 'gitignore.기본'))), '기본 .gitignore');
  assert.deepStrictEqual(안파일(프), ['.gitignore', ...무.틀.같아야, ...Object.keys(무.틀.글꼴), 'node_modules@'].sort(), '찍는 것은 목록의 파일과 연결뿐 — 잠금 파일 · Root.tsx는 만들지 않는다');
  const 부품 = 새편.부품상태(무.옵션);
  assert.strictEqual(부품.깔림, true);
  assert.ok(새편.같은길(fs.realpathSync(path.join(프, 'node_modules')), fs.realpathSync(부품.모듈)), '연결이 부품 자리를 가리킨다');
  assert.ok(fs.existsSync(path.join(프, 'node_modules', 'remotion', 'package.json')), '연결을 지나 부품이 보인다');
  assert.strictEqual(r.연결.한일, '잇기');
  assert.deepStrictEqual(fs.readdirSync(무.자리), [부품.열쇠], '부품 자리에는 열쇠 폴더 하나 — 임시 폴더가 남지 않는다');
  assert.ok(/^[\x20-\x7e]+$/.test(path.relative(무.자리, path.join(부품.폴더, 새편.표시이름))) && /^[\x20-\x7e]+$/.test(새편.임시접두 + 새편.비킴꼬리), '부품 자리 안의 이름은 영문이다');
});

test('브랜드 판 — synkbrief 편은 public/img를 무시하는 .gitignore, 그 밖은 기본', (t) => {
  const 무 = 무대(t);
  const 가 = 무.편('synkbrief_새편_20261112'), 나 = 무.편('yuhobuilds_새편_20261112');
  새편.편찍기(가, { ...무.옵션, 실행: true });
  새편.편찍기(나, { ...무.옵션, 실행: true });
  assert.match(fs.readFileSync(path.join(가, 'remotion', '.gitignore'), 'utf8'), /^public\/img\/$/m);
  assert.doesNotMatch(fs.readFileSync(path.join(나, 'remotion', '.gitignore'), 'utf8'), /public\/img/);
  assert.strictEqual(무.깐횟수(), 1, '부품은 한 번만 깐다 — 둘째 편은 깔린 것을 잇는다');
});

test('미리 보기는 아무것도 쓰지 않는다', (t) => {
  const 무 = 무대(t);
  const 편 = 무.편('LAB_새편_20261112');
  const r = 새편.편찍기(편, { ...무.옵션 });
  assert.strictEqual(r.결과, '미리 보기');
  assert.strictEqual(r.찍음.length, 무.틀.같아야.length + Object.keys(무.틀.글꼴).length + 1);
  assert.strictEqual(r.연결.할일, '잇기');
  assert.strictEqual(r.부품.결과, '깔 것');
  assert.strictEqual(fs.existsSync(편), false, '편 폴더를 만들지 않는다');
  assert.strictEqual(fs.existsSync(무.자리), false, '부품 자리를 만들지 않는다');
  assert.strictEqual(무.깐횟수(), 0);
});

test('두 번 돌려도 같다 · 편 파일은 건드리지 않는다', (t) => {
  const 무 = 무대(t);
  const 편 = 무.편('LAB_새편_20261112'), 프 = path.join(편, 'remotion');
  fs.mkdirSync(path.join(프, 'src'), { recursive: true });
  fs.mkdirSync(path.join(프, 'public', 'img'), { recursive: true });
  fs.writeFileSync(path.join(프, 'src', 'Root.tsx'), 'export const RemotionRoot = () => null;\n');
  fs.writeFileSync(path.join(프, 'public', 'img', 'a.png'), Buffer.from([0, 9, 9]));
  fs.writeFileSync(path.join(프, '.gitignore'), 'node_modules\nout\n내줄\n');
  fs.writeFileSync(path.join(프, 'public', 'fonts-extra.txt'), '편 것');
  const 첫 = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.strictEqual(첫.결과, '됨');
  assert.ok(!첫.찍음.includes('.gitignore'), '있는 .gitignore는 다시 찍지 않는다');
  const 앞 = 모습(프);
  const 둘 = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.deepStrictEqual([둘.결과, 둘.갈래, 둘.찍음, 둘.덮음, 둘.다름, 둘.막힘, 둘.연결.상태], ['됨', '틀까지', [], [], [], [], '이어짐']);
  assert.strictEqual(둘.연결.한일, undefined, '이어진 연결은 다시 걸지 않는다');
  assert.deepStrictEqual(모습(프), 앞);
  assert.strictEqual(fs.readFileSync(path.join(프, '.gitignore'), 'utf8'), 'node_modules\nout\n내줄\n');
  assert.strictEqual(무.깐횟수(), 1);
  assert.match(새편.편글(새편.편찍기(편, { ...무.옵션 })), /할 일 없다/);
});

test('원천과 다른 틀 파일은 --갱신 없이 덮지 않는다 · 줄끝만 다른 것은 같은 것이다 · 덮기 전에 사라지는 줄을 보인다', (t) => {
  const 무 = 무대(t);
  const 편 = 무.편('LAB_새편_20261112'), 프 = path.join(편, 'remotion');
  새편.편찍기(편, { ...무.옵션, 실행: true });
  const 고친 = `${fs.readFileSync(path.join(프, 'tsconfig.json'), 'utf8')}// 편에서 고침\n`;
  fs.writeFileSync(path.join(프, 'tsconfig.json'), 고친);
  fs.writeFileSync(path.join(프, 'public', 'fonts', 'DMMono-Medium.ttf'), Buffer.from([0, 7, 7]));
  // 줄끝만 CRLF로 바꾼 글 파일 — git이 같은 blob으로 넣는다
  const 원글 = fs.readFileSync(path.join(무.원천, 'src', 'index.ts'), 'utf8').replace(/\r\n/g, '\n');
  fs.writeFileSync(path.join(프, 'src', 'index.ts'), 원글.replace(/\n/g, '\r\n'));
  const r = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.strictEqual(r.결과, '남은 것 있음');
  assert.deepStrictEqual(r.다름.sort(), ['public/fonts/DMMono-Medium.ttf', 'tsconfig.json']);
  assert.deepStrictEqual(r.사라진줄, { 'tsconfig.json': ['// 편에서 고침'] });
  assert.strictEqual(fs.readFileSync(path.join(프, 'tsconfig.json'), 'utf8'), 고친, '덮지 않았다');
  assert.match(새편.편글(r), /--갱신[\s\S]*원천에 없는 편 쪽 줄 — tsconfig\.json:\s+\/\/ 편에서 고침/);
  const 미리 = 새편.편찍기(편, { ...무.옵션, 갱신: true });
  assert.match(새편.편글(미리), /덮으면 사라지는 편 쪽 줄 — tsconfig\.json:\s+\/\/ 편에서 고침/);
  assert.strictEqual(fs.readFileSync(path.join(프, 'tsconfig.json'), 'utf8'), 고친, '미리 보기는 덮지 않는다');
  const g = 새편.편찍기(편, { ...무.옵션, 실행: true, 갱신: true });
  assert.strictEqual(g.결과, '됨');
  assert.deepStrictEqual(g.덮음.sort(), ['public/fonts/DMMono-Medium.ttf', 'tsconfig.json']);
  assert.ok(읽기(path.join(프, 'tsconfig.json')).equals(읽기(path.join(무.원천, 'tsconfig.json'))));
  assert.strictEqual(fs.readFileSync(path.join(프, 'src', 'index.ts'), 'utf8'), 원글.replace(/\n/g, '\r\n'), '같은 것으로 본 파일은 --갱신도 건드리지 않는다');
  assert.deepStrictEqual(g.알림, [], '렌더 흔적이 없으면 알림도 없다');
});

test('--갱신 — 편이 틀 파일에 더한 이름을 다른 편 파일이 쓰고 있으면 그 파일은 덮지 않는다 · 렌더한 편이면 알린다', (t) => {
  const 무 = 무대(t);
  const 프 = 손복사편(무, 'LAB_손글씨_20261112');
  const 편 = path.dirname(프);
  fs.writeFileSync(path.join(프, 'src', 'Film.tsx'), "import { KO, PEN } from './lib/fonts';\nexport const Film = () => <div style={{ fontFamily: PEN }}>{KO}</div>;\n");
  fs.mkdirSync(path.join(편, '게시'), { recursive: true });
  const 옛fonts = fs.readFileSync(path.join(프, 'src', 'lib', 'fonts.ts'), 'utf8');
  const r = 새편.편찍기(편, { ...무.옵션, 실행: true, 갱신: true });
  assert.strictEqual(r.결과, '남은 것 있음');
  assert.deepStrictEqual(r.다름, ['src/lib/fonts.ts']);
  assert.match(r.막힘.join('\n'), /src\/lib\/fonts\.ts — 편이 더한 PEN을\(를\) src\/Film\.tsx이\(가\) 쓴다/);
  assert.strictEqual(fs.readFileSync(path.join(프, 'src', 'lib', 'fonts.ts'), 'utf8'), 옛fonts, '쓰이는 이름이 든 파일은 덮지 않았다');
  assert.deepStrictEqual(r.덮음, ['tsconfig.json'], '다른 틀 파일은 원천 판으로 바꿨다');
  assert.match(r.알림.join('\n'), /렌더 · 게시 흔적[\s\S]*판본 지문/);
  assert.match(r.사라진줄['src/lib/fonts.ts'].join('\n'), /export const PEN/);
  // 통째로 가져와 쓰는 꼴 · 다시 내보내는 꼴도 잡는다(여러 줄 import 포함)
  fs.writeFileSync(path.join(프, 'src', 'Film.tsx'), "import * as F from './lib/fonts';\nexport const Film = () => <div style={{ fontFamily: F.PEN }}>{F.KO}</div>;\n");
  assert.match(새편.편찍기(편, { ...무.옵션, 갱신: true }).막힘.join('\n'), /PEN을\(를\) src\/Film\.tsx/);
  fs.mkdirSync(path.join(프, 'src', 'e1'), { recursive: true });
  fs.writeFileSync(path.join(프, 'src', 'Film.tsx'), "import { KO } from './lib/fonts';\nexport const Film = () => <div>{KO}</div>;\n");
  fs.writeFileSync(path.join(프, 'src', 'e1', 'index.ts'), "export {\n  KO,\n  PEN as 손글씨,\n} from '../lib/fonts.ts';\n");
  assert.match(새편.편찍기(편, { ...무.옵션, 갱신: true }).막힘.join('\n'), /PEN을\(를\) src\/e1\/index\.ts/);
  fs.writeFileSync(path.join(프, 'src', 'e1', 'index.ts'), "export * from '../lib/fonts';\n");
  assert.match(새편.편찍기(편, { ...무.옵션, 갱신: true }).막힘.join('\n'), /PEN을\(를\) src\/e1\/index\.ts/, '통째로 다시 내보내는 꼴');
  fs.rmSync(path.join(프, 'src', 'e1'), { recursive: true });
  // 편 파일로 옮기고 나면(같은 이름이어도 틀 파일에서 가져오지 않으면) 덮는다
  fs.writeFileSync(path.join(프, 'src', 'lib', '편서체.ts'), "export const PEN = \"'Nanum Pen Script', 'SUIT', sans-serif\";\n");
  fs.writeFileSync(path.join(프, 'src', 'Film.tsx'), "import { KO } from './lib/fonts';\nimport { PEN } from './lib/편서체';\nexport const Film = () => <div style={{ fontFamily: PEN }}>{KO}</div>;\n");
  const 둘 = 새편.편찍기(편, { ...무.옵션, 실행: true, 갱신: true });
  assert.deepStrictEqual([둘.결과, 둘.덮음, 둘.막힘], ['됨', ['src/lib/fonts.ts'], []]);
  assert.ok(읽기(path.join(프, 'src', 'lib', 'fonts.ts')).equals(읽기(path.join(무.원천, 'src', 'lib', 'fonts.ts'))));
  assert.match(fs.readFileSync(path.join(프, 'src', 'lib', '편서체.ts'), 'utf8'), /PEN/, '편 파일은 그대로다');
});

test('옛 편 · 「적용」에 없는 브랜드 · 「예외」 편은 부품만 잇는다 — 틀은 찍지도 덮지도 않는다', (t) => {
  const 무 = 무대(t, { 예외: { LAB_예외편_20261120: '판본을 이미 구운 편' } });
  for (const 이름 of ['LAB_옛편_20261111', 'yuhobuilds_다른브랜드_20261120', 'LAB_예외편_20261120', 'LAB_날짜없는편']) {
    const 프 = 손복사편(무, 이름);
    const 앞 = 모습(프);
    const 미리 = 새편.편찍기(path.dirname(프), { ...무.옵션 });
    assert.deepStrictEqual([미리.갈래, 미리.찍음, 미리.덮음, 미리.다름, 미리.연결.할일], ['부품만', [], [], [], '잇기'], 이름);
    const r = 새편.편찍기(path.dirname(프), { ...무.옵션, 실행: true });
    assert.deepStrictEqual([r.결과, r.갈래, r.찍음, r.덮음, r.다름, r.막힘, r.연결.상태], ['됨', '부품만', [], [], [], [], '이어짐'], 이름);
    assert.deepStrictEqual(r.보기만.다름.sort(), ['src/lib/fonts.ts', 'tsconfig.json'], '틀의 모습은 보기만 한다');
    assert.ok(r.보기만.없음.includes('eslint.config.mjs') && r.보기만.없음.includes('.gitignore'));
    assert.deepStrictEqual(모습(프), 앞, `${이름} — 편 파일이 하나도 안 바뀌고 새 파일도 없다`);
    assert.ok(fs.existsSync(path.join(프, 'node_modules', 'remotion', 'package.json')));
    assert.match(새편.편글(r), /부품만\(이미 있는 편이고 틀 대조 대상이 아니다/);
  }
  // 같은 옛 편도 --갱신을 주면 틀까지 바꾼다
  const 프 = path.join(무.편('LAB_옛편_20261111'), 'remotion');
  const g = 새편.편찍기(무.편('LAB_옛편_20261111'), { ...무.옵션, 실행: true, 갱신: true });
  assert.deepStrictEqual([g.결과, g.갈래], ['됨', '틀까지']);
  assert.ok(g.덮음.includes('tsconfig.json') && g.덮음.includes('src/lib/fonts.ts') && g.찍음.includes('eslint.config.mjs') && g.찍음.includes('.gitignore'));
  assert.ok(읽기(path.join(프, 'tsconfig.json')).equals(읽기(path.join(무.원천, 'tsconfig.json'))));
});

test('「적용」 편이면 이미 있는 편도 틀까지 본다 — 없는 틀 파일은 찍고 다른 것은 다름으로 알린다', (t) => {
  const 무 = 무대(t);
  const 프 = 손복사편(무, 'LAB_적용편_20261112');
  const r = 새편.편찍기(path.dirname(프), { ...무.옵션, 실행: true });
  assert.deepStrictEqual([r.결과, r.갈래], ['남은 것 있음', '틀까지']);
  assert.deepStrictEqual(r.다름.sort(), ['src/lib/fonts.ts', 'tsconfig.json']);
  assert.ok(r.찍음.includes('eslint.config.mjs') && r.찍음.includes('.gitignore'));
  assert.strictEqual(r.연결.상태, '이어짐', 'package.json이 같으니 부품은 잇는다');
});

test('package.json이 원천과 다른 편(옛 판 틀)에는 부품을 잇지 않는다 — --갱신하면 잇는다', (t) => {
  const 무 = 무대(t);
  for (const 이름 of ['LAB_옛판_20261112', 'LAB_옛판_20261101']) {
    const 편 = 무.편(이름), 프 = path.join(편, 'remotion');
    fs.mkdirSync(프, { recursive: true });
    fs.writeFileSync(path.join(프, 'package.json'), '{"name":"remotion","dependencies":{"remotion":"4.0.100"}}\n');
    const r = 새편.편찍기(편, { ...무.옵션, 실행: true });
    assert.strictEqual(r.결과, '남은 것 있음', 이름);
    assert.match(r.막힘.join('\n'), /부품을 잇지 않았다/);
    assert.strictEqual(fs.existsSync(path.join(프, 'node_modules')), false);
    assert.strictEqual(무.깐횟수(), 0, '잇지 않을 편 때문에 부품을 깔지 않는다');
  }
  const g = 새편.편찍기(무.편('LAB_옛판_20261112'), { ...무.옵션, 실행: true, 갱신: true });
  assert.strictEqual(g.결과, '됨');
  assert.strictEqual(g.연결.상태, '이어짐');
  // 다른 판의 옛 편이 이미 제 부품 폴더에 이어져 있으면 멀쩡한 것이다 — 막힘이 아니고 연결을 바꾸지 않는다. 끝이 빈 연결이면 막힘이다
  const 옛부품 = path.join(무.바닥, '옛부품', 'node_modules');
  fs.mkdirSync(옛부품, { recursive: true });
  fs.writeFileSync(path.join(옛부품, '.package-lock.json'), '{"packages":{}}');
  fs.mkdirSync(path.join(옛부품, 'remotion'));
  fs.writeFileSync(path.join(옛부품, 'remotion', 'package.json'), '{"name":"remotion","version":"4.0.100"}');
  const 옛프 = path.join(무.편('LAB_옛판_20261101'), 'remotion');
  fs.symlinkSync(옛부품, path.join(옛프, 'node_modules'), 'junction');
  const 둠 = 새편.편찍기(무.편('LAB_옛판_20261101'), { ...무.옵션, 실행: true });
  assert.deepStrictEqual([둠.결과, 둠.막힘, 둠.연결.상태], ['됨', [], '다른 곳']);
  assert.match(둠.알림.join('\n'), /지금 이어진 부품 폴더.*그대로 둔다/);
  assert.ok(새편.같은길(fs.realpathSync(path.join(옛프, 'node_modules')), fs.realpathSync(옛부품)), '연결을 바꾸지 않았다');
  // 장부(.package-lock.json)만 남고 속이 빈 폴더는 살아 있는 것이 아니다
  fs.rmSync(path.join(옛부품, 'remotion'), { recursive: true });
  assert.match(새편.편찍기(무.편('LAB_옛판_20261101'), { ...무.옵션, 실행: true }).막힘.join('\n'), /부품을 잇지 않았다/);
});

test('편에 잠금 파일이 있으면 원천과 같아야 한다 — 없으면 찍지 않는다', (t) => {
  const 무 = 무대(t);
  const 편 = 무.편('LAB_잠금_20261112'), 프 = path.join(편, 'remotion');
  fs.mkdirSync(프, { recursive: true });
  fs.writeFileSync(path.join(프, 'package-lock.json'), '{"lockfileVersion":3,"packages":{}}\n');
  const r = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.deepStrictEqual(r.다름, ['package-lock.json']);
  fs.copyFileSync(path.join(무.원천, 'package-lock.json'), path.join(프, 'package-lock.json'));
  assert.deepStrictEqual(새편.편찍기(편, { ...무.옵션, 실행: true }).다름, []);
});

test('앞 편을 가리키던 연결은 연결만 풀고 다시 건다 — 옛 대상 폴더는 그대로', (t) => {
  const 무 = 무대(t);
  const 옛 = path.join(무.편('LAB_옛편_20261024'), 'remotion', 'node_modules');
  fs.mkdirSync(path.join(옛, 'remotion'), { recursive: true });
  fs.writeFileSync(path.join(옛, 'remotion', 'package.json'), '옛 것');
  const 편 = 무.편('LAB_새편_20261112'), 프 = path.join(편, 'remotion');
  fs.mkdirSync(프, { recursive: true });
  fs.symlinkSync(옛, path.join(프, 'node_modules'), 'junction');
  const 미리 = 새편.편찍기(편, { ...무.옵션 });
  assert.strictEqual(미리.연결.상태, '다른 곳');
  assert.strictEqual(미리.연결.할일, '다시 잇기');
  assert.ok(fs.lstatSync(path.join(프, 'node_modules')).isSymbolicLink() && 새편.같은길(fs.realpathSync(path.join(프, 'node_modules')), fs.realpathSync(옛)), '미리 보기는 연결을 안 바꾼다');
  const r = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.strictEqual(r.연결.한일, '다시 잇기');
  assert.ok(새편.같은길(fs.realpathSync(path.join(프, 'node_modules')), fs.realpathSync(새편.부품상태(무.옵션).모듈)));
  assert.strictEqual(fs.readFileSync(path.join(옛, 'remotion', 'package.json'), 'utf8'), '옛 것', '옛 대상은 건드리지 않는다');
});

test('부품 폴더가 실폴더인 편은 손대지 않는다', (t) => {
  const 무 = 무대(t);
  const 편 = 무.편('LAB_실폴더_20261112'), 프 = path.join(편, 'remotion');
  fs.mkdirSync(path.join(프, 'node_modules', 'remotion'), { recursive: true });
  fs.writeFileSync(path.join(프, 'node_modules', 'remotion', 'package.json'), '실폴더 것');
  const r = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.strictEqual(r.결과, '됨');
  assert.strictEqual(r.연결.상태, '실폴더');
  assert.strictEqual(fs.lstatSync(path.join(프, 'node_modules')).isSymbolicLink(), false);
  assert.strictEqual(fs.readFileSync(path.join(프, 'node_modules', 'remotion', 'package.json'), 'utf8'), '실폴더 것');
  assert.strictEqual(무.깐횟수(), 0);
  assert.match(새편.편글(r), /실폴더다 — 손대지 않는다/);
});

test('이어진 편인데 부품 속이 비었으면 「할 일 없다」가 아니다 — 실행하면 비켜 놓고 같은 자리에 다시 깔아 연결이 산다', (t) => {
  const 무 = 무대(t);
  const 편 = 무.편('LAB_새편_20261112'), 프 = path.join(편, 'remotion');
  새편.편찍기(편, { ...무.옵션, 실행: true });
  const 부품 = 새편.부품상태(무.옵션);
  // 사본을 통째로 지우다 연결을 따라 들어간 사고처럼 속을 비운다(장부는 남는다)
  for (const 이름 of ['remotion', 'react', '@remotion', '.bin']) fs.rmSync(path.join(부품.모듈, 이름), { recursive: true, force: true });
  const 빈 = 새편.부품상태(무.옵션);
  assert.deepStrictEqual([빈.깔림, 빈.반쪽], [false, true]);
  assert.ok(빈.빠진것.includes('remotion') && 빈.빠진것.some((n) => n.startsWith('.bin/')));
  const 미리 = 새편.편찍기(편, { ...무.옵션 });
  assert.strictEqual(미리.부품.결과, '깔 것');
  assert.match(새편.편글(미리), /속이 비었다[\s\S]*--실행으로 한다/);
  assert.doesNotMatch(새편.편글(미리), /할 일 없다/);
  assert.match(새편.부품글(새편.부품깔기({ ...무.옵션 })), /부품 깔 것[\s\S]*깔리지 않은 폴더가 있다/);
  const r = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.deepStrictEqual([r.결과, r.부품.결과, r.연결.상태], ['됨', '깖', '이어짐']);
  assert.strictEqual(무.깐횟수(), 2);
  assert.ok(fs.existsSync(path.join(프, 'node_modules', 'remotion', 'package.json')), '같은 자리에 다시 깔려 연결이 산다');
  const 비킨 = fs.readdirSync(무.자리).filter((n) => n.startsWith(`${부품.열쇠}${새편.비킴꼬리}`));
  assert.strictEqual(비킨.length, 1, '속 빈 폴더는 지우지 않고 비켜 놓는다');
  assert.ok(fs.existsSync(path.join(무.자리, 비킨[0], 'node_modules', '.package-lock.json')));
});

test('부품 — 잠금과 다르게 깔리거나 실물이 비면 멈추고, 열쇠 자리도 제 임시 폴더도 남기지 않는다', (t) => {
  const 무 = 무대(t);
  const 틀린설치 = (폴더) => { 가짜설치(폴더); const p = path.join(폴더, 'node_modules', '.package-lock.json'); const j = JSON.parse(fs.readFileSync(p, 'utf8')); j.packages['node_modules/react'].version = '18.0.0'; fs.writeFileSync(p, JSON.stringify(j)); };
  assert.throws(() => 새편.부품깔기({ ...무.옵션, 실행: true, 설치기: 틀린설치 }), /잠금 파일과 다르다[\s\S]*다른 판 node_modules\/react/);
  assert.throws(() => 새편.부품깔기({ ...무.옵션, 실행: true, 설치기: (폴더) => fs.mkdirSync(path.join(폴더, 'node_modules')) }), /package-lock\.json을 못 읽었다/);
  // 장부는 맞는데 실물 폴더가 빈 설치(끝이 빈 폴더였던 옛 연결과 같은 꼴) · 실행 파일이 없는 설치
  const 빈설치 = (폴더) => { 가짜설치(폴더); fs.rmSync(path.join(폴더, 'node_modules', 'remotion'), { recursive: true }); };
  assert.throws(() => 새편.부품깔기({ ...무.옵션, 실행: true, 설치기: 빈설치 }), /실물이 없다 remotion/);
  const 실행없는설치 = (폴더) => { 가짜설치(폴더); fs.rmSync(path.join(폴더, 'node_modules', '.bin'), { recursive: true }); };
  assert.throws(() => 새편.부품깔기({ ...무.옵션, 실행: true, 설치기: 실행없는설치 }), /실물이 없다 \.bin\/remotion/);
  assert.throws(() => 새편.부품깔기({ ...무.옵션, 실행: true, 설치기: () => { throw new Error('npm ci 실패(종료 1)'); } }), /npm ci 실패/);
  const 뒤 = 새편.부품상태(무.옵션);
  assert.deepStrictEqual([뒤.깔림, fs.existsSync(뒤.폴더), 뒤.남은임시], [false, false, []], '실패한 설치는 아무것도 남기지 않는다');
  assert.strictEqual(새편.부품깔기({ ...무.옵션, 실행: true }).결과, '깖');
});

test('부품 — 무결성 값이 다르거나 잠금에 없는 패키지가 깔리면 멈춘다 · 표시의 열쇠가 다르면 깔린 것으로 보지 않는다', (t) => {
  const 무 = 무대(t);
  const 장부고침 = (고침) => (폴더) => { 가짜설치(폴더); const p = path.join(폴더, 'node_modules', '.package-lock.json'); const j = JSON.parse(fs.readFileSync(p, 'utf8')); 고침(j.packages); fs.writeFileSync(p, JSON.stringify(j)); };
  assert.throws(() => 새편.부품깔기({ ...무.옵션, 실행: true, 설치기: 장부고침((p) => { p['node_modules/react'].integrity = 'sha512-남의것'; }) }), /다른 판 node_modules\/react/);
  assert.throws(() => 새편.부품깔기({ ...무.옵션, 실행: true, 설치기: 장부고침((p) => { p['node_modules/몰래든것'] = { version: '1.0.0' }; }) }), /잠금에 없는 것 node_modules\/몰래든것/);
  assert.strictEqual(새편.부품깔기({ ...무.옵션, 실행: true }).결과, '깖');
  const 깔린 = 새편.부품상태(무.옵션);
  assert.strictEqual(깔린.깔림, true);
  const 표시 = path.join(깔린.폴더, 새편.표시이름);
  fs.writeFileSync(표시, JSON.stringify({ ...JSON.parse(fs.readFileSync(표시, 'utf8')), 열쇠: 'remotion-0.0.0-다른열쇠' }));
  const 뒤 = 새편.부품상태(무.옵션);
  assert.deepStrictEqual([뒤.깔림, 뒤.반쪽, 뒤.빠진것], [false, true, ['깔림 표시']], '다른 열쇠의 표시가 든 폴더는 이 열쇠로 깔린 것이 아니다');
});

test('편찍기 — 부품 깔기가 실패하면 멈춘다. 찍힌 틀은 그대로 남고 연결은 만들지 않는다(다시 돌리면 이어진다)', (t) => {
  const 무 = 무대(t);
  const 편 = 무.편('LAB_새편_20261112'), 프 = path.join(편, 'remotion');
  assert.throws(() => 새편.편찍기(편, { ...무.옵션, 실행: true, 설치기: () => { throw new Error('npm ci 실패(종료 1)'); } }), /npm ci 실패/);
  for (const 이름 of 무.틀.같아야) assert.ok(읽기(path.join(프, 이름)).equals(읽기(path.join(무.원천, 이름))), `틀은 찍혀 있다: ${이름}`);
  assert.throws(() => fs.lstatSync(path.join(프, 'node_modules')), /ENOENT/, '깔지 못한 부품에 연결을 걸지 않는다');
  const 뒤 = 새편.부품상태(무.옵션);
  assert.deepStrictEqual([뒤.깔림, fs.existsSync(뒤.폴더), 뒤.남은임시], [false, false, []]);
  const r = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.deepStrictEqual([r.결과, r.찍음, r.연결.한일, r.부품.결과], ['됨', [], '잇기', '깖']);
});

test('원천을 고치기 전에 찍은 편은 「지난 판」이다 — 다름으로 몰지 않고 그대로 둔다(--갱신을 줘야 지금 판으로)', (t) => {
  const 무 = 무대(t);
  const git = (...인자) => { const r = spawnSync('git', ['-c', 'user.name=시험', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.quotepath=false', ...인자], { cwd: 무.뿌리, encoding: 'utf8' }); assert.strictEqual(r.status, 0, r.stderr); return r.stdout; };
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', '원천 첫 판');
  const 편 = 무.편('LAB_먼저찍은편_20261112'), 프 = path.join(편, 'remotion');
  새편.편찍기(편, { ...무.옵션, 실행: true });
  const 찍힌 = 읽기(path.join(프, 'src', 'lib', 'fonts.ts'));
  // 원천을 고쳐 올린다 — 그 전에 찍은 편의 fonts.ts는 원천이 지나온 판이다
  fs.appendFileSync(path.join(무.원천, 'src', 'lib', 'fonts.ts'), '// 원천을 고침\n');
  fs.appendFileSync(path.join(무.원천, 'tsconfig.json'), '\n');
  git('commit', '-q', '-am', '원천 고침');
  const r = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.deepStrictEqual([r.결과, r.다름, r.지난판.sort(), r.막힘, r.덮음], ['됨', [], ['src/lib/fonts.ts', 'tsconfig.json'], [], []]);
  assert.ok(읽기(path.join(프, 'src', 'lib', 'fonts.ts')).equals(찍힌), '지난 판은 건드리지 않는다');
  assert.match(새편.편글(r), /원천의 지난 판 2: .*그대로 둔다/);
  // 원천에 없던 판은 여전히 다름이다
  fs.appendFileSync(path.join(프, 'tsconfig.json'), '// 편에서 고침\n');
  const 다른 = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.deepStrictEqual([다른.결과, 다른.다름, 다른.지난판], ['남은 것 있음', ['tsconfig.json'], ['src/lib/fonts.ts']]);
  // --갱신은 지난 판도 지금 판으로 바꾼다
  const g = 새편.편찍기(편, { ...무.옵션, 실행: true, 갱신: true });
  assert.deepStrictEqual([g.결과, g.덮음.sort()], ['됨', ['src/lib/fonts.ts', 'tsconfig.json']]);
  assert.ok(읽기(path.join(프, 'src', 'lib', 'fonts.ts')).equals(읽기(path.join(무.원천, 'src', 'lib', 'fonts.ts'))));
  // 옛 편(부품만)에서는 보기만 한다 · package.json이 지난 판이면 지금 부품 자리에 잇지 않는다
  const 옛 = 무.편('LAB_옛편_20261101');
  fs.mkdirSync(path.join(옛, 'remotion'), { recursive: true });
  fs.writeFileSync(path.join(옛, 'remotion', 'tsconfig.json'), git('show', 'HEAD~1:tools/편틀/tsconfig.json'));
  fs.copyFileSync(path.join(무.원천, 'package.json'), path.join(옛, 'remotion', 'package.json'));
  const 옛결과 = 새편.편찍기(옛, { ...무.옵션, 실행: true });
  assert.deepStrictEqual([옛결과.갈래, 옛결과.보기만.지난판, 옛결과.보기만.다름, 옛결과.연결.상태], ['부품만', ['tsconfig.json'], [], '이어짐']);
  fs.writeFileSync(path.join(무.원천, 'package.json'), fs.readFileSync(path.join(무.원천, 'package.json'), 'utf8').replace('"name": "remotion"', '"name": "remotion-다음판"'));
  git('commit', '-q', '-am', '꾸러미 판 올림');
  const 판올림뒤 = 새편.편찍기(무.편('LAB_먼저찍은편_20261112'), { ...무.옵션 });
  assert.ok(판올림뒤.지난판.includes('package.json'));
  fs.unlinkSync(path.join(프, 'node_modules'));
  const 못이음 = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.match(못이음.막힘.join('\n'), /다른 Remotion 판의 편[\s\S]*--갱신은 이 편을 지금 판으로 다시 렌더하기로 했을 때만/);
  assert.throws(() => fs.lstatSync(path.join(프, 'node_modules')), /ENOENT/, '다른 판의 편을 지금 부품 자리에 잇지 않는다');
});

test('부품 — 열쇠 자리에 표시 없는 폴더가 있으면 지우지 않고 비켜 놓은 뒤 깐다', (t) => {
  const 무 = 무대(t);
  const 앞 = 새편.부품상태(무.옵션);
  fs.mkdirSync(path.join(앞.폴더, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(앞.폴더, 'node_modules', '손으로.txt'), '손으로 만든 것');
  const 반 = 새편.부품상태(무.옵션);
  assert.strictEqual(반.반쪽, true);
  assert.ok(반.빠진것.includes('깔림 표시'));
  const r = 새편.부품깔기({ ...무.옵션, 실행: true });
  assert.deepStrictEqual([r.결과, r.깔림], ['깖', true]);
  const 비킨 = fs.readdirSync(무.자리).filter((n) => n.startsWith(`${앞.열쇠}${새편.비킴꼬리}`));
  assert.strictEqual(비킨.length, 1);
  assert.strictEqual(fs.readFileSync(path.join(무.자리, 비킨[0], 'node_modules', '손으로.txt'), 'utf8'), '손으로 만든 것');
});

test('부품 — 죽은 설치가 남긴 오래된 임시 폴더만 치운다(산 것 · 방금 것 · 남의 폴더는 둔다)', (t) => {
  const 무 = 무대(t);
  const 열쇠 = 새편.열쇠(무.원천);
  // 있을 수 없는 pid — Windows의 pid는 4의 배수이고 Linux의 pid는 2^22를 넘지 않는다(방금 끝난 프로세스의 pid는 곧바로 다시 쓰일 수 있다)
  const 죽은pid = 2147483645;
  fs.mkdirSync(무.자리, { recursive: true });
  const 만들기 = (이름, 분전) => { const p = path.join(무.자리, 이름); fs.mkdirSync(path.join(p, 'node_modules'), { recursive: true }); fs.writeFileSync(path.join(p, 'node_modules', 'x'), 'x'); const 때 = new Date(Date.now() - 분전 * 60000); fs.utimesSync(p, 때, 때); return 이름; };
  const 죽고오래 = 만들기(`${새편.임시접두}${열쇠}-${죽은pid}-0a1b2c3d`, 60);
  const 죽고방금 = 만들기(`${새편.임시접두}${열쇠}-${죽은pid}-1a1b2c3d`, 1);
  const 살고오래 = 만들기(`${새편.임시접두}${열쇠}-${process.pid}-2a1b2c3d`, 60);
  const 꼴다름 = 만들기(`${새편.임시접두}손으로만든것`, 60);
  const 남의것 = 만들기('remotion-4.0.1-옛열쇠', 600);
  const r = 새편.부품깔기({ ...무.옵션, 실행: true });
  assert.strictEqual(r.결과, '깖');
  assert.deepStrictEqual(fs.readdirSync(무.자리).sort(), [죽고방금, 살고오래, 꼴다름, 남의것, 열쇠].sort());
  assert.strictEqual(fs.existsSync(path.join(무.자리, 죽고오래)), false);
});

test('부품 — 두 프로세스가 같이 깔아도 한 벌이고 임시 폴더가 남지 않는다', async (t) => {
  const 무 = 무대(t);
  // 두 설치가 겹치게: 설치기가 임시 폴더 둘이 보이거나 상대가 먼저 끼울 때까지(길어야 10초) 기다린 뒤 깐다 — 둘 다 「안 깔림」을 본 뒤다
  const 글 = `
    const { 부품깔기, 임시접두 } = require(${JSON.stringify(도구)});
    const fs = require('node:fs');
    const 가짜설치 = ${가짜설치.toString()};
    const [원천, 자리, 열쇠폴더] = process.argv.slice(2);
    const 설치기 = (폴더) => {
      for (let i = 0; i < 1200 && !fs.existsSync(열쇠폴더) && fs.readdirSync(자리).filter((n) => n.startsWith(임시접두)).length < 2; i += 1) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
      가짜설치(폴더);
    };
    process.stdout.write(부품깔기({ 원천, 자리, 실행: true, 설치기 }).결과);
  `;
  const 파일 = path.join(무.바닥, '같이깔기.cjs');
  fs.writeFileSync(파일, 글);
  const 돌리기 = () => new Promise((resolve) => {
    const p = spawn(process.execPath, [파일, 무.원천, 무.자리, 새편.부품상태(무.옵션).폴더], { stdio: ['ignore', 'pipe', 'pipe'] });
    let 출력 = '', 오류 = '';
    p.stdout.on('data', (d) => { 출력 += d; });
    p.stderr.on('data', (d) => { 오류 += d; });
    p.on('close', (code) => resolve({ code, 출력, 오류 }));
  });
  const 둘 = await Promise.all([돌리기(), 돌리기()]);
  for (const r of 둘) assert.strictEqual(r.code, 0, r.오류);
  // 한쪽이 깔고 다른 쪽은 진다. PC가 아주 바빠 한쪽이 60초 넘게 늦게 뜨면 「있음」을 볼 수도 있다(그래도 한 벌이다)
  const 결과 = 둘.map((r) => r.출력).sort();
  assert.ok(결과.includes('깖') && 결과.filter((x) => x === '깖').length === 1 && ['다른 회차가 먼저 깖', '있음'].includes(결과.find((x) => x !== '깖')), `두 설치의 결과: ${결과.join(' · ')}`);
  const 뒤 = 새편.부품상태(무.옵션);
  assert.strictEqual(뒤.깔림, true);
  assert.deepStrictEqual(fs.readdirSync(무.자리), [뒤.열쇠], '진 쪽은 제 임시 폴더를 지운다');
});

test('설치기를 바꿔 넣고 부품 자리를 안 주면 던진다 — 시험이 실제 부품 자리에 가짜 부품을 깔지 않게', (t) => {
  const 무 = 무대(t);
  const { 자리: _자리, ...자리없는 } = 무.옵션;
  assert.throws(() => 새편.부품깔기({ ...자리없는, 실행: true }), /부품 자리도 준다/);
  assert.throws(() => 새편.편찍기(무.편('LAB_새편_20261112'), { ...자리없는, 실행: true }), /부품 자리도 준다/);
  assert.throws(() => 새편.편찍기(무.편('LAB_새편_20261112'), { ...자리없는 }), /부품 자리도 준다/);
  assert.strictEqual(fs.existsSync(무.편('LAB_새편_20261112')), false);
});

test('열쇠 — 잠금 파일의 줄끝과 무관하고, 잠금이 바뀌면 바뀐다(옛 자리는 그대로 남는다)', (t) => {
  const 무 = 무대(t);
  const 잠금 = path.join(무.원천, 'package-lock.json');
  const 앞 = 새편.열쇠(무.원천);
  assert.match(앞, new RegExp(`^remotion-4\\.0\\.535-[0-9a-f]{12}-${process.platform}-${process.arch}$`));
  fs.writeFileSync(잠금, fs.readFileSync(잠금, 'utf8').replace(/\n/g, '\r\n'));
  assert.strictEqual(새편.열쇠(무.원천), 앞, 'CRLF로 체크아웃해도 같은 열쇠');
  const 편 = 무.편('LAB_가_20261112');
  새편.편찍기(편, { ...무.옵션, 실행: true });
  fs.writeFileSync(잠금, fs.readFileSync(잠금, 'utf8').replace('sha512-나', 'sha512-바'));
  const 뒤 = 새편.열쇠(무.원천);
  assert.notStrictEqual(뒤, 앞);
  const 편2 = 무.편('LAB_나_20261113');
  새편.편찍기(편2, { ...무.옵션, 실행: true });
  assert.deepStrictEqual(fs.readdirSync(무.자리).sort(), [앞, 뒤].sort(), '옛 열쇠 자리를 지우지 않는다');
  assert.ok(fs.existsSync(path.join(편, 'remotion', 'node_modules', 'remotion', 'package.json')), '옛 편의 연결이 산다');
});

test('틀 목록은 위로 나가는 이름 · node_modules · package.json 없는 목록을 받지 않는다', (t) => {
  const 무 = 무대(t);
  const 파일 = path.join(무.원천, '틀.json');
  const 원 = JSON.parse(fs.readFileSync(파일, 'utf8'));
  const 써보기 = (바꿈) => { fs.writeFileSync(파일, JSON.stringify({ ...원, ...바꿈 })); return () => 새편.틀읽기(무.원천); };
  assert.throws(써보기({ 같아야: [...원.같아야, '../밖.txt'] }), /받을 수 없는 이름/);
  assert.throws(써보기({ 같아야: [...원.같아야, 'C:/밖.txt'] }), /받을 수 없는 이름/);
  assert.throws(써보기({ 같아야: [...원.같아야, 'src\\밖.ts'] }), /받을 수 없는 이름/);
  assert.throws(써보기({ 같아야: [...원.같아야, 'node_modules/x'] }), /node_modules/);
  assert.throws(써보기({ 같아야: 원.같아야.filter((n) => n !== 'package.json') }), /package\.json이 없다/);
  assert.throws(써보기({ 글꼴: { 'public/fonts/a.ttf': '../../밖.ttf' } }), /받을 수 없는 출처/);
  assert.throws(써보기({ 처음만: { '.gitignore': { synkbrief: 'gitignore.synkbrief' } } }), /기본 판이 없다/);
  assert.throws(써보기({ 꼴: '편틀/9' }), /꼴을 모른다/);
  assert.doesNotThrow(써보기({}));
});

test('틀 원천 · 저장소 뿌리 · remotion 폴더 · 파일 자리는 편 폴더로 받지 않는다', (t) => {
  const 무 = 무대(t);
  assert.throws(() => 새편.편찍기(무.원천, { ...무.옵션 }), /틀 원천과 겹친다/);
  assert.throws(() => 새편.편찍기(path.join(무.원천, 'src'), { ...무.옵션, 실행: true }), /틀 원천과 겹친다/);
  assert.deepStrictEqual(안파일(무.원천).filter((p) => p.includes('remotion/')), [], '원천 안에 아무것도 찍지 않았다');
  assert.throws(() => 새편.편찍기(무.뿌리, { ...무.옵션 }), /저장소 뿌리/);
  assert.throws(() => 새편.편찍기(path.join(무.편('LAB_새편_20261112'), 'remotion'), { ...무.옵션, 실행: true }), /그 위의 편 폴더를 준다/);
  assert.strictEqual(fs.existsSync(무.편('LAB_새편_20261112')), false, 'remotion/remotion을 만들지 않는다');
  const 파일 = path.join(무.바닥, '파일');
  fs.writeFileSync(파일, 'x');
  assert.throws(() => 새편.편찍기(파일, { ...무.옵션 }), /파일이 있다/);
  const 편 = 무.편('LAB_막힘_20261112');
  fs.mkdirSync(path.join(편, 'remotion', 'tsconfig.json'), { recursive: true });
  fs.writeFileSync(path.join(편, 'remotion', 'node_modules'), '파일');
  const r = 새편.편찍기(편, { ...무.옵션, 실행: true });
  assert.strictEqual(r.결과, '남은 것 있음');
  assert.strictEqual(r.막힘.length, 2);
  assert.strictEqual(fs.readFileSync(path.join(편, 'remotion', 'node_modules'), 'utf8'), '파일');
});

test('원천에 나중에 더한 틀 파일(틀.json 「더함」)은 그 날짜부터의 편에만 요구한다 — 그 전에 찍은 편에는 찍어 넣지 않는다', (t) => {
  const 무 = 무대(t);
  const 먼저 = 무.편('LAB_먼저_20261112'), 나중 = 무.편('LAB_나중_20261201');
  새편.편찍기(먼저, { ...무.옵션, 실행: true });
  // 원천에 틀 파일 하나를 더한다
  fs.writeFileSync(path.join(무.원천, 'prettier.config.mjs'), 'export default {};\n');
  const 파일 = path.join(무.원천, '틀.json');
  const 원 = JSON.parse(fs.readFileSync(파일, 'utf8'));
  fs.writeFileSync(파일, JSON.stringify({ ...원, 같아야: [...원.같아야, 'prettier.config.mjs'], 더함: { 'prettier.config.mjs': '20261201' } }));
  const 틀 = 새편.틀읽기(무.원천);
  assert.deepStrictEqual([새편.요구하나(틀, 'prettier.config.mjs', '20261112'), 새편.요구하나(틀, 'prettier.config.mjs', '20261201'), 새편.요구하나(틀, 'prettier.config.mjs', null), 새편.요구하나(틀, 'tsconfig.json', '20261112')], [false, true, false, true]);
  const r = 새편.편찍기(먼저, { ...무.옵션, 실행: true });
  assert.deepStrictEqual([r.결과, r.찍음, r.다름], ['됨', [], []]);
  assert.strictEqual(fs.existsSync(path.join(먼저, 'remotion', 'prettier.config.mjs')), false, '그 전에 찍은 편에는 넣지 않는다');
  const n = 새편.편찍기(나중, { ...무.옵션, 실행: true });
  assert.ok(n.찍음.includes('prettier.config.mjs') && fs.existsSync(path.join(나중, 'remotion', 'prettier.config.mjs')), '그 날짜부터의 새 편에는 찍는다');
  // 「더함」 없이 더하면 그 전 편에도 찍으려 든다(그래서 틀 대조 시험이 「더함」을 안내한다)
  fs.writeFileSync(파일, JSON.stringify({ ...원, 같아야: [...원.같아야, 'prettier.config.mjs'] }));
  assert.deepStrictEqual(새편.편찍기(먼저, { ...무.옵션 }).찍음, ['prettier.config.mjs']);
  fs.writeFileSync(파일, JSON.stringify({ ...원, 더함: { '없는파일.ts': '20261201' } }));
  assert.throws(() => 새편.틀읽기(무.원천), /틀 목록에 없다/);
  fs.writeFileSync(파일, JSON.stringify({ ...원, 더함: { 'tsconfig.json': '12월' } }));
  assert.throws(() => 새편.틀읽기(무.원천), /날짜 꼴/);
});

test('blob 셈 — 글 파일은 줄끝(CRLF)을 정리해 재고, 이진 파일은 그대로 잰다', () => {
  // git hash-object로 미리 잰 값: "a\nb\n" → 422c2b7a…
  assert.strictEqual(새편.blob값(Buffer.from('a\nb\n')), '422c2b7ab3b3c668038da977e4e93a5fc623169c');
  assert.strictEqual(새편.blob값(Buffer.from('a\r\nb\r\n')), 새편.blob값(Buffer.from('a\nb\n')), 'CRLF로 체크아웃한 글 파일도 색인과 같은 값');
  assert.notStrictEqual(새편.blob값(Buffer.from([0, 13, 10, 1])), 새편.blob값(Buffer.from([0, 10, 1])), '이진 파일의 CRLF는 건드리지 않는다');
  assert.strictEqual(새편.blob값(Buffer.alloc(0)), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
});

test('편 이름 풀기 · 적용 가르기 — 명령과 틀 대조 시험이 같은 규칙을 쓴다', () => {
  assert.deepStrictEqual(새편.편이름풀기('docs/마케팅/LAB_네마침표_mn_20261110'), { 이름: 'LAB_네마침표_mn_20261110', 브랜드: 'LAB', 날짜: '20261110' });
  assert.deepStrictEqual(새편.편이름풀기('synkbrief_20261112'), { 이름: 'synkbrief_20261112', 브랜드: 'synkbrief', 날짜: '20261112' });
  assert.deepStrictEqual(새편.편이름풀기('LAB_퀴즈은행'), { 이름: 'LAB_퀴즈은행', 브랜드: 'LAB', 날짜: null });
  assert.deepStrictEqual(새편.편이름풀기('LAB_물개_mn_2026111'), { 이름: 'LAB_물개_mn_2026111', 브랜드: 'LAB', 날짜: null });
  const 틀 = { 적용: { LAB: '20261112', 꼴틀림: '2026-11-12' }, 예외: { LAB_예외_20261120: '까닭' } };
  const 대상 = (이름) => 새편.적용편인가(틀, 새편.편이름풀기(이름));
  assert.deepStrictEqual(['LAB_가_20261112', 'LAB_가_20261111', 'lab_가_20261120', 'LAB_예외_20261120', 'LAB_날짜없는편', '꼴틀림_가_20261120'].map(대상), [true, false, false, false, false, false]);
});

test('명령줄 — 미리 보기는 진짜 원천으로 돌고, 다름이 있으면 종료 1 · 쓰는 법이 틀리면 종료 2', (t) => {
  const 무 = 무대(t);
  const 돌리기 = (...인자) => spawnSync(process.execPath, [도구, ...인자], { cwd: REPO, encoding: 'utf8', env: { ...process.env, SYNK_REMOTION_PARTS_DIR: 무.자리 } });
  const 편 = path.join(무.바닥, 'LAB_명령줄_20261112');
  const 가 = 돌리기(편, '--json');
  assert.strictEqual(가.status, 0, 가.stderr);
  const j = JSON.parse(가.stdout);
  assert.deepStrictEqual([j.결과, j.갈래], ['미리 보기', '틀까지']);
  assert.strictEqual(j.찍음.length, 무.틀.같아야.length + Object.keys(무.틀.글꼴).length + 1);
  assert.ok(새편.같은길(j.부품.자리, 무.자리), 'SYNK_REMOTION_PARTS_DIR로 부품 자리를 바꾼다');
  assert.strictEqual(fs.existsSync(편), false);
  fs.mkdirSync(path.join(편, 'remotion'), { recursive: true });
  fs.writeFileSync(path.join(편, 'remotion', 'tsconfig.json'), '{}\n');
  const 나 = 돌리기(편);
  assert.strictEqual(나.status, 1);
  assert.match(나.stdout, /원천과 다름 1: tsconfig\.json/);
  assert.strictEqual(돌리기().status, 2);
  assert.strictEqual(돌리기(편, '--모르는깃발').status, 2);
  const 부품 = 돌리기('부품');
  assert.strictEqual(부품.status, 0);
  assert.match(부품.stdout, /부품 깔 것/);
  assert.strictEqual(fs.existsSync(무.자리), false, '미리 보기 명령은 부품 자리를 만들지 않는다');
});

test('명령줄 — --실행이 찍고 잇는다 · --갱신이 있어야 덮는다 · 부품 --실행은 죽은 임시 폴더를 치운다(진짜 npm 없이, 미리 깔아 둔 가짜 부품으로)', (t) => {
  const 무 = 무대(t);
  // 진짜 원천의 열쇠 자리에 가짜 부품을 미리 깔아 둔다 — 명령이 진짜 npm을 부르지 않게
  assert.strictEqual(새편.부품깔기({ 자리: 무.자리, 실행: true, 설치기: 가짜설치 }).결과, '깖');
  const 돌리기 = (...인자) => spawnSync(process.execPath, [도구, ...인자], { cwd: REPO, encoding: 'utf8', env: { ...process.env, SYNK_REMOTION_PARTS_DIR: 무.자리 } });
  // 진짜 틀.json의 「적용」에 맞춘 편 이름 — 적용 브랜드가 하나도 없으면(되돌린 상태) 이미 있는 편은 부품만이라 다름으로 멈추지 않는다
  const [적용브랜드, 적용날짜] = Object.entries(새편.틀읽기().적용)[0] || [];
  const 편 = path.join(무.바닥, 적용브랜드 ? `${적용브랜드}_명령줄_${적용날짜}` : 'LAB_명령줄_20261112'), 프 = path.join(편, 'remotion');
  // --실행을 부르기 전에 미리 보기로 확인한다: 명령이 가짜 부품 자리를 보고 있고 거기가 깔려 있다 — 아니면 --실행이 진짜 부품 자리로 가서 진짜 npm ci를 돌린다
  const 미리 = 돌리기(편, '--json');
  assert.strictEqual(미리.status, 0, 미리.stderr);
  const 미리값 = JSON.parse(미리.stdout);
  assert.ok(새편.같은길(미리값.부품.자리, 무.자리) && 미리값.부품.결과 === '있음', `명령이 가짜 부품 자리를 깔린 것으로 보지 않는다 — --실행을 부르지 않는다: ${미리값.부품.자리} · ${미리값.부품.결과}`);
  const 부품확인 = JSON.parse(돌리기('부품', '--json').stdout);
  assert.ok(새편.같은길(부품확인.자리, 무.자리) && 부품확인.결과 === '있음', '부품 명령도 가짜 자리를 깔린 것으로 본다');
  assert.strictEqual(fs.existsSync(편), false, '--실행 없이는 쓰지 않는다');
  const 가 = 돌리기(편, '--실행');
  assert.strictEqual(가.status, 0, 가.stderr + 가.stdout);
  assert.match(가.stdout, /^\[됨\]/);
  for (const 이름 of 무.틀.같아야) assert.ok(읽기(path.join(프, 이름)).equals(읽기(path.join(새편.기본원천, 이름))), 이름);
  assert.ok(fs.lstatSync(path.join(프, 'node_modules')).isSymbolicLink() && fs.existsSync(path.join(프, 'node_modules', 'remotion', 'package.json')), '부품에 이어졌다');
  const 고친 = '{ "compilerOptions": { "strict": false } }\n';
  fs.writeFileSync(path.join(프, 'tsconfig.json'), 고친);
  const 나 = 돌리기(편, '--실행');
  assert.strictEqual(나.status, 적용브랜드 ? 1 : 0, '틀 대조 대상인 편이면 다름으로 종료 1');
  assert.strictEqual(fs.readFileSync(path.join(프, 'tsconfig.json'), 'utf8'), 고친, '--갱신 없이는 덮지 않는다');
  const 다 = 돌리기(편, '--갱신');
  assert.strictEqual(다.status, 0);
  assert.strictEqual(fs.readFileSync(path.join(프, 'tsconfig.json'), 'utf8'), 고친, '--갱신만으로는(미리 보기) 덮지 않는다');
  const 라 = 돌리기(편, '--갱신', '--실행', '--json');
  assert.strictEqual(라.status, 0, 라.stderr);
  assert.deepStrictEqual(JSON.parse(라.stdout).덮음, ['tsconfig.json']);
  assert.ok(읽기(path.join(프, 'tsconfig.json')).equals(읽기(path.join(새편.기본원천, 'tsconfig.json'))));
  // 부품: 깔려 있으면 「있음」이고, --실행일 때만 죽은 설치의 임시 폴더를 치운다
  const 죽은 = path.join(무.자리, `${새편.임시접두}${새편.열쇠()}-2147483645-0a1b2c3d`);
  fs.mkdirSync(죽은);
  const 옛때 = new Date(Date.now() - 3600e3);
  fs.utimesSync(죽은, 옛때, 옛때);
  const 부품미리 = 돌리기('부품');
  assert.match(부품미리.stdout, /부품 있음[\s\S]*설치 임시 폴더 1/);
  assert.ok(fs.existsSync(죽은), '미리 보기는 치우지 않는다');
  const 부품실행 = 돌리기('부품', '--실행');
  assert.strictEqual(부품실행.status, 0, 부품실행.stderr);
  assert.match(부품실행.stdout, /부품 있음/);
  assert.strictEqual(fs.existsSync(죽은), false, '부품 --실행이 죽은 임시 폴더를 치웠다');
});
