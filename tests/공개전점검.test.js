/* 공개 전 점검(tools/lib/공개전점검.js) — synk.im 공개 후보의 바뀐 HTML 쪽을 로컬에서 띄워 axe 치명 · 잡히지 않은 오류를 재고,
 * 앞 공개본에 없던 것만 막는다. 크롬 없이 도는 시험은 측정 자리에 「쪽 글의 표시를 읽는 가짜 측정」을 끼워, 정적 서버가 후보 · 공개본
 * 바이트를 제대로 내주는지까지 본다. 실제 크롬 시험은 크롬이 없으면 건너뛴다. 공개 도구와 이어 붙인 시험은 tests/공개.test.js에 있다. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const 점검 = require(path.join(REPO, 'tools', 'lib', '공개전점검.js'));

Object.assign(process.env, { NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' });

const 글 = (s) => Buffer.from(s, 'utf8');
const 쪽 = (몸 = '') => 글(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>t</title></head><body><main><h1>쪽</h1>${몸}</main></body></html>`);
const 판읽개 = (판) => async (p) => (판.has(p) ? 판.get(p) : null);

/**
 * 가짜 측정: 받은 쪽 글의 표시를 읽어 측정 결과를 만든다 — <!--치명:규칙:선택자--> · <!--심각:규칙:선택자--> · <!--오류:말--> ·
 * <!--콘솔:말--> · <!--멈춤-->. 한 주소에서 n번째 잴 때만 나는 오류는 <!--오류2:말-->(두 번째부터). 부른 일은 .부름에 남는다.
 */
function 가짜측정() {
  const 부름 = [];
  const 횟수 = new Map();
  const 재기 = async (일) => {
    부름.push(`${일.판} ${일.쪽.주소}${일.다시 ? ' 다시' : ''}`);
    const n = (횟수.get(일.주소) || 0) + 1;
    횟수.set(일.주소, n);
    const res = await fetch(일.주소);
    const html = await res.text();
    const 표 = [...html.matchAll(/<!--(치명|심각|오류2?|콘솔|멈춤1?):?([^>]*?)-->/g)].map((m) => [m[1], m[2]]);
    // 멈춤 = 늘 못 잼, 멈춤1 = 그 주소의 첫 잼만 못 잼(가끔 멈추는 판)
    if (표.some(([k]) => k === '멈춤' || (k === '멈춤1' && n === 1))) return { 주소: 일.주소, 문제: '150초 안에 재기를 마치지 못했다', 오류: [], 콘솔: [], axe: {} };
    const 위반 = (무게) => {
      const 규칙 = new Map();
      for (const [k, v] of 표) {
        if (k !== 무게) continue;
        const [id, 대상] = v.split(':');
        if (!규칙.has(id)) 규칙.set(id, { id, impact: 무게 === '치명' ? 'critical' : 'serious', help: id, n: 0, 곳: [] });
        const r = 규칙.get(id);
        r.곳.push({ 대상, html: `<div class="${대상}">` });
        r.n = r.곳.length;
      }
      return [...규칙.values()];
    };
    const 어긴것 = [...위반('치명'), ...위반('심각')];
    const 오류 = 표.filter(([k]) => k === '오류' || (k === '오류2' && n >= 2)).map(([, v]) => ({ 말: v, 곳: '', 열쇠: 점검.열쇠로(v), 수: 1 }));
    const 콘솔 = 표.filter(([k]) => k === '콘솔').map(([, v]) => ({ 말: v, 곳: '', 열쇠: 점검.열쇠로(v), 수: 1, 종류: 'console.error' }));
    return { 주소: 일.주소, 상태: res.status, 실림: true, 오류, 콘솔, axe: { 좁은: { 어긴것 }, 넓은: { 어긴것 } }, 문제: null };
  };
  재기.부름 = 부름;
  return 재기;
}

/** 항목(공개 도구 후보 꼴) — 버퍼 null이면 지움 */
const 항 = (경로, 종류, 버퍼) => ({ 경로, 종류, 버퍼 });

// ── 고르기 ─────────────────────────────────────────────────────────────────

