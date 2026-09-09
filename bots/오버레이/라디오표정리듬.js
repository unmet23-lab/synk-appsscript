/* 라디오 유휴 표정의 시계. DOM·그림·몸 transform을 바꾸지 않는 순수 상태기계.
 * 브라우저: 라디오표정리듬.만들기({ seed: 7 }) / Node: require('./라디오표정리듬.js')
 * 매 틱 읽기(ms, { 밤, 가능표정, 중단 })의 표정만 기존 스프라이트 입구로 보낸다.
 * ms는 performance.now()처럼 계속 증가하는 시각이며 같은 값의 재조회도 가능하다.
 * 반응/의상교대 중 중단:true를 계속 주거나 중단(ms)을 호출한다. 재개(ms) 또는
 * 중단:false는 오래된 유휴 반응을 재생하지 않고 기본 얼굴에서 새 간격을 시작한다.
 * 밤의 판정/시간대는 소비자가 맡는다. 밤에도 눈을 영구히 감지 않는다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.라디오표정리듬 = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const 기본표정 = ['기본', '깜빡', '눈웃음', '궁금함', '집중', '안도', '응원'];
  // 눈웃음과 편안한 주의를 중심으로 고른다. 놀람/기쁨은 사건의 의미를 지킨다.
  const 표정무게 = [
    ['눈웃음', 5, [1550, 2300]],
    ['집중', 3, [2100, 3100]],
    ['안도', 3, [1900, 2800]],
    ['궁금함', 2, [1700, 2400]],
    ['응원', 0.7, [1400, 1900]],
  ];

  function 시드난수(seed) {
    let state = Number(seed) >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function 만들기(options = {}) {
    const random = options.random || (options.seed === undefined ? Math.random : 시드난수(options.seed));
    if (typeof random !== 'function') throw new TypeError('random은 함수여야 합니다.');
    const 난수 = () => {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random은 0 이상 1 미만이어야 합니다.');
      return value;
    };
    const 사이 = (a, b) => a + 난수() * (b - a);
    let 마지막ms = options.시작ms === undefined ? 0 : options.시작ms;
    if (!Number.isFinite(마지막ms) || 마지막ms < 0) throw new RangeError('시작ms는 0 이상의 시각이어야 합니다.');
    let 밤 = null;
    let 단계 = '기본', 현재표정 = '기본', 시작ms = 마지막ms, 끝ms = null;
    let 다음깜빡ms = null, 다음표정ms = null, 다음얼굴 = null, 마지막얼굴 = null;

    const 깜빡간격 = () => 밤 ? 사이(4800, 9200) : 사이(3000, 6400);
    const 표정간격 = () => 밤 ? 사이(11500, 20500) : 사이(6800, 13500);
    const 시각검사 = (ms) => {
      if (!Number.isFinite(ms) || ms < 마지막ms) throw new RangeError('ms는 유한하고 이전 시각보다 빠르지 않아야 합니다.');
      마지막ms = ms;
    };
    function 예약(ms) {
      다음깜빡ms = ms + 깜빡간격();
      다음표정ms = ms + 표정간격();
    }
    function 상태() {
      return {
        표정: 현재표정, 단계, 시작ms, 끝ms, 밤: !!밤,
        다음깜빡ms, 다음표정ms,
      };
    }
    function 기본으로(ms) {
      단계 = '기본'; 현재표정 = '기본'; 시작ms = ms; 끝ms = null;
    }
    function 중단(ms) {
      시각검사(ms);
      if (단계 !== '중단') {
        단계 = '중단'; 현재표정 = null; 시작ms = ms; 끝ms = null; 다음얼굴 = null;
        다음깜빡ms = null; 다음표정ms = null;
      }
      return 상태();
    }
    function 재개(ms) {
      시각검사(ms);
      if (단계 === '중단') {
        기본으로(ms);
        예약(ms); // 기본 얼굴에 충분히 머무른다. 중단 중 놓친 표정을 몰아 재생하지 않는다.
      }
      return 상태();
    }
    function 얼굴고르기(가능) {
      const 전부 = 표정무게.filter(([이름]) => 가능.has(이름));
      // 대안이 없으면 같은 유휴 표정을 반복하지 않고 기본 얼굴로 쉰다.
      const 후보 = 전부.filter(([이름]) => 이름 !== 마지막얼굴);
      if (!후보.length) return null;
      let 몫 = 난수() * 후보.reduce((sum, [, 무게]) => sum + 무게, 0);
      for (const 항목 of 후보) { 몫 -= 항목[1]; if (몫 < 0) return 항목; }
      return 후보[후보.length - 1];
    }
    function 얼굴시작(ms, 얼굴) {
      단계 = '표정'; 현재표정 = 얼굴[0]; 시작ms = ms;
      끝ms = ms + 사이(얼굴[2][0], 얼굴[2][1]);
      마지막얼굴 = 현재표정;
      다음얼굴 = null;
    }
    function 깜빡시작(ms, 얼굴) {
      단계 = '깜빡'; 현재표정 = '깜빡'; 시작ms = ms;
      끝ms = ms + 사이(350, 390); // 3~6fps에서도 보일 여유. 늦게 도착한 실제 틱부터 폐안한다.
      다음얼굴 = 얼굴 || null;
    }
    function 읽기(ms, input = {}) {
      시각검사(ms);
      const 새밤 = !!input.밤;
      if (새밤 !== 밤) {
        밤 = 새밤;
        if (단계 !== '중단') 예약(ms);
      }
      if (input.중단 === true) return 중단(ms);
      if (input.중단 === false) 재개(ms);
      if (단계 === '중단') return 상태();
      const 가능 = input.가능표정 === undefined ? new Set(기본표정) : new Set(input.가능표정);

      // 한 번의 읽기에서 한 단계만 진행한다. 지연된 틱이 폐안의 시작과 끝을 동시에 지우지 않는다.
      if (단계 === '깜빡') {
        if (ms >= 끝ms || !가능.has('깜빡')) {
          const 얼굴 = 다음얼굴;
          다음얼굴 = null;
          다음깜빡ms = ms + 깜빡간격();
          if (얼굴 && 가능.has(얼굴[0])) 얼굴시작(ms, 얼굴);
          else 기본으로(ms);
        }
        return 상태();
      }
      if (단계 === '표정') {
        if (ms >= 끝ms || !가능.has(현재표정)) {
          기본으로(ms);
          다음표정ms = ms + 표정간격();
          다음깜빡ms = Math.max(다음깜빡ms || 0, ms + 사이(1100, 1800));
        }
        return 상태();
      }
      // 깜빡 직후 표정 예약이 겹쳐도 연달아 눈을 닫지 않는다. 먼저 열린 얼굴을 읽을 틈을 준다.
      if (ms < 시작ms + 1100) return 상태();
      if (ms >= 다음표정ms) {
        const 얼굴 = 얼굴고르기(가능);
        if (얼굴) {
          // 짧은 눈감음 사이에 주의가 바뀐다. 표정 그림을 겹쳐 이중 눈을 만들지 않는다.
          if (가능.has('깜빡')) 깜빡시작(ms, 얼굴);
          else 얼굴시작(ms, 얼굴);
          return 상태();
        }
        다음표정ms = ms + 표정간격();
      }
      if (ms >= 다음깜빡ms) {
        if (가능.has('깜빡')) 깜빡시작(ms);
        else 다음깜빡ms = ms + 깜빡간격();
      }
      return 상태();
    }
    return { 읽기, 중단, 재개 };
  }

  return { 만들기, 시드난수 };
});
