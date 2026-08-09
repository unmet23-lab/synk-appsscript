/**
 * **라이브로 나가는 코드에 은퇴한 대외 문구가 없다.**
 *
 * 왜 기계로 막나: 2026-08-09 에 구 슬로건을 걷으면서 상담 AI(`contents_상담AI.js`)는 고쳤는데
 * **교실 스크린(`엔진_운영배치.js` 📺 SYNK LIVE 푸터)을 놓쳤다.** 문서 정본만 훑고 코드층을
 * 안 본 것이고, 그 자리는 학원에 띄우는 대외 화면이라 매일 학생·학부모·방문자가 읽는다.
 * 낱말 교체는 문서 20벌을 고쳐도 코드 한 줄이 남으면 대외에서는 안 바뀐 것이다.
 *
 * ⚠ **범위는 배포 파일뿐이다.** docs·장부·메모리·인계문은 「구 슬로건은 이것이었다」를
 *   인용해야 하고, 인용을 막으면 이력이 자기 과거를 못 적는다.
 *
 * ⚠ **낱말이 아니라 슬로건만 본다.** 「왕관」·「몬스터」는 장부 §1 이 *학부모 접점·문서 표기*
 *   에서만 교체하고 **앱 내부 기능명은 유지**로 못박았다(메모리 🚫 전면 개명). 기계는 그
 *   경계를 못 가르므로 여기서 잡으면 거짓양성이 쏟아지고, 그러면 검사를 끄게 된다.
 *   슬로건은 그 경계가 없다 — 배포 코드 어디에도 있을 이유가 없는 문자열이다.
 *
 * ⚠ 이 파일에 그 문구를 **그대로 적지 않는다** — 적으면 이 검사가 자기 소스에 걸린다.
 *   `tests/문서문자.test.js` 가 같은 함정을 먼저 밟았다(가드는 자기 처방·자기 소스에 눈이 먼다).
 *   조각으로 조립해 쓴다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
/* 배포 범위 판정을 여기 베끼지 않는다 — 같은 판정을 두 곳에 적으면 갈린다(CLAUDE.md 신뢰성 ④).
 * `.claspignore` 정본을 읽는 그 함수를 그대로 쓴다. */
const { 배포집합, claspProjects } = require('../tools/배포판점검.js');

/* 은퇴 문구 = 구 슬로건의 두 조각. **각각** 잡는다 — 한쪽만 남은 반쪽 잔재도 잔재다.
 * 소스에 온전한 형태로 적히지 않도록 조립한다(머리말 참조).
 * 표기 흔들림(쉼표 유무·띄어쓰기·「넘어서」)을 흡수한다 — 사람이 실제로 쓰는 표기로 검사한다. */
const 은퇴 = [
  { id: '구슬로건-앞', re: new RegExp('점수' + '를\\s*' + '넘어'), 왜: '구 슬로건 앞조각' },
  { id: '구슬로건-뒤', re: new RegExp('삶' + '을\\s*' + '설계'), 왜: '구 슬로건 뒷조각' },
];

const 처방 = [
  '유호 확정 08-09 — 대외 슬로건은 「정원은 16명, 선생님은 17명입니다」다(정본 docs/SYNK_철학.md).',
  '⚠ 대외 집행면에 17 을 낼 때는 정체 부연 1줄이 **필수**다(docs/문서_지도.md 조건) —',
  '   예: 「한 명 한 명에게 나만의 선생님, 교실엔 진짜 선생님」. AI 라는 낱말은 넣지 않는다.',
  '규칙 정본 = docs/_ops/철학_리라이팅_장부.md §1.',
].join('\n');

