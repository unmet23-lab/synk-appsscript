// PULSE 모델 고르기(캐스팅북)의 판단 함수 시험: 분류·거르기·브리프 추천·문의 글
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'docs', '마케팅', 'PULSE_AI모델_캐스팅_20260930');
const L = require(path.join(dir, 'site-src', 'casting-logic.js'));
const catalog = require(path.join(dir, 'catalog.json'));
const { models: roster } = require(path.join(dir, 'roster-v2.json'));

const TAX = { industries: catalog.industries, moods: catalog.moods };
// 화면이 받는 모양과 같게: 명단 + 분류 + (있으면) 업종이 붙은 사진
const models = roster.map((m) => {
  const extra = catalog.models[m.code] || {};
  const tagged = Object.entries(extra.shotTags || {}).map(([k, tags]) => ({ ref: `shot:${k}`, label: k, tags }));
  for (const s of (extra.scenes || {}).items || []) tagged.unshift({ ref: `scene:${s.id}`, label: s.place, tags: s.tags });
  const pub = { ...m, hair: m.hair.map((h) => ({ label: h.label })), voices: [{ label: '하나' }, { label: '둘' }, { label: '셋' }], tagged };
  return Object.assign(pub, L.tagModel(pub, TAX));
});
const byCode = (c) => models.find((m) => m.code === c);

test('명단의 업종 문구와 인상이 분류 id로 바뀐다', () => {
  assert.deepEqual(byCode('F02').industries, ['food', 'beauty', 'fashion', 'tech']);
  assert.deepEqual(byCode('F02').moods, ['fresh', 'friendly']);
  assert.ok(byCode('F03').industries.includes('finance'), 'IT·B2B는 금융·기업에도 든다');
  assert.ok(byCode('M02').industries.includes('auto'));
  for (const m of models) assert.ok(m.industries.length && m.moods.length, `${m.code}는 업종·분위기가 하나 이상`);
});

test('제품 설명의 낱말은 긴 낱말부터 찾고 영문은 낱말 경계에서만 찾는다', () => {
  const entries = catalog.industries.flatMap((i) => i.words.map((word) => ({ word, id: i.id })));
  const ids = (t) => [...new Set(L.findWords(t, entries).map((e) => e.id))].sort();
  assert.deepEqual(ids('딸기 아이스크림'), ['food'], '아이스크림 안의 크림은 뷰티로 잡지 않는다');
  assert.deepEqual(ids('수분 크림'), ['beauty']);
  assert.deepEqual(ids('OUTFIT 브랜드'), [], 'OUTFIT의 IT는 테크가 아니다');
  assert.deepEqual(ids('신규 IT 솔루션'), ['finance', 'tech']);
  assert.deepEqual(ids('기술 블로그'), [], '기술의 술을 주류로 잡지 않는다');
});

test('거르기는 고른 조건만 보고, 업종·키 구간도 거른다', () => {
  assert.equal(L.filterModels(models, { gender: '전체', age: '전체', concept: '전체', height: '전체', industry: '' }).length, models.length);
  assert.deepEqual(L.filterModels(models, { gender: '여', industry: 'food' }).map((m) => m.code), ['F02', 'F04']);
  assert.deepEqual(L.filterModels(models, { height: '180cm대' }).map((m) => m.code).sort(), ['M01', 'M02', 'M03']);
  assert.equal(L.heightBand(165), '160cm대');
  assert.equal(L.heightBand(null), '');
});

test('브리프 추천: 업종·분위기가 겹치는 모델이 위로, 이유와 근거 사진이 붙는다', () => {
  const recs = L.recommend(models, { industry: 'food', product: '딸기 라떼 신메뉴', moods: ['fresh'] }, TAX, 3);
  assert.equal(recs[0].model.code, 'F02');
  assert.ok(recs[0].strong);
  assert.ok(recs[0].reasons.some((r) => r.kind === 'industry' && r.text.includes('음료·디저트')));
  assert.ok(recs[0].evidence && recs[0].evidence.ref.startsWith('scene:'), '장면 사진이 근거로 먼저 나온다');
  assert.deepEqual(recs.map((r) => r.model.code).slice(0, 2).sort(), ['F02', 'F04']);
});

test('브리프 추천: 제품 설명의 세부 분야와 성별 낱말', () => {
  const T = { ...TAX, genderWords: catalog.genderWords };
  const top = (product) => L.recommend(models, { product }, T, 3).map((r) => r.model.code);
  assert.equal(top('딸기 아이스크림')[0], 'F02', '디저트까지 맞는 하린이 맨 위');
  assert.ok(!top('딸기 아이스크림').includes('M02'), '위스키·주류 모델은 디저트 광고에 올리지 않는다');
  assert.equal(top('프리미엄 위스키')[0], 'M02');
  assert.equal(top('가계부 앱')[0], 'F03', '금융 낱말(가계부)과 앱이 겹치는 서진');
  assert.deepEqual(top('남성 향수'), ['M01', 'M02'], '설명에 남성이 있으면 남자 모델만');
  assert.ok(top('여성 니트').every((c) => c.startsWith('F')));
  const it = L.recommend(models, { product: 'IT 솔루션 소개 영상' }, T, 1)[0];
  assert.equal(it.model.code, 'F03');
  assert.equal(new Set(it.reasons.map((r) => r.text)).size, it.reasons.length, '같은 이유를 두 번 쓰지 않는다');
});

