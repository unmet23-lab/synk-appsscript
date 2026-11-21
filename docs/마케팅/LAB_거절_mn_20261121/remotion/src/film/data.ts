// LAB 몽골 M68 「거절할 때 네 마디」 장면 정본(11-21) — 그림 · 한국어(말의 한글 · 목소리) · 소리 · 박자. 판본마다 같다.
// 원본: Dana Kim 「한국에선 '감사합니다'라고 안 해요」(https://www.youtube.com/shorts/303uDpWBcg4 · 18.2초) — 「한국에선 이렇게 말 안 해요 ✗✗」 머리 칸 →
// 교과서 말(감사합니다)에 ✗ → 진짜 쓰는 말 둘(아니에요 · 안 주셔도 되는데!) → 끝에 반전(그 말을 하며 선물을 들고 달아남).
// 우리는 그 뼈대(머리 칸 → 틀린 말 ✗ → 진짜 쓰는 말 → 반전 끝)를 원본 길이의 111%로 옮긴다.
// 이야기: 회사 회식(호프집). 부장님이 소주잔을 내밀자 신입 몽글이 「싫어요!」 — 자리가 꽁꽁 언다(✗ 윗사람에게는 안 된다).
// 몽글이 네 마디로 다시 거절할 때마다 얼음이 녹는다(괜찮아요 · 다음에요 · 좀 생각해 볼게요 · 마음만 받을게요).
// 끝: 선배가 마이크를 들고 「노래방 가자!」 → 몽글 「다음에요~」 → 이번엔 선배만 꽁꽁 언다(공손해도 「다음에요」는 거절이다 — 끝 줄).
// 그 나라 글(머리 글 · 읽는 법 · 뜻 · ✗ 알약 · 끝 줄)은 판본 글 하나(./판본/<KEY>.json — ./판본.ts)가 원천이다.
// 소리는 소진(몽글) · 범수(선배) · 효과음은 직접 합성(../../../소리/만들기.py) · 음악은 보유곡 01_Joyful-Happy-Upbeat 0~21초.
export const FPS = 30;
export const TOTAL = 23.3; // 원본 18.2초의 128% — 이해 시험 v1 셋(s · G · opus)이 칸마다 무엇을 권하는지 모르겠다고 짚어 권하는 말 한 줄씩을 넣었다(오마주.json 「다르게」)

// 칸 — 원본 박자(0.9 · 1.8 · 3.3 · 3.9 · 4.4 · 5.2 · 11.8 · 13.2 · 13.9 · 16.2초) 둘레
export const PUSH_AT = 0.9; // 부장님이 잔을 더 내민다(원본 0.9 「we don't say」)
export const NO_AT = 1.55; // 몽글 「싫어요!」 말풍선(원본 1.8 교과서 말)
export const FREEZE_AT = 2.3; // 꽁꽁 — 얼음이 몽글에서 0.9초 동안 번진다(첫 컷 다른 눈 v1: 0.38초는 0.25초 칸에 번지는 과정이 안 보임)
export const WIPE = 1.2; // 첫 컷 다른 눈 v3: 0.9초도 0.25초 칸에 「번지는 단계」가 안 보임 → 1.2초 · 고르게
export const FACE_AT = 3.3; // 언 부장님 얼굴로 다가간다(원본 3.3)
export const NG_AT = 3.6; // ✗ 도장 · 「윗사람에게는 안 돼요」 알약(원본 3.3~4.4 ✗ — 알약을 1.5초 넘게 두려고 앞으로, 첫 컷 다른 눈 v1 P02)
export const CRINGE_AT = 4.05; // 몽글 가까이 — 움찔 작아지며 눈을 질끈(첫 컷 다른 눈 v2: ✗ 뒤 몽글의 반응이 0.25초 칸에 안 보임 → 감정 자리는 가까운 컷으로)
export const CRINGE2_AT = 4.65; // 몽글이 의자 속으로 더 파묻힌다(첫 컷 다른 눈 v3: 가까운 컷 안 움찔이 0.25초 칸에 안 보임 → 자세가 다른 둘째 컷)
export const FINE_AT = 5.2; // ① 괜찮아요(원본 5.2 진짜 쓰는 말)
export const NEXT_AT = 7.6; // ② 선배 「주말에 등산 가자!」 → 다음에요
export const THINK_AT = 10.6; // ③ 동료 「소개팅 할래?」 → 좀 생각해 볼게요
export const ENV_AT = 14.0; // ④ 부장님 「택시비 해!」 → 마음만 받을게요(원본 13.2~13.9 빠른 칸 둘레)
export const MIC_AT = 16.9; // 선배 마이크 「노래방 가자!」(원본 16.2 반전 끝 둘레)
export const NAE_AT = 18.3; // 몽글 「다음에요~」
export const TTO_AT = 19.2; // 선배 「또 다음에?!」 — 등산에 이어 두 번째 「다음에요」(이해 시험 v1 둘(s · G): 공손히 말했는데 왜 또 어는지 모름 → 두 번째는 거절이라는 걸 선배가 말한다)
export const FREEZE2_AT = 20.3; // 이번엔 선배만 꽁꽁
export const END_AT = 20.7; // 끝 줄

