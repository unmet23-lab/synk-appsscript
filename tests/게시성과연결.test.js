'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 연결 = require('../tools/lib/게시성과연결.js');
const 편 = require('../tools/lib/게시성과편.js');
const 도구 = require('../tools/게시성과.js');
const 예약 = require('../tools/작업실예약.js');

function fixture(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-post-link-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const folder = 'LAB_연결시험_20261023', dir = path.join(repo, 'docs/마케팅', folder);
  fs.mkdirSync(path.join(dir, '게시'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'proof.json'), '{}');
  const url = 'https://www.instagram.com/reel/POST_1/';
  const server = { channels: [{ id: 'ig', platform: 'instagram', handle: '@synk.mn' }],
    entries: [{ id: 'entry', channelId: 'ig', platform: 'instagram', url, title: '실제 제목', publishedAt: '2026-10-22T12:00:00Z', checkpoints: [] }],
    posts: [{ id: 'p', channelId: 'ig', url, publishedAt: '2026-10-22T12:00:00Z' }], snapshots: [] };
  const accounts = [{ key: 'lab-instagram', platform: 'instagram', handle: 'synk.mn' }];
  fs.writeFileSync(path.join(repo, 'docs/마케팅/sns-계정.json'), JSON.stringify({ accounts: { 'lab-instagram': accounts[0] } }));
  const request = { 주소: url, 편: folder, 계정: 'lab-instagram', 구분: '콘텐츠', 이유: '실제 계정과 원고·주소 대조', 근거: ['proof.json'] };
  return { repo, folder, dir, url, server, accounts, request, now: Date.parse('2026-10-23T12:00:00Z') };
}

test('연결은 정확 계정·게시물ID·근거 해시를 저장하며 같은 요청은 중복 기록하지 않는다', t => {
  const f = fixture(t);
  const [p] = 연결.prepare(f.repo, [f.request], f.server, f.accounts, [], f.now);
  assert.equal(p.line.post, 'instagram:POST_1');
  assert.equal(p.line.evidence[0].sha256.length, 64);
  const again = 연결.prepare(f.repo, [f.request], f.server, f.accounts, [p.line], f.now + 1000);
  assert.equal(again[0].changed, false);
  assert.throws(() => 연결.prepare(f.repo, [f.request, f.request], f.server, f.accounts, [], f.now), /중복/);
  assert.throws(() => 연결.prepare(f.repo, [{ ...f.request, 계정: '없는계정' }], f.server, f.accounts, [], f.now), /계정/);
  assert.throws(() => 연결.prepare(f.repo, [f.request], { ...f.server, channels: [{ ...f.server.channels[0], handle: '@other' }] }, f.accounts, [], f.now), /실제 계정/);
  assert.throws(() => 연결.prepare(f.repo, [{ ...f.request, 편: '../outside' }], f.server, f.accounts, [], f.now), /폴더 이름/);
  assert.throws(() => 연결.prepare(f.repo, [{ ...f.request, 근거: ['../secret'] }], f.server, f.accounts, [], f.now), /상대 경로/);
  assert.equal(연결.prepare(f.repo, [f.request], f.server, [{ ...f.accounts[0], handle: 'https://instagram.com/synk.mn/' }], [], f.now).length, 1);
});

test('주소만 잇고 예약 상태·후속·다른 플랫폼 기록을 보존하며 같은 계정의 다른 게시를 덮지 않는다', t => {
  const f = fixture(t), plans = 연결.prepare(f.repo, [f.request], f.server, f.accounts, [], f.now);
  const original = { 설명: '원문', 판: [{ 계정: 'lab-instagram', 상태: '예약됨', 시각: '2026-10-22T21:00:00+09:00', 주소: null, 후속: '첫 댓글' }, { 계정: 'shift-tistory', 상태: '보류' }] };
  const got = 연결.applyResult(original, f.folder, plans);
  assert.equal(original.판[0].주소, null);
  assert.equal(got.판[0].상태, '예약됨');
  assert.equal(got.판[0].후속, '첫 댓글');
  assert.deepEqual(got.판[1], original.판[1]);
  assert.equal(got.판[0].게시물ID, 'POST_1');
  assert.equal(got.판[0].편ID, f.folder);
  const second = structuredClone(plans); second[0].line.url = 'https://www.instagram.com/p/POST_2/'; second[0].line.post = 'instagram:POST_2';
  const more = 연결.applyResult(got, f.folder, second);
  assert.equal(more.판[0].게시물ID, 'POST_1');
  assert.equal(more.추가게시[0].게시물ID, 'POST_2');
  assert.equal(more.추가게시[0].상태, '공개 확인 필요');
});

