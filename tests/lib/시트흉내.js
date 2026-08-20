'use strict';
/**
 * 가짜 시트 흉내 — 공용 통로 **와 그 «계약»**.
 *
 * ■ 왜 이 파일이 있나 (F460 · 같은 뿌리 2번째)
 *   시험은 라이브 Sheets 를 못 부르니 흉내를 쓴다. 그런데 그 흉내가 라이브와 «무엇이 같아야
 *   하는지»가 **어디에도 안 적혀 있었다.** 그래서 갈라져도 아무도 안 쟀고, 두 번 샜다 —
 *   방향이 반대라 한쪽만 막았으면 못 잡았다:
 *     · 흉내가 라이브보다 «착하면» → **조용한 초록**
 *       (08-14: 자동 서식 칸의 `Date` 삼킴을 안 흉내 내 「재실행이 행을 안 늘린다」가
 *        초록인 채 라이브만 중복 적재였다)
 *     · 흉내가 라이브보다 «사나우면» → **거짓 적색**
 *       (08-15: `setValues` 가 행을 통째로 갈아쳐, 폭 1 쓰기가 나머지 9열을 날렸다.
 *        엔진은 멀쩡한데 시험만 빨갰다)
 *   둘 다 «변이»가 잡았다 — 평소 초록으로는 원리상 안 보인다(지침 v9.2 맹점 ④).
 *
 * ■ 계약 (아래 `계약조항`) — **근거 없는 조항은 안 넣었다**
 *   조항마다 실측 사고를 달았다. 「이럴 것 같다」로 늘리면 이 흉내가 라이브가 아니라
 *   내 상상을 흉내 내게 되고, 그건 계약이 없던 때보다 나쁘다(틀린 값이 계약의 얼굴을 쓴다).
 *
 * ■ 이 장치가 틀릴 때의 모습 (대가를 함께 적는다)
 *   계약 «자체»가 라이브와 어긋나면, 이제는 흉내 하나가 아니라 **전부가 한꺼번에**
 *   같은 방향으로 틀린다(공용 통로의 값이자 대가다). 그래서 조항은 사고 실측에만 근거하고,
 *   라이브를 부르지 않는다 — 부르는 순간 시험이 네트워크·자격증명에 기대게 되고 CI 에서 깨진다(F296).
 *   ⚠ **못 닫은 것 하나**: 이 계약이 «라이브와 같은가»는 이 저장소 안에서 증명할 수 없다.
 *      닫히는 조건 = 사고가 한 번 더 나서 조항이 하나 더 실측되는 때뿐이다.
 *
 * ■ 쓰는 법
 *     const { 시트흉내 } = require('./lib/시트흉내.js');
 *     const sh = 시트흉내({ 첫행: 2, 행들: [] });   // 헤더 1행 시트 — data 는 2행부터
 *     const sh = 시트흉내({ 첫행: 1, 행들: [헤더, ...] });  // 헤더까지 담는 통짜 격자
 *   `첫행` 은 `data[0]` 이 시트의 몇 행인가다. 이 저장소에 두 관례가 다 있어 둘 다 받는다.
 */

/** 계약 조항 이름 — 위반 보고와 변이 픽스처가 **같은 이름**을 쓴다(갈리면 분모가 거짓말한다). */
const 계약조항 = {
  범위: '① setValues 는 지정 범위 «안에만» 쓴다',
  마지막행: '② getLastRow 는 «내용이 있는» 마지막 행이다 — 비운 꼬리는 안 센다',
  값만비움: '③ clearContent 는 값만 비운다 — 행을 지우지 않는다',
  삼킴: '④ 자동 서식 칸은 yyyy-MM-dd 를 Date 로 삼킨다 — 텍스트(@) 칸만 문자열로 남는다',
  아포스트로피: '⑤ 저장 시 접두 아포스트로피를 먹는다',
  모양: '⑥ getValues 는 요청한 n×w 모양 그대로 돌려준다'
};

/**
 * 정직한 흉내 하나.
 * @param {{첫행?:number, 행들?:Array<Array<*>>}} 옵션
 */
