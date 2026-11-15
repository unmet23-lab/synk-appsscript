// 시간표(초) — 목소리 낱말 시각(음성/범수/V*.json)과 측정(data.ts)에 맞춤.
// 판: A twinkle.mp4 · C twinkle2.mp4(같은 문장 순서만 바꾼 「twinkle」 판) · B steady.mp4 · D steady2.mp4(같은 문장 순서만 바꾼 고친 판). 넷 다 같은 첫 장면, 5.0초.
export const LEN = 26.8;

export const T = {
  hook2: 1.6, // 「twinkle(반짝인다)」 — V1의 '반짝인다는'(0.25 + 1.37)
  count: 3.6, // 핵심 장면 — A 0→5.0, 등 고리 · 바뀐 횟수
  count2: 4.95, // 「한꺼번에 꺼졌다 켜졌다」 — V2의 '한꺼번에'(3.7 + 1.31)
  map: 8.6, // 켜짐 지도(A 5초 전부) — 「118번」
  map2: 8.6,
  why: 11.2, // 그날 그 한 줄
  why2: 12.85, // 「껐다 켜기로 그렸다」 — V4의 '껐다'(11.3 + 1.56)
  strike: 13.9,
  fix: 14.4, // 고친 한 줄
  fix2: 14.75, // 「이 한 줄로 바꿨다」 — V5의 '이렇게 바꿨어요'
  typeEnd: 15.85, // 영어 줄이 다 쳐지고 우리말 뜻 — V5의 '등은'(14.5 + 1.37)
  after: 18.3, // 고친 판(후) — 끝에서 처음 보인다
  after2: 20.2, // 「꺼진 횟수 0번」 — V6의 '한 번도'(18.4 + 1.81)
  card: 21.8, // 저장할 한 장
  card2: 22.95, // 「「처음부터 끝까지 켜진 채」」 — V7의 '처음부터'(21.9 + 1.07)
};

export const HERO = { from: T.count, len: 5.0 };

export const VO: { id: string; at: number }[] = [
  { id: 'V1', at: 0.25 },
  { id: 'V2', at: 3.7 },
  { id: 'V3', at: 6.7 },
  { id: 'V4', at: 11.3 },
  { id: 'V5', at: 14.5 },
  { id: 'V6', at: 18.4 },
  { id: 'V7', at: 21.9 },
];

export const CLIP = {
  A: 'clips/twinkle.mp4',
  C: 'clips/twinkle2.mp4',
  B: 'clips/steady.mp4',
  D: 'clips/steady2.mp4',
  lampCx: 400, // 등 줄 가운데(영상 좌표 720×1280) — 핵심 장면이 이쪽으로 다가간다
  lampCy: 560,
  span: 5,
  sfx: [
    { id: 'swish', at: 3.55, vol: 0.35 },
    { id: 'thud', at: 8.6, vol: 0.55 },
    { id: 'swish', at: 11.15, vol: 0.3 },
    { id: 'tok', at: 13.9, vol: 0.5 },
    { id: 'swish', at: 18.25, vol: 0.35 },
    { id: 'thud', at: 20.2, vol: 0.45 },
  ] as { id: string; at: number; vol: number }[],
};