test('같은게시물은 게시결과에 적힌 번호를 받아 그 번호 줄 하나에만 적는다 — 처음게시물ID로 남기고, 없거나 여럿이거나 다른 주소면 멈추며, 다시 돌려도 같다(설계 검토 8 대안 B · 15회차 GA1 · GA2 · 손연결 GA1~GA3)', t => {
  const f = fixture(t);
  const ask = num => 연결.prepare(f.repo, [{ ...f.request, 같은게시물: num }], f.server, f.accounts, [], f.now);
  const plans = ask(' OLD_POST ');
  assert.equal(plans[0].line.samePost, 'OLD_POST');
  // 번호 말고는 받지 않는다. 공개 확인 대기 · 편 없는 연결과도 함께 쓰지 않는다(2회차 GA2)
  for (const bad of [true, null, 123, '', ' ', false]) assert.throws(() => ask(bad), /같은게시물/, String(bad));
  assert.throws(() => 연결.prepare(f.repo, [{ ...f.request, 구분: '공개확인대기', 같은게시물: 'OLD_POST' }], f.server, f.accounts, [], f.now), /공개확인대기/);
  assert.throws(() => 연결.prepare(f.repo, [{ ...f.request, 구분: '운영시험', 편: null, 같은게시물: 'OLD_POST' }], f.server, f.accounts, [], f.now), /편과 함께/);
  // 번호 줄 하나 + 다음 예약 줄: 번호 줄에 주소와 처음게시물ID를 적고 예약 줄은 그대로 둔다. 다시 돌려도 같다
  const two = { 판: [{ 계정: 'lab-instagram', 상태: '게시됨', 시각: '2026-10-22T21:00:00+09:00', 게시물ID: 'OLD_POST' },
    { 계정: 'lab-instagram', 상태: '예약됨', 시각: '2026-10-24T21:00:00+09:00', 작업: 'job-next' }] };
  const got = 연결.applyResult(two, f.folder, plans);
  assert.deepEqual([got.판[0].주소, got.판[0].게시물ID, got.판[0].처음게시물ID, got.판[0].상태, got.판[0].시각], [f.url, 'POST_1', 'OLD_POST', '게시됨', two.판[0].시각]);
  assert.deepEqual([got.판[1], got.추가게시], [two.판[1], undefined]);
  assert.deepEqual(연결.applyResult(got, f.folder, plans), got);
  // 없는 번호 · 같은 번호 줄 둘 · 그 번호 줄에 다른 게시물의 주소 — 셋 다 쓰기 전에 멈춘다
  assert.throws(() => 연결.applyResult(two, f.folder, ask('NOPE')), /번호 NOPE가 적힌 lab-instagram 판 줄이 0개/);
  const dup = structuredClone(two); dup.판.push({ 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: 'OLD_POST' });
  assert.throws(() => 연결.applyResult(dup, f.folder, plans), /판 줄이 2개/);
  const taken = structuredClone(two); taken.판[0].주소 = 'https://www.instagram.com/reel/OTHER/';
  assert.throws(() => 연결.applyResult(taken, f.folder, plans), /판 줄이 0개/);
  // 번호 줄 둘 가운데 가리킨 줄만 바뀐다
  const pair = { 판: [{ 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: 'OLD_POST' }, { 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: 'OLD_POST_2' }] };
  const second = 연결.applyResult(pair, f.folder, ask('OLD_POST_2'));
  assert.deepEqual([second.판[0], second.판[1].처음게시물ID, second.판[1].주소], [pair.판[0], 'OLD_POST_2', f.url]);
  // 손으로 주소만 적어 번호가 어긋난 줄은 그 번호를 주면 바로잡힌다(15회차 GA2)
  const manual = 연결.applyResult({ 판: [{ 계정: 'lab-instagram', 상태: '게시됨', 주소: f.url, 게시물ID: 'OLD_POST' }] }, f.folder, plans);
  assert.deepEqual([manual.판[0].게시물ID, manual.판[0].처음게시물ID], ['POST_1', 'OLD_POST']);
  // 처음게시물ID가 이미 다른 번호로 있으면 처음 번호를 지키려고 멈춘다(조건 6)
  assert.throws(() => 연결.applyResult({ 판: [{ 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: 'OLD_POST', 처음게시물ID: 'FIRST' }] }, f.folder, plans), /처음게시물ID FIRST/);
  // 밝히지 않은 연결은 번호가 적힌 빈 줄도, 그 곁의 예약 줄도 고르지 않고 추가게시로 남긴다(15회차 GA1 · 손연결 GA1)
  const plain = 연결.prepare(f.repo, [f.request], f.server, f.accounts, [], f.now);
  const kept = 연결.applyResult(two, f.folder, plain);
  assert.deepEqual(kept.판, two.판);
  assert.deepEqual([kept.추가게시[0].게시물ID, kept.추가게시[0].상태], ['POST_1', '공개 확인 필요']);
  // 그 추가게시 주소를 번호로 다시 이으면 번호 줄로 옮기고 추가게시를 지운다. 다시 돌려도 같다(손연결 GA2 · 2회차 GA3)
  const moved = 연결.applyResult(kept, f.folder, plans);
  assert.deepEqual(moved, got);
  assert.deepEqual(연결.applyResult(moved, f.folder, plans), got);
  // 그 추가게시 줄에 손으로 적은 칸이 있거나, 이 주소가 판의 다른 줄에 있으면 멈춘다
  const touched = structuredClone(kept); touched.추가게시[0].공개확인 = '손으로 적음';
  assert.throws(() => 연결.applyResult(touched, f.folder, plans), /다른 줄에 이미 적혀/);
  const elsewhere = structuredClone(two); elsewhere.판[1].주소 = f.url;
  assert.throws(() => 연결.applyResult(elsewhere, f.folder, plans), /다른 줄에 이미 적혀/);
  // 밝히지 않았는데 주소가 같은 줄의 번호가 다르면 멈추고, 같은게시물에 적을 값을 알린다(P2-2)
  assert.throws(() => 연결.applyResult({ 판: [{ 계정: 'lab-instagram', 상태: '게시됨', 주소: f.url, 게시물ID: 'OTHER' }] }, f.folder, plain), /게시물ID OTHER가 이 주소의 번호와 다르다 — 같은 게시물이면 .*「같은게시물」/);
  // 이 게시물의 번호가 적힌 빈 줄은 다른 번호의 줄이 함께 있어도 채운다. 그 줄을 고르지 못하던 판이 추가게시에 둔 주소도 그 줄로 옮긴다(2회차 GA1)
  const exactTwo = { 판: [{ 계정: 'lab-instagram', 상태: '예약됨', 게시물ID: 'POST_1' }, { 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: 'OLD_POST' }] };
  const withExact = 연결.applyResult(exactTwo, f.folder, plain);
  assert.deepEqual([withExact.판[0].주소, withExact.판[1].주소, withExact.추가게시], [f.url, undefined, undefined]);
  assert.deepEqual(연결.applyResult({ ...structuredClone(exactTwo), 추가게시: [structuredClone(kept.추가게시[0])] }, f.folder, plain), withExact);
  const handExtra = { ...structuredClone(exactTwo), 추가게시: [{ ...structuredClone(kept.추가게시[0]), 상태: '게시됨' }] };
  assert.deepEqual(연결.applyResult(handExtra, f.folder, plain).판, exactTwo.판);
});

