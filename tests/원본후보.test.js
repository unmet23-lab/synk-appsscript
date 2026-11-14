'use strict';
// tools/원본후보.js — 씨앗 계정 숫자로 돌림 원본 후보를 고른다(읽기 전용).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 도구 = path.join(__dirname, '..', 'tools', '원본후보.js');
const { 후보, 재기, 쓸줄, 평소표, 평소값, 씨앗계정, 보이기, 선 } = require(도구);

const 지금 = Date.parse('2026-11-13T12:00:00Z');
const 원장 = { accounts: {
  'lab-instagram': { brand: 'LAB', rotationSeed: true, language: 'mn' },
  'lab-tiktok': { brand: 'LAB', rotationSeed: true, language: 'mn' },
  'lab-youtube': { brand: 'LAB', rotationSeed: true, language: 'en' },
  'lab-kg-youtube': { brand: 'LAB', language: 'mn' },
  'brief-instagram': { brand: 'BRIEF', rotationSeed: true, language: 'mn' },
} };

let 번호 = 0;
function 줄(over) {
  번호 += 1;
  return {
    kind: '판정', at: '2026-11-10T00:00:00Z', publishedAt: '2026-11-03T12:00:00Z', account: 'lab-instagram', point: '7d',
    post: `instagram:P${번호}`, folder: null, metrics: { views: 1000, saves: 2, shares: 1 },
    standing: { views: { label: 'middle', n: 10 } }, multiple: { value: 1, median: 1000, n: 10 }, ...over,
  };
}
// 평소 글 여섯: 인스타 7일 조회 1,000 안팎 → 가운데값 1,000
const 평소글 = (계정 = 'lab-instagram', 나이 = '7d') => [800, 900, 1000, 1000, 1100, 1200].map((v) => 줄({ account: 계정, point: 나이, folder: 'LAB_다른글', metrics: { views: v, saves: 1, shares: 0 } }));

function 마케팅(편들) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), '원본후보-'));
  for (const [이름, e] of Object.entries(편들)) {
    const 폴더 = path.join(뿌리, 이름);
    fs.mkdirSync(path.join(폴더, '게시'), { recursive: true });
    if (e.remotion !== false) fs.mkdirSync(path.join(폴더, 'remotion'));
    if (e.지도) fs.writeFileSync(path.join(폴더, '판본지도.json'), '{}');
    fs.writeFileSync(path.join(폴더, '게시', '준비.json'), JSON.stringify(e.돌림 ? { 돌림: e.돌림 } : {}));
    if (e.판) fs.writeFileSync(path.join(폴더, '게시', '게시결과.json'), JSON.stringify({ 판: e.판 }));
  }
  return 뿌리;
}

test('씨앗 계정 — LAB · 씨앗 표시 · 그 언어만', () => {
  assert.deepEqual(씨앗계정(원장, 'mn'), ['lab-instagram', 'lab-tiktok']);
  assert.deepEqual(씨앗계정(원장, 'en'), ['lab-youtube']);
  assert.deepEqual(씨앗계정({}, 'mn'), []);
});

test('쓸 줄 — 자리가 적힌 가장 늦은 줄, 나중 줄이 빈 값이면 앞 줄', () => {
  const 앞 = 줄({ at: '2026-11-08T00:00:00Z', standing: { views: { label: 'top25', n: 11 } } });
  const 뒤 = 줄({ at: '2026-11-11T00:00:00Z', standing: { follows: { label: 'middle', n: 6 } }, multiple: { value: null } });
  assert.equal(쓸줄([앞, 뒤]), 앞);
  assert.equal(쓸줄([뒤]), 뒤);
  assert.equal(쓸줄([]), null);
});