test('쪽 고르기: 바뀐 · 새 · ?v= 갱신 HTML만, 지움 · 점 · 밑줄 경로는 빼고, Jekyll 머리말 쪽은 「재지 않음」으로 · 바뀐 스크립트는 가까운 위 쪽', () => {
  const 있는 = new Set(['index.html', 'world/index.html', 'world/game/index.html', 'lab/index.html']);
  const r = 점검.쪽고르기([
    항('lab/index.html', '바꿈', 쪽()),
    항('world/new/index.html', '새', 쪽()),
    항('en/page.html', '토큰', 쪽()),
    항('old/index.html', '지움', null),
    항('.github/desktop-preview/index.html', '바꿈', 쪽()),
    항('_drafts/a.html', '새', 쪽()),
    항('notes/front.html', '바꿈', 글('---\ntitle: x\n---\n<p>x</p>')),
    항('world/game/js/scene.js', '바꿈', 글('1')),     // → world/game/index.html
    항('world/data/tips.json', '바꿈', 글('{}')),      // → world/index.html (world/data/index.html 없음)
    항('lab/lab.css', '바꿈', 글('a{}')),              // lab/index.html이 이미 골라져 더하지 않는다
    항('assets/site.css', '바꿈', 글('b{}')),          // → 뿌리 index.html
    항('world/game/cover.webp', '바꿈', Buffer.from([1, 0, 2])), // 그림은 가까운 쪽을 부르지 않는다
  ], { 후보있나: (p) => 있는.has(p) });
  assert.deepEqual(r.쪽들.map((x) => [x.경로, x.주소, x.까닭, x.새쪽]), [
    ['lab/index.html', '/lab/', '바꿈', false],
    ['world/new/index.html', '/world/new/', '새', true],
    ['en/page.html', '/en/page.html', '토큰', false],
    ['world/game/index.html', '/world/game/', '가까운 쪽', false],
    ['world/index.html', '/world/', '가까운 쪽', false],
    ['index.html', '/', '가까운 쪽', false],
  ]);
  assert.equal(r.쪽들.find((x) => x.경로 === 'world/game/index.html').부른, 'world/game/js/scene.js');
  assert.deepEqual(r.빠짐.map((x) => x.경로), ['notes/front.html']);
  assert.match(r.빠짐[0].이유, /Jekyll 머리말/);
  // 가까운 쪽 한도
  const 많이 = 점검.쪽고르기(Array.from({ length: 4 }, (_, i) => 항(`g${i}/a.js`, '바꿈', 글('1'))), { 후보있나: (p) => /^g\d\/index\.html$/.test(p), 한도: 2 });
  assert.equal(많이.쪽들.length, 2);
  assert.equal(많이.빠짐.length, 2);
  assert.match(많이.빠짐[0].이유, /한도\(2개\)/);
  assert.equal(점검.주소로('index.html'), '/');
  assert.equal(점검.주소로('a b/index.html'), '/a%20b/');
});

// ── 정적 서버 ───────────────────────────────────────────────────────────────

test('정적 서버: 공개 주소처럼 내준다 — 폴더 길 · /a → /a/ · a.html · 점 · 밑줄 경로 404(404.html) · 종류 · Range · 못 실은 파일', async (t) => {
  const 판 = new Map([
    ['index.html', 쪽('홈')], ['a/index.html', 쪽('a')], ['b.html', 쪽('b')], ['m/app.mjs', 글('export const x = 1;')],
    ['404.html', 쪽('없는 쪽')], ['.well-known/x.json', 글('{}')], ['_x/y.html', 쪽('y')], ['v.mp4', Buffer.from('0123456789')],
  ]);
  const 서버 = await 점검.정적서버(async (p) => (p === 'big.mp4' ? { 못실음: '사본에 없는 큰 영상 · 소리' } : 판.get(p) || null));
  t.after(() => 서버.닫기());
  const 받기 = (p, 머리 = {}) => fetch(`${서버.주소}${p}`, { redirect: 'manual', headers: 머리 });
  let r = await 받기('/');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /홈/);
  assert.match(r.headers.get('content-type'), /^text\/html/);
  r = await 받기('/a');
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/a/');
  assert.match(await (await 받기('/a/')).text(), /<h1>쪽<\/h1>a/);
  assert.match(await (await 받기('/b')).text(), /<h1>쪽<\/h1>b/, '/b → b.html');
  r = await 받기('/m/app.mjs?v=abc');
  assert.equal(r.headers.get('content-type'), 'text/javascript; charset=utf-8', '모듈 스크립트는 자바스크립트 종류여야 실린다');
  r = await 받기('/_x/y.html');
  assert.equal(r.status, 404);
  assert.match(await r.text(), /없는 쪽/, '404는 404.html');
  assert.equal((await 받기('/.well-known/x.json')).status, 200);
  r = await 받기('/v.mp4', { range: 'bytes=2-4' });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), 'bytes 2-4/10');
  assert.equal(await r.text(), '234');
  assert.equal((await 받기('/v.mp4', { range: 'bytes=-3' }).then((x) => x.text())), '789');
  assert.equal((await 받기('/big.mp4')).status, 404);
  assert.deepEqual(서버.요청.find((x) => x.경로 === 'big.mp4'), { 경로: 'big.mp4', 상태: 404, 못실음: '사본에 없는 큰 영상 · 소리' });
  assert.ok(서버.요청.some((x) => x.경로 === 'm/app.mjs' && x.상태 === 200), '쿼리를 뺀 공개 경로로 적는다');
});

