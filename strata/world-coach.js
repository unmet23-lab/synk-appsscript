'use strict';
// WORLD 코치 지도 = 기본 WORLD 지도(strata/world-map.js — 3~4급 게임 묶음과 같은 판) + WORLD 코치에만 싣는 층들(생활 과제 · 말하기 유형 …).
// 지도판(map_ver)은 그 지도로 낸 모든 제시의 taskVersion이 되고, Trail 식별자는 120자까지다(atlas/trail.js id — 서버도 같은 규칙).
// 층마다 판을 이어 붙이면 그 한도를 넘는다(Atlas × WORLD E 2026-11-08: 기본 70자 + 생활 26자 + 말하기 30자 = 126자 → 모든 WORLD 코치 제시가
// 「Trail: invalid presentation」으로 던진다). 그래서 기본판은 그대로 두고 그 뒤에 층 판들의 짧은 지문 하나만 붙인다 — 층이 늘어도 길이가 같다.
// 지문은 층 판을 차례대로 이은 글의 FNV-1a 32비트다(재현: 그때의 층 판들을 git에서 찾아 같은 지문이 나오는지 본다). 층 판 목록은 layers 칸에 남긴다.
// 재확인 짝은 지도판이 아니라 능력 칸으로 맺으므로(temper-followup-2) 지도판의 꼴이 바뀌어도 이미 잡힌 재확인은 이어진다.
const LIMIT = 120;
const TAG = /^[a-zA-Z0-9_.:-]+$/;
const fnv = text => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const fail = message => { throw new TypeError(`Strata coach: ${message}`); };

// base: worldMapData()의 자료. layers: [[이 층을 싣는 함수, 층], …] 차례대로(예: [[withLifeLayer, life], [withSpeakingLayer, speaking]]).
function coachMapData(base, layers = []) {
  if (!base || typeof base.map_ver !== 'string' || !TAG.test(base.map_ver)) fail('a base map is required');
  if (!Array.isArray(layers) || layers.some(row => !Array.isArray(row) || typeof row[0] !== 'function' || typeof row[1]?.layer_ver !== 'string' || !TAG.test(row[1].layer_ver))) fail('invalid layers');
  let data = base;
  for (const [apply, layer] of layers) data = apply(data, layer);
  const versions = layers.map(([, layer]) => layer.layer_ver);
  const map_ver = versions.length ? `${base.map_ver}:layers-${fnv(versions.join('|'))}` : base.map_ver;
  if (map_ver.length > LIMIT) fail(`map version longer than ${LIMIT}`);
  return { ...data, map_ver, layers: versions };
}

module.exports = { coachMapData, fingerprint: fnv, LIMIT };
