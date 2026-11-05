#!/usr/bin/env node
/**
 * 「제2의 나」 얼굴 조각 시즌 1 후보 — 기준 사진(웃는 자연 사진) 지시문 조립 (2026-11-03).
 *
 * 설계 5절: 조각은 얼굴과 머리를 한 번에 굽고, 지시문은 「그 나라의 흔한 얼굴 특징 → 매력」 순서로 쓴다.
 * 결정 11-03 「조각 기준 사진 = 웃는 자연 사진」: 조각마다 기준 사진은 손님 없는 빈 장면에서 새로 구운 웃는 자연 사진 한 장 —
 * 셀카 6차의 빈 식당 판(`셀카/지시문/학생_웃음3.md`)과 같은 자리 · 빛 · 결로 굽고(엔진 B, 나노바나나 2.1), 손보지 않는다.
 * T-C에서 온 mn-f는 그 학생증을 Image 1로 넣어 같은 사람을 잇고, 새 조각은 글로만 굽는다. uz-m은 실존 인물 인상(T-C Fable P1)으로
 * 얼굴 특징 다섯(얼굴형 · 눈 · 눈썹 · 코 · 머리)을 바꿔 새로 굽고, mn-m · vn-f는 실존 대조에서 판별 모델 둘 모두 「중간」이라(11-05) 같은 식으로 새로 굽는다.
 *
 *   node experiences/drama/qa/제2의나-20261102/조각/지시문조립.mjs
 *
 * 나오는 곳(공용 작업본, git 밖): 실행기 폴더 둘 `.tmp/me2-20261102/piece-nb/` · `piece-nb2/`의 jobs.json(같은 일감 — Gemini 두 줄로 나눠 굽는다).
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
const 실행기 = ['piece-nb', 'piece-nb2'].map((d) => path.join(작업, d));
const 읽기 = (이름) => fs.readFileSync(path.join(여기, '지시문', `${이름}.md`), 'utf8').trim();
const 규칙 = fs.readFileSync(path.join(여기, '..', 'T-C', '지시문', '_공통_규칙.md'), 'utf8').trim();

// 조각표 — 지역 · 성별 · 얼굴형. 몽골 · 중앙아시아 · 동남아는 성별마다 둥근형 · 갸름형 둘, 남아시아 · 아프리카 · 유럽은 성별마다 하나, 중성적 인상 둘.
export const 조각표 = [
  { id: 'mn-m', 지역: '몽골', 성별: '남', 얼굴형: '둥근형(넓은 광대)', 다시: 'T-C mn-m(판별 모델 둘 모두 중간 — 짙은 일자 눈썹 · 각진 턱) — 턱 · 눈썹 · 코 · 머리를 바꿈' },
  { id: 'mn-m2', 지역: '몽골', 성별: '남', 얼굴형: '갸름형' },
  { id: 'mn-f', 지역: '몽골', 성별: '여', 얼굴형: '갸름형', 참고: 'T-C/판/mn-f-id2_042038.png' },
  { id: 'mn-f2', 지역: '몽골', 성별: '여', 얼굴형: '둥근형' },
  { id: 'mn-x', 지역: '몽골', 성별: '중성적', 얼굴형: '갸름형', 다시: '첫 판(역검색에 같은 공인 셋이 모임, 단발 여학생으로 읽힘) — 얼굴형 · 눈썹 · 머리 · 옷을 바꿈' },
  { id: 'uz-m', 지역: '중앙아시아(우즈베크)', 성별: '남', 얼굴형: '둥근형', 다시: 'T-C uz-m(실존 인물 인상) — 얼굴형 · 눈 · 눈썹 · 코 · 머리를 바꿈' },
  { id: 'kz-m', 지역: '중앙아시아(카자흐)', 성별: '남', 얼굴형: '갸름형' },
  { id: 'uz-f', 지역: '중앙아시아(우즈베크)', 성별: '여', 얼굴형: '갸름형', 다시: '첫 판(판별 모델 둘 모두 중간 — 짙은 아치형 눈썹 · 콧대 · 긴 웨이브) — 얼굴형 · 눈썹 · 코 · 머리를 바꿈' },
  { id: 'kz-f', 지역: '중앙아시아(카자흐)', 성별: '여', 얼굴형: '둥근형' },
  { id: 'vn-m', 지역: '동남아(베트남)', 성별: '남', 얼굴형: '둥근형' },
  { id: 'th-m', 지역: '동남아(태국)', 성별: '남', 얼굴형: '갸름형' },
  { id: 'vn-f', 지역: '동남아(베트남)', 성별: '여', 얼굴형: '갸름형', 다시: 'T-C vn-f(판별 모델 둘 모두 중간 — 크고 또렷한 쌍꺼풀 눈 · 앞머리 · 입술 굴곡) — 눈 · 눈썹 · 턱 · 입 · 머리를 바꿈' },
  { id: 'id-f', 지역: '동남아(인도네시아)', 성별: '여', 얼굴형: '둥근형' },
  { id: 'in-m', 지역: '남아시아(인도)', 성별: '남', 얼굴형: '갸름형' },
  { id: 'np-f', 지역: '남아시아(네팔)', 성별: '여', 얼굴형: '둥근형' },
  { id: 'et-m', 지역: '아프리카(에티오피아)', 성별: '남', 얼굴형: '갸름형' },
  { id: 'ng-f', 지역: '아프리카(나이지리아)', 성별: '여', 얼굴형: '둥근형' },
  { id: 'pl-m', 지역: '유럽(폴란드)', 성별: '남', 얼굴형: '둥근형' },
  { id: 'fr-f', 지역: '유럽(프랑스)', 성별: '여', 얼굴형: '갸름형' },
  { id: 'nl-x', 지역: '유럽(네덜란드)', 성별: '중성적', 얼굴형: '갸름형', 다시: '첫 판(판별 모델 둘 모두 중간 — 길고 좁은 얼굴 · 긴 코 · 금발 앞머리) — 얼굴형 · 코 · 머리를 바꿈' },
];

const 조각줄 = (c) => (c.참고 ? fs.readFileSync(path.join(뿌리, 'experiences', 'drama', 'qa', '제2의나-20261102', 'T-C', '지시문', `조각_${c.id}.md`), 'utf8').trim() : 읽기(`조각_${c.id}`));

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const 폴더 of 실행기) {
    const jobs = 조각표.filter((c) => !c.기준).map((c) => {
      const 줄 = [읽기('_머리'), ...(c.참고 ? [읽기('_참고')] : []), 조각줄(c), 읽기('_순간'), 읽기('_빛결'), 규칙];
      const 몸 = 줄.join('\n');
      if (몸.length > 4300) throw new Error(`${c.id} 나노바나나 지시문이 4,300자를 넘는다(${몸.length})`);
      const refs = c.참고 ? [path.join(폴더, 'refs', `${c.id}-id.jpg`).replace(/\\/g, '/')] : [];
      return { id: `pc-${c.id}`, ratio: '3:4', refs, prompt: 몸, out: path.join(폴더, 'out', `pc-${c.id}-nb_g{n}.png`).replace(/\\/g, '/') };
    });
    fs.mkdirSync(path.join(폴더, 'refs'), { recursive: true });
    for (const c of 조각표.filter((x) => x.참고)) {
      const 받는곳 = path.join(폴더, 'refs', `${c.id}-id.jpg`);
      if (!fs.existsSync(받는곳)) console.log(`[조립] 참고 없음 — ${c.참고}를 ${받는곳}(jpg)로 옮겨 둔다`);
    }
    fs.writeFileSync(path.join(폴더, 'jobs.json'), JSON.stringify(jobs, null, 1) + '\n');
    console.log(`[조립] ${jobs.length}건 → ${path.join(폴더, 'jobs.json')} (${jobs.map((j) => `${j.id.slice(3)} ${j.prompt.length}자`).join(' · ')})`);
  }
}
