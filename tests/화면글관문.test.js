'use strict';
// ㉓ 화면 글 관문(tools/lib/화면글관문.js) — 화면글검사.js가 낸 걸림을 고칠 것 · 확인할 것으로 매기는지, 「화면글판단」 까닭이 고칠 것을 내리는지,
// 같은 영상 · 같은 원본이면 다시 재지 않는지, 관문 밖 편은 묻지 않는지. 렌더하는 도구는 가짜로 바꿔 끼운다(실제 잼은 tests/화면글검사.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { screenTextFindings, applies, FROM, FIX_FROM } = require('../tools/lib/화면글관문.js');
const { FIX, LOOK } = require('../tools/lib/게시글규칙.js');

const 걸림 = [
  { 항목: '머묾', 초: 9.5, 끝초: 10, 글: '꽃', 잰값: 0.5, 필요: 1.2, 비: 0.42, 심함: true, 설명: '「꽃」이 9.5초에 떠 0.5초만 있다(새 글은 1.2초 넘게)' },
  { 항목: '머묾', 초: 9.5, 끝초: 10, 글: 'цэцэг', 잰값: 0.5, 필요: 1.2, 비: 0.42, 심함: true, 설명: '「цэцэг」이 9.5초에 떠 0.5초만 있다(새 글은 1.2초 넘게)' },
  { 항목: '머묾', 초: 1.9, 끝초: 2.8, 글: '개', 잰값: 0.9, 필요: 1.2, 비: 0.75, 심함: false, 설명: '「개」이 1.9초에 떠 0.9초만 있다(새 글은 1.2초 넘게)' },
  { 항목: '읽기', 초: 0, 끝초: 1.5, 글: 'Солонгост', 잰값: 1.5, 필요: 2.6, 비: 0.57, 심함: true, 설명: '긴 줄' },
  { 항목: '핵심', 초: 11.9, 끝초: 13, 글: 'САЛЮТ', 잰값: 1.1, 필요: 2.5, 비: 0.44, 심함: true, 설명: '답 · 뜻풀이 「САЛЮТ」이 1.1초만 있다' },
  { 항목: '새낱말', 초: 9.5, 끝초: 17.8, 글: '물개 · 물 · 개 · 불 · 꽃 · 불꽃 · 불꽃놀이 · 놀이 · 고기', 잰값: 9, 필요: 4, 비: 0.44, 심함: true, 설명: '가르치는 한국어 낱말이 9개다' },
];

function fixture(t, { name = 'LAB_시험_mn_20261124', prep = {} } = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), '화면글관문-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const dir = path.join(repo, 'docs', '마케팅', name);
  fs.mkdirSync(path.join(dir, '게시', '01-ig-fb-mn'), { recursive: true });
  const video = path.join(dir, '게시', '01-ig-fb-mn', 'video.mp4');
  fs.writeFileSync(video, 'video');
  return { bundle: { dir, name, repo, prep: { 브랜드: 'LAB', 슬롯: FROM, ...prep } }, video };
}
const fake = (bundle, video, 결과) => (dir, files) => ({ 꼴: '화면글검사/1', 결과: files.map((f) => ({ 영상: path.relative(bundle.repo, f).split(path.sep).join('/'), 틀: 'm34-mn', 대조: { 비율: 1 }, ...결과 })) });
const codes = (fs_) => fs_.map((f) => `${f.level === FIX ? '고칠' : '확인'}:${f.code}`);

test('새 LAB 편 — 심한 머묾 · 핵심 · 새낱말은 고칠 것, 읽기와 심하지 않은 걸림은 확인할 것, 한 카드의 줄은 한 줄로', (t) => {
  const { bundle, video } = fixture(t);
  const fs_ = screenTextFindings(bundle, [video], { run: fake(bundle, video, { 걸림 }), save: false });
  assert.deepEqual(codes(fs_), ['고칠:screen-text-머묾', '확인:screen-text-머묾', '확인:screen-text-읽기', '고칠:screen-text-핵심', '고칠:screen-text-새낱말']);
  assert.match(fs_[0].message, /카드 「꽃」 · 「цэцэг」가 0\.5초만 있다/);
  assert.match(fs_[0].message, /「화면글판단」 \{"머묾@9\.5": "까닭"\}/);
  assert.match(fs_[4].message, /\{"새낱말": "까닭"\}/);
});

