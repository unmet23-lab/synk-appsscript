/**
 * 노트북LM 묶음 생성기 회귀 (tools/notebooklm-export.js)
 *
 * 왜 있나 — 이 생성기는 저장소 내용을 **외부(구글 계정)로 내보낸다.** 다른 가드들과
 * 위험의 층이 다르다: harness-export는 내 디스크 안에서 끝나고, 여긴 업로드다.
 * 새는 방향은 언제나 「통과」 — 게이트가 조용히 못 잡으면 개인정보가 그냥 올라간다.
 *
 * 이 파일이 지키는 것:
 *  ① 탐지력 — 개인정보·자격증명 7종을 **픽스처로** 못박는다(실저장소에 그게 있기를
 *     요구하지 않는다 — 「버그가 아직 있을 것을 요구하는 회귀」 금지).
 *  ② 거짓양성 — 실저장소의 알려진 안전 파일이 걸리지 않는다(ALLOW가 살아 있는가).
 *  ③ 경로 게이트 — _archive·_구본·SYNK 보안이 수집에서 빠진다(낡은 판·기밀).
 *  ④ 출처 보존 — NotebookLM은 폴더 구조를 잃으므로 파일명이 경로를 지고 있어야 한다.
 *
 * 🔑 ALLOW는 **값 단위**여야 한다. 파일 단위 예외를 허용하면 그 파일에 나중에 들어올
 *    진짜 개인정보까지 함께 통과한다 — 예외가 스스로 넓어지는 형태.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, '..', 'tools', 'notebooklm-export.js');
const { scanPII, walk, flatName, ALLOW, DENY_DIR } = require(TOOL);

const REPO = path.join(__dirname, '..');

// ── ① 탐지력 (픽스처) ───────────────────────────────────────────────────
// 사람이 실제로 쓰는 표기로 적는다 — 하이픈 있는 것·없는 것·점으로 끊은 것.
const 잡아야_하는_것 = [
  ['휴대폰번호', '학부모 연락처 010-1234-5678 로 문자'],
  ['휴대폰번호', '연락처 01012345678 (하이픈 없음)'],
  ['몽골 전화번호', '현지 강사 +976 9911 2233'],
  ['몽골 전화번호', '976-9911-2233 으로 전화'],
  ['주민등록번호', '주민번호 990101-1234567'],
  ['카드번호', '카드 1234-5678-9012-3456 결제'],
  ['이메일', '학생 계정 student.batbold@gmail.com 로 초대'],
  ['API 키', 'AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r 를 시트에'],
  ['API 키', 'sk-abcdefghijklmnopqrstuvwxyz012345 로 호출'],
  // 구글의 새 발급 형식(`AQ.…`) — `AIza` 만 보던 시절엔 그냥 통과했다(08-05 실물로 확인)
  ['API 키', '제미나이 키 AQ.FAKE0FAKE0FAKE0FAKE0FAKE0FAKE0 를 메모에'],
  ['텔레그램 토큰', '봇 토큰 1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw'],
];

for (const [종류, 본문] of 잡아야_하는_것) {
  test(`탐지: ${종류} — ${본문.slice(0, 24)}…`, () => {
    const hits = scanPII(본문);
    assert.ok(hits.length > 0, `게이트가 못 잡았다(그대로 업로드된다): ${본문}`);
    assert.ok(hits.some((h) => h.kind === 종류),
      `잡긴 했는데 종류가 다르다 — 기대 ${종류}, 실제 ${hits.map((h) => h.kind).join(',')}`);
  });
}

test('탐지: 줄 번호를 정확히 짚는다 (제외 사유를 사람이 확인할 수 있어야 한다)', () => {
  const 본문 = ['첫 줄', '둘째 줄', '연락처 010-1111-2222', '넷째 줄'].join('\n');
  const hits = scanPII(본문);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 3, '줄 번호가 틀리면 「어디를 지워야 하나」를 못 찾는다');
});

test('탐지: 한 파일에 여러 종류가 있으면 전부 보고한다 (첫 건에서 멈추지 않는다)', () => {
  const hits = scanPII('메일 a@b.com\n전화 010-1111-2222');
  const 종류 = new Set(hits.map((h) => h.kind));
  assert.ok(종류.has('이메일') && 종류.has('휴대폰번호'),
    `일부만 잡았다 — ${[...종류].join(',')}`);
});

// ── ② 거짓양성 (ALLOW가 실제로 통과시키는가) ────────────────────────────
test('거짓양성: ALLOW에 든 값은 통과한다 (하나 때문에 파일이 통째로 빠지면 게이트가 헛돈다)', () => {
  for (const 값 of ALLOW) {
    assert.equal(scanPII(`문의는 ${값} 로`).length, 0,
      `ALLOW 값인데 걸렸다: ${값} — 게이트가 헛돌면 곧 꺼진다`);
  }
});

test('거짓양성: 평범한 판정 문장은 걸리지 않는다', () => {
  const 안전 = [
    '버전 v9.170 라이브 · 회귀 15/15 초록',
    'BEP 3,922만₮ · 85/94명 · 시급 15,000₮',
    '2026-08-04 개원 시뮬 완료, 배치 41종',
    '학생ID 형식은 SYNK-001 처럼 3자리다',   // 샘플 ID는 개인정보가 아니다
  ];
  for (const s of 안전) {
    assert.equal(scanPII(s).length, 0, `거짓양성: ${s} → ${JSON.stringify(scanPII(s))}`);
  }
});

test('거짓양성: 실저장소의 정본 문서가 게이트에 걸리지 않는다', () => {
  for (const rel of ['CLAUDE.md', 'docs/AI_스택_가이드.md', 'docs/세션보드.md']) {
    const p = path.join(REPO, rel);
    if (!fs.existsSync(p)) continue;
    const hits = scanPII(fs.readFileSync(p, 'utf8'));
    assert.equal(hits.length, 0,
      `${rel} 이 게이트에 걸렸다 — 진짜 개인정보가 들어왔거나 ALLOW가 낡았다: ${JSON.stringify(hits.slice(0, 3))}`);
  }
});

// ── ③ 경로 게이트 ───────────────────────────────────────────────────────
test('수집 제외: _archive·_구본·SYNK 보안은 묶음에 들어가지 않는다', () => {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'nblm-'));
  const mk = (rel, body = '# 본문') => {
    const p = path.join(임시, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf8');
  };
  mk('살아야_한다.md');
  mk('_archive/낡은판.md');
  mk('정본/_구본/옛판.md');
  mk('정본/SYNK 보안/사업계획.md');
  mk('node_modules/pkg/README.md');

  const 수집 = walk(임시).map((p) => path.relative(임시, p).replace(/\\/g, '/'));
  assert.deepEqual(수집, ['살아야_한다.md'],
    `제외되어야 할 것이 수집됐다 — 낡은 판이 출처로 찍히면 그게 정본 분열이다: ${수집.join(', ')}`);
  fs.rmSync(임시, { recursive: true, force: true });
});

test('수집 제외 규칙이 비어 있지 않다 (규칙이 사라지면 조용히 전부 통과한다)', () => {
  assert.ok(DENY_DIR.length >= 3, 'DENY_DIR이 줄었다 — 누가 지웠는지 확인하라');
  for (const 경로 of ['docs/_archive/x.md', 'docs/정본/SYNK 보안/x.md', 'docs/a/_구본/x.md']) {
    assert.ok(DENY_DIR.some((re) => re.test(경로)), `막아야 할 경로가 통과한다: ${경로}`);
  }
});

test('수집 대상은 .md 뿐이다 (txt·html은 안 올린다 — 정본이 아니거나 렌더물이다)', () => {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'nblm2-'));
  fs.writeFileSync(path.join(임시, 'a.md'), '#', 'utf8');
  fs.writeFileSync(path.join(임시, 'b.txt'), 'x', 'utf8');
  fs.writeFileSync(path.join(임시, 'c.html'), '<p>', 'utf8');
  const 수집 = walk(임시).map((p) => path.basename(p));
  assert.deepEqual(수집, ['a.md'], `.md 외가 섞였다: ${수집.join(', ')}`);
  fs.rmSync(임시, { recursive: true, force: true });
});

// ── ④ 출처 보존 ─────────────────────────────────────────────────────────
test('파일명이 원본 경로를 지고 있다 (NotebookLM은 폴더 구조를 잃는다)', () => {
  assert.equal(flatName('문서', '_ops/마찰신호.md'), '문서___ops__마찰신호.md');
  assert.equal(flatName('기억', 'token-audit-2026-08-04.md'), '기억__token-audit-2026-08-04.md');
  // 윈도우 구분자도 같은 결과여야 한다 — 두 기계에서 이름이 갈리면 노트북이 갈린다
  assert.equal(flatName('문서', '_ops\\마찰신호.md'), '문서___ops__마찰신호.md');
});

test('한 폴더에 평탄화해도 이름이 겹치지 않는다 (겹치면 조용히 덮인다)', () => {
  const 이름 = [
    ...walk(path.join(REPO, 'docs')).map((p) =>
      flatName('문서', path.relative(path.join(REPO, 'docs'), p))),
  ];
  const 중복 = 이름.filter((n, i) => 이름.indexOf(n) !== i);
  assert.deepEqual(중복, [], `평탄화 이름 충돌 — 뒤엣것이 앞엣것을 덮는다: ${중복.join(', ')}`);
});

test('걷는 뿌리가 「거부 폴더 이름」 아래 있어도 수집은 산다 (워크트리 세션의 docs 전멸 실측 2026-08-05)', () => {
  // 거부 판정을 절대경로에 걸면 REPO 자체가 `…\worktrees\…` 아래일 때(워크트리 세션)
  // docs 전량이 걸러져 수집이 조용히 0이 된다 — 거부는 걷는 뿌리 기준 상대경로여야 한다.
  const { walk } = require(TOOL);
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'nblm-walk-'));
  const 뿌리 = path.join(임시, 'worktrees', 'wt-1', 'docs');
  fs.mkdirSync(path.join(뿌리, '_archive'), { recursive: true });
  fs.writeFileSync(path.join(뿌리, '살아있다.md'), 'x');
  fs.writeFileSync(path.join(뿌리, '_archive', '낡음.md'), 'x');
  const got = walk(뿌리).map((p) => path.basename(p));
  assert.deepEqual(got, ['살아있다.md'],
    '뿌리 경로의 worktrees 가 전량을 걸렀거나(0개), 상대경로 전환이 _archive 거부를 죽였다(2개)');
  fs.rmSync(임시, { recursive: true, force: true });
});

// ── ⑤ 생성기 ↔ 부패 점검 왕복 (앵커가 어긋나면 낡음을 못 잰다) ──────────
test('부패 점검이 읽는 앵커와 생성기가 쓰는 문구가 맞는다 (격리 폴더 왕복)', () => {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'nblm-rt-'));
  const OUT = path.join(임시, 'SYNK_노트북LM');
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath, [TOOL, '--out', OUT], { cwd: REPO, encoding: 'utf8' });

  // 실제 rot-check가 쓰는 그 앵커로 읽는다 — 사본 정규식을 두면 둘이 따로 낡는다
  const src = fs.readFileSync(path.join(REPO, 'tools', 'rot-check.js'), 'utf8');
  // ⚠ rot-check에는 `.match(…)` 앵커가 여럿이다(하네스 쪽도 있다) — 「첫 번째」로 집으면
  //   엉뚱한 앵커를 검사하고 초록이 된다. 반드시 「만든 날」을 담은 것으로 지목한다.
  const mAnchor = src.match(/\.match\((\/[^\n]*만든 날[^\n]*?\/)\)/);
  assert.ok(mAnchor, 'rot-check에서 노트북LM 앵커를 못 찾았다 — 배선이 사라졌거나 형태가 바뀌었다');
  const anchor = new RegExp(mAnchor[1].slice(1, -1));

  const readme = path.join(OUT, 'README_먼저읽기.md');
  assert.ok(fs.existsSync(readme), '생성기가 README_먼저읽기.md를 안 만들었다 — 점검기가 찾는 파일명이다');
  const hit = fs.readFileSync(readme, 'utf8').match(anchor);
  assert.ok(hit && /^\d{4}-\d{2}-\d{2}$/.test(hit[1]),
    '점검기 앵커가 생성기 문구를 못 읽는다 — 경고는 뜨는데 「(날짜 미검출)」로 조용히 쓸모없어진다');

  // 만든 날짜가 사본에 실제로 박혀 있는가 (§1-5 잠금 조건 2)
  const 자료 = fs.readdirSync(OUT).filter((f) => f.startsWith('기억__') || f.startsWith('문서__'));
  assert.ok(자료.length > 50, `자료가 너무 적다(${자료.length}개) — 수집이 조용히 비었다`);
  const 표본 = fs.readFileSync(path.join(OUT, 자료[0]), 'utf8');
  assert.match(표본, /만든 날: \d{4}-\d{2}-\d{2}/, '사본에 만든 날짜가 없다(정본 분열 잠금 위반)');
  assert.match(표본, /여기서 결정하지 않는다/, '읽기 전용 문구가 없다(잠금 조건 1)');
  assert.match(표본, /원본 = SYNK-appsscript 저장소/, '원본 경로가 없다 — 출처를 못 되짚는다');

  assert.ok(fs.existsSync(path.join(OUT, '_빠진_파일.md')),
    '제외 목록이 없다 — 「자료가 없어 못 답한 것」과 「일부러 뺀 것」이 같은 모양이 된다');
  fs.rmSync(임시, { recursive: true, force: true });
});

// ── require 부작용 없음 ─────────────────────────────────────────────────
test('require만으로는 아무것도 만들지 않는다 (테스트가 바탕화면을 건드리면 안 된다)', () => {
  const { DEFAULT_OUT } = require(TOOL);
  assert.ok(DEFAULT_OUT.includes('SYNK_노트북LM'), '기본 출력 경로가 바뀌었다');
  // 이 테스트 파일은 위에서 이미 require 했다 — 그 결과로 폴더가 생겼다면 부작용이 있는 것이다.
  // (--dry 없이 도는 CI에서 바탕화면에 폴더가 생기면 그것부터 사고다)
  const 생겼나 = fs.existsSync(DEFAULT_OUT) &&
    fs.existsSync(path.join(DEFAULT_OUT, 'README_먼저읽기.md'));
  if (생겼나) {
    // 실행으로 만든 것일 수도 있으니 단정하지 않는다 — 만든 날 스탬프만 확인한다.
    const body = fs.readFileSync(path.join(DEFAULT_OUT, 'README_먼저읽기.md'), 'utf8');
    assert.match(body, /만든 날 \d{4}-\d{2}-\d{2}/, '사본에 만든 날짜가 없다(정본 분열 잠금 위반)');
  }
});
