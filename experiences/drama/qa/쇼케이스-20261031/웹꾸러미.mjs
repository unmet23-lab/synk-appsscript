// 쇼케이스 영상 네 컷을 PULSE 시댄스 무제한 날 꾸러미 형식(웹올리기_*: 판 폴더 = 1_시작 · 2_끝 · 소리 + 지시문.txt, 꾸러미 _순서.json)으로 만든다(2026-11-02).
// 유호님 「무제한에 붙여」 — 같은 구매권으로 GPT 작업자가 내고, 받기 뒤 검수 · 편집은 Claude. 지시문 본문은 지시문.mjs 그대로이고,
// 웹 꼴에 맞춰 머리에 「@이미지 1 … first frame · @이미지 2 … last frame」을 붙이고 「The audio reference」를 「@오디오 1」로 부른다.
// 체험판 듣는 반복 둘(반복6 · 반복7)은 C2 · C4 영상의 이음 프레임이 시작 그림이라 받은 뒤에 따로 만든다.
//   node 웹꾸러미.mjs [--확인]   → synk-vendor/pulse-seedance-day-20261028/웹올리기_쇼케이스/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '../../../..');
const 꾸러미 = path.join(os.homedir(), 'Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기_쇼케이스');
const 그림 = path.join(os.homedir(), 'Documents/synk-vendor/drama-showcase-20261031/시작끝_덧니선배');
const 소리 = path.join(뿌리, '.tmp/drama-webtoon-20261030/쇼케이스/소리'); // ref-C1 · C2(S39 그대로) · C3(모범 6에서 끝 「요」를 3.50초에서 자름) · C4
const 확인만 = process.argv.includes('--확인');

// 11-02 밤: 두 사람 목소리 판(C3 · C2 · C4)이 셋 다 힉스필드 「nsfw」로 거절됐다(0크레딧). 한 사람 판 C1만 통과 — 거절 판에만
// 「a young woman off-camera — the freshman」과 「the freshman's body」가 함께 있어 나이 어린 사람으로 오해된 것으로 보고, 둘 다 성인 대학생이라는
// 사실을 분명히 쓰고 「body」를 뺀 판(b)을 낸다. 장면 · 대사 · 동작은 그대로다. C4b로 먼저 시험한다.
const 판 = [
  { id: 'sc-C1', 컷: 'C1', 길이: 8, 시작: 'C1_시작.png', 끝: 'C1_끝.png' },
  { id: 'sc-C3', 컷: 'C3', 길이: 8, 시작: 'C3C2_시작.png', 끝: 'C3_끝.png' },
  { id: 'sc-C2', 컷: 'C2', 길이: 14, 시작: 'C3C2_시작.png', 끝: 'C2_끝.png' },
  { id: 'sc-C4', 컷: 'C4', 길이: 15, 시작: 'C4_시작.png', 끝: 'C4_끝.png' },
  { id: 'sc-C4b', 컷: 'C4', 길이: 15, 시작: 'C4_시작.png', 끝: 'C4_끝.png', 성인: true },
  { id: 'sc-C3b', 컷: 'C3', 길이: 8, 시작: 'C3C2_시작.png', 끝: 'C3_끝.png', 성인: true },
  { id: 'sc-C2b', 컷: 'C2', 길이: 14, 시작: 'C3C2_시작.png', 끝: 'C2_끝.png', 성인: true },
  // 체험판 듣는 반복(11-03): 받은 C2b의 「한참」 끝 3.62초 · C4b의 「아세요?」 뒤 6.80초 프레임을 시작이자 끝 그림으로, 소리 끔
  { id: 'sc-L6', 컷: '반복6', 길이: 4, 시작: 'L6_이음.png', 끝: 'L6_이음.png', 성인: true, 소리없음: true },
  { id: 'sc-L7', 컷: '반복7', 길이: 4, 시작: 'L7_이음.png', 끝: 'L7_이음.png', 성인: true, 소리없음: true },
];
const 성인말 = [
  ['a young woman off-camera — the freshman —', 'a female university student in her twenties, off-camera — an adult classmate who just started at this university —'],
  ["No part of the freshman's body is in the frame — only her own lunch tray at the bottom edge.", 'The other student is never shown — only her lunch tray at the bottom edge.'],
  ['He has just spotted the freshman at the table', 'He has just spotted the new student at the table'],
];
const 성인으로 = (t) => {
  let s = t;
  for (const [a, b] of 성인말) s = s.split(a).join(b);
  s = s.replace(/\bthe freshman\b/g, 'the new student');
  const 남은 = s.match(/freshman|young woman|her (?:own )?body/i); // 「his upper body」(태오 동작)는 그대로 둔다
  if (남은) throw new Error(`성인 판에 남은 말: ${남은[0]}`);
  return `Both people are adult university students in their twenties.\n${s}`;
};
const 머리 = '@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance, same people, faces, hair and clothes. @이미지 2 is the exact last frame: the shot arrives at exactly that moment at the very end.';