test('「화면글판단」 까닭이 있으면 고칠 것이 확인할 것으로', (t) => {
  const { bundle, video } = fixture(t, { prep: { 화면글판단: { '머묾@9.5': '꽃이 터지는 순간의 장난 글', 새낱말: '복습 편' } } });
  const fs_ = screenTextFindings(bundle, [video], { run: fake(bundle, video, { 걸림 }), save: false });
  const 머묾 = fs_.find((f) => f.code === 'screen-text-머묾' && /꽃/.test(f.message));
  assert.equal(머묾.level, LOOK);
  assert.match(머묾.message, /「화면글판단」: 꽃이 터지는 순간의 장난 글/);
  assert.equal(fs_.find((f) => f.code === 'screen-text-새낱말').level, LOOK);
  assert.equal(fs_.find((f) => f.code === 'screen-text-핵심').level, FIX, '까닭이 없는 항목은 그대로');
});

test(`${FIX_FROM} 앞에 만든 편과 synkbrief는 모두 확인할 것`, (t) => {
  const old = fixture(t, { name: 'LAB_시험_mn_20261121' });
  const a = screenTextFindings(old.bundle, [old.video], { run: fake(old.bundle, old.video, { 걸림 }), save: false });
  assert.equal(a.length, 5, '걸림은 그대로 나온다(한 카드는 한 줄)');
  assert.ok(a.every((f) => f.level === LOOK));
  const sb = fixture(t, { name: 'synkbrief_시험_20261125', prep: { 브랜드: 'synkbrief' } });
  const b = screenTextFindings(sb.bundle, [sb.video], { run: fake(sb.bundle, sb.video, { 걸림 }), save: false });
  assert.equal(b.length, 5);
  assert.ok(b.every((f) => f.level === LOOK));
});

test('관문 밖 — 슬롯이 FROM 앞인 편, 다른 브랜드는 묻지 않는다', (t) => {
  const early = fixture(t, { prep: { 슬롯: '2026-11-20' } });
  let called = false;
  assert.deepEqual(screenTextFindings(early.bundle, [early.video], { run: () => { called = true; return { 결과: [] }; } }), []);
  assert.equal(called, false);
  assert.equal(applies({ prep: { 브랜드: 'PULSE', 슬롯: FROM } }), false);
  assert.equal(applies({ prep: { 브랜드: 'LAB', 슬롯: '2026-11-20', 판: [{ 시각: `${FROM}T21:00:00+09:00` }] } }), true, '판 시각이 FROM 뒤면 든다');
});

test('못 잰 영상과 도구 실패는 확인할 것 한 줄', (t) => {
  const { bundle, video } = fixture(t);
  const a = screenTextFindings(bundle, [video], { run: (dir, files) => ({ 결과: files.map((f) => ({ 영상: path.relative(bundle.repo, f).split(path.sep).join('/'), 못잼: '원본을 다시 그린 그림이 영상과 안 맞는다' })) }), save: false });
  assert.deepEqual(codes(a), ['확인:screen-text-unmeasured']);
  const b = screenTextFindings(bundle, [video], { run: () => { throw new Error('브라우저가 안 붙는다'); }, save: false });
  assert.deepEqual(codes(b), ['확인:screen-text-failed']);
});

test('같은 영상이면 기록(게시/화면글검사.json)을 쓰고 다시 재지 않는다 — 영상이 바뀌면 다시 잰다', (t) => {
  const { bundle, video } = fixture(t);
  let calls = 0;
  const run = (dir, files) => { calls++; return fake(bundle, video, { 걸림: [] })(dir, files); };
  assert.deepEqual(screenTextFindings(bundle, [video], { run }), []);
  assert.deepEqual(screenTextFindings(bundle, [video], { run }), []);
  assert.equal(calls, 1);
  assert.ok(fs.existsSync(path.join(bundle.dir, '게시', '화면글검사.json')));
  fs.writeFileSync(video, 'video v2');
  screenTextFindings(bundle, [video], { run });
  assert.equal(calls, 2);
});

test('못 잰 결과 — 원본과 영상이 다름은 기록해 다시 그리지 않고, 렌더가 멈춘 것은 다음에 다시 잰다', (t) => {
  const { bundle, video } = fixture(t);
  let calls = 0;
  const 못 = (까닭) => (dir, files) => { calls++; return { 결과: files.map((f) => ({ 영상: path.relative(bundle.repo, f).split(path.sep).join('/'), 못잼: 까닭 })) }; };
  screenTextFindings(bundle, [video], { run: 못('렌더하다 멈췄다: 브라우저가 안 붙는다') });
  screenTextFindings(bundle, [video], { run: 못('렌더하다 멈췄다: 브라우저가 안 붙는다') });
  assert.equal(calls, 2, '멈춘 렌더는 다시 잰다');
  screenTextFindings(bundle, [video], { run: 못('원본을 다시 그린 그림이 영상과 안 맞는다') });
  const again = screenTextFindings(bundle, [video], { run: 못('다른 답') });
  assert.equal(calls, 3, '다름은 기록에서 읽는다');
  assert.match(again[0].message, /안 맞는다/);
});