export type Who = 'm' | 's' | 'b' | 'd'; // 몽글 · 선배 · 부장님 · 동료
export type Line = {
  k: number; // 판본 글 reads · means의 차례
  ko: string;
  who: Who;
  at: number; // 말풍선이 뜨는 초
  until: number; // 사라지는 초
  vo: string; // 목소리 파일(public/vo/<id>.wav)
  voAt: number;
  koSize: number;
  offer?: boolean; // 권하는 말(도장 없음 · 읽는 법 작게)
  nodAt?: number; // 몽글이 거절한 뒤 권한 사람이 끄덕이는 초(볼 이유 opus v1 — 거절을 들은 상대의 반응)
  mark?: 'ok' | 'ng'; // 맞는 말(✓ 초록) · 틀린 말(✗ 빨강)
  markAt?: number;
  box: { left: number; top: number; width: number }; // 말풍선 자리(화면 좌표)
  h?: number; // 말풍선 높이(기본 290)
  boxBy?: Record<string, { left: number; top: number; width: number }>; // 칸(그림)마다 다른 자리
};

const TOP = { left: 110, top: 290, width: 800 };
const LOW = { left: 110, top: 1140, width: 540 }; // 아래 끝이 1428px(인스타 · 틱톡 캡션 자리) 위에 오게 — 올리기 전 검사가 0.5초 「한 잔 받아!」 읽는 법이 1558px까지 내려간다고 짚음(1330 → 1140)
export const LINES: Line[] = [
  { k: 7, ko: '한 잔 받아!', who: 'b', at: 0.3, until: NO_AT, vo: 'b1', voAt: 0.35, koSize: 84, offer: true, box: LOW, h: 250 },
  { k: 0, ko: '싫어요!', who: 'm', at: NO_AT, until: FINE_AT, vo: 'm0', voAt: NO_AT + 0.05, koSize: 108, mark: 'ng', markAt: NG_AT, box: LOW, h: 280, boxBy: { 'cringe.jpg': { left: 110, top: 470, width: 540 }, 'cringe2.jpg': { left: 110, top: 470, width: 540 } } },
  { k: 1, ko: '괜찮아요', who: 'm', at: FINE_AT, until: NEXT_AT, vo: 'm1', voAt: FINE_AT + 0.15, koSize: 104, mark: 'ok', nodAt: FINE_AT + 1.3, box: TOP },
  { k: 8, ko: '주말에 등산 가자!', who: 's', at: NEXT_AT + 0.05, until: NEXT_AT + 1.4, vo: 's0', voAt: NEXT_AT + 0.1, koSize: 78, offer: true, box: TOP, h: 250 },
  { k: 2, ko: '다음에요', who: 'm', at: NEXT_AT + 1.4, until: THINK_AT, vo: 'm2', voAt: NEXT_AT + 1.5, koSize: 104, mark: 'ok', nodAt: NEXT_AT + 2.4, box: TOP },
  { k: 9, ko: '소개팅 할래?', who: 'd', at: THINK_AT + 0.05, until: THINK_AT + 1.6, vo: 'd1', voAt: THINK_AT + 0.1, koSize: 84, offer: true, box: TOP, h: 250 },
  { k: 3, ko: '좀 생각해 볼게요', who: 'm', at: THINK_AT + 1.6, until: ENV_AT, vo: 'm3', voAt: THINK_AT + 1.7, koSize: 92, mark: 'ok', nodAt: THINK_AT + 2.9, box: { left: 110, top: 280, width: 800 } },
  { k: 10, ko: '택시비 해!', who: 'b', at: ENV_AT + 0.05, until: ENV_AT + 1.15, vo: 'b2', voAt: ENV_AT + 0.1, koSize: 84, offer: true, box: TOP, h: 250 },
  { k: 4, ko: '마음만 받을게요', who: 'm', at: ENV_AT + 1.15, until: MIC_AT, vo: 'm4', voAt: ENV_AT + 1.25, koSize: 94, mark: 'ok', nodAt: ENV_AT + 2.5, box: TOP },
  { k: 5, ko: '노래방 가자!', who: 's', at: MIC_AT + 0.05, until: NAE_AT, vo: 's1', voAt: MIC_AT + 0.1, koSize: 92, box: { left: 340, top: 290, width: 580 } },
  { k: 6, ko: '다음에요~', who: 'm', at: NAE_AT, until: TTO_AT + 0.2, vo: 'm5', voAt: NAE_AT + 0.1, koSize: 100, mark: 'ok', markAt: NAE_AT + 0.45, box: { left: 200, top: 1130, width: 600 } },
  { k: 11, ko: '또 다음에?!', who: 's', at: TTO_AT, until: FREEZE2_AT + 0.35, vo: 's2', voAt: TTO_AT + 0.05, koSize: 96, box: { left: 340, top: 290, width: 580 } },
];