function 시트흉내(옵션) {
  const o = 옵션 || {};
  const 첫행 = o.첫행 === undefined ? 2 : o.첫행;
  /* 저장 시 접두 `'` 소비 — 실물은 이걸 먹고 getValues 가 원문을 돌려준다(Code.js:1036).
   *   안 흉내 내면 소독을 켠 순간 멱등 키가 갈린다(계약 ⑤). */
  const 저장 = (v) => (typeof v === 'string' && v[0] === "'" ? v.slice(1) : v);

  return {
    첫행,
    data: (o.행들 || []).map((r) => r.slice()),
    raw: [],            // Sheets 에 «건넨» 원본 — 저장 후엔 아포스트로피가 소비돼 안 보인다
    /* 1-기반 열 번호 → 서식 문자열. 실물은 준 서식을 그대로 보관하므로 '@' 만 기억하지 않는다
     *   (좁게 기억하면 「그 열을 yyyy-MM 으로 박았나」 같은 검사가 이 통로로는 원리상 못 선다). */
    서식: {},
    /** `서식` 에서 **파생**한다 — 같은 판정을 두 곳에 적으면 갈라진다. */
    get 텍스트열() {
      const out = {};
      Object.keys(this.서식).forEach((c) => { if (this.서식[c] === '@') out[c] = 1; });
      return out;
    },

    getLastRow() {
      let n = 0;
      this.data.forEach((row, i) => { if ((row || []).some((v) => v !== '' && v != null)) n = i + 1; });
      return (첫행 - 1) + n;
    },
    getMaxRows() { return this.data.length + 1000; },
    getLastColumn() { return this.data.reduce((m, r) => Math.max(m, (r || []).length), 0); },

    /** 계약 ④ — 자동 서식 칸만 삼킨다. */
    삼킴(v, 열) {
      if (this.서식[열] === '@') return v;
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const d = new Date(v + 'T00:00:00');
        if (!isNaN(d.getTime())) return d;
      }
      return v;
    },

    getRange(r, c, n, w) {
      const self = this;
      const 행수 = n || 1;
      const 폭 = w || 1;
      const i0 = r - 첫행;
      return {
        getValues() {
          const out = [];
          for (let i = 0; i < 행수; i++) {
            const row = self.data[i0 + i] || [];
            const o2 = [];
            /* 계약 ⑥ — 실물 Range 는 «요청한 폭»을 늘 채워 준다. 짧은 행을 그대로 돌려주면
             *   호출부가 `row[7]` 에서 undefined 를 받아, 엔진이 멀쩡해도 시험만 빨개진다. */
            for (let j = 0; j < 폭; j++) o2.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
            out.push(o2);
          }
          return out;
        },
        getValue() { return this.getValues()[0][0]; },
        getNumberFormat() { return self.서식[c] || '0.###'; },
        setNumberFormat(f) {
          for (let i = 0; i < 폭; i++) self.서식[c + i] = f;
          return this;
        },
        /* 계약 ③ — 값만 비운다. 여기서 행을 splice 하거나 `data.length = 0` 으로 접으면
         *   흉내가 라이브보다 «착해져», 「지운 자리에 덮어쓴다」가 어긋나도 초록이 된다. */
        clearContent() {
          for (let i = 0; i < 행수; i++) {
            if (!self.data[i0 + i]) continue;
            for (let j = 0; j < 폭; j++) self.data[i0 + i][c - 1 + j] = '';
          }
          return this;
        },
        /* 계약 ① — 범위 «안»에만. 옛 판은 행을 통째로 갈아쳐 폭 1 쓰기가 나머지 열을 날렸다(F460). */
        setValues(v) {
          v.forEach((row, i) => {
            self.raw.push(row.slice());
            const 행 = self.data[i0 + i] || [];
            row.forEach((cell, j) => { 행[c - 1 + j] = self.삼킴(저장(cell), c + j); });
            self.data[i0 + i] = 행;
          });
          return this;
        },
        setValue(v) { return this.setValues([[v]]); }
      };
    }
  };
}

/**
 * 계약검사 — 아무 «만들기»(팩토리)나 받아 계약 위반 목록을 돌려준다.
 *
 * 판정은 **한 방향**이다: 위반을 찾으면 「다르다」고 말하고, 못 찾았다고 「라이브와 같다」고는
 * 안 한다(조항이 여섯 개일 뿐이다). 그래서 이 검사의 탐지력은 실저장소가 아니라
 * **변이 픽스처가 진다** — `tests/시트흉내계약.test.js` 를 본다.
 *
 * @param {(옵션:{첫행:number, 행들:Array}) => object} 만들기
 * @returns {Array<{조:string, 무엇:string}>}
 */
