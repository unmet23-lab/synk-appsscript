// 매개변수 판(설계 §6 「기억 · 난도 · 고르기의 숫자는 코드 상수가 아니라 판 이름이 붙은 자료다」).
// 새 판은 ① 가상 학습자 관문(설계 §11)을 넘고 ② 코호트 대조표에서 예측 오차가 나빠지지 않을 때 사람이 올린다.
// 판 이름(editions)은 제시 사건의 editions 칸(설계 §5-1)에 그대로 실린다. 숫자를 바꾸면 params 판 이름을 올린다.
// 08-22 확정값: 목표 보유율 0.9 · 최대 간격 60일 · 흔들기 없음 · Easy 없음. 나머지는 출발값이다(설계 §14 끝).
export const EDITIONS = Object.freeze({
  params: 'params-1',
  memory: 'memory-1',
  ability: 'ability-1',
  select: 'select-1',
});

export const PARAMS = Object.freeze({
  editions: EDITIONS,
  // 기억 1판(§3-2)
  retention: 0.9,
  maxIntervalDays: 60,
  weakWeight: 0.4, // 고르는 꼴을 혼자 맞힘 = 약한 성공: 안정도는 Good 증가분의 이만큼, 난이도 값은 Good과 같게
  sittingHours: 6, // 같은 단위를 이 시간 안에 다시 만난 것은 같은 자리 — 한 자리의 결과는 하나다
  // 끈질기게 틀리는 단위(§3-5): 최근 stubbornWindow자리에서 놓친 자리가 stubbornMisses 이상이고,
  // 놓침이 예상보다 많은 정도 z = Σ(m − q) / √Σq(1 − q) (q = 그 자리 앞의 1 − 떠올릴 확률)가 stubbornZ 이상
  stubbornWindow: 8,
  stubbornMisses: 3,
  stubbornZ: 2,
  // 난도 1판(§3-3 · §3-4)
  targetSuccess: 0.8,
  guess: Object.freeze({
    'binary-choice': 0.5,
    'single-choice': 0.25,
    'cup-compose': 0.05,
    action: 0.1,
    spoken: 0.02,
    unknown: 0.25,
  }),
  difficultyLogit: Object.freeze({ 1: -1, 2: 0, 3: 1 }),
  // θ 한 걸음의 크기 = floor + start / (1 + 측정 답 수 / half) — 답이 적을 때 크게, 쌓이면 잔잔하게(바닥은 배움을 따라갈 몫)
  abilityGain: Object.freeze({ floor: 0.25, start: 0.9, half: 4 }),
  // 고르기 1판(§3-5)
  retryGap: 2, // 틀린 것은 다른 문항 둘 뒤에 다시
  retryMax: 2, // 한 판에서 한 단위를 다시 내는 횟수
  newPerSession: 6, // 판 길이를 모를 때 한 판 새것 한도
  newPerDay: 20,
  dayStartHour: 4, // 한도의 하루는 기기 현지 시각 새벽 4시에 넘어간다
  interleave: 3, // 돌아온 것 셋에 새것 하나
  backlog: 20, // 돌아온 단위가 이보다 많으면 살릴 수 있는 것부터
  reviewsPerDay: 60,
  breatherAfter: 2,
  breatherSuccess: 0.85,
  avoidRecent: 2, // 바로 앞 두 문항과 같은 계열은 피한다
  promoteAtDays: 7, // 간격이 이만큼 벌어진 단위는 만들어 내는 꼴 문항을 먼저
  stubbornShare: 5, // 끈질긴 단위를 겨눠 돌아온 것으로 내는 몫: 판 길이의 1/이 값(최소 1)
  stubbornPerSession: 4, // 판 길이를 모를 때의 그 몫
});
