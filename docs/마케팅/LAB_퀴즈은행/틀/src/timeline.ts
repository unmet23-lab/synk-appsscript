// 3초 관용구 퀴즈 · 현지어 틀 v6(2026-11-10) 박자표. 100 BPM(한 박 18프레임 = 0.6초) — 값의 정본은 beats.json이다
// (틀/판본글.mjs · 목소리계획.mjs · 렌더.mjs · 음악.mjs가 같은 파일을 읽는다).
// v5까지: 문제 9.6초 세 번 + 끝 4.5초 = 33.3초 — 이해 시험관 넷이 모두 「같은 순서 세 번」(재미 3), 볼 이유 심사가 내내 「둘 다 아님」.
// v6: 문제마다 꼴 · 길이가 다르다 — ① 보기 셋 · 셋 둘 하나 · 따라 말하고 「이제 네가」(12.6초) ② 「둘 중 하나」 · 둘 하나(7.8초)
//     ③ 「맞을까 틀릴까」 — 함정 뜻 하나에 ✓ · ✗(10.2초) · 끝은 그림 붙은 복습 줄 → 점수 → 끝 장면 한 장(7.2초) = 37.8초.
//     보기는 몽골어 초당 13자로 읽을 틈을 잡았다(v5 글자 검사: 2.9초에 81자).
//     곡은 원곡에서 다시 잘랐다(틀/음악.mjs) — 문제마다 킥이 멈춘 세 박에 카운트다운, 다시 터지는 박에 정답.
import beats from './beats.json';

export const FPS = beats.fps;
export const B = beats.beat; // 100 BPM 한 박

export type QKind = 'three' | 'duel' | 'ox';
export type QSpec = {
  kind: QKind;
  len: number; // 문제 길이(박)
  beat2: number; // 글자 그대로 장면의 둘째 박(장면 속 사건 — 둘째 컷이나 움직임이 여기서 터진다)
  band: number; // 띠 한 줄(첫 문제 「하지만 뜻은 전혀 달라요!」 · 둘째 「둘 중 하나를 골라요!」 · 셋째 「마지막 건 속지 마세요!」)
  board: number; // 장면이 올라가고 보기가 뜨기 시작
  opts: number[]; // 보기마다 뜨는 박(ox는 [함정 뜻 카드, ✓ · ✗ 단추])
  count: number[]; // 셋 · 둘 · 하나(둘째 문제는 둘 · 하나)
  reveal: number; // 정답
  say: number; // 해요체 따라 말하기(한국어 목소리)
  turn: number | null; // 「이제 네가 말해!」 — 첫 문제만
  label: boolean; // 다리 글 머리 「글자 그대로 옮기면:」 — 첫 문제만(둘째부터는 따옴표 글만)
};

export const fr = (beat: number) => Math.round(beat * B);
export const QS = beats.questions as QSpec[];
export const Q_COUNT = QS.length;
export const Q_START = QS.map((_, i) => fr(QS.slice(0, i).reduce((n, q) => n + q.len, 0)));
export const Q_FRAMES = QS.map((q) => fr(q.len));
export const END_START = fr(QS.reduce((n, q) => n + q.len, 0)); // 900
export const END_LEN = fr(beats.end.len); // 234
export const TOTAL = END_START + END_LEN; // 1134프레임 = 37.8초
export const qStart = (i: number) => Q_START[i];

/** 문제 안 사건(문제 시작 기준 프레임). */
export const qT = (i: number) => {
  const s = QS[i];
  const reveal = fr(s.reveal);
  return {
    beat2: fr(s.beat2),
    band: fr(s.band),
    board: fr(s.board),
    opts: s.opts.map(fr),
    count: s.count.map(fr),
    reveal,
    flip: reveal + 7, // 정답이 초록으로 바뀐 뒤 장면 카드가 뒤집혀 뜻 장면이 된다(10프레임)
    say: fr(s.say),
    turn: s.turn === null ? null : fr(s.turn),
    len: fr(s.len),
  };
};

/** 끝 장면 안 사건(끝 시작 기준 프레임). */
export const E = {
  recap: beats.end.recap.map(fr), // 그림 붙은 복습 줄 셋
  ask: fr(beats.end.ask), // 끝 질문 · 점수 칸(끝까지 남는다)
  scene: fr(beats.end.scene), // 복습 줄이 물러나고 끝 장면 한 장(그 편의 이야기를 받아치는 장면)
  cheer: fr(beats.end.cheer), // 한국어 응원 말(곡의 마지막 두 타격 가운데 첫째)
  logo: fr(beats.end.logo), // 로고(둘째 타격)
  len: END_LEN,
} as const;

/** 장면이 바뀌는 프레임. */
export const CUTS = [Q_START[1], Q_START[2], END_START];

/** 한 장면 심사용 장면(제목 · 이름표 없이 첫 문제의 글자 그대로 장면 → 뜻 장면, 「한 장면 먼저」). */
export const SCENE_LEN = fr(9); // 5.4초
