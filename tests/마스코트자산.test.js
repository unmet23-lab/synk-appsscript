/* 마스코트 «경로» 판정이 한 곳에서만 파생되는가.
 *
 * 왜 (실사고 2026-08-15): 같은 판정이 `시안굽기.js` 와 `브랜드렌더린트.js` 두 곳에 각각 적혀 있었고
 * 둘 다 `마스코트_(누끼|렌더)/` 만 알았다. 홈페이지 시안을 펠트 정본(`펠트코랄_0815/`)으로 갈자
 * **두 곳이 동시에 눈을 감았다** — 굽기는 `data-synk-mascot` 을 안 달고, 린트는 그 그림을 못 봐서
 * 「마스코트 바닥 0건」을 낸다. 그 0 은 «깨끗함»이 아니라 «해당 없음»인데 출력 모양이 같다.
 *
 * 그래서 두 축을 나눠 검사한다:
 *   ① 탐지력 — 픽스처로 못박는다(실저장소가 깨끗해져도 이 축은 안 죽는다).
 *   ② 옛 통로 금지 — 호출부에 손으로 적힌 폴더 정규식이 «다시 생기면» 빨개진다.
 *      CLAUDE.md: 3번째 같은 오류는 원인을 쓸 수 없게 만든다(공용 통로 + 옛 통로를 테스트로 금지).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const { 마스코트폴더, 패턴소스, 마스코트경로다 } = require('../tools/lib/마스코트자산');

/* ── ① 탐지력 (픽스처) ──────────────────────────────────────────────────── */
test('마스코트 폴더를 경로로 알아본다 — 슬래시·역슬래시 둘 다', () => {
  const 잡아야 = [
    '../캐릭터/펠트코랄_0815/누끼/재염색_본체.png',   // 08-15 현행 코랄 정본
    'docs/캐릭터/마스코트_렌더/본체.png',
    'docs/캐릭터/마스코트_누끼/본체.png',
    'docs/캐릭터/마스코트_정본/본체.png',
    'docs\\캐릭터\\마스코트_누끼\\본체.png',          // 사람이 실제로 쓰는 표기(윈도)
  ];
  for (const p of 잡아야) assert.ok(마스코트경로다(p), `마스코트인데 못 잡았다: ${p}`);
});

test('마스코트가 아닌 그림은 안 잡는다 — 분모가 부풀면 「바닥 위반」이 거짓으로 뜬다', () => {
  const 잡으면안됨 = [
    '../캐릭터/명품판_0814/속수집오브.png',
    '../캐릭터/명품판_0814/아이콘_숙제_파생.png',
    '../캐릭터/자개_0814/문양.png',
    'docs/캐릭터/3D_0815/입력_코랄본체_누끼.png',      // 3D 파이프라인 입력·중간물(지면 자산 아님)
    '',
  ];
  for (const p of 잡으면안됨) assert.ok(!마스코트경로다(p), `마스코트가 아닌데 잡았다: ${p}`);
});

test('폴더 이름 앞뒤가 붙은 다른 폴더를 넘겨 잡지 않는다', () => {
  assert.ok(!마스코트경로다('docs/캐릭터/펠트코랄_0815_구판/x.png'), '접두만 같은 폴더를 잡았다');
  assert.ok(마스코트경로다('docs/캐릭터/펠트코랄_0815/x.png'), '구분자가 바로 뒤인 정상 경로를 놓쳤다');
});

/* ── ② 옛 통로 금지 (호출부가 자기 목록을 다시 갖지 못하게) ──────────────── */
const 호출부 = ['tools/시안굽기.js', 'tools/브랜드렌더린트.js'];

test('호출부는 공용 모듈에서 파생한다 — 손으로 적은 폴더 정규식이 있으면 실패', () => {
  for (const rel of 호출부) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(/require\(['"]\.\/lib\/마스코트자산['"]\)/.test(src),
      `${rel} 가 공용 모듈을 안 쓴다 — 목록이 갈라진다`);
    /* 코드에 박힌 폴더 정규식만 잡는다(주석의 설명은 `/…/` 형태가 아니라 안 걸린다). */
    const 옛통로 = src.match(/\/[^\n/]*마스코트_\(?(누끼|렌더)[^\n/]*\//g) || [];
    assert.deepStrictEqual(옛통로, [],
      `${rel} 에 손으로 적은 마스코트 폴더 정규식이 다시 생겼다: ${옛통로.join(' · ')}`);
  }
});

test('패턴소스는 브라우저로 넘겨도 같은 판정을 낸다 (이스케이프가 안 갈린다)', () => {
  // 렌더린트는 이 소스를 문자열로 주입해 저쪽에서 RegExp 를 짓는다 — 왕복시켜 본다.
  const 왕복 = new RegExp(JSON.parse(JSON.stringify(패턴소스)));
  assert.ok(왕복.test('a/펠트코랄_0815/b.png'));
  assert.ok(왕복.test('a\\마스코트_누끼\\b.png'));
  assert.ok(!왕복.test('a/명품판_0814/b.png'));
});

test('목록에 현행 정본 폴더가 들어 있다 — 빠지면 그 세트가 통째로 안 보인다', () => {
  for (const 필수 of ['마스코트_렌더', '마스코트_누끼', '펠트코랄_0815']) {
    assert.ok(마스코트폴더.includes(필수), `목록에서 ${필수} 가 빠졌다`);
  }
});

/* ── ③ 굽기 통로가 실제로 표식을 다는가 (ffmpeg 없으면 skip — 통과와 미실행을 안 섞는다) ── */
const ffmpeg있나 = () => {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
};

test('시안굽기: 표식 없는 펠트 마스코트를 구우면 data-synk-mascot 이 붙는다', (t) => {
  if (!ffmpeg있나()) return t.skip('ffmpeg 없음 — 굽기를 **안 돌렸다**(통과 아님)');
  const 그림 = path.join(ROOT, 'docs/캐릭터/펠트코랄_0815/누끼/재염색_본체.png');
  if (!fs.existsSync(그림)) return t.skip('펠트 누끼 자산이 없다 — 이 축을 안 돌렸다');

  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-굽기-'));
  try {
    // 굽기는 `<img src>` 를 파일 위치 기준으로 푼다 — 저장소 안에 두고 상대경로로 가리킨다.
    const 판 = path.join(ROOT, 'docs', '캐릭터', `_회귀_마스코트표식_${process.pid}.html`);
    fs.writeFileSync(판,
      '<!doctype html><meta charset="utf-8"><body>' +
      '<img src="펠트코랄_0815/누끼/재염색_본체.png" alt="" data-굽기폭="64">' +
      '</body>', 'utf8');
    try {
      execFileSync('node', [path.join(ROOT, 'tools', '시안굽기.js'), 판], { encoding: 'utf8' });
      const 나온판 = 판.replace(/\.html$/, '_자립형.html');
      const 결과 = fs.readFileSync(나온판, 'utf8');
      assert.match(결과, /data-synk-mascot/, '펠트 경로인데 표식이 안 붙었다 — 린트가 눈을 감는다');
      assert.match(결과, /data:image\/webp;base64,/, '그림이 인라인되지 않았다');
      fs.rmSync(나온판, { force: true });
    } finally {
      fs.rmSync(판, { force: true });
    }
  } finally {
    fs.rmSync(임시, { recursive: true, force: true });
  }
});
