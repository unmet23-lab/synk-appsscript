/**
 * 토큰 정본 정합 — 디자인 토큰(docs/디자인_토큰.json)이 단일 원천으로 성립하는지
 *
 * 지키는 것 4가지:
 *   ① 킷 19색의 형식·유일성 (파생 소비자 전체의 전제)
 *   ② 시맨틱은 hex 를 새로 만들지 않는다 — 전부 킷 「이름」 참조여야 한다
 *   ③ 문서 정본과의 삼각 정합 — DESIGN.md 의 인용 hex ⊆ 킷 · 폰트 스택 = 폰트 정본
 *      (DESIGN.md↔컨셉정본은 디자인정본.test.js, 킷↔hex원천은 브랜드색.test.js 가 이미 지킨다)
 *   ④ 빌드 산출물(synk-tokens.css)이 정본보다 낡지 않았다 (--check)
 *      + 브랜드색.test.js 가 토큰에서 파생하는 구조가 원복되지 않았다
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 토큰 = require('../docs/디자인_토큰.json');

test('① 킷은 정확히 19색 — hex 형식·이름·hex 전부 유일하다', () => {
  const 킷 = 토큰.색.킷19;
  assert.equal(킷.length, 19, '19색이 아니다 — 키트 개정은 유호님 확정 + 정본·Canva·테스트 동시 이동이다');
  for (const c of 킷) {
    assert.match(c.hex, /^#[0-9A-F]{6}$/, `${c.이름} hex 형식(대문자 6자리) 위반: ${c.hex}`);
    assert.ok(c.직책, `${c.이름}에 직책이 없다 — 모든 색에 직책이 있는 것이 킷의 문법이다`);
  }
  assert.equal(new Set(킷.map((c) => c.hex)).size, 19, 'hex 중복');
  assert.equal(new Set(킷.map((c) => c.이름)).size, 19, '이름 중복');
});

test('② 시맨틱은 킷 이름만 참조한다(hex 신설 금지)', () => {
  const 이름들 = new Set(토큰.색.킷19.map((c) => c.이름));
  for (const [모드, 표] of Object.entries(토큰.색.시맨틱)) {
    if (모드.startsWith('_')) continue;
    for (const [자리, 값] of Object.entries(표)) {
      assert.ok(이름들.has(값), `시맨틱 ${모드}.${자리} = "${값}" — 킷에 없는 이름이다`);
    }
  }
});

test('③-1 DESIGN.md 가 인용하는 hex 전수가 킷 안에 있다', () => {
  const md = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8').toUpperCase();
  const 킷hex = new Set(토큰.색.킷19.map((c) => c.hex));
  const 인용 = [...new Set(md.match(/#[0-9A-F]{6}\b/g) || [])];
  assert.ok(인용.length >= 10, `DESIGN.md hex 인용이 ${인용.length}개뿐 — 추출이 헛돌고 있다`);
  for (const h of 인용) assert.ok(킷hex.has(h), `DESIGN.md 의 ${h}가 킷에 없다 — 토큰과 요약 문서가 갈라졌다`);
});

test('③-2 폰트 스택이 브랜드_폰트_정본.md 와 문자 그대로 일치한다', () => {
  const md = fs.readFileSync(path.join(ROOT, 'docs', '브랜드_폰트_정본.md'), 'utf8');
  const pick = (v) => {
    const m = md.match(new RegExp(`--${v}:\\s*([^;]+);`));
    assert.ok(m, `폰트 정본에서 --${v} 를 못 찾았다`);
    return m[1].trim();
  };
  assert.equal(토큰.서체.본문스택, pick('synk-font'), '본문 스택이 폰트 정본과 다르다');
  assert.equal(토큰.서체.모노스택, pick('synk-font-mono'), '모노 스택이 폰트 정본과 다르다');
});

test('④-1 synk-tokens.css 가 정본보다 낡지 않았다(빌드 --check)', () => {
  const r = spawnSync('node', [path.join(ROOT, 'tools', '토큰빌드.js'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `토큰빌드 --check 실패:\n${r.stderr || r.stdout}`);
});

test('④-2 브랜드색.test.js 의 KIT 는 토큰에서 파생한다(인라인 사본 원복 방지)', () => {
  const src = fs.readFileSync(path.join(__dirname, '브랜드색.test.js'), 'utf8');
  assert.ok(/require\(['"]\.\.\/docs\/디자인_토큰\.json['"]\)/.test(src), 'KIT 가 토큰 정본에서 파생하지 않는다 — 목록이 두 곳이 되면 갈라진다');
});
