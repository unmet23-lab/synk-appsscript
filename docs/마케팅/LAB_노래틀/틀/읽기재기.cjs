#!/usr/bin/env node
'use strict';
/**
 * LAB 노래 · 화면 글 읽기 시간 관문(2026-11-15 Claude, 유호님 「읽기 빠듯하면 읽기 좋게 만들어야지 왜 빠듯하게 만든거야」).
 *
 *   node docs/마케팅/LAB_노래틀/틀/읽기재기.cjs <편 폴더> [--json]        → 넘치는 줄이 있으면 끝 코드 1
 *   node docs/마케팅/LAB_노래틀/틀/읽기재기.cjs <편 폴더> --필요            → {"다리": 초, "딱지": 초, "끝": 초}(26개 말 가운데 가장 긴 것을
 *       읽는 데 드는 초) — 편만들기.py --읽기가 앞마디 · 진짜 속도 딱지 머묾 · 끝 물음 마디 수를 정할 때
 *
 * 판본 글(<편>/remotion/src/판본/<KEY>.json) 26개의 다리 글 · 뜻 · 딱지 · 끝 물음을 song.json 화면 구간과 댄다. 읽는 데 드는 초는
 * 글자 검사(tools/lib/글자검사.js 읽기시간검사)와 같은 셈(자소 수 ÷ 언어 프로필 초당 글자)이다. 화면 구간은 글이 실제로 읽히는 동안만
 * 센다 — 다리 글은 카운트인 끝 0.3초 앞부터 위로 빠지고(Song.tsx swapOut), 끝 물음 낱말은 끝 화면이 열리고 12프레임(0.4초) 뒤부터 차례로
 * 들어온다(Song.tsx at0 + 12). 11-14 노래만 판은 끝 화면이 2.7~2.8초라 끝 물음이 49개 판에서 넘쳤는데, 글자 검사가 「확인할 것」으로만
 * 짚어 눈확인 메모로 넘어갔다. 그래서 글을 짓는 단계(판본글짓기.cjs 끝)와 곡을 자르는 단계(편만들기.py --읽기)에서 막는다.
 */
const fs = require('fs');
const path = require('path');

const 뿌리 = path.resolve(__dirname, '..', '..', '..', '..');
const { 자소수 } = require(path.join(뿌리, 'tools', 'lib', '글자검사.js'));
const 프로필 = require(path.join(뿌리, 'tools', 'lib', '현지화프로필.js'));

const REAL_LEAD = 0.5; // src/Song.tsx REAL_LEAD
const 다리나감 = 0.2; // 카운트인 끝 0.3초 앞부터 빠지기 시작해 0.12초 앞에 다 빠진다 — 그 가운데까지 읽힌다
const 끝들어옴 = 0.4; // 끝 물음 첫 낱말이 끝 화면 12프레임 뒤에 들어온다
const 들어옴 = 0.2; // 뜻 · 딱지가 흐림에서 또렷해지는 동안

/** song.json 짜임에서 줄마다 읽히는 구간 [시작, 끝] */
function 화면구간(doc) {
  const P = (k) => doc.parts.filter((p) => p.kind === k);
  const [count] = P('count');
  const [end] = P('end');
  const [real] = P('real');
  const wholes = P('whole');
  const 구간 = {};
  if (count) 구간.bridge = [count.t, count.end - 다리나감];
  if (wholes.length && end) 구간.mean = [wholes[0].at[0] + 0.25 + 들어옴, end.t];
  if (real) 구간.real = [real.t - REAL_LEAD + 들어옴, real.end];
  for (const p of doc.parts.filter((x) => x.kind === 'rest')) 구간[p.mode === 'clap' ? 'clap' : 'say'] = [p.t + 들어옴, p.end];
  if (end) 구간.end = [end.t + 끝들어옴, end.end];
  return 구간;
}

