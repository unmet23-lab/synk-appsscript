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
  assert.deepEqual(L.filterModels(models, { gender: '여', industry: 'food' }).map((m) => m.code), ['F02', 'F04', 'F05'], '소연은 간편식으로, 은정의 「건강기능식품」은 식음료가 아니다');
  assert.deepEqual(L.filterModels(models, { industry: 'sports' }).map((m) => m.code), ['F07']);
  assert.deepEqual(L.filterModels(models, { industry: 'health' }).map((m) => m.code), ['F05', 'F06', 'M05']);
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
  assert.ok(top('가계부 앱').slice(0, 2).includes('F03'), '금융 낱말(가계부)이 맞는 서진이 앞쪽');
  assert.ok(!top('딸기 라떼 신메뉴').includes('M02'), '라떼에 위스키·주류 모델을 올리지 않는다');
  assert.deepEqual(top('남성 향수'), ['M01', 'M02'], '설명에 남성이 있으면 남자 모델만');
  assert.ok(top('여성 니트').every((c) => c.startsWith('F')));
  const it = L.recommend(models, { product: 'IT 솔루션 소개 영상' }, T, 1)[0];
  assert.equal(it.model.code, 'F03');
  assert.equal(new Set(it.reasons.map((r) => r.text)).size, it.reasons.length, '같은 이유를 두 번 쓰지 않는다');
});

test('브리프 추천: 1차 확장 업종(건강식품·생활/주방·육아·가전/인테리어·스포츠/다이어트)을 새 모델이 받는다', () => {
  const T = { ...TAX, genderWords: catalog.genderWords };
  const top = (product) => L.recommend(models, { product }, T, 3).map((r) => r.model.code);
  assert.equal(top('단백질 쉐이크')[0], 'F07');
  assert.equal(top('여성 레깅스')[0], 'F07', '운동복 낱말은 스포츠로, 성별 낱말 안에서');
  assert.deepEqual(top('유산균 영양제').sort(), ['F05', 'F06', 'M05']);
  assert.ok(top('아기 기저귀').every((c) => ['F05', 'M05'].includes(c)), '육아는 소연·준호만(아이 없이 찍는 두 사람)');
  assert.ok(top('주름 개선 크림').includes('F06'), '안티에이징 세부 분야에 은정');
  assert.ok(!top('편의점 도시락').includes('F06'), '건강기능식품 문구가 식음료로 새지 않는다');
  assert.equal(top('남성 면도기')[0], 'M05', '그루밍 세부 분야는 면도 장면이 있는 준호가 맨 위');
  assert.equal(top('캠핑 의자')[0], 'M05', '캠핑·아웃도어 둘 다 맞는 준호가 맨 위');
  assert.ok(top('캠핑 의자').includes('F07'), '아웃도어 채원');
  assert.deepEqual(top('패밀리 SUV'), ['M05'], '패밀리 세부 분야는 패밀리 자동차 문구가 있는 준호만');
  assert.equal(top('선크림')[0], 'F07', '선케어 문구가 있는 채원이 스킨케어 모델보다 위');
  assert.ok(!top('공기청정기').includes('F05') && top('소파').join() === 'F05', '가전·인테리어를 세부 분야로 가른다(Fable 10-21 P2)');
  assert.ok(!top('주방 세제').slice(0, 1).includes('F06'), '세제는 생활 분야 — 주방 가전 은정이 맨 위로 오지 않는다');
  for (const w of ['아웃도어', '글램핑', '트레킹', '미니밴']) assert.ok(top(w).length, `${w}는 혼자 적어도 업종이 잡힌다`);
  // 한 낱말이 세부 분야 여럿에 들어 있어도(커피 → 음료·카페) 같은 근거를 두 번 세지 않는다(10-21 아르곤 P1)
  const both = { code: 'X1', name: '둘', gender: '여', ageBand: '20대', concept: '상큼', impression: [], fits: ['음료·카페'], hair: [], voices: [], sizes: {} };
  const one = { ...both, code: 'X2', name: '하나', fits: ['음료'] };
  for (const m of [both, one]) Object.assign(m, L.tagModel(m, T));
  const sc = L.recommend([both, one], { product: '커피' }, T, 2).map((r) => r.score);
  assert.equal(sc[0], sc[1], '음료·카페 둘 다 맞아도 커피 한 낱말은 한 번');
  assert.ok(top('공기청정기').every((c) => ['F05', 'M04', 'F06', 'M05'].includes(c)), '가전은 1차 생활형·리얼 모델');
  // 소연 업종 문구의 「카페」(10-21 유호님): 커피·카페 설명에서 소연도 나오고, 카페 라이프스타일 이안보다 앞서지는 않는다
  const all = (product) => L.recommend(models, { product }, T, models.length).map((r) => r.model.code);
  for (const w of ['카페 커피', '캔커피', '콜드브루', '동네 카페 홍보']) assert.ok(all(w).includes('F05'), `${w}에 소연`);
  assert.deepEqual(all('카페 커피').slice(0, 2), ['M01', 'F05']);
  assert.ok(!all('맥주').includes('F05') && !all('생수').includes('F05'), '카페 문구가 주류·음료 전체로 새지 않는다');
  // 한 줄 캐릭터·맡는 역할·피할 것은 1기 일곱 명까지 모두(10-22 유호님), 한 줄은 서로 겹치지 않는다
  for (const m of models) assert.ok(m.tagline && (m.roles || []).length && (m.avoid || []).length, `${m.code} 한 줄 캐릭터·역할·피할 것`);
  assert.equal(new Set(models.map((m) => m.tagline)).size, models.length, '한 줄 캐릭터가 겹치지 않는다');
  // 유호 인상 「힙한 · 4차원」(10-23 유호님): 분위기는 개성·힙만 — 지적·친근 설명에서는 빠지고 「4차원」 설명에서는 앞선다
  assert.deepEqual(byCode('M03').moods, ['unique']);
  assert.ok(!all('지적인 금융 앱 광고').includes('M03') && !all('친근하고 편안한 일상 브이로그').includes('M03'));
  assert.equal(all('4차원 캐릭터 광고')[0], 'M03');
  assert.equal(all('사차원 캐릭터 광고')[0], 'M03', '한글로 적은 「사차원」도 알아듣는다');
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
  assert.deepEqual([r.min, r.max, r.count, r.lowest], [160, 170, 7, false], '1차 확장 뒤 여자 일곱 명 가운데 하린은 가장 작지 않다');
  const e = L.rankAmong(models, byCode('F06'), (m) => m.height);
  assert.deepEqual([e.min, e.count, e.lowest], [160, 7, true], '은정 160cm가 가장 작다');
  assert.equal(L.josa('하린', '을', '를'), '을');
  assert.equal(L.josa('유나', '을', '를'), '를');
  assert.equal(L.josa('M03', '을', '를'), '을(를)');
});

