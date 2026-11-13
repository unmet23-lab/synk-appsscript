// B39 「없는 판결」 시간표 — 컷 · 말 · 소리 한 곳(초). 뼈대는 jxtY4RzpaTc(71.5초) 박자 × 0.797(57초 · 오마주 「형식만」 —
// 여는 넓은 한 컷 · 근접 번갈이 · 33% 자리의 넓어짐 · 긴 버팀 · 78%의 반전(의뢰인이 봄) · 97%의 끝 한 방).
// **첫 설계 판 v0.2(11-11 07시 회차 — 동영상을 받기 전 · Fable 검수 반영)**: src의 start · crop · 대사 초는 받은 영상의 소리 크기 곡선 + 받아쓰기로 다시 잰다.
// v0.2: 판사의 지어낸 끝 줄을 빼고 해설로 · 가운데 16초를 줄임(「변호사님…?」 3초 · 기다림 2.6초 · 손 3.4초 · 버팀은 침묵 한 판만) · 끝을 바닥 접사 → 두 사람 두 컷으로(해설 뒤 음악을 끊고).
// 컷마다 그 영상에 든 소리(대사 · 방 소리)를 그대로 깐다(audio). 동영상은 public/img/*.mp4(git 밖 — 제미나이 앱 동영상 · 막히면 Flow Omni).
export type Crop = { s: number; cx: number; cy: number; ay?: number; push?: { t0: number; t1: number; to: number } }; // push = 컷 안 t0~t1초에 배율을 to배까지 천천히 키운다(다가감)
export type CutT = { from: number; to: number; src: string; start: number; crop: Crop; rate?: number; drift?: number; audio?: number; tail?: number; shade?: number; low?: number; a?: { src: string; start: number; vol?: number } };

export const S = { hook: 5.0, hold: 33.8, confess: 36.5, look: 41.0, quiet: 52.6, end: 53.9 };
export const TOTAL_S = 60.5;
// 원본(제미나이 앱 동영상)이 24fps라 편집도 24fps로 굽는다 — 30fps 시간선에 넣으면 5프레임마다 한 장이 겹쳐 떨린다(현장 노트 영상 · 24fps 원본).
export const FPS = 24;

