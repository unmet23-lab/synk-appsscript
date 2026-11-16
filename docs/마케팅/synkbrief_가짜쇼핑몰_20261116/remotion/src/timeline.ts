// B52 「가짜 쇼핑몰」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 형식 원본 vcIyYKZ4K-A(지역 방송 고발 쇼츠 · 73.2초):
// 0 훅(제목이 결말을 약속 + 곳 · 사람) · 22.6 반전(결정적 단서를 보고 수상함을 알아챔) · 57.7 끝 장치(막아 낸 사람이 직접 하는 한마디).
// 우리 길이(44.35초)에 맞춘 자리 — 반전 13.7 → 언니 컷 13.7(「…어?」 14.0) · 끝 장치 35.0 → 언니의 당부 컷 35.25(오마주.json 「다르게」 길이).
// 컷마다 그 영상에 든 소리(대사 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상 V1 · V5 · V8b · V10, Flow Omni V2 · V3 · V4 · V6r · V7 · V9 · V11r).
// 받은 판의 대사 시각은 받아쓰기(faster-whisper large-v3-turbo)로 말을 맞춘 뒤, 초는 0.1초 소리 크기(−36dB 넘는 구간)로 잡았다(받아쓰기는 말 시작을 0.3~0.7초 이르게 잡는다).
// v2(11-16 이해 시험 넷 · 장면 심사 · 최종본 검사 고침): 언니 반전 컷을 Flow로 다시 받은 V6r(얼굴이 뿌리 그림과 같은 3/4 방향)로 · 결제 화면 두 번째 컷과 끝의 웃음 컷을 뺌 ·
//   당부 뒤 검색 화면 인서트(굳음 0.063)를 빼고 당부를 한 판으로 · 핵심 장면 첫 0.4초부터 두 주소를 크게 · 자막 「2주째」 · 출처 줄을 키움.
export type Crop = { s: number; cx: number; cy: number; ay?: number; push?: { t0: number; t1: number; to: number } };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; shade?: number; low?: number; blur?: number; look?: 'past' | 'dim'; join?: boolean; a?: { src: string; start: number; vol?: number } };

// reveal = 반전(언니의 한마디) · card = 사실 한 장(위 표시를 잠깐 뺌) · end = 끝 3.5초(두 주소)
export const S = { hook: 0, reveal: 13.7, stop: 44.35, card: [29.45, 32.45] as [number, number], end: 40.85 };
export const TOTAL_S = 44.35;
export const FPS = 24;

