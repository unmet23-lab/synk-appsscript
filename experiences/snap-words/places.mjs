// 찰칵 낱말 — 장소 · 판 모서리 · 무리 · 물건(설계 4 · 5절). 좌표는 구운 원본(2752 × 1536) 픽셀이다. 재는 법: qa/판재기.py(색 분할 + 격자 그림).
// 판 모서리 순서는 왼쪽 위 · 오른쪽 위 · 오른쪽 아래 · 왼쪽 아래(sign.mjs). 사진에는 글자를 굽지 않았다 — 글은 전부 화면이 얹는다.
// 무리(groups): 같은 색 · 같은 크기의 판이고 글자를 판마다 섞는다. 부탁 정답은 여기서만 나온다(글자 모양 · 자리로 못 푼다 — Koe 규칙).
// 고정 판(fixed): 글을 얹지만 섞지 않는다 — 둘러보기 카드로만 쓰고 부탁 정답으로는 쓰지 않는다.
// 물건(things): 글이 없다. 낱말 부탁(한국어 낱말 → 물건)과 인화의 사진 → 낱말에 쓴다.
const box = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

const bladeLeft = (y, h) => box(1112, y + 7, 1330, y + h - 7);   // 왼쪽 날개: 뾰족한 끝(1083~1110)을 뺀 몸통
const bladeRight = (y, h) => box(1428, y + 7, 1645, y + h - 7);  // 오른쪽 날개: 뾰족한 끝(1647~1673)을 뺀 몸통

export const PLACES = Object.freeze({
  gate: Object.freeze({
    id: 'gate', photo: 'assets/places/gate.webp', w: 2752, h: 1536, start: [0.5, 0.42],
    name: { ko: '새솔대 정문', en: 'Saesol main gate' }, when: { ko: '개강 첫날 아침', en: 'First morning of term' },
    ambience: 'outdoor',
    groups: Object.freeze({
      blade: { style: 'blade', slots: [bladeLeft(292, 56), bladeRight(293, 54), bladeLeft(376, 55), bladeRight(377, 54), bladeLeft(460, 54), bladeRight(460, 54), bladeRight(543, 54)],
        pool: ['library', 'dorm', 'cafeteria', 'bank', 'bookstore', 'post', 'pharmacy', 'office', 'union'] },
      stand: { style: 'stand', notice: true,
        slots: [[[1778.6, 1137], [1930, 1135.7], [1940.7, 1371.4], [1786.4, 1374.3]], [[2131.4, 1135.7], [2283.6, 1134.3], [2303.6, 1371.4], [2147.9, 1372]]],
        pool: ['n-construction', 'n-smoke', 'n-bike', 'n-fresh'] },
    }),
    fixed: Object.freeze([
      { id: 'stone', word: 'university', text: '새솔대학교', style: 'stone', vertical: true, q: box(78, 297, 262, 1064) },
      { id: 'shelter', word: 'stop', text: '정류장', style: 'band-navy', q: box(641.4, 699.3, 1242.9, 752.9) },
      { id: 'band', word: 'store', text: '편의점', style: 'band-cream', q: [[2342, 426], [2740, 247], [2740, 456], [2342, 570]] },
    ]),
    things: Object.freeze([
      { id: 'cat', word: 'cat', sound: 'meow', q: box(1431, 1097, 1530, 1235) },
      { id: 'bench', word: 'bench', q: box(1235, 1176, 1553, 1372) },
      { id: 'vending', word: 'vending', q: box(1036, 806, 1225, 1144) },
      { id: 'bike', word: 'bike', q: box(1706, 955, 2241, 1164) },
      { id: 'tree', word: 'tree', q: box(1890, 120, 2060, 925) },
      { id: 'building', word: 'building', q: box(2075, 0, 2370, 640) },
    ]),
  }),
  union: Object.freeze({
    id: 'union', photo: 'assets/places/union.webp', w: 2752, h: 1536, start: [0.46, 0.5],
    name: { ko: '학생회관 1층', en: 'Student union lobby' }, when: { ko: '점심 전', en: 'Before lunch' },
    ambience: 'indoor',
    groups: Object.freeze({
      row: { style: 'row', floors: [5, 4, 3, 2, 1], frame: box(1450, 550, 1698, 888),
        slots: [box(1515, 638, 1681, 680), box(1515, 687, 1681, 729), box(1515, 737, 1682, 779), box(1515, 787, 1682, 829), box(1515, 837, 1682, 879)],
        pool: ['cafeteria', 'bookstore', 'bank', 'post', 'pharmacy', 'office', 'store'] },
      hang: { style: 'hang',
        slots: [box(1178.3, 193.3, 1471.1, 290.6), box(1225.6, 382.2, 1426.7, 450), box(1256.1, 486, 1407.2, 536), box(1276.1, 555, 1396.7, 593.3)],
        pool: ['toilet', 'stairs', 'entrance', 'exit', 'lift'] },
      door: { style: 'sticker', noMission: true,
        slots: [[[110, 682], [204, 691], [202.5, 754], [109, 750]], [[364, 706.5], [424.5, 712], [423, 765], [363.5, 761]]],
        pool: ['push', 'pull'] },
    }),
    fixed: Object.freeze([
      { id: 'dir-head', decor: true, text: '층별 안내', style: 'row-head', q: box(1457, 558, 1690, 619) },
      { id: 'chalk', word: 'menu', text: '오늘의 메뉴', style: 'chalk', q: [[1736.8, 878.6], [1862.7, 878.6], [1868.6, 1067.3], [1741.4, 1067.3]] },
    ]),
    things: Object.freeze([
      { id: 'water', word: 'water', q: box(816, 800, 916, 1038) },
      { id: 'umbrella', word: 'umbrella', q: box(635, 900, 743, 1091) },
      { id: 'sofa', word: 'sofa', q: box(2237, 944, 2524, 1180) },
      { id: 'copier', word: 'copier', q: box(2198, 835, 2379, 1032) },
      { id: 'tray', word: 'tray', q: box(1864, 826, 2029, 885) },
    ]),
  }),
});