test('명단의 모든 모델에 명세서(몸 비율·색)와 얼굴 기준·연출이 있다', () => {
  const fs = require('node:fs');
  const specDir = path.join(dir, '명세서');
  const specs = fs.readdirSync(specDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(specDir, f), 'utf8')));
  for (const m of roster) {
    const s = specs.find((x) => x['코드'] === m.code);
    // 하린 명세서(F02_하린.json)는 LoRA 작업이 따로 관리해 아직 git 밖일 수 있다. 나머지 여섯은 이 캐스팅북이 만든다
    if (!s && m.code === 'F02') continue;
    assert.ok(s, `${m.code} 명세서`);
    const body = s['몸']['측정_전신기준'];
    for (const k of ['등신_머리카락포함', '어깨_얼굴폭_비', '다리비율_골반관절에서바닥']) assert.equal(typeof body[k], 'number', `${m.code} ${k}`);
    for (const k of ['머리', '피부', '입술']) assert.match(s['색'][k], /^#[0-9A-F]{6}$/, `${m.code} ${k}`);
    const extra = catalog.models[m.code];
    assert.ok(extra.face && extra.face.length >= 3, `${m.code} 얼굴 기준`);
    assert.ok(extra.direction && extra.direction.fit.length, `${m.code} 연출`);
    assert.ok(!extra.body, `${m.code} 몸 비율은 명세서 한 곳에만`);
  }
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

test('문의 글: 손님 글에는 코드 줄이 없고, 「누구로 진행할까요?」에서 고른 모델이 맨 위', () => {
  const picks = [{ code: 'F02', hair: 1, voice: 0, memo: '' }, { code: 'F04', hair: 0, voice: 2, memo: '' }];
  assert.equal(L.castingCode(picks), 'F02.1.0~F04.0.2', '공유 주소용 코드는 그대로');
  const kmong = L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX, format: 'kmong', lead: 'F04' });
  assert.doesNotMatch(kmong, /캐스팅북 코드|F02\.1\.0/, '손님이 보는 글에 기계 글이 없다');
  assert.match(kmong, /\[진행하고 싶은 모델\]\n1\. F04 지유[^\n]*\n   헤어 1번 [^\n]*\/ 목소리 3번 [^\n]*\n\n\[함께 고민 중인 모델\]\n2\. F02 하린/);
  assert.match(kmong, /상담에서 함께 정하고 싶은 것: 사용 매체와 기간/, '고른 모델이 있으면 「진행할 모델」은 상담 거리가 아니다');
  const open = L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX, format: 'kmong' });
  assert.match(open, /\[고른 모델\]\n1\. F02 하린[\s\S]*\n2\. F04 지유/);
  assert.match(open, /상담에서 함께 정하고 싶은 것: 진행할 모델, 사용 매체와 기간/, '여럿을 담고 고르지 않았으면 상담에서 정한다');
  const one = L.inquiryText({ picks: picks.slice(0, 1), models, brief: null, compare: [], taxonomy: TAX, format: 'kmong' });
  assert.doesNotMatch(one, /진행할 모델,/, '한 명만 담았으면 상담 거리에 넣지 않는다');
  const order = L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX, format: 'order', lead: 'F04' });
  assert.deepEqual(order.split('\n').filter((x) => x.startsWith('[')), ['[진행할 모델] F04 지유 (여 · 20대 초반 · 상큼 · 166cm)', '[함께 고민 중인 모델] F02 하린 (여 · 20대 초반 · 상큼 · 165cm)']);
  const orderOpen = L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX, format: 'order' });
  assert.equal(orderOpen.split('\n').at(-1), '[상담] 진행할 모델은 상담에서 정하고 싶어요');
  assert.match(L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX, lead: 'M01' }), /\[고른 모델\]/, '담지 않은 모델을 고르면 고르지 않은 것과 같다');
  assert.equal(L.castingCode([{ code: 'F02', hair: '2', voice: undefined }, { code: '<x>', hair: 0, voice: 0 }, null]), 'F02.2.0');
});

