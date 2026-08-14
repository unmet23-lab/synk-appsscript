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
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

/* 🔑 판정(옛 글자 범위 · 대상 확장자 · 면제 목록 · 처방문)은 **여기 없다** — `tools/lib/옛글자.js`
 *   하나가 진다. 2026-08-12 까지는 이 파일이 판정을 들고 있었고, 그래서 pre-commit 이 같은
 *   규칙을 세우려면 사본을 만들 수밖에 없었다(F351·F379). 같은 판정을 두 곳에 적으면
 *   갈라지고, 갈라지는 방향은 언제나 「통과」다(CLAUDE.md 신뢰성 ④).
 *   이 파일이 지는 몫은 두 가지다: ①실저장소·형제를 훑는 **수집** ②픽스처로 재는 **탐지력**. */
const { 옛글자, 대상인가, 걸린줄, 처방 } = require('../tools/lib/옛글자.js');

function 추적파일(뿌리) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: 뿌리, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split('\0').filter(Boolean).filter(대상인가);
}

/* 🔴 **0건과 「아무것도 안 봤다」가 같은 모양이다** — cwd 가 어긋나거나 목록이 비면 이 검사는
 *   조용히 초록이 된다. 그래서 훑기 전에 「몇 개를 열었나」를 먼저 못박는다. 저장소가 없는
 *   경우는 여기 오기 전에 skip 으로 갈린다. */
function 훑은수(뿌리) {
  const n = 추적파일(뿌리).length;
  assert.ok(n > 0, `${뿌리} 에서 대상 파일을 하나도 못 찾았다 — 검사가 아무것도 안 본 채 통과할 뻔했다`);
  return n;
}

/** 한 저장소를 훑어 `파일:줄  U+xxxx` 목록을 낸다 — 빈 배열이면 깨끗하다. */
function 걸린곳(뿌리) {
  const 결과 = [];
  for (const f of 추적파일(뿌리)) {
    let t;
    try { t = fs.readFileSync(path.join(뿌리, f), 'utf8'); } catch { continue; }
    결과.push(...걸린줄(f, t));
  }
  return 결과;
}

test('저장소 텍스트에 옛 글자(한자·가나)가 없다', () => {
  훑은수(ROOT);
  assert.deepStrictEqual(걸린곳(ROOT), [], 처방);
});

/* 🔴 **학생이 보는 글자는 여기 없다** — 앱 화면·계약 문구·Edge Function 은 전부 형제 저장소에 산다.
 *   이 검사가 한 저장소에서 멈춰 있는 동안 그쪽은 아무도 안 봤다(F167 · F190 과 같은 형제 사각).
 * ⚠ 형제는 repo **밖 환경**이라 CI 에는 없다 — 없을 때 **조용히 통과시키지 않고 skip 으로 드러낸다**.
 *   통과와 미실행이 같은 모양이면 그 초록은 아무 말도 안 한 것이다. 탐지력은 아래 픽스처가 진다. */
const 형제 = path.join(ROOT, '..', 'SYNK-talk');
test('형제 저장소 SYNK-talk 텍스트에도 옛 글자가 없다', (t) => {
  if (!fs.existsSync(path.join(형제, '.git'))) {
    return t.skip('형제 저장소 SYNK-talk 가 이 기계에 없다 — 실물 대조는 로컬에서만');
  }
  훑은수(형제);
  assert.deepStrictEqual(걸린곳(형제), [], 처방);
});

/* 🔴 **면제는 「다른 층이 재고 있을 때만」 정당하다** — 안 그러면 이 예외는 그냥 눈을 감은 것이다.
 *   그래서 예외의 근거(형제 채점기의 ④문자 축)가 살아 있는지를 기계로 못박는다. 축을 지우면
 *   여기가 빨개져 「출력 파일을 이제 아무도 안 본다」가 드러난다. */