// ── 견주기 ─────────────────────────────────────────────────────────────────

test('axe 견주기: 같은 규칙 · 같은 선택자(없으면 같은 HTML 조각 — ?v=는 뺌)는 있던 것, 나머지만 새것 · 앞 판이 없으면 모두 새것', () => {
  const 공개 = { 어긴것: [
    { id: 'image-alt', impact: 'critical', n: 2, 곳: [{ 대상: '#a', html: '<img id="a">' }, { 대상: '.card:nth-child(2) > img', html: '<img src="x.webp?v=111">' }] },
    { id: 'color-contrast', impact: 'serious', n: 1, 곳: [{ 대상: '.dim', html: '<p class="dim">' }] },
  ] };
  const 후보 = { 어긴것: [
    { id: 'image-alt', impact: 'critical', n: 3, 곳: [{ 대상: '#a', html: '<img id="a">' }, { 대상: '.card:nth-child(3) > img', html: '<img src="x.webp?v=222">' }, { 대상: '#new', html: '<img id="new">' }] },
    { id: 'aria-required-children', impact: 'critical', n: 1, 곳: [{ 대상: '.entry', html: '<div role="listbox">' }] },
    { id: 'color-contrast', impact: 'serious', n: 1, 곳: [{ 대상: '.dim', html: '<p class="dim">' }] },
  ] };
  const r = Object.fromEntries(점검.axe견주기(후보, 공개).map((x) => [x.id, x]));
  assert.deepEqual(r['image-alt'].새곳.map((x) => x.대상), ['#new'], '선택자가 바뀐 그림도 HTML 조각(토큰 뺌)이 같으면 있던 것');
  assert.equal(r['image-alt'].있던곳, 2);
  assert.deepEqual(r['aria-required-children'].새곳.map((x) => x.대상), ['.entry']);
  assert.equal(r['color-contrast'].새곳.length, 0);
  assert.equal(r['image-alt'].견줌, true);
  const 새쪽 = 점검.axe견주기(후보, null);
  assert.equal(새쪽.every((x) => !x.견줌 && x.새곳.length === x.모두), true);
  // 공개본 axe가 못 돌았으면({오류}) 견주지 못한다 — 모두 새것
  assert.equal(점검.axe견주기(후보, { 오류: 'axe 가 못 돌았다' }).find((x) => x.id === 'image-alt').새곳.length, 3);
});

test('오류 열쇠: 로컬 주소 · 포트 · ?v= · 줄:칸을 빼고 첫 줄로 견준다 — 앞 공개본에 있던 열쇠는 있던 것', () => {
  const a = 점검.열쇠로("TypeError: Cannot read properties of null (reading 'x')\n    at f (http://127.0.0.1:51234/g/app.js?v=abc:12:5)");
  const b = 점검.열쇠로("TypeError: Cannot read properties of null (reading 'x')\n    at f (http://127.0.0.1:60001/g/app.js?v=def:13:9)");
  assert.equal(a, b);
  assert.equal(점검.열쇠로('Failed to load resource http://127.0.0.1:5000/a.js?v=1:3'), 'Failed to load resource /a.js');
  const 앞 = [{ 열쇠: a }];
  const r = 점검.오류견주기([{ 열쇠: b, 말: 'x' }, { 열쇠: '새 오류', 말: 'y' }], 앞);
  assert.deepEqual(r.새.map((x) => x.말), ['y']);
  assert.deepEqual(r.있던.map((x) => x.말), ['x']);
  assert.equal(점검.오류견주기([{ 열쇠: a }], null).새.length, 1, '앞 판이 없으면(새 쪽) 모두 새것');
});

// ── 판정 ───────────────────────────────────────────────────────────────────

const 잰것 = ({ 오류 = [], 콘솔 = [], 치명 = [], 심각 = [], 문제 = null } = {}) => {
  const 어긴것 = [
    ...[...new Set(치명.map((x) => x[0]))].map((id) => ({ id, impact: 'critical', n: 치명.filter((x) => x[0] === id).length, 곳: 치명.filter((x) => x[0] === id).map((x) => ({ 대상: x[1], html: '' })) })),
    ...[...new Set(심각.map((x) => x[0]))].map((id) => ({ id, impact: 'serious', n: 심각.filter((x) => x[0] === id).length, 곳: 심각.filter((x) => x[0] === id).map((x) => ({ 대상: x[1], html: '' })) })),
  ];
  return { 실림: true, 문제, 오류: 오류.map((m) => ({ 말: m, 곳: '', 열쇠: 점검.열쇠로(m), 수: 1 })), 콘솔: 콘솔.map((m) => ({ 말: m, 곳: '', 열쇠: 점검.열쇠로(m), 수: 1 })),
    axe: 문제 ? {} : { 좁은: { 어긴것 }, 넓은: { 어긴것 } } };
};
const 쪽정보 = (경로, 새쪽 = false) => ({ 경로, 주소: 점검.주소로(경로), 까닭: 새쪽 ? '새' : '바꿈', 새쪽 });

