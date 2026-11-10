'use strict';

// 합성 미리보기(tools/합성미리보기.js) — 움직이는 소품 장면을 전체 렌더 전에 Remotion still로 첫 · 가운데 · 끝만 굽고 한 장 시트로(11-10 설계 16).
// 가짜 remotion · 가짜 ffmpeg · 가짜 그림검사만 부른다(Remotion · AI · ffmpeg 없음).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const 합성 = require('../tools/합성미리보기.js');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

test('인자 · 구간: 「시작-끝::이름」, 끝이 시작보다 커야 하고, --검사에는 장면 의도가 있어야 한다', () => {
  assert.deepEqual(합성.구간풀기('6.85-7.3::연필 나감'), { 시작: 6.85, 끝: 7.3, 이름: '연필 나감' });
  assert.deepEqual(합성.구간풀기('2-3'), { 시작: 2, 끝: 3, 이름: '' });
  assert.throws(() => 합성.구간풀기('3-2'), /끝이 시작보다/);
  assert.throws(() => 합성.구간풀기('3초'), /시작초/);
  const o = 합성.인자(['remotion', '--구성', 'jieut-en', '--구간', '6.3-6.8', '--구간', '16.25-17.9::Z']);
  assert.equal(o.구간.length, 2);
  assert.throws(() => 합성.인자(['remotion', '--구간', '1-2']), /사용/);
  assert.throws(() => 합성.인자(['remotion', '--구성', 'a', '--구간', '1-2', '--검사']), /--의도/);
  assert.equal(합성.인자(['remotion', '--구성', 'a', '--구간', '1-2', '--검사', '--의도', '연필이 손 없이 움직이지 않는가', '--눈', 'haiku']).눈, 'haiku');
});

test('세프레임: 구간 안 첫 · 가운데 · 끝(끝 초 바로 앞 프레임) — 영상 끝을 넘지 않고 겹치면 하나로', () => {
  assert.deepEqual(합성.세프레임({ 시작: 6.3, 끝: 6.8 }, 30), [189, 196, 203]);
  assert.deepEqual(합성.세프레임({ 시작: 16.25, 끝: 17.9 }, 30), [488, 512, 536]);
  assert.deepEqual(합성.세프레임({ 시작: 18, 끝: 19 }, 30, 558), [540, 549, 557]);
  assert.deepEqual(합성.세프레임({ 시작: 1, 끝: 1.02 }, 30), [30]);
});

test('구성읽기: npx remotion compositions 표(색 코드 걷고)에서 fps · 크기 · 프레임 수', () => {
  const 출력 = 'Bundled code\n\nThe following compositions are available:\n\n\x1b[1mjieut-en\x1b[22m       30      1080x1920      558 (18.60 sec)\njieut-scene    30      1080x1920      558 (18.60 sec)\n';
  assert.deepEqual(합성.구성읽기(출력, 'jieut-scene'), { fps: 30, 너비: 1080, 높이: 1920, 프레임: 558 });
  assert.equal(합성.구성읽기(출력, 'e32-en'), null);
  assert.deepEqual(합성.still인자('src/index.ts', 'jieut-en', 'C:/x/f.png', 189), ['still', 'src/index.ts', 'jieut-en', 'C:/x/f.png', '--frame=189']);
});

test('흐름(가짜 remotion · ffmpeg): 프레임은 한 번씩만 굽고 구간 시트 · 모두 시트 · JSON, 프로젝트 폴더에는 아무것도 안 쓴다 → --검사는 그림검사(합성)로', async (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '합성흐름-')); t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const 프로젝트 = path.join(d, 'LAB_시험_20261113', 'remotion'); fs.mkdirSync(path.join(프로젝트, 'src'), { recursive: true });
  fs.writeFileSync(path.join(프로젝트, 'src', 'index.ts'), '//');
  const 전 = fs.readdirSync(프로젝트, { recursive: true }).sort();
  const 부른 = [], 시트 = [];
  let 검사인자 = null;
  const 손 = {
    remotion: (args, cwd) => { 부른.push(args[0]); assert.equal(cwd, 프로젝트); if (args[0] === 'compositions') return 'e1-en   30   1080x1920   300 (10.00 sec)\n'; fs.writeFileSync(args[3], 'png'); return ''; },
    ffmpeg: (args) => { 시트.push(args); fs.writeFileSync(args[args.length - 1], 'jpg'); return ''; },
    그림검사: async (args) => { 검사인자 = args; return 1; },
  };
  t.mock.method(console, 'log', () => {}); t.mock.method(process.stdout, 'write', () => true);
  const 밖 = path.join(d, '밖');
  const 코드 = await 합성.main([프로젝트, '--구성', 'e1-en', '--구간', '2-3::잎이 봉투 옆에 내려앉는다', '--구간', '2.97-4', '--밖', 밖, '--검사', '--의도', '바람에 잎이 떨어진다'], 손);
  assert.equal(코드, 1, '그림검사 끝 코드를 그대로');
  assert.deepEqual(부른, ['compositions', 'still', 'still', 'still', 'still', 'still'], '구간이 겹친 프레임 89는 한 번만');
  const j = JSON.parse(fs.readFileSync(path.join(밖, '합성미리보기.json'), 'utf8'));
  assert.deepEqual(j.구간.map((g) => [g.글자, g.프레임]), [['A', [60, 75, 89]], ['B', [89, 104, 119]]]);
  assert.equal(j.폴더.endsWith('LAB_시험_20261113/remotion'), true);
  assert.equal(시트.length, 3, '구간 시트 둘 + 모두 시트 하나');
  assert.match(시트[0][시트[0].indexOf('-filter_complex') + 1], /xstack=inputs=3/);
  assert.match(시트[2][시트[2].indexOf('-filter_complex') + 1], /xstack=inputs=6/);
  assert.deepEqual(fs.readdirSync(프로젝트, { recursive: true }).sort(), 전, '프로젝트 폴더는 그대로');
  assert.deepEqual(검사인자.slice(0, 2), [path.join(밖, '구간_A.jpg::잎이 봉투 옆에 내려앉는다'), path.join(밖, '구간_B.jpg')]);
  assert.deepEqual(검사인자.slice(2), ['--의도', '바람에 잎이 떨어진다', '--종류', '합성', '--마스코트', '몽글', '--눈', 'gpt', '--밖', path.join(밖, '그림검사')]);
});

