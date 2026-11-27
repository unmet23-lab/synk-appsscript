// 10o: 대사 듣기 재생기 — 구운 녹음(assets/say) 하나를 돌려 쓴다. 누른 뒤 이어 트는 둘째 말도 휴대폰에서 막히지 않게 Audio 하나를 다시 쓴다.
// 화면(말풍선 불 · 「모두 듣기」 칩 · 알림)은 부르는 쪽(app.mjs speakKo)이 맡고, 여기는 언제 끝났는지만 알린다. 시험은 가짜 Audio와 가짜 타이머로 돌린다.
// 끝 = 'done'(끝까지 들음) · 'fail'(못 받음 — 404 · 망 끊김 · 받다가 멎음) · 'stopped'(기기가 멈춤 — 전화 · 이어폰 뺌, 알림 없이 끝).
// 받기 전에는 8초, 재생이 시작되면 남은 길이 + 8초 안에 끝나지 않으면 'fail'로 본다(검수 world-front-voice-20261126 F2 · front-fix3-20261127 Fable P2 · P3).
export const WAIT_MS = 8000;

export function makeSayPlayer({newAudio = () => new Audio(), setT = setTimeout, clearT = clearTimeout} = {}) {
  let el = null, cur = null, dog = 0;
  const finish = (me, how) => {
    if (cur !== me) return;
    cur = null; clearT(dog);
    if (how === 'fail') el.pause();
    me.end(how);
  };
  const arm = (me, ms) => { clearT(dog); dog = setT(() => finish(me, 'fail'), ms); };
  function stop() { cur = null; clearT(dog); if (el) el.pause(); }
  function play(src, end) {
    stop();
    el = el || newAudio();
    const me = cur = {end, started: false};
    el.onended = () => finish(me, 'done');
    el.onerror = () => finish(me, 'fail');
    el.onplaying = () => {
      if (cur !== me) return;
      me.started = true;
      arm(me, ((Number.isFinite(el.duration) ? el.duration : 6) - el.currentTime) * 1000 + WAIT_MS);
    };
    // 앞 말을 멈춘 pause는 이 말이 재생을 시작하기 전에 늦게 도착하므로 started로 거른다. 끝까지 들으면 ended 앞에 pause가 오므로 el.ended로 거른다.
    el.onpause = () => { if (me.started && !el.ended) finish(me, 'stopped'); };
    el.src = src; arm(me, WAIT_MS);
    const p = el.play();
    if (p && p.catch) p.catch(() => finish(me, 'fail'));
  }
  return {play, stop};
}