test('판정: 앞 공개본에 없던 치명 위반 · 잡히지 않은 오류만 걸림 — 있던 것 · 심각 이하 · console.error는 알림', () => {
  const r = 점검.판정([
    { 쪽: 쪽정보('g/index.html'),
      후보: 잰것({ 오류: ['TypeError: 새 오류', 'Error: 있던 오류'], 콘솔: ['콘솔 하나'], 치명: [['aria-required-children', '.entry'], ['image-alt', '#old']], 심각: [['color-contrast', '.dim']] }),
      공개본: 잰것({ 오류: ['Error: 있던 오류'], 치명: [['image-alt', '#old']] }) },
    { 쪽: 쪽정보('ok/index.html'), 후보: 잰것({ 치명: [['image-alt', '#keep']] }), 공개본: 잰것({ 치명: [['image-alt', '#keep']] }) },
  ]);
  const 걸림 = r.걸림.map((x) => `${x.경로} ${x.이유}`);
  assert.equal(r.걸림.length, 2, 걸림.join('\n'));
  assert.ok(r.걸림.every((x) => x.검사 === '공개 전 점검' && x.경로 === 'g/index.html'));
  assert.match(걸림[0], /잡히지 않은 오류 1가지\(앞 공개본의 같은 쪽에는 없던 것\): TypeError: 새 오류/);
  assert.match(걸림[1], /axe 치명 위반\(앞 공개본에 없던 자리\): aria-required-children 새 1곳/);
  assert.doesNotMatch(걸림.join('\n'), /image-alt/, '공개본에도 같은 자리에 있던 치명 위반은 막지 않는다');
  const 알림 = r.알림.map((x) => `${x.경로} ${x.이유}`).join('\n');
  assert.match(알림, /g\/index\.html 잡히지 않은 오류 1가지는 앞 공개본에서도 같게 나 막지 않았다/);
  assert.match(알림, /g\/index\.html axe 치명 위반 image-alt 1곳은 앞 공개본에도/);
  assert.match(알림, /g\/index\.html axe 새 위반\(막지 않음\): 심각 color-contrast 새 1곳/);
  assert.match(알림, /g\/index\.html console\.error · 브라우저 오류 1가지\(앞 공개본에 없던 것\)\(막지 않음\): 콘솔 하나/);
  assert.match(알림, /ok\/index\.html axe 치명 위반 image-alt 1곳은/);
  assert.deepEqual(r.쪽.find((x) => x.경로 === 'g/index.html').axe, { 치명: 2, 새치명: 1, 그밖새: 1 });
});

test('판정: 새 쪽은 모두 새것 · 후보를 못 쟀는데 공개본은 쟀으면 걸림 · 둘 다 못 쟀으면 알림 · 공개본만 못 쟀으면 견주지 못했다고 알리고 모두 새것', () => {
  const r = 점검.판정([
    { 쪽: 쪽정보('new/index.html', true), 후보: 잰것({ 치명: [['button-name', '#go']], 오류: ['Error: 새 쪽 오류'] }), 공개본: null },
    { 쪽: 쪽정보('hang/index.html'), 후보: 잰것({ 문제: '150초 안에 재기를 마치지 못했다' }), 공개본: 잰것() },
    { 쪽: 쪽정보('both/index.html'), 후보: 잰것({ 문제: '쪽이 무너졌다' }), 공개본: 잰것({ 문제: '쪽이 무너졌다' }) },
    { 쪽: 쪽정보('newhang/index.html', true), 후보: 잰것({ 문제: '열지 못했다: net::ERR_ABORTED' }), 공개본: null },
    { 쪽: 쪽정보('pubfail/index.html'), 후보: 잰것({ 치명: [['image-alt', '#x']] }), 공개본: 잰것({ 문제: '열지 못했다' }) },
  ]);
  const 걸린쪽 = r.걸림.map((x) => x.경로);
  assert.deepEqual([...new Set(걸린쪽)], ['new/index.html', 'hang/index.html', 'newhang/index.html', 'pubfail/index.html']);
  assert.match(r.걸림.find((x) => x.경로 === 'new/index.html' && /오류/.test(x.이유)).이유, /\(새 쪽\)/);
  assert.match(r.걸림.find((x) => x.경로 === 'hang/index.html').이유, /후보 쪽을 재지 못했다 — 150초.*공개본의 같은 쪽은 쟀다/);
  assert.match(r.걸림.find((x) => x.경로 === 'newhang/index.html').이유, /새 쪽을 재지 못했다.*--공개전점검건너뜀/);
  assert.ok(r.알림.some((x) => x.경로 === 'both/index.html' && /못 잼 — 후보 · 공개본 모두/.test(x.이유)));
  assert.ok(r.알림.some((x) => x.경로 === 'pubfail/index.html' && /앞 공개본을 재지 못해/.test(x.이유)));
});