const F: Crop = { s: 1.0, cx: 540, cy: 960 };
export const CUTS: CutT[] = [
  // 기 — 늦은 오후 침실. 동생 근접(V1): 휴대폰을 보다 눈이 커지며 「칠십이 퍼센트?」(소리 2.2~3.45 → 1.2~2.45)
  { from: 0.0, to: 2.6, src: 'img/V1.mp4', start: 1.0, crop: F, audio: 1.0, drift: 0 },
  // AI 답 화면(V2) — 「AI 쇼핑 도우미」 · 「공식몰 블프 특가 페이지예요」 · 링크 카드 noer0a.com, 엄지가 들어와 링크를 누름(2.4 → 3.7)
  { from: 2.6, to: 4.4, src: 'img/V2.mp4', start: 1.3, crop: F, audio: 1.0, drift: 0.01 },
  // 승 — 문간의 언니(V4) 「그 코트 어디서 사?」(소리 3.2~4.4 → 5.2~6.4)
  { from: 4.4, to: 6.9, src: 'img/V4.mp4', start: 2.4, crop: F, audio: 1.0, drift: 0.008 },
  // 동생(V5 앞쪽) 고개도 안 들고 「AI가 알려 준 공식몰」(소리 1.7~3.2 → 7.7~9.2) · 「오늘 밤까지 72%래」(3.8~5.4 → 9.8~11.4)
  { from: 6.9, to: 11.7, src: 'img/V5.mp4', start: 0.9, crop: F, audio: 1.0, drift: 0 },
  // 결제 화면(V3) — 164,900원 · 카드 번호 · 엄지가 「결제하기」 위로 내려옴(1.2~3.2 — 엄지가 머무는 뒤쪽은 굳음 검사 0.101이라 뺌)
  { from: 11.7, to: 13.7, src: 'img/V3.mp4', start: 1.2, crop: F, audio: 1.0, drift: 0.01 },
  // 전 — 반전: 언니(V6r · Flow Omni로 다시 받음 — 이해 시험 sonnet · haiku 「14.6~19.4초 언니가 다른 사람 같다」) 「…어?」(소리 0.6 → 14.0) · 「나도 거기서 샀는데」(1.6~2.6 → 15.0~16.0) · 「2주째 안 와」(3.5~4.3 → 16.9~17.7)
  { from: 13.7, to: 18.4, src: 'img/V6r.mp4', start: 0.3, crop: F, audio: 1.0, drift: 0 },
  // 동생(V5 뒤쪽) 고개를 들어 언니를 보며 「…2주째?」(소리 8.9~9.5 → 19.1~19.7) — 결제를 멈춘다
  { from: 18.4, to: 20.1, src: 'img/V5.mp4', start: 8.2, crop: F, audio: 1.0, drift: 0 },
  // 언니가 바구니를 바닥에 내려놓으며 침대에 걸터앉고(0.3~0.8) 분홍 휴대폰을 꺼내 보이며 「봐 봐」(V7 소리 3.0~3.4 → 22.8~23.2) — 컷 연속성 41(바구니 손 → 바닥)
  // 「봐 봐」가 다른 대사보다 6dB 작게 들어가(v3 실측 −22.2 · 다른 대사 −16 안팎) 이 컷 소리를 1.6배(+4dB)로
  { from: 20.1, to: 23.25, src: 'img/V7.mp4', start: 0.3, crop: F, audio: 1.6, drift: 0.008 },
  // 검색(V11r · Flow Omni로 다시 받음 — 첫 판은 엄지가 멈춰 굳음 검사 0.094) — 「NOEROA 공식」 첫 결과 noeroa.com 「NOEROA 공식 온라인 스토어」, 엄지가 올라가 첫 결과를 누름(0.5~2.1)
  { from: 23.25, to: 24.85, src: 'img/V11r.mp4', start: 0.5, crop: F, audio: 1.0, drift: 0.01 },
  // 핵심 장면(V8b): 맞댄 두 휴대폰 noer0a.com(분홍 · 언니 · 배송 준비 중) · noeroa.com(투명 · 동생 · 공식 온라인 스토어)으로 다가감
  // → 동생 속삭임 「…한 글자 달라」(소리 6.45~7.3 → 26.7~27.55) · 언니 「응?」(8.4~8.55 → 28.65). 두 주소 칸만 남기고 둘레를 누른다(SPOTS)
  // 장면 심사(11-16 · 맥락 없는 Opus 「넘김 · 2점」 — 「처음 2초 동안 휴대폰 두 대만 가만히 있다 · 첫 말이 2.3초에야」) → 시작을 3.5 → 4.6으로 당기고, 위 큰 글 두 주소를 컷 0.4초부터 띄운다
  { from: 24.85, to: 28.3, src: 'img/V8b.mp4', start: 4.6, crop: F, audio: 1.0, drift: 0.006 },
  // 같은 판을 그대로 잇고 소리만 낮춘다 — 언니 「응?」이 다른 대사보다 6dB 크게 튀어(v3 실측 −9.9) 0.6배(−4.4dB)로. 배율은 앞 토막 끝(1 + 3.45초 × 0.006)에서 이어 받는다
  { from: 28.3, to: 29.45, src: 'img/V8b.mp4', start: 8.05, crop: { s: 1.0207, cx: 540, cy: 960 }, audio: 0.6, drift: 0.006, join: true },
  // 사실 한 장 — AI 답 화면(V2)을 어둡게 깐 위
  { from: 29.45, to: 32.45, src: 'img/V2.mp4', start: 0.2, crop: { s: 1.15, cx: 560, cy: 1000 }, drift: 0.01, look: 'dim' },
  // 결 — 언니(V9) 분홍 휴대폰을 무릎으로 내리며 한숨 「…내 코트」(소리 2.5~3.2 → 33.95~34.65)
  { from: 32.45, to: 35.25, src: 'img/V9.mp4', start: 1.0, crop: F, audio: 1.0, drift: 0.006 },
  // 끝 장치 — 언니의 당부(V10) 「AI가 알려 준 데도」(소리 2.25~3.75 → 35.5~37.0) · 「주문 전엔 이름이랑 주소 한 번 검색해」(4.5~7.55 → 37.75~40.8). 「해」가 끝나는 자리에서 끊는다(뒤 웃음은 뺌 — 이해 시험 sonnet · GPT 「끝이 웃음으로 풀린다」)
  { from: 35.25, to: 40.85, src: 'img/V10.mp4', start: 2.0, crop: F, audio: 1.0, drift: 0.006 },
  // 끝 3.5초 — 핵심 장면(V8b 뒤쪽)을 다시, 두 주소를 제목만 한 크기로. 영상 소리는 깔지 않는다(「응?」이 다시 들리지 않게). 큰 글 · 아래 안내 줄 밑으로 주소 칸이 오도록 더 내린다(low 330)
  { from: 40.85, to: 44.35, src: 'img/V8b.mp4', start: 6.5, crop: F, drift: 0.004, low: 330 },
];

