// 캐스팅북 → PULSE 제작 설계: 손님이 보내는 캐스팅북 문의 글(코드 줄 없음, 「진행하고 싶은 모델」)을 담당자 칸이 같은 모델·헤어·목소리로 읽는지(2026-10-19).
// 캐스팅북 원본(roster-v2.json·voices.json)과 앱 목록(casting-catalog.mjs)의 헤어·목소리 순서가 어긋나면 번호가 다른 조합을 가리키므로 함께 본다.
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
const voices = JSON.parse(readFileSync(new URL('voices.json', book), 'utf8'));
const { CASTING_MODELS } = await import('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/casting-catalog.mjs');
const { readCastingCode } = await import('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/casting-view.mjs');

// build-site.cjs와 같은 순서: voices.json에서 그 모델 key로 시작하는 줄을 적힌 순서대로
const bookVoices = (m) => voices.filter((v) => v.name.startsWith(m.key + '-')).map((v) => v.label);
const models = roster.map((m) => ({ ...m, hair: m.hair.map((h) => ({ label: h.label })), voices: bookVoices(m).map((label) => ({ label })) }));
const TAX = { industries: [], moods: [] };
const asApp = (p) => [p.code, ['original', 'look-2', 'look-3'][p.hair], ['A', 'B', 'C'][p.voice]];

test('앱 모델은 모두 캐스팅북에 있고, 헤어 1·2·3과 목소리 1·2·3(A·B·C)이 같은 순서다', () => {
  for (const app of CASTING_MODELS) {
    const m = roster.find((x) => x.code === app.id);
    assert.ok(m, `${app.id}가 캐스팅북 명단에 없다`);
    assert.equal(app.name, m.name);
    assert.deepEqual(app.hairLabels, m.hair.map((h) => h.label), `${app.id} 헤어 순서`);
    assert.deepEqual(app.voices.map((v) => v.label), bookVoices(m), `${app.id} 목소리 순서`);
  }
});

test('손님이 보낸 문의 글을 통째로 붙여 넣으면 담당자 칸이 고른 조합 그대로 읽는다(크몽·발주서 메모)', () => {
  const picks = roster.filter((m) => CASTING_MODELS.some((x) => x.id === m.code)).map((m, i) => ({ code: m.code, hair: i % 3, voice: (i + 1) % 3, memo: '' }));
  for (const format of ['kmong', 'order']) {
    const text = L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX, format });
    assert.doesNotMatch(text, /캐스팅북 코드|\.\d\.\d/, format + ': 손님 글에 코드가 없다');
    const { items, unknown } = readCastingCode(text);
    assert.deepEqual(unknown, []);
    assert.deepEqual(items.map((x) => [x.modelId, x.hair, x.voice]), picks.map(asApp), format);
    for (const [i, x] of items.entries()) {
      const app = CASTING_MODELS.find((m) => m.id === x.modelId);
      assert.equal(app.voices.find((v) => v.id === x.voice).label, models.find((m) => m.code === x.modelId).voices[picks[i].voice].label, '번호가 같은 목소리를 가리킨다');
    }
  }
});

test('손님이 「누구로 진행할까요?」에서 고른 모델이 담당자 칸 맨 위 「손님이 고른 모델」이 된다', () => {
  const picks = [{ code: 'F02', hair: 1, voice: 0, memo: '헤어 3번처럼 짧게', line: '이번 주말, 딸기 라떼 한 잔?' }, { code: 'M02', hair: 2, voice: 2, memo: '' }];
  for (const format of ['kmong', 'order']) {
    const chosen = readCastingCode(L.inquiryText({ picks, models, brief: null, compare: ['F04'], taxonomy: TAX, format, lead: 'M02' }));
    assert.deepEqual(chosen.items.map((x) => [x.code, x.lead]), [['M02.2.2', true], ['F02.1.0', false]], format + ': 고른 모델이 먼저, 메모의 「헤어 3번」·함께 비교한 모델은 조합이 아니다');
    const open = readCastingCode(L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX, format }));
    assert.deepEqual(open.items.map((x) => [x.code, x.lead]), [['F02.1.0', false], ['M02.2.2', false]], format + ': 고르지 않으면 담은 순서 그대로');
  }
});

test('예전 판 문의 글(끝에 캐스팅북 코드 줄)과 공유 주소도 그대로 읽는다', () => {
  const picks = [{ code: 'F02', hair: 1, voice: 0 }, { code: 'F04', hair: 0, voice: 2 }];
  const old = `${L.inquiryText({ picks, models, brief: null, compare: [], taxonomy: TAX })}\n\n캐스팅북 코드: ${L.castingCode(picks).replace(/~/g, ', ')}`;
  assert.deepEqual(readCastingCode(old).items.map((x) => x.code), ['F02.1.0', 'F04.0.2']);
  assert.deepEqual(readCastingCode(`https://synk.example/casting/#p-${L.castingCode(picks)}`).items.map((x) => x.code), ['F02.1.0', 'F04.0.2']);
});

test('캐스팅북에 먼저 들어온 새 모델은 담당자 칸이 짐작하지 않고 따로 알린다', () => {
  const later = roster.filter((m) => !CASTING_MODELS.some((x) => x.id === m.code)).map((m) => m.code);
  const code = L.castingCode([...later, 'F09'].map((c) => ({ code: c, hair: 0, voice: 0 })).concat({ code: 'F02', hair: 1, voice: 0 }));
  const { items, unknown } = readCastingCode(`#p-${code}`);
  assert.deepEqual(unknown, [...later, 'F09']);
  assert.deepEqual(items.map((x) => x.code), ['F02.1.0']);
});
