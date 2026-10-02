/* EP01 키트판 장면 계획 — 목소리와 무관한 '기준점' 표.
 * 모든 시각은 초 숫자가 아니라 자막·낱말 기준점으로 적는다. 그래서 목소리(=data/timing.js)를 바꾸면
 * 장면 전환·강조·효과음이 새 말에 맞춰 함께 움직인다.
 *
 * 기준점(ref):  'c07'      자막 c07이 시작하는 때
 *               'c07.w2'   자막 c07의 세 번째 낱말(0부터)이 들리기 시작하는 때
 *               'c07.end'  자막 c07이 끝나는 때
 *               's5'       장면 s5가 다 보이는 때
 *               뒤에 '+0.3'·'-0.2'를 붙이면 그만큼 옮긴다(예: 's3+0.55').
 *
 * index.html(브라우저)과 tools/make-sfx.cjs(Node)가 같은 파일을 읽는다.
 * ⚠ 이 파일 안에 script 닫는 태그 문자열을 쓰지 않는다(컴파일러가 끼워 넣을 때 끊긴다).
 */
(function (g) {
  'use strict';

  const PLAN = {
    // 장면 순서. at = 이 기준점에 새 장면이 다 보인다. tr = 들어오는 전환(키트 motion.js)
    // 같은 전환을 연달아 쓰지 않는다(키트 README §9).
    scenes: [
      { id: 's1', at: 'c01', tr: null, name: '표지(콜드 오픈)' },
      { id: 's2', at: 'c03', tr: 'patch', name: '한 줄 예고' },
      { id: 's3', at: 'c04', tr: 'seam', name: '6월 첫 결제(실제 화면)' },
      { id: 's4', at: 'c06', tr: 'cut', name: '출석 앱을 떠올림' },
      { id: 's5', at: 'c07', tr: 'patch', name: '개발 실력 ZERO' },
      { id: 's6', at: 'c08', tr: 'cut', name: '찍고·묻고·따라 하기' },
      { id: 's7', at: 'c10', tr: 'seam', name: '기능 더미' },
      { id: 's8', at: 'c14', tr: 'cut', name: '인터뷰 실제 얼굴' },
      { id: 's9', at: 'c16', tr: 'arch', name: '완성 기준 한 줄' },
      { id: 's10', at: 'c19', tr: 'seam', name: '실습 화면' },
      { id: 's11', at: 'c21', tr: 'cut', name: '다시 열어 확인' },
      { id: 's12', at: 'c23', tr: 'patch', name: 'AI에게 보낼 세 줄' },
      { id: 's13', at: 'c24', tr: 'cut', name: '질문 타이핑' },
      { id: 's14', at: 'c28', tr: 'seam', name: '순서' },
      { id: 's15', at: 'c30', tr: 'paper', name: '끝' },
    ],
    // 전환을 시작해서 새 장면이 다 보일 때까지 걸리는 시간(초). motion.js 프리셋의 실제 길이에 맞췄다
    lead: { patch: 0.36, seam: 0.32, arch: 0.34, paper: 0.30, cut: 0 },
    // 말보다 장면이 이만큼 먼저 바뀐다
    pre: 0.04,
    // 효과음: [기준점, 소리 이름, 최고 음량(dBFS), 길이(초)]. 전환 소리는 아래 transitionSfx가 자동으로 더한다.
    // 소리 이름은 media-use 효과음(whoosh-short·pop·click…) 또는 'synk:…'(브랜드 사운드킷)
    transitionSfx: { patch: ['whoosh-short', -30, 0.23], seam: ['whoosh-short', -31, 0.23], arch: ['whoosh-short', -30, 0.26], paper: ['whoosh-short', -30, 0.23], cut: ['click', -29, 0.12] },
    sfx: [
      ['c02.w2', 'error', -26, 0.30],
      ['c03.w1', 'pop', -29, 0.16],
      ['s3+0.55', 'click', -27, 0.12],
      ['s3+1.0', 'pop', -30, 0.14],
      ['c05.w1', 'ping', -30, 0.24],
      ['c06.w0', 'pop', -29, 0.16], ['c06.w3', 'pop', -28.6, 0.16], ['c06.w5', 'pop', -28.2, 0.16],
      ['c07.w2', 'impact-bass-1', -27, 0.26],
      ['c08.w0', 'click-soft', -28, 0.12], ['c08.w2', 'click-soft', -28, 0.12], ['c09.w0', 'click-soft', -27.5, 0.12],
      ['c10.w1', 'pop', -28, 0.16], ['c11.w0', 'pop', -27.6, 0.16], ['c12.w0', 'pop', -27.2, 0.16],
      ['c13.w0', 'error', -26, 0.32],
      ['c15.w0', 'pop', -29, 0.16],
      ['c17.w4', 'ping', -29, 0.24], ['c18.w1', 'ping', -29, 0.24],
      ['c20.w2', 'click', -25, 0.13], ['c20.w3', 'ping', -28, 0.25],
      ['c22.w0', 'synk:synk-sound-achieve', -24, 0.36],
      ['s12+0.35', 'pop', -29, 0.16],
      ['c28.w0', 'pop', -28, 0.13], ['c28.w2', 'pop', -28, 0.13], ['c28.w4', 'pop', -28, 0.13],
      ['c32.w2', 'chime', -29, 0.53],
    ],
    // 질문 창에서 낱말마다 타건음(자막 c24~c27의 모든 낱말)
    typingSfx: { captions: ['c24', 'c25', 'c26', 'c27'], name: 'key-press', peak: -33, dur: 0.07 },
  };

  function resolve(T) {
    const cap = {};
    T.captions.forEach((c) => { cap[c.id] = c; });
    const scenes = [];
    const base = (ref) => {
      const m = /^(c\d+)(?:\.(?:w(\d+)|(end)))?$/.exec(ref);
      if (m) {
        const c = cap[m[1]];
        if (!c) throw new Error('없는 자막 기준점: ' + ref);
        if (m[3]) return c.end;
        if (m[2] != null) {
          const w = c.words[+m[2]];
          if (!w) throw new Error('없는 낱말 기준점: ' + ref);
          return w.s;
        }
        return c.start;
      }
      const s = scenes.find((x) => x.id === ref);
      if (s) return s.show;
      throw new Error('알 수 없는 기준점: ' + ref);
    };
    const t = (ref, d = 0) => {
      const m = /^(.*?)([+-]\d+(?:\.\d+)?)?$/.exec(String(ref));
      return Math.max(0, base(m[1]) + (m[2] ? parseFloat(m[2]) : 0) + d);
    };
    PLAN.scenes.forEach((s, i) => {
      const show = i ? Math.max(0, base(s.at) - PLAN.pre) : 0;
      scenes.push(Object.assign({}, s, { show, trStart: s.tr ? Math.max(0, show - PLAN.lead[s.tr]) : 0 }));
    });
    scenes.forEach((s, i) => { s.end = i < scenes.length - 1 ? scenes[i + 1].show : T.duration; });
    const sceneAt = (time) => { let k = scenes[0]; scenes.forEach((s) => { if (time >= s.show - 1e-6) k = s; }); return k; };
    const sfx = () => {
      const out = [];
      scenes.forEach((s) => {
        if (!s.tr) return;
        const [name, peak, dur] = PLAN.transitionSfx[s.tr];
        out.push({ time: s.tr === 'cut' ? s.show : s.trStart + 0.04, name, peak, dur, why: s.id + ' ' + s.tr });
      });
      PLAN.sfx.forEach(([ref, name, peak, dur]) => out.push({ time: t(ref), name, peak, dur, why: ref }));
      const ty = PLAN.typingSfx;
      ty.captions.forEach((id) => cap[id].words.forEach((w, k) => out.push({ time: w.s + 0.02, name: ty.name, peak: ty.peak - (k % 2) * 1.5, dur: ty.dur, why: id + '.w' + k })));
      return out.sort((a, b) => a.time - b.time);
    };
    return { t, scenes, sceneAt, sfx, duration: T.duration, captions: T.captions, cap };
  }

  const api = { PLAN, resolve };
  g.EP01_PLAN = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