// 큰 글자 = 말. grey = 언니의 말, 흰 = 동생의 말(흠 장부 #29 — 소리를 꺼도 누가 말했는지 갈리게). at = 줄마다 뜨는 초.
// [ ] = 버터 글자(주소의 숫자 0 — 이 편의 버터 한 곳).
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; metaSize?: number; deep?: boolean; instant?: boolean; at?: number[]; butter?: boolean; bi?: number; metaBelow?: boolean }[] = [
  // 올리기 전 검사(11-16 v4) ⑤ 「결제 전에 이것만 보세요」 둘레 어두운 칸 25% · 오른쪽 끝 965px(안전선 920) → 88px로 줄이고 그늘 꼬리(deep)를 붙인다
  { lines: ['AI가 알려 준 "공식몰"', '결제 전에 이것만 보세요'], from: 0.25, to: 2.5, size: 88, instant: true, deep: true },
  { lines: ['그 코트, 어디서 사?'], from: 5.15, to: 6.85, grey: true, size: 96 },
  { lines: ['AI가 알려 준 공식몰', '오늘 밤까지 72%래'], from: 7.65, to: 11.6, size: 96, at: [7.65, 9.75], deep: true },
  { lines: ['…어?', '나도 거기서 샀는데'], from: 13.95, to: 16.6, grey: true, size: 100, at: [13.95, 14.95] },
  { lines: ['2주째 안 와'], from: 16.85, to: 18.35, grey: true, size: 104 },
  { lines: ['…2주째?'], from: 19.05, to: 20.05, size: 104 },
  { lines: ['봐 봐'], from: 22.75, to: 23.25, grey: true, size: 104 },
  // 핵심 장면: 두 주소를 컷 0.4초부터 크게(0만 버터) → 속삭임 줄 → 다시 두 주소
  { lines: ['noer[0]a.com', 'noeroa.com'], from: 25.25, to: 26.65, size: 112, instant: true },
  { lines: ['…한 글자 달라'], from: 26.65, to: 27.6, size: 100, instant: true },
  { lines: ['noer[0]a.com', 'noeroa.com'], from: 27.6, to: 29.4, size: 112, instant: true },
  { lines: ['해외 배송 공식몰을 물으면', 'AI 답의 16%에 위험 사이트'], from: 29.55, to: 32.35, size: 80, meta: '지식재산 보호업체 포드키 조사\n(AI 답 6,795개 · 더 버지 11월 보도)', metaSize: 44, deep: true, at: [29.55, 30.55] },
  { lines: ['…내 코트'], from: 33.9, to: 35.15, grey: true, size: 104 },
  { lines: ['AI가 알려 준 데도', '주문 전엔 이름이랑 주소', '한 번 검색해'], from: 35.5, to: 40.8, grey: true, size: 88, at: [35.5, 37.75, 39.85], deep: true },
  { lines: ['noer[0]a.com', 'noeroa.com'], from: 40.9, to: 44.45, size: 120, meta: '직구 전엔 한국소비자원\n「사기의심사이트 목록」 먼저 검색', metaSize: 50, instant: true, metaBelow: true, deep: true },
];

// 짚기 — 두 주소 칸만 남기고 둘레를 누른다(최종 화면 좌표 · 받은 V8b에서 잰 자리). a = 누르는 짙기
export const SPOTS: { from: number; to: number; x: number; y: number; w: number; h: number; a: number }[] = [
  // V8b 주소 칸(영상 1080×1920 좌표 x 60~1040 · y 510~610) + 내림 210 → 화면 y 712~836
  { from: 25.15, to: 29.45, x: 46, y: 712, w: 994, h: 124, a: 0.62 },
  // 끝 3.5초는 내림 330 → 화면 y 830~945
  { from: 40.85, to: 44.35, x: 46, y: 830, w: 994, h: 118, a: 0.62 },
];

// 배경음(보유곡 시티팝_147을 27초부터) 볼륨 곡선 — 반전에서 1초 안으로만 절반 위로 낮추고(−4.4dB), 사실 한 장과 끝에서 올린다. 마지막 0.6초에 사그라짐
export const BGM = {
  t: [0, 0.6, 13.5, 13.8, 14.6, 15.2, 24.65, 25.05, 29.25, 29.65, 32.25, 32.65, 40.65, 41.05, 43.75, 44.35],
  v: [0.06, 0.1, 0.1, 0.06, 0.06, 0.1, 0.1, 0.08, 0.08, 0.16, 0.16, 0.1, 0.1, 0.22, 0.22, 0],
};

export const VO: { id: string; t: number }[] = [];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [
  // 링크를 누르는 「톡」(V2 자체 소리를 받쳐 준다)
  { t: 3.7, vol: 0.5, src: 'sfx/탭.wav', dur: 12 },
];