test('번호 없는 빈 줄 하나는 나간 판일 때만 고른다 — 취소됨 · 보류 · 승인 대기 줄과 게시 뒤의 예약 줄은 그대로 두고 추가게시로 남긴다(설계 검토 8 P1-1)', t => {
  const f = fixture(t), plain = 연결.prepare(f.repo, [f.request], f.server, f.accounts, [], f.now);
  const posted = { 계정: 'lab-instagram', 상태: '게시됨', 시각: '2026-10-20T21:00:00+09:00', 주소: 'https://www.instagram.com/reel/EARLIER/', 게시물ID: 'EARLIER' };
  for (const 상태 of ['취소됨', '보류', '지움', '실패', '승인 대기', '대기']) {
    const original = { 판: [posted, { 계정: 'lab-instagram', 상태, 시각: '2026-10-21T21:00:00+09:00' }] };
    const got = 연결.applyResult(original, f.folder, plain);
    assert.deepEqual(got.판, original.판, 상태);
    assert.equal(got.추가게시[0].게시물ID, 'POST_1', 상태);
  }
  // 게시(10-22 21:00) 뒤 한 시간이 넘은 예약 줄은 다음 예약이다
  const next = { 판: [posted, { 계정: 'lab-instagram', 상태: '예약됨', 시각: '2026-10-23T21:00:00+09:00' }] };
  assert.deepEqual(연결.applyResult(next, f.folder, plain).판, next.판);
  // 지난 예약 줄 하나는 예전처럼 채운다(예약 시각과 상태는 그대로)
  const due = { 판: [posted, { 계정: 'lab-instagram', 상태: '예약됨', 시각: '2026-10-22T21:00:00+09:00' }] };
  const filled = 연결.applyResult(due, f.folder, plain);
  assert.deepEqual([filled.판[1].주소, filled.판[1].상태, filled.판[1].시각, filled.추가게시], [f.url, '예약됨', '2026-10-22T21:00:00+09:00', undefined]);
  // 한 목록 안의 요청 순서와 상관없이 같다(P2-3): 번호 줄 + 다음 예약 줄에 같은게시물 요청과 밝히지 않은 다른 게시물 요청
  const url2 = 'https://www.instagram.com/reel/POST_2/';
  const server = { ...f.server, entries: [...f.server.entries, { ...f.server.entries[0], id: 'entry2', url: url2, publishedAt: '2026-10-22T13:00:00Z' }] };
  const reqA = { ...f.request, 같은게시물: 'OLD_POST' }, reqB = { ...f.request, 주소: url2 };
  const base = { 판: [{ 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: 'OLD_POST' }, { 계정: 'lab-instagram', 상태: '예약됨', 시각: '2026-10-24T21:00:00+09:00' }] };
  const ab = 연결.applyResult(base, f.folder, 연결.prepare(f.repo, [reqA, reqB], server, f.accounts, [], f.now));
  const ba = 연결.applyResult(base, f.folder, 연결.prepare(f.repo, [reqB, reqA], server, f.accounts, [], f.now));
  assert.deepEqual(ab, ba);
  assert.deepEqual([ab.판[1], ab.추가게시.map(r => r.게시물ID)], [base.판[1], ['POST_2']]);
});

