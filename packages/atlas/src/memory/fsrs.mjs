// ts-fsrs를 부르는 유일한 자리(설계 §3-2). 기억 계산은 여기서만 ts-fsrs에 닿고, 시험(test/build · test/properties)도 이것을 쓴다.
// 정해진 값(08-22): 판 5.4.2 · 목표 보유율 0.9 · 최대 간격 60일 · 흔들기 없음. Easy를 쓰지 않는 것은 등급 표(단계 2)의 일이다.
// 날 단위로 내림하는 일정 짜기는 쓰지 않는다 — 기억 계산(안정도 갱신 · 망각 곡선)만 쓴다(§3-2 「지난 시간은 실제 시간으로」).
// 짧은 간격 단계(enable_short_term)도 끈다: ts-fsrs의 기본은 켜짐이고, 켜면 같은 날(t = 0)의 갱신과 놓침 뒤 안정도가 달라진다.
// 같은 날의 답은 「같은 자리」 규칙(§3-2)이 하나로 묶으므로 FSRS의 짧은 간격 모형을 겹쳐 쓰지 않는다(시제품 · 일괄 계산과 같다).
// 판이 바뀌면(설치 · 잠금 고침) 여기서 바로 멈춘다 — 다음 판(FSRS-7, ts-fsrs 6)은 「기억 2판」 후보로 따로 견준다.
import { FSRSVersion, fsrs, generatorParameters } from 'ts-fsrs';

export const FSRS_VERSION = '5.4.2';
if (!String(FSRSVersion).startsWith(`v${FSRS_VERSION} `)) {
  throw new Error(`Atlas: ts-fsrs ${FSRS_VERSION}이 아니다(${FSRSVersion})`);
}

export const FSRS_SETTINGS = Object.freeze({
  request_retention: 0.9,
  maximum_interval: 60,
  enable_fuzz: false,
  enable_short_term: false,
});

export function createFsrs(settings = {}) {
  return fsrs(generatorParameters({ ...FSRS_SETTINGS, ...settings }));
}
