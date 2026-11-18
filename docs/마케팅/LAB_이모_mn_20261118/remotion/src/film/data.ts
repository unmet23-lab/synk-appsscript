// LAB 몽골 M61 「이모~!」(11-18 15시 회차) — 원본 같은분야 「일본 14년차 한국에서 밥 먹는 게 어려워졌습니다」(WlAqWkRYIkc · 53.8초)의
// 식당 한 곳 구간(11.1~30.7초: 앉아서 먹다가 → 직원을 부르고 → 음식이 오고 → 먹는 반응) 뼈대. 원본은 식당 여러 곳을 잇는 브이로그라 한 곳만 옮긴다(오마주.json 「다르게」).
// 우리: 작은 삼겹살집 한 장면(고정 카메라, 깊이가 있는 구도 — 앞 탁자의 몽글 · 친구, 뒤 계산대의 이모). 반찬 접시가 다 비었다.
// 몽글 「저기요…」(너무 작아 소리가 바닥에 떨어짐) → 몽골식 «Эгч ээ!»(날아가 이모 등에 튕김) → 이모 「네…?」 갸웃
// → 친구 「이모~! 반찬 더 주세요!」 → 이모 「네~!」 바로 옴 → 몽글 「이모…? 친척이야?」 → 친구 「아니~」(카드: 이모 = 엄마의 자매 · 몽골 «Эгч ээ!» ↔ 한국 「이모~!」)
// → 몽글이 숨을 크게 들이마시고 「이모~!」 → 이모 「어머~ 서비스~!」 → 반찬 탑과 계란찜 → 몽글 「이모 최고~!」.
// 판본 틀: 나라마다 다른 글은 판본/<KEY>.json(판본.ts) — 여기에는 그림 · 한국어 · 목소리 · 박자만 둔다.
export const FPS = 30;
export const TOTAL = 19.3; // v5(이해 시험 v4 뒤 · 시험 없이): 첫 외침이 몽글 입에서 머문 뒤 날아감 · 카드 2.9초로 키움 · 이모 위 하트 · 끝 꼬리 0.9초

// 카메라 — 같은 판을 잘라 보인다(화면 판 1080×1920, 판/_판짜기.py 배율 1.0547 · 위 300px 벽 이음).
export type Cam = 'W' | 'M' | 'F' | 'E' | 'B' | 'Z';
export const CAMS: Record<Cam, { z: number; tx: number; ty: number }> = {
  W: { z: 1.0, tx: 0, ty: 0 }, // 전체(앞 탁자 · 뒤 계산대)
  M: { z: 1.6, tx: 0, ty: -984 }, // 몽글 가까이(왼쪽 앞)
  F: { z: 1.35, tx: -378, ty: -573 }, // 친구 가까이(오른쪽 앞)
  E: { z: 1.0, tx: 0, ty: 0 }, // 이모 가까이 판(b1 · b2 · b3) — 판 자체가 가까운 구도
  B: { z: 1.12, tx: -64, ty: -150 }, // 이모 판 조금 더 가까이
  Z: { z: 1.35, tx: 0, ty: -493 }, // 끝 — 몽글과 반찬 탑
};