// ── 입구(점검하기) ─────────────────────────────────────────────────────────

test('점검하기: 후보 · 공개본을 각자 서버로 띄워 잰다 — 바뀐 쪽만 막고, 새 쪽은 공개본을 안 재며, 막힌 쪽은 공개본을 한 번 더 잰다', async () => {
  const 공개 = new Map([
    ['index.html', 쪽('홈')],
    ['g/index.html', 쪽('<!--치명:image-alt:#old--><!--오류:Error: 있던 오류-->')],
    ['flaky/index.html', 쪽('<!--오류2:Error: 가끔 나는 오류-->')],
  ]);
  const 후보 = new Map(공개);
  후보.set('g/index.html', 쪽('<!--치명:image-alt:#old--><!--오류:Error: 있던 오류--><!--치명:aria-required-children:.entry--><!--콘솔:새 콘솔-->'));
  후보.set('flaky/index.html', 쪽('<p>바뀜</p><!--오류:Error: 가끔 나는 오류-->'));
  후보.set('n/index.html', 쪽('<!--심각:color-contrast:.dim-->'));
  const 항목들 = ['g/index.html', 'flaky/index.html', 'n/index.html'].map((p) => 항(p, 공개.has(p) ? '바꿈' : '새', 후보.get(p)));
  const 재기 = 가짜측정();
  const r = await 점검.점검하기({ 항목들, 후보읽기: 판읽개(후보), 공개읽기: 판읽개(공개), 후보있나: (p) => 후보.has(p), 재기 });
  assert.equal(r.결과, '걸림');
  assert.deepEqual(r.걸림.map((x) => x.경로), ['g/index.html'], JSON.stringify(r.걸림));
  assert.match(r.걸림[0].이유, /aria-required-children 새 1곳/);
  assert.ok(!r.걸림.some((x) => /있던 오류|image-alt/.test(x.이유)), '공개본에도 있던 오류 · 위반은 막지 않는다');
  assert.ok(!r.걸림.some((x) => x.경로 === 'flaky/index.html'), '공개본을 한 번 더 재면 나오는 오류는 이번 공개가 만든 것이 아니다');
  assert.ok(r.알림.some((x) => x.경로 === 'n/index.html' && /심각 color-contrast/.test(x.이유)), '심각 이하는 알림만');
  assert.deepEqual(재기.부름.sort(), ['공개본 /flaky/', '공개본 /flaky/ 다시', '공개본 /g/', '공개본 /g/ 다시', '후보 /flaky/', '후보 /g/', '후보 /n/'].sort(),
    '새 쪽(/n/)은 공개본을 재지 않는다 · 막힌 두 쪽만 공개본을 한 번 더');
  assert.deepEqual(r.쪽.map((x) => x.주소), ['/g/', '/flaky/', '/n/']);
  const 줄 = 점검.점검글(r).join('\n');
  assert.match(줄, /공개 전 점검 — 걸림 · 쪽 3개\(새 1\)/);
  assert.match(줄, /--공개전점검건너뜀 "<까닭>"/);
});

test('점검하기: 앞 공개본 첫 잼이 못 잼이면 한 번 더 재서 견준다 — 공개본에도 있던 오류로 막지 않는다', async () => {
  const 공개 = new Map([['p/index.html', 쪽('<!--멈춤1--><!--오류:Error: 있던 오류-->')]]);
  const 후보 = new Map([['p/index.html', 쪽('<p>바뀜</p><!--오류:Error: 있던 오류-->')]]);
  const 재기 = 가짜측정();
  const r = await 점검.점검하기({ 항목들: [항('p/index.html', '바꿈', 후보.get('p/index.html'))], 후보읽기: 판읽개(후보), 공개읽기: 판읽개(공개), 후보있나: (p) => 후보.has(p), 재기 });
  assert.deepEqual(재기.부름.sort(), ['공개본 /p/', '공개본 /p/ 다시', '후보 /p/'].sort());
  assert.equal(r.결과, '통과', JSON.stringify(r.걸림));
  assert.ok(r.알림.some((x) => /앞 공개본에서도 같게 나 막지 않았다/.test(x.이유)));
});

