// 시안 공용 — 효과음(동작마다 하나), 소리 기록(녹화에 소리를 입히려고 시각을 남긴다), 자막 맞추기.
window.__sfx = [];
const __T0 = performance.now();
window.__modT0 = __T0; // 녹화 도구가 소리 시각을 녹화 시각으로 옮길 때 쓴다
const __cache = {};
export const now = () => (performance.now() - __T0) / 1000;
export function sfx(name, vol = 0.55) {
  window.__sfx.push({ t: now(), name, vol });
  try {
    const base = __cache[name] || (__cache[name] = new Audio(`s/${name}`));
    const a = base.cloneNode(); a.volume = vol; a.play().catch(() => {});
  } catch { /* 소리 없이 */ }
}
// 영상의 소리도 녹화에 입히려고 재생 시작 시각을 남긴다.
export function logVideo(v, name) { v.addEventListener('play', () => window.__sfx.push({ t: now() - (v.currentTime || 0), name: `video:${name}`, vol: v.muted ? 0 : v.volume })); }
// 자막: [시작, 끝, html] — 영상 시각에 맞춰 바꾼다. 바뀔 때 onCue(i).
export function subs(v, el, cues, onCue = () => {}) {
  let cur = -1;
  const tick = () => {
    const t = v.currentTime; const i = cues.findIndex(([a, b]) => t >= a && t < b);
    if (i !== cur) { cur = i; el.innerHTML = i < 0 ? '' : cues[i][2]; el.classList.toggle('on', i >= 0); if (i >= 0) onCue(i); }
    if (!v.paused && !v.ended) requestAnimationFrame(tick);
  };
  v.addEventListener('play', () => requestAnimationFrame(tick));
  v.addEventListener('seeked', tick);
}
// 태오 한마디(기록 A · again.call.s1e01-6.yo) — 말 마디는 영상 소리에서 잰 시각(silencedetect).
export const TAEO_CUES = [
  [1.40, 3.25, '식당에서 처음 만났죠?'],
  [3.25, 5.30, '그 장면, 오늘 한 번 더 해요.'],
  [5.30, 8.10, '이번엔 끝에 <b class="yo">「요」</b>까지 붙여서요.'],
];
export const SCENES = [
  { img: 'a/cafe.webp', pos: '30% 38%', place: '학생 식당', who: '태오 선배', act: '어제 한 말 다시 하기', line: '「한참 헤맸어요」 끝의 <b class="yo">「요」</b>까지', min: 1 },
  { img: 'a/transfer.webp', pos: '44% 46%', place: '캠퍼스', who: '같은 과 다른 선배', act: '길 묻기', line: '다음 수업 전에 마실 것을 사고 싶은데 그 가게를 못 찾았어요.', min: 1 },
  { img: 'a/gate.webp', pos: '64% 44%', place: '중앙도서관', who: '도서관 직원 되기 게임', act: '손님 표와 짐 맞춰 보기', line: '손님의 표와 짐을 안내문과 하나씩 맞춰 봐요.', min: 3 },
];
// 말하기 단추의 마이크 — 누르면 내가 말한다는 뜻(재생 삼각형은 「본다」로 읽힌다)
export const MIC = '<svg class="mic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
export const DATE = (() => { const d = new Date(); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`; })();
