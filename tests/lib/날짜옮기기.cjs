'use strict';
/**
 * 시험을 다른 날짜에서 돌려 보는 도우미 — 갱신일·풀림·만료처럼 날짜에 기대는 시험이 매달 며칠만 깨지는지 볼 때 쓴다.
 *
 *   SYNK_FAKE_TODAY=2026-09-20 NODE_OPTIONS="--require=<이 파일의 절대 경로>" node --test --test-reporter=tap tests/<파일>
 *   SYNK_FAKE_TODAY=2026-09-19T23:59:59.500 …   시각까지 주면 그 시각에서 시작한다(자정을 넘기는 순간 확인)
 *
 * 인자 없는 new Date()·Date()·Date.now()만 옮긴다. 인자 있는 new Date(…)·performance.now·타이머·파일 시각(mtime)은 그대로다.
 * NODE_OPTIONS로 넣으면 node --test가 띄우는 시험 프로세스와 시험이 띄우는 node 자식까지 들어간다
 * (상대 경로는 자식의 작업 폴더에서 못 찾을 수 있어 절대 경로로 준다). 처음 센 차이는 SYNK_FAKE_TODAY_OFFSET으로
 * 자식에게 물려줘 프로세스마다 시계가 어긋나지 않는다.
 * 지난 날짜로만 옮긴다 — 미래로 옮기면 Date.now() - mtime으로 나이를 재는 잠금이 오래된 것으로 읽혀 겹침 시험이 따로 깨진다
 * (docs/현장노트/시험_화면확인.md 「갱신일을 날짜로 박은 키 순서 시험」).
 */
const 목표 = process.env.SYNK_FAKE_TODAY;
if (목표) {
  const 맞음 = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/.exec(목표);
  if (!맞음) throw new Error(`SYNK_FAKE_TODAY는 YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM[:SS[.mmm]]이어야 한다: ${목표}`);
  const 진짜 = Date;
  const [물려받은목표, 물려받은차이] = String(process.env.SYNK_FAKE_TODAY_OFFSET || '').split('|');
  let 옮김 = 물려받은목표 === 목표 ? Number(물려받은차이) : NaN;
  if (!Number.isFinite(옮김)) {
    const [, y, m, d, hh, mi, ss, ms] = 맞음;
    const 지금 = new 진짜();
    const 그때 = hh === undefined
      ? new 진짜(+y, +m - 1, +d, 지금.getHours(), 지금.getMinutes(), 지금.getSeconds(), 지금.getMilliseconds())
      : new 진짜(+y, +m - 1, +d, +hh, +mi, +(ss ?? 0), +(ms ?? '0').padEnd(3, '0'));
    if (그때.getFullYear() !== +y || 그때.getMonth() !== +m - 1 || 그때.getDate() !== +d) throw new Error(`없는 날짜다: ${목표}`);
    옮김 = 그때 - 지금;
    process.env.SYNK_FAKE_TODAY_OFFSET = `${목표}|${옮김}`;
  }
  // 원형(prototype)을 진짜 Date와 같이 써서 Node 안쪽이 만든 날짜(fs 시각 등)도 instanceof Date로 읽힌다.
  function 옮긴날(...인자) {
    if (!new.target) return new 진짜(진짜.now() + 옮김).toString();
    return Reflect.construct(진짜, 인자.length ? 인자 : [진짜.now() + 옮김], new.target);
  }
  Object.setPrototypeOf(옮긴날, 진짜);
  옮긴날.prototype = 진짜.prototype;
  옮긴날.now = () => 진짜.now() + 옮김;
  globalThis.Date = 옮긴날;
}
