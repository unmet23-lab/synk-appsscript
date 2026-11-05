// 캐스팅북 → PULSE 제작 설계: 손님이 보내는 캐스팅북 문의 글(코드 줄 없음, 「진행하고 싶은 모델」)을 담당자 칸이 같은 모델·헤어로 읽는지(2026-10-19).
// 캐스팅북 원본(roster-v2.json)과 앱 목록(casting-catalog.mjs)의 헤어 순서가 어긋나면 번호가 다른 조합을 가리키므로 함께 본다.
// 11-03 유호님 「둘 다 전부 빼기」로 캐스팅북 견본 목소리를 뺐다 — 문의 글 · 공유 주소에 목소리 번호가 없으니(셋째 자리는 늘 0) 목소리는 맞춰 보지 않는다.
// 앱 쪽 시험: docs/마케팅/온라인마케팅지도/engagement/company/pulse-casting-code.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const book = new URL('../docs/마케팅/PULSE_AI모델_캐스팅_20260930/', import.meta.url);
const L = require(fileURLToPath(new URL('site-src/casting-logic.js', book)));
const { models: roster } = JSON.parse(readFileSync(new URL('roster-v2.json', book), 'utf8'));
const { CASTING_MODELS } = await import('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/casting-catalog.mjs');
const { readCastingCode } = await import('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/casting-view.mjs');

// build-site.cjs가 화면에 보내는 꼴(11-03부터 voices 없음)
const models = roster.map((m) => ({ ...m, hair: m.hair.map((h) => ({ label: h.label })) }));
const TAX = { industries: [], moods: [] };
const HAIR = ['original', 'look-2', 'look-3'];
const picked = (items) => items.map((x) => [x.modelId, x.hair]);

test('앱 모델은 모두 캐스팅북에 있고, 헤어 1·2·3이 같은 순서다', () => {
  for (const app of CASTING_MODELS) {
    const m = roster.find((x) => x.code === app.id);
    assert.ok(m, `${app.id}가 캐스팅북 명단에 없다`);
    assert.equal(app.name, m.name);
    assert.deepEqual(app.hairLabels, m.hair.map((h) => h.label), `${app.id} 헤어 순서`);
    assert.equal('voices' in app, false, `${app.id}: 고객 앱도 11-03부터 목소리 없이 사진 모델로 고른다`);
  }
});

test('손님이 보낸 문의 글을 통째로 붙여 넣으면 담당자 칸이 고른 모델 · 헤어 그대로 읽는다(크몽·발주서 메모)', () => {
  // 전 판에 저장된 목소리 번호(voice)가 남아 있어도 글에는 목소리 줄이 없다
  const picks = roster.filter((m) => CASTING_MODELS.some((x) => x.id === m.code)).map((m, i) => ({ code: m.code, hair: i % 3, voice: (i + 1) % 3, memo: '' }));
  for (const format of ['kmong', 'order']) {
    const text = L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX, format });
    assert.doesNotMatch(text, /캐스팅북 코드|\.\d\.\d/, format + ': 손님 글에 코드가 없다');
    assert.doesNotMatch(text, /목소리/, format + ': 11-03부터 목소리 줄이 없다');
    const { items, unknown } = readCastingCode(text);
    assert.deepEqual(unknown, []);
    assert.deepEqual(picked(items), picks.map((p) => [p.code, HAIR[p.hair]]), format);
  }
});

test('손님이 「누구로 진행할까요?」에서 고른 모델이 담당자 칸 맨 위 「손님이 고른 모델」이 된다', () => {
  const picks = [{ code: 'F02', hair: 1, memo: '헤어 3번처럼 짧게' }, { code: 'M02', hair: 2, memo: '' }];
  for (const format of ['kmong', 'order']) {
    const chosen = readCastingCode(L.inquiryText({ picks, models, brief: null, compare: ['F04'], taxonomy: TAX, format, lead: 'M02' }));
    assert.deepEqual(chosen.items.map((x) => [x.modelId, x.hair, x.lead]), [['M02', 'look-3', true], ['F02', 'look-2', false]], format + ': 고른 모델이 먼저, 메모의 「헤어 3번」·함께 비교한 모델은 조합이 아니다');
    const open = readCastingCode(L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX, format }));
    assert.deepEqual(open.items.map((x) => [x.modelId, x.hair, x.lead]), [['F02', 'look-2', false], ['M02', 'look-3', false]], format + ': 고르지 않으면 담은 순서 그대로');
  }
});

