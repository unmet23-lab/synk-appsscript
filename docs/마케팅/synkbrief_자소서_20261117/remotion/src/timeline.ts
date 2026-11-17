// B49 「인사팀 책상 위 네 장」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 형식 원본 jxtY4RzpaTc(AI 숏드라마 · 71.5초):
// 0.5 훅(여는 한 컷) · 23.7 장소가 바뀌며 넓어짐 · 57 반전(빠른 접사 — 서류가 쏟아짐) · 70.7 끝 장치(서류 한 장으로 끊김).
// 우리 길이(53.3초 · 원본의 75%)에 원본 초 × 0.64로 앉힌 자리 — 장소 바뀜 15.2 · 반전 36.5(핵심 장면 V9) · 끝 장치 45.6~49.8(더미 밑의 한 장).
// 컷마다 그 영상에 든 소리(대사 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상 · Flow Omni).
// 받은 판의 대사 시각은 받아쓰기로 말을 맞춘 뒤, 초는 0.1초 소리 크기로 잡는다(받아쓰기는 말 시작을 0.3~0.7초 이르게 잡는다).
// 이 판은 설계 초다(11-17 08시 — 받기 전). 받은 판마다 start · 말 초를 실측으로 고친다.
export type Crop = { s: number; cx: number; cy: number; ay?: number; push?: { t0: number; t1: number; to: number } };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; shade?: number; low?: number; blur?: number; look?: 'past' | 'dim'; join?: boolean; a?: { src: string; start: number; vol?: number } };

// reveal = 핵심 장면(네 장) · card = 사실 한 장(위 표시를 잠깐 뺌) · end = 끝 3.5초(네 장 다시)
export const S = { hook: 0, reveal: 36.5, stop: 53.3, card: [42.8, 45.6] as [number, number], end: 49.8 };
export const TOTAL_S = 53.3;
export const FPS = 24;

