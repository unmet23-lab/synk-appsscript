/**
 * 쓰는 문자는 **한글·몽골어(키릴)·영어 셋뿐** — 2026-08-07 유호님 확정.
 *
 * 왜 기계로 막나: 08-07 에 인쇄본 16종 중 8종이 브랜드 폰트 밖 글자로 나간 것을 고치면서
 * 옛 글자(한자·가나)를 걷었는데, **md 만 보고 정본 텍스트·엔진 코드·학생이 보는 문구를 놓쳤다.**
 * 사람 눈으로 훑는 방식은 이번에도 반쪽이었다(2차 스캔에서 26자리가 더 나왔다).
 *
 * 왜 안 쓰나(재론 방지): 학생도 강사도 한자권이 아니고(코어 강사 3명이 몽골인) TOPIK 에도
 * 안 나온다. 「생」을 알면 생활·학생·인생이 묶이는 효과는 한글 음절만으로 전부 나온다.
 *
 * ⚠ 이 파일에도 그 글자를 **적지 않는다** — 적으면 이 검사가 자기 소스에 걸린다.
 *   필요한 자리는 전부 코드포인트로 쓴다(픽스처 포함).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

/* 옛 글자 = 한자(통합·확장A) + 일본 가나. 키릴·라틴·한글은 당연히 통과한다.
 * 🔴 범위 경계를 **글자로 적지 않는다** — 적으면 이 파일이 자기 검사에 걸린다.
 *   실제로 그랬다: 커밋 전에는 `git ls-files` 밖이라 스캔 대상이 아니어서 **초록이었고**,
 *   커밋되어 추적되는 순간 빨개졌다. 가드가 자기를 못 보는 동안의 초록은 초록이 아니다. */
const 옛글자 = new RegExp('[\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF]', 'u');

/** 사람이 읽는 텍스트만 — 바이너리·폰트·PDF 는 볼 것도 없고 열면 느리다 */
const 대상확장자 = new Set(['.js', '.md', '.html', '.json', '.txt', '.py', '.css', '.sql', '.yml', '.yaml']);

/* 저장소 **밖**의 것은 우리 규칙이 아니다 — 외부 클론과 남의 작업 트리는 뺀다.
 * git 추적 목록을 쓰므로 워크트리(.claude/worktrees)는 애초에 안 들어온다. */
const 제외 = [/^ARC-AGI-3-Agents\//, /(^|\/)node_modules\//, /^docs\/_ops\/인계문/, /^docs\/_ops\/마찰신호\.md$/];

function 추적파일() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split('\0').filter(Boolean)
    .filter((f) => 대상확장자.has(path.extname(f).toLowerCase()))
    .filter((f) => !제외.some((re) => re.test(f)));
}

test('저장소 텍스트에 옛 글자(한자·가나)가 없다', () => {
  const 걸린곳 = [];
  for (const f of 추적파일()) {
    let t;
    try { t = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { continue; }
    if (!옛글자.test(t)) continue;                       // 파일 단위로 먼저 걸러 빠르게
    t.split(/\r?\n/).forEach((ln, i) => {
      const ch = [...new Set([...ln].filter((c) => 옛글자.test(c)))];
      if (ch.length) {
        걸린곳.push(`${f}:${i + 1}  ${ch.map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase()).join(' ')}`);
      }
    });
  }
  assert.deepStrictEqual(걸린곳, [],
    '유호님 확정 — 쓰는 문자는 한글·몽골어·영어 셋뿐이다. 위 자리를 한글로 바꿔라\n'
    + '(설명하려고 예시를 적는 것도 안 된다 — 필요하면 String.fromCodePoint 로 쓴다)');
});

test('탐지력 — 픽스처의 옛 글자는 잡고, 세 문자는 통과시킨다', () => {
  const 한자 = String.fromCodePoint(0x6703);      // 한자 한 자
  const 가나 = String.fromCodePoint(0x3042);      // 히라가나 한 자
  const 확장A = String.fromCodePoint(0x3400);     // 한자 확장A
  for (const c of [한자, 가나, 확장A]) {
    assert.ok(옛글자.test(`앞 ${c} 뒤`), `못 잡는다: U+${c.codePointAt(0).toString(16)}`);
  }
  // 거짓양성 — 실제로 쓰는 세 문자와 기호는 건드리지 않는다
  for (const s of ['한글 본문입니다', 'Latin text 123', 'Монгол хэл · Өө Үү',
    '기호 ₮ № → ✅ 🔴 · ─ ⓐ', '코드 const a = 1;']) {
    assert.ok(!옛글자.test(s), `거짓양성: ${s}`);
  }
});