test('지문(11-11 끝 판 검수 P2-11): 본 프레임 · 시트 · 입력 그림(public · src 그림)마다 SHA-256 · 크기와 검사 끝 코드를 남기고, 같은 --밖에 남은 옛 프레임은 다시 굽는다', async (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '합성지문-')); t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const 프로젝트 = path.join(d, 'LAB_지문_20261113', 'remotion');
  const 쓰기 = (상대, 글) => { const f = path.join(프로젝트, 상대); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, 글); };
  쓰기('src/index.ts', '//'); 쓰기('src/몫/연필.png', '연필'); 쓰기('public/img/dusk.jpg', '저녁'); 쓰기('public/vo/s1.json', '{}'); 쓰기('node_modules/x/y.png', '남의 것');
  const 전 = fs.readdirSync(프로젝트, { recursive: true }).sort();
  const 밖 = path.join(d, '밖'); fs.mkdirSync(밖);
  fs.writeFileSync(path.join(밖, 'f00060.png'), '앞 돌림의 옛 프레임');
  const 부른 = [];
  const 손 = {
    remotion: (args) => { if (args[0] === 'compositions') return 'e1-en   30   1080x1920   300 (10.00 sec)\n'; 부른.push(args[4]); fs.writeFileSync(args[3], `png ${args[4]}`); return ''; },
    ffmpeg: (args) => { fs.writeFileSync(args[args.length - 1], `jpg ${path.basename(args[args.length - 1])}`); return ''; },
    그림검사: async () => 2,
  };
  t.mock.method(console, 'log', () => {}); t.mock.method(process.stdout, 'write', () => true);
  assert.equal(await 합성.main([프로젝트, '--구성', 'e1-en', '--구간', '2-3::연필', '--밖', 밖, '--검사', '--의도', '손이 연필을 쥐고 쓴다', '--눈', 'haiku'], 손), 2);
  assert.deepEqual(부른, ['--frame=60', '--frame=75', '--frame=89'], '남은 f00060.png를 쓰지 않고 다시 굽는다');
  const j = JSON.parse(fs.readFileSync(path.join(밖, '합성미리보기.json'), 'utf8'));
  assert.equal(j.지문꼴, 'sha256');
  assert.deepEqual(j.프레임파일, [60, 75, 89].map((n) => ({ 프레임: n, 파일: `f000${n}.png`, 지문: sha(`png --frame=${n}`), 크기: Buffer.byteLength(`png --frame=${n}`) })));
  assert.deepEqual([j.구간[0].시트지문, j.구간[0].시트크기], [sha('jpg 구간_A.jpg'), Buffer.byteLength('jpg 구간_A.jpg')]);
  assert.equal(j.모두지문, sha('jpg 합성미리보기.jpg'));
  assert.deepEqual(j.입력그림, [
    { 파일: 'public/img/dusk.jpg', 지문: sha('저녁'), 크기: Buffer.byteLength('저녁') },
    { 파일: 'src/몫/연필.png', 지문: sha('연필'), 크기: Buffer.byteLength('연필') },
  ], '바탕 · 소품 그림만(json · node_modules 빼고)');
  assert.deepEqual(j.검사, { 기록: '그림검사/그림검사.json', 끝코드: 2 });
  assert.deepEqual(fs.readdirSync(프로젝트, { recursive: true }).sort(), 전, '프로젝트 폴더는 읽기만');
  assert.deepEqual(합성.입력그림(path.join(d, '없는폴더')), []);
});
