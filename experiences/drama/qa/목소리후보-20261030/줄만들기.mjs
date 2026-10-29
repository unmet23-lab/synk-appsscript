#!/usr/bin/env node
/**
 * 1화 두 역(교수 · 선배) 목소리 후보 굽기의 줄 목록(2026-10-30). 대본 정본 experiences/drama/s1/ep01.mjs에서 상대 인물 대사와 되묻기를 뽑아
 * 엔진마다 넣을 꼴로 쓴다 — 모든 후보가 같은 줄 · 같은 연기 지시를 읽게 하려고.
 *
 *   node 줄만들기.mjs <작업 폴더>     → <역>_줄.json(줄 · 지문 · 소리용 글) · <역>_eleven_<목소리>.json(--dialogue 인자) · <역>_inworld.txt
 *
 * - 소리용 글은 숫자를 읽는 말로 바꾼다(「3학년」 → 「삼 학년」). 화면 자막은 대본의 말 그대로다.
 * - 일레븐 v4 연기 꼬리표([warmly] 등)는 지문을 영어 꼬리표 하나로 옮긴 것이다. Inworld는 꼬리표 없이 줄을 이어 읽힌다.
 */
import fs from 'node:fs';
import path from 'node:path';
import ep01 from '../../s1/ep01.mjs';
import { 후보 } from './후보.mjs';

const 작업 = process.argv[2];
if (!작업) { console.error('쓰는 법: node 줄만들기.mjs <작업 폴더>'); process.exit(2); }
fs.mkdirSync(작업, { recursive: true });
// 지문 → 일레븐 꼬리표. 대본 줄 순서대로(되묻기 셋은 뒤에).
const 꼬리표 = {
 교수: ['[softly]', '[warmly]', '[warmly]', '[kindly]', '[firmly]', '[warmly]', '[curious]', '[gently]', '[reassuring]'],
 선배: ['[friendly]', '[laughs]', '[playfully]', '[playfully]', '[curious]', '[apologetic]', '[gently]'],
};
const 소리글 = (말) => 말.replace(/3학년/g, '삼 학년');

for (const 역 of ['교수', '선배']) {
 const 줄 = [
  ...ep01.촬영일.flatMap((d) => d.줄 || []).filter((l) => l.누가 === 역).map((l) => ({ 말: l.말, 지문: l.지문, 되묻기: false })),
  ...ep01.되묻기[역].map((말) => ({ 말, 지문: '테이크가 잘 안 들렸을 때 상대역이 연기로 되묻는다', 되묻기: true })),
 ].map((l, i) => ({ ...l, 번호: i + 1, 소리: 소리글(l.말), 꼬리표: 꼬리표[역][i] }));
 if (줄.length !== 꼬리표[역].length) throw new Error(`${역} 줄 ${줄.length}개인데 꼬리표 ${꼬리표[역].length}개`);
 fs.writeFileSync(path.join(작업, `${역}_줄.json`), JSON.stringify(줄, null, 1));
 for (const [이름, id] of Object.entries(후보[역].eleven)) {
  const 대화 = 줄.map((l) => ({ text: `${l.꼬리표} ${l.소리}`, voice_id: id, voice_type: 'preset' }));
  fs.writeFileSync(path.join(작업, `${역}_eleven_${이름}.json`), JSON.stringify(대화));
 }
 fs.writeFileSync(path.join(작업, `${역}_inworld.txt`), 줄.map((l) => l.소리).join('\n\n'));
 console.log(`${역}: 줄 ${줄.length}개 · 일레븐 ${Object.keys(후보[역].eleven).join('·')} · Inworld ${후보[역].inworld.join('·')} · OpenAI ${후보[역].openai.join('·')}`);
}
