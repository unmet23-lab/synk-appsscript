#!/usr/bin/env node
/**
 * 「제2의 나」 셀카 한 장면 시험 (2026-11-02, 유호님 「시험해 봐」) — 지시문 조립.
 *
 * 1화 식당 끝에 태오와 찍는 셀카를 「준비(화면 보며 머리 만지기) → 학생이 고른 포즈 → 태오가 그 포즈에 맞춰 반응」으로 굽는다.
 * 엔진 B(나노바나나 2.1) · 승인 원본을 바로 참고(결 시안 5절 「원본」 방식) · 학생증을 Image 1로 · 눈 뜬 웃음(Fable 제안).
 * 장마다 여러 장 구워 굽기 관문(학생 ↔ 학생증 0.84 · 태오 ↔ 승인 둘 평균 0.88)을 넘는 판만 쓴다.
 * 원고는 `지시문/*.md`, 조각 줄은 T-C `조각_mn-m.md`, 규칙은 결 시안 `_규칙.md`를 그대로 읽는다.
 *
 *   node experiences/drama/qa/제2의나-20261102/셀카/지시문조립.mjs
 *
 * 나오는 곳(공용 작업본, git 밖): 실행기 폴더 `.tmp/me2-20261102/selfie-nb/jobs.json`
 * (결 시안 nb 실행기를 경로 · 차례 이름만 바꿔 옮긴 것 — ego nodejs import가 한글 경로를 안 거치게 영문 폴더).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
export const nb폴더 = process.env.ME2_SELFIE_NB || path.join(공용작업본(뿌리), '.tmp', 'me2-20261102', 'selfie-nb');
const 읽기 = (f) => {
  const [곳, 이름] = f.includes(':') ? f.split(':') : ['셀카', f];
  const 폴더 = { 셀카: path.join(여기, '지시문'), 'T-C': path.join(여기, '..', 'T-C', '지시문'), 결: path.join(여기, '..', '결', '지시문') }[곳];
  return fs.readFileSync(path.join(폴더, `${이름}.md`), 'utf8').trim();
};

// 장면마다 순간 줄 하나만 바꾼다. 참고는 학생증 + 태오 승인 둘(식당 · 캠퍼스).
export const 일감 = [['sf-prep', '준비'], ['sf-kimchi', '김치'], ['sf-bite', '한입'], ['sf-fight', '파이팅']].map(([id, 순간]) => ({
  id, 줄: ['_신원', '_장소', 순간, '_결', 'T-C:조각_mn-m', '결:_규칙'], 참고: ['mn-m-id', 'taeo-cafeteria', 'taeo-campus'],
}));
// 2차(Fable): 1차는 학생 참고가 무표정 학생증 한 장뿐이라 크게 웃는 컷에서 얼굴이 둥글어졌다(0/16 통과).
// 학생증에서 B로 웃는 얼굴을 굽고(학생증과 0.84 넘는 판만 승인 → refs/mn-m-smile.jpg), 장면은 학생 둘 + 태오 둘 참고로 다시 굽는다.
일감.push({ id: 'sf-smile', 줄: ['학생_웃음', 'T-C:조각_mn-m', '결:_규칙'], 참고: ['mn-m-id'] });
// 3차(Fable P1): 웃는 얼굴 참고의 식당 배경 손님이 장면 뒤로 새어 들었다 — 민벽 배경으로 다시 굽는다(→ refs/mn-m-smile2.jpg).
일감.push({ id: 'sf-smile2', 줄: ['학생_웃음2', 'T-C:조각_mn-m', '결:_규칙'], 참고: ['mn-m-id'] });
// 2차 장면: 한입은 「젓가락은 니트 소매의 손, 태오 손은 비어 있음」, 구석 흐린 손 금지, 머리 볼륨 유지.
// 포즈를 고르면 셔터 전에 태오가 먼저 따라 움직이는 컷(Fable 「반응은 셔터 전에 움직이는 데서 읽힌다」)도 함께.
for (const [id, 순간] of [['sf2-prep', '준비'], ['sf2-kimchi', '김치'], ['sf2-bite', '한입2'], ['sf2-fight', '파이팅'], ['sf2-pre-kimchi', '김치_준비'], ['sf2-pre-bite', '한입_준비'], ['sf2-pre-fight', '파이팅_준비']]) {
  일감.push({ id, 줄: ['_신원2', '_장소2', 순간, '_결', 'T-C:조각_mn-m', '결:_규칙'], 참고: ['mn-m-id', 'mn-m-smile', 'taeo-cafeteria', 'taeo-campus'] });
}
// 3차(11-02 유호님 「섞기로」): 얼굴 판은 「김치!」 · 「파이팅!」과 준비 · 셔터 전 컷만. 학생 참고 = 학생증 + 민벽 웃는 얼굴,
// 학생 표정은 「입 다문 미소 또는 윗니만 · 눈 뜸」(Fable — 크게 웃을수록 얼굴이 흔들림), 뒤 손님은 한국 대학생으로 적는다.
for (const [id, 순간] of [['sf3-prep', '준비'], ['sf3-pre-kimchi', '김치_준비3'], ['sf3-kimchi', '김치3'], ['sf3-pre-fight', '파이팅_준비'], ['sf3-fight', '파이팅3']]) {
  일감.push({ id, 줄: ['_신원3', '_장소3', 순간, '_결3', 'T-C:조각_mn-m', '결:_규칙'], 참고: ['mn-m-id', 'mn-m-smile2', 'taeo-cafeteria', 'taeo-campus'] });
}
// 4차(11-02 유호님 「4차 구워」): 3차는 참고 둘이 모두 배경 없는 증명사진 꼴이라 학생 얼굴이 모델 기본 얼굴로 미끄러졌다(Fable).
// 승인 웃는 얼굴(0.879)에서 사람만 오려 같은 사진을 크게 흐린 배경 위에 얹는다 — 식당 빛 · 색은 남고 뒤 손님은 알아볼 수 없다(→ refs/mn-m-smile3.jpg).
for (const [id, 순간] of [['sf4-prep', '준비'], ['sf4-pre-kimchi', '김치_준비3'], ['sf4-kimchi', '김치3'], ['sf4-pre-fight', '파이팅_준비'], ['sf4-fight', '파이팅3']]) {
  일감.push({ id, 줄: ['_신원3', '_장소3', 순간, '_결3', 'T-C:조각_mn-m', '결:_규칙'], 참고: ['mn-m-id', 'mn-m-smile3', 'taeo-cafeteria', 'taeo-campus'] });
}
// 5차(가르기): 2차는 2/18 통과, 3 · 4차는 0/12 — 참고와 지시문을 함께 바꿨다. 2차 지시문 그대로에 4차 참고(흐린 배경)만 넣어 어느 쪽 탓인지 가른다.
for (const [id, 순간] of [['sf5-kimchi', '김치'], ['sf5-fight', '파이팅']]) {
  일감.push({ id, 줄: ['_신원2', '_장소2', 순간, '_결', 'T-C:조각_mn-m', '결:_규칙'], 참고: ['mn-m-id', 'mn-m-smile3', 'taeo-cafeteria', 'taeo-campus'] });
}
// 6차: 5차 가르기 결과 — 같은 지시문에서도 오리거나 흐린 참고는 얼굴이 덜 옮겨졌다(웃는 얼굴 닮음 2차 0.87 → 5차 0.79, 두 참고로 교차해도 같음).
// 손보지 않은 자연 사진이 얼굴을 잘 옮긴다 → 손님 없는 빈 식당에서 웃는 얼굴을 새로 굽고(sf-smile3 → refs/mn-m-smile4.jpg), 2차 지시문으로 김치 · 파이팅을 다시 굽는다.
일감.push({ id: 'sf-smile3', 줄: ['학생_웃음3', 'T-C:조각_mn-m', '결:_규칙'], 참고: ['mn-m-id'] });
for (const [id, 순간] of [['sf6-kimchi', '김치'], ['sf6-fight', '파이팅'], ['sf6-pre-kimchi', '김치_준비'], ['sf6-pre-fight', '파이팅_준비'], ['sf6-prep', '준비']]) {
  일감.push({ id, 줄: ['_신원2', '_장소2', 순간, '_결', 'T-C:조각_mn-m', '결:_규칙'], 참고: ['mn-m-id', 'mn-m-smile4', 'taeo-cafeteria', 'taeo-campus'] });
}
// 손 판(11-02 유호님 「같이 시험해」): 학생 얼굴 없이 학생의 팔 · 어깨 · 손만 나오고 태오가 그 손에 반응한다.
// 학생 참고가 없어 조각마다 굽지 않고 장면마다 한 번만 — 얼굴 판과 어느 쪽이 더 「나 같고 재밌나」를 견준다.
for (const [id, 순간] of [['sh-prep', '준비_손'], ['sh-kimchi', '김치_손'], ['sh-bite', '한입_손'], ['sh-fight', '파이팅_손'], ['sh-pre-kimchi', '김치_손_준비'], ['sh-pre-bite', '한입_손_준비'], ['sh-pre-fight', '파이팅_손_준비']]) {
  일감.push({ id, 줄: ['_신원_손', '_장소_손', 순간, '_결', '결:_규칙'], 참고: ['taeo-cafeteria', 'taeo-campus'] });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const jobs = 일감.map((j) => {
    const 몸 = j.줄.map(읽기).join('\n\n');
    if (몸.length > 4300) throw new Error(`${j.id} 나노바나나 지시문이 4,300자를 넘는다(${몸.length})`);
    console.log(`[조립] ${j.id} ${몸.length}자`);
    return { id: j.id, ratio: '3:4', refs: j.참고.map((r) => path.join(nb폴더, 'refs', `${r}.jpg`).replace(/\\/g, '/')), prompt: 몸, out: path.join(nb폴더, 'out', `${j.id}-nb_g{n}.png`).replace(/\\/g, '/') };
  });
  fs.mkdirSync(nb폴더, { recursive: true });
  fs.writeFileSync(path.join(nb폴더, 'jobs.json'), JSON.stringify(jobs, null, 1) + '\n');
  console.log(`[조립] 나노바나나 일감 ${jobs.length}건 → ${path.join(nb폴더, 'jobs.json')}`);
}