test('재기 — 상위 25% + 지금 평소의 1.5배 + 저장 · 공유', () => {
  const 표 = 평소표(평소글(), 지금);
  assert.deepEqual(평소값(표, 'lab-instagram', '7d', null), { 가운데: 1000, n: 6 });
  const 상위 = { standing: { views: { label: 'top25', n: 10 } } };
  const 넘은 = 재기(줄({ ...상위, metrics: { views: 1500, saves: 1, shares: 0 } }), 표);
  assert.equal(넘은.넘음, true);
  assert.equal(넘은.배수, 1.5);
  assert.equal(넘은.배수근거, '지금');
  assert.equal(재기(줄({ ...상위, metrics: { views: 1499, saves: 1, shares: 0 } }), 표).넘음, false, '1.5배 아래');
  assert.equal(재기(줄({ metrics: { views: 9000, saves: 5, shares: 5 } }), 표).넘음, false, '판정 때 가운데 자리');
  assert.equal(재기(줄({ ...상위, metrics: { views: 9000, saves: 0, shares: 0 } }), 표).넘음, false, '저장 · 공유가 적히는데 0');
  assert.equal(재기(줄({ ...상위, metrics: { views: 9000 } }), 표).넘음, true, '저장 · 공유를 안 적는 계정은 그 칸을 안 본다');
  assert.equal(재기(줄({ ...상위, point: '24h', metrics: { views: 9000 } }), 표).넘음, false, '24시간 판정은 선에 안 든다');
});

test('재기 — 평소 글이 모자라면 판정 때 배수, 자기 글은 평소값에서 뺀다', () => {
  const 다섯 = 평소글().slice(0, 5);
  const 내글 = 줄({ post: 다섯[0].post, folder: 'LAB_가_mn_20261101', standing: { views: { label: 'top25', n: 4 } }, multiple: { value: 2.4 }, metrics: { views: 50 } });
  const r = 재기(내글, 평소표(다섯, 지금)); // 자기 글을 빼면 넷 → 판정 때 배수
  assert.equal(r.배수, 2.4);
  assert.equal(r.배수근거, '판정 때');
  assert.equal(r.넘음, true);
  // 30일보다 앞에 나간 글은 평소값에 안 든다
  const 옛 = 평소글().map((x) => ({ ...x, publishedAt: '2026-09-01T00:00:00Z' }));
  assert.equal(평소값(평소표(옛, 지금), 'lab-instagram', '7d', null).가운데, null);
});

