#!/usr/bin/env node
/**
 * 말 랠리 캠퍼스 판(WORLD 안 겉, 2026-11-04) — 동아리 탁구장의 태오 실사 판 지시문을 조립해 나노바나나 2.1 실행기의 작업 목록(jobs.json)을 쓴다.
 *
 * 태오는 드라마 인물(덧니 선배, 얼굴 기준 F1 — 결정 11-02 · 11-03)이라 실사 정지컷 줄(운영 원칙 역할 표 — Gemini Ultra 웹 나노바나나 2.1,
 * 승인 원본을 장면에 바로 참고로)로 굽는다. 참고 셋 = F1 · 쇼케이스 C1 · 웃는 기준(제2의 나 셀카 시험의 refs, 결정 11-03 「태오 기준 사진도 웃는 자연 사진」).
 *
 * 순서: ① 기준 판(1인칭 · 빈 탁구대 · 맞은편 태오, 9:16) 몇 장 → 하나를 고른다(탁구대가 반듯하고 태오가 F1과 닮은 판)
 *       ② 고른 기준 판을 Image 4로 넣어 표정 판(기다림 · 말 걺 · 받아침 · 놓침 · 웃음 — 기다림도 편집으로 다시 굽는다: 기준 판 셋째 장 네트 띠의 상표 같은 글씨를 빼고, 다섯 판을 같은 손질로 맞추려고)을 같은 자리 · 같은 빛으로 편집해 굽는다
 *       ③ 같은 방에서 입구(라켓 건네기) · 결과(손바닥 내밀기) 판.
 * 실행기 · 차례(_공용차례/차례.py gemini)는 제2의 나 셀카 시험의 gem21.mjs · run.sh · 차례.sh를 옮긴 것(공용 작업본 .tmp/talk-rally-world-20261104/nb/).
 *
 *   node experiences/talk-rally/qa/world-campus-20261104/굽기순서.mjs            # jobs.json 쓰기(고른 기준 판이 있으면 표정 · 입구 판까지)
 *   cd <공용>/.tmp/talk-rally-world-20261104/nb && bash 차례.sh "rally-base:1 rally-base:2"   # 차례를 잡은 뒤
 */
import fs from 'node:fs';
import path from 'node:path';
import { 여기, 밖 } from './경로.mjs';

const NB = path.join(밖, 'nb').replaceAll('\\', '/');
const 참고 = ['taeo2-f1.jpg', 'taeo2-c1.jpg', 'taeo2-smile.jpg'].map((f) => `${NB}/refs/${f}`);
const 읽기 = (f) => fs.readFileSync(path.join(여기, '지시문', f + '.md'), 'utf8').trim();
const 조립 = (...줄) => 줄.map(읽기).join('\n\n');

/** 고른 기준 판(밖/고른.json의 base). 고르기 전이면 null — 표정 · 입구 판은 그 뒤에 쓴다. */
function 고른기준() {
  try { const j = JSON.parse(fs.readFileSync(path.join(밖, '고른.json'), 'utf8')); return j.base ? `${NB}/out/${j.base}` : null; } catch { return null; }
}

const jobs = [{ id: 'rally-base', ratio: '9:16', refs: 참고, prompt: 조립('기준판', '_태오', '_공통'), out: `${NB}/out/rally-base-nb_g{n}.png` }];
const 기준 = 고른기준();
if (기준) {
  // 11-04 둘째 묶음(유호님 「표정만 좀 다양하게 · 맞췄을 때 · 틀렸을 때 · 연속으로 맞췄을 때 상호작용이 다양했으면」): speak nod quick wow pump wait cheerup
  for (const k of ['ready', 'talk', 'return', 'miss', 'cheer', 'speak', 'nod', 'quick', 'wow', 'pump', 'wait', 'cheerup']) {
    jobs.push({ id: `rally-${k}`, ratio: '9:16', refs: [...참고, 기준], prompt: 조립('_편집머리', `표정_${k}`, '_태오', '_공통'), out: `${NB}/out/rally-${k}-nb_g{n}.png` });
  }
  for (const k of ['lobby', 'result']) {
    jobs.push({ id: `rally-${k}`, ratio: '3:4', refs: [...참고, 기준], prompt: 조립(`판_${k}`, '_태오', '_공통'), out: `${NB}/out/rally-${k}-nb_g{n}.png` });
  }
}
fs.mkdirSync(path.join(밖, 'nb', 'out'), { recursive: true });
fs.writeFileSync(path.join(밖, 'nb', 'jobs.json'), JSON.stringify(jobs, null, 1));
for (const j of jobs) console.log(`${j.id} · ${j.ratio} · 참고 ${j.refs.length} · 지시문 ${j.prompt.length}자`);
if (jobs.some((j) => j.prompt.length > 4300)) { console.error('지시문이 4,300자를 넘는다(현장노트 gemini 「글을 넣자마자…」)'); process.exitCode = 1; }
