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
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 토큰 = require('../docs/디자인_토큰.json');

/* 킷 개수 — 2027 킷(내일 꾸러미 · 08-20 유호님 확정) 41색:
 *   코랄 램프 5+Wash · 바탕 3+양모 회색 4 · 2027 실 4꾸러미×3단 · KC 4 · ⏳퇴역 대기 12(구 무채·Lime·Emerald).
 *   퇴역 12색은 시맨틱 다크·소비처가 이름을 참조 중이라 살아 있다 — 다크 팔레트 트랙이 재배선 후 지우며
 *   이 수를 41→29 로 내린다(그때 이 주석도 같이 진다). */
const 킷개수 = 41;

test(`① 킷은 정확히 ${킷개수}색 — hex 형식·이름·hex 전부 유일하다`, () => {
  const 킷 = 토큰.색.킷;
  assert.equal(킷.length, 킷개수, `${킷개수}색이 아니다 — 키트 개정은 유호님 확정 + 정본·Canva·테스트 동시 이동이다`);
  for (const c of 킷) {
    assert.match(c.hex, /^#[0-9A-F]{6}$/, `${c.이름} hex 형식(대문자 6자리) 위반: ${c.hex}`);
    assert.ok(c.직책, `${c.이름}에 직책이 없다 — 모든 색에 직책이 있는 것이 킷의 문법이다`);
  }
  assert.equal(new Set(킷.map((c) => c.hex)).size, 킷개수, 'hex 중복');
  assert.equal(new Set(킷.map((c) => c.이름)).size, 킷개수, '이름 중복');
});

test('② 시맨틱은 킷 이름만 참조한다(hex 신설 금지)', () => {
  const 이름들 = new Set(토큰.색.킷.map((c) => c.이름));
  for (const [모드, 표] of Object.entries(토큰.색.시맨틱)) {
    if (모드.startsWith('_')) continue;
    for (const [자리, 값] of Object.entries(표)) {
      assert.ok(이름들.has(값), `시맨틱 ${모드}.${자리} = "${값}" — 킷에 없는 이름이다`);
    }
  }
});

test('③-1 DESIGN.md 가 인용하는 hex 전수가 «정본» 안에 있다 (킷 또는 마스코트 램프)', () => {
  const md = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8').toUpperCase();
  /* 2026-08-13: 인용 범위가 둘로 늘었다 — DESIGN.md §2-b(마스코트 색)가 킷 «밖»의 램프를 인용한다.
   * 두 집합을 합쳐 보되 **합치는 것은 검사 범위이지 킷이 아니다** — 램프가 킷에 섞이지 않았는지는
   * 아래 ③-1b 가 따로 잡는다(범위를 넓히면서 그 경계까지 지우면 그때부터 조용히 샌다). */
  const 킷hex = new Set(토큰.색.킷.map((c) => c.hex));
  const 마스코트hex = new Set((토큰.색.마스코트?.램프 || []).map((c) => c.hex));
  const 인용 = [...new Set(md.match(/#[0-9A-F]{6}\b/g) || [])];
  assert.ok(인용.length >= 10, `DESIGN.md hex 인용이 ${인용.length}개뿐 — 추출이 헛돌고 있다`);
  for (const h of 인용) {
    assert.ok(킷hex.has(h) || 마스코트hex.has(h),
      `DESIGN.md 의 ${h}가 정본 어디에도 없다 — 토큰과 요약 문서가 갈라졌다`);
  }
});

test('🔴 체리 램프는 퇴역했다 (유호 확정 08-19) — 되살아나면 문다', () => {
  /* 08-13 B안(「킷 밖 마스코트 고유색」)의 기계 잠금은 체리 램프가 «있을 때» 킷 편입을 막는
   * 것이었다. 08-19 확정 「이제 아예 안쓸거야」로 램프 자체가 없어졌으므로, 잠금의 뜻이
   * 「편입 금지」에서 **「부활 금지」**로 바뀐다. 잠금을 지우지 않고 방향을 돌린다 —
   * 지우면 누가 램프를 되살려 킷에 섞어도 아무도 안 본다. */
  assert.ok(!토큰.색.마스코트?.램프,
    '체리 램프가 토큰에 되살아났다 — 퇴역 조항(색.마스코트._의상)부터 확인한다');
  assert.ok(!토큰.재질?.펠트?.정본사진?.특별,
    '정본사진.특별(체리) 슬롯이 되살아났다 — 자산은 08-19 에 지웠다');
});

/* 2026-08-15 — 램프가 의상별로 둘이 됐다(유호님 확정 08-15 ① 상태 의상: 평소 코랄 / 특별 체리).
 * ⚠ 위 ③-1b 의 「킷과 안 겹친다」 잠금은 **평상복에는 걸지 않는다** — 그 잠금이 지키는 것은
 *   「체리는 킷 밖 IP 색」이라는 확정이고, 평상복 코랄은 반대로 **킷 색이 맞다**(Coral 3 와 ΔE 2.7).
 *   같은 잠금을 양쪽에 걸면 뜻이 뒤집힌 채로 초록이 뜬다. */
test('③-1c 평상복(코랄) 램프도 형식·직책·출처를 갖췄다', () => {
  const 평상복 = 토큰.색.마스코트?.평상복램프 || [];
  assert.ok(평상복.length >= 3, '평상복 램프가 비었다 — 유호님 확정 08-15 ①(상태 의상)이 토큰에 안 섰다');
  for (const c of 평상복) {
    assert.match(c.hex, /^#[0-9A-F]{6}$/, `평상복 램프 hex 형식(대문자 6자리) 위반: ${c.이름} ${c.hex}`);
    assert.ok(c.직책, `${c.이름} 에 직책이 없다`);
  }
  assert.equal(new Set(평상복.map((c) => c.hex)).size, 평상복.length, '평상복 램프 hex 중복');
  /* F456 — 「코어색」 자가 넷이라 값이 갈렸다. 값만 적고 자를 안 적으면 다음 세션이 재현을 못 한다. */
  assert.match(토큰.색.마스코트?._평상복출처 || '', /마스코트램프\.py/,
    '평상복 램프에 «어느 자로 쟀는지»가 없다 — F456 이 정확히 그 자리에서 났다');
  assert.ok(토큰.색.마스코트?._의상 && 토큰.색.마스코트?._쓰임,
    '의상·쓰임 주석이 없다 — 두 램프를 왜 안 합치는지가 값 옆에 없으면 다음 세션이 합친다');
});

test('③-1d 두 의상 램프는 서로 겹치지 않는다 (합치면 어느 옷인지 사라진다)', () => {
  const 체리 = new Set((토큰.색.마스코트?.램프 || []).map((c) => c.hex));
  const 겹침 = (토큰.색.마스코트?.평상복램프 || []).filter((c) => 체리.has(c.hex));
  assert.deepEqual(겹침.map((c) => c.hex), [],
    `같은 hex 가 두 의상에 있다: ${겹침.map((c) => c.hex).join(', ')} — 의상별로 가른 의미가 없어진다`);
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

test('④-1a --check 는 줄끝(CRLF)을 어긋남으로 읽지 않는다 — Windows 체크아웃 전부가 거짓 적색이던 자리 (2026-08-07 실측)', () => {
  // autocrlf 체크아웃 모사: 내용은 같고 줄끝만 CRLF 인 사본. 본 트리는 도구가 직접 쓴 LF 라 초록,
  // 새 체크아웃(워크트리·CI 격리 사본)만 빨개져 「환경」이 「어긋남」의 모양으로 나왔다.
  const { build } = require('../tools/토큰빌드.js');
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tokens-')), 'tokens.css');
  const check = () => spawnSync('node', [path.join(ROOT, 'tools', '토큰빌드.js'), '--check'],
    { encoding: 'utf8', env: { ...process.env, SYNK_토큰_OUT: out } });
  fs.writeFileSync(out, build().replace(/\n/g, '\r\n'), 'utf8');
  const ok = check();
  assert.equal(ok.status, 0, `CRLF 사본을 「어긋남」으로 읽었다:\n${ok.stderr || ok.stdout}`);
  // 탐지력은 살아 있어야 한다 — 내용이 진짜 다르면 여전히 적색
  fs.writeFileSync(out, build().replace(/\n/g, '\r\n') + '/* drift */', 'utf8');
  assert.equal(check().status, 1, '진짜 어긋남을 통과시켰다 — 게이트가 죽었다');
});

test('④-2 브랜드색.test.js 의 KIT 는 토큰에서 파생한다(인라인 사본 원복 방지)', () => {
  const src = fs.readFileSync(path.join(__dirname, '브랜드색.test.js'), 'utf8');
  assert.ok(/require\(['"]\.\.\/docs\/디자인_토큰\.json['"]\)/.test(src), 'KIT 가 토큰 정본에서 파생하지 않는다 — 목록이 두 곳이 되면 갈라진다');
});