test('한 목록의 연결은 순서와 상관없이 같은 줄에 적고, 손으로 고친 추가게시 줄은 지우지 않는다(손연결 3회차 GA1~GA4)', t => {
  const f = fixture(t);
  const url2 = 'https://www.instagram.com/reel/POST_2/';
  const server = { ...f.server, entries: [...f.server.entries, { ...f.server.entries[0], id: 'entry2', url: url2, publishedAt: '2026-10-22T13:00:00Z' }] };
  const reqB = { ...f.request, 주소: url2 };
  const run = (data, reqs) => 연결.applyResult(data, f.folder, 연결.prepare(f.repo, reqs, server, f.accounts, [], f.now));
  const both = data => { const ab = run(data, [f.request, reqB]), ba = run(data, [reqB, f.request]); assert.deepEqual(ab, ba); return ab; };
  // GA2: 이 게시물 번호 줄 + 번호 없는 21:30 예약 줄 — POST_1은 제 번호 줄, 22:00에 올라간 POST_2는 예약 줄. 순서를 바꿔도 같다
  const g2 = { 판: [{ 계정: 'lab-instagram', 상태: '예약됨', 시각: '2026-10-22T21:00:00+09:00', 게시물ID: 'POST_1' },
    { 계정: 'lab-instagram', 상태: '예약됨', 시각: '2026-10-22T21:30:00+09:00' }] };
  const r2 = both(g2);
  assert.deepEqual([r2.판[0].주소, r2.판[1].주소, r2.추가게시], [f.url, url2, undefined]);
  // 번호 없는 빈 줄 하나를 두 연결이 다투면 어느 쪽도 고르지 않는다
  const one = { 판: [{ 계정: 'lab-instagram', 상태: '예약됨', 시각: '2026-10-22T21:00:00+09:00' }] };
  const r1 = both(one);
  assert.deepEqual([r1.판, r1.추가게시.map(r => r.게시물ID).sort()], [one.판, ['POST_1', 'POST_2']]);
  // GA3: 게시 뒤에 예약된 줄이라도 번호가 적혀 있으면 번호 없는 줄을 고르지 않는다
  const g3 = { 판: [{ 계정: 'lab-instagram', 상태: '예약됨', 시각: '2026-10-22T23:30:00+09:00', 게시물ID: 'OLD_POST' },
    { 계정: 'lab-instagram', 상태: '예약됨', 시각: '2026-10-22T21:30:00+09:00' }] };
  const r3 = run(g3, [f.request]);
  assert.deepEqual([r3.판, r3.추가게시[0].게시물ID], [g3.판, 'POST_1']);
  // GA1: 이 주소에 다른 번호가 적힌 추가게시 줄은 도구가 만든 줄로 보지 않는다 — 지우지 않고 번호가 다르다고 멈춘다. 처음게시물ID가 있는 줄도 지우지 않는다
  const exactRow = { 계정: 'lab-instagram', 상태: '예약됨', 시각: '2026-10-22T21:00:00+09:00', 게시물ID: 'POST_1' };
  // 이 도구가 만든 추가게시 줄(만든곳 · 만든지문까지) — 판에 고를 줄이 없는 연결 하나로 만든다
  const auto = run({ 판: [] }, [f.request]).추가게시[0];
  assert.deepEqual([auto.만든곳, auto.만든지문.length, auto.시각], ['게시성과 --연결목록', 16, '2026-10-22T12:00:00Z']);
  assert.throws(() => run({ 판: [exactRow], 추가게시: [{ ...auto, 게시물ID: 'OLD_POST' }] }, [f.request]), /게시물ID OLD_POST가 이 주소의 번호와 다르다/);
  const firstId = run({ 판: [exactRow], 추가게시: [{ ...auto, 처음게시물ID: 'FIRST' }] }, [f.request]);
  assert.deepEqual([firstId.판[0], firstId.추가게시[0].처음게시물ID], [exactRow, 'FIRST']);
  // GA4: 같은 주소의 추가게시 줄이 둘이고 하나에 손으로 적은 칸이 있으면, 같은게시물 연결은 어느 줄도 지우지 않고 멈춘다. 둘 다 도구가 만든 줄이면 둘 다 지운다
  const numbered = { 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: 'OLD_POST' };
  const same = [{ ...f.request, 같은게시물: 'OLD_POST' }];
  assert.throws(() => run({ 판: [numbered], 추가게시: [auto, { ...auto, 공개확인: '손으로 적음' }] }, same), /다른 줄에 이미 적혀/);
  const twice = run({ 판: [numbered], 추가게시: [auto, structuredClone(auto)] }, same);
  assert.deepEqual([twice.판[0].주소, twice.판[0].처음게시물ID, twice.추가게시], [f.url, 'OLD_POST', undefined]);
  // 4회차 GA1: 편ID가 없거나 시각이 게시 시각과 다른 줄은 도구가 만든 줄이 아니다 — 지우지 않고 멈춘다
  for (const odd of [(({ 편ID, ...r }) => r)(auto), { ...auto, 시각: '2026-10-23T09:00:00+09:00' }, { ...auto, 플랫폼: undefined }, (({ 연결근거, ...r }) => r)(auto)]) {
    assert.throws(() => run({ 판: [numbered], 추가게시: [auto, odd] }, same), /다른 줄에 이미 적혀/);
  }
  // 4회차 GA2: 옮기지 않은 연결은 이 주소가 적힌 줄 모두에 새 근거를 적는다
  const hand = { ...auto, 공개확인: '손으로 적음', 연결근거: [{ path: 'old.json', sha256: 'old' }] };
  const all = run({ 판: [exactRow], 추가게시: [structuredClone(auto), hand] }, [f.request]);
  assert.deepEqual(all.판, [exactRow]);
  assert.deepEqual(all.추가게시.map(r => [r.연결근거[0]?.path, r.공개확인]), [['proof.json', undefined], ['proof.json', '손으로 적음']]);
  // 5회차 GA1: 손으로 적은 줄(표시 없음 · 다른 성과구분)에 연결을 적어도 다음 실행이 그 줄을 지우지 않는다
  const { 만든곳: _mark, 만든지문: _hash, ...unmarked } = auto;
  const handOther = { ...unmarked, 성과구분: '작품' };
  const first = run({ 판: [exactRow], 추가게시: [structuredClone(auto), handOther] }, [f.request]);
  const again = run(JSON.parse(JSON.stringify(first)), [f.request]);
  assert.deepEqual([again.판, again.추가게시.length, again.추가게시[0].만든곳, again.추가게시[1].만든곳], [[exactRow], 2, '게시성과 --연결목록', undefined]);
  // 표시 없는 옛 추가게시 줄은 같은게시물로도 옮기지 않고, 사람이 지우라고 알리며 멈춘다
  assert.throws(() => run({ 판: [numbered], 추가게시: [unmarked] }, same), /만든곳/);
  // 이 도구가 새로 만드는 추가게시 줄에는 표시가 붙는다
  assert.equal(run(g3, [f.request]).추가게시[0].만든곳, '게시성과 --연결목록');
  // 7회차: 다른 편ID가 적힌 줄은 이 편으로 덮지 않고 쓰기 전에 멈춘다
  assert.throws(() => run({ 판: [exactRow], 추가게시: [structuredClone(auto), { ...structuredClone(auto), 편ID: 'OTHER_EPISODE' }] }, [f.request]), /편ID OTHER_EPISODE가 이 편과 다르다/);
  // 6회차: 도구가 만든 줄의 칸을 손으로 바꿨다(성과구분) — 첫 실행이 그 칸을 요청대로 다시 적더라도 지문을 지워, 같은 요청을 다시 돌려도 그 줄을 지우지 않는다
  const touchedAuto = { ...structuredClone(auto), 성과구분: '작품' };
  const once = run({ 판: [exactRow], 추가게시: [structuredClone(auto), touchedAuto] }, [f.request]);
  assert.deepEqual([once.추가게시[1].성과구분, once.추가게시[1].만든지문, once.추가게시[0].만든지문], ['콘텐츠', undefined, auto.만든지문]);
  const twiceMore = run(JSON.parse(JSON.stringify(once)), [f.request]);
  assert.deepEqual([twiceMore.판, twiceMore.추가게시], [[exactRow], once.추가게시]);
  assert.throws(() => run(JSON.parse(JSON.stringify(once)), same.map(q => ({ ...q, 같은게시물: 'POST_1' }))), /만든지문/);
  // 같은게시물 번호가 이 목록의 다른 게시물 번호면 쓰기 전에 거절한다(순서에 따라 결과가 갈리는 요청)
  assert.throws(() => 연결.prepare(f.repo, [{ ...reqB, 같은게시물: 'POST_1' }, f.request], server, f.accounts, [], f.now), /다른 게시물 번호/);
});