// sub = 말풍선에 띄울 줄(LINES 번호, -1 = 없음)
export type Cell = { at: number; img: string; cam: Cam; sub: number; push?: number };
export const CELLS: Cell[] = [
  { at: 0.0, img: 'p2.jpg', cam: 'W', sub: -1, push: 0.04 }, // 훅 — 빈 반찬 접시, 몽글이 몸을 쭉 늘여 몽골식 «Эгч ээ!» — 말이 날아가 등 돌린 이모 등에 튕김(원본 0초 첫 칸 · v3: 볼 이유 v2 답 4)
  { at: 1.8, img: 'b1.jpg', cam: 'B', sub: 1, push: 0.03 }, // 이모 「네…?」 갸웃
  { at: 2.7, img: 'p1.jpg', cam: 'M', sub: 0, push: 0.03 }, // 몽글이 이번엔 한국말로, 아주 작게 「저기요…」 — 말풍선이 떨어짐(v3: haiku 「2.5~3초 빈 벽」 → 넓은 칸 대신 몽글 가까이에서)
  { at: 4.2, img: 'p3.jpg', cam: 'F', sub: 2, push: 0.03 }, // 친구가 손을 번쩍 「이모~! 반찬 더 주세요!」(원본 16.2초 직원에게 묻기)
  { at: 5.8, img: 'b2.jpg', cam: 'B', sub: 3, push: 0.04 }, // 이모 「네~!」 바로
  { at: 6.75, img: 'p4.jpg', cam: 'W', sub: -1, push: 0.03 }, // 이모가 반찬을 들고 바로 온다 — 몽글은 놀람
  { at: 7.45, img: 'p4.jpg', cam: 'M', sub: 4, push: 0.03 }, // 몽글 「이모…? 친척이야?」
  { at: 9.05, img: 'p5.jpg', cam: 'W', sub: 5, push: 0.03 }, // 친구 「아니~」 · 이모가 반찬을 채움 — 카드(몽골 «Эгч ээ!» · 한국 「이모~!」 나란히)
  { at: 11.65, img: 'p6.jpg', cam: 'M', sub: -1, push: 0.06 }, // 몽글이 숨을 크게 들이마셔 동그랗게 부풂
  { at: 12.65, img: 'p7.jpg', cam: 'W', sub: 6, push: 0.03 }, // 몽글 「이모~!」 — 이모가 반가워 돌아봄
  { at: 13.45, img: 'b3.jpg', cam: 'B', sub: 7, push: 0.04 }, // 이모 「어머~ 서비스~!」 계란찜
  { at: 16.1, img: 'p8.jpg', cam: 'W', sub: -1, push: 0.04 }, // 반찬 탑과 계란찜(원본 17.9초 음식 가까이)
  { at: 17.3, img: 'p8.jpg', cam: 'Z', sub: 8, push: 0.1 }, // 끝 — 몽글 「이모 최고~!」
];

// 한국어 줄(정본 — 판본마다 같다). vo = 목소리 파일 · voAt = 목소리 시작 초 · vol = 목소리 크기(1 = 그대로)
// drop = 그 초부터 말풍선이 떨어져 사라짐(너무 작은 「저기요…」) · bub = 말풍선 자리(화면 좌표 — 왼쪽 x, 아래 끝 y, 꼬리 끝 x) · top을 주면 위 끝을 top에 두고 꼬리를 위로
export type Line = { ko: string; vo: string; voAt: number; vol?: number; koSize: number; drop?: number; bub: { x: number; bottom: number; tail: number; top?: number } };
export const LINES: Line[] = [
  { ko: '저기요…', vo: 'm1', voAt: 2.8, vol: 0.55, koSize: 58, drop: 3.6, bub: { x: 330, bottom: 830, tail: 420 } }, // 0 몽글 — 아주 작게
  { ko: '네…?', vo: 'e1', voAt: 1.9, koSize: 72, bub: { x: 90, bottom: 600, tail: 420 } }, // 1 이모
  { ko: '이모~! 반찬 더 주세요!', vo: 'f1', voAt: 4.3, koSize: 60, bub: { x: 40, bottom: 980, tail: 560 } }, // 2 친구 — v5 맹검(GPT 대체 눈): 말풍선이 뒤 이모 얼굴을 덮고 꼬리가 이모를 가리켜 이모 말처럼 보임 → 이모 얼굴 아래로 내리고 꼬리를 친구가 든 손 쪽으로
  { ko: '네~!', vo: 'e2', voAt: 5.9, koSize: 76, bub: { x: 90, bottom: 600, tail: 420 } }, // 3 이모
  { ko: '이모…? 친척이야?', vo: 'm2', voAt: 7.55, koSize: 66, bub: { x: 150, bottom: 830, tail: 360 } }, // 4 몽글
  { ko: '아니~', vo: 'f2', voAt: 9.15, koSize: 72, bub: { x: 560, bottom: 1000, tail: 840 } }, // 5 친구
  { ko: '이모~!', vo: 'm3', voAt: 12.75, koSize: 84, bub: { x: 150, bottom: 800, tail: 230 } }, // 6 몽글 — 크게
  { ko: '어머~ 이모라고? 서비스~!', vo: 'e3', voAt: 13.55, koSize: 62, bub: { x: 70, bottom: 600, tail: 420 } }, // 7 이모
  { ko: '이모 최고~!', vo: 'm4', voAt: 17.5, koSize: 72, bub: { x: 70, bottom: 960, tail: 220 } }, // 8 몽글 — 끝 줄
];

