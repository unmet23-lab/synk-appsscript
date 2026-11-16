// LAB 영어 E40 「전기장판」(11-16 15시 회차) — 원본 같은분야 TTMIK 「My kids didn't know this Korean word」(172.9초 · 말하는 사람 한 명:
// 몰랐던 말 → 장판이 무엇인지 · 옛 장판 만드는 법 → 전기장판 → 끝 인사).
// 우리: 한겨울 원룸에서 떨던 몽글이 전기장판을 켜자 치즈처럼 녹는다(핵심 장면) → 「전기장판」 →
// 다음 날 아침 알람에 일어나려다 치즈처럼 늘어나 장판에서 안 떨어지고 → 끝 3초에 철퍽 다시 녹아 「포기…」.
// v2(이해 시험 v1 · 볼 이유 v1 뒤): 머리 글을 큰 「−12°C」로(haiku 9번 「영어 두 줄 머리 글」), 바닥 화살표를 뺌(넷이 「floor covering」을 헤맴),
//   녹은 뒤 숨 · 아침에 일어나려다 늘어남(볼 이유 「규칙을 글 상자로만」).
// v3(이해 시험 v2 · 볼 이유 v2 뒤): 장판 쪼개기 풀이를 화면에서 빼고 게시글로(GPT · 그록 · sonnet 「장판 = floor인데 왜 매트」 ·
//   haiku · GPT 「10초에 넘김」 · 볼 이유 「8~12초가 가장 약하다 — 카드는 1~2초만」), 「5분만」(잠 농담 — GPT 9번 「지난 편 낮잠 농담과 같다」)
//   대신 일어나려다 장판에 붙어 늘어나는 몸 개그로, 처음 2.4초 몸이 떨고 밀어 들어감(그록 · 볼 이유 「0~2초 같은 화면」), 아침 판을 밝게(그록 「창밖이 밤 같다」).
// v4(이해 시험 v3 뒤 — 다시 시험 두 번을 다 써 시험 없이 고침): 넷이 모두 「14~16초 붙어서 못 일어남을 영어 글로만 앎」을 짚어,
//   일어나려는 시도를 세 번(늘어남 → 철퍽)으로 쪼개고 「못 일어나…!」 목소리와 말풍선을 더함(글 「I'm stuck to it」은 뺌), 늘어남을 덜 번지게,
//   끝 0.5초 얼굴 겹침 녹임을 빼고 바로 넘김(볼 이유 v3 「털 번짐 · 얼굴 겹침이 렌더 깨짐처럼」), 아침 창을 더 밝게(그록 v2 · v3 「창밖이 밤」),
//   첫 프레임부터 머리 글(haiku v3 「0초 화면이 밋밋」).
// 그림 · 한국어 목소리 · 박자는 여기, 화면 글(영어 판 정본)은 LOCS.
export const FPS = 30;
export const TOTAL = 20.4; // 원본 172.9초의 12%(오마주.json 「다르게」 길이)

// zoom · origin을 주면 그 칸은 같은 판을 가까이 당겨 쓴다(가까이 칸) · filter는 그 칸의 판에만 건다(아침 빛)
export type Cell = { at: number; img: string; zoom?: number; origin?: string; push?: [number, number]; filter?: string };
const MORNING = 'brightness(1.2) saturate(1.04)';
export const CELLS: Cell[] = [
  { at: 0.0, img: 'b1.jpg', push: [1.02, 1.12], origin: '52% 56%' }, // 훅 — 꺼진 전기장판 위에서 담요를 쓰고 떠는 몽글(몸이 떨고 화면이 밀어 들어감)
  { at: 2.4, img: 'b2.jpg' }, // 가까이 — 몽글이 몸으로 조절기를 눌러 켠다(딸깍, 불이 들어옴)
  { at: 3.3, img: 'b3.jpg' }, // 장판이 데워지고 몽글이 풀린다
  { at: 3.4, img: 'b4.jpg' }, // 핵심 장면 — 녹는다(3.4~6.3초 b3에서 b4로 천천히 풀리다 빨리 녹아내림)
  { at: 9.4, img: 'b5.jpg', filter: MORNING }, // 다음 날 아침 — 알람
  { at: 13.2, img: 'b5.jpg', zoom: 1.32, origin: '52% 54%', filter: MORNING }, // 가까이 — 둘째 시도: 가장 높이 늘어나 「못 일어나…!」
  { at: 15.6, img: 'b5.jpg', filter: MORNING }, // 다시 넓게 — 알람이 또 울리고 셋째 시도는 힘없이
  { at: 17.6, img: 'b7.jpg', filter: MORNING }, // 끝 3초 — 철퍽 다시 납작(원본 반전 149.2초 「전기장판」 제목 자리 — 원본 길이에 맞춘 17.61초)
];

