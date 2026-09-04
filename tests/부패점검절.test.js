'use strict';
/**
 * tools/rot-check.js 의 **신설 절 다섯**과 «하루 눌림» 열쇠를 지키는 회귀.
 *
 * 🔴 왜 있나 — 그 절들이 서던 판(08-29~08-30)에 이것을 부르는 시험이 **0건**이었다.
 *   그 파일 자신이 세는 병("이름은 부르는데 없는 파일" = 지켜진다고 적혀 있으나 지키는 자가 없음)을
 *   그 파일이 스스로 하나 만든 상태였다. 다음 대청소가 이 절들을 지워도 아무도 못 잡는다.
 *
 * 🔑 규율 둘 (이 판의 검증이 잡은 병 그대로):
 *   ① **실물 저장소를 훑지 않는다.** 전부 임시 폴더 픽스처다 — 실물을 재면 느리고 기계마다 다르고,
 *      「오늘 우연히 0건」이 초록으로 굳는다.
 *   ② **살아 있음뿐 아니라 «죽었을 때 우는가»를 같이 센다.** 검사가 눈이 멀고도 0건을 내면
 *      이 도구는 존재 이유를 잃는다. 그래서 각 절마다 «눈이 먼» 갈래를 따로 만들어 신고를 확인한다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 도구 = path.join(__dirname, '..', 'tools', 'rot-check.js');
const R = require(도구);

const 백틱 = String.fromCharCode(96);

/* 🔴 픽스처 «경로»를 이 파일에 한 조각으로 적지 않는다 — 그러면 실물 저장소를 훑는 ③ 이
 *   이 시험 파일을 읽어 «없는 파일»을 스스로 만들어 낸다(08-30 실측: 이 파일 첫 판이 셋을 만들었다.
 *   그 절 머리말이 같은 사고를 이미 한 번 적어 뒀다 — 검사기가 제 꼬리를 문 자리).
 *   이어 붙이면 원문에는 따옴표가 끼어 그 절의 정규식에 안 걸리고, 값은 그대로다. */
const 시험경로 = (이름) => 'tests/' + 이름 + '.test' + '.js';
const 도구경로 = (이름, 확장) => 'tools/' + 이름 + (확장 || '.js');

function 픽스처(fn) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-부패-'));
  try { return fn(뿌리); } finally { fs.rmSync(뿌리, { recursive: true, force: true }); }
}

function 적기(뿌리, 상대, 내용) {
  const p = path.join(뿌리, ...상대.split('/'));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 내용, 'utf8');
  return p;
}

/** 환경변수를 잠깐 갈아 끼운다 — 시험이 서로의 환경을 물려주면 안 된다. */
function 환경(이름, 값, fn) {
  const 옛 = process.env[이름];
  if (값 === null) delete process.env[이름]; else process.env[이름] = 값;
  try { return fn(); } finally {
    if (옛 === undefined) delete process.env[이름]; else process.env[이름] = 옛;
  }
}

/* ── 0. 절이 살아 있는가 (대청소 방지) ─────────────────────────────────────── */

test('신설 절 다섯과 눌림 열쇠가 계속 내보내진다 — 지워지면 여기서 걸린다', () => {
  for (const 이름 of ['이름부름Section', '남은손Section', '상주Section', '게이트Section',
    '밤굽기Section', '부패키', '눌림갱신', '그날', 'render', 'collect']) {
    assert.strictEqual(typeof R[이름], 'function', 이름 + ' 이 사라졌다');
  }
  assert.ok(Array.isArray(R.상주선언), '상주선언 표가 사라졌다');
  assert.strictEqual(typeof R.게이트_중앙값_한도_ms, 'number', '게이트 한도가 사라졌다');
});

/* ── ③ 이름은 부르는데 없는 파일 ───────────────────────────────────────────── */