const F: Crop = { s: 1.0, cx: 540, cy: 960 };
// 핵심 장면 접사 — V9(720×1280을 1080×1920으로 그린 좌표)의 소제목 넷 가운데(y 576 · 795 · 1008 · 1214, x 547 · 폭 855). 1.22배로 당겨 화면 가운데 아래(ay 940 → 내림 210)에
const H1: Crop = { s: 1.22, cx: 547, cy: 576, ay: 940 };
const H2: Crop = { s: 1.22, cx: 547, cy: 795, ay: 940 };
const H3: Crop = { s: 1.22, cx: 547, cy: 1008, ay: 940 };
const H4: Crop = { s: 1.22, cx: 547, cy: 1214, ay: 940 };
export const CUTS: CutT[] = [
  // 훅 — 결과 먼저: 위에서 본 인사팀 책상, 넷째 장이 내려앉음(V9 0.65~1.95 — 장면 심사가 짚은 0.5초의 겹쳐 비친 종이는 빼고)
  { from: 0.0, to: 1.3, src: 'img/V9.mp4', start: 0.65, crop: F, audio: 0.6, drift: 0.01 },
  // 기 — 새벽 2시 원룸. 취준생 근접(V1): 안경을 밀어 올리고 눈을 감았다 뜸
  { from: 1.3, to: 3.6, src: 'img/V1.mp4', start: 0.0, crop: F, audio: 1.0, drift: 0.008 },
  // 입력창(V2) 「자소서 소제목이랑 / 첫 문단 써 줘」 · 엔터 탁
  { from: 3.6, to: 5.6, src: 'img/V2.mp4', start: 0.8, crop: F, audio: 1.0, drift: 0.01 },
  // 취준생(V1 뒤쪽) 눈이 커짐 「…오.」
  { from: 5.6, to: 9.0, src: 'img/V1.mp4', start: 4.3, crop: F, audio: 1.0, drift: 0.006 },
  // AI가 낸 소제목(V4) [끊임없이 도전하고 성장하는 인재]
  { from: 9.0, to: 10.6, src: 'img/V4.mp4', start: 1.0, crop: F, audio: 1.0, drift: 0.012 },
  // 옆모습(V3) 안경을 머리 위로 · 「됐다. 그럴듯해.」
  { from: 10.6, to: 13.2, src: 'img/V3.mp4', start: 1.2, crop: F, audio: 1.0, drift: 0.006 },
  // 「제출하기」 딸깍(V5 · Flow — 딸깍 1.7~1.8 → 13.9) · 손이 빠짐
  { from: 13.2, to: 15.2, src: 'img/V5.mp4', start: 1.0, crop: F, audio: 1.0, drift: 0.01 },
  // 장소가 바뀌며 넓어짐 — 일주일 뒤 인사팀(V6) 대리가 더미를 툭 「팀장님, 오늘 온 거요」
  { from: 15.2, to: 17.9, src: 'img/V6.mp4', start: 0.0, crop: F, audio: 1.0, drift: 0.006 },
  // 승 — 대리(V7) 「끊임없는 도전으로 성장한 인재」
  { from: 17.9, to: 21.0, src: 'img/V7.mp4', start: 0.6, crop: F, audio: 1.0, drift: 0.006 },
  // 팀장(V8) 「도전을 두려워하지 않는 인재」
  { from: 21.0, to: 23.4, src: 'img/V8.mp4', start: 0.8, crop: F, audio: 1.0, drift: 0.006 },
  // 대리(V7) 「여기도 도전이요」
  { from: 23.4, to: 26.0, src: 'img/V7.mp4', start: 4.2, crop: F, audio: 1.0, drift: 0.006 },
  // 팀장(V8) 안경을 벗고 콧등 · 「…또?」
  { from: 26.0, to: 28.6, src: 'img/V8.mp4', start: 3.4, crop: F, audio: 1.0, drift: 0.006 },
  // 대리(V7 끝) 멈칫 「끊임없이 도전하고 성장하는 인재」 — 그 새벽의 소제목
  { from: 28.6, to: 32.8, src: 'img/V7.mp4', start: 7.0, crop: F, audio: 1.0, drift: 0.006 },
  // 긴 버팀 — 팀장(V8 뒤쪽) 말없이 더미를 봄 → 「…줘 봐.」
  { from: 32.8, to: 36.5, src: 'img/V8.mp4', start: 6.3, crop: F, audio: 1.0, drift: 0.004 },
  // 전 — 핵심 장면(원본 57초 「빠른 접사 여섯」 자리): 소제목 넷을 한 장씩 0.6초씩 당겨 보인 뒤(종이 탁 넷) 네 장 전체(V9z — 손이 빠져나감)
  // 장면 심사(11-17 · 맥락 없는 Opus 「넘김 · 2점」 — 「글을 읽어야 들어온다 · 같은 낱말이 쌓이게」) → 접사 넷으로 쌓는다. 손가락이 글자를 가리는 V9 2.1~3.2초는 쓰지 않는다
  { from: 36.5, to: 37.1, src: 'img/V9.mp4', start: 1.0, crop: H1, drift: 0.02 },
  { from: 37.1, to: 37.7, src: 'img/V9.mp4', start: 1.3, crop: H2, drift: 0.02 },
  { from: 37.7, to: 38.3, src: 'img/V9.mp4', start: 3.3, crop: H3, drift: 0.02 },
  { from: 38.3, to: 38.9, src: 'img/V9.mp4', start: 3.4, crop: H4, drift: 0.02 },
  { from: 38.9, to: 40.3, src: 'img/V9z.mp4', start: 0.4, crop: F, audio: 0.8, drift: 0.006 },
  // 팀장(V10) 한숨 「…사람이 안 보이네.」
  { from: 40.3, to: 42.8, src: 'img/V10.mp4', start: 0.0, crop: F, audio: 1.0, drift: 0.006 },
  // 사실 한 장 — 네 장(V9z 뒤쪽 · 손이 빠진 판)을 어둡게 깐 위
  { from: 42.8, to: 45.6, src: 'img/V9z.mp4', start: 2.2, crop: F, drift: 0.008, look: 'dim' },
  // 결 — 팀장(V10) 왼손으로 더미 밑에서 한 장을 빼냄
  { from: 45.6, to: 47.0, src: 'img/V10.mp4', start: 4.2, crop: F, audio: 1.0, drift: 0.006 },
  // 끝 장치 — 다른 한 장(V11 · Flow, 바스락 0.8~2.6 — 2.7초 뒤는 소리가 완전히 비어 쓰지 않는다) [편의점 야간 2년, / 버리는 도시락을 반으로]
  { from: 47.0, to: 48.2, src: 'img/V11.mp4', start: 1.2, crop: F, audio: 1.0, drift: 0.012 },
  // 팀장(V10 끝) 눈썹이 올라가며 「…이 사람은 만나 보자.」
  { from: 48.2, to: 49.8, src: 'img/V10.mp4', start: 8.0, crop: F, audio: 1.0, drift: 0.006 },
  // 끝 3.5초 — 핵심 장면(네 장 · V9z 손이 빠진 뒤 천천히 다가감)을 다시, 끝 줄을 제목만 한 크기로. 영상 소리는 깔지 않는다
  { from: 49.8, to: 53.3, src: 'img/V9z.mp4', start: 3.0, crop: F, drift: 0.004, low: 300 },
];