/** 한 배포 프로젝트를 훑어 `파일:줄  id` 목록을 낸다 — 빈 배열이면 깨끗하다. */
function 걸린곳(projRoot, root = ROOT) {
  const 결과 = [];
  for (const rel of 배포집합(projRoot, root)) {
    let t;
    try { t = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    t.split(/\r?\n/).forEach((ln, i) => {
      for (const w of 은퇴) if (w.re.test(ln)) 결과.push(`${rel}:${i + 1}  ${w.id}(${w.왜})`);
    });
  }
  return 결과;
}

/* 🔴 **0건과 「아무것도 안 봤다」가 같은 모양이다** — 프로젝트 목록이나 배포집합이 비면 이
 *   검사는 조용히 초록이 된다. 훑기 전에 분모를 못박는다(F207). */
test('배포 파일에 은퇴한 대외 문구가 없다 — 분모를 밝히고 훑는다', () => {
  const 프로젝트들 = claspProjects();
  assert.ok(프로젝트들.length > 0, 'clasp 프로젝트를 하나도 못 찾았다 — 검사가 아무것도 안 본 채 통과할 뻔했다');

  const 걸린것 = [];
  let 훑은파일 = 0;
  for (const p of 프로젝트들) {
    const 집합 = 배포집합(p, ROOT);
    assert.ok(집합.length > 0, `${path.relative(ROOT, p) || '(루트)'} 의 배포집합이 비었다 — 훑을 것이 없다`);
    훑은파일 += 집합.length;
    걸린것.push(...걸린곳(p, ROOT));
  }
  assert.ok(훑은파일 > 0, '배포 파일을 하나도 안 열었다');
  assert.deepStrictEqual(걸린것, [], 처방);
});

/* 🔴 실저장소는 이제 0건이라 **탐지력을 못 잰다**(위반이 없으면 검사가 죽어도 초록이다).
 *   그 몫은 픽스처가 진다 — 실저장소에 버그가 남아 있기를 요구하는 회귀를 쓰지 않는다. */
test('탐지력 — 배포 파일 안의 은퇴 문구를 통로 끝까지 밟아 잡는다', () => {
  const 사본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-은퇴문구-'));
  try {
    fs.writeFileSync(path.join(사본, '.clasp.json'), JSON.stringify({ scriptId: 'x', rootDir: '' }), 'utf8');
    // 배포 대상 = 루트 .js (실저장소 .claspignore 와 같은 통로로 판정된다)
    fs.writeFileSync(path.join(사본, 'Code.js'),
      `const 푸터 = 'SYNK LAB · ${'점수'}를 ${'넘어'}, ${'삶'}을 ${'설계'}합니다';\n`, 'utf8');
    fs.writeFileSync(path.join(사본, 'contents_깨끗.js'),
      "const 푸터2 = 'SYNK LAB · 정원은 16명, 선생님은 17명입니다';\n", 'utf8');

    const 잡힌것 = 걸린곳(사본, 사본);
    assert.deepStrictEqual(잡힌것.map((s) => s.split('  ')[0]).sort(), ['Code.js:1', 'Code.js:1'],
      `구 슬로건 두 조각을 같은 줄에서 둘 다 잡아야 하고, 새 슬로건 줄은 통과해야 한다: ${JSON.stringify(잡힌것)}`);
  } finally {
    fs.rmSync(사본, { recursive: true, force: true, maxRetries: 3 });
  }
});

/* 🔴 **거짓양성이 곧 우회 손버릇이 된다** — 새 슬로건과 그 부연, 그리고 정상적인 한국어가
 *   걸리면 다음 사람이 이 검사를 끈다. 통과해야 하는 것을 명시적으로 못박는다. */
test('거짓양성 — 새 슬로건·부연·평범한 문장은 통과한다', () => {
  const 통과해야 = [
    'SYNK LAB · 정원은 16명, 선생님은 17명입니다',
    '한 명 한 명에게 나만의 선생님, 교실엔 진짜 선생님',
    '합격을 넘어 아이가 추구하는 삶을 함께 그리는 곳입니다',   // 새 화법 — 「넘어」·「삶」이 둘 다 있지만 은퇴 조각은 아니다
    '점수가 오르면 알려드려요',
    '수업 설계는 시즌마다 갱신됩니다',
  ];
  for (const s of 통과해야) {
    for (const w of 은퇴) assert.ok(!w.re.test(s), `거짓양성(${w.id}): ${s}`);
  }
});
