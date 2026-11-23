'use strict';
// ③ life-ui.mjs — 라이브 종이 겉(7386af758 · 830ab084e)과 겹친 다섯 덩이를 푼다(설계 주인 11-24: 종이 겉을 바탕으로 ③의 뜻을 얹는다).
//   node resolve-life-ui.cjs <diff3 합침 파일(검수후보 | 라이브7dd | 라이브830)> <쓸 파일>
// 덩이마다 모양을 확인하고, 다르면 멈춘다.
//   1 닫기: dispose 줄은 라이브(날던 말 거두기), 다음 줄은 ③(GA1 keepFocus 되돌리기).
//   2 포스터 앞: 종이 겉 kicker 상수 + ③ 포스터 함수 묶음. ③ 포스터 다섯의 라벨 뒤에 kicker를 넣는다(종이 겉은 영문 라벨을 숨기고 kicker를 보인다).
//   3 nowPoster 몸통: ③(포스터 함수 부름 — kicker는 함수 안에 들었다).
//   4 packs 그리기: 라이브의 화면 언어 칸 이름(is-text) + ③의 reviewMark · 다시 그리기 선택.
//   5 stories · pack 머리: stories 줄은 라이브의 칸 이름, pack 머리 두 줄은 ③({again} · 확인 중 복습).
const fs = require('node:fs');
const [IN, OUT] = process.argv.slice(2);
const src = fs.readFileSync(IN, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const lines = src.split(nl);
const blocks = [];
const out = [];
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].startsWith('<<<<<<< ')) { out.push(lines[i]); continue; }
  const ours = [], base = [], theirs = [];
  let j = i + 1;
  for (; !lines[j].startsWith('||||||| '); j++) ours.push(lines[j]);
  for (j++; lines[j] !== '======='; j++) base.push(lines[j]);
  for (j++; !lines[j].startsWith('>>>>>>> '); j++) theirs.push(lines[j]);
  blocks.push({ ours, base, theirs, at: out.length });
  out.push(`@@덩이${blocks.length}@@`);
  i = j;
}
if (blocks.length !== 5) throw Error(`덩이 ${blocks.length}개 — 5개여야 한다`);
const must = (ok, why) => { if (!ok) throw Error(why); };
const res = [];
{ // 1
  const { ours, base, theirs } = blocks[0];
  must(ours.length === 2 && base.length === 2 && theirs.length === 2, '덩이1 줄 수');
  must(ours[0] === base[0] && theirs[1] === base[1], '덩이1: ③은 둘째 줄만, 라이브는 첫째 줄만 바꿨어야 한다');
  must(theirs[0].includes("panel.querySelectorAll?.('.life-ghost')") && ours[1].includes('refocus(keepFocus)'), '덩이1 모양');
  res.push([theirs[0], ours[1]]);
}
{ // 2
  const { ours, base, theirs } = blocks[1];
  must(base.length === 0 && theirs.length === 2 && theirs[1].includes('const kicker=()=>'), '덩이2: 라이브는 kicker 상수만 더했어야 한다');
  const opener = '<small class="life-poster-label">';
  let n = 0;
  const withKicker = ours.map(line => {
    let at = 0, s = line;
    for (;;) {
      const k = s.indexOf(opener, at); if (k < 0) break;
      const close = s.indexOf('</small>', k); must(close > 0, '덩이2 라벨 닫힘');
      s = s.slice(0, close + 8) + '${kicker()}' + s.slice(close + 8); n++; at = close + 8 + 11;
    }
    return s;
  });
  must(n === 5, `덩이2: ③ 포스터 라벨 ${n}개 — 다섯(lesson · resume · review · today · rest)이어야 한다`);
  res.push([...theirs, ...withKicker]);
}
{ // 3
  const { ours, base, theirs } = blocks[2];
  must(ours.length === 3 && ours[0].includes('return lessonPoster(') && ours[2].includes('return restPoster(s,day)'), '덩이3 ③ 모양');
  must(theirs.join('').split('${kicker()}').length - 1 === 3 && base.join('').split('${kicker()}').length === 1, '덩이3: 라이브는 틀 셋에 kicker만 넣었어야 한다');
  must(theirs.join('\n').replaceAll('${kicker()}', '') === base.join('\n'), '덩이3: 라이브의 변경이 kicker 말고도 있다');
  res.push(ours);
}
{ // 4
  const { ours, base, theirs } = blocks[3];
  must(ours.length === 1 && base.length === 1 && theirs.length === 1, '덩이4 줄 수');
  const tail = "`,{screen:'packs',...(again?{keepScroll:true,focus:null,keepFocus:focusedKey()}:{})});}";
  must(ours[0].startsWith('  reviewMark=reviewSign(s);paint(') && ours[0].endsWith(tail), '덩이4 ③ 모양');
  must(('  reviewMark=reviewSign(s);' + base[0].slice(2)).replace(/`\);\}$/, tail) === ours[0], '덩이4: ③의 변경이 머리 · 꼬리 말고도 있다');
  must(theirs[0].startsWith('  paint(') && theirs[0].endsWith('`);}'), '덩이4 라이브 모양');
  res.push([('  reviewMark=reviewSign(s);' + theirs[0].slice(2)).replace(/`\);\}$/, tail)]);
}
{ // 5
  const { ours, base, theirs } = blocks[4];
  must(ours.length === 3 && base.length === 3 && theirs.length === 3, '덩이5 줄 수');
  must(ours[0] === base[0] && theirs[1] === base[1] && theirs[2] === base[2], '덩이5: ③은 pack 두 줄만, 라이브는 stories 줄만 바꿨어야 한다');
  res.push([theirs[0], ours[1], ours[2]]);
}
const final = out.flatMap(line => { const m = /^@@덩이(\d)@@$/.exec(line); return m ? res[Number(m[1]) - 1] : [line]; }).join(nl);
must(!/^(<{7}|={7}|>{7}|\|{7})( |$)/m.test(final), '겹침 표시가 남았다');
fs.writeFileSync(OUT, final);
console.log(`덩이 5 풂 · kicker 넣은 ③ 포스터 5 · ${OUT}`);
