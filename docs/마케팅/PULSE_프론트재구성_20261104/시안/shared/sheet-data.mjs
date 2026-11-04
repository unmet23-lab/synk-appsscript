// 콘택트 시트에 까는 컷. t는 그 작품에서 이 컷이 나오는 초다(누르면 그 순간부터 튼다). 그림은 media/sheet.
const list = (id, ratio, rows) => rows.map(([no, t]) => ({ work: id, ratio, no, src: `sheet/${id === 'maejin' ? 'mj' : id}-${String(no).padStart(2, '0')}.webp`, t }));
const POOL = {
  gift: list('gift', 'v', [[1, 1.0], [2, 2.4], [3, 3.4], [4, 4.4], [5, 5.2], [6, 6.5], [7, 7.6], [8, 9.0], [9, 10.4], [10, 11.2], [11, 12.0], [12, 13.8]]),
  maejin: list('maejin', 'h', [[3, 1.8], [8, 9.5], [10, 11.8], [12, 18.7], [15, 23.7], [26, 49.4]]),
  cf: list('cf', 'h', [[2, 3.2], [3, 6.0], [4, 9.5], [5, 15.2], [8, 23.4], [11, 36.6], [12, 38.6]]),
};
const pick = (id, no) => POOL[id].find((c) => c.no === no);
// 작품마다 한 장. 같은 얼굴 · 복면 컷이 이어지지 않게 골랐다.
export const SHEET = {
  gift: POOL.gift,
  maejin: [3, 8, 15, 10, 12, 26].map((n) => pick('maejin', n)),
  cf: [2, 3, 4, 5, 8, 11].map((n) => pick('cf', n)),
};
// 처음 보이는 칸은 제품과 풍경, 코미디는 뒤에.
export const WALL = [
  [pick('cf', 2), pick('gift', 4), pick('cf', 4), pick('gift', 7), pick('gift', 11), pick('cf', 8), pick('maejin', 12), pick('gift', 9), pick('maejin', 8)],
  [pick('cf', 3), pick('gift', 5), pick('cf', 5), pick('gift', 6), pick('cf', 11), pick('gift', 2), pick('maejin', 10), pick('cf', 12), pick('maejin', 3)],
];
export const tc = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