test('eval 출력 면제의 근거 — 형제 채점기가 그 축을 실제로 재고 있다', (t) => {
  const 채점기 = path.join(형제, 'tools', 'eval-score.js');
  if (!fs.existsSync(채점기)) {
    return t.skip('형제 저장소 SYNK-talk 가 이 기계에 없다 — 근거 대조는 로컬에서만');
  }
  const src = fs.readFileSync(채점기, 'utf8');
  assert.match(src, /function 문자판정\(/,
    '형제 채점기에 문자 축이 없다 — 그러면 위 `evals/출력_*` 면제는 근거를 잃는다(아무도 안 보게 된다)');
  assert.match(src, /문자혼입: \(\(\) =>/,
    '채점 요약이 문자 축을 안 낸다 — 재기만 하고 보고를 안 하면 판마다 아무도 못 본다');
  assert.match(src, /문자혼입\.건수 === 0/,
    '채점 종료코드가 문자 축을 안 본다 — 한자가 나가도 초록으로 끝난다');
});

/* 🔴 반입 스킬 면제(`.claude/skills/last30days/`)도 근거가 살아 있어야 한다 — 근거는
 *   「우리가 쓴 글이 아니라 반입물」이라는 프로비넌스다. `skills-lock.json` 에서 항목이
 *   사라지면(우리 것이 됐거나 출처를 잃었으면) 면제는 눈감기가 되므로 여기서 빨개진다. */
test('반입 스킬 면제의 근거 — skills-lock.json 에 그 스킬의 프로비넌스가 실재한다', () => {
  const 잠금 = JSON.parse(fs.readFileSync(path.join(ROOT, 'skills-lock.json'), 'utf8'));
  const 항목 = 잠금.skills && 잠금.skills.last30days;
  assert.ok(항목 && 항목.source && 항목.computedHash,
    'skills-lock.json 에 last30days 프로비넌스가 없다 — 그러면 옛글자 면제(`tools/lib/옛글자.js`)는 '
    + '근거를 잃는다: 면제를 지우든지 프로비넌스를 되살리든지 **같은 커밋**에서 정한다');
  /* 좁음 검사 — 면제가 스킬 «계열»로 넓어지면 다음 반입물이 판정 없이 지나간다. */
  assert.ok(대상인가('.claude/skills/synk-brand/SKILL.md'),
    '면제가 last30days 밖 스킬까지 삼킨다 — 좁게(그 스킬 하나) 유지한다');
  assert.ok(!대상인가('.claude/skills/last30days/scripts/lib/cjk.py'),
    '반입 스킬 면제가 실제로 안 걸린다 — 이 검사와 면제 목록이 갈라졌다');
});

test('탐지력 — 면제는 «기록»에만 걸리고 우리가 쓴 글에는 안 걸린다', () => {
  const 사본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-문서문자면제-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: 사본 });
    const 글자 = String.fromCodePoint(0x683C);           // 실제로 나온 그 자리(U+683C)
    fs.mkdirSync(path.join(사본, 'evals'));
    fs.mkdirSync(path.join(사본, 'src'));
    fs.mkdirSync(path.join(사본, 'docs/_ops/장부'), { recursive: true });
    const 쓰기 = (p, s) => fs.writeFileSync(path.join(사본, p), s, 'utf8');
    const 파일들 = [
      ['evals/출력_v9.json', `{"항목":[{"오늘의포인트":"${글자}"}]}\n`],   // 모델이 낸 기록 — 면제
      ['docs/_ops/장부/F999.md', `| F999 | 옛 사고 인용 ${글자} |\n`],     // 신고문이 사고를 인용한다 — 면제
      ['evals/픽스처.json', `{"항목":[{"입력":"${글자}"}]}\n`],            // 우리가 쓴다 — 대상
      ['evals/결과.md', `측정 결과 ${글자}\n`],                            // 우리가 쓴다 — 대상
      ['src/출력_화면.json', `{"라벨":"${글자}"}\n`],                      // 이름만 닮았다 — 대상
      ['docs/_ops/장부점검.md', `장부 점검 메모 ${글자}\n`],               // 이름만 닮았다(폴더가 아니다) — 대상
    ];
    파일들.forEach(([p, s]) => 쓰기(p, s));
    execFileSync('git', ['add', ...파일들.map(([p]) => p)], { cwd: 사본 });

    assert.deepStrictEqual(
      걸린곳(사본).sort(),
      ['docs/_ops/장부점검.md:1  U+683C', 'evals/결과.md:1  U+683C',
        'evals/픽스처.json:1  U+683C', 'src/출력_화면.json:1  U+683C'],
      '면제가 넓거나 좁다 — 기록 둘(evals/출력_*.json · docs/_ops/장부/)만 빠지고 나머지 넷은 그대로 걸려야 한다'
    );
  } finally {
    fs.rmSync(사본, { recursive: true, force: true, maxRetries: 3 });
  }
});

