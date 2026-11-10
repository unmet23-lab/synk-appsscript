// B38 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 VtzxG-Ait0I(65초) 박자 × 0.815(53초 · 오마주 「형식만」 — 첫 한 구성 · 근접 번갈이 · 긴 버팀 칸 · 77% 전환 · 98% 끝 반전).
// v2(11-10 첫 렌더 「나란히」 첫 2초 · 박자 39% · 뼈대 자리 어긋남): 컷과 자막 줄을 원본 박자를 옮긴 자리에 맞췄다 — 첫 컷 1.15초 · 반전 자리 40.9초에 끝 줄 컷 · 끝 자리 51.5초에 웃음 당김 ·
//   자막은 줄마다 말하는 때(at)에 뜬다 · 해설 첫 문장은 아버지 얼굴 위로 듣고 29.6초에 광고 의사 얼굴로 넘어간다.
// 컷마다 그 영상에 든 소리(대사 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상 77yuhbs 구독 몫 · V5는 Flow Omni 1.2 Flash).
// 대사 초는 받은 영상의 소리 크기 곡선 + 받아쓰기(허깅페이스 whisper)로 잰 값. V2 4.40~5.15초의 지어낸 아들 목소리 「어떤 선생님이요?」는 쓰지 않는다.
// 광고 속 의사의 말(A1 · A3)은 그 광고 동영상의 소리를 폰 스피커 결로 깐다(public/img/*_phone.wav). V6에 든 폰 소리(「지금 바로 주문하세요」)는 쓰지 않는다.
export type Crop = { s: number; cx: number; cy: number; ay?: number };
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; ad?: boolean; chrome?: boolean; shade?: number };

export const S = {
  search: 23.7, searchResult: 24.7, searchEnd: 26.0,
  flip: 49.75, end: 49.85,
};
export const TOTAL_S = 53.0;
// 원본(제미나이 앱 · Flow Omni)이 모두 24fps라 편집도 24fps로 굽는다 — 30fps 시간선에 넣으면 5프레임마다 한 장이 겹쳐 떨린다(현장 노트 영상 · 24fps 원본).
export const FPS = 24;