// v8(11-11 밤 — 맹검 기각 둘 · 최종 확인 지적): 굳은 두 사람 판(VC)을 빼고, 올려다보는 컷은 불어나는 마이크가 안 보이게 당기고, 끝은 찌그러지는 의자 접사(VF2) 대신 변호인의 곁눈 → 두 사람. v3(11-11 15시 회차): 컷 자리를 원본 박자 × 0.835에 맞췄다(나란히 v2 — 박자 35% · 반전 · 끝 자리 어긋남). 말은 듣는 사람 위에도 깐다(a = 그 컷 밑에 까는 다른 영상의 소리).
const F: Crop = { s: 1.0, cx: 540, cy: 960 };
const JF: Crop = { s: 1.15, cx: 600, cy: 1080 }; // 판사 판: 얼굴을 화면 가운데로 올린다(맹검 — 얼굴이 아래로 몰림)
export const CUTS: CutT[] = [
  // 기
  { from: 0, to: 0.5, src: 'img/VW2.mp4', start: 0.0, crop: F, drift: 0 },
  // v15(11-13 · 카본 v14 01 「손이 안 닿은 종이가 저절로 넘어감 · 소매가 다른 두 손」): 서류 인서트를 빼고 판사 판 VJ1을 1.1초부터 잇는다 — 1.3초에 같은 판을 당겨(JF) 박자는 지킨다
  // v17(11-13 컷 연속성 검사가 옛 틀에서도 「같은 판 잇달아 자르기(50)」를 보게 된 뒤 걸림): 1.3초에 같은 판을 같은 시간 그대로 1.0 → 1.15배로 끊어 당기던 배율 점프를
  // 한 컷으로 합쳐 0.8~1.7초에 판사 얼굴로 천천히 다가가게(점프 없음 · 박자는 「변호인.」 → 「의견서에 쓰신 판결들,」 그대로)
  { from: 0.5, to: 2.9, src: 'img/VJ1.mp4', start: 1.1, crop: { s: 1.0, cx: 600, cy: 1080, push: { t0: 0.3, t1: 1.2, to: 1.15 } }, audio: 1.0, drift: 0 },
  { from: 2.9, to: 4.4, src: 'img/VW2.mp4', start: 0.5, crop: F, drift: 0.015, a: { src: 'img/VJ1.mp4', start: 3.5 } },
  // v17(11-13 20시 최종 확인 「4.4~5.5초 「네?」 투샷(VL1 0~1.1초)이 사람 0.088로 굳음(26) — v10부터 남음」): 같은 투샷 그림에서 다시 낸 넷 가운데 VL1e(고개를 홱 들고 「네?」 · 갸웃 · 서류철로 손을 뻗음 · 의뢰인이 돌아봄 — 0~1.1초 사람 0.537, VL1b는 트래픽 거절 · VL1c 0.107 · VL1d 거절), 소리는 VL1 그대로(「네?」 입 모양 0.40~0.55초 = VL1 소리 0.45~0.6초)
  { from: 4.4, to: 5.5, src: 'img/VL1e.mp4', start: 0.0, crop: F, a: { src: 'img/VL1.mp4', start: 0.0 } },
  { from: 5.5, to: 7.4, src: 'img/VH.mp4', start: 6.3, crop: F, drift: 0, a: { src: 'img/VL1.mp4', start: 1.1 } },
  { from: 7.4, to: 9.7, src: 'img/VL1.mp4', start: 3.0, crop: F, audio: 1.0 },
  // 승
  { from: 9.7, to: 11.0, src: 'img/VJ1.mp4', start: 5.8, crop: JF, audio: 0.8 },
  { from: 11.0, to: 12.3, src: 'img/VL3.mp4', start: 0.3, crop: F, drift: 0, a: { src: 'img/VJ1.mp4', start: 7.1 } },
  { from: 12.3, to: 14.0, src: 'img/VJ1.mp4', start: 8.4, crop: { s: 1.3, cx: 640, cy: 900 }, audio: 1.0, drift: 0 },
  { from: 14.0, to: 15.9, src: 'img/VH.mp4', start: 0.2, crop: F, audio: 0.8 },
  // v16(11-13 컷 전수 — 「…있는데요」 말꼬리가 18.4초 컷에서 20ms 만에 19dB 떨어짐): 이 컷 소리만 0.125초 더 흘려 줄인다(tail)
  { from: 15.9, to: 18.4, src: 'img/VL1.mp4', start: 7.2, crop: F, audio: 1.0, tail: 0.125 },
  { from: 18.4, to: 21.4, src: 'img/VW2.mp4', start: 2.0, crop: F, audio: 0.4, drift: 0.015 },
  { from: 21.4, to: 23.4, src: 'img/VL3.mp4', start: 4.6, crop: F, drift: 0 },
  // 전
  { from: 23.4, to: 25.8, src: 'img/VJ2.mp4', start: 0.6, crop: JF, audio: 1.0 },
  { from: 25.8, to: 27.2, src: 'img/VL2.mp4', start: 0.0, crop: F, a: { src: 'img/VJ2.mp4', start: 3.0 } },
  { from: 27.2, to: 29.6, src: 'img/VJ2.mp4', start: 4.4, crop: JF, audio: 1.0 },
  { from: 29.6, to: 31.9, src: 'img/VL2.mp4', start: 1.4, crop: F, audio: 0.8 },
  { from: 31.9, to: 34.0, src: 'img/VCa.mp4', start: 0.9, crop: F, audio: 1.0 },
  { from: 34.0, to: 35.5, src: 'img/VW2.mp4', start: 5.0, crop: F, audio: 0.4, drift: 0.015 },
  { from: 35.5, to: 39.2, src: 'img/VL2.mp4', start: 3.4, crop: F, audio: 1.0 },
  // v17(11-13 20시 최종 확인 · 고치면 좋은 것 「「찾아 줬습니다」가 판사 얼굴 위로 넘어가 의뢰인이 돌아보는 시간이 1초뿐」): 판사의 눈은 기획대로 0.8초, 의뢰인은 40.0초부터
  { from: 39.2, to: 40.0, src: 'img/VJ2.mp4', start: 6.8, crop: JF, a: { src: 'img/VL2.mp4', start: 7.1 } },
  // 의뢰인 컷 앞 1초는 고백 말꼬리(VL2 7.9~8.9초)를 그대로 깔고, 41.0초부터 그 판의 소리 — 그림은 한 판을 끊김 없이(같은 자르기 · 이어진 초)
  { from: 40.0, to: 41.0, src: 'img/VCa.mp4', start: 4.2, crop: { s: 1.5, cx: 740, cy: 900 }, drift: 0, a: { src: 'img/VL2.mp4', start: 7.9 } },
  // v15(11-13 · 카본 v14 03 「43.25초 벽 장식이 허공에서 생김 · 의뢰인이 오른쪽 아래로 몰려 가운데가 빈 벽」): VCa는 카메라가 다가가며 6.7초에 오른쪽 끝에
  // 장식이 들어온다 — 6.5초에서 끊고 의뢰인을 가운데로(cx 700 · cy 900). 뒤는 VCa 6.6초 장면에서 다시 낸 VC2(벽 장식 없음 · 카메라 고정)의 5.8~8.1초(시선을 떨굼 · 사람 0.133)를 더 당겨서
  // v16(컷 전수 — 42.17초부터 왼쪽 끝에 장식 가장자리가 들어옴): 두 장 앞(42.2초)에서 끊고 VC2를 0.1초 앞에서
  { from: 41.0, to: 42.2, src: 'img/VCa.mp4', start: 5.2, crop: { s: 1.5, cx: 740, cy: 900 }, audio: 0.6, drift: 0 },
  // v18(11-13 밤 · 맥락 없는 Fable 5.2 컷 전수 「42.2초 VCa → VC2 같은 구도 점프 — 고개 방향 · 표정 · 눈물이 한 장에 튐」): 사이에 변호인을 끼워
  // 올려다봄 → 눈을 감는 변호인 → 우는 의뢰인(되받는 컷 · 시간이 흐름). VC2는 1.7배가 무르다는 지적이라 1.55배
  // 내림(low) 없이 — 극접사라 위 210px를 채우는 흐린 거울에 머리카락이 비쳐 검은 덩어리로 보였다
  { from: 42.2, to: 43.8, src: 'img/VL2.mp4', start: 7.9, crop: { s: 1.25, cx: 540, cy: 800 }, audio: 0.3, drift: 0, low: 0 },
  { from: 43.8, to: 46.9, src: 'img/VC2.mp4', start: 5.7, crop: { s: 1.55, cx: 720, cy: 880 }, audio: 0.6, drift: 0 },
  // 결 — v18(같은 전수 「50.2초 판사 입이 해설에 맞춰 움직임 · 52.5초 넓은 판 앞줄 방청객이 의뢰인처럼 보여 의뢰인이 둘 · 끝 5초 무음 · 끝이 가장 약함 · 마지막 장이 고개 숙이는 도중」):
  // 해설 밑은 말하지 않는 판만 — 서류를 급히 넘기는 변호인(VL3 2.0~4.6초 · 사람 0.93) → 눈을 내리깐 판사(VJ2 7.6~10초, 39.2초 컷의 바로 뒤 초 · 입은 다문 채).
  // 최종본 검사(⑳)가 처음 짠 순서(판사 → 서류를 내려다보는 변호인 VL3 6.6~10초)에서 VL3 굳음 0.106과 VL3 → 두 사람 판의 같은 축 · 같은 자세 점프(배율 0.68)를 잡아 바꿨다
  { from: 46.9, to: 49.5, src: 'img/VL3.mp4', start: 2.0, crop: F, audio: 0.4, drift: 0 },
  { from: 49.5, to: 51.9, src: 'img/VJ2.mp4', start: 7.6, crop: JF, audio: 0.5 },
  // 끝 한 방은 둘째 해설 밑에서 시작: 51.6초 의뢰인이 변호인을 돌아보고 52.55초 몸을 들어 의자째 한 뼘(음악은 52.6초에 끊김 · 53.5초 의자 끄는 소리) → 팔짱(이 밑에 마지막 해설 한 줄,
  // 글은 끝까지 남음) → 56.5~58.5초 변호인의 곁눈 → 58.9초 한숨에서 끝(고개 숙이기 전). 다가감은 아래쪽(두 얼굴)으로 — 위는 마지막 글 자리
  // v18 다시 검수(「51.2~52.1초 끝 판 첫머리에서 변호인이 옅게 웃음 · 마지막 장이 고개 숙이는 도중 · 글이 흐려지며 끝남」): 우는 의뢰인을 0.7초 늘려 끝 판을
  // 변호인이 눈을 내리깐 0.9초부터(사건 초는 그대로). 끝은 처음 59.15초(한숨 직후)로 잘랐더니 최종본 검사(⑳)가 굳음 0.103(사람 자리를 변호인 얼굴로 잡아
  // 의뢰인이 옮겨 앉는 움직임이 거의 안 셈)과 끝 2.75초 방 소리뿐을 잡았다 — 고개를 끝까지 숙여 멈춘 60.5초까지 둔다(사람 0.205 · 마지막 장은 숙인 채 0.3초 멈춤).
  // 마지막 글은 끝까지 켜 두고, 소리는 끝 0.3초 줄인다(마감.sh)
  { from: 51.9, to: 60.5, src: 'img/VE4a.mp4', start: 0.9, crop: { s: 1.0, cx: 540, cy: 1150, push: { t0: 0.7, t1: 8.6, to: 1.14 } }, audio: 1.0, drift: 0 },
];