function 계약검사(만들기) {
  const 위반 = [];
  const 적기 = (조, 무엇) => 위반.push({ 조, 무엇 });
  const 새로 = (행들) => 만들기({ 첫행: 2, 행들: (행들 || []).map((r) => r.slice()) });
  const 감싸기 = (조, fn) => {
    try { fn(); } catch (e) { 적기(조, '검사 중 터졌다 — ' + (e && e.message ? e.message : String(e))); }
  };

  // ① 범위 안에만 쓴다 — 두 방향을 한 조항이 잡는다(통째 갈아치움 · 아무것도 안 씀)
  감싸기(계약조항.범위, () => {
    const sh = 새로([['a', 'b', 'c', 'd']]);
    sh.getRange(2, 2, 1, 1).setValues([['Z']]);
    const 읽은 = sh.getRange(2, 1, 1, 4).getValues()[0];
    if (읽은[1] !== 'Z') 적기(계약조항.범위, '범위 «안» 칸이 안 바뀌었다 — 쓰기가 삼켜졌다: ' + JSON.stringify(읽은));
    if (읽은[0] !== 'a' || 읽은[2] !== 'c' || 읽은[3] !== 'd') {
      적기(계약조항.범위, '범위 «밖» 칸이 바뀌었다 — 행을 통째로 갈아쳤다: ' + JSON.stringify(읽은));
    }
  });

  // ② getLastRow = 내용 있는 마지막 행
  감싸기(계약조항.마지막행, () => {
    const sh = 새로();
    sh.getRange(2, 1, 3, 1).setValues([['x'], ['y'], ['z']]);
    if (sh.getLastRow() !== 4) 적기(계약조항.마지막행, '3행을 썼는데 getLastRow=' + sh.getLastRow() + ' (4여야 한다)');
    sh.getRange(4, 1, 1, 1).clearContent();
    if (sh.getLastRow() !== 3) {
      적기(계약조항.마지막행, '꼬리를 비웠는데 getLastRow=' + sh.getLastRow()
        + ' (3이어야 한다 — 빈 행을 세면 다음 실행이 그걸 「옛 값」으로 읽는다)');
    }
  });

  // ③ clearContent 는 값만 비운다
  감싸기(계약조항.값만비움, () => {
    const sh = 새로([['r2'], ['r3'], ['r4']]);
    sh.getRange(3, 1, 1, 1).clearContent();
    const 비운칸 = sh.getRange(3, 1, 1, 1).getValues()[0][0];
    if (비운칸 !== '') 적기(계약조항.값만비움, 'clearContent 가 값을 안 비웠다: ' + JSON.stringify(비운칸));
    const 아래 = sh.getRange(4, 1, 1, 1).getValues()[0][0];
    if (아래 !== 'r4') 적기(계약조항.값만비움, 'clearContent 가 행을 지워 아래가 밀렸다 — 4행에서 읽은 값: ' + JSON.stringify(아래));
  });

  // ④ 자동 서식 칸의 Date 삼킴 (+ 서식 읽기가 쓰기와 짝이 맞는가)
  감싸기(계약조항.삼킴, () => {
    const sh = 새로();
    sh.getRange(2, 1, 1, 1).setNumberFormat('@');
    if (sh.getRange(2, 1, 1, 1).getNumberFormat() !== '@') {
      적기(계약조항.삼킴, '@ 로 못박았는데 getNumberFormat 이 그걸 안 돌려준다 — 서식 분기가 통째로 안 재진다');
    }
    sh.getRange(2, 1, 1, 2).setValues([['2026-07-15', '2026-07-15']]);
    const [텍스트칸, 자동칸] = sh.getRange(2, 1, 1, 2).getValues()[0];
    if (typeof 텍스트칸 !== 'string') {
      적기(계약조항.삼킴, '텍스트(@) 칸인데 문자열이 안 남았다 — 늘 삼키면 텍스트 못박기가 무의미해진다: ' + String(텍스트칸));
    }
    if (!(자동칸 instanceof Date)) {
      적기(계약조항.삼킴, '자동 서식 칸이 yyyy-MM-dd 를 안 삼켰다 — 「재실행이 행을 안 늘린다」가 거짓 초록이 된다: '
        + JSON.stringify(자동칸));
    }
  });

  // ⑤ 접두 아포스트로피 소비
  감싸기(계약조항.아포스트로피, () => {
    const sh = 새로();
    sh.getRange(2, 1, 1, 1).setValues([["'=IMPORTDATA(\"x\")"]]);
    const v = sh.getRange(2, 1, 1, 1).getValues()[0][0];
    if (v !== '=IMPORTDATA("x")') 적기(계약조항.아포스트로피, '접두 아포스트로피가 안 먹혔다 — 멱등 키가 갈린다: ' + JSON.stringify(v));
  });

  // ⑥ 읽기 모양
  감싸기(계약조항.모양, () => {
    const sh = 새로([['a']]);
    const 읽은 = sh.getRange(2, 1, 2, 3).getValues();
    if (읽은.length !== 2 || 읽은.some((r) => !Array.isArray(r) || r.length !== 3)) {
      적기(계약조항.모양, '2×3 을 요청했는데 모양이 다르다: ' + JSON.stringify(읽은));
    }
  });

  return 위반;
}

module.exports = { 시트흉내, 계약검사, 계약조항 };
