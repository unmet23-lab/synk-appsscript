// B43 「영상통화까지 한 그 사람」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 MnUWYBp0a_c(148.9초 · 오마주 「형식만」)의 줄기를 같은 비율 자리로:
// 0초 첫 말(얼굴) · 2~4초마다 얼굴 · 손 · 넓은 판 · 들통은 원본 70% 자리(우리 21.5초 「없는 사람이에요」) · 끝은 손 근접.
// **v0.3(11-13 아침 — 여섯 편 받음)**: GOT에 없는 컷은 시작 그림으로 박자 · 글자만 본다. 동영상을 받으면 GOT에 넣고
// start · crop · 대사 초를 받은 영상의 소리 크기 곡선 + 받아쓰기로 다시 잰다.
// 컷마다 그 영상에 든 소리(대사 · 차 안 · 사무실 소리)를 그대로 깐다(audio). 말은 듣는 쪽 그림 위에도 깐다(a = 그 컷 밑에 까는 다른 영상의 소리).
// 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상 · 막히면 Flow Omni).
export type Crop = { s: number; cx: number; cy: number; ay?: number; push?: { t0: number; t1: number; to: number } }; // push = 컷 안 t0~t1초에 배율을 to배까지 천천히 키운다(다가감)
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; shade?: number; low?: number; a?: { src: string; start: number; vol?: number } };

// 받은 동영상만 mp4로 쓴다(못 받은 컷은 시작 그림으로 박자만 본다). 11-13 아침: V2 · V5 · V6 · V7 · V8 · V9 받음.
const GOT = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const V = (n: number) => `img/V${n}.${GOT.has(n) ? 'mp4' : 'png'}`;

// hook = 위 표시가 바뀌는 초 · desk = 경찰서 책상(음악이 빠짐) · taxi = 다시 택시 안 · end = 「SYNK 브리핑」
// v0.3(11-13 아침 · 받은 영상의 말 · 소리 실측): V1 「오빠, 오늘도 고생했어요」 0.6~2.3 · 「오빠, 나 믿죠? 이번 투자, 같이 해요」 5.0~8.25(다른 컷보다 10dB쯤 커서 0.6배) / V2 「밥은요? 먹었어요?」 0~2.5 · 「알았어요」 7.5~8.25 / V5 사진 놓기 2~3 · 「이분, 아시죠?」 4.75~6.0 /
// V6 「없는 사람이에요」 3.25~4.3 · 손이 폰으로 5.5~7 / V8 진동 3.0~4.25 · 6.0~7.25 · 폰을 집음 4.5~5 · 내려놓는 소리 7.75 / V9 빛 꺼짐 3.5~4
export const S = { hook: 4.85, desk: 14.5, taxi: 24.5, end: 31.9 };
export const TOTAL_S = 32.7;
// 원본(제미나이 앱 동영상)이 24fps라 편집도 24fps로 굽는다 — 30fps 시간선에 넣으면 5프레임마다 한 장이 겹쳐 떨린다(현장 노트 영상 · 24fps 원본).
export const FPS = 24;

const F: Crop = { s: 1.0, cx: 540, cy: 960 };
export const CUTS: CutT[] = [
  // 기 — 화면을 꽉 채운 폰 속 얼굴이 먼저 말을 건다 → 기사 얼굴 → 넓게(혼자인 택시 안)
  { from: 0, to: 2.3, src: V(1), start: 0.3, crop: F, audio: 0.6, drift: 0.008 },
  { from: 2.3, to: 4.85, src: V(2), start: 0.0, crop: F, audio: 1.0, drift: 0 },
  { from: 4.85, to: 7.0, src: V(3), start: 0.8, crop: F, audio: 0.8, drift: 0.01 },
  // 승 — 「나 믿죠?」 → 망설임과 끄덕임 → 보내는 엄지
  { from: 7.0, to: 10.45, src: V(1), start: 4.9, crop: { s: 1.12, cx: 540, cy: 760 }, audio: 0.6, drift: 0.008 },
  { from: 10.45, to: 12.5, src: V(2), start: 6.75, crop: { s: 1.1, cx: 540, cy: 860 }, audio: 1.0, drift: 0 },
  { from: 12.5, to: 14.5, src: V(4), start: 1.2, crop: F, audio: 0.9, drift: 0 },
  // 전 — 경찰서 책상: 넓게(사진이 놓임 · 「이분,」) → 기사 얼굴(그 위로 「아시죠?」가 이어짐) → 위에서 본 사진 여섯 장(핵심 장면 · 「없는 사람이에요」 · 손이 폰으로)
  { from: 14.5, to: 18.3, src: V(5), start: 1.2, crop: F, audio: 1.0, drift: 0 },
  { from: 18.3, to: 20.7, src: V(7), start: 2.0, crop: F, drift: 0, a: { src: 'img/V5.mp4', start: 5.0, vol: 1.0 } },
  { from: 20.7, to: 24.5, src: V(6), start: 2.95, crop: F, audio: 1.0, drift: 0, low: 150 },
  // 결 — 다시 택시 안: 또 걸려 온 그 얼굴 · 폰을 집어 한참 보다 내려놓음 → 엎어 놓은 폰과 손(끝 그림 · 새던 빛이 꺼짐)
  // 11-13 20시 최종 확인 미흡(끝 택시 기사가 다른 사람) → V8 다시(시작 그림 택시끝_201134 — 뿌리 얼굴 기사얼굴_010055_1 + 머리만 흐린 옛 구도).
  // 새 V8: 진동 0.25~1.5 · 2.25~3.75, 손을 뻗음 4.3 · 폰을 뺌 4.5~5.3 · 들고 봄 5.5~7.2 · 내림 7.25~7.5(7.6부터는 화면이 위로 놓임 — 안 씀).
  // 3.05~7.45: 울림 → 집어 들고 봄 → 내리는 중에 엎은 폰(V9)으로 넘김.
  { from: 24.5, to: 28.9, src: V(8), start: 3.05, crop: F, audio: 1.0, drift: 0 },
  { from: 28.9, to: 32.7, src: V(9), start: 0.6, crop: F, audio: 1.0, drift: 0, low: 0 },
];

