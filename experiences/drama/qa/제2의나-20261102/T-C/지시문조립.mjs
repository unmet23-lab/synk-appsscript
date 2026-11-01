#!/usr/bin/env node
/**
 * 「제2의 나」 T-C(내 모습) 굽기 지시문 조립 (2026-11-02) — 얼굴 조각마다 학생증 · 셀카 두 장의 지시문을
 * 공통 줄 + 조각 줄 + 본문으로 붙여 공용 작업본 `.tmp/me2-20261102/T-C/지시문/<조각>-<종류>.txt`로 쓴다.
 * 엔진은 GPT 이미지 2.5(Codex 구독, 같은 폴더 `굽기.cjs`) 하나라 맨 앞에 「그림 도구로 한 장만」 머리말을 붙인다.
 * 원고는 .md다 — 저장소 .gitignore가 qa 아래 .txt를 뺀다(카페 0단계와 같음).
 *
 *   node experiences/drama/qa/제2의나-20261102/T-C/지시문조립.mjs [조각…]   (조각이 없으면 넷 모두)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
export const 밖뿌리 = process.env.ME2_TC_OUT || path.join(공용작업본(뿌리), '.tmp', 'me2-20261102', 'T-C');
const 읽기 = (f) => fs.readFileSync(path.join(여기, '지시문', `${f}.md`), 'utf8').trim();

export const 조각들 = ['mn-m', 'mn-f', 'vn-f', 'uz-m'];
// 종류 → 붙일 줄(순서대로). 「조각」 자리에 조각_<이름>.md가 들어간다.
export const 짜임 = {
  id: ['_공통_머리', '학생증', '조각', '_공통_빛결_증명', '_공통_규칙'],
  selfie: ['_공통_머리', '셀카', '조각', '_공통_태오', '_공통_빛결_셀카', '_공통_계절', '_공통_규칙'],
};

const 고를것 = process.argv.slice(2).length ? process.argv.slice(2) : 조각들;
fs.mkdirSync(path.join(밖뿌리, '지시문'), { recursive: true });
for (const 조각 of 고를것) {
  if (!조각들.includes(조각)) throw new Error('없는 조각: ' + 조각);
  for (const [종류, 줄] of Object.entries(짜임)) {
    const 글 = 줄.map((k) => 읽기(k === '조각' ? `조각_${조각}` : k)).join('\n\n') + '\n';
    const 낼 = path.join(밖뿌리, '지시문', `${조각}-${종류}.txt`);
    fs.writeFileSync(낼, 글);
    console.log(`[조립] ${조각}-${종류} → ${낼} (${글.length}자)`);
  }
}