// (FULL 판은 v6에서 모두 잘라 쓰기로 바뀌어 쓰지 않는다)
export const CUTS: CutT[] = [
  // 기 — 광고 속 의사 → 넓게(식탁의 아버지 · 상자 일곱 · 뒤의 아들) → 아들 가까이(뒷목) → 아버지 근접 「선생님이 드시래」 → 상자
  // v6(11-10 미학 맹검 01 기각 「청진기 줄이 ∩ 고리로 뭉개짐」): 얼굴 · 상자까지만 당겨 가슴 아래 청진기를 뺀다
  { from: 0, to: 1.15, src: 'img/A1.mp4', start: 1.2, crop: { s: 1.9, cx: 390, cy: 790, ay: 990 }, ad: true },
  { from: 1.15, to: 4.45, src: 'img/V1.mp4', start: 0.1, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 0.5, drift: 0.015 },
  { from: 4.45, to: 7.0, src: 'img/V1.mp4', start: 4.15, crop: { s: 1.8, cx: 860, cy: 640 }, audio: 0.5 },
  { from: 7.0, to: 8.2, src: 'img/V2.mp4', start: 1.9, crop: { s: 1.05, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 8.2, to: 9.3, src: 'img/V2.mp4', start: 3.1, crop: { s: 1.35, cx: 560, cy: 900 }, audio: 1.0 },
  { from: 9.3, to: 10.5, src: 'img/V2.mp4', start: 4.2, crop: { s: 2.4, cx: 560, cy: 1750, ay: 1350 } },
  // 승 — 「이거 몇 개째예요?」 → 「유명한 선생님이야」 → 「이 선생님, 어느 병원이에요?」 → 「…어디더라」
  { from: 10.5, to: 12.05, src: 'img/V3.mp4', start: 1.6, crop: { s: 1.1, cx: 600, cy: 1000 }, audio: 1.0 },
  { from: 12.05, to: 13.0, src: 'img/V3.mp4', start: 3.15, crop: { s: 1.4, cx: 640, cy: 950 }, audio: 1.0 },
  { from: 13.0, to: 15.1, src: 'img/V2.mp4', start: 5.25, crop: { s: 1.3, cx: 560, cy: 900 }, audio: 1.0 },
  { from: 15.1, to: 16.9, src: 'img/V3.mp4', start: 6.1, crop: { s: 1.45, cx: 640, cy: 900 }, audio: 1.0 },
  { from: 16.9, to: 18.6, src: 'img/V3.mp4', start: 7.9, crop: { s: 1.6, cx: 640, cy: 820, ay: 1000 }, audio: 1.0 },
  { from: 18.6, to: 22.5, src: 'img/V4.mp4', start: 1.6, crop: { s: 1.05, cx: 540, cy: 980 }, audio: 1.0 },
  // 전 — 찾아봄 → 재연용 검색 화면 「일치하는 결과가 없습니다」 → 「이 얼굴, 아무 데도 없는데요」 → 아버지 얼굴 위 해설 → 광고 속 그 얼굴 → 폰을 내려놓음(느리게) → 상자
  { from: 22.5, to: 23.7, src: 'img/V4.mp4', start: 4.6, crop: { s: 1.7, cx: 760, cy: 1200 }, audio: 0.8 },
  { from: 26.0, to: 28.2, src: 'img/V4.mp4', start: 5.8, crop: { s: 1.05, cx: 540, cy: 980 }, audio: 1.0 },
  { from: 28.2, to: 29.6, src: 'img/V4.mp4', start: 8.0, crop: { s: 1.5, cx: 380, cy: 960 }, rate: 0.6 },
  // v7(11-10 맹검 GPT 05 기각 「웃은 채 굳음 · 광고 표시가 입 · 볼에 걸림」): 말하며 끄덕이는 구간(3.0~6.1초)을 소리 없이, 얼굴 당김 칸엔 광고 표시를 얹지 않는다
  { from: 29.6, to: 32.7, src: 'img/A1.mp4', start: 3.0, crop: { s: 1.5, cx: 610, cy: 760, ay: 1080 }, drift: 0.02, ad: true, chrome: false }, // v9(아르곤 05 [C083] 「정중앙 대칭 · 귀가 잘림」): 덜 당기고 얼굴을 조금 왼쪽에
  { from: 32.7, to: 35.05, src: 'img/V4.mp4', start: 8.85, crop: { s: 1.35, cx: 380, cy: 1000 }, rate: 0.5 },
  { from: 35.05, to: 37.3, src: 'img/V1.mp4', start: 7.6, crop: { s: 1.8, cx: 520, cy: 1480, ay: 1150 }, audio: 0.3, drift: 0.01 },
  // 결 — 머쓱한 웃음 → 끝 줄(V5 · Flow, 반전 자리 40.9초에 아들 가까이) → 폰이 저절로 켜짐 → 같은 얼굴 · 약사 → 마주 봄 → 엎음 → 웃음 → 웃음 당김(끝 자리)
  { from: 37.3, to: 40.9, src: 'img/V5.mp4', start: 0.0, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0 },
  { from: 40.9, to: 42.4, src: 'img/V5.mp4', start: 3.6, crop: { s: 1.4, cx: 860, cy: 900 }, audio: 1.0 },
  { from: 42.4, to: 43.5, src: 'img/V5.mp4', start: 5.1, crop: { s: 1.75, cx: 880, cy: 860 }, audio: 1.0 },
  { from: 43.5, to: 44.9, src: 'img/V5.mp4', start: 6.2, crop: { s: 1.6, cx: 300, cy: 900 }, audio: 1.0 },
  { from: 44.9, to: 45.8, src: 'img/V6.mp4', start: 0.15, crop: { s: 1.0, cx: 540, cy: 1000 } },
  // 이해 시험(넷 중 넷): 약사 광고를 못 보거나 같은 얼굴을 늦게 알아챔 → 2.3초로 늘리고 첫 광고 얼굴(c13)과 같은 크기로 당긴다
  // v7(맹검 GPT 06 「상자가 오른쪽에서 잘림」): 덜 당기고 상자 쪽으로
  // v9(아르곤 06 기각 「엄지 없이 네 손끝으로 붙은 상자 · 몸이 굳은 립싱크」 · GPT 06 「상자가 목업 같음」): 손 · 상자를 빼고 얼굴과 약사 가운만, 밝은 칸이라 위 그늘은 옅게
  { from: 45.8, to: 48.1, src: 'img/A3.mp4', start: 1.7, crop: { s: 1.5, cx: 405, cy: 760, ay: 1000 }, drift: 0.025, ad: true, shade: 0.6 },
  { from: 48.1, to: 49.0, src: 'img/V6.mp4', start: 3.7, crop: { s: 1.35, cx: 540, cy: 900 } },
  { from: 49.0, to: 49.85, src: 'img/V6.mp4', start: 5.45, crop: { s: 1.0, cx: 540, cy: 1000 }, audio: 1.0 },
  // v7: 두 얼굴이 원본 가장자리(x 195 · 960)에 있어 둘을 함께 당기면 잘린다 → 웃는 아버지 가까이 → 끝은 넓게 두 사람과 상자 탑
  { from: 49.85, to: 51.5, src: 'img/V6.mp4', start: 6.3, crop: { s: 1.3, cx: 420, cy: 900 }, audio: 1.0 }, // v9(아르곤 07 [K32] 「허공의 손이 다음 컷에 이미 어깨 위」): 아들 어깨까지 들게 해 손이 가는 길을 보인다
  // v7(맹검 GPT 07 「웃는 두 얼굴이 가장자리에서 잘림」): 두 얼굴이 다 들게
  { from: 51.5, to: 53.0, src: 'img/V6.mp4', start: 7.95, crop: { s: 1.0, cx: 540, cy: 960 }, audio: 1.0, drift: 0.01 },
];

// 큰 글자 = 말. grey = 아들(두 사람 말은 흰 · 회색으로만 가른다). 광고 속 말은 위 작은 「광고 속 의사」 · 「다음 광고」. at = 줄마다 뜨는 초(말하는 때).
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; instant?: boolean; at?: number[]; lead?: boolean }[] = [
  // v8(맹검 GPT 03 · 05 · 06 [C002] 「큰 제목처럼 머리 위까지」): 큰 글자를 0.85배로 — 그늘 위 큰 글자(화면 결)는 지키되 얼굴보다 먼저 보이지 않게
  { lines: ['하루 두 알이면,', '몸이 거꾸로 젊어집니다'], from: 0, to: 3.3, size: 75, instant: true, at: [0, 1.6] },
  { lines: ['저도 매일', '두 알씩 먹습니다'], from: 4.45, to: 6.5, size: 82, meta: '광고 속 의사', at: [4.45, 5.3] },
  { lines: ['선생님이 드시래', '하루 두 알'], from: 7.0, to: 9.25, size: 85, at: [7.0, 8.2] },
  { lines: ['아버지,', '이거 몇 개째예요?'], from: 11.2, to: 12.95, grey: true, size: 85, at: [11.2, 11.75] },
  { lines: ['유명한 선생님이야'], from: 13.15, to: 14.55, size: 85 },
  { lines: ['이 선생님,', '어느 병원이에요?'], from: 16.5, to: 18.5, grey: true, size: 95, at: [16.5, 17.1] },
  { lines: ['…어디더라', '유튜브에 맨날 나오시는 분인데'], from: 19.05, to: 21.7, size: 71, at: [19.05, 19.9] },
  { lines: ['…이 얼굴,', '아무 데도 없는데요'], from: 26.05, to: 28.1, grey: true, size: 85, at: [26.05, 26.9] },
  { lines: ['그 의사, 사람이 아니었어요', 'AI로 만든 가상 인물이었어요'], from: 28.3, to: 32.3, size: 72, at: [28.3, 30.2], lead: true }, // v8(맹검 05 「폭로 두 줄이 같은 무게」): 앞줄을 낮추고 뒷줄이 핵심
  { lines: ['아버지만 산 게 아니었어요'], from: 32.45, to: 33.85, size: 71 },
  { lines: ['아홉 달 동안 65만 개,', '81억 원어치가 팔렸어요'], from: 33.95, to: 37.25, size: 75, meta: '실제 사건 · 식약처 2026년 6월 발표', at: [33.95, 35.75] },
  { lines: ['허허…', '비싼 거 아니야'], from: 37.45, to: 39.45, size: 85, at: [37.45, 38.3] },
  { lines: ['저도 몰랐는데,', '의사가 권하는 영양제 광고는', '원래 안 되는 거래요'], from: 40.05, to: 44.6, grey: true, size: 68, meta: '식품표시광고법', at: [40.05, 41.4, 42.6] },
  { lines: ['안녕하세요,', '삼십 년 차 약사입니다'], from: 45.1, to: 47.85, size: 82, at: [45.1, 46.05] }, // v7: 「다음 광고」 고지 뺌(맹검 GPT 06 「고지가 셋 쌓여 위계가 둔함」 — 광고 표시 · 가상 인물 표기가 이미 말함)
];