// ── GPT 검수(screen-text-gate-20261123b)가 재현한 꼴 ──
test('GA3 — 재는 사이 영상이 바뀌면 옛 결과를 새 영상의 크기 · 시각으로 남기지 않는다', (t) => {
  const { bundle, video } = fixture(t);
  let calls = 0;
  const run = (dir, files) => { calls++; if (calls === 1) fs.writeFileSync(video, 'video replaced while measuring'); return fake(bundle, video, { 걸림: [] })(dir, files); };
  const first = screenTextFindings(bundle, [video], { run });
  assert.deepEqual(codes(first), ['확인:screen-text-unmeasured'], '재는 사이 바뀐 영상의 결과는 지금 영상에 쓰지 않는다(다시 GA8)');
  screenTextFindings(bundle, [video], { run });
  assert.equal(calls, 2, '바뀐 영상은 다음에 다시 잰다');
});

test('GA4 — 기록을 못 써도 던지지 않고 결과를 낸다', (t) => {
  const { bundle, video } = fixture(t);
  fs.mkdirSync(path.join(bundle.dir, '게시', '화면글검사.json')); // 파일 자리에 폴더 — 쓰기가 실패한다
  const fs_ = screenTextFindings(bundle, [video], { run: fake(bundle, video, { 걸림 }) });
  assert.ok(fs_.some((f) => f.level === FIX && f.code === 'screen-text-핵심'));
  assert.ok(fs_.some((f) => f.level === LOOK && f.code === 'screen-text-cache'), '기록을 못 쓴 것도 알린다(다시 GA5)');
});

test('GA6 — 브랜드나 판의 말이 바뀌면 기록을 다시 쓰지 않고 다시 잰다', (t) => {
  const { bundle, video } = fixture(t, { prep: { 브랜드: 'synkbrief' } });
  let calls = 0;
  const run = (dir, files) => { calls++; return fake(bundle, video, { 걸림: [] })(dir, files); };
  screenTextFindings(bundle, [video], { run });
  bundle.prep = { ...bundle.prep, 브랜드: 'LAB' };
  screenTextFindings(bundle, [video], { run });
  assert.equal(calls, 2);
  bundle.prep = { ...bundle.prep, 판: [{ 파일: 'x.mp4', 언어: 'en' }] };
  screenTextFindings(bundle, [video], { run });
  assert.equal(calls, 3);
});

test('GA7 — 한 줄로 모은 카드는 그 카드의 시각마다 까닭이 있어야 고칠 것이 내려간다', (t) => {
  const 둘 = [
    { 항목: '머묾', 초: 9.5, 끝초: 10, 글: '장식', 잰값: 0.5, 필요: 1.2, 비: 0.42, 심함: true, 설명: '「장식」 0.5초' },
    { 항목: '머묾', 초: 9.6, 끝초: 10.1, 글: '설명 글', 잰값: 0.5, 필요: 1.2, 비: 0.42, 심함: true, 설명: '「설명 글」 0.5초' },
  ];
  const one = fixture(t, { prep: { 화면글판단: { '머묾@9.5': '장식 글' } } });
  const a = screenTextFindings(one.bundle, [one.video], { run: fake(one.bundle, one.video, { 걸림: 둘 }), save: false });
  assert.equal(a[0].level, FIX, '9.6의 설명 글에는 까닭이 없다');
  assert.match(a[0].message, /"머묾@9\.5": "까닭", "머묾@9\.6": "까닭"/);
  const both = fixture(t, { prep: { 화면글판단: { '머묾@9.5': '장식 글', '머묾@9.6': '같은 장난' } } });
  assert.equal(screenTextFindings(both.bundle, [both.video], { run: fake(both.bundle, both.video, { 걸림: 둘 }), save: false })[0].level, LOOK);
});

test('도구가 그 영상의 결과를 빠뜨리면 조용히 넘기지 않고 확인할 것', (t) => {
  const { bundle, video } = fixture(t);
  const fs_ = screenTextFindings(bundle, [video], { run: () => ({ 결과: [] }), save: false });
  assert.deepEqual(codes(fs_), ['확인:screen-text-failed']);
});

test('바뀜은 LAB 새 편에서도 고칠 것이 아니다', (t) => {
  const { bundle, video } = fixture(t);
  const fs_ = screenTextFindings(bundle, [video], { run: fake(bundle, video, { 걸림: [{ 항목: '바뀜', 초: 2, 끝초: 3, 글: '개', 잰값: 0.5, 필요: 0.83, 비: 0.6, 심함: true, 설명: '0.5초 뒤에 또 뜬다' }] }), save: false });
  assert.deepEqual(codes(fs_), ['확인:screen-text-바뀜']);
});

