'use strict';
/**
 * 진단 문항 은행 — 「내 TOPIK, 지금 몇 급?」이 쓰는 문항이 «잴 수 있는 모양»인가
 *
 * 정본 = `docs/급수진단_설계_v1.md` §④-㉢(짝 셋) · §⑮(짓는 규칙 여섯) · 실물 = `contents_진단문항.js`.
 *
 * ■ 이 시험이 막는 것 — 전부 «조용히» 새는 자리다
 *   ① **답이 둘인 문항**은 채점기가 오답으로 세고, 학생은 맞게 답했는데 급수가 내려간다.
 *      기계로는 «보기 중복»까지만 잡힌다(뜻이 겹치는지는 사람이 본다 · 설계 §⑮-㉣ 유호 훑기).
 *   ② **정답 자리 쏠림.** 정답이 늘 같은 칸에 오면 찍어도 맞아서, 실력을 안 재고도 급수가 나온다.
 *   ③ **문항 셋의 길이 차.** 시작에 짧은 것, 끝에 긴 것을 두면 학습 없이 급수가 오르내린다
 *      (심문 1회차 아스트라 P0-1 이 반례를 재현한 그 자리).
 *   ④ **문형 번호가 뱅크에 없거나 도입급이 어긋남.** 그러면 진단 약점을 배정 과제로 못 잇는다
 *      (설계 §⑥-㉠ 「문형 번호」 칸이 그 유일한 열쇠다).
 *
 * ■ 🔴 리터럴을 안 쓴다 — 문형 수·급수를 손으로 적지 않고 **뱅크 정본에서 뽑아** 대조한다.
 *   시험이 숫자를 들고 있으면 뱅크가 바뀐 날 검사만 조용히 낡고, 그날 새는 방향은 「통과」다
 *   (`tests/토픽등반.test.js` 가 먼저 세운 규약).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { engineSource } = require('./_engine-source');

/* ── 실물 태우기 ─────────────────────────────────────────────────────────── */
const 문항원문 = fs.readFileSync(path.join(__dirname, '..', 'contents_진단문항.js'), 'utf8');
const D = new Function(
  문항원문.replace(/^'use strict';/, '') +
  '\nreturn { DIAG_Q_LV3, DIAG_Q_LV4, DIAG_WRITE, 진단문항_, 진단문항급_ };')();