test('예전 판 문의 글(끝에 캐스팅북 코드 줄)과 공유 주소도 모델 · 헤어를 그대로 읽는다', () => {
  const picks = [{ code: 'F02', hair: 1 }, { code: 'F04', hair: 0 }];
  assert.equal(L.castingCode(picks), 'F02.1.0~F04.0.0', '셋째 자리(옛 목소리 번호)는 늘 0');
  const old = `${L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX })}\n\n캐스팅북 코드: ${L.castingCode(picks).replace(/~/g, ', ')}`;
  assert.deepEqual(picked(readCastingCode(old).items), [['F02', 'look-2'], ['F04', 'original']]);
  assert.deepEqual(picked(readCastingCode(`https://synk.example/casting/#p-${L.castingCode(picks)}`).items), [['F02', 'look-2'], ['F04', 'original']]);
  // 11-03 전에 퍼진 공유 주소(셋째 자리에 목소리 번호)도 모델 · 헤어는 같게 읽는다
  assert.deepEqual(picked(readCastingCode('#p-F02.1.0~F04.0.2').items), [['F02', 'look-2'], ['F04', 'original']]);
});

test('캐스팅북에 먼저 들어온 새 모델은 담당자 칸이 짐작하지 않고 따로 알린다', () => {
  const later = roster.filter((m) => !CASTING_MODELS.some((x) => x.id === m.code)).map((m) => m.code);
  // F99: 캐스팅북에도 없는 코드(11-02 F09 로하가 캐스팅북에 들어와 예를 바꿨다)
  const code = L.castingCode([...later, 'F99'].map((c) => ({ code: c, hair: 0 })).concat({ code: 'F02', hair: 1 }));
  const { items, unknown } = readCastingCode(`#p-${code}`);
  assert.deepEqual(unknown, [...later, 'F99']);
  assert.deepEqual(picked(items), [['F02', 'look-2']]);
});

// 11-02 PULSE 고객 검토: 캐스팅북은 13명인데 고객 앱 모델 고르기는 7명이라, 뒤 여섯 명을 고른 고객이 자기 프로젝트에서 그 모델을 못 골랐다.
// 캐스팅북을 먼저 올리는 흐름은 막지 않되, 앱에 아직 없는 모델은 아래 목록에 이름을 적어야 통과한다 — 앱에 넣으면 지운다.
// 11-02 아이돌 두 팀(OFALIN F08~F11 · OUTBLUE M07~M10)은 캐스팅북에 먼저 넣고 고객 앱에는 다음 판에 넣는다.
// 11-03 두 팀 여덟 명을 고객 앱에도 넣어 지금 대기는 없다.
const APP_PENDING = new Set([]);
const { models: bookShots } = JSON.parse(readFileSync(new URL('catalog.json', book), 'utf8'));
test('캐스팅북 명단의 모델은 「앱 대기」로 적은 것 말고는 모두 앱에도 같은 차례 · 인상 · 사진 이름으로 있다', () => {
  assert.deepEqual(CASTING_MODELS.map((m) => m.id), roster.map((m) => m.code).filter((code) => !APP_PENDING.has(code)), '앱 모델 고르기와 캐스팅북 명단의 차례');
  for (const code of APP_PENDING) assert.ok(roster.some((m) => m.code === code), `${code}는 캐스팅북에 없는데 앱 대기에 적혀 있다`);
  for (const m of roster.filter((x) => !APP_PENDING.has(x.code))) {
    const app = CASTING_MODELS.find((x) => x.id === m.code);
    assert.ok(app.description.startsWith(m.impression.join(' · ')), `${m.code} 인상: ${app.description}`);
    assert.deepEqual(app.photos.map((p) => p.label), ['전신', ...m.looks.map((l) => l.label), bookShots[m.code].shotLabels.context], `${m.code} 사진 이름`);
    assert.equal(app.image, `./assets/casting/${m.code.toLowerCase()}.webp`);
    assert.equal(app.gender, m.gender, `${m.code} 성별(의상 선택지를 가른다)`);
  }
});