// 칸(그림) — 화면 자리는 그림옮기기로 1080×1920에 맞춘 좌표. 그림을 다시 구우면 다시 잰다.
export type Cell = { at: number; img: string };
export const CELLS: Cell[] = [
  { at: 0, img: 'open.jpg' },
  { at: FREEZE_AT, img: 'freeze.jpg' },
  { at: CRINGE_AT, img: 'cringe.jpg' },
  { at: CRINGE2_AT, img: 'cringe2.jpg' },
  { at: FINE_AT, img: 'fine.jpg' },
  { at: NEXT_AT, img: 'next.jpg' },
  { at: THINK_AT, img: 'think.jpg' },
  { at: ENV_AT, img: 'envelope.jpg' },
  { at: MIC_AT, img: 'mic.jpg' },
  { at: FREEZE2_AT, img: 'freeze2.jpg' },
];

// 몽글 몸(움직임 조각 · 말풍선 꼬리 끝)
export const MONGLE: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  'open.jpg': { cx: 884, cy: 1263, rx: 185, ry: 205 },
  'freeze.jpg': { cx: 884, cy: 1251, rx: 180, ry: 200 },
  'cringe.jpg': { cx: 700, cy: 1012, rx: 292, ry: 240 },
  'cringe2.jpg': { cx: 666, cy: 1205, rx: 340, ry: 150 },
  'fine.jpg': { cx: 838, cy: 1033, rx: 215, ry: 245 },
  'next.jpg': { cx: 849, cy: 1245, rx: 200, ry: 230 },
  'think.jpg': { cx: 786, cy: 1280, rx: 270, ry: 305 },
  'envelope.jpg': { cx: 872, cy: 1309, rx: 195, ry: 190 },
  'mic.jpg': { cx: 886, cy: 1524, rx: 165, ry: 175 },
  'freeze2.jpg': { cx: 886, cy: 1524, rx: 165, ry: 175 },
};

