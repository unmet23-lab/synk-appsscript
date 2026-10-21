// 관용구 퀴즈 #5(10-21) 몽골어 검문 파일: 화면 글(문제 칸 + 연재 이름)과 게시글·댓글을 한국어 원문과 번호를 맞춰 「한국어 / --- / 몽골어」로 쓴다.
//   node 검문파일_q5.mjs → ../게시/검문/mn.txt → node tools/몽골어대조.js --파일 …/mn.txt --구독
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

// data.ts 순서(파리 · 개구리 · 고양이). [조각 둘, 오답, 보기 셋, 예문 풀이, 복습]
const Q_KO = [
  ['파리', '날리다(날게 하다)', '파리를 날린다? (일부러 글자 그대로 옮긴 오답)', '벌레를 잡는다', '손님이 없다', '방이 더럽다', '비가 와서 가게에 손님이 하나도 없어요!', '손님이 없다'],
  ['우물 안', '개구리', '우물에 있는 개구리? (일부러 글자 그대로 옮긴 오답)', '수영을 잘한다', '비를 좋아한다', '세상 경험이 없다', '여행을 해 보고서야 내가 세상을 얼마나 모르는지 알았어요!', '세상 경험이 없다'],
  ['고양이', '세수하듯(얼굴을 씻듯)', '고양이가 얼굴을 씻듯? (일부러 글자 그대로 옮긴 오답)', '얼굴에 물만 묻힌다', '물을 무서워한다', '생선을 좋아한다', '늦잠을 자서 얼굴에 물만 묻혔어요!', '얼굴에 물만 묻힌다'],
];

const rows = [['관용구 퀴즈 #5', quiz]];
MN.forEach((m, i) => {
  const [p0, p1, g, o0, o1, o2, gl, rc] = Q_KO[i];
  rows.push([p0, m.parts[0]]); // 퀴즈 #5는 문제마다 첫 조각이 다르다
  rows.push([p1, m.parts[1]], [g, m.guess], [o0, m.options[0]], [o1, m.options[1]], [o2, m.options[2]], [gl, m.gloss], [`(끝 화면 복습) ${rc}`, m.recap]);
});
const flat = (t) => t.replace(/#\S+/g, '').replace(/^.*[가-힣].*·.*$/gm, '').replace(/\n+/g, ' / ').trim();
rows.push([`[게시글] ${flat(문안._ko.caption)}`, flat(문안.mn.caption)]);
rows.push([`[첫 댓글] ${문안._ko.comment}`, 문안.mn.comment]);

const ko = rows.map(([k], i) => `${i + 1}. ${k}`);
const mn = rows.map(([, t], i) => `${i + 1}. ${t}`);
fs.writeFileSync(path.join(OUT, 'mn.txt'), `${ko.join('\n')}\n---\n${mn.join('\n')}\n`, 'utf8');
console.log('검문 파일', rows.length, '줄 →', path.join(OUT, 'mn.txt'));

// 현지어판(간체·버마어)은 이 편에서 만들지 않았다(locales.ts는 퀴즈 #4 내용) — 만들면 퀴즈 #4의 검문파일_q4.mjs 아랫부분을 가져온다.
