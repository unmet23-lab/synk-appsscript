#!/usr/bin/env node
/**
 * 「제2의 나」 나이 맞추기 작은 시험 (2026-11-03, 유호님 「나이 시험도 해」) — 지시문 조립.
 *
 * 묻는 것: 학습자는 10대부터 50대까지인데 이야기는 대학 1학년이라, 기준 사진은 올린 사람 나이와 상관없이 19~20살쯤으로 맞춘다(`지시문/_젊게.md`).
 * 30 · 40 · 50대가 올린 평범한 셀카에서도 ① 열아홉 살쯤으로 보이나 ② 그래도 같은 사람으로 남나.
 * 대역은 지어낸 사람 셋(36세 베트남 여 · 45세 우즈베크 남 · 52세 몽골 여). 10대 대역은 미성년 얼굴을 실사로 만들게 되어 넣지 않는다.
 * 엔진은 기준 사진과 같은 GPT 이미지 2.5(`T-C/굽기.cjs`, ChatGPT 구독 · 현금 0) — 대역 셀카도 같은 엔진(Gemini 줄을 기다리지 않게).
 *
 *   node experiences/drama/qa/제2의나-20261102/사진시험/나이조립.mjs   → .tmp/me2-20261102/photo-gpt/나이/<id>.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 밖 = path.join(공용작업본(뿌리), '.tmp', 'me2-20261102', 'photo-gpt', '나이');
const 읽기 = (이름) => fs.readFileSync(path.join(여기, '지시문', `${이름}.md`), 'utf8').trim();

export const 대역 = [
  { id: 'a36', 옷: 'Clothes: a soft olive-green crew-neck sweatshirt.',
    셀카: 'PHOTOREAL SMARTPHONE SELFIE, vertical 3:4, the kind of everyday selfie someone would upload to an app. A Vietnamese woman of about 36; an original person with an ordinary everyday face, not model-like: an oval face with slightly full cheeks, dark-brown eyes with soft double eyelids and faint crow\'s feet, fine smile lines, light freckle-like sun spots on the cheekbones, thin brows, a small rounded nose. Shoulder-length black hair in a simple low ponytail. Beige office blouse. Taken at arm\'s length with the front camera in a parked car at midday — flat daylight through the windscreen, a little wide-angle distortion. A tired, friendly closed-mouth smile. No makeup beyond a little lip colour; no beauty filter.' },
  { id: 'a45', 옷: 'Clothes: a plain grey crew-neck sweatshirt.',
    셀카: 'PHOTOREAL SMARTPHONE SELFIE, vertical 3:4, the kind of everyday selfie someone would upload to an app. An Uzbek man of about 45; an original person with an ordinary everyday face, not model-like: a broad face with heavier cheeks and a soft double chin, deep-set brown eyes with lines at the corners, thick dark brows with a few grey hairs, a straight nose, a neat dark moustache with some grey, visible forehead lines. Short dark hair, receding a little at the temples, grey at the sides. White work shirt. Taken at arm\'s length with the front camera in a small office under fluorescent light, slightly from below. A polite half-smile. No beauty filter.' },
  { id: 'a52', 옷: 'Clothes: a soft lilac knit cardigan over a white T-shirt.',
    셀카: 'PHOTOREAL SMARTPHONE SELFIE, vertical 3:4, the kind of everyday selfie someone would upload to an app. A Mongolian woman of about 52; an original person with an ordinary everyday face, not model-like: a round face with broad cheekbones and rosy, weathered cheeks, monolid dark eyes with crow\'s feet and slight hooding, thin brows, a low nose bridge, deeper smile lines, a few age spots. Chin-length black hair with grey strands at the temples, simply combed. Dark-red knit sweater. Taken at arm\'s length with the front camera at home in the kitchen in the evening under a warm ceiling lamp. A warm, shy smile. No makeup; no beauty filter.' },
];

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.mkdirSync(밖, { recursive: true });
  for (const d of 대역) {
    fs.writeFileSync(path.join(밖, `up-${d.id}.txt`), `${d.셀카}\n${읽기('_규칙')}\n`);
    for (const lv of ['약', '강', '강+']) {
      // 강+ = 강 + 「열아홉 얼굴」 한 단락(Fable 11-03 — 30대 이상으로 읽히는 올림은 강으로도 20대 중후반에 머묾 · 콧수염 · 포즈가 흔들림)
      const 글 = [읽기('_기준_머리'), d.옷, 읽기(`_보정_${lv.replace('+', '')}`), 읽기('_젊게'), ...(lv === '강+' ? [읽기('_나이_더')] : []), 읽기('_기준_순간'), 읽기('_기준_빛결'), 읽기('_규칙')].join('\n');
      fs.writeFileSync(path.join(밖, `base-${d.id}-${lv}.txt`), `${글}\n`);
    }
  }
  console.log(`[나이] ${대역.length}명 × (셀카 + 약 · 강) → ${밖}`);
}