export const VO: { id: string; t: number }[] = [
  { id: 'n1', t: 28.3 }, { id: 'n2', t: 32.45 }, { id: 'n3', t: 33.95 },
];

// 이해 시험(셋): 가운데가 늘어짐 → 상자를 토닥이는 손 · 폰을 누르는 손 · 검색 결과에 작은 소리를 깐다
export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [
  { t: 9.45, src: 'sfx/tok.wav', vol: 0.14 }, { t: 9.95, src: 'sfx/tok.wav', vol: 0.12 },
  { t: 22.75, src: 'sfx/tok.wav', vol: 0.12 }, { t: 23.1, src: 'sfx/tok.wav', vol: 0.12 },
  { t: 24.7, src: 'sfx/thud.wav', vol: 0.18 },
];

// 광고 소리(폰 스피커 결): A1은 0초부터 c03 끝까지(말은 0.15 · 1.6 · 4.3초), 해설 칸의 A1 얼굴은 소리 없음.
// A3(같은 얼굴 · 약사)는 폰이 켜지는 c18부터 아버지가 폰을 엎는 순간까지 — 「안녕하세요」(45.1초)가 광고 그림(46.4초)보다 먼저 온다.
export const AD_AUDIO: { src: string; from: number; to: number; start: number; vol: number }[] = [
  { src: 'img/A1.mp4', from: 0, to: 6.6, start: 1.2, vol: 0.9 },
  { src: 'img/A3.mp4', from: 44.9, to: 49.75, start: 0.8, vol: 0.85 },
];
