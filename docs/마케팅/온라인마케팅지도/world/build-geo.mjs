#!/usr/bin/env node
// 세계 지도 모양 만들기 — 나라 경계를 한 번 투영해 world/geo.json으로 굳힌다(화면은 라이브러리 없이 그린다).
//
//   node docs/마케팅/온라인마케팅지도/world/build-geo.mjs --deps <폴더>
//
// <폴더>는 아래 패키지를 설치해 둔 곳(저장소 의존성에 넣지 않는다 — 나라 경계가 바뀔 때만 다시 돌린다):
//   npm install world-atlas@2.0.2 d3-geo@3.1.1 topojson-client@3.1.0 topojson-simplify@3.0.3 i18n-iso-countries@7.14.0
//
// 경계: Natural Earth 1:50m(world-atlas, 공공 영역). 투영: Equal Earth, 가운데 동경 150도(한국이 가운데 왼쪽, 아메리카가 오른쪽).
// 남극은 뺀다. 작은 나라(투영 면적이 작은 곳)는 small로 표시해 화면이 점으로도 그린다.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const at = process.argv.indexOf('--deps');
if (at < 0 || !process.argv[at + 1]) {
  console.error('사용: node build-geo.mjs --deps <world-atlas · d3-geo 등을 설치한 폴더>');
  process.exit(2);
}
const require = createRequire(join(resolve(process.argv[at + 1]), 'package.json'));
const topo = require('world-atlas/countries-50m.json');
const { feature } = require('topojson-client');
const { presimplify, simplify, quantile } = require('topojson-simplify');
const { geoEqualEarth, geoPath, geoArea } = await import(pathToFileURL(require.resolve('d3-geo')).href);
const iso = require('i18n-iso-countries');
iso.registerLocale(require('i18n-iso-countries/langs/ko.json'));

const WIDTH = 1000;
const ROTATE = -150;
// 화면과 장부가 쓰는 이름에 맞춘다(라이브러리 이름이 긴 곳만).
const KO = { KR: '한국', KP: '북한', US: '미국', GB: '영국', RU: '러시아', TW: '대만', HK: '홍콩', MO: '마카오', AE: '아랍에미리트', VN: '베트남', LA: '라오스', CZ: '체코', CD: '콩고민주공화국', CG: '콩고', IR: '이란', SY: '시리아', BO: '볼리비아', VE: '베네수엘라', TZ: '탄자니아', MD: '몰도바', KG: '키르기스스탄' };

const pre = presimplify(topo);
const simple = simplify(pre, quantile(pre, 0.2));
const all = feature(simple, simple.objects.countries).features.filter(f => f.id !== '010');
const projection = geoEqualEarth().rotate([ROTATE, 0]).fitWidth(WIDTH, { type: 'FeatureCollection', features: all });
const path = geoPath(projection).digits(1);
const [[, y0], [, y1]] = path.bounds({ type: 'FeatureCollection', features: all });
const height = Math.ceil(y1 - y0 + 2);
projection.translate([projection.translate()[0], projection.translate()[1] - y0 + 1]);

const out = [];
for (const f of all) {
  const a2 = f.id ? iso.numericToAlpha2(f.id) : null;
  const d = path(f);
  if (!d) continue;
  const area = path.area(f);
  const [cx, cy] = path.centroid(f);
  out.push({
    a2: a2 || null,
    n: f.id || null,
    ko: (a2 && (KO[a2] || iso.getName(a2, 'ko'))) || f.properties.name,
    en: f.properties.name,
    d,
    c: [Math.round(cx * 10) / 10, Math.round(cy * 10) / 10],
    a: Math.round(area),
    small: area < 6 ? true : undefined,
    sr: Math.round(geoArea(f) * 1e6) / 1e6
  });
}
out.sort((a, b) => b.a - a.a);
// 같은 나라 번호의 아주 작은 조각(예: 호주 번호를 쓰는 애시모어 카르티에 제도)은 본토와 겹쳐 지운다.
const seen = new Set();
for (let i = 0; i < out.length; i++) {
  const key = out[i].a2;
  if (key && seen.has(key)) { out.splice(i, 1); i--; continue; }
  if (key) seen.add(key);
}
const doc = {
  source: 'Natural Earth 1:50m via world-atlas@2.0.2 (public domain) · Equal Earth · rotate ' + ROTATE,
  w: WIDTH,
  h: height,
  countries: out.map(({ sr, ...rest }) => rest)
};
const target = join(here, 'geo.json');
writeFileSync(target, JSON.stringify(doc));
console.log('geo.json', out.length, '나라', WIDTH + '×' + height, Math.round(JSON.stringify(doc).length / 1024) + 'KB');
