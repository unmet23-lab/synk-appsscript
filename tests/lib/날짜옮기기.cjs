'use strict';
/**
 * 시험을 다른 날짜에서 돌려 보는 도우미 — 갱신일·풀림·만료처럼 날짜에 기대는 시험이 매달 며칠만 깨지는지 볼 때 쓴다.
 *
 *   SYNK_FAKE_TODAY=2026-09-20 NODE_OPTIONS="--require=<이 파일의 절대 경로>" node --test --test-reporter=tap tests/<파일>
 *
 * 인자 없는 new Date()·Date()·Date.now()만 그날의 같은 시각으로 옮긴다. 인자 있는 new Date(…)·performance.now·타이머·
 * 파일 시각(mtime)은 그대로다. NODE_OPTIONS로 넣으면 node --test가 띄우는 시험 프로세스와 시험이 띄우는 node 자식까지 들어간다
 * (상대 경로는 자식의 작업 폴더에서 못 찾을 수 있어 절대 경로로 준다).
 * 지난 날짜로만 옮긴다 — 미래로 옮기면 Date.now() - mtime으로 나이를 재는 잠금이 오래된 것으로 읽혀 겹침 시험이 따로 깨진다
 * (docs/현장노트/시험_화면확인.md 「갱신일을 날짜로 박은 키 순서 시험」).
 */
const 목표 = process.env.SYNK_FAKE_TODAY;
if (목표) {
  const 맞음 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(목표);
  if (!맞음) throw new Error(`SYNK_FAKE_TODAY는 YYYY-MM-DD여야 한다: ${목표}`);
  const 진짜 = Date;
  const 지금 = new 진짜();
  const 옮김 = new 진짜(+맞음[1], +맞음[2] - 1, +맞음[3], 지금.getHours(), 지금.getMinutes(), 지금.getSeconds(), 지금.getMilliseconds()) - 지금;
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