test('점검하기: 후보가 시간을 넘겨 못 잼이면 풀이 끝난 뒤 혼자 한 번 더 잰다 — 다른 창이 브라우저를 붙잡아 못 잰 쪽은 지나가고, 혼자도 멈추는 쪽 · 무너진 쪽은 걸린다', async () => {
  // 11-12 실측의 꼴: 앞 공개본 /en/path/를 재는 동안 브라우저가 약 100초 멈춰, 그동안 시작한 /lab/ 후보가 「createBrowserContext 30초」로 못 잼
  const 공개 = new Map([
    ['slow/index.html', 쪽('<p>옛 판</p>')], ['lab/index.html', 쪽('<p>앞</p>')],
    ['hang/index.html', 쪽('<p>앞</p>')], ['crash/index.html', 쪽('<p>앞</p>')], ['partial/index.html', 쪽('<p>앞</p>')],
  ]);
  const 후보 = new Map([
    ['slow/index.html', 쪽('<p>새 판</p>')], ['lab/index.html', 쪽('<p>뒤</p>')],
    ['hang/index.html', 쪽('<p>뒤</p>')], ['crash/index.html', 쪽('<p>뒤</p>')], ['partial/index.html', 쪽('<p>뒤</p>')],
  ]);
  const 부름 = [];
  let 함께 = 0, 가장많이 = { 다시: 0 };
  const 재기 = async (일) => {
    부름.push(`${일.판} ${일.쪽.주소}${일.다시 ? ' 다시' : ''}`);
    함께++;
    if (일.다시 && 일.판 === '후보') 가장많이.다시 = Math.max(가장많이.다시, 함께);
    await new Promise((r) => setTimeout(r, 5));
    함께--;
    const 빈 = { 주소: 일.주소, 실림: true, 오류: [], 콘솔: [], axe: { 좁은: { 어긴것: [] }, 넓은: { 어긴것: [] } }, 문제: null };
    // 붙잡은 창(옛 공개본) · 그동안 시작해 시간을 넘긴 후보(첫 잼만) · 혼자도 멈추는 후보 · 무너지는 후보 ·
    // 첫 잼이 오류 · 치명 위반을 모은 뒤 넓은 폭에서 시간을 넘긴 후보(다시 재면 깨끗 — 첫 잼의 결함을 지우면 안 된다, GPT GA1)
    if (일.쪽.주소 === '/partial/' && 일.판 === '후보' && !일.다시) {
      const 오류 = [{ 말: 'TypeError: 첫 잼에만 난 오류', 곳: '', 열쇠: 점검.열쇠로('TypeError: 첫 잼에만 난 오류'), 수: 1 }];
      const 치명 = { id: 'aria-required-children', impact: 'critical', help: 'x', n: 1, 곳: [{ 대상: '.entry', html: '<div class="entry">' }] };
      return { ...빈, 오류, axe: { 좁은: { 어긴것: [치명] } }, 문제: 'Emulation.setDeviceMetricsOverride가 30초 안에 답하지 않았다' };
    }
    if (일.쪽.주소 === '/slow/' && 일.판 === '공개본') return { ...빈, 문제: 'Emulation.setDeviceMetricsOverride가 30초 안에 답하지 않았다' };
    if (일.쪽.주소 === '/lab/' && 일.판 === '후보' && !일.다시) return { ...빈, 문제: 'Target.createBrowserContext가 30초 안에 답하지 않았다' };
    if (일.쪽.주소 === '/hang/' && 일.판 === '후보') return { ...빈, 문제: '150초 안에 재기를 마치지 못했다' };
    if (일.쪽.주소 === '/crash/' && 일.판 === '후보') return { ...빈, 문제: '쪽이 무너졌다(렌더러 멈춤)' };
    return 빈;
  };
  const 알림말 = [];
  const 항목들 = [...후보.keys()].map((p) => 항(p, '바꿈', 후보.get(p)));
  const r = await 점검.점검하기({ 항목들, 후보읽기: 판읽개(후보), 공개읽기: 판읽개(공개), 후보있나: (p) => 후보.has(p), 재기, 알리기: (m) => 알림말.push(m), 동시: 3 });
  assert.ok(부름.includes('후보 /lab/ 다시') && 부름.includes('후보 /hang/ 다시') && 부름.includes('후보 /partial/ 다시'), '시간 넘김 후보만 한 번 더');
  assert.ok(!부름.includes('후보 /crash/ 다시') && !부름.includes('후보 /slow/ 다시'), '무너진 쪽 · 잰 쪽은 다시 재지 않는다');
  const 첫다시 = 부름.findIndex((x) => / 다시$/.test(x));
  assert.ok(부름.slice(첫다시).every((x) => / 다시$/.test(x)) && 부름.slice(0, 첫다시).length === 10, `다시 재기는 풀이(10번)가 끝난 뒤: ${부름.join(', ')}`);
  assert.equal(가장많이.다시, 1, '후보를 다시 잴 때는 혼자(막힌 쪽 공개본 다시 재기는 그 뒤 따로)');
  const 걸린쪽 = [...new Set(r.걸림.map((x) => x.경로))].sort();
  assert.deepEqual(걸린쪽, ['crash/index.html', 'hang/index.html', 'partial/index.html'], JSON.stringify(r.걸림));
  const 첫결함 = r.걸림.filter((x) => x.경로 === 'partial/index.html').map((x) => x.이유).join('\n');
  assert.match(첫결함, /TypeError: 첫 잼에만 난 오류/, '다시 잰 결과가 깨끗해도 첫 잼이 모은 오류는 남는다');
  assert.match(첫결함, /aria-required-children 새 1곳/, '첫 잼이 모은 좁은 폭 치명 위반도 남는다');
  assert.match(r.걸림.find((x) => x.경로 === 'hang/index.html').이유, /150초 안에 재기를 마치지 못했다 \(혼자 한 번 더 재도 · 첫 잼: 150초/);
  assert.ok(!r.걸림.some((x) => x.경로 === 'lab/index.html'), '다른 창 탓에 못 잰 후보는 다시 재 통과');
  assert.ok(r.쪽.find((x) => x.주소 === '/lab/') && !r.쪽.find((x) => x.주소 === '/lab/').문제);
  assert.ok(알림말.some((m) => /시간을 넘겨 못 잰 후보 쪽 3개를 하나씩 한 번 더 잰다/.test(m)), 알림말.join('\n'));
  assert.ok(r.알림.some((x) => x.경로 === 'slow/index.html' && /앞 공개본을 재지 못해/.test(x.이유)), '공개본만 못 잰 쪽은 그대로 알림');
});

test('점검하기: 건너뜀이면 재지 않고 알림 · 크롬을 못 띄우면 「못 잼」 알림으로 막지 않음 · 바뀐 HTML이 없으면 볼 쪽 없음', async () => {
  const 판 = new Map([['a/index.html', 쪽('<!--치명:button-name:#go-->')]]);
  const 항목들 = [항('a/index.html', '새', 판.get('a/index.html'))];
  const 공통 = { 항목들, 후보읽기: 판읽개(판), 공개읽기: 판읽개(new Map()), 후보있나: (p) => 판.has(p) };
  const 재기 = 가짜측정();
  const 넘김 = await 점검.점검하기({ ...공통, 재기, 건너뜀: '화면 검수에서 본 의도한 단추' });
  assert.equal(넘김.결과, '건너뜀');
  assert.equal(넘김.까닭, '화면 검수에서 본 의도한 단추');
  assert.deepEqual(넘김.걸림, []);
  assert.match(넘김.알림[0].이유, /건너뜀 — 화면 검수에서 본 의도한 단추 \(쪽 1개 \/a\/를 재지 않았다/);
  assert.equal(재기.부름.length, 0, '건너뛰면 재지 않는다');
  const 못 = await 점검.점검하기({ ...공통, 브라우저열기: async () => { throw new Error('크롬을 못 찾았다 (SYNK_CHROME 으로 경로를 줄 수 있다)'); } });
  assert.equal(못.결과, '못 잼');
  assert.equal(못.브라우저못엶, true);
  assert.deepEqual(못.걸림, [], '크롬이 없는 PC는 막지 않는다');
  assert.match(못.알림[0].이유, /못 잼 — 크롬을 못 찾았다.*막지 않았다/);
  assert.match(점검.점검글(못).join('\n'), /공개 전 점검 — 못 잼: 크롬을 못 찾았다/);
  const 없음 = await 점검.점검하기({ ...공통, 항목들: [항('a/app.css', '바꿈', 글('a{}'))], 후보있나: () => false, 재기 });
  assert.equal(없음.결과, '볼 쪽 없음');
  assert.match(점검.점검글(없음)[0], /바뀐 HTML 쪽이 없어/);
  // 측정이 던져도 그 쪽의 「문제」로 받는다(새 쪽이면 걸림)
  const 던짐 = await 점검.점검하기({ ...공통, 재기: async () => { throw new Error('조종 통로가 닫혔다'); } });
  assert.equal(던짐.결과, '걸림');
  assert.match(던짐.걸림[0].이유, /새 쪽을 재지 못했다 — 조종 통로가 닫혔다/);
});

test('점검하기: 잰 쪽이 안 부른 바뀐 스크립트는 「못 봤다」 알림으로 분모를 밝힌다', async () => {
  const 판 = new Map([
    ['p/index.html', 쪽('<script src="used.js"></script>')], ['p/used.js', 글('1')], ['p/lazy.js', 글('2')],
  ]);
  const 항목들 = [항('p/index.html', '새', 판.get('p/index.html')), 항('p/used.js', '새', 판.get('p/used.js')), 항('p/lazy.js', '새', 판.get('p/lazy.js'))];
  // 가짜 측정이 쪽과 스크립트 하나를 받아 간다(브라우저가 부르는 꼴)
  const 재기 = async (일) => { await fetch(일.주소); await fetch(new URL('used.js', 일.주소)); return { 주소: 일.주소, 실림: true, 오류: [], 콘솔: [], axe: { 좁은: { 어긴것: [] }, 넓은: { 어긴것: [] } }, 문제: null }; };
  const r = await 점검.점검하기({ 항목들, 후보읽기: 판읽개(판), 공개읽기: 판읽개(new Map()), 후보있나: (p) => 판.has(p), 재기 });
  assert.equal(r.결과, '통과');
  const 못봄 = r.알림.find((x) => /잰 쪽이 처음 3초/.test(x.이유));
  assert.ok(못봄, JSON.stringify(r.알림));
  assert.match(못봄.이유, /1개는.*p\/lazy\.js/);
  assert.doesNotMatch(못봄.이유, /used\.js/);
});

test('메시지덧: 건너뛴 까닭을 커밋 메시지 끝 한 줄로', () => {
  assert.equal(점검.메시지덧('제목\n\n본문\n', '의도한 listbox'), '제목\n\n본문\n\n공개 전 점검 건너뜀: 의도한 listbox');
  assert.equal(점검.메시지덧('제목\n', null), '제목');
});

// ── 실제 크롬 ───────────────────────────────────────────────────────────────

const 크롬있음 = (() => { try { require(path.join(REPO, 'tools', 'lib', '크롬조종.js')).크롬찾기(); return true; } catch (_) { return false; } })();

test('실제 크롬: listbox 안 단추(aria-required-children)와 크기 바꿈 처리기 오류를 공개 전에 막고, 앞 공개본에도 있던 위반은 알림만', { skip: 크롬있음 ? false : '크롬 없음(SYNK_CHROME으로 경로를 줄 수 있다)' }, async () => {
  const 쪽글 = (몸) => 글(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>t</title></head><body><main><h1>쪽</h1>${몸}</main></body></html>`);
  const 공개 = new Map([
    ['g/index.html', 쪽글('<div role="listbox" aria-label="고르기"><div role="option" aria-selected="false">하나</div></div><img src="a.png" id="old"><script src="app.js"></script>')],
    ['g/app.js', 글("window.addEventListener('resize', () => { document.getElementById('box'); });")],
  ]);
  const 후보 = new Map(공개);
  후보.set('g/index.html', 쪽글('<div role="listbox" aria-label="고르기"><button>하나</button></div><img src="a.png" id="old"><script src="app.js"></script>'));
  후보.set('g/app.js', 글("window.addEventListener('resize', () => { document.getElementById('gone').getBoundingClientRect(); });"));
  후보.set('n/index.html', 쪽글('<p>새 쪽</p><script>console.error("새 쪽의 콘솔 오류")</script>'));
  const 항목들 = [항('g/index.html', '바꿈', 후보.get('g/index.html')), 항('g/app.js', '바꿈', 후보.get('g/app.js')), 항('n/index.html', '새', 후보.get('n/index.html'))];
  const r = await 점검.점검하기({ 항목들, 후보읽기: 판읽개(후보), 공개읽기: 판읽개(공개), 후보있나: (p) => 후보.has(p), 시간: { 처음: 800, 바꾼뒤: 600, 나타남: 200 } });
  assert.equal(r.결과, '걸림', JSON.stringify(r, null, 1));
  const 걸림 = r.걸림.map((x) => `${x.경로} ${x.이유}`).join('\n');
  assert.match(걸림, /g\/index\.html 직접 열기.*잡히지 않은 오류 1가지\(앞 공개본의 같은 쪽에는 없던 것\): TypeError: Cannot read properties of null \(reading 'getBoundingClientRect'\) \(\/g\/app\.js:1\)/);
  assert.match(걸림, /g\/index\.html axe 치명 위반\(앞 공개본에 없던 자리\): aria-required-children 새 1곳/);
  assert.doesNotMatch(걸림, /image-alt|n\/index\.html/);
  const 알림 = r.알림.map((x) => `${x.경로} ${x.이유}`).join('\n');
  assert.match(알림, /g\/index\.html axe 치명 위반 image-alt 1곳은 앞 공개본에도/);
  assert.match(알림, /n\/index\.html console\.error · 브라우저 오류 1가지\(막지 않음\): 새 쪽의 콘솔 오류/);
  const g = r.쪽.find((x) => x.경로 === 'g/index.html');
  assert.deepEqual([g.오류.새, g.axe.새치명], [1, 1]);
});