test('후보 — 갈래 넷 · 다음 할 일 · 퀴즈와 다른 언어는 뺀다', () => {
  const 상위 = { standing: { views: { label: 'top25', n: 10 } } };
  const 뿌리 = 마케팅({
    'LAB_가_mn_20261101': { 판: [{ 계정: 'lab-instagram', 시각: '2026-11-02T21:00:00+09:00' }] },
    'LAB_나_mn_20261102': { 돌림: { 형식: '이야기', 쓸날: '2026-11-14' }, 지도: true },
    'LAB_다_mn_20261110': { 판: [{ 계정: 'lab-tiktok', 시각: '2026-11-14T13:00:00+09:00' }, { 계정: 'lab-kg-youtube', 시각: '2026-11-12T13:00:00+09:00' }] },
    'LAB_라_mn_20261104': {},
    'LAB_마_mn_20261020': {},
    'LAB_바_mn_20261105': { 지도: true, 판: [{ 계정: 'lab-tiktok', 게시물ID: 'TT77' }] },
    'LAB_사_mn_20261106': { remotion: false },
    'LAB_퀴즈_ㅂ셋_mn_20261110': {},
    'LAB_아_mn_20261107': { 돌림: { 형식: '퀴즈' } },
    'LAB_자_20261101': {},
  });
  const 장부 = [
    ...평소글(), ...평소글('lab-tiktok', '7d'), ...평소글('lab-instagram', '72h'),
    줄({ folder: 'LAB_가_mn_20261101', ...상위, metrics: { views: 7000, saves: 9, shares: 3 } }),
    줄({ folder: 'LAB_가_mn_20261101', account: 'lab-tiktok', metrics: { views: 900, shares: 0 } }),
    줄({ folder: 'LAB_나_mn_20261102', ...상위, metrics: { views: 20000, saves: 9, shares: 3 } }),
    줄({ folder: 'LAB_다_mn_20261110', point: '24h', account: 'lab-tiktok', metrics: { views: 300, shares: 0 } }),
    줄({ folder: 'LAB_라_mn_20261104', point: '72h', metrics: { views: 2000, saves: 1, shares: 1 } }),
    줄({ folder: 'LAB_마_mn_20261020', ...상위, multiple: { value: 3.4 }, metrics: { views: 400, saves: 1, shares: 1 } }),
    줄({ folder: null, post: 'tiktok:TT77', account: 'lab-tiktok', ...상위, metrics: { views: 3000, shares: 4 } }),
    줄({ folder: 'LAB_사_mn_20261106', ...상위, metrics: { views: 8000, saves: 9, shares: 3 } }),
    줄({ folder: 'LAB_아_mn_20261107', ...상위, metrics: { views: 8000, saves: 9, shares: 3 } }),
    줄({ folder: 'LAB_퀴즈_ㅂ셋_mn_20261110', ...상위, metrics: { views: 8000, saves: 9, shares: 3 } }),
  ];
  const r = 후보({ 장부, 원장, 마케팅: 뿌리, 언어: 'mn', 지금 });
  const 갈래 = Object.fromEntries(r.줄.map((x) => [x.편, x.갈래]));
  assert.deepEqual(갈래, {
    'LAB_가_mn_20261101': '올릴 만함', 'LAB_바_mn_20261105': '올릴 만함', 'LAB_사_mn_20261106': '올릴 만함',
    'LAB_다_mn_20261110': '기다림',
    'LAB_라_mn_20261104': '못 미침', 'LAB_마_mn_20261020': '못 미침',
    'LAB_나_mn_20261102': '이미 원본',
  });
  assert.deepEqual(r.줄.slice(0, 3).map((x) => x.갈래), ['올릴 만함', '올릴 만함', '올릴 만함'], '올릴 만한 편이 맨 위');
  const 편 = (이름) => r.줄.find((x) => x.편 === 이름);
  assert.deepEqual(편('LAB_가_mn_20261101').넘은계정, ['lab-instagram']);
  assert.match(편('LAB_가_mn_20261101').다음, /판본 틀로 옮긴다/);
  assert.match(편('LAB_바_mn_20261105').다음, /판본글잇기\.js 돌림 "docs\/마케팅\/LAB_바_mn_20261105" 전부 --형식 이야기/, '틀은 있고 돌림만 없는 편');
  assert.equal(편('LAB_바_mn_20261105').계정[0].조회, 3000, '폴더가 빈 장부 줄은 게시물 ID로 잇는다');
  assert.match(편('LAB_사_mn_20261106').다음, /올릴 수 없다/);
  assert.equal(편('LAB_다_mn_20261110').씨앗첫판, '2026-11-14T13:00:00+09:00', '씨앗이 아닌 계정의 판은 세지 않는다');
  assert.equal(편('LAB_마_mn_20261020').계정[0].배수, 0.33, '계정이 작던 때의 3.4배는 지금 평소값(다른 글 열하나의 가운데 1,200)으로 다시 잰다');
  const 글 = 보이기(r);
  assert.match(글, /올릴 만함 3/);
  assert.match(글, /LAB_가_mn_20261101 — instagram 7일 7,000회\(6\.36배 · 상위\) ✓ · tiktok 7일 900회\(0\.9배 · 가운데\)/);
  assert.match(글, /LAB_다_mn_20261110 — tiktok 24시간 300회/);
  assert.match(글, /LAB_나_mn_20261102 — .* \| 쓸 날 2026-11-14/);
  fs.rmSync(뿌리, { recursive: true, force: true });
});

test('명령줄 — 읽기만 하고 0으로 끝난다, 모르는 인자는 2', () => {
  const 뿌리 = 마케팅({ 'LAB_가_mn_20261101': {} });
  const 장부 = path.join(뿌리, '장부.jsonl');
  const 원장파일 = path.join(뿌리, '원장.json');
  fs.writeFileSync(장부, [...평소글(), 줄({ folder: 'LAB_가_mn_20261101', standing: { views: { label: 'top25', n: 9 } }, metrics: { views: 5000, saves: 3, shares: 1 } })].map((x) => JSON.stringify(x)).join('\n') + '\n깨진 줄\n');
  fs.writeFileSync(원장파일, JSON.stringify(원장));
  const 앞 = fs.readFileSync(장부, 'utf8');
  const 인자 = ['--장부', 장부, '--원장', 원장파일, '--마케팅', 뿌리, '--지금', '2026-11-13T12:00:00Z'];
  const r = spawnSync(process.execPath, [도구, ...인자, '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.선.배수, 선.배수);
  assert.deepEqual(j.줄.map((x) => [x.편, x.갈래]), [['LAB_가_mn_20261101', '올릴 만함']]);
  assert.equal(fs.readFileSync(장부, 'utf8'), 앞, '장부를 고치지 않는다');
  assert.equal(spawnSync(process.execPath, [도구, '아무거나'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [도구, ...인자, '--부터', '11-01'], { encoding: 'utf8' }).status, 2);
  fs.rmSync(뿌리, { recursive: true, force: true });
});