test('실제 판 꼴: 페북 페이지 게시물 번호만 적힌 게시됨 줄에 릴스 주소를 번호로 이어 쓰면 상태 · 시각을 지키고 미리 보기가 멈출 요청을 먼저 보인다(설계 검토 8 조건 8 · P2-4)', t => {
  const f = fixture(t);
  const reel = 'https://www.facebook.com/reel/2296236005107499/';
  const server = { channels: [{ id: 'fb', platform: 'facebook', externalId: 'PAGE_1' }],
    entries: [{ id: 'e', channelId: 'fb', platform: 'facebook', url: reel, title: '제목', publishedAt: '2026-10-31T12:00:00Z', checkpoints: [] }], posts: [], snapshots: [] };
  const accounts = [{ key: 'lab-lk-facebook', platform: 'facebook', apiPageId: 'PAGE_1' }];
  const row = { 계정: 'lab-lk-facebook', 상태: '게시됨', 시각: '2026-10-31T21:00:00+09:00', 게시물ID: '122128674231475802', 방법: 'Business Suite 교차 예약' };
  const file = path.join(f.dir, '게시', '게시결과.json');
  fs.writeFileSync(file, JSON.stringify({ 판: [row] }, null, 2) + '\n');
  const req = { 주소: reel, 편: f.folder, 계정: 'lab-lk-facebook', 구분: '콘텐츠', 이유: '같은 게시물', 근거: ['proof.json'] };
  // 번호를 한 자리 틀리면 미리 보기(planResults)에서 멈추고 파일은 그대로다
  assert.throws(() => 연결.planResults(f.repo, 연결.prepare(f.repo, [{ ...req, 같은게시물: '122128674231475803' }], server, accounts, [], f.now)), /0개/);
  const plans = 연결.prepare(f.repo, [{ ...req, 같은게시물: '122128674231475802' }], server, accounts, [], f.now);
  assert.equal(연결.planResults(f.repo, plans).length, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).판[0], row);
  assert.deepEqual(연결.writeResults(f.repo, plans), [`docs/마케팅/${f.folder}/게시/게시결과.json`]);
  const after = JSON.parse(fs.readFileSync(file, 'utf8')).판[0];
  assert.deepEqual([after.상태, after.시각, after.방법, after.주소, after.게시물ID, after.처음게시물ID, after.플랫폼],
    ['게시됨', row.시각, row.방법, reel, '2296236005107499', '122128674231475802', 'facebook']);
  assert.deepEqual(연결.writeResults(f.repo, plans), []);
});

