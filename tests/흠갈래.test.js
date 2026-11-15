'use strict';
// 흠갈래.json — 슬롭 점검표 줄 번호를 묶음 · 열두 원칙 · 올린 검사에 잇는 표(흠 장부 설계 1단계, 2026-11-15).
// 점검표에 줄이 늘면 이 시험이 「흠갈래.json 줄에 더하라」고 알린다. 원칙 괄호가 점검표를 다 덮는지는 tests/영상입구.test.js가 본다 —
// 여기서는 이 표가 점검표 · 스킬 괄호 · 최종 확인 갈래 이름과 어긋나지 않는지만 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const 읽기 = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const 표 = JSON.parse(읽기('docs/마케팅/제작양식/흠갈래.json'));
const 점검표 = 읽기('docs/마케팅/제작양식/광고영상_슬롭점검표.md').split(/\r?\n/).map((l) => l.match(/^\| (\d+) \| ([^|]*)\|/)).filter(Boolean)
  .map((m) => ({ n: Number(m[1]), 자리: m[2].trim() }));
const 묶음들 = new Set([...Object.keys(표.묶음), ...Object.keys(표.새묶음후보 || {})]);

test('점검표의 모든 줄 번호가 표에 정확히 한 번 있고, 표에는 점검표에 없는 번호가 없다', () => {
  assert.ok(점검표.length >= 61);
  const 표번호 = 표.줄.map((x) => x.번호);
  const 겹침 = 표번호.filter((n, i) => 표번호.indexOf(n) !== i);
  assert.deepEqual(겹침, [], `흠갈래.json에 두 번 나온 번호: ${겹침.join(', ')}`);
  const 없는 = 점검표.filter((x) => !표번호.includes(x.n)).map((x) => `${x.n}(${x.자리.slice(0, 20)})`);
  assert.deepEqual(없는, [], `점검표에 줄이 늘었다 — docs/마케팅/제작양식/흠갈래.json 「줄」에 묶음 하나 · 원칙 · 잴수를 정해 더한다: ${없는.join(', ')}`);
  const 남는 = 표번호.filter((n) => !점검표.some((x) => x.n === n));
  assert.deepEqual(남는, [], `점검표에 없는 번호: ${남는.join(', ')}`);
});

test('줄마다 묶음은 하나(G01~G20이나 새 묶음 후보) · 잴수는 기계나 눈 · 올린 검사는 이름과 날짜(모르면 null)', () => {
  assert.deepEqual(Object.keys(표.묶음).sort(), Array.from({ length: 20 }, (_, i) => `G${String(i + 1).padStart(2, '0')}`));
  for (const x of 표.줄) {
    assert.equal(typeof x.묶음, 'string', `${x.번호}: 묶음은 글 하나다`);
    assert.ok(묶음들.has(x.묶음), `${x.번호}: 모르는 묶음 ${x.묶음}`);
    assert.ok(['기계', '눈'].includes(x.잴수), `${x.번호}: 잴수 ${x.잴수}`);
    for (const o of x.올린검사) {
      assert.ok(o.검사, `${x.번호}: 올린 검사 이름`);
      assert.ok(o.날짜 === null || /^\d{4}-\d{2}-\d{2}$/.test(o.날짜), `${x.번호}: 날짜 꼴 ${o.날짜}`);
      assert.ok(o.규칙 === undefined || (Array.isArray(o.규칙) && o.규칙.every((r) => typeof r === 'string' && r)), `${x.번호}: 규칙은 이름 목록`);
    }
  }
  // 한 검사 규칙은 번호 하나에만 잇는다(검사이력의 규칙에 번호를 다는 표)
  const 규칙 = new Map();
  for (const x of 표.줄) for (const o of x.올린검사) for (const r of o.규칙 || []) {
    const k = `${o.검사}:${r}`;
    assert.ok(!규칙.has(k) || 규칙.get(k) === x.번호, `${k}가 ${규칙.get(k)}번과 ${x.번호}번에 함께 있다`);
    규칙.set(k, x.번호);
  }
});