/** 판마다 잉크색(ink)과 사진 속 판의 바탕색(bg, 재어 본 값) — 대비 4.5:1은 places.test.mjs가 본다(Fable 설계 검토 11). */
export const STYLE_INK = Object.freeze({
  blade: { ink: '#ffffff', bg: '#1d2f55' }, row: { ink: '#ffffff', bg: '#16305f' }, 'row-head': { ink: '#ffffff', bg: '#1a3263' },
  stand: { ink: '#16284d', bg: '#f4f4f1' }, hang: { ink: '#16284d', bg: '#d6dade' }, sticker: { ink: '#16284d', bg: '#b9b7b1' },
  stone: { ink: '#e8d9a8', bg: '#3a3d38' }, 'band-navy': { ink: '#ffffff', bg: '#17274d' }, 'band-cream': { ink: '#16284d', bg: '#c9c1ad' }, chalk: { ink: '#f4f1e6', bg: '#14181a' },
});

export const PLACE_ORDER = Object.freeze(['gate', 'union']);
/** 앨범에 흐린 표지로 보이는 다음 장소(그 회차가 앱에 생기면 연다). */
export const COMING = Object.freeze([
  { id: 'fair', name: { ko: '동아리 박람회', en: 'Club fair' } },
  { id: 'festival', name: { ko: '봄 축제', en: 'Spring festival' } },
  { id: 'hangang', name: { ko: '한강 공원', en: 'Hangang park' } },
  { id: 'mt', name: { ko: 'MT 바닷가', en: 'Retreat by the sea' } },
]);
/** 그 장소에서 모을 수 있는 낱말 전체(앨범 분모). 안내문은 켰을 때만 센다. */
export function placeWords(place, { notices = false } = {}) {
  const out = new Set();
  for (const g of Object.values(place.groups)) if (notices || !g.notice) g.pool.forEach((id) => out.add(id));
  for (const f of place.fixed) if (f.word) out.add(f.word);
  for (const t of place.things) out.add(t.word);
  return [...out];
}