test('공개 확인 대기는 빈 예약 줄을 채우지 않으며 시험·작품과 함께 비교 표본에서 빠진다', t => {
  const f = fixture(t);
  const plans = 연결.prepare(f.repo, [{ ...f.request, 구분: '공개확인대기' }], f.server, f.accounts, [], f.now);
  const got = 연결.applyResult({ 판: [{ 계정: 'lab-instagram', 상태: '예약됨', 주소: null }] }, f.folder, plans);
  assert.equal(got.판[0].주소, null);
  assert.equal(got.추가게시.length, 1);
  const filtered = 연결.filterServer(f.server, 연결.latest(plans.map(p => p.line)));
  assert.equal(filtered.entries.length, 0); assert.equal(filtered.posts.length, 0);
  assert.equal(f.server.entries.length, 1);
});

test('명시 연결과 추가게시를 편 색인에서 읽고, 비슷한 시각·제목만으로 다른 편을 잇지 않는다', t => {
  const f = fixture(t), [p] = 연결.prepare(f.repo, [f.request], f.server, f.accounts, [], f.now);
  const file = path.join(f.dir, '게시/게시결과.json');
  fs.writeFileSync(file, JSON.stringify({ 추가게시: [{ 계정: 'lab-instagram', 주소: f.url }] }));
  let index = 편.buildIndex(path.join(f.repo, 'docs/마케팅'));
  assert.equal(index.resolve(p.line.post).info.folder, f.folder);
  assert.equal(index.resolve('instagram:OTHER'), null);
  fs.writeFileSync(file, '{}');
  index = 편.buildIndex(path.join(f.repo, 'docs/마케팅'), 연결.latest([p.line]));
  assert.equal(index.resolve(p.line.post).account, 'lab-instagram');
});

