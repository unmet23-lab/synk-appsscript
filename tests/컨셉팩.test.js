'use strict';
// 컨셉 팩(docs/마케팅/제작양식/영상양식/컨셉팩/<컨셉>.json)의 꼴을 지킨다(2026-11-24).
// 왜: 팩은 그 컨셉 편의 영상 기준과 첫 컷 질문에 그대로 들어간다(tools/영상기준.js). 근거 없는 줄, 이름이 겹치는 줄,
//   점검표에 없는 번호, 불어난 팩은 「같은 실수를 막는 기억」이 아니라 안 읽히는 규칙이 된다(영상작업_진단_20261110.md).
//   설계: docs/마케팅/제작양식/영상양식/컨셉팩_설계_20261124.md
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const 뿌리 = path.join(__dirname, '..');
const 팩폴더 = path.join(뿌리, 'docs/마케팅/제작양식/영상양식/컨셉팩');
const 점검표 = fs.readFileSync(path.join(뿌리, 'docs/마케팅/제작양식/광고영상_슬롭점검표.md'), 'utf8');
const 번호들 = new Set([...점검표.matchAll(/^\|\s*(\d+)\s*\|/gm)].map(m => Number(m[1])));
const 감독칸 = { 미술감독: '미술', 작가: '작가', 캐스팅디렉터: '캐스팅', 촬영감독: '촬영', 음향감독: '음향', 편집감독: '편집' };
const 아홉 = ['코믹', 'B급', '멜로', '감동', '비주얼', '스펙터클', '스릴러', '뮤직', '홍보'];
const 띠 = ['기', '승', '전', '결'];
const 갈래 = ['희', '노', '애', '락', '긴장'];   // 컷연속성검사.py 감정갈래와 같다
const 앵글낱말 = {   // 컷연속성검사.py 앵글낱말과 같다
  크기: ['극접', '클로즈', '가슴 위', '허리 위', '무릎 위', '전신', '넓게'],
  높이: ['로우', '눈높이', '하이', '위에서'],
  방향: ['정면', '비스듬히', '옆', '뒤', '어깨 너머', '시점', '물건 너머'],
};
const 팩들 = fs.readdirSync(팩폴더).filter(f => f.endsWith('.json'));

test('팩 폴더에 팩이 있고, 이름은 컨셉 아홉 가운데 하나다', () => {
  assert.ok(팩들.length >= 1);
  for (const f of 팩들) assert.ok(아홉.includes(f.replace(/\.json$/, '')), `${f}: 컨셉 아홉에 없는 이름 — 컨셉조사_20261124.md에 먼저 더한다`);
});