// 날아가는 말(판본마다 글이 다른 것은 kind로 고른다) — 앞 탁자에서 뒤 계산대 쪽으로 간다
// kind: 'ko' = 그 한국어만 · 'local' = 판본의 그 나라식 부름(localCall)
export type Fly = { from: number; to: number; hold?: number; kind: 'ko' | 'local'; ko?: string; size: number; path: [number, number][]; drop?: boolean; bounce?: boolean };
export const FLIES: Fly[] = [
  // 몽골식 «Эгч ээ!» — 날아가 등 돌린 이모 등에 튕긴다(0초 훅)
  { from: 0.1, to: 1.8, hold: 0.35, kind: 'local', size: 76, path: [[300, 560], [560, 620], [700, 720]], bounce: true }, // v5: s · G · K v4 「«Эгч ээ!»가 누구 말인지 · 못 들은 건지 못 알아들은 건지」 → 몽글 입에서 꼬리를 달고 0.35초 머문 뒤 날아감
];
// 튕긴 뒤 이모 머리 위의 「?」(v4: s v3 「파란 말이 왜 떠다니는지」 · G v3 「못 알아들은 건지 못 들은 건지」)
export const QMARK = { from: 1.2, to: 1.8, x: 720, y: 560 };
// 몽글이 「이모~!」 하자 이모 위에 하트(v5: s · h · G v4 「이모라고 불러서 공짜인지」 — 불러 줘서 기뻐 덤을 준다는 까닭을 그림으로)
export const HEARTS = { from: 12.85, to: 13.45, x: 680, y: 560 };

// 위 벽 자리 — 0~1.6초 훅 띠, 9.1~12.3초 이모 카드
export const HOOK_UNTIL = 1.6;
export const HOOK_KO = '반찬이 없다!'; // v5: 「떨어졌다」를 모름(몽골 v3 h · 버마어 s · h) → 입문자가 아는 말(L10) // v3: haiku 「머리 글이 지난 편처럼 물음 한 줄」 → 상황 한 줄
export const CARD = { ko: '이모', from: 9.3, to: 12.2 }; // v5: s · h · K v4 「카드 작은 줄」 · G v4 「10초 한꺼번에 읽다 놓침」 → 키우고 2.9초 // v3: s · h 「카드 몽골어 글씨가 작다」 → 키우고 3.2초, = 꼴 대신 두 나라 부름을 나란히(haiku 「X = Y 카드가 지난 편과 같음」)

// 효과음(초 · 파일 · 크기)
export const SFX: [number, string, number][] = [
  [0.0, 'boing.wav', 0.2],
  [0.05, 'mongle_ppuu.wav', 0.42],
  [0.15, 'whoosh_side.wav', 0.22],
  [0.95, 'boing.wav', 0.26],
  [1.8, 'huh.wav', 0.24],
  [2.7, 'tok.wav', 0.14],
  [3.6, 'whoosh_up.wav', 0.1],
  [3.8, 'fall.wav', 0.18],
  [4.1, 'plop.wav', 0.22],
  [4.2, 'tok.wav', 0.16],
  [5.8, 'ding.wav', 0.18],
  [6.75, 'steps.wav', 0.3],
  [7.45, 'mongle_mii.wav', 0.24],
  [9.05, 'clink.wav', 0.26],
  [9.3, 'sparkle.wav', 0.16],
  [11.65, 'inhale.wav', 0.34],
  [12.65, 'boing.wav', 0.2],
  [12.8, 'whoosh_side.wav', 0.18],
  [13.45, 'twinkle.wav', 0.16],
  [16.1, 'pile.wav', 0.3],
  [16.4, 'stack.wav', 0.26],
  [16.8, 'tada.wav', 0.24],
  [17.3, 'sparkle.wav', 0.18],
  [18.85, 'mongle_ppong.wav', 0.2],
];
