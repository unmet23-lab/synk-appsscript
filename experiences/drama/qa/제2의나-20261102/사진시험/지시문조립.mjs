#!/usr/bin/env node
/**
 * 「제2의 나」 사진 기반 아바타 작은 시험 (2026-11-03, 유호님 「작은 시험 해 봐」) — 지시문 조립.
 *
 * 묻는 것: 사용자가 올린 사진 한 장으로 「조금 더 잘생기고 예쁜 나」 기준 사진을 만들면 ① 본인 · 지인이 「이게 나」로 알아보나
 * ② 더 나아 보이나 ③ 그 기준 한 장만으로 1화 식당 태오 셀카가 셀카 시험의 관문(학생 0.84)을 넘나 ④ 한 사람에 몇 장 · 몇 초 드나.
 * 흐름(설계 10절 「모습 만드는 법 다시 정하기」): 올린 사진 → 기준 사진(웃는 자연 사진, 보정 세기 셋 약 · 중 · 강, 조각과 같은 빈 식당)
 * → 고른 기준 한 장으로 셀카 둘(김치 · 파이팅). 원본 사진은 기준을 만든 뒤에는 쓰지 않는다.
 * 대상: 유호님(실제 사진 한 장 — 고정 얼굴 세트의 셀카 꼴 pro01, 나머지 실제 사진 넷과 승인 시안 B는 닮음을 재는 자로만)과
 *      대역 둘(평범한 얼굴의 지어낸 학생이 기숙사 · 도서관에서 찍은 셀카 — 다른 나라 · 성별에서도 되는지).
 * 늘 까는 보정(11-03 유호님 「기존 전송받은 사진보다 젊고 주름없게 탄력있게 … 패시브로 항상」 → 같은 날 「대학교 스토리라 19살이나 20살쯤으로」):
 * 기준 사진 · 셀카 모두 `_젊게` 줄 — 올린 사람의 나이와 상관없이 19~20살쯤으로(10대는 조금 위로, 30~50대는 많이 아래로),
 * 주름 · 이마 선 · 눈 밑 그늘 · 처짐 없이 탄력 있는 피부, 고운 피부결은 남겨 밀랍 · 플라스틱처럼 매끈하지 않게, 웃어도 이마는 펴 둔다.
 * 엔진 B(나노바나나 2.1, Gemini 구독 · 현금 0). 유호님 얼굴 지시문에는 손질 문장 「well-rested and freshly groomed」을 늘 넣는다
 * (보정 세기 셋 모두 — 메모 「유호님 얼굴」, 현장노트 gemini 11-02).
 *
 *   node experiences/drama/qa/제2의나-20261102/사진시험/지시문조립.mjs
 *
 * 나오는 곳(공용 작업본, git 밖): `.tmp/me2-20261102/photo-nb/` · `photo-nb2/`의 jobs.json · refs/(올린 사진 · 고른 기준 · 태오 참고).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 작업 = path.join(공용작업본(뿌리), '.tmp', 'me2-20261102');
const 실행기 = ['photo-nb', 'photo-nb2'].map((d) => path.join(작업, d));
const 읽기 = (이름) => fs.readFileSync(path.join(여기, '지시문', `${이름}.md`), 'utf8').trim();
const 셀카읽기 = (이름) => fs.readFileSync(path.join(여기, '..', '셀카', '지시문', `${이름}.md`), 'utf8').trim();

export const 대상 = [
  { id: 'yuho', 옷: 'Clothes: a plain charcoal crew-neck sweater.', 올림: '실제 사진(고정 얼굴 세트 ref_pro01_face)' },
  { id: 'u1', 옷: 'Clothes: a cream knit cardigan over a plain white T-shirt.', 올림: 'up-u1(대역 — 지어낸 몽골 여학생의 기숙사 셀카)' },
  { id: 'u2', 옷: 'Clothes: a navy crew-neck sweatshirt.', 올림: 'up-u2(대역 — 지어낸 베트남 남학생의 도서관 셀카)' },
];
export const 세기 = ['약', '중', '강'];

export function 일감들(폴더) {
  const ref = (이름) => path.join(폴더, 'refs', `${이름}.jpg`).replace(/\\/g, '/');
  const out = (id) => path.join(폴더, 'out', `${id}-nb_g{n}.png`).replace(/\\/g, '/');
  const jobs = [];
  for (const u of ['u1', 'u2']) jobs.push({ id: `up-${u}`, ratio: '3:4', refs: [], prompt: [읽기(`대역_${u}`), 읽기('_규칙')].join('\n'), out: out(`up-${u}`) });
  for (const s of 대상) for (const lv of 세기) {
    jobs.push({ id: `base-${s.id}-${lv}`, ratio: '3:4', refs: [ref(`${s.id}-up`)],
      prompt: [읽기('_기준_머리'), s.옷, 읽기(`_보정_${lv}`), 읽기('_젊게'), 읽기('_기준_순간'), 읽기('_기준_빛결'), 읽기('_규칙')].join('\n'), out: out(`base-${s.id}-${lv}`) });
  }
  for (const s of 대상) for (const [pose, 줄] of [['kimchi', '김치7'], ['fight', '파이팅']]) {
    jobs.push({ id: `sf-${s.id}-${pose}`, ratio: '3:4', refs: [ref(`${s.id}-base`), ref('taeo2-f1'), ref('taeo2-c1'), ref('taeo2-c4'), ref('taeo2-smile')],
      prompt: [읽기('_셀카_신원'), `THE STUDENT: ${s.옷}`, 읽기('_젊게_셀카'), 읽기('_셀카_장소'), 셀카읽기(줄), 셀카읽기('_결3'), 읽기('_규칙')].join('\n'), out: out(`sf-${s.id}-${pose}`) });
  }
  for (const j of jobs) if (j.prompt.length > 4300) throw new Error(`${j.id} 지시문이 4,300자를 넘는다(${j.prompt.length})`);
  return jobs;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const 폴더 of 실행기) {
    const jobs = 일감들(폴더);
    fs.mkdirSync(path.join(폴더, 'refs'), { recursive: true });
    fs.writeFileSync(path.join(폴더, 'jobs.json'), JSON.stringify(jobs, null, 1) + '\n');
    console.log(`[조립] ${jobs.length}건 → ${path.join(폴더, 'jobs.json')} (${jobs.map((j) => `${j.id} ${j.prompt.length}자`).join(' · ')})`);
  }
}