// 큰 글자 = 말. grey = 변호인 · 의뢰인(판사와 해설은 흰). at = 줄마다 뜨는 초(말하는 때).
// v14(11-12 15시 회차 · GPT 대체 맹검 04 기각): 해설 세 줄 사이 0.1초 틈에 글 없이 위 그늘만 남던 자리를 없앤다 — 앞 줄 끝 = 다음 줄 시작(교차해 바뀜).
export const LINES: { lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; instant?: boolean; at?: number[]; lead?: boolean }[] = [
  { lines: ['변호인'], from: 0.6, to: 1.3, size: 85, instant: true },
  { lines: ['의견서에 쓰신 판결들,', '어디서 찾으셨습니까?'], from: 1.6, to: 4.35, size: 80, at: [1.6, 3.1] },
  { lines: ['네?', '제가 정리한 판결들입니다만'], from: 4.8, to: 7.35, grey: true, size: 76, at: [4.8, 5.8] },
  { lines: ['우리 변호사님이', '다 찾아오셨어요'], from: 7.6, to: 9.65, grey: true, size: 82 },
  { lines: ['제가 다 찾아봤습니다', '다섯 개가, 하나도 없어요'], from: 11.1, to: 13.95, size: 80, at: [11.1, 12.4] },
  { lines: ['그럴 리가요…', '사건번호까지 다 있는데요'], from: 16.0, to: 18.35, grey: true, size: 78, at: [16.0, 17.1] },
  { lines: ['없는 판결 다섯 개가 법정에 나온 건,', '우리나라에서 실제로 있었던 일이에요'], from: 18.5, to: 22.6, size: 56, meta: '법률신문 2025년 9월 보도', at: [18.5, 20.4] },
  { lines: ['그 번호가,', '없는 번호입니다'], from: 23.7, to: 27.15, size: 80, at: [23.7, 25.8] },
  { lines: ['출처가 어딥니까?'], from: 27.7, to: 29.5, size: 85 },
  { lines: ['변호사님…?'], from: 32.6, to: 33.9, grey: true, size: 85 },
  // v17(11-13 최종 확인 「고백 대사가 실제로 들리는지」 — 받아쓰기(faster-whisper small): 「AI가,」 ~36.98 · 「AI가」 37.18~38.28 · 「찾아줬습니다」 38.28~39.74초): 말을 더듬어 「AI가」를 두 번 한다 — 자막도 말 그대로
  { lines: ['…AI가,', 'AI가 찾아 줬습니다'], from: 36.5, to: 40.9, grey: true, size: 90, at: [36.5, 37.7] },
  { lines: ['설문에 답한 판사 셋 중 둘이,', '가짜 판례가 적힌 서류를 받아 봤대요'], from: 46.3, to: 50.2, size: 57, meta: '법원행정처 설문 · 법관 360명 응답 · 2026년 11월', at: [46.3, 47.8] },
  // v15(카본 v14 04 「출처 줄이 빠지며 큰 글이 위로 튐」): 앞 줄과 같은 높이의 빈 출처 자리를 둔다
  { lines: ['AI는 없는 판결에도', '번호까지 붙여 줘요'], from: 50.2, to: 52.9, size: 82, meta: '\u00A0', at: [50.2, 51.1] },
  { lines: ['근거를 대면,', '그 번호부터 직접 찾아보세요'], from: 53.9, to: 61.5, size: 76, meta: '판결은 대법원 사법정보공개포털 「허위 사건번호 확인」', at: [53.9, 54.75] },
];

// v18: n3는 두 줄 사이 빈자리(2.54~2.80초)에서 나눠, 둘째 줄 「근거를 대면,」을 의자 소리 뒤 53.9초에 둔다(s = 파일 안 시작 초 · d = 길이)
export const VO: { id: string; t: number; s?: number; d?: number }[] = [
  { id: 'n1', t: 18.5 }, { id: 'n2', t: 46.3 }, { id: 'n3', t: 50.2, d: 2.62 }, { id: 'n3', t: 53.76, s: 2.62 },
];

export const SOUNDS: { t: number; vol: number; src: string; dur?: number }[] = [];
