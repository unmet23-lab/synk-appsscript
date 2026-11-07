#!/usr/bin/env node
// 홈 PATH 칸의 「예시 하루」 지도 그림(2026-11-07, 2회차 시안). 공개 서울 하루 엔진과 보행 길망(OSM)을 저장소 원천에서 그대로 불러
// 고정한 하루(차 · 궁궐, 세 시간, 10-21 수 10:00 안국역 출발)를 짜고, 그 동선 둘레만 잘라 SVG 한 장과 핀 자리(JSON)로 낸다.
// 날짜는 엔진이 곳마다 운영을 실제로 확인한 날로 고른다 — 장소 자료 확인일(places-v2 checkedAt 10-09)에서 30일 안이고 월요일이 아닌 날.
// 11-07 첫 판은 11-09(월)이라 월요일 휴관인 운현궁이 들어갔고 모든 곳이 「운영 확인 필요」였다(Fable 검수 11-07). 모든 곳이 확인됐는지는 아래에서 멈춰 본다.
// 쓰기: node docs/디자인/synk.im_리디자인_20261106/시안/make-path-sample.mjs [출력 폴더=이 폴더]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const travel = path.join(repo, 'experiences', 'path-travel');
const im = f => import(pathToFileURL(path.join(travel, f)).href);
const [{ TRAVEL_PLACES }, { planTravel }, C, { createTravelMemory }, { createWalkingRouter }] = await Promise.all(['places-v2.mjs', 'planner.mjs', 'planner-chooser.mjs', 'planner-storage.mjs', 'walking-router.mjs'].map(im));
const net = JSON.parse(fs.readFileSync(path.join(travel, 'assets', 'jongno-walking.json'), 'utf8'));
const routeLeg = createWalkingRouter(net);

// 고정한 예시 — 공개 PATH 쪽 「서울 하루」 세 화면과 같은 고르기(차 한 잔 · 궁궐, 3시간)
const SAMPLE = { now: '2026-10-20T01:00:00.000Z', date: '2026-10-21', startTime: '10:00', picks: ['tea', 'palace'], hours: 3 };
const raw = createTravelMemory({}, { now: SAMPLE.now }).query;
const request = { now: SAMPLE.now, query: { origin: raw.origin, date: SAMPLE.date, startTime: SAMPLE.startTime }, picks: SAMPLE.picks, hours: SAMPLE.hours, places: TRAVEL_PLACES, routeLeg };
const chosen = C.planChooser(request);
const { input } = C.chooserTripInput(raw, request, { plan: chosen });
const result = planTravel(input, { now: SAMPLE.now, feedback: [], routeLeg, intents: C.dayIntentRules(input), ask: false });
const p = result.primary;
if (!p) throw new Error('예시 하루가 나오지 않았다');
const unchecked = p.stops.filter(s => s.schedule?.status !== 'matched');
if (unchecked.length) throw new Error(`예시 하루에 운영을 확인하지 못한 곳이 있다(${unchecked.map(s => `${s.place.name}: ${s.schedule?.reason}`).join(' / ')}) — 장소 자료 확인일 30일 안 · 휴관 아닌 날로 SAMPLE을 고른다`);

const LAT0 = 37.577, LON0 = 126.9815, K = 111320, COS = Math.cos(LAT0 * Math.PI / 180);
const P = (lon, lat) => [(lon - LON0) * K * COS, (LAT0 - lat) * K];
const line = p.legs.flatMap(l => (l.coordinates || []).map(c => P(c[0], c[1])));
const stops = p.stops.map((s, i) => ({ n: i + 1, id: s.placeId, name: s.place.name, at: s.arrivalTime, pick: SAMPLE.picks.find(id => C.servesDayIntent(s.place, id)) || null, xy: P(s.place.coordinates.lon, s.place.coordinates.lat) }));
const origin = { name: input.origin.name, at: p.startTime, xy: P(input.origin.lon, input.origin.lat) };

// 칸 비율 3:4(세로) — 동선 둘레에 여백을 두고 그 상자만 그린다.
const pts = [...line, origin.xy, ...stops.map(s => s.xy)];
const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
let cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
let w = (Math.max(...xs) - Math.min(...xs)) * 1.9, h = (Math.max(...ys) - Math.min(...ys)) * 1.45;
const RATIO = 3 / 4; if (w / h > RATIO) h = w / RATIO; else w = h * RATIO;
cy += h * .04; // 칸 아래쪽에 글이 얹히지 않게 동선을 조금 위로
const box = { x: cx - w / 2, y: cy - h / 2, w, h };
const inBox = q => q[0] > box.x - 60 && q[0] < box.x + box.w + 60 && q[1] > box.y - 60 && q[1] < box.y + box.h + 60;
const r1 = v => Math.round(v * 10) / 10;
const groups = { park: [], foot: [], minor: [], major: [] };
const cls = k => k === 'park' ? 'park' : ['primary', 'secondary', 'tertiary'].includes(k) ? 'major' : ['footway', 'path', 'steps'].includes(k) ? 'foot' : 'minor';
for (const way of net.ways) {
  const q = way.n.map(i => P(net.nodes[i][0], net.nodes[i][1]));
  if (!q.some(inBox)) continue;
  groups[cls(way.kind)].push('M' + q.map(v => `${r1(v[0] - box.x)} ${r1(v[1] - box.y)}`).join('L') + (way.kind === 'park' ? 'Z' : ''));
}
const d = 'M' + line.map(v => `${r1(v[0] - box.x)} ${r1(v[1] - box.y)}`).join('L');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r1(box.w)} ${r1(box.h)}" preserveAspectRatio="xMidYMid slice">
<!-- 서울 하루 예시(차 · 궁궐, 세 시간) — 보행 길망 © OpenStreetMap 기여자(ODbL), 동선은 공개 서울 하루 엔진이 짠 것 -->
<style>path{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.k{fill:rgba(82,105,86,.1);stroke:none}.f{stroke:rgba(17,18,20,.13);stroke-width:.7}.m{stroke:rgba(17,18,20,.2);stroke-width:1}.M{stroke:rgba(17,18,20,.3);stroke-width:2}.rc{stroke:#f1efe9;stroke-width:8}.r{stroke:#2f6b3e;stroke-width:3.5}</style>
<path class="k" d="${groups.park.join('')}"/><path class="f" d="${groups.foot.join('')}"/><path class="m" d="${groups.minor.join('')}"/><path class="M" d="${groups.major.join('')}"/>
<path class="rc" data-route d="${d}"/><path class="r" data-route d="${d}"/>
</svg>
`;
const pct = q => [+(((q[0] - box.x) / box.w) * 100).toFixed(2), +(((q[1] - box.y) / box.h) * 100).toFixed(2)];
const meta = { sample: SAMPLE, span: `${p.startTime}–${p.endTime}`, walking: p.walking && [p.walking.minMinutes, p.walking.maxMinutes], origin: { ...origin, xy: pct(origin.xy) }, stops: stops.map(s => ({ ...s, xy: pct(s.xy) })) };
const out = process.argv[2] ? path.resolve(process.argv[2]) : here;
fs.writeFileSync(path.join(out, 'path-sample.svg'), svg);
fs.writeFileSync(path.join(out, 'path-sample.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(`path-sample.svg ${(Buffer.byteLength(svg) / 1024).toFixed(1)}KB ·`, meta.span, '·', stops.map(s => `${s.n} ${s.name} ${s.at}`).join(' / '));