test('문의 글: 들어 보고 싶은 문장이 모델마다 들어간다', () => {
  const picks = [{ code: 'M02', hair: 0, voice: 0, memo: '', line: '오늘 밤,\n한 잔의 깊이를' }];
  const kmong = L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX, format: 'kmong' });
  assert.match(kmong, /   이 목소리로 들어 보고 싶은 문장: “오늘 밤, 한 잔의 깊이를”/);
  const order = L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX, format: 'order' });
  assert.match(order, /\n대사: 오늘 밤, 한 잔의 깊이를/);
  const none = L.inquiryText({ picks: [{ code: 'M02', hair: 0, voice: 0, memo: '' }], models, brief: null, compare: [], taxonomy: TAX });
  assert.doesNotMatch(none, /문장/);
});

test('움직이는 사진: 명단의 모든 모델이 loop/<코드>.mp4를 가리킨다', () => {
  for (const m of roster) assert.equal((catalog.models[m.code].loop || {}).src, `loop/${m.code}.mp4`, m.code);
});

// 10-22 모델은 사진만(유호님 「모델별 이런 참고영상은 지금 전부 기각」): 모델 북에 「움직임」 탭과 하린 5초 샘플을 두지 않는다.
// 보드에서 도는 움직이는 사진(루프)은 10-22 공개 때 「루프는 지금 판 그대로」라 남긴다.
test('모델 북은 사진만: 움직임 탭도, 모델별 참고 영상 자료도 없다', () => {
  const fs = require('node:fs');
  for (const m of roster) assert.equal('motion' in catalog.models[m.code], false, `${m.code}에 motion 자료가 없다`);
  const app = fs.readFileSync(path.join(dir, 'site-src', 'app.js'), 'utf8'), build = fs.readFileSync(path.join(dir, 'build-site.cjs'), 'utf8');
  assert.doesNotMatch(app, /\['motion', '움직임'|tab === 'motion'|m\.motion/);
  assert.match(app, /if \(!tabs\.some\(\(\[k\]\) => k === tab\)\) tab = 'book';/, '옛 #m-…-motion 주소는 북 탭으로 연다');
  assert.doesNotMatch(build, /extra\.motion|F02-(?:ad|runway)-motion/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'site-src', 'style.css'), 'utf8'), /\.motions/);
});

test('문장 듣기 서버: 타입캐스트 목소리만 받고, 길이·빈 문장·없는 목소리를 막는다(타입캐스트는 부르지 않는다)', async () => {
  const say = require(path.join(dir, 'say-server.cjs'));
  const table = say.voiceTable();
  assert.deepEqual(Object.keys(table).sort(), ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'M01', 'M02', 'M04', 'M05'], '유호(실제 목소리) 말고 열한 명이 타입캐스트 목소리');
  assert.deepEqual(Object.keys(table.M02), ['0', '1', '2']);
  assert.ok(!JSON.stringify(table).includes('Gemini'));
  assert.equal(say.clean(' 안녕\n하세요<b>\u0007 '), '안녕 하세요 b');
  await new Promise((ok) => say.server.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${say.server.address().port}/api/say`;
  const post = async (body) => { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return [r.status, (await r.json()).message]; };
  try {
    assert.equal((await post({ model: 'M03', voice: 0, text: '안녕하세요' }))[0], 404, '유호는 실제 목소리라 만들지 않는다');
    assert.equal((await post({ model: 'M02', voice: 0, text: '가'.repeat(say.LIMIT.chars + 1) }))[0], 400);
    assert.equal((await post({ model: 'M02', voice: 0, text: '   ' }))[0], 400);
    assert.equal((await fetch(url)).status, 405);
  } finally { await new Promise((ok) => say.server.close(ok)); }
});