test('탐지력 — 픽스처의 옛 글자는 잡고, 세 문자는 통과시킨다', () => {
  const 한자 = String.fromCodePoint(0x6703);      // 한자 한 자
  const 가나 = String.fromCodePoint(0x3042);      // 히라가나 한 자
  const 확장A = String.fromCodePoint(0x3400);     // 한자 확장A
  // [vNEXT] 리뷰 P2-① 확장분 — 구판 클래스가 «통과»로 흘리던 네 구역(근거=hooks/lib/옛글자.js 머리말)
  const 호환한자 = String.fromCodePoint(0xf914);  // 한국어 독음 호환한자(KS 왕복 구역)
  const 반각가나 = String.fromCodePoint(0xff71);  // 반각 가타카나
  const 확장B = String.fromCodePoint(0x20000);    // astral 한자(2면 머리 — 서러게이트 쌍)
  const 가나보충 = String.fromCodePoint(0x1b000); // astral 가나 보충
  for (const c of [한자, 가나, 확장A, 호환한자, 반각가나, 확장B, 가나보충]) {
    assert.ok(옛글자.test(`앞 ${c} 뒤`), `못 잡는다: U+${c.codePointAt(0).toString(16)}`);
  }
  // 거짓양성 — 실제로 쓰는 세 문자와 기호는 건드리지 않는다
  for (const s of ['한글 본문입니다', 'Latin text 123', 'Монгол хэл · Өө Үү',
    '기호 ₮ № → ✅ 🔴 · ─ ⓐ', '코드 const a = 1;']) {
    assert.ok(!옛글자.test(s), `거짓양성: ${s}`);
  }
});

/* 🔴 정규식이 잡는 것과 **검사가 잡는 것**은 다르다 — 위 검사는 문자열만 보고 지나간다.
 *   확장자 목록·`git ls-files`·읽기까지 이어진 실제 통로를 한 번 밟아야 「.ts 를 본다」가 증명된다.
 *   실저장소는 0자라 탐지력을 못 재고(위반이 없으면 검사가 죽어도 초록이다), 그 몫은 픽스처가 진다. */
test('탐지력 — 픽스처 저장소의 .ts 안 옛 글자를 통로 끝까지 밟아 잡는다', () => {
  const 사본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-문서문자-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: 사본 });
    // 소스에 그 글자를 안 적는다 — 적으면 이 파일이 자기 검사에 걸린다(머리말 참조).
    fs.writeFileSync(path.join(사본, 'index.ts'), `const 인사 = '${String.fromCodePoint(0x6703)}';\n`, 'utf8');
    fs.writeFileSync(path.join(사본, '깨끗한 문서.md'), '한글 · Latin · Монгол\n', 'utf8');
    fs.writeFileSync(path.join(사본, '그림.bin'), `${String.fromCodePoint(0x6703)}\n`, 'utf8');  // 대상 밖 확장자
    execFileSync('git', ['add', 'index.ts', '깨끗한 문서.md', '그림.bin'], { cwd: 사본 });

    const 잡힌것 = 걸린곳(사본);
    assert.deepStrictEqual(잡힌것, ['index.ts:1  U+6703'],
      `.ts 한 자리만 잡아야 한다(한글 파일명은 -z 로 그대로 와야 하고, 대상 밖 확장자는 안 열린다): ${JSON.stringify(잡힌것)}`);
  } finally {
    fs.rmSync(사본, { recursive: true, force: true, maxRetries: 3 });
  }
});