// 말풍선 꼬리 — 칸마다 꼬리 뿌리 x(말풍선 아래 · 위 끝)와 꼬리 끝(그림 좌표 — 확대를 따라 옮긴다)
export const TAIL: Record<string, Partial<Record<Who, { root: number; tip: [number, number]; up?: boolean }>>> = {
  'open.jpg': { m: { root: 590, tip: [748, 1392], up: true }, b: { root: 300, tip: [318, 1040], up: true } },
  'freeze.jpg': { m: { root: 590, tip: [748, 1380], up: true } },
  'cringe.jpg': { m: { root: 560, tip: [640, 810] } },
  'cringe2.jpg': { m: { root: 560, tip: [640, 1095] } },
  'fine.jpg': { m: { root: 800, tip: [812, 830] } },
  'next.jpg': { m: { root: 720, tip: [800, 1040] }, s: { root: 300, tip: [290, 660] } },
  'think.jpg': { m: { root: 770, tip: [770, 1000] }, d: { root: 300, tip: [300, 610] } },
  'envelope.jpg': { m: { root: 690, tip: [830, 1150] }, b: { root: 260, tip: [250, 600] } },
  'mic.jpg': { m: { root: 760, tip: [770, 1440], up: false }, s: { root: 620, tip: [600, 790] } },
};

// 칸마다 카메라 — 천천히 다가가는 축(그림 좌표)과 배율
export const CAM: Record<string, { ox: number; oy: number; z0: number; z1: number }> = {
  'open.jpg': { ox: 620, oy: 1250, z0: 1.0, z1: 1.06 },
  'freeze.jpg': { ox: 560, oy: 1050, z0: 1.0, z1: 1.0 }, // FACE_AT에 1.18로(Film.tsx)
  'cringe.jpg': { ox: 700, oy: 1010, z0: 1.0, z1: 1.04 },
  'cringe2.jpg': { ox: 666, oy: 1150, z0: 1.04, z1: 1.09 },
  'fine.jpg': { ox: 600, oy: 1000, z0: 1.0, z1: 1.05 },
  'next.jpg': { ox: 600, oy: 1150, z0: 1.0, z1: 1.05 },
  'think.jpg': { ox: 600, oy: 1150, z0: 1.0, z1: 1.05 },
  'envelope.jpg': { ox: 650, oy: 1250, z0: 1.0, z1: 1.05 },
  'mic.jpg': { ox: 540, oy: 1100, z0: 1.0, z1: 1.04 },
  'freeze2.jpg': { ox: 540, oy: 1100, z0: 1.04, z1: 1.1 },
};