test('쓰기 재실행은 같은 파일을 다시 쓰지 않고 손상된 게시결과는 덮지 않는다', t => {
  const f = fixture(t), plans = 연결.prepare(f.repo, [f.request], f.server, f.accounts, [], f.now);
  const file = path.join(f.dir, '게시/게시결과.json');
  fs.writeFileSync(file, '{"판":[{"계정":"lab-instagram","주소":null,"상태":"예약됨"}]}\r\n');
  assert.equal(연결.writeResults(f.repo, plans).length, 1);
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes('\r\n'));
  assert.deepEqual(연결.writeResults(f.repo, plans), []);
  fs.writeFileSync(file, '{broken');
  assert.throws(() => 연결.writeResults(f.repo, plans));
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});

test('작업실 완료 결과는 작업ID·편ID·플랫폼 게시물ID를 남기고 다른 작업을 덮지 않는다', t => {
  const f = fixture(t), bundle = { dir: f.dir, name: f.folder };
  const file = path.join(f.dir, '게시/게시결과.json');
  fs.writeFileSync(file, JSON.stringify({ 판: [{ 계정: 'lab-instagram', 작업: 'old', 주소: 'https://instagram.com/p/OLD/' }] }));
  예약.mergeResults(bundle, [{ 계정: 'lab-instagram', 작업: 'new', 주소: f.url, 상태: '게시됨' }]);
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')).판;
  assert.equal(rows.length, 2); assert.equal(rows[0].작업, 'old');
  assert.equal(rows[1].편ID, f.folder); assert.equal(rows[1].게시물ID, 'POST_1');
  assert.throws(() => 연결.identity(f.folder, { 주소: f.url, 게시물ID: 'OTHER' }), /다르다/);
});

test('미리 보기는 연결·분류 결과를 보여도 원장을 쓰지 않고 요약은 옛 시험 판정을 제외한다', async t => {
  const f = fixture(t);
  const manifest = path.join(f.repo, 'links.json');
  fs.writeFileSync(manifest, JSON.stringify([{ ...f.request, 편: null, 구분: '운영시험' }]));
  const got = await 도구.run({ 저장소: f.repo, 연결목록: manifest, 쇼츠안읽음: true }, { now: f.now, data: f.server, shorts: new Map() });
  assert.equal(got.별도분류, 1); assert.equal(got.미연결.length, 0);
  assert.equal(fs.existsSync(path.join(f.repo, 'docs/_ops/게시성과.jsonl')), false);
  const [p] = 연결.prepare(f.repo, [{ ...f.request, 편: null, 구분: '운영시험' }], f.server, f.accounts, [], f.now);
  const summary = 도구.summarize({ ledger: [{ at: new Date(f.now).toISOString(), kind: '판정', post: p.line.post, point: '24h', publishedAt: '2026-10-22T12:00:00Z', verdict: '상위 25%', metrics: {}, line: '옛 시험 숫자' }, p.line], now: f.now });
  assert.doesNotMatch(summary, /옛 시험 숫자/);
  assert.match(summary, /운영시험/);
});