/** 편 폴더 → { 줄: [{키, id, 언어, 글자, 초당, 필요, 있음}], 넘침: [...], 필요: {다리, 끝} } */
function 재기(편폴더, { doc = null, 판본 = null } = {}) {
  const song = doc || JSON.parse(fs.readFileSync(path.join(편폴더, 'remotion', 'public', 'song.json'), 'utf8'));
  const 구간 = 화면구간(song);
  const 폴더 = path.join(편폴더, 'remotion', 'src', '판본');
  const 판들 = 판본 || Object.fromEntries((fs.existsSync(폴더) ? fs.readdirSync(폴더) : [])
    .filter((f) => /^[A-Z]{2}\.json$/.test(f)).map((f) => [f.slice(0, 2), JSON.parse(fs.readFileSync(path.join(폴더, f), 'utf8'))]));
  const 줄 = [];
  const 필요 = { 다리: 0, 딱지: 0, 끝: 0 };
  for (const [키, d] of Object.entries(판들)) {
    const cps = 프로필.언어(d.lang).읽기속도?.초당글자;
    if (!(cps > 0)) throw new Error(`${키}: 언어 ${d.lang}의 읽기속도.초당글자가 없다`);
    for (const [id, [a, b]] of Object.entries(구간)) {
      const 글 = String(d[id] || '').trim();
      if (!글) continue;
      const 글자 = 자소수(글);
      const 드는 = 글자 / cps;
      줄.push({ 키, id, 언어: d.lang, 글자, 초당: cps, 필요: +드는.toFixed(3), 있음: +(b - a).toFixed(3), 글 });
      if (id === 'bridge') 필요.다리 = Math.max(필요.다리, 드는);
      if (id === 'real') 필요.딱지 = Math.max(필요.딱지, 드는);
      if (id === 'end') 필요.끝 = Math.max(필요.끝, 드는);
    }
  }
  // 필요는 올림(소수 셋째 자리) — 곡을 자르는 쪽이 이 값으로 길이를 정하므로 반올림으로 모자라지 않게
  const 올림 = (x) => Math.ceil(x * 1000 - 1e-6) / 1000;
  return { 줄, 넘침: 줄.filter((z) => z.필요 > z.있음 + 1e-9), 필요: { 다리: 올림(필요.다리), 딱지: 올림(필요.딱지), 끝: 올림(필요.끝) }, 구간 };
}

function 알림(r) {
  const out = r.넘침.map((z) => `  ${z.키} ${z.id} — 읽히는 ${z.있음}초에 ${z.글자}자, 읽는 데 ${z.필요}초(초당 ${z.초당}자): ${z.글.replace(/\n/g, ' / ')}`);
  return out.join('\n');
}

module.exports = { 재기, 화면구간, 알림, 다리나감, 끝들어옴 };

if (require.main === module) {
  const 인자 = process.argv.slice(2);
  const 편 = 인자.find((a) => !a.startsWith('--'));
  if (!편) { console.error('사용: node 읽기재기.cjs <편 폴더> [--json | --필요]'); process.exit(2); }
  const r = 재기(path.resolve(편));
  if (인자.includes('--필요')) { console.log(JSON.stringify(r.필요)); process.exit(0); }
  if (인자.includes('--json')) console.log(JSON.stringify({ 넘침: r.넘침, 필요: r.필요, 구간: r.구간 }, null, 1));
  else if (r.넘침.length) console.log(`읽기 시간이 모자라는 줄 ${r.넘침.length}개 — 곡을 다시 자르거나(편만들기.py --읽기 <편 폴더>) 글을 줄인다\n${알림(r)}`);
  else console.log(`읽기 시간 — 판본 ${new Set(r.줄.map((z) => z.키)).size}개 모두 넉넉하다(다리 글 가장 긴 것 ${r.필요.다리}초 · 끝 물음 ${r.필요.끝}초)`);
  process.exit(r.넘침.length ? 1 : 0);
}