// 큰 글자 = 말. 흰 = 취준생 · 팀장의 말, grey = 대리의 말(흠 장부 #29 — 소리를 꺼도 누가 말했는지 갈리게). at = 줄마다 뜨는 초.
// [ ] = 버터 글자(이 편의 버터 한 곳 — 끝 줄의 「내가 해 본 일」).
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; metaSize?: number; deep?: boolean; instant?: boolean; at?: number[]; butter?: boolean; bi?: number; metaBelow?: boolean }[] = [
  { lines: ['AI가 써 준 자소서', '인사팀 책상에선 이렇게 보여요'], from: 0.25, to: 2.8, size: 84, instant: true, deep: true },
  { lines: ['…오'], from: 6.6, to: 8.6, size: 104 },
  { lines: ['됐다', '그럴듯해'], from: 11.4, to: 13.1, size: 100, at: [11.4, 12.1] },
  { lines: ['팀장님, 오늘 온 거요'], from: 15.9, to: 17.8, grey: true, size: 92, meta: '일주일 뒤 · 인사팀', metaSize: 44 },
  { lines: ['「끊임없는 도전으로', '성장한 인재」'], from: 18.5, to: 20.9, grey: true, size: 92, at: [18.5, 19.6] },
  { lines: ['「도전을 두려워하지', '않는 인재」'], from: 21.8, to: 23.3, size: 92, at: [21.8, 22.6] },
  { lines: ['여기도 도전이요'], from: 23.9, to: 25.9, grey: true, size: 100 },
  { lines: ['…또?'], from: 26.9, to: 28.5, size: 108 },
  { lines: ['「끊임없이 도전하고', '성장하는 인재」'], from: 29.3, to: 32.7, grey: true, size: 92, at: [29.3, 30.6] },
  { lines: ['…줘 봐'], from: 35.0, to: 36.4, size: 104 },
  { lines: ['…사람이 안 보이네'], from: 40.9, to: 42.7, size: 100 },
  { lines: ['챗GPT로 쓴 게 확인되면', '감점 42.2% · 불합격 23.2%'], from: 42.95, to: 45.5, size: 80, meta: '고용노동부 · 한국고용정보원 조사\n(500대 기업 인사담당자 315곳 응답)', metaSize: 44, deep: true, at: [42.95, 43.9] },
  { lines: ['…이 사람은 만나 보자'], from: 48.3, to: 49.75, size: 96 },
  { lines: ['첫 줄은 AI 말고', '[내가 해 본 일]로'], from: 49.9, to: 53.4, size: 116, meta: '기업이 신입 채용에서 가장 많이 본 것\n「직무 관련 일 경험」(고용노동부 조사)', metaSize: 46, instant: true, metaBelow: true, deep: true },
];

// 짚기 — 이 편은 쓰지 않는다(소제목은 위에서 본 큰 글자라 둘레를 누르지 않아도 읽힌다). 받은 판을 보고 필요하면 더한다
export const SPOTS: { from: number; to: number; x: number; y: number; w: number; h: number; a: number }[] = [];

// 배경음(보유곡 따뜻_118 — 곡 안 빈 마디 62.25초 앞에서 끝난다) 볼륨 곡선. 받은 판을 보고 고친다
export const BGM = {
  t: [0, 0.6, 15.0, 15.4, 36.3, 36.7, 40.2, 40.6, 42.6, 43.0, 45.4, 45.8, 49.6, 50.0, 52.7, 53.3],
  v: [0.06, 0.1, 0.1, 0.1, 0.1, 0.07, 0.07, 0.1, 0.1, 0.16, 0.16, 0.1, 0.1, 0.22, 0.22, 0],
};

export const VO: { id: string; t: number }[] = [];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [
  // 핵심 장면 접사 넷 — 종이 탁(합성 · public/sfx/paper_slap.wav)
  { t: 36.5, vol: 0.55, src: 'sfx/paper_slap.wav', dur: 8 },
  { t: 37.1, vol: 0.55, src: 'sfx/paper_slap.wav', dur: 8 },
  { t: 37.7, vol: 0.55, src: 'sfx/paper_slap.wav', dur: 8 },
  { t: 38.3, vol: 0.65, src: 'sfx/paper_slap.wav', dur: 8 },
  // 여는 컷의 넷째 장이 내려앉는 소리(V9 자체 소리가 작다)
  { t: 0.08, vol: 0.5, src: 'sfx/paper_slap.wav', dur: 8 },
];