const 순서 = [];
판.forEach((p, i) => {
  const 본문 = execFileSync('node', [path.join(여기, '지시문.mjs'), '보기', p.컷], { encoding: 'utf8' }).trim();
  if (!p.소리없음 && !본문.includes('The audio reference')) throw new Error(`${p.컷}: 소리 참고 문장이 없다`);
  const 몸 = 본문.replace('The audio reference', '@오디오 1, the audio reference,');
  const 지시문 = `${머리}\n${p.성인 ? 성인으로(몸) : 몸}`;
  const 폴더 = `${String(i + 1).padStart(3, '0')}_${p.id}`;
  const 파일 = p.소리없음 ? ['1_시작.jpg', '2_끝.jpg'] : ['1_시작.jpg', '2_끝.jpg', '3_소리참고.mp3'];
  const 소리파일 = p.소리없음 ? null : path.join(소리, `ref-${p.컷}.mp3`);
  for (const f of [path.join(그림, p.시작), path.join(그림, p.끝), 소리파일].filter(Boolean)) if (!fs.existsSync(f)) throw new Error(`없음: ${f}`);
  const 소리초 = 소리파일 ? Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 소리파일], { encoding: 'utf8' })) : 0;
  if (소리초 > p.길이) throw new Error(`${p.컷}: 소리 참고 ${소리초}초가 판 길이 ${p.길이}초보다 길다`);
  순서.push({ 순서: i + 1, id: p.id, 편: 'sc', 컷: [p.컷], 폴더, 길이: p.길이, 비율: '9:16', 소리: p.소리없음 ? '끔' : '켬', 묶음: false, 대안: false, 방식: p.소리없음 ? '한 샷 · 시작/끝 그림(같은 그림) · 소리 끔' : '한 샷 · 시작/끝 그림 + 소리 참고', 낱판: [], 쓰는초: null, 파일, '빠진 파일': [], '지시문 머리': 지시문.slice(0, 160), '지시문 글자 수': 지시문.length });
  console.log(`${폴더} · ${p.길이}초 · 소리 ${소리초.toFixed(2)}초 · 지시문 ${지시문.length}자`);
  if (확인만) return;
  const d = path.join(꾸러미, 폴더);
  fs.mkdirSync(d, { recursive: true });
  // 웹 올리기는 JPEG — PNG 원본을 긴 변 그대로 품질 2로 옮긴다(후보정 없음)
  for (const [src, dst] of [[p.시작, '1_시작.jpg'], [p.끝, '2_끝.jpg']]) execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', path.join(그림, src), '-q:v', '2', path.join(d, dst)]);
  if (소리파일) fs.copyFileSync(소리파일, path.join(d, '3_소리참고.mp3'));
  fs.writeFileSync(path.join(d, '지시문.txt'), 지시문);
});
if (!확인만) fs.writeFileSync(path.join(꾸러미, '_순서.json'), JSON.stringify(순서, null, 1));
