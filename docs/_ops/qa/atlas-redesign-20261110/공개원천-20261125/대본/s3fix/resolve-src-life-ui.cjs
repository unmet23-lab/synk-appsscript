'use strict';
// ③ 원천 experiences/synk-world-app/life-ui.mjs를 origin(종이 겉 · 카페 팩 뒤)에 얹을 때 겹친 두 덩이를 푼다(설계 주인 11-24: 종이 겉 바탕 위에 ③의 뜻).
// 두 덩이 모두 origin은 포스터 꼬리표(<small class="life-poster-label">…</small>) 뒤에 ${kicker()}만 더했고, ③은 그 포스터를 고쳤다 → ③ 줄의 꼬리표 뒤에 kicker.
const fs = require('node:fs');
const [IN, OUT] = process.argv.slice(2);
const lines = fs.readFileSync(IN, 'utf8').split('\n');
const must = (ok, why) => { if (!ok) throw Error(why); };
const out = []; let 덩이 = 0, 넣음 = 0;
const opener = '<small class="life-poster-label">';
const 끼움 = l => { let s = l, at = 0; for (;;) { const k = s.indexOf(opener, at); if (k < 0) return s; const c = s.indexOf('</small>', k); must(c > 0, '꼬리표 닫힘'); s = s.slice(0, c + 8) + '${kicker()}' + s.slice(c + 8); 넣음++; at = c + 8 + 11; } };
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].startsWith('<<<<<<< mine')) { out.push(lines[i]); continue; }
  const mine = [], base = [], origin = []; let j = i + 1;
  for (; !lines[j].startsWith('||||||| base'); j++) mine.push(lines[j]);
  for (j++; lines[j] !== '======='; j++) base.push(lines[j]);
  for (j++; !lines[j].startsWith('>>>>>>> origin'); j++) origin.push(lines[j]);
  덩이++;
  must(origin.length === base.length && origin.every((l, k) => l.replaceAll('${kicker()}', '') === base[k]) && origin.join('').includes('${kicker()}'), `덩이${덩이}: origin은 kicker만 더했어야 한다`);
  must(!mine.join('').includes('${kicker()}'), `덩이${덩이}: ③ 줄에 이미 kicker가 있다`);
  out.push(...mine.map(끼움)); i = j;
}
must(덩이 === 2, `덩이 ${덩이}개 — 2개여야 한다`);
const final = out.join('\n');
must(!/^(<{7}|={7}|>{7}|\|{7})( |$)/m.test(final), '겹침 표시가 남았다');
fs.writeFileSync(OUT, final); console.log(`덩이 2 풂 · kicker ${넣음}곳`);
