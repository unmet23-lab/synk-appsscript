// 관용구 퀴즈 #6(10-26) 현지어 검문 파일: 화면 글(문제 칸 + 연재 이름)과 게시글을 한국어 원문과 번호를 맞춰 「한국어 / --- / 번역」으로 쓴다.
//   node 검문파일_q6.mjs → ../게시/검문/mn.txt · zhs.txt · my.txt
//   → node tools/몽골어대조.js --파일 …/mn.txt --구독 · node tools/현지어대조.js --언어 "간체 중국어" --파일 …/zhs.txt · --언어 "버마어" --파일 …/my.txt
// 번역 칸은 정본(src/kids/i18n.ts의 MN 배열 · src/kids/locales.ts의 LOCALES)을 글로 읽어 쓴다(확장자 없는 import라 Node로 바로 못 불러옴). 게시글은 ../게시/문안.json.
// 화면 틀 글(ui)은 퀴즈 #2~#5에서 검문을 마쳐 연재 이름 한 줄만 넣는다. 해요체 읽는 법(say)은 한국어 발음 표기라 뺀다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, '..', '게시', '검문');
fs.mkdirSync(OUT, { recursive: true });
const 문안 = JSON.parse(fs.readFileSync(path.join(ROOT, '..', '게시', '문안.json'), 'utf8'));

// data.ts 순서(바람 · 별 · 해). [조각 둘, 오답, 보기 셋, 예문 풀이, 복습] — 일부러 글자 그대로 옮긴 칸은 그렇다고 적는다.
const Q_KO = [
  ['바람', '맞다(얻어맞다)', '바람에 얻어맞는다? (일부러 글자 그대로 옮긴 오답)', '감기에 걸린다', '만나기로 한 사람이 안 온다(헛되이 기다린다)', '머리가 헝클어진다', '두 시간이나 기다렸는데 그 사람이 안 왔어요!', '만나기로 한 사람이 안 왔다(헛되이 기다렸다)'],
  ['하늘의 별', '따기', '하늘에서 별을 딴다? (일부러 글자 그대로 옮긴 오답)', '밤을 좋아한다(몽골어판은 「아주 운이 좋다」)', '얻기가 아주 어렵다', '키가 아주 크다', '콘서트 표를 사는 건 정말 어려워요!', '아주 어렵다'],
  ['해가 서쪽에서', '뜨다(떠오르다)', '해가 서쪽에서 떠오른다? (일부러 옮긴 오답 — 간체 · 몽골어 · 버마어판은 그 나라에도 같은 굳은 말이 있어 「지구가 거꾸로 도나?」)', '늦잠을 잔다', '날씨가 나쁘다', '절대 일어나지 않는 일', '동생이 설거지를 했다고? 믿을 수 없어!', '절대 일어나지 않는 일'],
];
const flat = (t) => t.replace(/#\S+/g, '').replace(/\n+/g, ' / ').trim();

const write = (name, quizKo, quiz, qs, tail) => {
  const rows = [[quizKo, quiz]];
  qs.forEach((m, i) => {
    const [p0, p1, g, o0, o1, o2, gl, rc] = Q_KO[i];
    rows.push([p0, m.parts[0]], [p1, m.parts[1]], [g, m.guess], [o0, m.options[0]], [o1, m.options[1]], [o2, m.options[2]], [gl, m.gloss], [`(끝 화면 복습) ${rc}`, m.recap]);
  });
  rows.push(...tail);
  const ko = rows.map(([k], i) => `${i + 1}. ${k}`);
  const tr = rows.map(([, t], i) => `${i + 1}. ${t.replace(/\n/g, ' ')}`); // 화면 풀이의 줄 자리(줄바꿈)는 검문에선 띄어쓰기로
  fs.writeFileSync(path.join(OUT, name), `${ko.join('\n')}\n---\n${tr.join('\n')}\n`, 'utf8');
  console.log('검문 파일', rows.length, '줄 →', path.join(OUT, name));
};

// 몽골어(i18n.ts MN)
const i18n = fs.readFileSync(path.join(ROOT, 'src', 'kids', 'i18n.ts'), 'utf8');
const MN = Function(`return ${/const MN: [^=]+= (\[[\s\S]*?\n\]);/.exec(i18n)[1]}`)();
const mnQuiz = /exam: '(ХЭЛЦ ҮГ #\d+)'/.exec(i18n)[1];
write('mn.txt', '관용구 퀴즈 #6', mnQuiz, MN, [
  [`[게시글] ${flat(문안._ko.caption)}`, flat(문안.mn.caption)],
  [`[첫 댓글] ${문안._ko.comment}`, 문안.mn.comment],
]);

// 간체 · 버마어(locales.ts LOCALES) — RR(로마자)은 검문에서 빼므로 문자열로 바꿔 읽는다.
const loc = fs.readFileSync(path.join(ROOT, 'src', 'kids', 'locales.ts'), 'utf8').replace(/RR\[\d\]/g, "''");
const block = (code) => {
  const at = loc.indexOf(`  ${code}: {`);
  const q = loc.indexOf('    q: [', at);
  const end = loc.indexOf('\n    ],', q);
  const quiz = /quiz: '([^']+)'/.exec(loc.slice(at, q))[1];
  return { quiz, q: Function(`return ${loc.slice(loc.indexOf("[", q), end + 6).replace(/\/\*[\s\S]*?\*\//g, '')}`)() };
};
for (const [code, file, key] of [['zhs', 'zhs.txt', 'zhs'], ['my', 'my.txt', 'my']]) {
  const { quiz, q } = block(code);
  const c = 문안[key];
  write(file, '관용구 퀴즈 #6', quiz, q, [[c._ko, `${c.title ? `${c.title} / ` : ''}${flat(c.caption)}`]]);
}
