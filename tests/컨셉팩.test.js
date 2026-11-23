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
  });
}