for (const f of 팩들) {
  test(`${f} — 감독 일곱 칸 · 줄마다 이름과 근거 · 점검표 번호 · 6,000자`, () => {
    const 글 = fs.readFileSync(path.join(팩폴더, f), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(글.length <= 6000, `${f}가 ${글.length}자다 — 줄을 더하지 말고 같은 칸의 줄을 고치거나 합친다`);
    const 팩 = JSON.parse(글);
    const 컨셉 = f.replace(/\.json$/, '');
    assert.equal(팩.컨셉, 컨셉);
    assert.equal(typeof 팩.컨셉감독, 'object');
    assert.ok(String(팩.컨셉감독.무엇으로이기나 || '').trim(), '컨셉감독.무엇으로이기나가 비었다');
    const 이름 = new Set();
    for (const [칸, 줄임] of Object.entries(감독칸)) {
      assert.ok(Array.isArray(팩[칸]), `「${칸}」 칸이 없다 — 줄이 없으면 빈 목록으로 둔다`);
      for (const 줄 of 팩[칸]) {
        assert.match(줄.번, new RegExp(`^${컨셉}-${줄임}-[0-9]+$`), `「${칸}」 줄 이름은 ${컨셉}-${줄임}-<번호>다: ${줄.번}`);
        assert.ok(!이름.has(줄.번), `줄 이름이 겹친다: ${줄.번}`); 이름.add(줄.번);
        assert.ok(String(줄.기준 || '').trim(), `${줄.번}: 기준이 비었다`);
        assert.ok(String(줄.근거 || '').trim(), `${줄.번}: 근거가 없다 — 만족 사례 · 점검표 · 실측 · 유호님 말씀 가운데 무엇에서 왔는지 적는다`);
        if (줄.공통과다름 != null) {
          assert.ok(번호들.has(줄.공통과다름), `${줄.번}: 점검표에 없는 번호 ${줄.공통과다름}`);
          assert.ok(String(줄.다른까닭 || '').trim(), `${줄.번}: 공통 줄과 다르게 하는 까닭이 없다`);
        }
      }
    }
    for (const n of 팩.컨셉감독.먼저볼공통줄?.줄 || []) assert.ok(번호들.has(n), `먼저볼공통줄: 점검표에 없는 번호 ${n}`);
    // 기승전결 모양(11-24 유호님 「컨셉마다 전부 기승전결 적용해서 만드는거 적용 되어있어?」 → 「넣어줘」) — 컷 연속성 검사 T24가 「검사」를 읽는다
    const 판 = 팩.기승전결;
    assert.equal(typeof 판, 'object', '「기승전결」이 없다 — 기 · 승 · 전 · 결마다 이 컨셉의 모양을 한 문장으로 적는다');
    for (const k of 띠) assert.ok(String(판.모양?.[k] || '').trim(), `기승전결.모양.${k}가 비었다`);
    assert.ok(String(판.근거 || '').trim(), '기승전결.근거가 없다 — 만족 사례 · 실측 · 유호님 말씀 가운데 무엇에서 왔는지 적는다');
    if (판.검사 != null) {
      const 검 = 판.검사;
      for (const 키 of Object.keys(검)) assert.ok(['가장센', '갈래', '꺾임', '세기최소'].includes(키), `기승전결.검사에 모르는 조건 「${키}」 — 컷 연속성 검사가 읽지 않는다`);
      if ('가장센' in 검) assert.ok(띠.includes(검.가장센), `가장센은 기 · 승 · 전 · 결 가운데 하나다: ${검.가장센}`);
      for (const [k, v] of Object.entries(검.갈래 || {})) assert.ok(띠.includes(k) && Array.isArray(v) && v.length && v.every(g => 갈래.includes(g)), `갈래.${k}는 ${갈래.join(' · ')}의 목록이다`);
      if ('꺾임' in 검) assert.ok(Array.isArray(검.꺾임) && 검.꺾임.length === 2 && 검.꺾임.every(k => 띠.includes(k)) && 검.꺾임[0] !== 검.꺾임[1], '꺾임은 서로 다른 띠 둘이다');
      for (const [k, n] of Object.entries(검.세기최소 || {})) assert.ok(띠.includes(k) && Number.isInteger(n) && n >= 1 && n <= 5, `세기최소.${k}는 1~5의 수다`);
    }
    // 앵글 견줄 값(11-24 「재서 넣어 줘」) — 컷표 앵글 낱말(컷연속성검사.py 앵글낱말)로 매긴 본보기 비율. 컷 연속성 검사 T29가 읽는다
    if (팩.앵글 != null) {
      const 앵 = 팩.앵글;
      assert.ok(Number.isInteger(앵.잰컷) && 앵.잰컷 >= 1, '앵글.잰컷은 잰 컷 수다');
      for (const k of ['가까이', '눈높이밖', '정면밖', '뻔한앵글']) assert.ok(Number.isInteger(앵[k]) && 앵[k] >= 0 && 앵[k] <= 100, `앵글.${k}는 0~100의 정수다`);
      for (const [칸, 낱말] of Object.entries(앵글낱말)) {
        const 표 = 앵[칸] || {};
        for (const [w, n] of Object.entries(표)) assert.ok(낱말.includes(w) && Number.isInteger(n) && n > 0 && n <= 100, `앵글.${칸}.${w}: 앵글 낱말과 1~100의 정수만 쓴다`);
        const 합 = Object.values(표).reduce((a, b) => a + b, 0);
        assert.ok(합 === 0 || (합 >= 97 && 합 <= 103), `앵글.${칸}의 비율 합이 ${합}이다 — 100 언저리여야 한다`);
      }
      assert.ok(String(앵.근거 || '').trim(), '앵글.근거가 없다 — 어느 본보기의 몇 컷을 언제 매겼는지 적는다');
    }
  });
}