// 이해 시험(11-13 · 한 번) 반영: 책상 사진이 무엇인지(시험관 셋) → 「다른 피해자들 폰에도 / 같은 얼굴」, 글 없는 택시 컷(셋) → 「그 뒤에도 / 전화는 왔어요」를 큰 글자로.
// 큰 글자 = 말. grey = 화면 속 그 사람의 말(기사 · 수사관 · 해설은 흰). at = 줄마다 뜨는 초(말하는 때). butter = 그 편에서 버터를 쓰는 한 줄(첫 줄).
// 11-13 콘티 검수 반영: 「영상통화까지 한」(보도보다 세던 「매일 영상통화한」을 고침) · 「이번 투자」 · 「돈을 보냈어요」 · 건너뜀마다 작은 글(「몇 달 뒤 · 경찰서」 · 「그 뒤에도 전화는 왔어요」) · 끝 줄에 기관 출처를 붙이지 않는다(우리 말이다)
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; instant?: boolean; at?: number[]; butter?: boolean }[] = [
  { lines: ['영상통화까지 한', '그 사람'], from: 0.0, to: 2.25, size: 84, instant: true, at: [0.0, 0.0] },
  { lines: ['밥은요? 먹었어요?'], from: 2.35, to: 4.75, size: 88 },
  { lines: ['오빠, 나 믿죠?', '이번 투자, 같이 해요'], from: 7.1, to: 10.4, grey: true, size: 88, at: [7.1, 8.6] },
  { lines: ['…알았어요'], from: 11.2, to: 12.45, size: 92 },
  { lines: ['그렇게,', '돈을 보냈어요'], from: 12.6, to: 14.45, size: 92, at: [12.6, 13.0] },
  { lines: ['다른 피해자들 폰에도', '같은 얼굴'], from: 14.6, to: 17.8, size: 80, meta: '몇 달 뒤 · 경찰서', at: [14.6, 15.5, 16.2] },
  { lines: ['이분, 아시죠?'], from: 18.05, to: 20.6, size: 92 },
  { lines: ['없는 사람', '이에요'], from: 21.05, to: 22.4, size: 112, instant: true, butter: true, at: [21.05, 21.05] },
  { lines: ['남의 사진을 합성해 만든', '가짜 인물이었어요', '경찰이 밝힌 피해자 100여 명'], from: 22.45, to: 26.6, size: 70, meta: '울산경찰청 발표 · 2026년 1월', at: [22.45, 23.45, 24.75] },
  { lines: ['그 뒤에도', '전화는 왔어요'], from: 26.7, to: 28.5, size: 88, at: [26.7, 26.7] },
  { lines: ['얼굴을 봤어도,', '만난 적 없는 사람에겐', '돈을 보내지 마세요'], from: 28.6, to: 32.65, size: 78, at: [28.6, 29.5, 30.7] },
];

export const VO: { id: string; t: number }[] = [
  { id: 'n1', t: 12.7 }, { id: 'n2', t: 22.45 }, { id: 'n3', t: 28.6 },
];

// 새 V8은 폰을 든 뒤 진동이 멎는다 — 들고 보는 동안(「그 뒤에도 전화는 왔어요」)도 전화가 울리게 같은 영상의 첫 진동(0.25~1.5)을 26.7초에 다시 깐다. dur는 프레임.
export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [
  { t: 26.7, vol: 0.8, src: 'img/V8.mp4', dur: 38 },
];