// 움직이는 조각들(그림 좌표)
export const GLASS_HAND = { cx: 666, cy: 1297, rx: 150, ry: 115 }; // 첫 칸 부장님이 내민 잔
export const BOSS_FACE = { x: 275, y: 941 }; // 언 부장님 얼굴
export const DRIP_FROM: [number, number] = [553, 1198]; // 괜찮아 칸 — 녹는 잔 밑
export const DRIP_TO = 1335;
export const PHONE_NEXT = { cx: 494, cy: 1238, rx: 165, ry: 120 }; // 등산 사진 폰
export const PHONE_THINK = { cx: 442, cy: 1165, rx: 120, ry: 190 }; // 소개팅 사진 폰
export const ENVELOPE = { cx: 505, cy: 1297, rx: 200, ry: 110 }; // 택시비 봉투
export const MIC_ARM = { cx: 255, cy: 700, rx: 140, ry: 200, px: 330, py: 830 }; // 마이크 든 팔(어깨 축)
export const SENIOR = { x: 482, y: 941 };
export const SWEAT: [number, number] = [966, 990]; // 움찔 칸 — 몽글 오른쪽 땀방울이 흘러내리기 시작하는 자리 // 끝 — 언 선배(얼음이 여기서 번진다)
// 첫 칸 — 얼기 전 사람들(첫 컷 다른 눈 v3 #26: 잔 든 손과 세 사람의 표정이 고정돼 보임)
export const OPEN_BOSS = { cx: 207, cy: 884, rx: 175, ry: 200 };
export const OPEN_SENIOR = { cx: 505, cy: 746, rx: 125, ry: 140 };
export const OPEN_MATE = { cx: 792, cy: 763, rx: 120, ry: 140 };
// 몽글이 거절한 뒤 끄덕이는 권한 사람의 머리(목을 축으로)
export const NOD: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  'fine.jpg': { cx: 218, cy: 712, rx: 190, ry: 215 },
  'next.jpg': { cx: 264, cy: 861, rx: 190, ry: 215 },
  'think.jpg': { cx: 276, cy: 804, rx: 195, ry: 225 },
  'envelope.jpg': { cx: 241, cy: 735, rx: 175, ry: 200 },
};
export const LAUGH_BOSS = { cx: 195, cy: 1090, rx: 210, ry: 260 };
export const LAUGH_MATE = { cx: 884, cy: 1040, rx: 190, ry: 230 };

// 배경음 — public/sfx/bgm.wav는 보유곡 01_Joyful-Happy-Upbeat 0~21초. 얼어붙는 칸만 살짝 낮춘다(−5dB 안 · 밑에 얼음 소리)
export const BGM = 0.2;
export const BGM_FROZEN = 0.12;

export const SFX: { file: string; at: number; vol: number }[] = [
  { file: 'pour.wav', at: 0.25, vol: 0.45 },
  { file: 'tap.wav', at: PUSH_AT, vol: 0.3 },
  { file: 'freeze.wav', at: FREEZE_AT - 0.03, vol: 0.85 },
  { file: 'crack.wav', at: FACE_AT, vol: 0.55 },
  { file: 'stamp.wav', at: NG_AT, vol: 0.7 },
  { file: 'whoosh.wav', at: 4.05, vol: 0.3 },
  { file: 'drip.wav', at: 4.3, vol: 0.45 },
  { file: 'bow.wav', at: 4.65, vol: 0.5 },
  { file: 'drip.wav', at: 4.85, vol: 0.4 },
  { file: 'drip.wav', at: FINE_AT + 0.05, vol: 0.5 },
  { file: 'ding.wav', at: FINE_AT + 0.6, vol: 0.4 },
  { file: 'drip.wav', at: FINE_AT + 0.9, vol: 0.4 },
  { file: 'drip.wav', at: FINE_AT + 1.55, vol: 0.4 },
  { file: 'tap.wav', at: NEXT_AT + 0.02, vol: 0.4 },
  { file: 'ding.wav', at: NEXT_AT + 1.95, vol: 0.4 },
  { file: 'drip.wav', at: NEXT_AT + 2.6, vol: 0.35 },
  { file: 'tap.wav', at: THINK_AT + 0.02, vol: 0.4 },
  { file: 'ding.wav', at: THINK_AT + 2.5, vol: 0.4 },
  { file: 'paper.wav', at: ENV_AT + 0.02, vol: 0.5 },
  { file: 'bow.wav', at: ENV_AT + 1.35, vol: 0.5 },
  { file: 'ding.wav', at: ENV_AT + 2.0, vol: 0.4 },
  { file: 'whoosh.wav', at: MIC_AT, vol: 0.55 },
  { file: 'ding.wav', at: NAE_AT + 0.45, vol: 0.35 },
  { file: 'freeze.wav', at: FREEZE2_AT - 0.03, vol: 0.85 },
  { file: 'crack.wav', at: 21.6, vol: 0.45 },
  { file: 'drip.wav', at: 22.3, vol: 0.4 },
];