// ── GPT 다시 검수(screen-text-gate-20261123c)가 재현한 꼴 ──
test('다시 GA2 — 심한 줄과 심하지 않은 줄을 모은 카드는 심한 줄의 까닭만으로 내려간다', (t) => {
  const 둘 = [
    { 항목: '머묾', 초: 11, 끝초: 11.7, 글: '앞 글', 잰값: 0.7, 필요: 1.2, 비: 0.58, 심함: true, 설명: '「앞 글」 0.7초' },
    { 항목: '머묾', 초: 11.1, 끝초: 11.84, 글: '뒤 글', 잰값: 0.74, 필요: 1.2, 비: 0.62, 심함: false, 설명: '「뒤 글」 0.74초' },
  ];
  const a = fixture(t);
  const 없음 = screenTextFindings(a.bundle, [a.video], { run: fake(a.bundle, a.video, { 걸림: 둘 }), save: false });
  assert.equal(없음.length, 1);
  assert.equal(없음[0].level, FIX);
  assert.match(없음[0].message, /{"머묾@11": "까닭"}/, '물어보는 열쇠도 심한 줄의 시각만');
  const b = fixture(t, { prep: { 화면글판단: { '머묾@11': '일부러 짧게 둔 장난' } } });
  assert.equal(screenTextFindings(b.bundle, [b.video], { run: fake(b.bundle, b.video, { 걸림: 둘 }), save: false })[0].level, LOOK);
});

test('다시 GA7 — 글 기록 빠짐 · 주입 오류 같은 못잼은 남기지 않고 다음에 다시 잰다', (t) => {
  const { bundle, video } = fixture(t);
  let calls = 0;
  const 못 = (까닭) => (dir, files) => { calls++; return { 결과: files.map((f) => ({ 영상: path.relative(bundle.repo, f).split(path.sep).join('/'), 못잼: 까닭 })) }; };
  for (const 까닭 of ['그린 100장 가운데 12장의 글 기록이 없다(처음 빠진 장 30)', '주입 스크립트가 오류를 냈다(x)', 'Remotion 부품 자리가 없다 — node tools/새편.js로']) {
    screenTextFindings(bundle, [video], { run: 못(까닭) });
  }
  screenTextFindings(bundle, [video], { run: 못('원본에서 화면 글을 하나도 못 읽었다 — 글을 그림 · 영상에 구워 넣은 편이면') });
  screenTextFindings(bundle, [video], { run: 못('다른 답') });
  assert.equal(calls, 4, '앞의 셋은 매번 다시 재고, 글을 하나도 못 읽음은 남긴다');
});

test('다시 GA8 — 크기 · 수정 시각이 같은 바꿔치기도 내용 해시로 가려 다시 잰다', (t) => {
  const { bundle, video } = fixture(t);
  let calls = 0;
  const run = (dir, files) => { calls++; return fake(bundle, video, { 걸림: [] })(dir, files); };
  screenTextFindings(bundle, [video], { run });
  const st = fs.statSync(video);
  fs.writeFileSync(video, 'VIDEO');
  fs.utimesSync(video, st.atime, st.mtime);
  assert.equal(fs.statSync(video).size, st.size);
  screenTextFindings(bundle, [video], { run });
  assert.equal(calls, 2);
});

test('3회차 GA11 — 기록에서 읽은 영상도 다른 영상을 재는 사이 바뀌면 그 결과를 쓰지 않는다', (t) => {
  const { bundle, video } = fixture(t);
  const other = path.join(bundle.dir, '게시', '01-ig-fb-mn', 'other.mp4');
  fs.writeFileSync(other, 'other');
  screenTextFindings(bundle, [video], { run: fake(bundle, video, { 걸림: [] }) }); // video는 기록에 남는다
  const run = (dir, files) => { assert.deepEqual(files, [other]); fs.writeFileSync(video, 'video replaced'); return fake(bundle, video, { 걸림: [] })(dir, files); };
  const fs_ = screenTextFindings(bundle, [video, other], { run });
  assert.ok(fs_.some((f) => f.code === 'screen-text-unmeasured' && /video\.mp4/.test(f.where)));
});

test('설계 6 — 도구가 낸 원본 지문이 재기 전과 다르면(재는 사이 원본을 고침) 기록에 남기지 않는다', (t) => {
  const { bundle, video } = fixture(t);
  let calls = 0;
  const run = (dir, files) => { calls++; return { ...fake(bundle, video, { 걸림: [] })(dir, files), 원본지문: 'changed-while-measuring' }; };
  screenTextFindings(bundle, [video], { run });
  screenTextFindings(bundle, [video], { run });
  assert.equal(calls, 2);
});