test('브리프 추천: 성별 조건과 빈 브리프', () => {
  const men = L.recommend(models, { industry: 'fragrance', gender: '남' }, TAX, 3);
  assert.ok(men.length && men.every((r) => r.model.gender === '남'));
  assert.equal(men[0].model.code, 'M01', '같은 점수면 명단 순서');
  assert.deepEqual(L.recommend(models, { industry: '', product: '  ', moods: [] }, TAX), []);
  assert.deepEqual(L.recommend(models, { industry: 'auto', gender: '여' }, TAX), [], '맞는 모델이 없으면 빈 목록');
});

test('정보가 일부만 있는 새 모델도 거르기·추천·문의 글에서 깨지지 않는다', () => {
  const partial = { code: 'F10', name: '새봄', gender: '여', ageBand: '10대', concept: '상큼', impression: ['상큼한'], fits: ['음료'], hair: [{ label: '기본' }], voices: [], sizes: {} };
  Object.assign(partial, L.tagModel(partial, TAX));
  const list = [...models, partial];
  assert.deepEqual(L.filterModels(list, { age: '10대' }).map((m) => m.code), ['F10']);
  const recs = L.recommend(list, { industry: 'food', moods: ['fresh'], age: '10대' }, TAX);
  assert.equal(recs[0].model.code, 'F10');
  assert.equal(recs[0].evidence, null, '사진이 없으면 근거 사진 없이 추천한다');
  const text = L.inquiryText({ picks: [{ code: 'F10', hair: 0, voice: 0, memo: '' }], models: list, brief: null, compare: [], taxonomy: TAX });
  assert.match(text, /F10 새봄 \(여 · 10대 · 상큼\)/);
  assert.match(text, /헤어 1번 기본/);
  assert.doesNotMatch(text, /목소리/, '목소리가 없으면 줄을 쓰지 않는다');
  assert.equal(L.rankAmong(list, partial, (m) => m.height), null, '키가 없으면 순위를 내지 않는다');
});

test('문의 글: 고른 모델·헤어·목소리·메모, 손댄 브리프만, 함께 비교한 모델', () => {
  const picks = [{ code: 'F02', hair: 1, voice: 0, memo: '헤어는 조금\n더 밝게' }];
  const brief = { industry: 'food', product: '딸기 라떼', moods: ['fresh'], touched: true };
  const kmong = L.inquiryText({ picks, models, brief, compare: ['F02', 'F04'], taxonomy: TAX, format: 'kmong' });
  assert.match(kmong, /1\. F02 하린 \(여 · 20대 초반 · 상큼 · 165cm\)/);
  assert.match(kmong, /헤어 2번 하이 포니테일 \/ 목소리 1번 하나/);
  assert.match(kmong, /메모: 헤어는 조금 더 밝게/);
  assert.match(kmong, /\[함께 비교한 모델\] F04 지유/);
  assert.match(kmong, /업종: 식음료\n제품·서비스: 딸기 라떼\n분위기: 상큼·발랄/);
  const untouched = L.inquiryText({ picks, models, brief: { ...brief, touched: false }, compare: [], taxonomy: TAX });
  assert.doesNotMatch(untouched, /광고 내용/, '예시 브리프는 글에 넣지 않는다');
  const onlyCompare = L.inquiryText({ picks: [], models, brief: null, compare: ['M01', 'M03'], taxonomy: TAX });
  assert.doesNotMatch(onlyCompare, /\n\n\n/, '덩어리 사이 빈 줄은 하나');
  assert.match(onlyCompare, /\[함께 비교한 모델\] M01 이안, M03 유호/);
  const order = L.inquiryText({ picks, models, brief, compare: [], taxonomy: TAX, format: 'order' });
  assert.equal(order.split('\n')[0], '[모델 1] F02 하린 (여 · 20대 초반 · 상큼 · 165cm)');
  assert.match(order, /\[광고\] 식음료 · 딸기 라떼 · 상큼·발랄/);
});

test('같은 성별 안에서의 위치와 조사', () => {
  const r = L.rankAmong(models, byCode('F02'), (m) => m.height);
  assert.deepEqual([r.min, r.max, r.count, r.lowest], [165, 170, 4, true]);
  assert.equal(L.josa('하린', '을', '를'), '을');
  assert.equal(L.josa('유나', '을', '를'), '를');
  assert.equal(L.josa('M03', '을', '를'), '을(를)');
});

test('설정 파일: 분류 id가 겹치지 않고, 모델별 자료가 명단과 분류를 가리킨다', () => {
  const ids = catalog.industries.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(catalog.moods.map((m) => m.id)).size, catalog.moods.length);
  for (const [code, extra] of Object.entries(catalog.models)) {
    assert.ok(byCode(code), `${code}는 명단에 있다`);
    for (const tags of Object.values(extra.shotTags || {})) for (const t of tags) assert.ok(ids.includes(t), `${code} ${t}`);
    for (const s of (extra.scenes || {}).items || []) for (const t of s.tags) assert.ok(ids.includes(t), `${code} ${s.id} ${t}`);
  }
  const text = JSON.stringify(catalog);
  for (const banned of ['Gemini', 'Nano Banana', 'Higgsfield', 'LoRA', 'pls_f0']) {
    // 화면에 나가는 칸(label·place·text·note)에는 도구 이름이 없어야 한다. 원본 경로(dir·src)는 화면에 나가지 않는다
    const visible = text.replace(/"(dir|src)":"[^"]*"/g, '');
    assert.ok(!visible.includes(banned), banned);
  }
});
