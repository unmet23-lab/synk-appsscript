#!/usr/bin/env node
/**
 * 말 랠리 캠퍼스 판(2026-11-04) — 태오 목소리 굽기. 상대가 몽글(여성 합성 음성)에서 태오로 바뀌어 문항 47줄(연습 포함) · 반응 넷 · 안내 여덟을
 * 드라마 1화와 같은 배역 목소리(힉스필드 일레븐 v4 Julian, stability 0.5, 줄마다 연기 꼬리표 하나 — 결정 10-30)로 새로 굽는다. 문항 글은 그대로다.
 *
 * 값: 일레븐 v4는 글자 수(꼬리표 포함)로 매긴다 — 접수 한 번에 최소 0.23, 꼬리표가 짧은 열두 줄은 1.15, 「천천히 또박또박」을 붙인 열두 줄은 2.30(11-04 실측)이라
 * 열두 줄씩 다섯 묶음(약 10크레딧)으로 읽히고 받아쓰기 낱말 시각으로 줄마다 자른다(드라마 목소리후보 나누기.py와 같은 방법 — 목소리나누기.py).
 *
 *   node 목소리굽기.mjs 준비          # 밖/voice/묶음-N.json(대사 배열) · 묶음-N.줄.json(id · 글)
 *   bash 목소리내기.sh [N…]           # founder 계정으로 접수 → 기다림 → 받기(받은 묶음은 다시 내지 않음)
 *   python -I -X utf8 목소리나누기.py  # 줄마다 잘라 assets/world/cast/taeo/voice/<id>.mp3(−18 LUFS · 24kHz 모노 96k, 앞뒤 무음 자름) + 받아쓰기 대조
 */
import fs from 'node:fs';
import path from 'node:path';
import { ITEMS, PRACTICE } from '../../content.mjs';
import { REACT, NARRATION_WORLD, NARRATION_FILE_ID, tagFor } from '../../world-lines.mjs';
import { 밖 } from './경로.mjs';

export const JULIAN = '95429266-c0ac-4137-a209-63b8812b0f23';
const 묶음크기 = 12;
const 폴더 = path.join(밖, 'voice');

/** 굽는 줄 전부: 문항(연습 포함) → 반응 → 안내. 파일 이름은 게임이 부르는 이름 그대로. */
export function 줄들() {
  const out = [PRACTICE, ...ITEMS].map((x) => ({ id: x.id, 파일: `${x.id}.mp3`, 글: x.line, 꼬리표: tagFor(x), 문항: true }));
  for (const [k, v] of Object.entries(REACT)) out.push({ id: `react-${k}`, 파일: `react-${k}.mp3`, 글: v.text, 꼬리표: v.tag });
  for (const [k, v] of Object.entries(NARRATION_WORLD)) out.push({ id: `nar-${NARRATION_FILE_ID[k]}`, 파일: `nar-${NARRATION_FILE_ID[k]}.mp3`, 글: v.text, 꼬리표: v.tag });
  return out;
}

if (process.argv[2] === '준비') {
  fs.mkdirSync(폴더, { recursive: true });
  const 모두 = 줄들(), 문항 = 모두.filter((x) => x.문항), 그밖 = 모두.filter((x) => !x.문항);
  // 문항은 열두 줄씩, 반응 · 안내는 한 묶음으로(목소리 결이 비슷한 것끼리)
  const 묶음 = [];
  for (let i = 0; i < 문항.length; i += 묶음크기) 묶음.push(문항.slice(i, i + 묶음크기));
  묶음.push(그밖);
  묶음.forEach((줄, n) => {
    // 문항은 「천천히 또박또박」을 앞에 붙인다: 꼬리표만 주면 초당 6~7음절로 원래 몽글 음성(약 5.1)보다 25% 빨랐고, 붙이면 평균 약 4.5(11-04 시험 묶음).
    // 반응 · 안내는 문항이 아니라 자연스러운 빠르기 그대로.
    const 대사 = 줄.map((x) => ({ text: `[${x.문항 ? 'slowly and clearly, ' : ''}${x.꼬리표}] ${x.글}`, voice_id: JULIAN, voice_type: 'preset' }));
    fs.writeFileSync(path.join(폴더, `묶음-${n + 1}.json`), JSON.stringify(대사));
    fs.writeFileSync(path.join(폴더, `묶음-${n + 1}.줄.json`), JSON.stringify(줄, null, 1));
    console.log(`묶음-${n + 1}: ${줄.length}줄 · ${줄.reduce((s, x) => s + [...x.글].length, 0)}자`);
  });
}