test('작업ID 없는 수동 게시도 새 작업이 덮지 않으며 같은 작업의 주소 변경은 거부한다', t => {
  const f = fixture(t), bundle = { dir: f.dir, name: f.folder };
  const file = path.join(f.dir, '게시/게시결과.json');
  const original = { 계정: 'lab-instagram', 주소: 'https://instagram.com/p/MANUAL/', 상태: '게시됨', 후속: '첫 댓글' };
  fs.writeFileSync(file, JSON.stringify({ 판: [original] }));
  예약.mergeResults(bundle, [{ 계정: 'lab-instagram', 작업: 'new', 상태: '승인 대기' }]);
  예약.mergeResults(bundle, [{ 계정: 'lab-instagram', 작업: 'new', 주소: f.url, 상태: '게시됨' }]);
  const raw = fs.readFileSync(file, 'utf8'), rows = JSON.parse(raw).판;
  assert.equal(rows.length, 2); assert.deepEqual(rows[0], original);
  assert.equal(rows[1].게시물ID, 'POST_1');
  assert.throws(() => 예약.mergeResults(bundle, [{ 계정: 'lab-instagram', 작업: 'new', 주소: 'https://instagram.com/p/OTHER/' }]), /주소가 달라/);
  assert.equal(fs.readFileSync(file, 'utf8'), raw);
  fs.writeFileSync(file, JSON.stringify({ 판: [original], 추가게시: [{ 계정: 'lab-instagram', 주소: f.url, 후속: '보존' }] }));
  예약.mergeResults(bundle, [{ 계정: 'lab-instagram', 작업: 'new', 주소: f.url, 상태: '게시됨' }]);
  const extra = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(extra.판.length, 1); assert.equal(extra.추가게시.length, 1);
  assert.equal(extra.추가게시[0].작업, 'new'); assert.equal(extra.추가게시[0].후속, '보존');
});

test('별도 분류해 비교에서 뺀 게시도 서버에 있으면 미등록 경고를 내지 않는다', async t => {
  const f = fixture(t), manifest = path.join(f.repo, 'links.json');
  fs.writeFileSync(manifest, JSON.stringify([{ ...f.request, 구분: '작품' }]));
  fs.writeFileSync(path.join(f.dir, '게시/게시결과.json'), JSON.stringify({ 추가게시: [{ 계정: 'lab-instagram', 주소: f.url, 상태: '게시됨', 시각: '2026-10-22T12:00:00Z' }] }));
  const got = await 도구.run({ 저장소: f.repo, 연결목록: manifest, 쇼츠안읽음: true }, { now: f.now, data: f.server, shorts: new Map() });
  assert.deepEqual(got.미등록, []);
  assert.equal(got.별도분류, 1);
  const screened = await 도구.run({ 저장소: f.repo, 연결목록: manifest, 적기: f.url, 값들: ['팔로우=7'], 쇼츠안읽음: true }, { now: f.now, data: f.server, shorts: new Map() });
  assert.deepEqual(screened.화면줄.metrics, { follows: 7 });
  assert.deepEqual(screened.새판정, []);
  assert.equal(fs.existsSync(path.join(f.repo, 'docs/_ops/게시성과.jsonl')), false);
  const without = await 도구.run({ 저장소: f.repo, 쇼츠안읽음: true }, { now: f.now, data: { ...f.server, entries: [], posts: [] }, shorts: new Map() });
  assert.equal(without.미등록.length, 1);
});

test('원장 계정과 서버 채널 — 「t.me/<채널>」 핸들, 핸들 없는 계정은 공개 주소의 번호 칸으로 맞추고 이름이 비슷한 것은 보지 않는다(11-19)', () => {
  assert.equal(연결.channelMatches({ platform: 'telegram', handle: 't.me/synkmn' }, { platform: 'telegram', handle: 'synkmn' }), true);
  assert.equal(연결.channelMatches({ platform: 'threads', handle: '@yuhobuilds' }, { platform: 'threads', handle: 'yuhobuilds' }), true);
  const xhs = { platform: 'xiaohongshu', handle: '', url: 'https://www.rednote.com/user/profile/6ab10807000000000301d12f' };
  assert.equal(연결.channelMatches(xhs, { platform: 'xiaohongshu', handle: 'rednote ID 94512834104', externalId: '6ab10807000000000301d12f' }), true);
  assert.equal(연결.channelMatches(xhs, { platform: 'xiaohongshu', externalId: '6ab10807000000000301d12' }), false);
  assert.equal(연결.channelMatches({ platform: 'rutube', handle: '', url: 'https://rutube.ru/channel/81398864/' }, { platform: 'rutube', externalId: '81398864' }), true);
  // 핸들이 있는데 다르면 주소로 다시 맞추지 않는다 · 페북 apiPageId 규칙은 그대로
  assert.equal(연결.channelMatches({ platform: 'telegram', handle: 'synkmn', url: 'https://t.me/x/123' }, { platform: 'telegram', handle: 'other', externalId: '123' }), false);
  assert.equal(연결.channelMatches({ platform: 'facebook', handle: '', apiPageId: '1311331138729740', url: 'https://www.facebook.com/profile.php?id=61594726675164' },
    { platform: 'facebook', externalId: '1311331138729740' }), true);
});