/* 뱅크 정본 — 문형 번호와 도입급의 임자. */
const 엔진 = engineSource();
const 뱅크 = (() => {
  const s = 엔진.indexOf('const GRAMMAR_BANK = [');
  assert.notEqual(s, -1, 'GRAMMAR_BANK 를 못 찾았다');
  const e = 엔진.indexOf('\n];', s);
  const 행 = [...엔진.slice(s, e).matchAll(/\[\s*'(G\d+)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*(\d+)\s*,/g)];
  assert.ok(행.length > 50, `뱅크 파싱이 얕다(${행.length}행) — 정규식이 실물과 어긋났을 수 있다`);
  const m = {};
  행.forEach((r) => { m[r[1]] = { 이름: r[2], 도입급: Number(r[4]) }; });
  return m;
})();

const 급별 = { 3: D.DIAG_Q_LV3, 4: D.DIAG_Q_LV4 };
const 모든급 = Object.keys(급별).map(Number);
const 회차수 = 3; // 시작·중간·끝 (설계 §④-㉢)

/* ── ④ 문형 번호와 도입급이 뱅크와 맞는가 ────────────────────────────────── */
test('문형 번호가 전부 뱅크에 실재한다', () => {
  모든급.forEach((급) => 급별[급].forEach((g) => {
    assert.ok(뱅크[g[0]], `${g[0]} 이 GRAMMAR_BANK 에 없다 — 진단 약점을 과제로 못 잇는다`);
  }));
});

test('적어 둔 도입급이 뱅크의 도입급과 같다', () => {
  모든급.forEach((급) => 급별[급].forEach((g) => {
    assert.equal(g[1], 뱅크[g[0]].도입급,
      `${g[0]}(${뱅크[g[0]].이름}) 도입급이 갈렸다 — 파일 ${g[1]} vs 뱅크 ${뱅크[g[0]].도입급}`);
    assert.equal(g[1], 급, `${g[0]} 이 ${급}급 은행에 있는데 도입급은 ${g[1]} 이다`);
  }));
});

test('한 급에서 고른 문형이 서로 다르다', () => {
  모든급.forEach((급) => {
    const ids = 급별[급].map((g) => g[0]);
    assert.equal(new Set(ids).size, ids.length, `${급}급에 같은 문형이 두 번 있다`);
  });
});

/* ── 짝 셋의 모양 ────────────────────────────────────────────────────────── */
test('문형마다 문항이 셋이다 (시작·중간·끝)', () => {
  모든급.forEach((급) => 급별[급].forEach((g) => {
    assert.equal(g[2].length, 회차수, `${g[0]} 의 문항이 ${g[2].length}개다 — 회차 하나가 빈다`);
  }));
});

test('모든 문항에 빈칸과 보기 넷이 있고 보기가 안 겹친다', () => {
  모든급.forEach((급) => 급별[급].forEach((g) => g[2].forEach((q, i) => {
    const 자리 = `${g[0]}[${i}]`;
    assert.ok(q[0].includes('___'), `${자리} 에 빈칸(___)이 없다`);
    assert.equal(q[1].length, 4, `${자리} 의 보기가 넷이 아니다`);
    assert.equal(new Set(q[1]).size, 4, `${자리} 의 보기에 같은 것이 둘 있다 — 답이 둘일 수 있다`);
    assert.ok(Number.isInteger(q[2]) && q[2] >= 0 && q[2] < 4, `${자리} 의 정답 자리가 범위 밖이다`);
  })));
});

/* ── ③ 문항 셋의 길이 차 (설계 §⑮-㉡ ②) ───────────────────────────────── */
test('한 문형의 문항 셋은 길이가 비슷하다', () => {
  const 허용 = 2; // 어절
  모든급.forEach((급) => 급별[급].forEach((g) => {
    const 길이 = g[2].map((q) => q[0].split(/\s+/).filter(Boolean).length);
    const 차 = Math.max(...길이) - Math.min(...길이);
    assert.ok(차 <= 허용,
      `${g[0]} 문항 셋의 어절 수가 ${길이.join('/')} 로 ${차} 만큼 벌어졌다 — ` +
      '시작에 짧고 끝에 긴 문항을 두면 학습 없이 급수가 오른다');
  }));
});

/* ── ② 정답 자리 쏠림 ───────────────────────────────────────────────────── */
test('한 급 안에서 정답 자리가 세 칸 이상에 흩어져 있다', () => {
  모든급.forEach((급) => {
    const 분포 = [0, 0, 0, 0];
    급별[급].forEach((g) => g[2].forEach((q) => { 분포[q[2]]++; }));
    const 쓴칸 = 분포.filter((n) => n > 0).length;
    assert.ok(쓴칸 >= 3,
      `${급}급 정답이 ${쓴칸} 칸에만 온다(${분포.join('/')}) — 찍어서 맞힐 수 있다`);
    const 총 = 분포.reduce((a, b) => a + b, 0);
    assert.ok(Math.max(...분포) <= Math.ceil(총 * 0.5),
      `${급}급 정답의 절반 넘게가 한 칸에 몰렸다(${분포.join('/')})`);
  });
});

test('같은 회차 안에서도 정답 자리가 한 칸에 다 몰리지 않는다', () => {
  모든급.forEach((급) => {
    for (let i = 0; i < 회차수; i++) {
      const 자리들 = 급별[급].map((g) => g[2][i][2]);
      assert.ok(new Set(자리들).size >= 2,
        `${급}급 ${i}회차의 정답이 전부 같은 칸(${자리들[0]})이다 — 한 번 알면 여섯을 다 맞힌다`);
    }
  });
});

/* ── 회차를 뽑는 자 ─────────────────────────────────────────────────────── */
test('회차가 다르면 문항이 하나도 안 겹친다', () => {
  모든급.forEach((급) => {
    const 회차별 = [];
    for (let i = 0; i < 회차수; i++) 회차별.push(D.진단문항급_(급, i).map((q) => q.문장));
    for (let a = 0; a < 회차수; a++) {
      for (let b = a + 1; b < 회차수; b++) {
        const 겹침 = 회차별[a].filter((s) => 회차별[b].includes(s));
        assert.equal(겹침.length, 0,
          `${급}급 ${a}회차와 ${b}회차에 같은 문장이 있다 — 8주 뒤에 외운 것을 잰다`);
      }
    }
  });
});

test('회차를 뽑아도 문형 목록은 늘 같다', () => {
  모든급.forEach((급) => {
    const 기준 = D.진단문항급_(급, 0).map((q) => q.문형).join(',');
    for (let i = 1; i < 회차수; i++) {
      assert.equal(D.진단문항급_(급, i).map((q) => q.문형).join(','), 기준,
        `${급}급 ${i}회차의 문형 목록이 시작 진단과 다르다 — 같은 자로 못 견준다`);
    }
  });
});

test('회차 인자가 범위를 벗어나도 죽지 않고 양 끝으로 접힌다', () => {
  모든급.forEach((급) => {
    assert.deepEqual(D.진단문항급_(급, -5), D.진단문항급_(급, 0));
    assert.deepEqual(D.진단문항급_(급, 99), D.진단문항급_(급, 회차수 - 1));
  });
  assert.deepEqual(D.진단문항급_(9, 0), [], '은행이 없는 급은 빈 배열이어야 한다');
});

test('진단문항_ 이 문형 하나를 회차별로 찾아낸다', () => {
  const 첫 = 급별[3][0];
  const r = D.진단문항_(첫[0], 1);
  assert.equal(r.문형, 첫[0]);
  assert.equal(r.문장, 첫[2][1][0]);
  assert.equal(D.진단문항_('없는번호', 0), null, '없는 문형은 null 이어야 한다');
});

/* ── 쓰기 문항 ──────────────────────────────────────────────────────────── */
test('쓰기 문항은 회차 수만큼 있고 급수 낱말을 안 쓴다', () => {
  assert.ok(D.DIAG_WRITE.length >= 회차수,
    `쓰기 문항이 ${D.DIAG_WRITE.length}개다 — 회차마다 다른 것이 있어야 외운 답을 안 낸다`);
  D.DIAG_WRITE.forEach((s) => {
    assert.ok(!/\d\s*급|TOPIK|급수/.test(s), `쓰기 문항에 급수 낱말이 들어갔다: ${s}`);
    assert.ok(s.length < 40, `쓰기 문항이 길다(${s.length}자) — 지시문이 길면 문제가 어려워진다: ${s}`);
  });
});

/* ── 학생이 읽는 글이다 (브랜드 금칙어) ─────────────────────────────────── */
test('문항 어디에도 결핍·비교 낱말이 없다', () => {
  const 금칙 = ['패배', '졌다', '실패', '불운', '하락', '부족', '늦었다', '평균', '등수'];
  const 전문 = [];
  모든급.forEach((급) => 급별[급].forEach((g) => g[2].forEach((q) => {
    전문.push(q[0]); q[1].forEach((c) => 전문.push(c));
  })));
  D.DIAG_WRITE.forEach((s) => 전문.push(s));
  금칙.forEach((w) => {
    const 걸린 = 전문.filter((s) => s.includes(w));
    assert.equal(걸린.length, 0, `학생이 읽는 문항에 「${w}」 가 있다: ${걸린.join(' / ')}`);
  });
});
