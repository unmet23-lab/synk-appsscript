// 시간표(초). 나레이션 시각은 public/vo/*.json의 낱말 시각으로 맞췄다.
// v2(10-26 첫 렌더 이해 시험 2점): 누가 왜 종이에 소리를 내는지 보이게(몽글 말풍선 + 「Say it to a paper!」),
// 소리마다 까닭 한마디(Big puff · No air · A little air), 「Paper test」 뒤 빈 1.5초와 카운트다운을 없앰.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

// v3(v2 이해 시험 3점 · 6초 넘김): 귀 시험 소리를 한 번씩만, 「Can't hear it? Watch the paper!」로 종이 장면을 앞당김, 로마자(pal · ppal · bal).
export const T = {
  // 첫 장면 — 종이대 앞 몽글 + 「Which sound is 빨 (ppal)?」
  h1: 0.06, // Which sound is… (「is」 끝 1.87)
  hq: 1.88, // 빨. — 찾을 소리를 먼저 한 번
  // 귀 시험 — 헤드폰 몽글 + 카드 ① ② ③, 소리마다 한 번
  test: 2.5,
  s1: 2.6, // 팔
  s2: 3.35, // 빨
  s3: 4.15, // 발 (끝 4.62)
  ask: 4.75, // 「1, 2 or 3? 👇」 알약(답이 나올 때까지)
  x1: 4.75, // Can't hear it? Watch the paper! (「Watch」 +1.29 · 끝 7.29)
  // 종이 시험
  paper: 6.0,
  r1: 7.35, // 팔 — 종이가 날린다
  b1: 7.9, // Big puff!
  r2: 9.2, // 빨 — 꼼짝 안 한다 → ② ✓
  a1: 9.8, // No air. It's two! (「two」 +1.05)
  r3: 11.75, // 발 — 조금
  l1: 12.3, // A little air.
  // 끝
  end: 13.7,
  e1: 13.75, // Grab a paper and try it! (끝 15.77)
  total: 16.4,
};

export const TOTAL_FRAMES = fr(T.total);