test('③ 부름을 «여기 실재 / 형제 실재 / 어디에도 없음» 셋으로 가른다', () => {
  픽스처((뿌리) => {
    const 형 = path.join(path.dirname(뿌리), path.basename(뿌리) + '-형제');
    fs.mkdirSync(path.join(형, '.git'), { recursive: true });
    fs.mkdirSync(path.join(형, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(형, 'tests', '건너편' + '.test' + '.js'), '// 형제에 실재');
    try {
      적기(뿌리, 시험경로('여기있다'), '// 실재');
      적기(뿌리, 도구경로('부르는쪽'), [
        '// 이 자리는 ' + 시험경로('여기있다') + ' 가 지킨다',
        '// 저 자리는 ' + 시험경로('건너편') + ' 가 지킨다',
        '// 그 자리는 ' + 시험경로('사라진것') + ' 가 지킨다',
      ].join('\n'));

      const v = 환경('SYNK_OWNER_SIBLINGS', '../' + path.basename(형),
        () => R.이름부름Section(뿌리));

      assert.strictEqual(v.측정, true);
      assert.strictEqual(v.종수, 3, '부름 종수 · 실측: ' + JSON.stringify(v));
      assert.strictEqual(v.실재, 1);
      assert.strictEqual(v.형제실재, 1);
      assert.strictEqual(v.없는것.length, 1);
      assert.strictEqual(v.없는것[0].이름, 시험경로('사라진것'));
      assert.strictEqual(v.줄수, 1);
      // 합계 = 갈래 + 갈래 + 갈래 (분모가 조용히 새면 여기서 걸린다)
      assert.strictEqual(v.실재 + v.형제실재 + v.없는것.length, v.종수);
    } finally {
      fs.rmSync(형, { recursive: true, force: true });
    }
  });
});

test('③ 🔴 형제를 못 찾으면 «0건»이 아니라 «못 쟀다» — 이 절이 눈이 먼 갈래', () => {
  픽스처((뿌리) => {
    적기(뿌리, 도구경로('부르는쪽'), '// ' + 시험경로('사라진것') + ' 가 지킨다');
    const v = 환경('SYNK_OWNER_SIBLINGS', path.join(뿌리, '없는형제'),
      () => R.이름부름Section(뿌리));
    assert.strictEqual(v.측정, false, '형제 0인데 판정을 내놨다 — 교차참조가 통째로 적색이 된다');
    assert.match(v.사유, /형제/);
  });
});

test('③ 면제 둘 — 삭제 표식이 붙은 줄 · 시험 파일 안 따옴표 픽스처', () => {
  픽스처((뿌리) => {
    const 형 = path.join(path.dirname(뿌리), path.basename(뿌리) + '-형제');
    fs.mkdirSync(path.join(형, '.git'), { recursive: true });
    try {
      적기(뿌리, 도구경로('부르는쪽'), '// ' + 시험경로('걷힌것') + ' 는 ⚠삭제됨');
      적기(뿌리, 시험경로('픽스처쪽'),
        "const 가짜 = '" + 시험경로('픽스처값') + "';\n" +
        '// ' + 백틱 + 시험경로('산문강조') + 백틱 + ' 가 이 자리를 진다\n');

      const v = 환경('SYNK_OWNER_SIBLINGS', '../' + path.basename(형),
        () => R.이름부름Section(뿌리));

      const 이름들 = v.없는것.map((x) => x.이름);
      assert.ok(!이름들.includes(시험경로('걷힌것')), '삭제 표식 면제가 죽었다');
      assert.ok(!이름들.includes(시험경로('픽스처값')), '따옴표 픽스처 면제가 죽었다');
      assert.ok(이름들.includes(시험경로('산문강조')),
        '🔴 백틱까지 면제하면 진짜 신호가 걷힌다 — 08-30 에 그 규칙이 7줄을 삼켰다');
    } finally {
      fs.rmSync(형, { recursive: true, force: true });
    }
  });
});

/* 🔴 2026-09-04 신설 둘 — 그날 실측에서 이 절이 **91줄 중 90줄을 헛불렀다**(진짜는 1줄).
 *   면제가 새는 무늬가 둘이었고, 둘 다 「자를 안 재고 부르는 쪽을 고치면」 기록이 거짓이 되는 자리다. */
test('③ 면제 — `docs/_ops/` 밑 JSON 은 «코드»가 아니라 «기록»이다(세지 말고 세어서 밝힌다)', () => {
  픽스처((뿌리) => {
    const 형 = path.join(path.dirname(뿌리), path.basename(뿌리) + '-형제');
    fs.mkdirSync(path.join(형, '.git'), { recursive: true });
    try {
      // 운영 기록의 이름은 «부름»이 아니라 ⓐ앞으로 지을 일감이거나 ⓑ「없다」는 지적의 인용이다.
      적기(뿌리, 'docs/_ops/어떤판/심사.json',
        JSON.stringify({ 소견: '세는 자 = ' + 시험경로('앞으로지을것') + ' · 짓는다' }));
      // 같은 폴더의 .js 는 «코드»라 그대로 잰다 — 면제가 폴더째 먹으면 진짜가 묻힌다.
      적기(뿌리, 'docs/_ops/어떤판/scripts/돌리개.js', '// 이 자리는 ' + 시험경로('진짜없는것') + ' 가 지킨다');

      const v = 환경('SYNK_OWNER_SIBLINGS', '../' + path.basename(형),
        () => R.이름부름Section(뿌리));

      const 이름들 = v.없는것.map((x) => x.이름);
      assert.ok(!이름들.includes(시험경로('앞으로지을것')),
        '🔴 기록 JSON 면제가 죽었다 — 과거 기록은 고칠 수 없어 원리상 영영 적색이 된다');
      assert.ok(이름들.includes(시험경로('진짜없는것')),
        '🔴 면제가 폴더째 먹었다 — `docs/_ops/` 밑 .js 는 코드라 그대로 재야 한다');
      assert.strictEqual(v.기록JSON, 1,
        '건너뛴 수를 안 세면 분모가 조용히 샌다 — 이 도구가 고치려는 바로 그 병이다');
    } finally {
      fs.rmSync(형, { recursive: true, force: true });
    }
  });
});

test('③ 픽스처 면제는 «문자열 구간 안»으로 잰다 — 따옴표에 딱 붙지 않아도 값이다', () => {
  픽스처((뿌리) => {
    const 형 = path.join(path.dirname(뿌리), path.basename(뿌리) + '-형제');
    fs.mkdirSync(path.join(형, '.git'), { recursive: true });
    try {
      적기(뿌리, 시험경로('픽스처쪽'), [
        // ⓐ 따옴표 «안»에 경로 뒤로 말이 더 붙은 기대값 — 앞판은 뒤 글자가 공백이라 면제가 풀렸다
        "assert.deepStrictEqual(r, ['" + 시험경로('뒤에말붙음') + " (고쳤다)']);",
        // ⓑ 앞에 한 겹 더 붙은 경로 — 매치가 중간부터라 앞 글자가 빗금이었다
        "assert.ok(시험파일인가('a/" + 시험경로('앞에겹붙음') + "'));",
        // ⓒ 산문 강조(백틱)는 여전히 «부름»이다 — 08-30 에 그 규칙이 진짜 7줄을 삼켰다
        '// ' + 백틱 + 시험경로('산문강조2') + 백틱 + ' 가 이 자리를 진다',
      ].join('\n'));

      const v = 환경('SYNK_OWNER_SIBLINGS', '../' + path.basename(형),
        () => R.이름부름Section(뿌리));

      const 이름들 = v.없는것.map((x) => x.이름);
      assert.ok(!이름들.includes(시험경로('뒤에말붙음')), '문자열 안인데 부름으로 셌다(ⓐ)');
      assert.ok(!이름들.includes(시험경로('앞에겹붙음')), '문자열 안인데 부름으로 셌다(ⓑ)');
      assert.ok(이름들.includes(시험경로('산문강조2')),
        '🔴 백틱까지 면제하면 진짜 신호가 걷힌다 — 면제가 병이 된 자리');
    } finally {
      fs.rmSync(형, { recursive: true, force: true });
    }
  });
});

test('③ 확장자 뒤에 글자가 이어지면 다른 파일이다 — .json 을 .js 로 잡지 않는다', () => {
  픽스처((뿌리) => {
    const 형 = path.join(path.dirname(뿌리), path.basename(뿌리) + '-형제');
    fs.mkdirSync(path.join(형, '.git'), { recursive: true });
    try {
      적기(뿌리, 도구경로('부르는쪽'), '// 값은 ' + 도구경로('설정값', '.json') + ' 에 있다');
      const v = 환경('SYNK_OWNER_SIBLINGS', '../' + path.basename(형),
        () => R.이름부름Section(뿌리));
      assert.deepStrictEqual(v.없는것.map((x) => x.이름), [],
        도구경로('설정값', '.json') + ' 이 «.js» 로 잘려 없는 파일이 됐다');
    } finally {
      fs.rmSync(형, { recursive: true, force: true });
    }
  });
});

/* ── ④ 남은 손 ─────────────────────────────────────────────────────────────── */

test('④ 분모를 «머리글»이 정한다 — 확정 칸이 없는 안내문은 분모 밖', () => {
  픽스처((뿌리) => {
    적기(뿌리, 'docs/_ops/검수꾸러미/데이터.tsv',
      ['원문\tМонгол — баталгаажсан', '가\t', '나\t확정', '다\t'].join('\n'));
    적기(뿌리, 'docs/_ops/검수꾸러미/안내문.tsv', ['제목\t설명', '읽는 법\t이렇게'].join('\n'));
    const v = R.남은손Section(뿌리);
    assert.strictEqual(v.검수.측정, true);
    assert.strictEqual(v.검수.분모, 3, '안내문 행이 분모에 섞였다');
    assert.strictEqual(v.검수.찬칸, 1);
    assert.strictEqual(v.검수.남음, 2);
    assert.strictEqual(v.검수.시트, 1);
    assert.strictEqual(v.검수.안내문, 1);
    assert.strictEqual(v.검수.왕복, 0);
  });
});

test('④ 회수 폴더가 있으면 왕복을 센다', () => {
  픽스처((뿌리) => {
    적기(뿌리, 'docs/_ops/검수꾸러미/데이터.tsv', ['원문\tМонгол — баталгаажсан', '가\t'].join('\n'));
    적기(뿌리, 'docs/_ops/검수꾸러미/회수/1차.tsv', 'x');
    const v = R.남은손Section(뿌리);
    assert.strictEqual(v.검수.왕복, 1);
  });
});

test('④ 🔴 세는 도구가 없으면 «0건»이 아니라 «못 잼» — 눈이 먼 갈래 둘', () => {
  픽스처((뿌리) => {
    const v = R.남은손Section(뿌리);          // 꾸러미도 codex-review.js 도 없는 뿌리
    assert.strictEqual(v.검수.측정, false, '꾸러미가 없는데 0건으로 접었다');
    assert.strictEqual(v.codex.측정, false, 'codex 세는 쪽이 없는데 0건으로 접었다');
    assert.match(v.codex.사유, /codex-review\.js/);
  });
});

/* ── ⑤ 상주 총량 ───────────────────────────────────────────────────────────── */

/** philosophy-card 선언 한 줄을 픽스처로 짓는다(뽑기 정규식이 무는 그 문장). */
function 카드(값KB) {
  return ' * 전문을 싣지 않는다 — 매 턴 상주하는 CLAUDE.md(' + 값KB + 'KB)보다 크다.\n';
}

test('⑤ 선언이 실측과 눈금 이상 어긋나면 잡는다', () => {
  픽스처((뿌리) => {
    적기(뿌리, 'CLAUDE.md', 'x'.repeat(5632));           // 정확히 5.5KB
    적기(뿌리, '.claude/hooks/philosophy-card.js', 카드('21'));
    const v = R.상주Section(뿌리);
    assert.strictEqual(v.측정, true);
    assert.deepStrictEqual(v.못읽음, []);
    assert.strictEqual(v.어긋남.length, 1, '5.5KB 를 21KB 라 적었는데 안 잡았다');
    assert.strictEqual(v.어긋남[0].선언, 21);
    assert.strictEqual(v.어긋남[0].실측, 5.5);
  });
});

test('⑤ 눈금 아래 흔들림은 안 운다 — 매일 우는 자는 꺼진다', () => {
  픽스처((뿌리) => {
    적기(뿌리, 'CLAUDE.md', 'x'.repeat(5632));
    적기(뿌리, '.claude/hooks/philosophy-card.js', 카드('6.0'));   // |5.5-6.0|/6.0 = 8.3%
    const v = R.상주Section(뿌리);
    assert.deepStrictEqual(v.어긋남, [], '반올림 폭에 울었다');
    assert.deepStrictEqual(v.못읽음, []);
  });
});

test('⑤ 🔴 앵커가 죽으면 «어긋남 0»이 아니라 «선언을 못 읽었다»', () => {
  픽스처((뿌리) => {
    적기(뿌리, 'CLAUDE.md', 'x'.repeat(5632));
    적기(뿌리, '.claude/hooks/philosophy-card.js', ' * 문장이 바뀌어 앵커가 안 문다.\n');
    const v = R.상주Section(뿌리);
    assert.deepStrictEqual(v.어긋남, []);
    assert.strictEqual(v.못읽음.length, 1, '앵커가 죽었는데 조용히 0건이 됐다');
    assert.match(v.못읽음[0], /앵커/);
  });
});

test('⑤ 🔴 선언처 파일이 통째로 없어도 조용하지 않다', () => {
  픽스처((뿌리) => {
    적기(뿌리, 'CLAUDE.md', 'x'.repeat(5632));
    const v = R.상주Section(뿌리);
    assert.strictEqual(v.못읽음.length, 1);
    assert.match(v.못읽음[0], /파일 없음/);
  });
});

test('⑤ 🔴 잴 대상(실물)을 못 읽어도 조용하지 않다', () => {
  픽스처((뿌리) => {
    적기(뿌리, '.claude/hooks/philosophy-card.js', 카드('21'));   // CLAUDE.md 는 안 만든다
    const v = R.상주Section(뿌리);
    assert.deepStrictEqual(v.어긋남, []);
    assert.strictEqual(v.못읽음.length, 1);
    assert.match(v.못읽음[0], /실물을 못 읽었다/);
  });
});

test('⑤ 🔴 표가 비면 «0건»이 아니다 — 분모가 조용히 0이 되는 자리', () => {
  픽스처((뿌리) => {
    적기(뿌리, 'CLAUDE.md', 'x'.repeat(5632));
    적기(뿌리, '.claude/hooks/philosophy-card.js', 카드('21'));
    const 원본 = R.상주선언.slice();
    try {
      R.상주선언.length = 0;
      const v = R.상주Section(뿌리);
      assert.strictEqual(v.선언수, 0);
      assert.deepStrictEqual(v.어긋남, []);
      assert.strictEqual(v.못읽음.length, 1, '표가 비었는데 초록이 나왔다');
      assert.match(v.못읽음[0], /비었다/);
    } finally {
      R.상주선언.length = 0;
      R.상주선언.push(...원본);
    }
  });
  assert.ok(R.상주선언.length > 0, '표를 되돌려 놓지 못했다');
});

/* ── ⑥-㉠ 게이트 장부 ──────────────────────────────────────────────────────── */

function 게이트장부(뿌리, 줄들) {
  적기(뿌리, 'docs/_ops/게이트초.jsonl', 줄들.map((o) => JSON.stringify(o)).join('\n') + '\n');
}

test('⑥-㉠ 장부가 아직 없으면 조용하다 — 안 태어난 것은 부패가 아니다', () => {
  픽스처((뿌리) => {
    const v = R.게이트Section(뿌리);
    assert.strictEqual(v.측정, false);
    assert.strictEqual(v.아직, true);
  });
});

test('⑥-㉠ `합` 이 있으면 그것을, 없으면 게이트 표를 더한다 (「해당없음」은 0이 아니다)', () => {
  픽스처((뿌리) => {
    게이트장부(뿌리, [
      { 시각: 'a', 합: 1000 },
      { 시각: 'b', 게이트: { 갑: 300, 을: 200, 병: '해당없음' } },
      { 시각: 'c', 합: 3000 },
    ]);
    const v = R.게이트Section(뿌리);
    assert.strictEqual(v.측정, true);
    assert.strictEqual(v.커밋수, 3);
    assert.strictEqual(v.못읽은줄, 0);
    assert.strictEqual(v.중앙값ms, 1000, '가운데 값이 아니다 — 실측: ' + JSON.stringify(v));
    assert.strictEqual(v.한도ms, R.게이트_중앙값_한도_ms, '한도를 두 곳이 알고 있다');
  });
});

test('⑥-㉠ 최근 20커밋만 잰다 — 옛 폭주가 오늘 중앙값을 물들이지 않는다', () => {
  픽스처((뿌리) => {
    const 줄 = [];
    for (let i = 0; i < 5; i++) 줄.push({ 합: 100000 });
    for (let i = 0; i < 20; i++) 줄.push({ 합: 900 });
    게이트장부(뿌리, 줄);
    const v = R.게이트Section(뿌리);
    assert.strictEqual(v.커밋수, 25);
    assert.strictEqual(v.잰커밋, 20);
    assert.strictEqual(v.중앙값ms, 900);
  });
});

test('⑥-㉠ 🔴 모르는 모양뿐이면 «0건»이 아니라 «한 줄도 못 읽었다»', () => {
  픽스처((뿌리) => {
    게이트장부(뿌리, [{ 시각: 'a', 뭔가: '숫자 아님' }, { 시각: 'b' }]);
    const v = R.게이트Section(뿌리);
    assert.strictEqual(v.측정, false, '한 줄도 못 읽고 초록이 됐다');
    assert.match(v.사유, /못 읽었다/);
  });
});

/* ── ⑥-㉡ 밤굽기 도장 ──────────────────────────────────────────────────────── */

test('⑥-㉡ 도장이 없어도 «찍는 쪽»이 있으면 조용하다 — 안 구운 날이 정상', () => {
  픽스처((뿌리) => {
    적기(뿌리, 도구경로('밤굽기'), '// 찍는 쪽');
    const v = R.밤굽기Section(뿌리);
    assert.strictEqual(v.측정, false);
    assert.strictEqual(v.아직, true);
    assert.strictEqual(v.쓰는쪽, true);
  });
});

test('⑥-㉡ 🔴 도장도 없고 찍는 쪽도 없으면 조용하지 않다 — 이 절이 영원히 침묵하는 갈래', () => {
  픽스처((뿌리) => {
    const v = R.밤굽기Section(뿌리);
    assert.strictEqual(v.측정, false);
    assert.strictEqual(v.아직, false, '쓰는 자가 사라졌는데 «아직»으로 접었다');
    assert.strictEqual(v.쓰는쪽, false);
  });
});

test('⑥-㉡ 🔴 도장이 깨졌거나 규격이 다르면 «완주»로 읽지 않는다', () => {
  픽스처((뿌리) => {
    적기(뿌리, 도구경로('밤굽기'), '// 찍는 쪽');
    적기(뿌리, 'docs/_ops/밤굽기도장.json', '{ 이건 JSON 이 아니다');
    const 깨짐 = R.밤굽기Section(뿌리);
    assert.strictEqual(깨짐.측정, false);
    assert.match(깨짐.사유, /JSON/);

    적기(뿌리, 'docs/_ops/밤굽기도장.json', JSON.stringify({ 시각: '2026-08-30T00:00:00Z', 무엇: '까몽' }));
    const 규격 = R.밤굽기Section(뿌리);
    assert.strictEqual(규격.측정, false, '완주 칸이 없는데 판정을 내놨다');
    assert.match(규격.사유, /완주/);
  });
});

test('⑥-㉡ «착수» 상태는 나이를 같이 낸다 — 굽는 중과 죽은 것을 나이로 가른다', () => {
  픽스처((뿌리) => {
    적기(뿌리, 도구경로('밤굽기'), '// 찍는 쪽');
    const 세시간전 = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    적기(뿌리, 'docs/_ops/밤굽기도장.json',
      JSON.stringify({ 시각: 세시간전, 무엇: '까몽', 완주: false, 사유: '돌고 있다' }));
    const v = R.밤굽기Section(뿌리);
    assert.strictEqual(v.측정, true);
    assert.strictEqual(v.완주, false);
    assert.ok(v.나이시간 > 2.9 && v.나이시간 < 3.1, '나이시간 = ' + v.나이시간);

    적기(뿌리, 'docs/_ops/밤굽기도장.json',
      JSON.stringify({ 시각: 세시간전, 무엇: '까몽', 완주: true, 사유: '' }));
    assert.strictEqual(R.밤굽기Section(뿌리).완주, true);
  });
});

/* ── 하루 눌림 열쇠 (`부패키`) ─────────────────────────────────────────────── */

test('🔴 서로 다른 절의 «검사기 고장»은 다른 열쇠다 — 경로가 딸려 와도', () => {
  // 이 절이 되돌아가면 오늘 A절이 죽어 도장이 찍힌 뒤 같은 날 B절이 조용히 눌린다.
  // 감시기가 제 고장을 감추는 자리라 이 파일에서 제일 무거운 회귀다.
  const 같은파일 = "ENOENT: no such file or directory, open 'C:" + String.fromCharCode(92) + "docs_ops_원장.jsonl'";
  const A = { kind: '검사기 고장', text: '게이트초 검사가 실패했다 — ' + 같은파일 };
  const B = { kind: '검사기 고장', text: '밤굽기도장 검사가 실패했다 — ' + 같은파일 };
  assert.notStrictEqual(R.부패키(A), R.부패키(B),
    '두 절의 고장이 한 열쇠로 뭉쳤다 — 둘째가 조용히 눌린다');
  assert.match(R.부패키(A), /게이트초/);
  assert.match(R.부패키(B), /밤굽기도장/);
});

test('🔴 «검사기 고장»은 슬래시 경로가 든 문면에서도 절 이름으로 가른다', () => {
  const A = { kind: '검사기 고장', text: '상주총량 검사가 실패했다 — docs/_ops/원장.jsonl 을 못 열었다' };
  const B = { kind: '검사기 고장', text: '이름부름 검사가 실패했다 — docs/_ops/원장.jsonl 을 못 열었다' };
  assert.notStrictEqual(R.부패키(A), R.부패키(B));
});

test('열쇠가 .jsonl 을 .js 로 자르지 않는다 — 자르면 서로 다른 장부가 한 건이 된다', () => {
  const a = { kind: '깨진 참조', text: '장부.json 을 못 읽었다' };
  const b = { kind: '깨진 참조', text: '장부.jsonl 을 못 읽었다' };
  assert.notStrictEqual(R.부패키(a), R.부패키(b), '.json 과 .jsonl 이 한 열쇠가 됐다');
});

test('한 문서가 낸 서로 다른 깨짐은 앞 경로 «둘»로 갈린다', () => {
  const a = { kind: '깨진 참조', text: 'docs/가.md → docs/과녁1.md' };
  const b = { kind: '깨진 참조', text: 'docs/가.md → docs/과녁2.md' };
  assert.notStrictEqual(R.부패키(a), R.부패키(b), '첫 경로만 쓰면 하나를 고쳐도 나머지가 눌린다');
  const c = { kind: '깨진 참조', text: 'docs/가.md → docs/과녁1.md 그리고 docs/딴것.md' };
  assert.strictEqual(R.부패키(a), R.부패키(c), '셋째 경로까지 열쇠에 들어가 문면 흔들림에 열쇠가 갈렸다');
});

test('눌림 도장은 오늘 것을 얹고 보관일이 지난 것을 걷는다', () => {
  const 지금 = Date.parse('2026-08-30T12:00:00Z');
  const 오늘 = R.그날(지금);
  const 옛것 = {
    '깨진 참조|엊그제': R.그날(지금 - 2 * 86400000),
    '깨진 참조|여드레전': R.그날(지금 - 8 * 86400000),
  };
  const 새것 = R.눌림갱신(옛것, [{ kind: '검사기 고장', text: '게이트초 검사가 실패했다 — 어쩌고' }], 오늘, 지금);
  assert.ok('깨진 참조|엊그제' in 새것, '보관일 안의 도장이 걷혔다');
  assert.ok(!('깨진 참조|여드레전' in 새것), '보관일이 지난 도장이 남았다 — 상태 파일이 곧 장부가 된다');
  assert.strictEqual(새것['검사기 고장|게이트초'], 오늘);
});

/* ── 화면 — 「못 쟀다」가 상한에 잘리지 않는다 ─────────────────────────────── */

test('🔴 «확인 불가» 계열 경고는 12건 상한 뒤로 사라지지 않는다', () => {
  const warn = [];
  for (let i = 0; i < 12; i++) warn.push({ kind: '정본 버전 미상', text: '평범한 경고 ' + i });
  warn.push({ kind: '이름 부름 확인 불가', text: '형제를 못 찾았다' });
  warn.push({ kind: '상주 선언을 못 읽었다', text: '앵커가 죽었다' });
  warn.push({ kind: '게이트 장부 확인 불가', text: '한 줄도 못 읽었다' });
  warn.push({ kind: '밤굽기 도장 확인 불가', text: '찍는 쪽도 없다' });

  const 화면 = R.render({ red: [], warn, notes: [], mem: { ok: false }, doc: null });

  for (const k of ['이름 부름 확인 불가', '상주 선언을 못 읽었다', '게이트 장부 확인 불가', '밤굽기 도장 확인 불가']) {
    assert.ok(화면.includes(k), k + ' 가 「… 외 N건」 뒤로 사라졌다 — 검사가 제 침묵을 스스로 숨기는 자리다');
  }
  assert.ok(화면.includes('⚠ 주의 16건'), '합계가 안 맞다:\n' + 화면);
  assert.ok(!화면.includes('외 '), '평범한 경고 12건은 상한 안이라 접힐 것이 없다:\n' + 화면);
});

test('평범한 경고는 여전히 접힌다 — 상한이 사라지면 진짜 적색이 화면 밖으로 밀린다', () => {
  const warn = [];
  for (let i = 0; i < 15; i++) warn.push({ kind: '정본 버전 미상', text: '평범한 경고 ' + i });
  const 화면 = R.render({ red: [], warn, notes: [], mem: { ok: false }, doc: null });
  assert.ok(화면.includes('외 3건'), '접힘이 사라졌다:\n' + 화면);
});