// 몸 자리(판 좌표) — cx · cy · rx · ry는 둥근 가림, baseY는 눌리거나 늘어날 때 붙어 있는 바닥 줄
export type Body = { cx: number; cy: number; rx: number; ry: number; baseY: number };
// 녹아내림 — 앞 판(top)의 몽글을 둥글게 떠서 바닥 줄을 기준으로 눌러 펴며 흐리게 하고, 밑에 녹은 판을 깐다
export type Melt = { from: number; dur: number; top: string; body: Body };
export const MELTS: Melt[] = [
  { from: 3.4, dur: 2.9, top: 'b3.jpg', body: { cx: 560, cy: 1180, rx: 470, ry: 340, baseY: 1420 } },
];
// 떨림 — 처음 2.4초 담요 쓴 몽글의 몸이 잘게 떤다(b1)
export const SHIVER = { from: 0, to: 2.4, img: 'b1.jpg', body: { cx: 565, cy: 1110, rx: 330, ry: 360, baseY: 1420 }, px: 9 };
// 숨 — 녹은 몽글의 둥근 머리가 천천히 부풀었다 가라앉는다(6.3~9.4초 b4)
export const BREATHE = { from: 6.3, to: 9.4, img: 'b4.jpg', body: { cx: 545, cy: 1225, rx: 250, ry: 125, baseY: 1330 }, amp: 0.05, period: 1.5 };
// 늘어남 — 아침에 일어나려던 몽글의 머리가 치즈처럼 위로 늘어났다가(올라감) 장판에 붙은 채 버티다(버팀) 철퍽 내려앉는다(b5) — 세 번
export type Try = { from: number; peak: number; snap: number; to: number; max: number };
export const STRETCH_BODY = { cx: 560, cy: 1282, rx: 228, ry: 112, baseY: 1352 };
export const TRIES: Try[] = [
  { from: 10.9, peak: 11.9, snap: 12.15, to: 12.35, max: 1.7 },
  { from: 13.3, peak: 14.4, snap: 15.1, to: 15.3, max: 2.1 },
  { from: 16.1, peak: 16.9, snap: 17.35, to: 17.55, max: 1.35 },
];

// 몽글 목소리(소진) — 초 · 파일
export const VO: [number, string][] = [
  [0.35, 'm1'], // 추, 추워…
  [3.55, 'm2'], // 아~ 따뜻해~
  [5.15, 'm3'], // 녹는다~
  [7.35, 'm4'], // 전기장판…
  [9.9, 'm6'], // 일어나야지…
  [14.0, 'm8'], // 못 일어나…!
  [17.95, 'm7'], // 포기…
];

export const T = {
  hookTo: 2.4,
  cold: 0.35, // 몽글 「추, 추워…」
  coldTo: 2.4,
  warm: 3.55, // 「아~ 따뜻해~」
  warmTo: 5.1,
  melt: 5.15, // 「녹는다~」
  meltTo: 7.2,
  word: 7.2, // 전기장판 카드
  wordTo: 9.4,
  morning: 9.4, // 다음 날 아침
  morningTo: 11.2,
  getUp: 9.9, // 「일어나야지…」
  getUpTo: 10.95,
  stuck: 14.0, // 「못 일어나…!」
  stuckTo: 15.6,
  end: 17.6, // 끝 3초 — 다시 납작 + 큰 전기장판
  giveUp: 17.95, // 「포기…」
  ask: 18.5, // 끝 질문
  zoomCut: 19.6, // 화면이 한 번에 당겨 들어간다(원본 끝 인사 166.2초 자리 — 원본 길이에 맞춘 19.62초)
};

// 알람 — 휴대폰이 울릴 때 화면이 짧게 떤다
export const BUZZ = [9.45, 10.2, 15.65, 16.4];
// 다시 녹을 때 화면이 한 번 툭 내려앉는다
export const THUD = { at: 17.6, amp: 0.05 };

export const SFX: [number, string, number][] = [
  [0.0, 'chatter.wav', 0.55],
  [2.4, 'whoosh.wav', 0.25],
  [2.6, 'click.wav', 0.7],
  [2.75, 'warm.wav', 0.6],
  [3.3, 'sparkle.wav', 0.25],
  [4.75, 'melt.wav', 0.7],
  [5.3, 'steam.wav', 0.35],
  [7.2, 'pop.wav', 0.35],
  [9.4, 'alarm.wav', 0.55],
  [10.9, 'stretch.wav', 0.5],
  [12.2, 'splat.wav', 0.6],
  [13.2, 'whoosh.wav', 0.2],
  [13.3, 'stretch.wav', 0.6],
  [15.15, 'splat.wav', 0.65],
  [15.6, 'alarm.wav', 0.45],
  [16.1, 'stretch.wav', 0.35],
  [17.45, 'splat.wav', 0.75],
  [17.7, 'steam.wav', 0.3],
  [18.5, 'pop.wav', 0.35],
  [19.6, 'whoosh.wav', 0.22],
];

// 화면 글(영어 판 정본) — 한국어 · 읽는 법(로마자)은 모든 판 그대로, 영어 · 뜻만 판마다
export type Loc = 'en' | 'zhs' | 'my';
export type LocText = {
  font: string;
  hookBig: string;
  hookSub: string;
  coldMean: string;
  warmMean: string;
  meltMean: string;
  wordMean: string;
  morning: string;
  getUpMean: string;
  stuck: string;
  giveUpMean: string;
  ask: string;
};
export const FONT = "'Inter Tight', 'SUIT', sans-serif";
export const LOCS: Record<Loc, LocText> = {
  en: {
    font: FONT,
    hookBig: '−12°C 🥶',
    hookSub: 'and no heater…',
    coldMean: 'so cold…',
    warmMean: 'ahh~ so warm~',
    meltMean: 'I’m melting~ 🫠',
    wordMean: 'electric heating mat',
    morning: 'Next morning ☀️⏰',
    getUpMean: 'gotta get up…',
    stuck: 'I can’t get up! 😣',
    giveUpMean: 'I give up… 🫠',
    ask: 'What keeps YOU warm\nin winter? Comment 👇',
  },
  zhs: { font: "'Inter Tight', 'Microsoft YaHei', sans-serif", hookBig: '', hookSub: '', coldMean: '', warmMean: '', meltMean: '', wordMean: '', morning: '', getUpMean: '', stuck: '', giveUpMean: '', ask: '' },
  my: { font: "'Inter Tight', 'Myanmar Text', sans-serif", hookBig: '', hookSub: '', coldMean: '', warmMean: '', meltMean: '', wordMean: '', morning: '', getUpMean: '', stuck: '', giveUpMean: '', ask: '' },
};
