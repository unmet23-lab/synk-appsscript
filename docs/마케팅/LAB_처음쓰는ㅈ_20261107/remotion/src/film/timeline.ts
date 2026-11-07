// 시간표(초). 원본(우리편) E5 「처음 쓰는 ㄹ」의 자리를 따르고(오마주.json 뼈대 — 반전 6.9 · 끝 15.0),
// 나레이션 시각은 public/vo/*.json의 낱말 시각으로 맞췄다 — 이름표는 그 낱말이 들리는 순간에 뜬다.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

const BASE = {
  // 첫 장 — 따라 쓰기 칸 넷(본 글자 하나 + 시도 셋). 이름표 셋은 원본 박자(2.9 · 5.0 · 6.2) 0.6초 안에.
  h1: 0.05, // My first try at this letter...
  att1: [-0.6, 1.9], // Z — 0초엔 위 가로줄만 다 그어져 있다
  a1: 2.215, // That's a Z. — 「Z」 +0.63
  att2: [2.15, 3.45], // 천천히 바른 ㅈ(인쇄체 — 위 가로 · 왼쪽 다리 · 오른쪽 다리)
  a2: 3.45, // Okay... that one's right. — 「right」 +1.17
  att3: [4.2, 5.1], // 빨리 쓴 ㅈ — 위 가로가 꺾여 왼쪽 다리로 이어진다(ス 꼴)
  a3: 4.9, // Wait... is that Japanese? — 「Japanese」 +1.03
  cross: [6.3, 6.8], // 연필로 ス 꼴을 X로 지운다(배우는 사람이 틀렸다고 생각)
  pencilOut: [6.85, 7.3],
  flip: [7.1, 7.6], // 쪽 넘김(원본 6.9)
  // 둘째 장 — 큰 칸에 다시 써도 ス 꼴 → 「Nope. Still Japanese.」 북북 낙서 → 한국 친구가 파란 펜으로 쓴 「잘했어!」 · 같은 꼴 · ✓
  // 장면 심사 v1(넘김 · 2): 「0초가 빈 공책 · 써지는 과정 없음」 → 큰 칸에 연필로 크게 쓰고 긋는 움직임으로 연다
  // 이해 시험 v1 · v2: 셋이 「왜 일본어 · 왜 또 틀렸다는지」 → 말을 「Still Japanese」로, 이름표를 2초마다 찍는 장면(6초)에 들게 앞당김
  pencilIn2: [7.3, 7.65],
  r1: 7.65, // One more time...
  write2: [7.7, 8.5], // 큰 칸에 천천히 다시 써도 ス 꼴(원본 7.6 길잡이 박자)
  r3: 8.85, // Nope. Still Japanese. — 「Nope」 +0.05 · 「Japanese」 +0.77
  cross2: [8.9, 9.5], // 북북 낙서(원본 8.4)
  pencilOut2: [9.55, 9.95],
  f1: 10.5, // Then my Korean friend wrote this. — 「wrote」 +1.10 · 「this」 +1.31
  // 이해 시험 v2 haiku 9번: 붙임 쪽지가 지난 편(「지마」)의 쪽지와 같은 끝 장치 → 친구가 내 공책에 파란 펜으로 바로 쓴다
  noteIn: [10.95, 11.55], // 파란 펜 「잘했어!」가 써지듯 드러난다
  circle: [11.55, 11.85], // 그 「잘」의 ㅈ에 빨간 동그라미
  eq: [11.85, 12.25], // 빨간 펜이 친구의 ㅈ을 내 글자 위에 겹쳐 따라 긋는다(원본 12.6 — 이해 시험 v2 「Same이 무엇과 같은지」)
  s1: 12.4, // Same shape. — 「shape」 +0.41
  erase: [12.5, 12.9], // 낙서가 지우개로 지워진다
  check: [12.95, 13.25], // 빨간 ✓
  s2: 13.4, // It was right all along!
  arrange: [14.5, 15.0], // 두 꼴 나란히 ✓ ✓ (원본 14.5)
  end: 15.0,
  zIn: [15.0, 15.4], // 첫 시도 Z가 아래에 톡(원본 끝 15.0)
  e1: 15.05, // Both are right. — 빨간 펜 손글씨 「both right!」
  hand: [15.15, 15.85],
  e2: 16.05, // Just... never a Z. — 「never」 +0.68 · 「Z」 +1.16
  // 볼 이유 v2: 「끝에서 Z가 슬쩍 사라짐 — 10초에 ㅈ을 지웠던 그 연필로 Z를 박박 지우고 끝내라」
  pencilIn3: [16.25, 16.68],
  zScrib: [16.7, 17.3], // Z를 북북(원본 16.1 끝 둘째)
  pencilOut3: [17.4, 17.9],
  total: 18.6,
  tag1: 2.215 + 0.63,
  tag2: 3.45 + 1.17,
  tag3: 5.75, // 「Japanese」 낱말보다 0.18초 앞 — 6초 장면에 이름표가 들게
} as const;

export const T = BASE;
export const TOTAL_FRAMES = fr(T.total);
