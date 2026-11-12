#!/usr/bin/env node
// 글로벌 모델 공개 전환 검사 — 읽기만 한다. 사용: node check-global-publish.cjs [코드…]
// 코드가 없으면 roster-global-draft.json의 준비 목록 전부. 빠진 게 있으면 종료 코드 1.
'use strict';
const fs = require('fs');
const path = require('path');

const here = __dirname;
const company = path.resolve(here, '../온라인마케팅지도/engagement/company');
const app = path.join(company, 'public/pulse-app');
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
const json = (f) => JSON.parse(read(f));

const draft = json(path.join(here, 'roster-global-draft.json'));
const argv = process.argv.slice(2).map((s) => s.toUpperCase());
const codes = argv.length ? argv : draft.candidates.map((c) => c.code);

const roster = json(path.join(here, 'roster-v2.json')).models.map((m) => m.code);
const catalogCodes = Object.keys(json(path.join(here, 'catalog.json')).models);
const catalogSrc = read(path.join(app, 'casting-catalog.mjs')) || '';
const castingIds = [...catalogSrc.matchAll(/\bid:\s*'([FM]\d+)'/g)].map((m) => m[1]);
const requestData = read(path.join(app, 'request-data.mjs')) || '';
const serverSrc = read(path.join(company, 'server.mjs')) || '';
const swSrc = read(path.join(app, 'sw.js')) || '';

function block(name) {
  const start = requestData.indexOf(`export const ${name}`);
  if (start < 0) return '';
  const end = requestData.indexOf('});', start);
  return requestData.slice(start, end);
}
const linesBlock = block('MODEL_LINES');
const picksBlock = block('MODEL_PICKS');

// 화면 글에 박힌 「모델 N명」 · 「AI 모델 N명」
function hardcodedCounts() {
  const found = [];
  for (const name of fs.readdirSync(app)) {
    if (!/\.(mjs|html|js)$/.test(name)) continue;
    const text = read(path.join(app, name));
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/모델\s*(\d+)\s*명/g)) found.push({ file: `public/pulse-app/${name}`, line: i + 1, n: Number(m[1]) });
    });
  }
  return found;
}

const results = [];
const add = (code, ok, msg) => results.push({ code, ok, msg });
const exists = (f) => fs.existsSync(f);

for (const code of codes) {
  const id = code.toLowerCase();
  const cand = draft.candidates.find((c) => c.code === code);
  if (!cand) add(code, true, '준비 단계: 준비 목록에 없는 코드라 건너뜀');
  else {
    for (const s of cand.steps) add(code, !!s.done, `준비 단계 「${s.name}」${s.done ? '' : ' 아직 안 끝남'}`);
  }
  add(code, roster.includes(code), `roster-v2.json에 ${code}${roster.includes(code) ? '' : ' 없음'}`);
  add(code, catalogCodes.includes(code), `catalog.json에 ${code}${catalogCodes.includes(code) ? '' : ' 없음'}`);
  add(code, castingIds.includes(code), `casting-catalog.mjs CASTING_MODELS에 ${code}${castingIds.includes(code) ? '' : ' 없음'}`);
  const scene = path.join(app, `assets/request/model-scene-${id}.webp`);
  add(code, exists(scene), `자산 assets/request/model-scene-${id}.webp${exists(scene) ? '' : ' 없음'}`);
  // 큰 판(폭 1600): 의뢰서 큰 칸이 화소비가 높은 큰 화면에서 srcset으로 받는다 — 없으면 그 화면에서 404. 굽기는 make-request-scene-large.py.
  const sceneLarge = path.join(app, `assets/request/model-scene-${id}-l.webp`);
  add(code, exists(sceneLarge), `자산 assets/request/model-scene-${id}-l.webp${exists(sceneLarge) ? '' : ' 없음(python make-request-scene-large.py)'}`);
  const portrait = path.join(app, `assets/casting/${id}.webp`);
  add(code, exists(portrait), `자산 assets/casting/${id}.webp${exists(portrait) ? '' : ' 없음'}`);
  for (const shot of ['fullbody', 'look-1', 'look-2', 'context']) {
    const f = path.join(app, `assets/casting/photos/${id}-${shot}.webp`);
    add(code, exists(f), `자산 assets/casting/photos/${id}-${shot}.webp${exists(f) ? '' : ' 없음'}`);
  }
  const inLines = new RegExp('(^|[^A-Z0-9])' + code + '\\s*:').test(linesBlock);
  add(code, inLines, `request-data.mjs MODEL_LINES에 ${code}${inLines ? '' : ' 없음'}`);
  const inPicks = new RegExp(`['"]${code}['"]`).test(picksBlock);
  add(code, inPicks, `request-data.mjs MODEL_PICKS에 ${code}${inPicks ? '' : ' 없음'} (업종 추천 넷에 들지 않아도 되면 승인 때 예외로 적는다)`);
  const swOk = new RegExp('assets/casting/' + id + '\\.webp|[\'"/]' + id + '[\'"./]').test(swSrc);
  add(code, swOk, `sw.js 셸 목록에 ${id}${swOk ? '' : ' 없음'}`);
  const serverGeneric = /CASTING_MODELS\.map\(\s*model\s*=>\s*'model-scene-'/.test(serverSrc);
  add(code, serverGeneric, `server.mjs 정적 목록이 CASTING_MODELS로 model-scene-<id>를 만드는 줄${serverGeneric ? '(CASTING_MODELS에 들어가면 함께 실림)' : ' 못 찾음'}`);
  const serverLarge = /CASTING_MODELS\.map\(\s*model\s*=>\s*'model-scene-'\+model\.id\.toLowerCase\(\)\+'-l'\)/.test(serverSrc);
  add(code, serverLarge, `server.mjs 정적 목록이 CASTING_MODELS로 model-scene-<id>-l(큰 판)을 만드는 줄${serverLarge ? '' : ' 못 찾음'}`);
}

// 인원수 글: 공개되면 늘어날 수를 기준으로 본다
const publicNow = castingIds.length;
const willBe = publicNow + new Set(codes.filter((c) => !castingIds.includes(c))).size;
for (const h of hardcodedCounts()) {
  add('전체', h.n === willBe, `화면 글 인원수 ${h.file}:${h.line} 「모델 ${h.n}명」 — 전환 뒤 공개 ${willBe}명${h.n === willBe ? '' : '과 다름'}`);
}

let missing = 0;
for (const r of results) {
  if (!r.ok) missing += 1;
  console.log(`[${r.code}] ${r.ok ? '통과' : '빠짐'} ${r.msg}`);
}
console.log(missing ? `막힘: 빠진 것 ${missing}개 — 공개로 바꿀 수 없다` : '통과: 빠진 것 없음');
process.exit(missing ? 1 : 0);
