// 관용구 퀴즈 #4(10-20) 몽골어 검문 파일: 화면 글(문제 칸 + 연재 이름)과 게시글·댓글을 한국어 원문과 번호를 맞춰 「한국어 / --- / 몽골어」로 쓴다.
//   node 검문파일_q4.mjs → ../게시/검문/mn.txt → node tools/몽골어대조.js --파일 …/mn.txt --구독
// 몽골어 칸은 정본 src/kids/i18n.ts의 MN 배열을 글로 읽어 쓴다(i18n.ts는 확장자 없는 import라 Node로 바로 못 불러옴). 게시글은 ../게시/문안.json.
// 화면 틀 글(ui)은 퀴즈 #2·#3에서 검문을 마쳐 연재 이름 한 줄만 넣는다. 해요체 읽는 법(say)은 한국어 발음 표기라 뺀다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, '..', '게시', '검문');
fs.mkdirSync(OUT, { recursive: true });

const src = fs.readFileSync(path.join(ROOT, 'src', 'kids', 'i18n.ts'), 'utf8');
const body = /const MN: [^=]+= (\[[\s\S]*?\n\]);/.exec(src)[1];
const MN = Function(`return ${body}`)();
const quiz = /exam: '(ХЭЛЦ ҮГ #\d+)'/.exec(src)[1];
const 문안 = JSON.parse(fs.readFileSync(path.join(ROOT, '..', '게시', '문안.json'), 'utf8'));

// data.ts 순서(콩알 · 떨어지다 · 크다). [조각 둘, 오답, 보기 셋, 예문 풀이, 복습]
const Q_KO = [
  ['간', '콩알처럼(콩알만 해지다)', '간이 콩알이 된다? (일부러 글자 그대로 옮긴 오답)', '몸이 아프다', '매우 겁이 나다', '콩을 좋아한다', '할머니 꽃병을 깼어요. 너무 무서워요! (몽골어는 「혼이 빠지도록 무서웠다」 관용 표현으로)', '매우 겁이 나다'],
  ['간', '떨어지다', '간이 떨어진다? (일부러 글자 그대로 옮긴 오답)', '잠이 든다', '음식을 떨어뜨린다', '매우 놀라다', '천둥소리에 깜짝 놀랐어요! (몽골어는 「심장이 입으로 튀어나올 뻔했다」 관용 표현으로)', '매우 놀라다'],
  ['간', '크다', '큰 간? (일부러 글자 그대로 옮긴 오답)', '겁이 없다', '키가 아주 크다', '많이 먹는다', '혼자 공포 영화를 봐요? 정말 용감하네요!', '겁이 없다'],
];

const rows = [['관용구 퀴즈 #4', quiz]];
MN.forEach((m, i) => {
  const [p0, p1, g, o0, o1, o2, gl, rc] = Q_KO[i];
  if (i === 0) rows.push([p0, m.parts[0]]);
  rows.push([p1, m.parts[1]], [g, m.guess], [o0, m.options[0]], [o1, m.options[1]], [o2, m.options[2]], [gl, m.gloss], [`(끝 화면 복습) ${rc}`, m.recap]);
});
const flat = (t) => t.replace(/#\S+/g, '').replace(/^.*[가-힣].*·.*$/gm, '').replace(/\n+/g, ' / ').trim();
rows.push([`[게시글] ${flat(문안._ko.caption)}`, flat(문안.mn.caption)]);
rows.push([`[첫 댓글] ${문안._ko.comment}`, 문안.mn.comment]);

const ko = rows.map(([k], i) => `${i + 1}. ${k}`);
const mn = rows.map(([, t], i) => `${i + 1}. ${t}`);
fs.writeFileSync(path.join(OUT, 'mn.txt'), `${ko.join('\n')}\n---\n${mn.join('\n')}\n`, 'utf8');
console.log('검문 파일', rows.length, '줄 →', path.join(OUT, 'mn.txt'));

// 현지어판(간체·버마어): 화면 글은 정본 src/kids/locales.ts, 게시글은 문안.json. → node tools/현지어대조.js --언어 버마어 --파일 …/my.txt · --언어 "중국어(간체)" --파일 …/zhs.txt
const { LOCALES } = await import('./src/kids/locales.ts');
const LOC_KO = [
  ['간', '콩알만큼(콩알만 해지다)', '간이 콩알만큼 줄어든다? (일부러 글자 그대로 옮긴 오답)', '몸이 아프다', '아주 무섭다', '콩을 좋아한다', '할머니 꽃병을 깼어요. 너무 무서워요!', '아주 무섭다'],
  ['간', '떨어지다', '간이 떨어진다? (일부러 글자 그대로 옮긴 오답)', '잠이 들었다', '음식이 떨어졌다', '깜짝 놀랐다', '천둥소리에 깜짝 놀랐어요!', '깜짝 놀랐다'],
  ['간', '크다', '간이 크다? (일부러 글자 그대로 옮긴 오답)', '겁이 없다(용기 있다)', '키가 크다', '많이 먹는다', '혼자 공포 영화를 봐요? 정말 용감하네요!', '겁이 없다'],
];
for (const [code, key] of [['my', 'my'], ['zhs', 'zhs']]) {
  const L = LOCALES[code];
  const r = [['관용구 퀴즈 #4', L.ui.quiz]];
  L.q.forEach((m, i) => {
    const [p0, p1, g, o0, o1, o2, gl, rc] = LOC_KO[i];
    if (i === 0) r.push([p0, m.parts[0]]);
    r.push([p1, m.parts[1]], [g, m.guess], [o0, m.options[0]], [o1, m.options[1]], [o2, m.options[2]], [gl, m.gloss], [`(끝 화면 복습) ${rc}`, m.recap]);
  });
  const t = 문안[key];
  r.push([t._ko, flat(`${t.title ? `${t.title}\n` : ''}${t.caption}`)]);
  fs.writeFileSync(path.join(OUT, `${code}.txt`), `${r.map(([k], i) => `${i + 1}. ${k}`).join('\n')}\n---\n${r.map(([, v], i) => `${i + 1}. ${v}`).join('\n')}\n`, 'utf8');
  console.log('검문 파일', code, r.length, '줄');
}