test('원칙 번호는 synk-video 스킬 「열두 원칙」 괄호에서 뽑은 것과 같다(화면 줄은 빔)', () => {
  const 원칙 = new Map();
  let on = false;
  for (const l of 읽기('.claude/skills/synk-video/SKILL.md').split(/\r?\n/)) {
    if (/^## 열두 원칙/.test(l)) { on = true; continue; }
    if (on && /^## /.test(l)) break;
    const m = on && l.match(/^(\d+)\. \*\*.*\(([^()]*)\)\s*$/);
    if (!m) continue;
    for (const 조각 of m[2].split('/')[0].split('·').map((s) => s.trim())) {
      const r = 조각.match(/^(\d+)~(\d+)$/);
      const ns = r ? Array.from({ length: Number(r[2]) - Number(r[1]) + 1 }, (_, i) => Number(r[1]) + i) : /^\d+$/.test(조각) ? [Number(조각)] : [];
      for (const n of ns) 원칙.set(n, [...(원칙.get(n) || []), Number(m[1])]);
    }
  }
  const 다름 = 표.줄.filter((x) => JSON.stringify(x.원칙) !== JSON.stringify(원칙.get(x.번호) || [])).map((x) => `${x.번호}: 표 ${JSON.stringify(x.원칙)} · 스킬 ${JSON.stringify(원칙.get(x.번호) || [])}`);
  assert.deepEqual(다름, [], `스킬 괄호가 바뀌었으면 흠갈래.json 원칙도 고친다 — ${다름.join(' / ')}`);
});

test('1~26번 묶음은 슬롭점검_모음.json 「점검표행」의 묶음 가운데 하나다', () => {
  const 모음 = JSON.parse(읽기('docs/마케팅/제작양식/슬롭점검_모음.json'));
  const 행묶음 = new Map();
  for (const x of [...모음.지적, ...모음.통과]) if (Number.isInteger(x.점검표행)) 행묶음.set(x.점검표행, new Set([...(행묶음.get(x.점검표행) || []), x.묶음]));
  for (const [n, gs] of 행묶음) assert.ok(gs.has(표.줄.find((x) => x.번호 === n).묶음), `${n}번 묶음이 모음과 다르다: ${[...gs].join(',')}`);
});

test('최종 확인 갈래 이름 열네 개가 모두 「항목」에 있고, 번호는 점검표 줄이나 null, 묶음은 정한 묶음(기타만 null)', () => {
  const { KINDS } = require('../tools/lib/최종확인.js');
  assert.deepEqual(Object.keys(표.항목).sort(), [...KINDS].sort());
  for (const [이름, x] of Object.entries(표.항목)) {
    assert.ok(x.번호 === null || 표.줄.some((r) => r.번호 === x.번호), `${이름}: 번호 ${x.번호}`);
    if (이름 === '기타') assert.equal(x.묶음, null);
    else assert.ok(묶음들.has(x.묶음), `${이름}: 묶음 ${x.묶음}`);
  }
});

test('갈래(「항목」)에 둔 올린 검사 — 번호가 없는 갈래에만, 꼴은 줄과 같고, 규칙은 점검표 줄의 규칙과 겹치지 않는다(11-15 3단계 소리)', () => {
  const 줄규칙 = new Set(표.줄.flatMap((x) => x.올린검사.flatMap((o) => (o.규칙 || []).map((r) => `${o.검사}:${r}`))));
  const 본 = new Set();
  for (const [이름, x] of Object.entries(표.항목)) {
    if (x.올린검사 === undefined) continue;
    assert.equal(x.번호, null, `${이름}: 번호가 있는 갈래는 그 점검표 줄에 올린 검사를 둔다`);
    assert.ok(Array.isArray(x.올린검사) && x.올린검사.length, `${이름}: 올린검사는 목록`);
    for (const o of x.올린검사) {
      assert.ok(o.검사 && /^\d{4}-\d{2}-\d{2}$/.test(o.날짜) && Array.isArray(o.규칙) && o.규칙.length, `${이름}: 검사 · 날짜 · 규칙 ${JSON.stringify(o)}`);
      assert.ok(o.범위 === undefined || o.범위 === '일부', `${이름}: 범위는 없거나 「일부」 — ${o.범위}`);
      for (const r of o.규칙) {
        const k = `${o.검사}:${r}`;
        assert.ok(!줄규칙.has(k) && !본.has(k), `${k}가 두 곳에 있다`);
        본.add(k);
      }
    }
  }
  assert.ok(본.has('최종본검사:조용구간'), '소리 갈래에 조용구간');
});
