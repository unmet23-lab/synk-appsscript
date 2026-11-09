// 30일 가상 학습자 비교: 지금 엔진 · 고정 사다리(1·3·7·14·30일) 두 갈래 · 새 두뇌 시제품. 하루 한 판 20문항, 30일, 가정 둘(빨리 잊음 · 천천히 잊음).
// 환경 변수: LEARNERS(기본 40) · POLICIES(기본 current,ladder,ladderMix,brain) · BASES(기본 0.7,2 — 처음 만난 낱말의 반감기 중앙값, 일).
// 지금 엔진은 실제 코치를 돌리므로 가정 하나에 2분쯤 걸린다. 이 숫자는 규칙을 견주는 자료이고 실제 학습 효과의 증거가 아니다.
import { WORDS, daily, runMany } from './sim-core.mjs';

const LEARNERS = Number(process.env.LEARNERS || 40), DAYS = 30, PER_DAY = 20;
const names = (process.env.POLICIES || 'current,ladder,ladderMix,brain').split(',');
const bases = (process.env.BASES || '0.7,2').split(',').map(Number);
const label = { current: '지금 엔진', ladder: '사다리(복습 먼저)', ladderMix: '사다리(셋에 하나 새것)', brain: '새 두뇌' };
const pct = value => `${(100 * value).toFixed(0)}%`;

for (const base of bases) {
  console.log(`낱말 ${WORDS}개 · 하루 ${PER_DAY}문항 · ${DAYS}일 · 가상 학습자 ${LEARNERS}명 평균 · 첫 반감기 중앙값 ${base}일(하루 뒤 ${pct(Math.pow(2, -1 / base))} 기억)`);
  console.log('방식 | 7일째 아는 낱말 | 14일째 | 30일째 | 일주일 쉰 뒤 | 만난 낱말 | 또렷한데 또 물음 | 잊은 뒤에야 물음 | 정답률');
  for (const name of names) {
    const r = runMany(name, { truth: { base }, sessions: daily(DAYS, PER_DAY) }, LEARNERS);
    const cell = value => value.toFixed(1);
    console.log(`${label[name] || name} | ${cell(r.known(7))} | ${cell(r.known(14))} | ${cell(r.known(30))} | ${cell(r.rest)} | ${cell(r.met)} | ${pct(r.easy)} | ${pct(r.lost)} | ${pct(r.success)}`);
  }
  console.log('');
}
