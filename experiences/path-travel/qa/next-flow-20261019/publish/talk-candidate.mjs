// 운영 v48 묶음 위에 PATH 저장 검사 두 줄만 새 판 의미로 바꾼 후보를 만들고 검증한다.
// 검증: 바뀐 곳 2군데·되돌리면 v48 지문·옛 묶음은 1곳 하루를 거절·후보는 받음·3곳 하루는 둘 다 받음·하루 3곳 희망에 1곳은 둘 다 거절.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sha = text => crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
const v48 = fs.readFileSync(path.join(here, 'v48-bundle.js'), 'utf8');
if (!sha(v48).startsWith('bc9f719ea9a541b5')) throw new Error('v48 지문이 다르다');
const swaps = [
  ['  const minimumStops = planningMode === "remaining" ? 1 : 2, stopCount = value.stopCount ?? 3;\n  if (!integer(stopCount, minimumStops, 5)) fail2("stopCount", `희망 방문 수는 ${minimumStops}~5곳으로 골라 주세요.`);',
   '  const stopCount = value.stopCount ?? 3;\n  if (!integer(stopCount, 1, 5)) fail2("stopCount", "희망 방문 수는 1~5곳으로 골라 주세요.");'],
  ['plan.stops.length < (query.planningMode === "remaining" ? 1 : 2)',
   'plan.stops.length < (query.planningMode === "remaining" ? 1 : Math.min(2, query.stopCount))'],
];
const eol = v48.includes('\r\n') ? '\r\n' : '\n';
let candidate = v48;
for (const [from, to] of swaps) {
  const a = from.replace(/\n/g, eol), b = to.replace(/\n/g, eol), n = candidate.split(a).length - 1;
  if (n !== 1) throw new Error(`바꿀 곳이 꼭 한 번이 아니다(${n}): ${from.slice(0, 50)}`);
  candidate = candidate.split(a).join(b);
}
let back = candidate;
for (const [from, to] of swaps) back = back.split(to.replace(/\n/g, eol)).join(from.replace(/\n/g, eol));
const out = path.join(here, 'synk-personal-runtime.candidate.js');
fs.writeFileSync(out, candidate);
const report = { v48: sha(v48).slice(0, 16), candidate: sha(candidate), candidateBytes: Buffer.byteLength(candidate), reverseIsV48: sha(back) === sha(v48), eol: eol === '\r\n' ? 'CRLF' : 'LF' };
// 실제 검사 비교 — 새 PATH 판(깨끗한 사본)으로 문서를 만든다
const appRoot = path.join(here, 'build/b/SYNK-appsscript/experiences/path-travel/');
const url = name => pathToFileURL(appRoot + name).href;
const { planTravel } = await import(url('planner.mjs'));
const { createTravelMemory } = await import(url('planner-storage.mjs'));
const { travelAccountDocument } = await import(url('planner-account.mjs'));
const now = '2026-10-19T03:00:00.000Z', origin = { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9854 };
const plan = input => planTravel({ date: '2026-10-21', origin, party: { adults: 1, children: 0 }, budget: 60000, maxWalkMinutes: 70, preferences: { tea: true }, requiredCategories: [], requiredFeatures: {}, lockedIds: [], excludedIds: [], ...input }, { now, ask: false });
const docOf = result => travelAccountDocument(createTravelMemory({ query: result.input, plan: result.primary }, { now }), { now });
const one = plan({ startTime: '14:00', endTime: '15:00', stopCount: 1 });
const three = plan({ startTime: '13:00', endTime: '16:00', stopCount: 3 });
const docs = { oneStopDay: docOf(one), threeStopDay: docOf(three) };
// 하루 희망 3곳인데 1곳만 든 문서(어긋난 문서) — 두 묶음 모두 거절해야 한다
const broken = structuredClone(docs.threeStopDay); broken.plan.stops = broken.plan.stops.slice(0, 1); broken.plan.legs = broken.plan.legs.slice(0, 1);
docs.brokenThreeWithOne = broken;
const tryWrite = (bundle, doc) => { try { bundle.model.personalWriteRequest('path-travel', 0, doc); return '받음'; } catch (error) { return '거절'; } };
const load = file => { delete require.cache[require.resolve(file)]; return require(file); };
const v48File = path.join(here, 'v48-bundle.cjs'); fs.writeFileSync(v48File, v48);
const candFile = path.join(here, 'candidate-load.cjs'); fs.writeFileSync(candFile, candidate);
const oldBundle = load(v48File), newBundle = load(candFile);
report.stops = { oneStopDay: one.primary.stops.length, threeStopDay: three.primary.stops.length };
report.checks = Object.fromEntries(Object.entries(docs).map(([name, doc]) => [name, { v48: tryWrite(oldBundle, doc), candidate: tryWrite(newBundle, doc) }]));
console.log(JSON.stringify(report, null, 1));
