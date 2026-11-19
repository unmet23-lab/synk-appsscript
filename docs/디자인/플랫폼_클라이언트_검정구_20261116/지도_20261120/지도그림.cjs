// 세계 지도 자료(land-110m.json, Natural Earth 1:110m 육지, world-atlas 2.0.2)를 구에 입힐 그림 한 장으로 만든다.
// 가로가 경도(−180~180), 세로가 위도(90~−90)인 2048×1024 그림이다. 빨강은 육지, 초록은 해안선이다.
//   node docs/디자인/플랫폼_클라이언트_검정구_20261116/지도_20261120/지도그림.cjs      (저장소 뿌리에서)
const fs = require('node:fs'), path = require('node:path');
const sharp = require(path.resolve('desktop/node_modules/sharp'));
const 곳 = __dirname;
const topo = JSON.parse(fs.readFileSync(path.join(곳, 'land-110m.json'), 'utf8'));
const W = 2048, H = 1024;
const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
// 호(arc)는 앞 점과의 차이로 적혀 있다. 풀어서 경도, 위도로 바꾼다
const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
const arc = i => i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
const px = ([lon, lat]) => ((lon + 180) / 360 * W).toFixed(1) + ' ' + ((90 - lat) / 180 * H).toFixed(1);
let d = '', rings = 0;
for (const g of topo.objects.land.geometries) {
  const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs;
  for (const poly of polys) for (const ring of poly) {
    const raw = ring.flatMap((i, k) => k ? arc(i).slice(1) : arc(i));
    // 날짜 변경선(경도 ±180)을 넘는 땅(추코트카, 피지)은 경도를 이어 붙인 뒤, 360도 옮긴 것을 한 번 더 그린다. 안 그러면 지도를 가로지르는 줄이 생긴다
    let off = 0, lo = 999, hi = -999;
    const pts = raw.map(([lon, lat], k) => {
      if (k) { const dl = lon - raw[k - 1][0]; if (Math.abs(dl) > 180 && lat > -88) off -= 360 * Math.sign(dl); }   // 남극 대륙이 극점에서 지도 끝을 따라 도는 것은 그대로 둔다
      lo = Math.min(lo, lon + off); hi = Math.max(hi, lon + off);
      return [lon + off, lat];
    });
    for (const shift of [0, ...(lo < -180 ? [360] : []), ...(hi > 180 ? [-360] : [])]) d += 'M' + pts.map(([lon, lat]) => px([lon + shift, lat])).join('L') + 'Z';
    rings++;
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#000"/>` +
  `<path d="${d}" fill="#f00" fill-rule="evenodd"/><path d="${d}" fill="none" stroke="#0f0" stroke-width="2.2" stroke-linejoin="round" style="mix-blend-mode:screen"/></svg>`;
sharp(Buffer.from(svg)).webp({ quality: 92 }).toFile(path.join(곳, 'land.webp')).then(i => console.log('그림 ' + i.width + '×' + i.height + ', ' + Math.round(i.size / 1024) + 'KB, 고리 ' + rings + '개'));
